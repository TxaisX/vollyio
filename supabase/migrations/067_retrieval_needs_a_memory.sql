-- Retrieval, not training (2026-08-27). The score compresses because the model
-- reads every clip in a vacuum: nothing in the prompt says what a 60 looks like
-- or what THIS player's last attack looked like, so it returns the population
-- mean with a little noise on top (evals/CALIBRATION.md). Anchors are the cheap
-- half of that fix, and anchors need a memory to draw from.
--
-- This is deliberately NOT a training corpus. 59 analyses is not a dataset, and
-- they are model outputs rather than ground truth, so learning from them would
-- reproduce the compression. What they ARE is a usable retrieval index: the
-- player's own previous reps of the same skill, fetched at read time and put in
-- the prompt as comparison points.
--
-- gte-small, 384 dimensions, because it runs INSIDE a Supabase Edge Function
-- (`Supabase.ai.Session('gte-small')`) with no external call and no second
-- credential. The gateway that serves every other model call in this app has no
-- embedding model at all -- checked against its listing on 2026-08-27, zero of
-- them -- so the alternative was a new vendor and a new key for one 384-float
-- vector. English only, and inputs truncate at 512 tokens.
create extension if not exists vector with schema extensions;

create table public.analysis_embeddings (
  analysis_id uuid primary key references public.analyses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The text that was embedded, kept because an embedding is unreadable and a
  -- retrieval that surfaces the wrong rep is otherwise undebuggable. It is also
  -- what a re-embed onto a different model would re-run against.
  source_text text not null,
  embedding extensions.vector(384) not null,
  -- Pinned, not assumed. Vectors from two models are not comparable, so a model
  -- change means a backfill, and a mixed table has to be detectable in SQL.
  embed_model text not null default 'gte-small',
  created_at timestamptz not null default now()
);

-- Inner product, which is cosine distance for normalized vectors, and gte-small
-- is asked to normalize. Using vector_ip_ops against UNNORMALIZED vectors would
-- silently rank by magnitude instead of direction.
create index analysis_embeddings_vec
  on public.analysis_embeddings
  using hnsw (embedding extensions.vector_ip_ops);

create index analysis_embeddings_user on public.analysis_embeddings (user_id, created_at desc);

alter table public.analysis_embeddings enable row level security;

-- Same posture as analysis_feedback (022): owner-only, and the exists() check
-- means a forged analysis_id is rejected at the RLS boundary rather than in the
-- app layer.
create policy "own analysis embeddings" on public.analysis_embeddings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.analyses as a
      where a.id = analysis_id
        and a.user_id = (select auth.uid())
    )
  );

-- 012's default-deny leaves new tables ungranted; open exactly the owner surface.
grant select, insert, update, delete on table public.analysis_embeddings to authenticated;

-- SECURITY INVOKER, and this is the load-bearing word in the whole migration.
-- A definer function here would read straight past the policy above and hand one
-- player another player's reps as "similar examples" -- private footage, leaked
-- through a helper nobody would think to audit. Invoker keeps RLS in force, so
-- this can only ever return rows the caller already owns.
--
-- search_path is pinned for the reason 065 pinned it on the cap: an unqualified
-- name in a function is resolved at call time against whatever the caller's path
-- happens to be.
create or replace function public.match_analyses(
  query_embedding extensions.vector(384),
  match_skill public.skill,
  match_count integer default 5
)
returns table (
  analysis_id uuid,
  skill public.skill,
  overall_score integer,
  created_at timestamptz,
  source_text text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    e.analysis_id,
    a.skill,
    a.overall_score,
    a.created_at,
    e.source_text,
    -- Negated inner product: pgvector's <#> returns the NEGATIVE inner product
    -- so that smaller sorts first. Flipping the sign here means the column reads
    -- the way a caller expects, 1.0 identical and downward.
    (e.embedding <#> query_embedding) * -1 as similarity
  from public.analysis_embeddings as e
  join public.analyses as a on a.id = e.analysis_id
  where a.skill = match_skill
    and a.overall_score is not null
  order by e.embedding <#> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

grant execute on function public.match_analyses(extensions.vector, public.skill, integer) to authenticated;
