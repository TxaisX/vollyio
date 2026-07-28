-- The client boundary, as a query you can re-run instead of a claim you have to
-- trust. Paste the whole file into the Supabase SQL editor. Every row must read
-- PASS. A FAIL is a client role that can reach something it must not.
--
-- Run this after ANY migration that touches a grant, a policy, or a function,
-- and before any launch. It reads the live database, not the migration files,
-- because what shipped and what was written are two different questions.
--
-- The rule being enforced, in one sentence: a signed-in player may read and
-- write their OWN rows and nothing else, may never touch anything that decides
-- money or identity, and `anon` may do nothing at all.

with checks as (

  -- Anonymous callers get no table access whatsoever. Public pages are static,
  -- and a share link is served through a security-definer function, not a grant.
  select 'anon has zero table privileges' as check_name,
         count(*) as offenders,
         coalesce(string_agg(distinct table_name, ', '), '') as detail
  from information_schema.table_privileges
  where table_schema = 'public' and grantee = 'anon'

  union all
  -- Analyses are insert-only by design. A DELETE grant would also hand players
  -- a way to reset their monthly allowance by deleting the rows it counts.
  select 'players cannot delete analyses',
         count(*),
         coalesce(string_agg(privilege_type, ', '), '')
  from information_schema.table_privileges
  where table_schema = 'public' and table_name = 'analyses'
    and grantee = 'authenticated' and privilege_type in ('DELETE', 'TRUNCATE')

  union all
  -- Entitlement and identity are never player-editable. This is the single most
  -- important row in the file: a player who can write `plan` is a player who
  -- can grant themselves Pro.
  select 'players cannot write plan, billing ids, or xp',
         count(*),
         coalesce(string_agg(column_name || ' (' || privilege_type || ')', ', '), '')
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'profiles'
    and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
    and column_name in ('plan', 'plan_renews_at', 'stripe_customer_id',
                        'stripe_subscription_id', 'last_billing_event_at', 'xp')

  union all
  -- Telemetry feeds the platform spend guard, which 503s everyone when it
  -- trips, so a player writing it can take the product down. created_at is what
  -- the monthly window counts against.
  select 'players cannot write analysis telemetry or created_at',
         count(*),
         coalesce(string_agg(column_name || ' (' || privilege_type || ')', ', '), '')
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'analyses'
    and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
    and column_name in ('telemetry', 'created_at')

  union all
  -- RLS off on an exposed table means the column grants above are the ONLY
  -- thing between one player and every other player's rows.
  select 'every public table has row level security on',
         count(*),
         coalesce(string_agg(t.tablename, ', '), '')
  from pg_tables t
  join pg_class c on c.relname = t.tablename
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where t.schemaname = 'public' and not c.relrowsecurity

  union all
  -- A write policy with no WITH CHECK constrains which rows you may see, not
  -- which rows you may create. That is how a player writes a row that belongs
  -- to somebody else.
  select 'every write policy pins the row to the caller',
         count(*),
         coalesce(string_agg(tablename || '.' || policyname, ', '), '')
  from pg_policies
  where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'ALL')
    and (with_check is null or with_check not like '%auth.uid()%')

  union all
  -- `private` holds the quota counters, the entitlement reservations, and the
  -- operator storage index, which joins auth.users and therefore every email.
  select 'client roles cannot reach the private schema',
         (has_schema_privilege('authenticated', 'private', 'usage')::int
          + has_schema_privilege('anon', 'private', 'usage')::int),
         'authenticated=' || has_schema_privilege('authenticated', 'private', 'usage')::text
         || ' anon=' || has_schema_privilege('anon', 'private', 'usage')::text

  union all
  -- The functions that write money and identity. Reachable by a client role
  -- means reachable through the data API, which means reachable by anyone with
  -- a session and a fetch call.
  select 'money and identity functions are service_role only',
         count(*),
         coalesce(string_agg(p.proname || ' -> ' || r.rolname, ', '), '')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  cross join (select unnest(array['anon', 'authenticated']) as rolname) r
  where p.proname in ('set_subscription_plan', 'user_id_for_billing_customer',
                      'record_analysis_telemetry')
    and has_function_privilege(r.rolname, p.oid, 'execute')

  union all
  -- The one-argument refund let a player delete their own rate-limit row and
  -- walk through the hourly cap, paying for a coaching call on every extra
  -- request. The surviving shape requires a reservation id only the server holds.
  select 'the quota refund cannot be driven by a player',
         count(*),
         coalesce(string_agg(pg_get_function_identity_arguments(p.oid), ' | '), '')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.proname = 'refund_api_quota'
    and pg_get_function_identity_arguments(p.oid) not like '%uuid%'
)
select
  check_name,
  case when offenders = 0 then 'PASS' else 'FAIL' end as status,
  offenders,
  detail
from checks
order by status desc, check_name;
