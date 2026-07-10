-- CV Phase 1: training consent + keypoint/corpus storage pointers.

alter table profiles
  add column if not exists training_consent boolean not null default false,
  add column if not exists training_consent_at timestamptz;

alter table analyses
  add column if not exists keypoints_path text,
  add column if not exists stored_frame_paths text[] not null default '{}';
