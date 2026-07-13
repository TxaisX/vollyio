-- Quiz-first funnel: rename the top two level tiers and capture funnel answers.

-- Level tiers become beginner / intermediate / expert / pro. The top tier is
-- evaluated against a professional standard by the coaching layer.
alter table profiles drop constraint profiles_level_check;
update profiles set level = 'expert' where level = 'advanced';
update profiles set level = 'pro' where level = 'elite';
alter table profiles add constraint profiles_level_check
  check (level in ('beginner','intermediate','expert','pro'));

-- Funnel answers the coaching layer reads alongside level.
alter table profiles
  add column discipline text not null default 'indoor'
    check (discipline in ('indoor','beach')),
  add column position text
    check (position in ('setter','outside','opposite','middle','libero','blocker','defender','all_around')),
  add column play_frequency text
    check (play_frequency in ('rarely','weekly','several_per_week','daily'));
