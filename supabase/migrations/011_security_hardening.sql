-- Security hardening: atomic paid-endpoint quotas, least-privilege grants,
-- and bounded private media uploads.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.api_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('analyze', 'coach', 'account_delete')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, scope)
);
revoke all on table private.api_rate_limits from public, anon, authenticated;

create table private.analysis_entitlement_reservations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reservation_id uuid not null unique,
  analysis_id uuid unique references public.analyses (id) on delete cascade,
  reserved_at timestamptz not null
);
revoke all on table private.analysis_entitlement_reservations
  from public, anon, authenticated;

create or replace function public.consume_api_quota(p_scope text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer;
  v_window interval;
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  case p_scope
    when 'analyze' then
      v_limit := 20;
      v_window := interval '1 hour';
    when 'coach' then
      v_limit := 60;
      v_window := interval '1 hour';
    when 'account_delete' then
      v_limit := 3;
      v_window := interval '1 hour';
    else
      raise invalid_parameter_value using message = 'unknown quota scope';
  end case;

  insert into private.api_rate_limits as limits (
    user_id,
    scope,
    window_started_at,
    request_count
  )
  values (v_user_id, p_scope, v_now, 1)
  on conflict (user_id, scope) do update
  set
    window_started_at = case
      when limits.window_started_at + v_window <= v_now then v_now
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at + v_window <= v_now then 1
      else limits.request_count + 1
    end
  returning request_count <= v_limit into v_allowed;

  return v_allowed;
end;
$$;

revoke all on function public.consume_api_quota(text) from public;
revoke all on function public.consume_api_quota(text) from anon;
grant execute on function public.consume_api_quota(text) to authenticated;

create or replace function public.reserve_analysis_entitlement(
  p_enforce_free boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan text;
  v_now timestamptz := clock_timestamp();
  v_reservation_id uuid := gen_random_uuid();
  v_reserved_at timestamptz;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if p_enforce_free then
    select plan into v_plan
    from public.profiles
    where id = v_user_id;
    if not found then
      raise no_data_found using message = 'profile unavailable';
    end if;

    if v_plan = 'free' and exists (
      select 1 from public.analyses where user_id = v_user_id
    ) then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'used',
        'reservation_id', null
      );
    end if;
  end if;

  select reserved_at into v_reserved_at
  from private.analysis_entitlement_reservations
  where user_id = v_user_id;
  if v_reserved_at >= v_now - interval '5 minutes' then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'in_progress',
      'reservation_id', null
    );
  end if;

  insert into private.analysis_entitlement_reservations (
    user_id,
    reservation_id,
    analysis_id,
    reserved_at
  ) values (
    v_user_id,
    v_reservation_id,
    null,
    v_now
  )
  on conflict (user_id) do update set
    reservation_id = excluded.reservation_id,
    analysis_id = null,
    reserved_at = excluded.reserved_at;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'reservation_id', v_reservation_id
  );
end;
$$;

create or replace function public.release_analysis_entitlement(
  p_reservation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  delete from private.analysis_entitlement_reservations
  where user_id = v_user_id
    and reservation_id = p_reservation_id;
end;
$$;

revoke all on function public.reserve_analysis_entitlement(boolean)
  from public, anon;
grant execute on function public.reserve_analysis_entitlement(boolean)
  to authenticated;
revoke all on function public.release_analysis_entitlement(uuid)
  from public, anon;
grant execute on function public.release_analysis_entitlement(uuid)
  to authenticated;

create or replace function public.discard_new_analysis(
  p_analysis_id uuid,
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_deleted boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  delete from public.analyses
  where id = p_analysis_id
    and user_id = v_user_id
    and created_at >= clock_timestamp() - interval '5 minutes'
    and exists (
      select 1
      from private.analysis_entitlement_reservations as reservation
      where reservation.user_id = v_user_id
        and reservation.reservation_id = p_reservation_id
        and reservation.analysis_id = p_analysis_id
    )
  returning true into v_deleted;

  return coalesce(v_deleted, false);
end;
$$;

revoke all on function public.discard_new_analysis(uuid, uuid) from public, anon;
grant execute on function public.discard_new_analysis(uuid, uuid) to authenticated;

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

  update private.analysis_entitlement_reservations
  set analysis_id = new.id
  where user_id = new.user_id
    and analysis_id is null
    and reserved_at >= v_now - interval '5 minutes';

  return new;
end;
$$;

drop trigger if exists enforce_analysis_insert_limit on public.analyses;
create trigger enforce_analysis_insert_limit
  before insert on public.analyses
  for each row execute function private.enforce_analysis_insert_limit();
revoke all on function private.enforce_analysis_insert_limit() from public, anon, authenticated;
