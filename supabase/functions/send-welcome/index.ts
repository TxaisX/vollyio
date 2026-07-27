// The one welcome email, sent when a player's address is actually confirmed.
//
// It hangs off a trigger on auth.users rather than the signup action, because
// a confirmed address is the first moment the account is real and reachable.
// Sending it from the app would also mean sending it from whichever code path
// happened to run, and there are three (password signup, magic link, invite).
//
// Idempotence is a claim, not a check: the update only matches a profile whose
// welcome_email_sent_at is still null, so a re-fired trigger or a replayed
// request finds nothing to claim and sends nothing. The row is marked BEFORE
// the send, which trades a rare lost welcome for never sending two.
//
// Authorization mirrors purge-user-media: the gateway's verify_jwt means a
// caller needs a valid project key, and this additionally refuses any user who
// is not confirmed, so it can only ever finish something auth already did.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@^6";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NAVY = "#0f212c";
const NAVY_LIGHT = "#16303f";
const CHALK = "#f2efe6";
const CHALK_DIM = "#b9c4c9";
const GOLD = "#e8b93b";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LEAD =
  "Film one rep. Ten seconds, any skill, your phone propped on a bag. It comes back scored across six skills with the one fix that buys the most.";
const PROOF = "That is what yours looks like, about a minute after you upload.";
const TIP =
  "Best first rep: one clean attempt, filmed from the side, whole body in frame. One rep, not a rally.";

// The sample card is what sells the upload: promising a breakdown is weaker
// than showing one. It is labelled EXAMPLE on purpose. An unlabelled score in
// a welcome email reads as if we had already graded a rep they never filmed.
const SAMPLE_SKILL = "Attack";
const SAMPLE_SCORE = "74";
const SAMPLE_FIX = "Contact is behind your head. Toss six inches further into the court.";

function html(greeting: string, link: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:${NAVY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:${NAVY_LIGHT};border-radius:14px;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 24px;color:${GOLD};font-size:15px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Vollyio</p>
      <p style="margin:0 0 12px;color:${CHALK};font-size:22px;font-weight:600;">${escape(greeting)}</p>
      <p style="margin:0 0 24px;color:${CHALK_DIM};font-size:16px;line-height:1.6;">${escape(LEAD)}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${NAVY};border:1px solid rgba(242,239,230,0.12);border-radius:11px;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 14px;color:${CHALK_DIM};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Example breakdown</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="color:${CHALK};font-size:17px;font-weight:600;">${escape(SAMPLE_SKILL)}</td>
              <td align="right" style="color:${GOLD};font-size:30px;font-weight:700;line-height:1;">${escape(SAMPLE_SCORE)}</td>
            </tr>
          </table>
          <p style="margin:16px 0 6px;color:${GOLD};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Priority fix</p>
          <p style="margin:0;color:${CHALK};font-size:15px;line-height:1.6;">${escape(SAMPLE_FIX)}</p>
        </td></tr>
      </table>

      <p style="margin:20px 0 28px;color:${CHALK_DIM};font-size:15px;line-height:1.6;">${escape(PROOF)}</p>
      <a href="${escape(link)}" style="display:inline-block;padding:14px 28px;background:${GOLD};color:${NAVY};font-size:16px;font-weight:700;text-decoration:none;border-radius:9px;">Film your first rep</a>
      <p style="margin:28px 0 0;color:${CHALK_DIM};font-size:14px;line-height:1.6;border-left:2px solid ${GOLD};padding-left:14px;">${escape(TIP)}</p>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("RESEND_FROM") ?? "Vollyio <noreply@send.vollyio.com>";
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://vollyio.com";
  if (!serviceKey || !url || !apiKey) return json({ error: "not configured" }, 503);

  let userId = "";
  try {
    const body = await req.json();
    userId = String(body?.user_id ?? "");
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!UUID.test(userId)) return json({ error: "bad user_id" }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: found, error: lookupError } = await db.auth.admin.getUserById(userId);
  if (lookupError) return json({ error: "lookup failed" }, 503);
  const user = found?.user;
  if (!user?.email) return json({ error: "no such user" }, 404);
  if (!user.email_confirmed_at) return json({ error: "not confirmed" }, 403);

  const { data: claimed, error: claimError } = await db
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", userId)
    .is("welcome_email_sent_at", null)
    .select("display_name");

  if (claimError) return json({ error: "claim failed" }, 503);
  if (!claimed || claimed.length === 0) return json({ ok: true, skipped: "already sent" });

  const name = claimed[0]?.display_name?.trim();
  const greeting = name ? `You're in, ${name}.` : "You're in.";
  const link = `${siteUrl}/analyze`;

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: user.email,
    subject: "Your first rep is ten seconds away",
    html: html(greeting, link),
    text: [
      greeting,
      "",
      LEAD,
      "",
      `EXAMPLE BREAKDOWN`,
      `${SAMPLE_SKILL}: ${SAMPLE_SCORE}`,
      `Priority fix: ${SAMPLE_FIX}`,
      "",
      PROOF,
      "",
      link,
      "",
      TIP,
      "",
      "Vollyio",
    ].join("\n"),
  });

  if (error) {
    // The claim already landed, so this player will not get a second attempt.
    // Logged loudly because the only recovery is clearing the column by hand.
    console.error(`[send-welcome] user=${userId} failed: ${error.message}`);
    return json({ error: "send failed" }, 502);
  }

  console.log(`[send-welcome] user=${userId} sent`);
  return json({ ok: true });
});
