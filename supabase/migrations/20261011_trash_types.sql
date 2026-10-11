-- Let the trash hold storyboard events. NOT APPLIED -- paste into the Supabase SQL editor once.
--
-- The `trash` table predates this repo's migrations (the PWA created it), and it carries a
-- check constraint, `trash_type_check`, listing the kinds of thing it accepts. The storyboard
-- (20260924) trashes a deleted event as type 'storyboard_event' before deleting it, which the
-- constraint refused: "new row for relation "trash" violates check constraint" (2026-10-11).
-- Nothing was lost -- the event is only deleted once its trash row exists -- but nothing could
-- be deleted either.
--
-- Recreated with every type a client writes: the PWA's three, the storyboard's event, and the
-- character web's two (written by mobile in the web's era, and presumably refused the same
-- way). NOT VALID so that existing rows are not re-checked: if anything already in the table
-- has a type outside this list, adding the constraint must not fail over it.

alter table public.trash drop constraint if exists trash_type_check;

alter table public.trash
  add constraint trash_type_check
  check (type in ('chapter', 'scene', 'document', 'storyboard_event', 'graph_node', 'graph_edge'))
  not valid;
