import "server-only";
import { Resend } from "resend";

// Sender lives on the send.vollyio.com subdomain, not the apex: the apex SPF and
// DKIM records belong to the support mailbox provider, and a separate subdomain
// keeps product mail from borrowing or damaging that reputation.
export const MAIL_FROM = process.env.RESEND_FROM ?? "Vollyio <noreply@send.vollyio.com>";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

let cached: Resend | null = null;

function mailer(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!cached) {
    cached = new Resend(process.env.RESEND_API_KEY);
  }
  return cached;
}

// Returns a result instead of throwing so a caller on a user-facing path can
// decide whether a failed send is fatal. An unset key is a normal local state,
// not a crash: it reports as a failed send and nothing leaves the machine.
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const client = mailer();
  if (!client) return { ok: false, error: "email is not configured" };

  try {
    const { data, error } = await client.emails.send({
      from: MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "email provider returned no id" };
    return { ok: true, id: data.id };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "email send failed" };
  }
}
