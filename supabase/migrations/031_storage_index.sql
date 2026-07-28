-- An operator lookup from a person to their stored film.
--
-- The ask was to name the storage folders after the player so they are easy to
-- find. That cannot be done, and the reason is worth writing down so nobody
-- tries it again:
--
--   1. The folder name IS the authorization. Migration 012's storage policies
--      read `(storage.foldername(name))[1] = auth.uid()::text` for ownership and
--      `(storage.foldername(name))[2] = analysis.id` to tie an object to its
--      row. Renaming either segment does not rename a label, it removes the
--      check.
--   2. `profiles.display_name` is player-editable (012 grants UPDATE on it to
--      `authenticated`). Keying folders on it would let a player rename
--      themselves into another player's folder. AGENTS.md: player-editable
--      metadata never decides authorization.
--   3. Display names are not unique and are not real names. The product asks
--      for "what your team calls you" and never collects a surname, so there is
--      no first-and-last name in the system to use.
--
-- The actual need behind the ask is "I am looking at storage and I cannot tell
-- whose these are". That needs a lookup, not a rename. The folders are already
-- per player; they are just named with the one identifier that is unique,
-- stable, and not writable by the person it identifies.
--
-- This view lives in `private`, which no client role can reach, so it is
-- readable from the SQL editor and from nothing else. It deliberately joins
-- auth.users, so it must never be exposed through the data API.

create or replace view private.storage_index as
select
  p.display_name,
  u.email,
  p.plan,
  p.id                                    as user_id,
  a.id                                    as analysis_id,
  a.skill,
  a.discipline,
  a.overall_score,
  a.created_at,
  p.id::text || '/' || a.id::text         as folder,
  cardinality(a.frame_paths)              as frames_declared,
  (select count(*) from storage.objects o
     where o.bucket_id = 'frames'
       and o.name like p.id::text || '/' || a.id::text || '/%') as frames_stored,
  a.clip_path,
  (select count(*) from storage.objects o
     where o.bucket_id = 'clips'
       and o.name = a.clip_path) as clip_stored,
  (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o
     where o.name like p.id::text || '/' || a.id::text || '/%') as bytes
from public.profiles p
join auth.users u on u.id = p.id
left join public.analyses a on a.user_id = p.id;

-- Search by whatever the operator actually remembers: part of a name, part of
-- an email, or an id pasted from a support message.
create or replace function private.find_player_storage(p_search text)
returns setof private.storage_index
language sql
stable
set search_path = ''
as $$
  select * from private.storage_index
  where p_search is null
     or display_name ilike '%' || p_search || '%'
     or email ilike '%' || p_search || '%'
     or user_id::text = p_search
     or analysis_id::text = p_search
  order by created_at desc nulls last;
$$;

-- `private` has no grants to any client role and this must stay that way: the
-- view joins auth.users, so a grant here would publish every player's email
-- through the data API.
revoke all on private.storage_index from public, anon, authenticated;
revoke all on function private.find_player_storage(text) from public, anon, authenticated;
