-- Does every security-definer function actually RUN?
--
-- This exists because three of them did not, and every gate stayed green.
-- `lib/plans.test.ts` and `lib/security-contract.test.ts` assert that the
-- migration TEXT contains the right patterns. Text pins catch drift; they
-- cannot catch a function that parses at creation and raises at execution.
-- `pg_catalog.greatest(...)` did exactly that: `create function` succeeded, and
-- then `set_subscription_plan` threw 42883 on every payment, the funnel counter
-- threw on every page load, and every capacity refund silently failed.
--
-- Paste the whole file into the Supabase SQL editor. It runs inside a
-- transaction that is ROLLED BACK, so the throwaway account and every write it
-- makes disappear. Every row must read OK.
--
-- WHY EACH CHECK IS ITS OWN STATEMENT: a single statement uses a single
-- snapshot, so a `select` sitting beside a mutating call in the same UNION
-- cannot see that call's write. The first version of this file was written that
-- way and reported four false failures. Accumulating into a temp table one
-- statement at a time is what makes the reads see the writes.
--
-- Run after any migration that creates or replaces a function.

begin;

create temp table smoke(
  n int generated always as identity,
  check_name text,
  status text
) on commit drop;

-- A throwaway account to exercise the writers against. The rollback removes it,
-- and the id is fixed and obviously fake so a stray row is recognisable.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000dead'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', 'smoke-test@invalid.test', '',
        now(), now(), now());

insert into smoke(check_name, status) select 'upgrade returns applied',
  case when public.set_subscription_plan(
    '00000000-0000-4000-8000-00000000dead'::uuid, 'pro',
    now() + interval '30 days', 'sub_smoke', 'cus_smoke', now())
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'the plan actually moved to pro',
  case when (select plan::text from public.profiles
             where id = '00000000-0000-4000-8000-00000000dead'::uuid) = 'pro'
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'pro resolves to the larger allowance',
  case when public.plan_monthly_allowance(
    (select plan::text from public.profiles
     where id = '00000000-0000-4000-8000-00000000dead'::uuid)) = 18
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'the customer id was recorded',
  case when public.user_id_for_billing_customer('cus_smoke')
       = '00000000-0000-4000-8000-00000000dead'::uuid
  then 'OK' else 'FAIL' end;

-- Webhook delivery is not ordered. A cancellation raised before the upgrade
-- must not take Pro away.
insert into smoke(check_name, status) select 'a stale event is refused',
  case when public.set_subscription_plan(
    '00000000-0000-4000-8000-00000000dead'::uuid, 'free', null, null, null,
    now() - interval '1 hour') = false
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'and the stale event left pro intact',
  case when (select plan::text from public.profiles
             where id = '00000000-0000-4000-8000-00000000dead'::uuid) = 'pro'
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'a current cancellation applies',
  case when public.set_subscription_plan(
    '00000000-0000-4000-8000-00000000dead'::uuid, 'free', null, null, null, now()) = true
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'and the plan is back to free',
  case when (select plan::text from public.profiles
             where id = '00000000-0000-4000-8000-00000000dead'::uuid) = 'free'
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'unknown customer resolves to nobody',
  case when public.user_id_for_billing_customer('cus_nobody_at_all') is null
  then 'OK' else 'FAIL' end;

insert into smoke(check_name, status) select 'allowance window is one UTC month',
  case when (select resets_at - starts_at from private.allowance_window(now()))
            between interval '28 days' and interval '31 days'
  then 'OK' else 'FAIL' end;

-- Returns false rather than raising when no row matches, which is what keeps a
-- missed measurement from failing a player's analysis.
insert into smoke(check_name, status) select 'telemetry writer runs, refuses a missing row',
  case when public.record_analysis_telemetry(
    '00000000-0000-4000-8000-0000000000aa'::uuid,
    '{"input_tokens":1000,"output_tokens":100,"duration_ms":5000}'::jsonb) = false
  then 'OK' else 'FAIL' end;

select check_name, status from smoke order by n;

rollback;
