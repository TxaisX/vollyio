-- ALREADY APPLIED TO PROD (2026-07-15, migration history version 20260715024848
-- "allow_grass_discipline"). This file reconstructs it for the repo: it was
-- applied straight to production and never committed, leaving local replays
-- and the repo's schema story stuck at ('indoor','beach') while the app has
-- stored 'grass' since D-035. Do not re-apply; it is idempotent if replayed.

alter table analyses drop constraint if exists analyses_discipline_check;
alter table analyses add constraint analyses_discipline_check
  check (discipline in ('indoor', 'beach', 'grass'));

alter table skill_ratings drop constraint if exists skill_ratings_discipline_check;
alter table skill_ratings add constraint skill_ratings_discipline_check
  check (discipline in ('indoor', 'beach', 'grass'));

alter table profiles drop constraint if exists profiles_discipline_check;
alter table profiles add constraint profiles_discipline_check
  check (discipline in ('indoor', 'beach', 'grass'));
