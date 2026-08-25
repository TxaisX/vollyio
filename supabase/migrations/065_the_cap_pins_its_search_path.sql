-- `content_report_hourly_cap()` gets the `search_path = ''` every other function
-- in this schema already carries.
--
-- Flagged by the platform's own security linter as a role-mutable search_path.
-- The practical risk here is nil: the body is `select 10` and resolves no table,
-- no operator and no other function, so there is nothing for a hostile
-- search_path to redirect. It is also SECURITY INVOKER, so it holds no
-- privilege to escalate in the first place.
--
-- It is pinned anyway, for two reasons. The convention in this schema is that
-- every function states its search_path (migration 060 says so in the comment
-- directly above this one's sibling, and then does not do it here), and a
-- standing WARN in the advisor list is how a real one gets lost. A linter with
-- a known-noisy row is a linter nobody reads.

create or replace function public.content_report_hourly_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;
