-- 041: rls_auto_enable is an event trigger, not an API.
--
-- The function was created directly against the live database (outside this
-- migration history) as a safety net: an event trigger that turns row level
-- security on for every table created in `public`, so a future migration
-- cannot ship an unprotected table by forgetting the `enable row level
-- security` line. This file adopts it into the repo so the migration history
-- is once again the whole schema.
--
-- It was created with default function privileges, which hand EXECUTE to
-- `public` — so the security linter flags it as an anon-callable SECURITY
-- DEFINER function. Calling it via RPC cannot actually do anything (Postgres
-- refuses to invoke a function returning `event_trigger` outside trigger
-- context), but the grant is pure surface with no use, and event triggers
-- fire as the owner regardless of EXECUTE privilege, so revoking costs
-- nothing. Same posture as every other definer function here: callable by
-- exactly the roles that need it, which in this case is none.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
      and cmd.schema_name in ('public')
      and cmd.schema_name not in ('pg_catalog', 'information_schema')
      and cmd.schema_name not like 'pg_toast%'
      and cmd.schema_name not like 'pg_temp%'
    then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- The event trigger itself already exists on the live database as
-- `ensure_rls`; create it only if a fresh environment is being built from
-- migrations alone.
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$$;
