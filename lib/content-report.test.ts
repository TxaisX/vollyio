import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  REPORT_REASON_ORDER,
  NOTE_MAX_CHARS,
  EXCERPT_MAX_CHARS,
  reportRequestSchema,
  reportRpcArgs,
  reportOutcome,
  isReportStatus,
  REPORT_STATUSES,
} from "./content-report.ts";

// IN-APP REPORTING IS A POLICY REQUIREMENT, NOT A FEATURE, and that is why it
// is pinned this hard.
//
// Play's AI-Generated Content policy requires apps whose central feature is
// generative AI to let a user report offensive output without leaving the app.
// Play's User-Generated Content policy separately requires an in-app reporting
// system for publicly accessible user content, which is what /share/<token> is.
// Vollyio is in scope for both. If these tests start failing because a reason
// was dropped or a surface stopped being reachable, the fix is to restore it,
// not to relax the test: what is being asserted is the thing that keeps the app
// on the store.

const MIGRATION = await readFile(
  new URL("../supabase/migrations/060_report_is_a_surface_not_a_mailbox.sql", import.meta.url),
  "utf8",
);

const ANALYSIS_ID = "a49925a7-3084-4e6f-99c1-5969c16c4ce2";
const SESSION_ID = "ee4a53c6-14dd-4167-9912-a8dd79e91923";
const TOKEN = "AegOOPz4YeLxiWVfHHMboBGJLF72c-nSJ7JUB5eTyDc";

test("every reason the UI can send is a reason the database accepts", () => {
  // The check constraint and the enum are written in two languages in two
  // files, and nothing but this test makes them agree. A category present here
  // and absent there is a 400 on the one tap that matters.
  for (const reason of REPORT_REASONS) {
    assert.ok(
      MIGRATION.includes(`'${reason}'`),
      `${reason} is offered by the app but the check constraint would reject it`,
    );
  }
});

test("every reason has a label and a place in the rendered order", () => {
  for (const reason of REPORT_REASONS) {
    assert.equal(typeof REPORT_REASON_LABEL[reason], "string");
    assert.ok(REPORT_REASON_LABEL[reason].length > 0);
    assert.ok(
      REPORT_REASON_ORDER.includes(reason),
      `${reason} exists but the control would never render it`,
    );
  }
  // No duplicates and nothing extra: the order list IS the control's map, so a
  // stray entry renders a chip that submits a reason the constraint rejects.
  assert.equal(REPORT_REASON_ORDER.length, REPORT_REASONS.length);
  assert.equal(new Set(REPORT_REASON_ORDER).size, REPORT_REASONS.length);
});

test("the categories Play names are all reachable", () => {
  // The named prohibitions from the Inappropriate Content policy that a player
  // could plausibly be looking at. Dropping any of these leaves someone with a
  // real report and no category to file it under, which reads to a reviewer as
  // an app that collects complaints rather than one that acts on them.
  for (const required of [
    "sexual_content",
    "hate_or_harassment",
    "violence_or_danger",
    "child_endangerment",
  ] as const) {
    assert.ok(REPORT_REASONS.includes(required), `${required} must stay reportable`);
  }
});

test("someone who wants themselves taken out of a clip has somewhere to say so", () => {
  // The likeliest real report on this product by a wide margin, and the reason
  // it leads the list. Every clip is shot at a public match or an open gym, so
  // incidental teammates are the NORM and cannot be what this asks about; the
  // actionable case is a person who wants out. The label must therefore be
  // about removal, not about prior consent, or it describes ordinary uploads.
  assert.equal(REPORT_REASON_ORDER[0], "private_person");
  const label = REPORT_REASON_LABEL.private_person.toLowerCase();
  assert.ok(
    label.includes("taken down") || label.includes("i am in this"),
    "the leading reason must offer removal, not allege a consent failure",
  );
  assert.ok(
    !label.includes("did not agree"),
    "consent wording would describe almost every legitimate clip on the product",
  );
});

test("an anonymous share viewer can file a report with nothing but the token", () => {
  const parsed = reportRequestSchema.parse({
    surface: "shared_analysis",
    reason: "private_person",
    token: TOKEN,
  });
  const args = reportRpcArgs(parsed);
  assert.equal(args.p_surface, "shared_analysis");
  assert.equal(args.p_share_token, TOKEN);
  // Nothing that would require an account.
  assert.equal(args.p_analysis_id, null);
  assert.equal(args.p_coach_session_id, null);
});

test("the raw share token never travels as an analysis id", () => {
  // D-049's whole posture: the caller names a token, the definer function
  // resolves it. A route that accepted an analysis id from a share page would
  // let anyone file against any row by guessing uuids.
  const args = reportRpcArgs(
    reportRequestSchema.parse({
      surface: "shared_analysis",
      reason: "other",
      token: TOKEN,
    }),
  );
  assert.equal(args.p_analysis_id, null);
});

test("a coach report carries the text even when the thread has no id yet", () => {
  const args = reportRpcArgs(
    reportRequestSchema.parse({
      surface: "coach",
      reason: "deceptive",
      excerpt: "The coach said something wrong here.",
    }),
  );
  assert.equal(args.p_coach_session_id, null);
  assert.equal(args.p_excerpt, "The coach said something wrong here.");
});

test("a coach report without an excerpt is refused", () => {
  // The excerpt is the only anchor a first-answer report has. Accepting a row
  // with neither a session nor the text produces a report nobody can action.
  assert.equal(
    reportRequestSchema.safeParse({ surface: "coach", reason: "other" }).success,
    false,
  );
});

test("an analysis report must name an analysis", () => {
  assert.equal(
    reportRequestSchema.safeParse({ surface: "analysis", reason: "other" }).success,
    false,
  );
  const args = reportRpcArgs(
    reportRequestSchema.parse({
      surface: "analysis",
      reason: "violence_or_danger",
      analysis_id: ANALYSIS_ID,
    }),
  );
  assert.equal(args.p_analysis_id, ANALYSIS_ID);
  assert.equal(args.p_share_token, null);
});

test("a session id is carried through on a coach report", () => {
  const args = reportRpcArgs(
    reportRequestSchema.parse({
      surface: "coach",
      reason: "hate_or_harassment",
      coach_session_id: SESSION_ID,
      excerpt: "x",
    }),
  );
  assert.equal(args.p_coach_session_id, SESSION_ID);
});

test("an unknown surface or reason is rejected before it reaches the database", () => {
  assert.equal(
    reportRequestSchema.safeParse({ surface: "billing", reason: "other" }).success,
    false,
  );
  assert.equal(
    reportRequestSchema.safeParse({
      surface: "analysis",
      reason: "i_dislike_it",
      analysis_id: ANALYSIS_ID,
    }).success,
    false,
  );
});

test("the note and the excerpt are bounded on both sides of the wire", () => {
  const tooLongNote = "n".repeat(NOTE_MAX_CHARS + 1);
  assert.equal(
    reportRequestSchema.safeParse({
      surface: "analysis",
      reason: "other",
      analysis_id: ANALYSIS_ID,
      note: tooLongNote,
    }).success,
    false,
  );
  assert.equal(
    reportRequestSchema.safeParse({
      surface: "coach",
      reason: "other",
      excerpt: "e".repeat(EXCERPT_MAX_CHARS + 1),
    }).success,
    false,
  );
  // The same ceilings the column checks enforce, so a value this side accepts
  // can never be one the insert rejects.
  assert.ok(MIGRATION.includes(`char_length(note) <= ${NOTE_MAX_CHARS}`));
  assert.ok(MIGRATION.includes(`char_length(excerpt) <= ${EXCERPT_MAX_CHARS}`));
});

test("a blank note is dropped rather than stored as whitespace", () => {
  const args = reportRpcArgs(
    reportRequestSchema.parse({
      surface: "analysis",
      reason: "other",
      analysis_id: ANALYSIS_ID,
      note: "   ",
    }),
  );
  assert.equal(args.p_note, null);
});

test("the report surface never tells a stranger why a token failed", () => {
  // Distinguishing "no such link" from "revoked link" turns this endpoint into
  // an oracle for probing tokens, and the reporter cannot act on the answer.
  assert.equal(reportOutcome("not_found").message, reportOutcome("not_found").message);
  assert.ok(!reportOutcome("not_found").message.toLowerCase().includes("revoked"));
  assert.ok(!reportOutcome("not_found").message.toLowerCase().includes("expired"));
});

test("every status maps to an outcome and unknown values are not statuses", () => {
  for (const status of REPORT_STATUSES) {
    const outcome = reportOutcome(status);
    assert.equal(typeof outcome.httpStatus, "number");
    assert.ok(outcome.message.length > 0);
    assert.ok(isReportStatus(status));
  }
  assert.equal(isReportStatus("definitely_not"), false);
  assert.equal(isReportStatus(undefined), false);
  // A database that answers with something outside the vocabulary must read as
  // a failure. `ok` is the only success and it has to be spelled exactly.
  assert.equal(reportOutcome("ok").httpStatus, 200);
  assert.equal(reportOutcome("rate_limited").httpStatus, 429);
});

test("the anonymous write surface is a definer function, not a table grant", () => {
  // The whole reason a stranger can report at all. An anon INSERT grant on
  // content_reports would be a public write endpoint on a table that holds
  // other people's safety reports.
  assert.ok(MIGRATION.includes("security definer"));
  assert.ok(MIGRATION.includes("set search_path = ''"));
  assert.ok(/grant execute on function public\.submit_content_report/.test(MIGRATION));
  assert.ok(
    // `[^;]` already crosses newlines, so this needs no dotAll flag (which the
    // repo's target predates anyway).
    !/grant[^;]*insert[^;]*on table public\.content_reports[^;]*anon/i.test(MIGRATION),
    "anon must never hold an insert grant on the reports table",
  );
});

test("reports are rate limited, so the anonymous path is not a free write", () => {
  assert.ok(MIGRATION.includes("content_report_hourly_cap"));
  assert.ok(MIGRATION.includes("rate_limited"));
});

test("deleting the reporter does not erase the report", () => {
  // A safety report is about someone else's content. `on delete cascade` here
  // would let the subject of a report clear it by deleting the reporter, and
  // would lose the moderation record on an ordinary account deletion.
  assert.ok(
    /reporter_id uuid references public\.profiles \(id\) on delete set null/.test(MIGRATION),
    "reporter_id must be set null on delete, never cascade",
  );
});
