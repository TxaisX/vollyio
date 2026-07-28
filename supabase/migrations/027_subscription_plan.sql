-- The plan writer (docs/billing.md section 4.2).
--
-- Migration 012 revoked `plan` from the authenticated role and nothing ever
-- replaced it, so until now no code path in the product could make anyone a
-- paying customer. This adds exactly one writer, callable only by the payment
-- webhook running as service_role. The player still cannot write their own
-- plan, which is the whole point: entitlement is never player-editable
-- metadata.

alter table public.profiles
  add column if not exists plan_renews_at timestamptz,
  add column if not exists stripe_subscription_id text,
  -- When the newest billing event we have actually applied was raised at the
  -- provider. Webhook delivery is not ordered: a cancellation and a preceding
  -- update can arrive in either order, and without this a stale "still active"
  -- event lands after the cancellation and silently restores a subscription
  -- the player already ended.
  add column if not exists last_billing_event_at timestamptz;

-- Bound the column now that something writes it. An unrecognized plan would
-- silently fall through plan_monthly_allowance() to the free allowance, which
-- is safe but would hide the bug.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro'));

-- Returns true when the plan was applied, false when the event was older than
-- one already applied and only its identifiers were recorded. Both are success:
-- the caller must acknowledge a stale event rather than have it redelivered for
-- days.
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

  -- Serialize concurrent deliveries for one player, so two events racing here
  -- cannot both read the same "last applied" value and both decide they are
  -- newest.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select last_billing_event_at into v_last
  from public.profiles
  where id = p_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  v_stale := p_event_at is not null
    and v_last is not null
    and p_event_at < v_last;

  update public.profiles set
    -- A stale event does not get to move the plan, but its identifiers are
    -- still recorded. The customer id in particular is what the billing portal
    -- needs, and dropping it because the event arrived out of order would leave
    -- a paying player unable to cancel.
    plan = case when v_stale then plan else p_plan end,
    plan_renews_at = case when v_stale then plan_renews_at else p_renews_at end,
    -- Never blank an id we already hold: a subscription.updated event may not
    -- carry both, and losing the customer id would strand the player's portal.
    stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    last_billing_event_at = pg_catalog.greatest(
      v_last,
      coalesce(p_event_at, v_last)
    ),
    updated_at = now()
  where id = p_user_id;

  return not v_stale;
end;
$$;

-- Resolve a payment-provider customer back to a user, for the events that
-- carry no user id of their own (subscription.updated, subscription.deleted,
-- invoice.payment_failed). service_role only, same as the writer.
create or replace function public.user_id_for_billing_customer(p_customer_id text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from public.profiles
  where stripe_customer_id = p_customer_id
  limit 1;
$$;

-- The old five-argument shape must not linger: leaving it callable would leave a
-- version of the writer with no staleness guard reachable by the same role.
drop function if exists public.set_subscription_plan(uuid, text, timestamptz, text, text);

revoke all on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz)
  to service_role;
revoke all on function public.user_id_for_billing_customer(text)
  from public, anon, authenticated;
grant execute on function public.user_id_for_billing_customer(text)
  to service_role;

-- The customer id is written by the webhook, never by the player. It is
-- already excluded from the authenticated update grant in migration 012; this
-- comment records why that must stay true.
