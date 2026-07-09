-- Beach discipline support.
-- Tag each analysis with its discipline and scope skill ratings per discipline, so
-- indoor and beach reps never blend into a single rolling rating. Existing rows are
-- backfilled to 'indoor' by the column default.

alter table analyses
  add column discipline text not null default 'indoor'
  check (discipline in ('indoor', 'beach'));

create index analyses_user_discipline
  on analyses (user_id, discipline, created_at desc);

alter table skill_ratings
  add column discipline text not null default 'indoor'
  check (discipline in ('indoor', 'beach'));

-- Ratings are now keyed per discipline instead of one row per (user, skill).
alter table skill_ratings drop constraint skill_ratings_pkey;
alter table skill_ratings add primary key (user_id, skill, discipline);
