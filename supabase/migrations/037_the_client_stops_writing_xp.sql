-- The contract half of D-071. Apply ONLY after the code that calls
-- `public.award_xp` and `public.complete_daily_challenge` (036) is live in
-- production.
--
-- Until this runs, the hole 036 was written to close is still open: the
-- functions exist and the app uses them, but a hand-rolled request can still
-- insert whatever it likes straight into `xp_events`. This is the statement
-- that makes XP earned rather than claimed.
--
-- Verify before applying, against production:
--   select count(*) from public.xp_events where created_at > now() - interval '1 day';
-- then complete a challenge in the app and confirm the count moved. If it did,
-- the RPC path is live and this is safe. If it did not, the deploy has not
-- landed and this migration will break XP entirely.

-- `all` rather than a privilege list, per docs/security.md rule 0: a named list
-- is a denylist and stops being correct the moment Postgres grows a privilege
-- the list forgot.
--
-- Table-level select is granted in 012 and this cannot subtract from it, so the
-- player still reads their own XP and the dashboard, streak and level all keep
-- working. What disappears is the ability to write it.
revoke insert, update, delete on table public.xp_events from authenticated;

-- The functions in 036 are `security definer`, so they insert as the function
-- owner and are unaffected by the revoke above. That is the whole design: one
-- door, and it checks that the work behind the reason actually exists.
