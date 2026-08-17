-- D-121: the first breakdown is walled behind signup, and a share link is the
-- one artifact that would carry the walled content past the wall. /share/[token]
-- renders the FULL breakdown to anyone holding the link, so an anonymous
-- session that could mint one would be a stranger publishing to themselves the
-- page the app just refused them. The app hides the share control from an
-- anonymous session, but the control is not the boundary; this policy is,
-- because an anonymous user satisfies `authenticated` and holds the insert
-- grant like any other owner, and the data API takes requests the UI never
-- renders a button for.
--
-- Reads and revokes stay open: an anonymous session cannot have a link it was
-- never able to create, so narrowing only the write closes the gap without
-- inventing a second policy for rows that cannot exist. The claim is read the
-- same way migration 061 reads it, and defaults the same direction: an absent
-- claim is a real account, because this wall is a conversion device and the
-- cost of over-blocking is a paying player who cannot share their rep.
drop policy "own share links" on public.share_links;

create policy "own share links" on public.share_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and coalesce(
      ((select auth.jwt()) ->> 'is_anonymous')::boolean,
      false
    ) = false
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.id = analysis_id
        and analysis.user_id = (select auth.uid())
    )
  );
