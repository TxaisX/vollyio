-- D-100: raise the pending clip ceiling from 8 MB to 20 MB.
--
-- WHY THIS IS A CORRECTNESS FIX AND NOT A RELAXATION. Migration 054 set 8 MB
-- against the assumption that every clip is trimmed in the browser before it is
-- uploaded, where a full-length window re-encodes to roughly 3 MB. That
-- assumption fails on exactly the devices that most need it to hold. A browser
-- that cannot DECODE a clip cannot trim it either, so those players must send
-- the original file, and an untrimmed iPhone recording is 1080p HEVC at 8 to 10
-- Mbps: ten seconds of it is already past 8 MB before anything has gone wrong.
-- The old ceiling therefore refused the untrimmed path at the storage layer,
-- which is a dead end for anyone whose browser cannot decode HEVC.
--
-- WHY 20 AND NOT MORE, MEASURED. Six real reads on 2026-08-06 walked the size
-- up until the gateway refused: 21.4 MB of MP4 (28.6 MB base64) was accepted and
-- scored, 25.4 MB (33.9 MB base64) was refused. The wall is a 32 MB request cap
-- and it fails badly, refusing the connection about a second in, before the
-- upload finishes, so it reaches the player as a bare transport error rather
-- than as anything actionable. 20 MB raw is 26.7 MB encoded, leaving real margin
-- under that wall. Going meaningfully higher needs a file-upload API and a
-- second round trip, which is a different design and not one this migration is
-- quietly opening the door to.
--
-- Note for anyone tempted to shrink this to save money: SIZE IS NOT WHAT COSTS.
-- Input tokens measured 2445 on every one of those reads, from 4.3 MB to 21.4
-- MB, because the provider bills per SECOND of footage. A bigger file of the
-- same clip reads at the same price.
--
-- The ceiling is stated HERE as well as in the route because the upload happens
-- first: a policy that admits what the route cannot read costs the player their
-- upload time and then refuses them anyway. `lib/analysis-types.ts`
-- MAX_CLIP_BYTES and this number move together, and
-- `lib/security-contract.test.ts` fails if they drift.
--
-- Nothing else about the prefix changes. Owner scoping, the whole-path match
-- against the caller's verified id, the UUID-shaped directory, the single
-- filename and the MIME check are all reproduced from 054 verbatim, because
-- this policy is replaced wholesale rather than altered and every guard has to
-- survive the rewrite.

drop policy if exists "pending clip objects insert" on storage.objects;
create policy "pending clip objects insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'clips'
    and name ~ (
      '^' || (select auth.uid()::text)
        || '/pending/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        || '/clip[.](webm|mp4|mov)$'
    )
    and (
      (name ~ '[.]webm$' and metadata ->> 'mimetype' = 'video/webm')
      or (name ~ '[.]mp4$' and metadata ->> 'mimetype' = 'video/mp4')
      or (name ~ '[.]mov$' and metadata ->> 'mimetype' = 'video/quicktime')
    )
    and coalesce((metadata ->> 'size')::bigint, 0) <= 20000000
  );

-- The select and delete policies are reproduced VERBATIM from 054, unchanged.
--
-- They are here because this file replaces the pending-clip policy set, and the
-- contract test reads the NEWEST migration that defines it and requires all
-- three. That is not pedantry: `drop policy ... create policy` is a wholesale
-- replacement, and a migration that rewrites one of three while the other two
-- survive only in an older file is how a guard goes missing during the next
-- rewrite, when someone reads 055 as the current picture and it is not.
--
-- Neither has a size check, and neither should: a ceiling belongs on the write.
-- Reading and deleting an object that is already in the bucket has nothing left
-- to bound, and adding one would make a clip that somehow exceeded it
-- undeletable, which is the opposite of what a cap is for.

drop policy if exists "pending clip objects select" on storage.objects;
create policy "pending clip objects select" on storage.objects
  for select to authenticated using (
    bucket_id = 'clips'
    and owner_id = (select auth.uid()::text)
    and name ~ (
      '^' || (select auth.uid()::text)
        || '/pending/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        || '/clip[.](webm|mp4|mov)$'
    )
  );

drop policy if exists "pending clip objects delete" on storage.objects;
create policy "pending clip objects delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'clips'
    and owner_id = (select auth.uid()::text)
    and name ~ (
      '^' || (select auth.uid()::text)
        || '/pending/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        || '/clip[.](webm|mp4|mov)$'
    )
  );
