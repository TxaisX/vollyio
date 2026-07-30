-- The injury library (D-074).
--
-- Public educational content, in a table rather than a content module, so
-- entries can be corrected or added without a deploy. `content/rehab.ts` stays
-- the authored source and `scripts/seed-rehab.mjs` reconciles it into here;
-- that keeps authoring type-checked and reviewable in git while letting a live
-- correction land immediately.
--
-- Readable by anon as well as authenticated, like /drills and /learn: this is
-- reference material, it holds nothing about any player, and content nobody can
-- find is content that does not exist.
--
-- NO tsvector column on purpose. The library is tens of entries, the page loads
-- them and filters in the browser, and a search index with no call site is the
-- dead-weight this repo has already deleted once. Add one when the row count
-- makes a full load actually cost something.

create table if not exists public.rehab_entries (
  slug text primary key,
  name text not null,
  -- What players actually call it. Load-bearing for search: nobody types
  -- "patellar tendinopathy" into a box, they type "jumper's knee".
  also_called text[] not null default '{}',
  region text not null,
  triage text not null,
  summary text not null,
  what_it_is text not null,
  how_it_happens text not null,
  signs text[] not null default '{}',
  red_flags text[] not null default '{}',
  phases jsonb not null default '[]'::jsonb,
  prevention text[] not null default '{}',
  return_markers text[] not null default '{}',
  loads text[] not null default '{}',
  updated_at timestamptz not null default now(),

  constraint rehab_entries_region_check check (
    region in ('shoulder','knee','ankle','back','hand','hip','calf','head')
  ),
  constraint rehab_entries_triage_check check (
    triage in ('self_manage','get_assessed','urgent')
  ),
  -- The safety rule, enforced by the database rather than by review. An entry
  -- that cannot name two things that mean "stop and get seen" is not finished,
  -- and this is the layer that cannot be talked out of it by a deadline.
  constraint rehab_entries_red_flags_check check (
    pg_catalog.array_length(red_flags, 1) >= 2
  ),
  constraint rehab_entries_phases_check check (
    pg_catalog.jsonb_typeof(phases) = 'array'
  )
);

create index if not exists rehab_entries_region_idx on public.rehab_entries (region);

alter table public.rehab_entries enable row level security;

-- Read-only for everyone, written only by the seed script under the service
-- role. No insert, update or delete policy and no matching grant, so a signed
-- in player cannot edit the injury library through the data API.
drop policy if exists "rehab library is public" on public.rehab_entries;
create policy "rehab library is public"
  on public.rehab_entries
  for select
  to anon, authenticated
  using (true);

grant select on table public.rehab_entries to anon, authenticated;
