-- 053: a rating must know which scale built it (D-094).
--
-- skill_ratings.rating is an EWMA of analysis scores, which is only a
-- meaningful number while every blended score sits on the same 0-100 scale.
-- The scale is about to be recalibrated (the intermediate-to-pro re-anchor),
-- and a rating that silently averages old-scale and new-scale scores is wrong
-- in a way nothing can detect or repair afterwards: the blend has no memory of
-- which points came from where.
--
-- This column records, per rating row, the SCALE_VERSION (lib/ai/pointers.ts)
-- of the last score blended in. The app re-seeds instead of blending when the
-- versions differ. NULL means the row predates versioning, which by
-- construction means version 1: every score ever stored before this migration
-- was produced by the linear 30..100 mapping that version 1 names. There is
-- deliberately no DEFAULT, because a default would stamp future inserts with a
-- number the writing code did not choose; the app writes the value explicitly
-- on every upsert.
--
-- Additive and inert: no grant changes (012's table-wide skill_ratings grants
-- already cover the column), no policy changes, no backfill. A deployment
-- where this migration lands before the code reads it degrades to nothing: the
-- old code neither selects nor writes the column. The column is advisory in
-- the same sense as the rating itself (docs/security.md): a technical player
-- can already write their own rating through the data API, so a column that
-- only shapes how their own rating blends adds no new authority.

alter table public.skill_ratings add column scale_version integer;

comment on column public.skill_ratings.scale_version is
  'SCALE_VERSION of the last score blended into rating. NULL = version 1 (pre-versioning). See D-094.';
