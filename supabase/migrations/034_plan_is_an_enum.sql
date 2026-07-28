-- `plan` becomes a real enum so the Table Editor renders a dropdown instead of
-- a free-text box. The check constraint was already refusing bad values, but it
-- refused them AFTER the typing, with a 23514 and no hint that the answer was
-- lowercase. A type that offers the two valid values cannot be typo'd at all.
--
-- Order matters, and both of these bit during the rolled-back trial:
--   1. `private.storage_index` depends on the column, so it is dropped and
--      rebuilt around the change.
--   2. The check constraint must go BEFORE the type change, not after. ALTER
--      COLUMN TYPE revalidates existing constraints against the NEW type, and
--      `plan in ('free','pro')` becomes a `plan_tier = text` comparison with no
--      operator, so the whole statement fails.
--
-- The enum makes the constraint redundant: the same rule, enforced by the type
-- system rather than by a predicate.

drop view if exists private.storage_index cascade;
alter table public.profiles drop constraint if exists profiles_plan_check;

create type public.plan_tier as enum ('free', 'pro');

alter table public.profiles alter column plan drop default;
alter table public.profiles
  alter column plan type public.plan_tier using plan::public.plan_tier;
alter table public.profiles alter column plan set default 'free'::public.plan_tier;

-- The writer still takes text, because the webhook maps a provider string and
-- the TypeScript side has no enum to hand. Only the assignment needs the cast,
-- and the `p_plan not in ('free','pro')` guard above it still rejects anything
-- else before the cast could raise a less readable error.
create or replace function public.set_subscription_plan(
  p_user_id uuid,
  p_plan text,
  p_renews_at timestamptz,
  p_subscription_id text,
  p_customer_id text,
  p_event_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
  v_stale boolean;
begin
  if p_plan not in ('free', 'pro') then
    raise check_violation using message = 'unknown plan';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select last_billing_event_at into v_last
  from public.profiles where id = p_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  v_stale := p_event_at is not null and v_last is not null and p_event_at < v_last;

  update public.profiles set
    plan = case when v_stale then plan else p_plan::public.plan_tier end,
    plan_renews_at = case when v_stale then plan_renews_at else p_renews_at end,
    stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    last_billing_event_at = greatest(v_last, coalesce(p_event_at, v_last)),
    updated_at = now()
  where id = p_user_id;

  return not v_stale;
end;
$$;

revoke all on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz)
  to service_role;

-- Rebuilt unchanged apart from casting the column for display.
create or replace view private.storage_index as
select
  p.display_name,
  u.email,
  p.plan::text as plan,
  p.id                            as user_id,
  a.id                            as analysis_id,
  a.skill,
  a.discipline,
  a.overall_score,
  a.created_at,
  p.id::text || '/' || a.id::text as folder,
  cardinality(a.frame_paths)      as frames_declared,
  (select count(*) from storage.objects o
     where o.bucket_id = 'frames'
       and o.name like p.id::text || '/' || a.id::text || '/%') as frames_stored,
  a.clip_path,
  (select count(*) from storage.objects o
     where o.bucket_id = 'clips' and o.name = a.clip_path) as clip_stored,
  (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o
     where o.name like p.id::text || '/' || a.id::text || '/%') as bytes
from public.profiles p
join auth.users u on u.id = p.id
left join public.analyses a on a.user_id = p.id;

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

revoke all on private.storage_index from public, anon, authenticated;
revoke all on function private.find_player_storage(text) from public, anon, authenticated;
