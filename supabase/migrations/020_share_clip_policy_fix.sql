-- D-049 follow-up: anonymous clip streaming never worked. The 019 storage
-- policy joined share_links/analyses directly, but RLS policy subqueries run
-- with the caller's privileges, and anon has no grants (012 default-deny) and
-- no policies on either table, so the join failed for every anonymous viewer
-- and shared clips 404'd. Route the check through a SECURITY DEFINER
-- predicate instead (the escape hatch PostgreSQL documents for exactly this),
-- keeping zero anon table grants. Also cover authenticated viewers: a
-- logged-in player opening someone else's share link hits the same policy and
-- was equally locked out (owners streamed through their own-objects policy,
-- which masked this in owner-side testing).

create or replace function public.clip_is_shared(p_name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.share_links as link
    join public.analyses as analysis on analysis.id = link.analysis_id
    where analysis.clip_path = p_name
      and link.revoked_at is null
      and link.expires_at > pg_catalog.clock_timestamp()
  );
$$;

revoke all on function public.clip_is_shared(text) from public;
grant execute on function public.clip_is_shared(text) to anon, authenticated;

drop policy if exists "shared clip objects select" on storage.objects;
create policy "shared clip objects select" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'clips'
    and public.clip_is_shared(name)
  );
