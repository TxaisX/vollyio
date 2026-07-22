-- D-054: month-to-date and per-day aggregates of analyses.telemetry, grouped
-- by model, feeding the dev-only spend report (/api/usage) and the analyze
-- route's self-imposed budget guard (lib/ai/budget.ts). SECURITY DEFINER
-- because RLS scopes analyses to their owner and these aggregates span every
-- account; granted to authenticated ONLY -- an anon grant would publish
-- org-wide spend volume through PostgREST's public rpc surface. Only token
-- counts leave the database; pricing happens in the app and is always
-- labeled an estimate.

create or replace function public.analyze_usage_month()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise insufficient_privilege;
  end if;
  select coalesce(jsonb_agg(entry), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'model', telemetry->>'model',
      'analyses', count(*),
      'input_tokens', sum(coalesce((telemetry->>'input_tokens')::bigint, 0)),
      'output_tokens', sum(coalesce((telemetry->>'output_tokens')::bigint, 0)),
      'cache_read_input_tokens', sum(coalesce((telemetry->>'cache_read_input_tokens')::bigint, 0)),
      'cache_creation_input_tokens', sum(coalesce((telemetry->>'cache_creation_input_tokens')::bigint, 0))
    ) as entry
    from public.analyses
    where telemetry is not null
      -- UTC month boundary: the provider's monthly cap resets on UTC months.
      and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
    group by telemetry->>'model'
  ) as grouped;
  return result;
end;
$$;

create or replace function public.analyze_usage_daily(p_days int default 31)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise insufficient_privilege;
  end if;
  select coalesce(jsonb_agg(entry order by day_key desc), '[]'::jsonb) into result
  from (
    select
      (created_at at time zone 'utc')::date as day_key,
      jsonb_build_object(
        'day', to_char((created_at at time zone 'utc')::date, 'YYYY-MM-DD'),
        'model', telemetry->>'model',
        'analyses', count(*),
        'input_tokens', sum(coalesce((telemetry->>'input_tokens')::bigint, 0)),
        'output_tokens', sum(coalesce((telemetry->>'output_tokens')::bigint, 0)),
        'cache_read_input_tokens', sum(coalesce((telemetry->>'cache_read_input_tokens')::bigint, 0)),
        'cache_creation_input_tokens', sum(coalesce((telemetry->>'cache_creation_input_tokens')::bigint, 0))
      ) as entry
    from public.analyses
    where telemetry is not null
      and created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 31), 366)))
    group by (created_at at time zone 'utc')::date, telemetry->>'model'
  ) as grouped;
  return result;
end;
$$;

revoke all on function public.analyze_usage_month() from public;
revoke all on function public.analyze_usage_daily(int) from public;
grant execute on function public.analyze_usage_month() to authenticated;
grant execute on function public.analyze_usage_daily(int) to authenticated;
