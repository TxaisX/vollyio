-- ALREADY APPLIED TO PROD (2026-07-17, migration history version 20260717134604
-- "014_enable_pg_net"). This file reconstructs it for the repo; the original
-- was applied to production without being committed. pg_net is required by
-- 015_purge_media_on_user_delete.sql, whose trigger queues the purge call
-- with net.http_post. Do not re-apply; it is idempotent if replayed.

create extension if not exists pg_net with schema extensions;
