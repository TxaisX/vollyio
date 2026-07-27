-- One welcome email per player, fired when their address is confirmed.
--
-- The confirmation is the first moment the account is real and the address is
-- known good, so that is the trigger point rather than the signup action. It
-- also keeps the send off the app's hot path: three code paths create accounts
-- (password signup, magic link, invite) and none of them should own this.
--
-- welcome_email_sent_at is the claim the edge function takes before sending;
-- it is deliberately NOT granted to authenticated, so only the service role
-- inside send-welcome can mark it and a player cannot suppress or replay their
-- own welcome. Reads are harmless and already covered by 012's table grant.
--
-- Config lives in Vault (welcome_email_url, welcome_email_apikey) so this
-- migration carries no project identifiers, matching 015. Missing config
-- no-ops rather than raising: a welcome email must never be able to fail a
-- confirmation, which is the thing the player is actually waiting on.

alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

create or replace function private.send_welcome_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_apikey text;
begin
  -- Only the null -> confirmed transition. An INSERT that arrives already
  -- confirmed (confirmations disabled, or an admin-created account) counts;
  -- a row that was confirmed before this update does not.
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'welcome_email_url';
  select decrypted_secret into v_apikey
  from vault.decrypted_secrets where name = 'welcome_email_apikey';

  if v_url is null or v_apikey is null then
    raise log 'send_welcome_on_confirm: vault config missing, skipping %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_apikey,
      'apikey', v_apikey
    ),
    body := jsonb_build_object('user_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists send_welcome_on_confirm on auth.users;
create trigger send_welcome_on_confirm
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.send_welcome_on_confirm();

revoke all on function private.send_welcome_on_confirm()
  from public, anon, authenticated;
