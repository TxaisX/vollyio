-- D-049: public share links for full breakdowns.
-- An analysis is private (owner-only RLS, private buckets). Sharing one is a
-- deliberate act that mints a revocable token; anyone holding the link reads
-- a bounded projection through ONE anon surface, the SECURITY DEFINER
-- function below (same posture as delete_own_account: no service-role client
-- exists in this app). Only the token's sha256 is stored, so a table read
-- never yields a working link. The clip is shareable through a second scoped
-- policy; the frames bucket gets NO policy and the function never returns
-- frame paths, so frames are structurally unshareable.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index share_links_analysis on public.share_links (analysis_id);

alter table public.share_links enable row level security;

create policy "own share links" on public.share_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.id = analysis_id
        and analysis.user_id = (select auth.uid())
    )
  );

-- 012's default-deny leaves new tables ungranted; open exactly what the
-- owner surfaces need. No anon table grants: anonymous readers only ever go
-- through the function below.
grant select on table public.share_links to authenticated;
grant insert (analysis_id, user_id, token_hash) on table public.share_links to authenticated;
grant update (revoked_at) on table public.share_links to authenticated;

create or replace function public.analysis_by_share_token(p_token text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'skill', analysis.skill,
    'discipline', analysis.discipline,
    'overall_score', analysis.overall_score,
    'created_at', analysis.created_at,
    'result', analysis.result,
    'clip_path', analysis.clip_path
  )
  from public.share_links as link
  join public.analyses as analysis on analysis.id = link.analysis_id
  where link.token_hash = encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex')
    and link.revoked_at is null
    and link.expires_at > pg_catalog.clock_timestamp()
  limit 1;
$$;

revoke all on function public.analysis_by_share_token(text) from public;
grant execute on function public.analysis_by_share_token(text) to anon, authenticated;

-- Actively shared clips only: the join dies with the link (revoke/expiry).
drop policy if exists "shared clip objects select" on storage.objects;
create policy "shared clip objects select" on storage.objects
  for select to anon using (
    bucket_id = 'clips'
    and exists (
      select 1
      from public.share_links as link
      join public.analyses as analysis on analysis.id = link.analysis_id
      where analysis.clip_path = name
        and link.revoked_at is null
        and link.expires_at > pg_catalog.clock_timestamp()
    )
  );
