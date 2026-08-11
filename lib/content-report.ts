import { z } from "zod";

// The request shape and the status vocabulary for in-app content reporting
// (migration 060). Pure on purpose: the route, the control, and the tests all
// read the same reasons from here, so a category can never exist in the UI
// without existing in the check constraint that has to accept it.

// Kept in the same order the DB check constraint lists them. These are Play's
// Inappropriate Content categories written the way a volleyball player would
// say them, not the way a policy document does.
export const REPORT_REASONS = [
  "sexual_content",
  "hate_or_harassment",
  "violence_or_danger",
  "child_endangerment",
  "private_person",
  "deceptive",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

// What the player taps. `private_person` leads with the case this product will
// actually see: a teammate or a bystander who is in the frame and never agreed
// to be. It is listed above the rarer categories for that reason.
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  private_person: "Someone in this did not agree to be filmed",
  sexual_content: "Sexual content",
  hate_or_harassment: "Hate, bullying or harassment",
  violence_or_danger: "Violence or something dangerous",
  child_endangerment: "Puts a child at risk",
  deceptive: "Deceptive or misleading",
  other: "Something else",
};

// The order the control renders them in, which is not the storage order.
export const REPORT_REASON_ORDER: ReportReason[] = [
  "private_person",
  "hate_or_harassment",
  "sexual_content",
  "violence_or_danger",
  "child_endangerment",
  "deceptive",
  "other",
];

export const NOTE_MAX_CHARS = 1000;
export const EXCERPT_MAX_CHARS = 2000;

// Matches analysis_by_share_token's own bounds, so a token this side rejects is
// exactly a token that side would fail to resolve.
const SHARE_TOKEN_MIN = 20;
const SHARE_TOKEN_MAX = 128;

const reason = z.enum(REPORT_REASONS);
const note = z.string().max(NOTE_MAX_CHARS).optional();

export const reportRequestSchema = z.discriminatedUnion("surface", [
  z.object({
    surface: z.literal("analysis"),
    reason,
    note,
    analysis_id: z.uuid(),
  }),
  z.object({
    surface: z.literal("coach"),
    reason,
    note,
    // Absent on the first answer of a fresh chat, which is on screen before its
    // thread has been read back. The excerpt is what anchors the report there,
    // which is why that one is required and this one is not.
    coach_session_id: z.uuid().optional(),
    excerpt: z.string().min(1).max(EXCERPT_MAX_CHARS),
  }),
  z.object({
    surface: z.literal("shared_analysis"),
    reason,
    note,
    // The RAW token from the url. It is resolved to a link id inside the
    // SECURITY DEFINER function and never stored, same as every other share
    // surface (D-049).
    token: z.string().min(SHARE_TOKEN_MIN).max(SHARE_TOKEN_MAX),
  }),
]);

export type ReportRequest = z.infer<typeof reportRequestSchema>;

// Every value submit_content_report can return. Anything else coming back from
// the database is a shape change and must be treated as a failure, never as a
// silent success.
export const REPORT_STATUSES = [
  "ok",
  "invalid",
  "not_found",
  "rate_limited",
  "unauthenticated",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);
}

// The HTTP answer for each status, and the sentence the reporter reads.
//
// `not_found` deliberately does NOT say the link is dead or the analysis is not
// yours. A report surface that distinguishes "no such share link" from "that
// link exists but is revoked" is an oracle for probing tokens, and the person
// reading this cannot act on the difference anyway.
export function reportOutcome(status: ReportStatus): {
  httpStatus: number;
  message: string;
} {
  switch (status) {
    case "ok":
      return { httpStatus: 200, message: "Thanks. We have this and will look at it." };
    case "rate_limited":
      return {
        httpStatus: 429,
        message: "That is a lot of reports at once. Try again in an hour.",
      };
    case "unauthenticated":
      return { httpStatus: 401, message: "Sign in to report this." };
    case "not_found":
      return { httpStatus: 404, message: "We could not find what you are reporting." };
    case "invalid":
      return { httpStatus: 400, message: "That report could not be read." };
  }
}

// The owner mail for one report.
//
// Play does not only require that reports be COLLECTED; it requires that they
// inform moderation. A row nobody reads is the collecting half without the
// acting half, and this product has no admin console, so the mail is the queue.
// Written for the owner, blunt, and it names the query that reviews the row
// rather than describing where to look.
export function formatReportAlert(
  request: ReportRequest,
  reportedAt: string,
): { subject: string; text: string } {
  const target =
    request.surface === "analysis"
      ? `analysis ${request.analysis_id}`
      : request.surface === "shared_analysis"
        ? "a public share link"
        : `coach thread ${request.coach_session_id ?? "(not yet saved)"}`;

  const lines = [
    `Surface:  ${request.surface}`,
    `Reason:   ${request.reason} (${REPORT_REASON_LABEL[request.reason]})`,
    `Target:   ${target}`,
    `Raised:   ${reportedAt}`,
  ];
  if (request.note?.trim()) lines.push("", "What they wrote:", request.note.trim());
  if (request.surface === "coach") {
    lines.push("", "Reported text:", request.excerpt);
  }

  return {
    // The reason is in the subject so a child-safety report is distinguishable
    // from a wrong-read complaint without opening the mail.
    subject: `Vollyio content report: ${request.reason}`,
    text: [
      "Someone reported content in Vollyio. This is the moderation queue.",
      "",
      ...lines,
      "",
      "Review:",
      "  select * from content_reports where reviewed_at is null order by created_at desc;",
      "",
      "Close it by writing reviewed_at and action_taken on the row.",
    ].join("\n"),
  };
}

// The arguments submit_content_report takes, built from a validated request.
// Every parameter is named even when null: a positional gap against a function
// with seven defaulted arguments is the kind of mistake that silently files a
// report against the wrong target.
export function reportRpcArgs(request: ReportRequest): {
  p_surface: ReportRequest["surface"];
  p_reason: ReportReason;
  p_note: string | null;
  p_excerpt: string | null;
  p_analysis_id: string | null;
  p_coach_session_id: string | null;
  p_share_token: string | null;
} {
  return {
    p_surface: request.surface,
    p_reason: request.reason,
    p_note: request.note?.trim() || null,
    p_excerpt: request.surface === "coach" ? request.excerpt : null,
    p_analysis_id: request.surface === "analysis" ? request.analysis_id : null,
    p_coach_session_id:
      request.surface === "coach" ? (request.coach_session_id ?? null) : null,
    p_share_token: request.surface === "shared_analysis" ? request.token : null,
  };
}
