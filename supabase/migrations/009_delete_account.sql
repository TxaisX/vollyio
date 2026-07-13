-- In-app account deletion (the Privacy Policy's deletion promise, self-serve).
-- The authenticated user deletes their own auth row; profiles cascades from
-- auth.users and every public table cascades from profiles, so one delete
-- removes the account and all rows. SECURITY DEFINER because the
-- authenticated role cannot touch auth.users directly. Stored footage is
-- removed via the storage API (own-folder delete policies) before this runs.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
