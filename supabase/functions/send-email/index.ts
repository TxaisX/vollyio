// Every auth email Vollyio sends.
//
// Supabase's built-in mailer is capped at 2 emails an hour and its templates
// live in a dashboard field where nothing reviews them. Routing auth mail
// through the Send Email Hook moves delivery to Resend and the copy into this
// file, where it ships with the commit that changed it.
//
// Authorization is the webhook signature, not a JWT: Supabase Auth signs the
// payload with the hook secret and presents no user token, so this deploys
// with verify_jwt disabled and refuses anything that fails verification. The
// secret arrives as "v1,whsec_<base64>" and the library wants it without that
// prefix.
//
// The link points at the app's own /auth/callback rather than the project's
// /auth/v1/verify, because the callback route already exchanges token_hash for
// a session and sets the cookies the server-rendered app reads.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "npm:standardwebhooks@^1";
import { Resend } from "npm:resend@^6";

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_hash_new?: string;
};

type HookPayload = {
  user: { email: string; user_metadata?: { display_name?: string } };
  email_data: EmailData;
};

const NAVY = "#0f212c";
const NAVY_LIGHT = "#16303f";
const CHALK = "#f2efe6";
const CHALK_DIM = "#b9c4c9";
const GOLD = "#e8b93b";

// Auth rejects the hook response outright if it is not declared as JSON
// (hook_payload_invalid_content_type), and Deno defaults to text/plain.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const COPY: Record<string, { subject: string; lead: string; cta: string }> = {
  // This one has a single job, the tap, so the payoff sits in the body and the
  // subject stays plain. A confirmation mail that reads like marketing gets
  // filtered, and the reader is looking for a button, not a pitch.
  signup: {
    subject: "Confirm your Vollyio account",
    lead: "Tap below to confirm your email. Then film one rep, ten seconds, any skill, and you get it scored the way a coach scores it.",
    cta: "Confirm my email",
  },
  invite: {
    subject: "You have been invited to Vollyio",
    lead: "Someone set up a Vollyio account for you. Accept the invite to pick a password and start filming.",
    cta: "Accept the invite",
  },
  magiclink: {
    subject: "Your Vollyio sign-in link",
    lead: "Here is your sign-in link. It expires shortly, so use it while it is fresh.",
    cta: "Sign in",
  },
  recovery: {
    subject: "Reset your Vollyio password",
    lead: "Use the link below to set a new password. If you did not ask for this, you can ignore this email and nothing changes.",
    cta: "Set a new password",
  },
  email_change: {
    subject: "Confirm your new Vollyio email",
    lead: "Confirm this address to finish moving your account to it.",
    cta: "Confirm the change",
  },
  email: {
    subject: "Confirm your Vollyio email",
    lead: "Confirm this address to finish setting up your account.",
    cta: "Confirm my email",
  },
};

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(greeting: string, lead: string, cta: string, link: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:${NAVY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:${NAVY_LIGHT};border-radius:14px;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 24px;color:${GOLD};font-size:15px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Vollyio</p>
      <p style="margin:0 0 12px;color:${CHALK};font-size:20px;font-weight:600;">${escape(greeting)}</p>
      <p style="margin:0 0 28px;color:${CHALK_DIM};font-size:16px;line-height:1.6;">${escape(lead)}</p>
      <a href="${escape(link)}" style="display:inline-block;padding:13px 26px;background:${GOLD};color:${NAVY};font-size:16px;font-weight:700;text-decoration:none;border-radius:9px;">${escape(cta)}</a>
      <p style="margin:28px 0 0;color:${CHALK_DIM};font-size:13px;line-height:1.6;">If the button does not work, paste this into your browser:<br><span style="color:${CHALK};word-break:break-all;">${escape(link)}</span></p>
    </td></tr>
  </table>
</body></html>`;
}

function plain(greeting: string, lead: string, link: string): string {
  return `${greeting}\n\n${lead}\n\n${link}\n\nVollyio`;
}

// Secure email change sends a second confirmation to the old address using
// token_hash_new. The app exposes no email-change surface today, so this
// handles the single-confirmation case and leaves that path unbuilt.
function confirmLink(data: EmailData): string {
  const base = new URL(data.redirect_to || data.site_url);
  const link = new URL("/auth/callback", base.origin);
  link.searchParams.set("token_hash", data.token_hash);
  link.searchParams.set("type", data.email_action_type);
  return link.toString();
}

Deno.serve(async (req: Request) => {
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("RESEND_FROM") ?? "Vollyio <noreply@send.vollyio.com>";
  if (!hookSecret || !apiKey) {
    return json({ error: "not configured" }, 503);
  }

  const raw = await req.text();
  let payload: HookPayload;
  try {
    const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return json({ error: "bad signature" }, 401);
  }

  const { user, email_data: data } = payload;
  const action = data.email_action_type;

  // A 6-digit code, no link: the caller is already signed in and reconfirming.
  if (action === "reauthentication") {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: user.email,
      subject: "Your Vollyio confirmation code",
      text: `Your confirmation code is ${data.token}.\n\nIt expires shortly. If you did not ask for it, ignore this email.\n\nVollyio`,
    });
    if (error) {
      console.error(`[send-email] action=${action} failed: ${error.message}`);
      return json({ error: "send failed" }, 502);
    }
    return json({});
  }

  const copy = COPY[action];
  if (!copy) {
    // Auth grew an email type this function does not know. Fail loudly rather
    // than dropping it: Supabase retries, and the log names the gap.
    console.error(`[send-email] unhandled action=${action}`);
    return json({ error: `unhandled action ${action}` }, 400);
  }

  // A bare "Hey," is not a greeting, it is a gap where a name should be, and it
  // is the first line of the first thing a new player reads. The name comes off
  // the auth metadata written at signup, which settings mirrors on every rename
  // so this stays populated for accounts that change it later.
  const name = user.user_metadata?.display_name?.trim();
  const greeting = name ? `Hey ${name},` : "Hey there,";
  const link = confirmLink(data);

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: user.email,
    subject: copy.subject,
    html: layout(greeting, copy.lead, copy.cta, link),
    text: plain(greeting, copy.lead, link),
  });

  if (error) {
    console.error(`[send-email] action=${action} failed: ${error.message}`);
    return json({ error: "send failed" }, 502);
  }

  return json({});
});
