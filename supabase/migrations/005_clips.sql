-- Persist the raw capture clip so the results page can play it back.
alter table analyses add column if not exists clip_path text;

-- Private bucket for original clips; 100 MB ceiling keeps a phone clip in budget.
insert into storage.buckets (id, name, public, file_size_limit)
values ('clips', 'clips', false, 104857600)
on conflict (id) do nothing;

drop policy if exists "own clip objects select" on storage.objects;
create policy "own clip objects select" on storage.objects
  for select using (
    bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own clip objects insert" on storage.objects;
create policy "own clip objects insert" on storage.objects
  for insert with check (
    bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own clip objects delete" on storage.objects;
create policy "own clip objects delete" on storage.objects
  for delete using (
    bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text
  );
