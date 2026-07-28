-- Change a player's plan by hand.
--
-- There is no admin UI for this and there should not be. `set_subscription_plan`
-- is granted to `service_role` alone (migration 027), which is what stops a
-- player writing their own plan, and the Supabase SQL editor runs with the
-- privilege to call it. That is the whole admin surface.
--
-- Use it to comp an account, to fix a webhook that never arrived, or to undo a
-- mistake. Do NOT use it as a substitute for checkout: a plan set here has no
-- subscription behind it, so nothing bills, nothing renews, and nothing will
-- ever cancel it.
--
-- Edit the two values in the first CTE, run the whole file, and read the two
-- result sets: the first is who you are about to change, the second is what
-- they look like afterwards.

-- ---------------------------------------------------------------------------
-- 1. WHO, and WHAT TO
-- ---------------------------------------------------------------------------
with target as (
  select
    'someone@example.com'::text as email,   -- <== the player
    'pro'::text                 as new_plan  -- <== 'pro' or 'free'
)
select
  'BEFORE' as stage,
  u.email,
  p.plan as current_plan,
  t.new_plan as will_become,
  p.plan_renews_at,
  p.stripe_subscription_id is not null as has_real_subscription,
  public.plan_monthly_allowance(p.plan::text) as allowance_now,
  public.plan_monthly_allowance(t.new_plan) as allowance_after,
  (select count(*) from public.analyses a
     where a.user_id = p.id
       and a.created_at >= (date_trunc('month', now() at time zone 'utc')) at time zone 'utc'
  ) as used_this_month
from target t
join auth.users u on u.email = t.email
join public.profiles p on p.id = u.id;

-- If BEFORE returned no rows, the email is wrong. Stop; the next statement
-- would silently do nothing.
--
-- If `has_real_subscription` is true and you are setting 'free', cancel in the
-- payment dashboard as well, or they keep being charged for a plan the app no
-- longer gives them.

-- ---------------------------------------------------------------------------
-- 2. APPLY
-- ---------------------------------------------------------------------------
-- `p_event_at => null` is deliberate. It leaves `last_billing_event_at` alone,
-- so a manual change never sets a watermark that would make a later real
-- webhook look stale and get refused. Passing now() here is how you would
-- accidentally block the player's own future upgrade.
with target as (
  select
    'someone@example.com'::text as email,   -- <== same two values
    'pro'::text                 as new_plan
)
select public.set_subscription_plan(
  u.id,
  t.new_plan,
  case when t.new_plan = 'pro'
       then (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc'
       else null
  end,
  null,   -- no subscription id: this is not a real subscription
  null,   -- no customer id either
  null    -- no event watermark, see above
) as applied
from target t
join auth.users u on u.email = t.email;

-- ---------------------------------------------------------------------------
-- 3. CONFIRM
-- ---------------------------------------------------------------------------
with target as (
  select 'someone@example.com'::text as email   -- <== same email
)
select
  'AFTER' as stage,
  u.email,
  p.plan,
  p.plan_renews_at,
  public.plan_monthly_allowance(p.plan::text) as allowance,
  (select count(*) from public.analyses a
     where a.user_id = p.id
       and a.created_at >= (date_trunc('month', now() at time zone 'utc')) at time zone 'utc'
  ) as used_this_month,
  greatest(0, public.plan_monthly_allowance(p.plan::text) - (
    select count(*) from public.analyses a
     where a.user_id = p.id
       and a.created_at >= (date_trunc('month', now() at time zone 'utc')) at time zone 'utc'
  )) as remaining
from target t
join auth.users u on u.email = t.email
join public.profiles p on p.id = u.id;

-- A note on `remaining`. The month's usage does NOT reset when the plan
-- changes, because the allowance is a ceiling on completed analyses in the
-- calendar month and the count is the same count either way. Someone already
-- past the larger allowance stays at zero remaining until the 1st, comped or
-- not. If you need to actually unblock them today, the lever is
-- ENFORCE_FREE_CAP in Vercel, which reopens the product for everyone.
