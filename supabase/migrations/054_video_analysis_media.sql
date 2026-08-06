-- D-097: the analysis is read from the CLIP, so the clip has to reach the
-- server before the analysis row exists, and a scored row no longer carries
-- frames at all.
--
-- Two independent changes, in one migration because either alone breaks the
-- other. The trigger below would reject the row the new route writes, and the
-- storage policy below has no reason to exist unless that route ships.
--
-- 1. FRAME COUNT MAY BE ZERO. Migration 025 demanded 2 to 64 frames because
--    every analysis was a frame read. The video path sends no frames: the
--    provider samples the clip itself, and shipping stills alongside would be
--    paying to upload pixels no model looks at. A zero-frame row must still
--    carry media, so it must carry a clip; that is the new guard at the
--    bottom of the count check. 2 to 64 remains the rule for any row that
--    does declare frames, unchanged, so every existing row stays valid and a
--    frame read remains insertable.
--
-- 2. A PENDING CLIP PREFIX. The contract policy in 012 requires every clip
--    write to name a path an existing owned analysis already declared. That
--    ordering is correct for a frame read, where the row is written first and
--    the clip is a decoration uploaded afterwards. It is impossible for a
--    video read: the clip is the INPUT, so it must be in storage before the
--    route can score anything, and there is nothing to score yet, so there is
--    no row to declare the path.
--
--    Waiting is not available either way. The clip cannot travel in the
--    request body: the hosting platform caps a request at 4.5 MB and a ten
--    second window is about 4 MB once base64'd, before the JSON envelope.
--
--    So the write is anchored on the only thing that exists at that moment,
--    the caller's own account. `{user_id}/pending/{uuid}/clip.{ext}` is
--    matched as a whole path against the caller's verified id, so the prefix
--    is owner-scoped by the same rule the rest of the bucket is, and the only
--    thing a caller chooses is a UUID inside their own folder. It stays MIME
--    checked and it is additionally size capped, which the analysis-anchored
--    policies are not: those inherit their ceiling from a row the player could
--    not write, and this one has no row behind it.
--
--    The window is small by construction. The route copies the object to the
--    analysis path as soon as the row exists and deletes the pending one, so
--    a live pending object is a request in flight. What survives is the
--    failure case: a client that uploaded and then never posted, or a run that
--    died between the two. `scripts/purge-orphaned-media.mjs` sweeps those on
--    age, which is why that script now walks live accounts as well as dead
--    ones.

-- 1. The insert trigger. Every guard from 025 is reproduced verbatim except
-- the frame-count floor and the new "zero frames means a clip" requirement.

create or replace function private.enforce_analysis_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_index integer;
  v_expected text;
begin
  if v_user_id is null then
    return new;
  end if;
  if new.user_id <> v_user_id then
    raise insufficient_privilege using message = 'analysis owner mismatch';
  end if;

  new.created_at := v_now;

  if new.frame_count < 0
    or (new.frame_count > 0 and new.frame_count < 2)
    or new.frame_count > 64
    or cardinality(new.frame_paths) <> new.frame_count
    or cardinality(new.stored_frame_paths) > 22
  then
    raise check_violation using message = 'invalid analysis media count';
  end if;

  -- A row with no frames is a video read, and a video read without its clip is
  -- an analysis with no evidence behind it at all. Nothing in the product can
  -- render such a row and nothing could ever re-derive it.
  if new.frame_count = 0 and new.clip_path is null then
    raise check_violation using message = 'analysis has no media';
  end if;

  for v_index in 1..cardinality(new.frame_paths) loop
    v_expected := pg_catalog.format(
      '%s/%s/f%s.jpg',
      new.user_id,
      new.id,
      pg_catalog.lpad((v_index - 1)::text, 2, '0')
    );
    if new.frame_paths[v_index] <> v_expected then
      raise check_violation using message = 'invalid frame path';
    end if;
  end loop;

  for v_index in 1..cardinality(new.stored_frame_paths) loop
    v_expected := pg_catalog.format(
      '%s/%s/x%s.jpg',
      new.user_id,
      new.id,
      pg_catalog.lpad((new.frame_count + v_index - 1)::text, 2, '0')
    );
    if new.stored_frame_paths[v_index] <> v_expected then
      raise check_violation using message = 'invalid stored frame path';
    end if;
  end loop;

  -- Unchanged, and it is what makes a zero-frame row's thumbnail null:
  -- frame_paths[1] of an empty array is NULL, so `is distinct from` demands
  -- the thumbnail be NULL too.
  if new.thumb_path is distinct from new.frame_paths[1] then
    raise check_violation using message = 'invalid thumbnail path';
  end if;
  if new.keypoints_path is not null and new.keypoints_path <> pg_catalog.format(
    '%s/%s/keypoints.json', new.user_id, new.id
  ) then
    raise check_violation using message = 'invalid keypoints path';
  end if;
  if new.clip_path is not null and new.clip_path !~ (
    '^' || new.user_id::text || '/' || new.id::text || '/clip[.](webm|mp4|mov)$'
  ) then
    raise check_violation using message = 'invalid clip path';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );
  select count(*)
  into v_count
  from public.analyses
  where user_id = new.user_id
    and created_at >= v_now - interval '1 hour';

  if v_count >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'analysis rate limit exceeded';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_analysis_insert_limit()
  from public, anon, authenticated;

-- 2. The pending clip prefix.
--
-- The whole object name is matched, not just its first folder segment. That is
-- deliberate: `(storage.foldername(name))[1] = auth.uid()` proves the owner and
-- nothing else, and this is the one clip write with no analysis row behind it
-- to constrain the rest of the path. Anchoring the full string pins the
-- literal `pending` segment, a UUID-shaped directory, and the single filename,
-- so the prefix cannot become a general-purpose owner-scoped file drop.
--
-- 8 MB against the bucket's 100 MB: this ceiling exists to bound what the
-- analyze route will base64 into function memory, and it is stated here as
-- well as in the route because the storage write happens first and a policy
-- that admits what the route cannot read is a failure the player pays for in
-- upload time.

drop policy if exists "pending clip objects insert" on storage.objects;
create policy "pending clip objects insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'clips'
    and name ~ (
      '^' || (select auth.uid()::text)
        || '/pending/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        || '/clip[.](webm|mp4|mov)$'
    )
    and (
      (name ~ '[.]webm$' and metadata ->> 'mimetype' = 'video/webm')
      or (name ~ '[.]mp4$' and metadata ->> 'mimetype' = 'video/mp4')
      or (name ~ '[.]mov$' and metadata ->> 'mimetype' = 'video/quicktime')
    )
    and coalesce((metadata ->> 'size')::bigint, 0) <= 8000000
  );

drop policy if exists "pending clip objects select" on storage.objects;
create policy "pending clip objects select" on storage.objects
  for select to authenticated using (
    bucket_id = 'clips'
    and owner_id = (select auth.uid()::text)
    and name ~ (
      '^' || (select auth.uid()::text)
        || '/pending/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        || '/clip[.](webm|mp4|mov)$'
    )
  );

-- The route deletes the pending object once the analysis path holds a copy,
-- and the client deletes it when a run fails before that. Without this the
-- prefix would only ever grow, and every failed analysis would leave a clip
-- behind that the owner could read but not remove.
drop policy if exists "pending clip objects delete" on storage.objects;
create policy "pending clip objects delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'clips'
    and owner_id = (select auth.uid()::text)
    and name ~ (
      '^' || (select auth.uid()::text)
        || '/pending/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        || '/clip[.](webm|mp4|mov)$'
    )
  );
