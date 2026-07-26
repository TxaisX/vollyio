-- Close the post-012 grant leak.
--
-- 012 wrote its forward-looking default as:
--   alter default privileges ... revoke select, insert, update, delete on tables
-- which leaves TRUNCATE, REFERENCES, and TRIGGER in the inherited default set.
-- Pre-012 tables were fine, because 012 also ran `revoke all on all tables`.
-- Every table created AFTER 012 inherited those three for anon and authenticated:
-- share_links (019) and analysis_feedback (022). Both migrations' own comments
-- claimed "012's default-deny leaves new tables ungranted", which was true only
-- of the four data privileges.
--
-- TRUNCATE is the one that matters, because it bypasses row security entirely:
-- it is not a tenant-safe privilege to hold on a table whose isolation IS RLS.
-- Not reachable through the Data API today (PostgREST exposes no TRUNCATE verb
-- and no arbitrary SQL), so this is least-privilege repair and alignment with the
-- documented contract, not an incident response.

-- 1. Widen the default revoke so no future table inherits anything at all.
--    This is the line 012 should have written.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- 2. Strip what already leaked. Only the three table-wide privileges are
--    revoked, so 019's and 022's intended grants survive untouched: share_links
--    keeps table SELECT plus its column-scoped INSERT/UPDATE, and
--    analysis_feedback keeps SELECT, INSERT, UPDATE.
revoke truncate, references, trigger on table public.share_links
  from anon, authenticated;
revoke truncate, references, trigger on table public.analysis_feedback
  from anon, authenticated;
