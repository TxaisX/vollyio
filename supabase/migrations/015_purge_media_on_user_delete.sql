-- Deleting an account deletes the player's film, on every path.
--
-- /api/account/delete already clears storage for anyone deleting in-app, but
-- an account removed any other way (SQL, dashboard, an admin tool) skipped it
-- and stranded the media. That is how 779 files across six deleted accounts
-- survived until 2026-07-17, against the Privacy Policy's promise.
--
-- This cannot be done in SQL: storage.protect_delete refuses any delete from
-- storage.objects ("Direct deletion from storage tables is not allowed. Use
-- the Storage API instead"), because dropping the row leaves the bytes with
-- nothing pointing at them. So the hook calls the purge-user-media edge
-- function over pg_net, which uses the Storage API.
--
-- pg_net queues the request transactionally and its worker sends it after the
-- commit. That ordering is required, not incidental: the function authorizes
-- by refusing any account that still exists, so the call must land after the
-- delete is durable. A rolled-back delete takes the queued request with it.
--
-- Config lives in Vault (purge_media_url, purge_media_apikey) rather than
-- inline, so this migration carries no project identifiers. Missing config
-- no-ops rather than blocking a deletion: removing the account is the promise
-- that must never fail. scripts/purge-orphaned-media.mjs is the backstop that
-- catches anything this misses.

create or replace function private.purge_media_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_apikey text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'purge_media_url';
  select decrypted_secret into v_apikey
  from vault.decrypted_secrets where name = 'purge_media_apikey';

  if v_url is null or v_apikey is null then
    raise log 'purge_media_on_user_delete: vault config missing, skipping % ', old.id;
    return old;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_apikey,
      'apikey', v_apikey
    ),
    body := jsonb_build_object('user_id', old.id)
  );

  return old;
end;
$$;

drop trigger if exists purge_media_on_user_delete on auth.users;
create trigger purge_media_on_user_delete
  after delete on auth.users
  for each row execute function private.purge_media_on_user_delete();

revoke all on function private.purge_media_on_user_delete()
  from public, anon, authenticated;
