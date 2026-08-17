import { NextResponse } from "next/server";
import { readJsonRequest } from "@/lib/security/request";
import { mutationClient } from "@/lib/security/api-auth";
import {
  formatReportAlert,
  isReportStatus,
  reportOutcome,
  reportRequestSchema,
  reportRpcArgs,
  type ReportRequest,
} from "@/lib/content-report";

export const runtime = "nodejs";

// The in-app report endpoint (migration 060). Two Play policies require this to
// exist and one of them requires it to work WITHOUT an account, because the
// person best placed to report a public share page is the stranger who opened
// the link. So this route deliberately does not gate on a session: the SECURITY
// DEFINER function decides which surfaces an anonymous caller may reach, and it
// is the only thing that may decide that.
//
// A report is small. This ceiling is the 1000-char note plus the 2000-char
// excerpt plus the envelope, with room to spare and nowhere near enough to be
// used as storage.
const MAX_BODY_BYTES = 8 * 1024;

// Never awaited by the reporter. The report is already committed by the time
// this runs; a dead mailbox must cost the reporter nothing and must never turn
// a filed report into an error. Same posture as the budget alert, minus the
// interval claim, because reports are rate limited in SQL already.
async function alertOwner(request: ReportRequest): Promise<void> {
  try {
    const to = process.env.OWNER_ALERT_EMAIL?.trim();
    if (!to) return;
    const { sendEmail } = await import("@/lib/email");
    const { subject, text } = formatReportAlert(request, new Date().toISOString());
    const result = await sendEmail({ to, subject, text });
    if (!result.ok) {
      console.warn(`[report] owner alert not delivered: ${result.error}`);
    }
  } catch (cause) {
    console.warn(
      `[report] alert path failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
    );
  }
}

export async function POST(request: Request) {
  // Proves the credential without demanding one belong to somebody, which is
  // what keeps the anonymous share-page path above working (D-120). A native
  // reporter presents a bearer token and is a signed-in player; a stranger on
  // /share/<token> presents neither and stays anonymous, and the RPC decides
  // what that is allowed to reach.
  const caller = await mutationClient(request, { forbiddenMessage: "Bad request." });
  if (!caller.ok) return caller.response;
  const supabase = caller.supabase;

  const body = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!body.ok) {
    const status = body.error === "payload_too_large" ? 413 : 400;
    return NextResponse.json({ error: "That report could not be read." }, { status });
  }

  const parsed = reportRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    const { httpStatus, message } = reportOutcome("invalid");
    return NextResponse.json({ error: message }, { status: httpStatus });
  }

  const { data, error } = await supabase.rpc(
    "submit_content_report",
    reportRpcArgs(parsed.data),
  );

  // A database that answers with anything outside the status vocabulary is a
  // shape change, and the one failure mode this route must not have is telling
  // someone their report was filed when it was not.
  if (error || !isReportStatus(data)) {
    if (error) console.warn(`[report] rpc failed: ${error.message}`);
    return NextResponse.json(
      { error: "We could not file that right now. Try again shortly." },
      { status: 502 },
    );
  }

  const { httpStatus, message } = reportOutcome(data);
  if (data !== "ok") {
    return NextResponse.json({ error: message }, { status: httpStatus });
  }

  // Fire and forget, after the row exists.
  void alertOwner(parsed.data);

  return NextResponse.json({ ok: true, message }, { status: 200 });
}
