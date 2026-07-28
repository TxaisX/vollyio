-- Server-written analysis telemetry (D-065, and the note migration 028 left
-- behind in its own header).
--
-- Migration 016 added `analyses.telemetry` and, because the analyze route
-- wrote it on the insert it performs with the PLAYER'S own credentials, it had
-- to `grant insert (telemetry) on table public.analyses to authenticated`.
-- That grant is the hole. `analyze_usage_month()` (021) sums the column,
-- lib/ai/budget.ts prices the sum, and a tripped budget answers 503 to EVERY
-- player, so one account posting absurd token counts could take the product
-- offline for all of them and, since the owner alert landed, page the owner
-- while doing it. Migration 028 bounded each field, which caps the blast
-- radius. It does not stop a player writing the column at all. This does.
--
-- Deploy order: application code FIRST, then this migration. The route version
-- that still names `telemetry` in its insert loses the column privilege the
-- moment this applies, and PostgREST answers that with a 403 on every save.
-- The new route omits the column, so it is correct both before and after.

-- The player writes the analysis row and nothing about what it cost.
--
-- Column-level `all` rather than a privilege list, per docs/security.md rule 0:
-- a named list is a denylist and stops being correct the moment Postgres has a
-- privilege the list forgot. A column-level revoke cannot subtract from the
-- table-level `grant select` in 012, so the owner still reads their own row;
-- what disappears is the column-level insert privilege 016 granted.
revoke all (telemetry) on table public.analyses from authenticated;

-- The only writer. `security definer` so it can update a table the caller has
-- no update privilege on, `search_path = ''` so nothing it resolves depends on
-- the caller's path, and granted to `service_role` alone, so a signed-in player
-- calling it through the data API is denied before an argument is read.
--
-- Why a function and not `grant update (telemetry) ... to service_role`: the
-- ownership policy on `analyses` is FOR ALL, so the only thing standing between
-- a player and an UPDATE on that table is the absence of an update grant. A
-- bare column grant is a door of a shape someone will later widen by habit;
-- this is one call that validates its argument and can touch nothing else.
-- Never add an update grant on this table for `authenticated`.
--
-- Write-once and time-bounded, because `analyses` is insert-only and immutable
-- for players by design and this must not become the crack in that: the update
-- matches only a row whose telemetry is still null and which was created within
-- the last hour, so there is no stored analysis here for anyone to rewrite.
-- Returns false rather than raising when nothing matched, because a missed
-- measurement is an operator problem and never the player's.
create or replace function public.record_analysis_telemetry(
  p_analysis_id uuid,
  p_telemetry jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field text;
  v_type text;
  v_updated boolean;
begin
  if p_telemetry is null or pg_catalog.jsonb_typeof(p_telemetry) <> 'object' then
    raise check_violation using message = 'telemetry must be an object';
  end if;

  -- A ceiling on the whole document as well as on the numbers inside it. The
  -- caller builds this from the coaching reply, so nothing here is
  -- attacker-shaped today; the cap is what stops a later caller parking a blob
  -- in a column two aggregate functions scan on every budget check.
  if pg_catalog.length(p_telemetry::text) > 2000 then
    raise check_violation using message = 'telemetry too large';
  end if;

  -- Each bounded field must be a number, json null, or absent. Checking the
  -- type before the casts below turns a malformed value into a stated refusal
  -- instead of a cast error raised from the middle of the bounds expression.
  foreach v_field in array array[
    'input_tokens',
    'output_tokens',
    'cache_read_input_tokens',
    'cache_creation_input_tokens',
    'duration_ms'
  ] loop
    v_type := pg_catalog.jsonb_typeof(p_telemetry -> v_field);
    if v_type is not null and v_type not in ('number', 'null') then
      raise check_violation using message = 'telemetry field is not a number';
    end if;
  end loop;

  -- The same ceilings as the analyses_telemetry_bounds_check constraint added
  -- by 028, deliberately stated twice. The function validating is what produces
  -- a refusal with a message the operator can read; the constraint is what
  -- makes the bound true for every writer, including a future one that forgets
  -- this function exists. If the two ever disagree the constraint wins and the
  -- write fails, which is the safe direction.
  if not (
    coalesce((p_telemetry->>'input_tokens')::bigint, 0) between 0 and 5000000
    and coalesce((p_telemetry->>'output_tokens')::bigint, 0) between 0 and 1000000
    and coalesce((p_telemetry->>'cache_read_input_tokens')::bigint, 0) between 0 and 5000000
    and coalesce((p_telemetry->>'cache_creation_input_tokens')::bigint, 0) between 0 and 5000000
    and coalesce((p_telemetry->>'duration_ms')::bigint, 0) between 0 and 600000
  ) then
    raise check_violation using message = 'telemetry out of bounds';
  end if;

  update public.analyses
  set telemetry = p_telemetry
  where id = p_analysis_id
    and telemetry is null
    and created_at >= pg_catalog.clock_timestamp() - interval '1 hour'
  returning true into v_updated;

  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.record_analysis_telemetry(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_analysis_telemetry(uuid, jsonb)
  to service_role;
