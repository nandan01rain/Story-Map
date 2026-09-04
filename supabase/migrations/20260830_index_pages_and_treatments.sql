-- Stage One: let pages and treatments be indexed at all. NOT APPLIED -- written for review.
--
-- This is one constraint and it is the highest-value line in the current build. Everything
-- downstream -- recall, contradiction checking, both assistants -- reads from
-- content_chunks, and content_chunks has refused to hold a page since the day it was
-- written:
--
--   source_type text not null check (source_type in ('chapter', 'document'))
--
-- Pages have existed since 20260826_pages.sql and cannot be retrieved by anything. Stage two
-- of the capture pipeline IS Daedalus reading a month of pages, so that stage has been
-- blocked on this one predicate.
--
-- WHAT DOES NOT NEED CHANGING, verified rather than assumed:
--
--   * match_content_chunks() -- the function is named match_content_chunks, not match_chunks.
--     Its filter is `p_source_type text default null` compared with `=`, so a new value needs
--     no signature change, and its only caller (supabase/functions/assistant/index.ts) does
--     not pass the parameter at all. Widening the constraint is sufficient on its own.
--
--     One limitation worth recording rather than fixing blind: because the parameter is a
--     single text value, the function cannot express "pages and treatments but not chapters".
--     That needs an array parameter, and nothing wants it yet.
--
--   * The unique constraint and both source indexes are keyed on source_type generically and
--     take new values without alteration.
--
-- The constraint is dropped by discovered name rather than by a guessed one: it was written
-- inline, so PostgreSQL named it, and hard-coding content_chunks_source_type_check would be a
-- guess that fails silently on a database where it is called something else.

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'content_chunks'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%source_type%';

  if constraint_name is not null then
    execute format('alter table public.content_chunks drop constraint %I', constraint_name);
    raise notice 'dropped the old source_type check (%)', constraint_name;
  else
    raise notice 'no source_type check found -- nothing to drop';
  end if;
end $$;

alter table public.content_chunks
  add constraint content_chunks_source_type_check
  check (source_type in ('chapter', 'document', 'page', 'treatment'));

comment on column public.content_chunks.source_type is
  'chapter | document | page | treatment. Deliberately a check rather than a foreign key: a '
  'chunk points back at whichever kind of row it came from, and those live in different '
  'tables. Widening this list is what makes a new kind of writing retrievable at all, so '
  'anything that adds one has to come here too.';
