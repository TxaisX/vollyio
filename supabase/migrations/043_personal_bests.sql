-- 043: personal bests, read straight from the rows that earned them (D-079).
--
-- The dashboard now shows "best N" beside each rolling rating. The best is
-- MAX(overall_score) over the caller's own analyses, per skill and
-- discipline: derived on read, never stored, so it cannot drift from the
-- reps it summarizes and there is no second write path to keep honest.
--
-- SECURITY INVOKER on purpose, unlike most functions here: it reads only
-- `analyses`, the caller already holds select on their own rows, and RLS is
-- exactly the scoping wanted. No definer privilege is needed, so none is
-- taken, and the linter gains nothing new to flag.

create or replace function public.personal_bests()
returns table (skill text, discipline text, best int)
language sql
stable
set search_path = ''
as $$
  select a.skill::text, a.discipline::text, max(a.overall_score)::int as best
  from public.analyses a
  where a.user_id = auth.uid()
  group by a.skill, a.discipline
$$;

revoke all on function public.personal_bests() from public, anon;
grant execute on function public.personal_bests() to authenticated;
