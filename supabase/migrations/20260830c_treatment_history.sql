-- Stage Two, addendum: autosave history on a treatment version. NOT APPLIED -- for review.
--
-- Small, additive, and it resolves a conflation in the brief rather than adding a feature.
--
-- The brief asks for two things that turn out to be different:
--
--   1. treatment_versions rows, where "multiple live versions is a legitimate resting state"
--      -- i.e. two readings of a scene the writer is deliberately holding open at once.
--
--   2. autosave "on the established debounce with the pushVersion cadence already used for
--      pages (one snapshot per ~3 minutes of writing, oldest never dropped)".
--
-- Those are not the same object. A version is an AUTHORIAL act; a snapshot is the text that
-- was about to be overwritten. If the 3-minute cadence wrote rows, a treatment worked on for
-- an afternoon would carry forty of them, and the one property the status field exists to
-- express -- "these two are both live, on purpose" -- would be unfindable among the noise.
-- `status` would also come to mean two unrelated things at once: "an autosave" and "a draft I
-- deliberately set aside".
--
-- So: rows stay authorial and status keeps one meaning, while the overwrite trail lives here,
-- exactly as it does on sticky_notes.versions. Same shape, same cadence, same rule that the
-- oldest entry is never the one dropped -- the first thing a version said is the entry most
-- worth having.
--
-- The alternative considered and rejected: marking autosave snapshots `stale` automatically.
-- It needs no migration, and it destroys the distinction the status column was added for.

alter table public.treatment_versions
  add column if not exists history jsonb not null default '[]'::jsonb;

comment on column public.treatment_versions.history is
  'Prior text of THIS version, newest first: [{"savedAt": timestamptz, "content": text}]. '
  'Same shape and cadence as sticky_notes.versions -- one snapshot per ~3 minutes of writing, '
  'capped, and the oldest is never the entry discarded. Distinct from a treatment_versions '
  'row, which is an authorial version the writer chose to keep; this is only the trail of '
  'text that was about to be overwritten, and it never appears in the version list.';
