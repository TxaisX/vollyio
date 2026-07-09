-- getProgress() runs on every dashboard load: filter by user_id, order by
-- created_at desc, limit 500. Every other hot table (analyses, chat_messages)
-- already has this composite index; xp_events was missing it.
create index if not exists xp_events_user_recent
  on xp_events (user_id, created_at desc);
