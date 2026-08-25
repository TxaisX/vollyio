-- RESTORED. `goals.note` is live in production and no migration in this tree
-- created it.
--
-- The column was applied to the project on 2026-08-06 as `056_goal_note` (it is
-- in the remote migration history under that name) but the .sql file never
-- reached the repository. Nothing failed, because the live database already had
-- the column; what broke silently is REBUILDABILITY. A project restored from
-- `supabase/migrations/` alone comes up without `goals.note`, and the dashboard
-- selects it by name on every page load, so the first thing a rebuilt
-- environment does is throw on its own home page.
--
-- Written from the live schema rather than from memory: nullable text, no
-- default, and the same three column grants every other player-owned goals
-- column carries. `if not exists` and the grant re-issue make it a no-op
-- against the project that already has it.
--
-- What this holds (D-105): the one-line explanation the onboarding funnel
-- writes on the goal it creates, saying why that focus suits that player. NULL
-- on every goal a player adds by hand and on any account whose personalization
-- call did not answer, which is why the board renders it only when it exists
-- rather than reserving space for it.
--
-- Advisory, like the rest of the row: it gates no authorization, billing or
-- scoring decision.

alter table public.goals add column if not exists note text;

grant select (note), insert (note), update (note) on table public.goals to authenticated;
