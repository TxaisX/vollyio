-- Fix: migration 011 linked the entitlement reservation to its analysis from a
-- BEFORE INSERT trigger, pointing a foreign key at a row Postgres had not
-- written yet. The immediate (non-deferrable) check on
-- analysis_entitlement_reservations_analysis_id_fkey therefore aborted every
-- insert with SQLSTATE 23503, and every save returned "Couldn't save your
-- analysis." The link moves to an AFTER INSERT trigger, where the row exists
-- and the constraint stays strict.

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
    or new.frame_count > 12
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

create or replace function private.link_analysis_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return null;
  end if;

  update private.analysis_entitlement_reservations
  set analysis_id = new.id
  where user_id = new.user_id
    and analysis_id is null
    and reserved_at >= clock_timestamp() - interval '5 minutes';

  return null;
end;
$$;

drop trigger if exists link_analysis_reservation on public.analyses;
create trigger link_analysis_reservation
  after insert on public.analyses
  for each row execute function private.link_analysis_reservation();

revoke all on function private.enforce_analysis_insert_limit()
  from public, anon, authenticated;
revoke all on function private.link_analysis_reservation()
  from public, anon, authenticated;
