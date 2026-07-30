-- The weekly development plan, stored once per player per week (D-072).
--
-- The cost failure this table is shaped to prevent: a plan generated on page
-- view. That turns one $0.02 model call a week into one per visit, and it also
-- means the plan quietly changes under a player who is trying to follow it. So
-- the week is the primary key, and generation is a RESERVATION rather than a
-- write-when-finished: the row is claimed BEFORE the model is called, so two
-- clicks, two tabs, or a double-submitted form spend once between them.
--
-- Same shape as `reserve_analysis_entitlement`: claim, do the paid work, then
-- fill in. A row that is claimed and never filled is a failed generation, and
-- it expires rather than locking the player out of their own week.

create table if not exists public.weekly_plans (
  user_id uuid not null references auth.users on delete cascade,
  -- 'YYYY-MM-DD' of the MONDAY, in America/Los_Angeles. Same calendar-key
  -- convention as the streak in lib/progression.ts, for the same reason: a
  -- Pacific day is 23 or 25 hours long twice a year and a key carries no
  -- offset to get that wrong with.
  week_start text not null,
  -- Null while reserved, set when generation lands. The distinction is what
  -- makes a failed call retryable instead of a week with no plan in it.
  plan jsonb,
  model text,
  reserved_at timestamptz not null default now(),
  generated_at timestamptz,
  primary key (user_id, week_start),
  constraint weekly_plans_week_start_check
    check (week_start ~ '^\d{4}-\d{2}-\d{2}$'),
  -- A ready row has both or neither. Stops a half-written plan rendering as an
  -- empty week.
  constraint weekly_plans_ready_check
    check ((plan is null) = (generated_at is null))
);

alter table public.weekly_plans enable row level security;

-- Read your own. No insert, update or delete policy and no matching grant: the
-- security-definer functions below are the only writers, which is what makes
-- the one-per-week reservation actually binding rather than advisory.
drop policy if exists "own plans readable" on public.weekly_plans;
create policy "own plans readable"
  on public.weekly_plans
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.weekly_plans to authenticated;

-- Claim the week. True means the caller may spend on a generation; false means
-- someone or something already has, and the caller must read the row instead.
--
-- The 10 minute escape is the difference between a robust reservation and a
-- trap: if generation crashes, times out, or the tab is closed mid-call, the
-- claim is stale and the player would otherwise have no plan and no way to ask
-- for one until next Monday. Ten minutes is comfortably longer than the call.
create or replace function public.reserve_weekly_plan(p_week_start text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_claimed boolean := false;
begin
  if v_user is null or p_week_start !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;

  insert into public.weekly_plans (user_id, week_start)
  values (v_user, p_week_start)
  on conflict (user_id, week_start) do update
    -- Only re-claim an abandoned reservation. A row that already carries a
    -- plan never matches this, so a finished week can never be regenerated
    -- and re-billed by a stray click.
    set reserved_at = pg_catalog.now()
    where public.weekly_plans.plan is null
      and public.weekly_plans.reserved_at < pg_catalog.now() - pg_catalog.make_interval(mins => 10)
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.reserve_weekly_plan(text) from public;
grant execute on function public.reserve_weekly_plan(text) to authenticated;

-- Fill in a claimed week. Matches only the caller's own reserved row, so it
-- cannot overwrite a plan that is already there.
create or replace function public.save_weekly_plan(
  p_week_start text,
  p_plan jsonb,
  p_model text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_saved boolean := false;
begin
  if v_user is null or p_plan is null
     or pg_catalog.jsonb_typeof(p_plan) <> 'object' then
    return false;
  end if;

  update public.weekly_plans
  set plan = p_plan, model = p_model, generated_at = pg_catalog.now()
  where user_id = v_user
    and week_start = p_week_start
    and plan is null
  returning true into v_saved;

  return coalesce(v_saved, false);
end;
$$;

revoke all on function public.save_weekly_plan(text, jsonb, text) from public;
grant execute on function public.save_weekly_plan(text, jsonb, text) to authenticated;

-- Hand the week back after a failed generation, so the player can retry now
-- rather than waiting out the 10 minute expiry. Deletes only an unfilled row.
create or replace function public.release_weekly_plan(p_week_start text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_released boolean := false;
begin
  if v_user is null then
    return false;
  end if;

  delete from public.weekly_plans
  where user_id = v_user and week_start = p_week_start and plan is null
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;

revoke all on function public.release_weekly_plan(text) from public;
grant execute on function public.release_weekly_plan(text) to authenticated;
