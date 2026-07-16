-- Contract phase. Apply only after the application version that inserts an
-- analysis before create-only media uploads has replaced the previous route.

-- New public objects are private until a migration grants the exact access.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Anonymous visitors do not use the Data API. Signed-in requests still pass
-- through each table's ownership RLS policy after these grants are checked.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on table public.profiles to authenticated;
grant update (
  display_name,
  level,
  training_consent,
  training_consent_at,
  discipline,
  position,
  play_frequency,
  updated_at
) on table public.profiles to authenticated;

grant select on table public.analyses to authenticated;
grant insert (
  id,
  user_id,
  skill,
  discipline,
  source,
  duration_s,
  frame_count,
  frame_paths,
  thumb_path,
  clip_path,
  keypoints_path,
  stored_frame_paths,
  overall_score,
  result,
  model
) on table public.analyses to authenticated;
grant select, insert, update on table public.skill_ratings to authenticated;
grant select, insert, update on table public.goals to authenticated;
grant select, insert on table public.games to authenticated;
grant select, insert on table public.chat_messages to authenticated;
grant select, insert on table public.xp_events to authenticated;
grant select, insert, update, delete on table public.coach_sessions to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'application/json']
where id = 'frames';

update storage.buckets
set
  file_size_limit = 104857600,
  allowed_mime_types = array['video/webm', 'video/mp4', 'video/quicktime']
where id = 'clips';

drop policy if exists "own frame objects select" on storage.objects;
create policy "own frame objects select" on storage.objects
  for select to authenticated using (
    bucket_id = 'frames'
    and owner_id = (select auth.uid()::text)
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.user_id = (select auth.uid())
        and analysis.id::text = (storage.foldername(name))[2]
        and (
          name = any (analysis.frame_paths)
          or name = any (analysis.stored_frame_paths)
          or name = analysis.keypoints_path
        )
    )
  );

drop policy if exists "own frame objects insert" on storage.objects;
create policy "own frame objects insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'frames'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.user_id = (select auth.uid())
        and analysis.id::text = (storage.foldername(name))[2]
        and (
          (
            name = any (analysis.frame_paths)
            and name ~ '/f[0-9]{2}[.]jpg$'
            and metadata ->> 'mimetype' = 'image/jpeg'
          )
          or (
            name = any (analysis.stored_frame_paths)
            and name ~ '/x[0-9]{2}[.]jpg$'
            and metadata ->> 'mimetype' = 'image/jpeg'
          )
          or (
            name = analysis.keypoints_path
            and name ~ '/keypoints[.]json$'
            and metadata ->> 'mimetype' = 'application/json'
          )
        )
    )
  );

drop policy if exists "own frame objects delete" on storage.objects;
create policy "own frame objects delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'frames'
    and owner_id = (select auth.uid()::text)
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.user_id = (select auth.uid())
        and analysis.id::text = (storage.foldername(name))[2]
        and (
          name = any (analysis.frame_paths)
          or name = any (analysis.stored_frame_paths)
          or name = analysis.keypoints_path
        )
    )
  );

drop policy if exists "own clip objects select" on storage.objects;
create policy "own clip objects select" on storage.objects
  for select to authenticated using (
    bucket_id = 'clips'
    and owner_id = (select auth.uid()::text)
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.user_id = (select auth.uid())
        and analysis.id::text = (storage.foldername(name))[2]
        and name = analysis.clip_path
    )
  );

drop policy if exists "own clip objects insert" on storage.objects;
create policy "own clip objects insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'clips'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.user_id = (select auth.uid())
        and analysis.id::text = (storage.foldername(name))[2]
        and name = analysis.clip_path
        and (
          (name ~ '[.]webm$' and metadata ->> 'mimetype' = 'video/webm')
          or (name ~ '[.]mp4$' and metadata ->> 'mimetype' = 'video/mp4')
          or (name ~ '[.]mov$' and metadata ->> 'mimetype' = 'video/quicktime')
        )
    )
  );

drop policy if exists "own clip objects delete" on storage.objects;
create policy "own clip objects delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'clips'
    and owner_id = (select auth.uid()::text)
    and exists (
      select 1
      from public.analyses as analysis
      where analysis.user_id = (select auth.uid())
        and analysis.id::text = (storage.foldername(name))[2]
        and name = analysis.clip_path
    )
  );
