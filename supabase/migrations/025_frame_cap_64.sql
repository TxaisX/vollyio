-- D-061: raise the DB media-count ceiling with the app send budget, 40 -> 64.
--
-- Same failure this guards as D-046/017: the route writes frame_count =
-- frames.length unclamped, so if the app budget rises above the trigger's
-- ceiling every dense clip is read, BILLED, and only then rejected at the
-- insert with 'invalid analysis media count'. The app constant and this number
-- move together or not at all, and lib/security-contract.test.ts ties them.
--
-- Why 64 costs no more request budget: D-061 renders context frames at 640
-- and only the contact core at 1024, so 24 core plus 40 context is 41.6M
-- pixels against the 41.9M that 40 frames at 1024 already spent.
--
-- Only the ceiling moves. Every other guard in 017 is reproduced verbatim: the
-- owner check, the contiguous per-index frame-path format, the stored-extras
-- cap of 22, the thumbnail and clip path shapes, and the hourly rate limit.

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

  if new.frame_count < 2
    or new.frame_count > 64
    or cardinality(new.frame_paths) <> new.frame_count
    or cardinality(new.stored_frame_paths) > 22
  then
    raise check_violation using message = 'invalid analysis media count';
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
