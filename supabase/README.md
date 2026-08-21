# StoryMap server side

Everything here runs on Supabase, not on the device. It exists for one reason: the
Anthropic and Voyage API keys must never reach client code. The PWA's AI features still
call `api.anthropic.com` directly from `index.html`, which is why they have never actually
worked — this is the fix, and the mobile app is built against it from the start.

```
supabase/
  migrations/   SQL to run once, by hand, in the dashboard
  functions/
    assistant/  the Icarus + Daedalus Edge Function
```

## 1. Run the migration

You need DDL rights, which the app's anon key does not have and never should. Two ways to
get them, both using access you already own as the project's owner:

**The dashboard (no install, recommended).**

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) and pick the StoryMap project.
2. **SQL Editor** in the left sidebar → **New query**.
3. Paste the whole of `migrations/20260821_assistant_retrieval.sql` and press **Run**.

The editor connects as `postgres`, the database superuser, so it can create extensions and
tables. The migration is written to be safe to run twice — every statement is guarded with
`if not exists` or `or replace` — so re-running it after an edit is fine.

**The CLI**, if you would rather keep migrations in version control:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies anything in `migrations/` that the remote has not seen. It asks for the
database password, which is under **Project Settings → Database**, not your account
password.

To confirm it worked, run this in the SQL Editor — it should return one row:

```sql
select count(*) from public.content_chunks;
```

## 2. Set the function's secrets

These are stored by Supabase and injected at runtime. They are never bundled into the app.

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set VOYAGE_API_KEY=pa-...
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically — do not set them.

Anthropic has no embeddings API, so retrieval needs a second vendor; this is built against
Voyage, which is Anthropic's recommended partner. Get a key at
[voyageai.com](https://www.voyageai.com/). If you would rather not add a second vendor, the
embedding calls in `functions/assistant/index.ts` are isolated to `embed()` and
`embedQuery()` and can be pointed elsewhere — but note the `vector(1024)` column type in
the migration is sized for Voyage's `voyage-3.5`, so a provider with different dimensions
means altering that column and re-indexing.

## 3. Deploy the function

```bash
npx supabase functions deploy assistant
```

## Billing

Both keys bill per request. Nothing is charged while the assistant toggle is off — with one
caveat worth knowing: **indexing costs money too**, because embedding a chapter is an API
call. Indexing is therefore gated on the same toggle, and only runs while the assistant is
switched on. Turning it on for the first time pays to index the existing manuscript once;
after that only changed chunks are re-embedded, which is why chunks carry a content hash.

Set a spend cap in the Anthropic console if you want a hard ceiling rather than a habit.

## Routes

Both take a signed-in user's JWT in `Authorization`. The function forwards it to PostgREST
and runs as that user, so row-level security decides what can be read — the service role key
is deliberately not used anywhere, which means a bug in this function cannot expose one
account's manuscript to another.

### `POST /assistant/index`

```json
{ "projectId": "...", "sourceType": "chapter", "sourceId": "...", "title": "...", "content": "..." }
```

Chunks on paragraph boundaries, embeds only what changed, returns `{ indexed, total, unchanged }`.

### `POST /assistant/ask`

```json
{ "projectId": "...", "agent": "daedalus", "question": "...", "history": [], "currentChapter": "..." }
```

Returns `{ agent, text, sources, usage }`. `sources` is what the answer was actually built
from, so the writer can check it rather than take it on faith.
