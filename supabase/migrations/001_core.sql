create type skill as enum ('serve','pass','set','attack','block','dig');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  level text not null default 'beginner'
    check (level in ('beginner','intermediate','advanced','elite')),
  xp int not null default 0,
  plan text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "read own profile" on profiles
  for select using (id = auth.uid());
create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
