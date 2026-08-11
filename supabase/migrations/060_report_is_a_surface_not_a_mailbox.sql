-- In-app reporting of objectionable content, because two Play policies require
-- it and neither is satisfied by the feedback control that already exists.
--
-- The AI-Generated Content policy requires apps whose central feature is
-- generative AI to carry an in-app way for a user to report offensive output
-- WITHOUT leaving the app, and requires the developer to use those reports to
-- inform moderation. The User-Generated Content policy separately requires an
-- in-app reporting system for any PUBLICLY ACCESSIBLE user content. Vollyio is
-- both: the coach is text-to-text chat, every breakdown is model prose, and
-- `/share/<token>` publishes a stranger-readable page carrying someone's film.
--
-- `analysis_feedback` (022) does NOT close this. It asks "was this helpful" and
-- its three reasons are wrong_player / off_read / not_helpful, which grade the
-- COACHING. None of them can carry "this output is sexual", "this clip shows a
-- child who did not agree to be filmed", or "this is harassment". Quality
-- feedback and a safety report are different instruments and collapsing them
-- would lose the only one a policy asks for.
--
-- THE ANONYMOUS PATH IS THE POINT, not an extra. The person best placed to
-- report a share page is the stranger who opened the link, and they have no
-- account. So this follows D-049's posture exactly: no anon table grants, one
-- SECURITY DEFINER function as the entire anonymous surface, and the raw share
-- token is resolved to a link id inside it so a caller never names a row.

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  -- Which surface the report was raised from. Decides which target column is
  -- required below and whether the reporter may be anonymous.
  surface text not null check (surface in ('analysis', 'coach', 'shared_analysis')),
  -- Null for an anonymous share-page reporter. `on delete set null` on purpose:
  -- a reporter deleting their account must not erase a safety report about
  -- someone else's content.
  reporter_id uuid references public.profiles (id) on delete set null,
  analysis_id uuid references public.analyses (id) on delete set null,
  coach_session_id uuid references public.coach_sessions (id) on delete set null,
  share_link_id uuid references public.share_links (id) on delete set null,
  -- The categories are the ones Play's Inappropriate Content policy names, in
  -- the words a player would use. `private_person` exists because the most
  -- likely real report on this product is a bystander who never agreed to be
  -- filmed, not a model that turned obscene.
  reason text not null check (
    reason in (
      'sexual_content',
      'hate_or_harassment',
      'violence_or_danger',
      'child_endangerment',
      'private_person',
      'deceptive',
      'other'
    )
  ),
  note text check (note is null or char_length(note) <= 1000),
  -- A copy of the reported text, taken at report time. The reported message may
  -- be edited or deleted before anyone reviews it, and a report that cannot say
  -- WHAT was objectionable cannot inform moderation, which is the half of the
  -- policy that is about acting rather than collecting.
  excerpt text check (excerpt is null or char_length(excerpt) <= 2000),
  created_at timestamptz not null default now(),
  -- The moderation record. Written by the owner out of band; the app never
  -- reads these back to a reporter.
  reviewed_at timestamptz,
  action_taken text check (action_taken is null or char_length(action_taken) <= 2000)
);

-- The two reads moderation actually makes: the unreviewed queue, and everything
-- ever raised against one analysis.
create index content_reports_open
  on public.content_reports (created_at desc)
  where reviewed_at is null;
create index content_reports_analysis
  on public.content_reports (analysis_id, created_at desc);

alter table public.content_reports enable row level security;

-- A reporter may read back only their OWN reports. No insert policy and no
-- insert grant exists for anyone: every write goes through the function below,
-- which is what lets an anonymous caller file one without an anon table grant,
-- and what stops an authenticated caller from forging `reporter_id` or writing
-- `reviewed_at` on their own row.
create policy "own content reports" on public.content_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

-- 012's default-deny leaves new tables ungranted. Open exactly the select above
-- and nothing else. Moderation reads with the service role.
grant select on table public.content_reports to authenticated;

-- How many reports one origin may file in an hour. Generous for a person who
-- found something genuinely wrong on several breakdowns, small enough that the
-- anonymous surface is not a free write endpoint. Anonymous reports are counted
-- per share link, which is the only stable identifier that path has.
create or replace function public.content_report_hourly_cap()
returns integer
language sql
immutable
as $$ select 10 $$;

-- The whole write surface. Returns a status string rather than raising, because
-- every caller is a person who just tried to report something offensive and the
-- one outcome that must never happen is an error page that loses the report.
--
-- SECURITY DEFINER with `search_path = ''`, same as analysis_by_share_token.
create or replace function public.submit_content_report(
  p_surface text,
  p_reason text,
  p_note text default null,
  p_excerpt text default null,
  p_analysis_id uuid default null,
  p_coach_session_id uuid default null,
  p_share_token text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_share_link_id uuid;
  v_analysis_id uuid;
  v_recent integer;
begin
  if p_surface is null or p_surface not in ('analysis', 'coach', 'shared_analysis') then
    return 'invalid';
  end if;

  if p_reason is null or p_reason not in (
    'sexual_content', 'hate_or_harassment', 'violence_or_danger',
    'child_endangerment', 'private_person', 'deceptive', 'other'
  ) then
    return 'invalid';
  end if;

  -- Length is enforced here as well as by the column check so an over-long note
  -- is a clean 'invalid' the caller can show, not a constraint violation that
  -- reaches the user as a 500.
  if char_length(coalesce(p_note, '')) > 1000
     or char_length(coalesce(p_excerpt, '')) > 2000 then
    return 'invalid';
  end if;

  if p_surface = 'shared_analysis' then
    -- The anonymous path. Resolve the RAW token exactly the way the read
    -- function does, and only while the link is actually live: a revoked or
    -- expired link is already gone from the web, so a report against it has
    -- nothing to moderate.
    if p_share_token is null
       or char_length(p_share_token) < 20
       or char_length(p_share_token) > 128 then
      return 'not_found';
    end if;

    select link.id, link.analysis_id
      into v_share_link_id, v_analysis_id
    from public.share_links as link
    where link.token_hash = encode(
            pg_catalog.sha256(pg_catalog.convert_to(p_share_token, 'UTF8')), 'hex')
      and link.revoked_at is null
      and link.expires_at > pg_catalog.clock_timestamp()
    limit 1;

    if v_share_link_id is null then
      return 'not_found';
    end if;

    select count(*) into v_recent
    from public.content_reports as r
    where r.share_link_id = v_share_link_id
      and r.created_at > pg_catalog.now() - interval '1 hour';
  else
    -- Every other surface is the signed-in player reporting output on their own
    -- account. Ownership is checked here rather than trusted, because this
    -- function runs as definer and RLS is not doing it for us.
    if v_uid is null then
      return 'unauthenticated';
    end if;

    if p_surface = 'analysis' then
      select a.id into v_analysis_id
      from public.analyses as a
      where a.id = p_analysis_id and a.user_id = v_uid;
      if v_analysis_id is null then
        return 'not_found';
      end if;
    else
      -- A coach report may name no session: the very first answer in a fresh
      -- chat is on screen before its thread has been read back. The excerpt is
      -- what carries the report in that case, so the row is still worth having.
      if p_coach_session_id is not null and not exists (
        select 1 from public.coach_sessions as s
        where s.id = p_coach_session_id and s.user_id = v_uid
      ) then
        return 'not_found';
      end if;
    end if;

    select count(*) into v_recent
    from public.content_reports as r
    where r.reporter_id = v_uid
      and r.created_at > pg_catalog.now() - interval '1 hour';
  end if;

  if v_recent >= public.content_report_hourly_cap() then
    return 'rate_limited';
  end if;

  insert into public.content_reports (
    surface, reporter_id, analysis_id, coach_session_id, share_link_id,
    reason, note, excerpt
  ) values (
    p_surface,
    v_uid,
    v_analysis_id,
    case when p_surface = 'coach' then p_coach_session_id else null end,
    v_share_link_id,
    p_reason,
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_excerpt, '')), '')
  );

  return 'ok';
end;
$$;

revoke all on function public.submit_content_report(
  text, text, text, text, uuid, uuid, text) from public;
grant execute on function public.submit_content_report(
  text, text, text, text, uuid, uuid, text) to anon, authenticated;
