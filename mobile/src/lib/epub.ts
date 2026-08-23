import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import type { Chapter } from '../store/chapterStore';
import { BOOKS } from './storyData';

// EPUB export, ported from the PWA's buildEpubBlob (index.html) so the two produce the same
// book from the same data. EPUB 2 rather than 3: it is what every reader accepts, and the
// only thing being shipped here is ordered prose with a table of contents.
//
// The difference from the PWA is the last step and only the last step. A browser gets a Blob
// and calls it a download; a phone has no such thing, so the archive is written to the app's
// cache directory as base64 and handed to the share sheet -- which is what puts it in Drive,
// Books, or an email, wherever the writer actually wants it.

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Blank-line-separated blocks become paragraphs. Chapter prose is plain text throughout this
// app -- there is no markup to preserve, so there is none to lose.
function paragraphs(text: string): string {
  const blocks = String(text ?? '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return '<p></p>';
  return blocks.map((b) => `<p>${escapeXml(b).replace(/\n/g, '<br/>')}</p>`).join('\n');
}

function chapterXhtml(title: string, body: string, outlineOnly: boolean): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"/><title>${escapeXml(title)}</title></head>
<body>
<h1>${escapeXml(title)}</h1>
${outlineOnly ? '<p><em>(Outline — not yet drafted)</em></p>' : ''}
${paragraphs(body)}
</body>
</html>`;
}

// RFC 4122 v4 without a crypto dependency. This is a document identifier, not a secret --
// it only has to be unique enough that two exports are not the same book.
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type EpubScope = { bookIndex: number | null };

export function epubFilename(projectName: string, scope: EpubScope): string {
  const book = scope.bookIndex === null ? '' : ` - ${BOOKS[scope.bookIndex]}`;
  // Anything a filesystem might object to, flattened. A title with a colon in it is common
  // and would otherwise fail the write with an error about a path.
  const safe = `${projectName}${book}`
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    // An em dash between the name and the book leaves a run of hyphens once it is stripped.
    .replace(/-{2,}/g, '-');
  return `${safe || 'storymap'}.epub`;
}

/**
 * Builds the archive and hands it to the share sheet.
 *
 * Chapters arrive already filtered and ordered by the caller. A chapter with no prose is
 * included as an outline stub rather than skipped -- an export that silently omits the parts
 * you have not written yet is an export you cannot use to see where you are.
 */
export async function exportEpub(
  projectName: string,
  chapters: Chapter[],
  scope: EpubScope,
): Promise<{ error: string | null }> {
  if (chapters.length === 0) return { error: 'Nothing to export — no chapters in this selection.' };

  const zip = new JSZip();
  // Must be first in the archive and must be stored uncompressed. This is the one part of
  // the format that is not just XML in a zip, and getting it wrong produces a file that
  // every reader rejects without saying why.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.folder('META-INF')!.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder('OEBPS')!;
  const manifest: string[] = [];
  const spine: string[] = [];
  const nav: string[] = [];

  chapters.forEach((ch, i) => {
    const n = i + 1;
    const file = `chapter${n}.xhtml`;
    const outlineOnly = !ch.content || ch.content.trim().length === 0;
    const body = outlineOnly ? ch.notes || '' : ch.content;
    oebps.file(file, chapterXhtml(ch.title, body, outlineOnly));
    manifest.push(`<item id="chap${n}" href="${file}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="chap${n}"/>`);
    nav.push(
      `<navPoint id="navpoint-${n}" playOrder="${n}"><navLabel><text>${escapeXml(
        ch.title,
      )}</text></navLabel><content src="${file}"/></navPoint>`,
    );
  });

  const id = uuid();
  const title = scope.bookIndex === null ? projectName : `${projectName} — ${BOOKS[scope.bookIndex]}`;

  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId" opf:scheme="UUID">urn:uuid:${id}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifest.map((x) => '    ' + x).join('\n')}
  </manifest>
  <spine toc="ncx">
${spine.map((x) => '    ' + x).join('\n')}
  </spine>
</package>`,
  );

  oebps.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${nav.map((x) => '    ' + x).join('\n')}
  </navMap>
</ncx>`,
  );

  try {
    // base64 because there is no Blob here. expo-file-system v57 replaced the old
    // writeAsStringAsync/cacheDirectory pair with File/Paths -- the legacy names still exist
    // as exports but throw at runtime, so they are worse than missing.
    const base64 = await zip.generateAsync({ type: 'base64' });
    const file = new File(Paths.cache, epubFilename(projectName, scope));
    // Cache, not documents: this is a handoff to the share sheet, not something the app
    // needs to keep. The system can reclaim it whenever it likes.
    if (file.exists) file.delete();
    file.create();
    file.write(base64, { encoding: 'base64' });

    if (!(await Sharing.isAvailableAsync())) {
      // The file exists either way; without a share sheet there is just no way to hand it on.
      return { error: 'The file was written, but this device has no way to share it.' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/epub+zip',
      dialogTitle: 'Export as eBook',
      UTI: 'org.idpf.epub-container',
    });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not write the file.' };
  }
}
