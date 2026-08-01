-- 042: goals and games get the indexes their queries always assumed.
--
-- Postgres does not index foreign-key columns on its own, and 003 created
-- both tables with nothing beyond the primary key. Every goals read in the
-- product filters on (user_id, status) -- dashboard rail, progress page,
-- coach context, plan seed -- and the scoreboard reads games by user ordered
-- by recency. Both were full-table scans; invisible today, a seq scan per
-- page view at scale. Matches the shape every other per-user table has had
-- since 002/004.

create index if not exists goals_user_status on public.goals (user_id, status);

create index if not exists games_user_started on public.games (user_id, started_at desc);
