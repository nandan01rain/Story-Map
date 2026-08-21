import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

// Google Drive import. The point is to stop hand-copying worldbuilding docs into
// Documents one at a time -- pick the files (or a folder) once, and pull them in.
//
// Auth goes through Supabase's Google provider rather than talking to Google directly.
// That is not incidental: Google will not accept an `exp://` or custom-scheme redirect for
// a Web OAuth client, and an Android client needs a package name plus SHA-1 fingerprint,
// which means a development build and no more Expo Go. Supabase's callback is an ordinary
// https URL that Google is happy with, and it is already part of this app's stack. The
// account is LINKED rather than signed into, because the user already has an email/password
// identity here and signing in with Google would otherwise strand them on a second account.
//
// Supabase hands back Google's own access token as `provider_token` at the moment the link
// completes, and does not persist it -- so it is captured here and kept on the device. It
// is a Drive token, not a StoryMap credential: worst case it expires and the user
// reconnects.
//
// SETUP REQUIRED (account work, not code): a Google Cloud OAuth client with the Drive
// scope on its consent screen, and that client's id/secret entered under Google in the
// Supabase Auth dashboard. Until both exist, connect() will fail with Google's own error.
const TOKEN_KEY = 'google-drive-token';
// drive.readonly rather than drive.file: drive.file only reaches files the app itself
// created or the user opened through Google's own picker, which does not exist in React
// Native -- so it could never see documents written before StoryMap was involved, which is
// the entire use case. readonly is also the narrowest scope that can browse; nothing here
// writes to Drive.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

export type StoredToken = { accessToken: string; expiresAt: number };

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

// What can actually become a text document. Sheets/Slides are deliberately excluded --
// they export as CSV/plain text badly enough to be worse than not importing them.
const IMPORTABLE_MIMES = [GOOGLE_DOC_MIME, 'text/plain', 'text/markdown', 'application/rtf'];

export function isImportable(file: DriveFile): boolean {
  return IMPORTABLE_MIMES.includes(file.mimeType);
}

export async function getStoredToken(): Promise<StoredToken | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as StoredToken;
    // A minute of slack, so a call isn't started with a token about to die mid-flight.
    if (!token.accessToken || token.expiresAt < Date.now() + 60_000) return null;
    return token;
  } catch {
    return null;
  }
}

export async function clearStoredToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function storeToken(accessToken: string, expiresInSeconds: number) {
  const token: StoredToken = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 };
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

// Opens Google's consent screen and returns once a Drive token is in hand. Uses
// skipBrowserRedirect so the URL can be opened in an in-app auth session that reports back
// when it closes -- letting the system browser navigate on its own would leave this
// function with no way to know the result.
export async function connectDrive(): Promise<{ error: string | null }> {
  const redirectTo = Linking.createURL('google-drive');
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      scopes: DRIVE_SCOPE,
      redirectTo,
      skipBrowserRedirect: true,
      // Google only issues a refresh token on the first consent unless it is asked to
      // prompt again, and only returns one at all for offline access.
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) return { error: error.message };
  if (!data?.url) return { error: 'Google did not return a sign-in URL.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return { error: result.type === 'cancel' ? 'Connection cancelled.' : 'Google sign-in did not complete.' };
  }

  // The tokens come back in the URL fragment, which Supabase's client does not parse for
  // us on native the way it would in a browser.
  const parsed = parseAuthFragment(result.url);
  if (parsed.error) return { error: parsed.error };
  if (!parsed.accessToken || !parsed.refreshToken) {
    return { error: 'Google sign-in returned no session.' };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken,
  });
  if (sessionError) return { error: sessionError.message };

  if (!parsed.providerToken) {
    return { error: 'Connected, but Google did not grant Drive access. Check the Drive scope on the consent screen.' };
  }
  await storeToken(parsed.providerToken, parsed.providerExpiresIn ?? 3000);
  return { error: null };
}

function parseAuthFragment(url: string): {
  accessToken?: string;
  refreshToken?: string;
  providerToken?: string;
  providerExpiresIn?: number;
  error?: string;
} {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const raw =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  if (!raw) return { error: 'Google returned no tokens.' };
  const params = new URLSearchParams(raw);
  const errorDescription = params.get('error_description') ?? params.get('error');
  if (errorDescription) return { error: errorDescription };
  const expires = params.get('provider_expires_in');
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    providerToken: params.get('provider_token') ?? undefined,
    providerExpiresIn: expires ? Number(expires) : undefined,
  };
}

async function driveFetch(path: string, token: string): Promise<Response> {
  return fetch(`${DRIVE_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

// Lists one folder, or searches by name across the whole Drive when a query is given.
// Folders sort first so browsing feels like a file manager rather than a flat dump.
export async function listFiles(
  token: string,
  { folderId, query }: { folderId?: string; query?: string },
): Promise<{ files: DriveFile[]; error: string | null }> {
  const clauses = ['trashed = false'];
  if (query && query.trim()) {
    clauses.push(`name contains '${query.trim().replace(/'/g, "\\'")}'`);
  } else {
    clauses.push(`'${folderId ?? 'root'}' in parents`);
  }
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    pageSize: '200',
    orderBy: 'folder,name',
    // Without these, files in Shared Drives simply don't appear, with no error to explain it.
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  try {
    const response = await driveFetch(`/files?${params.toString()}`, token);
    if (response.status === 401) return { files: [], error: 'AUTH' };
    if (!response.ok) return { files: [], error: `Drive error ${response.status}` };
    const body = (await response.json()) as { files?: DriveFile[] };
    return { files: body.files ?? [], error: null };
  } catch (e) {
    return { files: [], error: e instanceof Error ? e.message : 'Could not reach Drive.' };
  }
}

// Google Docs have no bytes to download -- they must be exported to a real format. Plain
// text loses formatting, which is the right trade here: Documents stores free text, and a
// character bible's value is its words.
export async function fetchFileText(token: string, file: DriveFile): Promise<{ text: string | null; error: string | null }> {
  const path =
    file.mimeType === GOOGLE_DOC_MIME
      ? `/files/${file.id}/export?mimeType=text/plain&supportsAllDrives=true`
      : `/files/${file.id}?alt=media&supportsAllDrives=true`;
  try {
    const response = await driveFetch(path, token);
    if (response.status === 401) return { text: null, error: 'AUTH' };
    if (!response.ok) return { text: null, error: `Drive error ${response.status}` };
    return { text: await response.text(), error: null };
  } catch (e) {
    return { text: null, error: e instanceof Error ? e.message : 'Could not download the file.' };
  }
}
