-- Public bucket hosting the pinned on-device tracking models (D-021). Files
-- are immutable, addressed by their exact upstream filenames, and verified
-- by sha256 in the client before use; public read is the point, uploads are
-- an operator action (no user-facing write policy).
insert into storage.buckets (id, name, public, file_size_limit)
values ('models', 'models', true, 115343360)
on conflict (id) do update set public = true, file_size_limit = 115343360;
