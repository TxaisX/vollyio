import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Vollyio handles your account, your film, and your analysis data.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE = "July 28, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-chalk-dim">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Effective {EFFECTIVE}
      </p>
      <h1 className="mt-3 font-display text-page-title md:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-chalk-dim">
        Vollyio analyzes volleyball technique from film you choose to record or
        upload. This policy explains, in plain language, what we collect, what
        we do with it, and the choices you have. The short version: your film
        is private to your account, we don&rsquo;t sell your data, and we
        don&rsquo;t run ad trackers.
      </p>

      <Section title="What we collect">
        <p>
          <strong className="text-chalk">Account information.</strong> Your
          email address and password credentials, used to create and secure
          your account.
        </p>
        <p>
          <strong className="text-chalk">Your film.</strong> Clips and photos
          you record or upload for analysis.
        </p>
        <p>
          <strong className="text-chalk">Your training record.</strong> Scores,
          breakdowns, insights, goals, streaks, XP, and, if we turn on coach
          chat, your conversations with it.
        </p>
        <p>
          <strong className="text-chalk">Billing details.</strong> If you
          upgrade to Pro, we store a few things about your subscription: which
          plan you are on, the date your plan renews, when the last billing
          update reached us, and two code numbers the payment provider uses to
          find your account and your subscription. Your card details never
          reach Vollyio&rsquo;s servers. Checkout happens on a page hosted by
          the payment provider, and that is where you enter them.
        </p>
        <p>
          <strong className="text-chalk">Content reports.</strong> If you report
          a breakdown, a coach answer, or a shared page, we store the category
          you chose, any note you wrote, a copy of the text you reported, and
          what the report was about. If you were signed in we store who you are,
          so we can tell you what happened; the report control on a shared page
          takes no account and files no identity. We keep reports after the
          content is gone, and after a reporting account is deleted, because a
          report is about someone else&rsquo;s content and a safety record that
          can be erased by the person it concerns is not a record.
        </p>
        <p>
          <strong className="text-chalk">Technical basics.</strong> Cookies
          used to keep you signed in, and basic page-view counts from our
          hosting provider so we can see which pages get used. We do not use
          advertising trackers, and we do not build a profile of you.
        </p>
      </Section>

      <Section title="How we use your film">
        <p>
          When you submit a rep, the whole clip is sent to our servers and on to
          the coaching service that reads it, which is how your breakdown is
          produced: the score, the checkpoints, and the priority fix you see. We
          instruct that service not to keep your footage or learn from it. Your
          clip is stored privately against your account so you can review past
          reps.
        </p>
        <p>
          Your footage is visible only to your account. We do not publish it,
          share it with other users, or use it in marketing.
        </p>
      </Section>

      <Section title="Training future features is opt-in">
        <p>
          The first time you analyze a rep, we ask whether your clips and
          extracted frames may help train future analysis features. This is
          off unless you turn it on, saying no changes nothing about how the
          product works for you, and you can change your answer at any time
          from your dashboard.
        </p>
      </Section>

      <Section title="Who we share data with">
        <p>
          We share data only with the service providers we use to run Vollyio
          (hosting, storage, the coaching service that generates your
          breakdown, the payment provider that handles subscriptions, and the
          provider that delivers our email), and only as needed to provide the
          product. They process it on our behalf and are not permitted to use
          it for their own advertising. We never sell your personal
          information. We may disclose information if the law requires it.
        </p>
        <p>
          The payment provider receives your email address, so it can attach
          the subscription to you on its side, and the payment details you
          enter on its own checkout page. It does not receive your film, your
          frames, or your analysis history. The email provider receives your
          email address and the message we are sending you, and nothing else.
        </p>
        {/* Required disclosure, not optional. Cloudflare makes referencing the
            Turnstile Privacy Addendum a CONDITION of running the widget in
            invisible mode, which is the mode vollyio uses (D-104). If the
            widget mode ever changes away from invisible this paragraph should
            still stay, because the processing it describes still happens. */}
        <p>
          Our sign-up and log-in pages run an invisible bot check from
          Cloudflare (Turnstile) to stop automated accounts. It runs silently,
          asks you to do nothing, and never sees your film or your analysis
          history. To decide whether a visitor is automated it reads signals
          from your browser such as your IP address and browser identifiers.
          Cloudflare describes exactly what it collects and why in its{" "}
          <a
            href="https://www.cloudflare.com/turnstile-privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
          >
            Turnstile Privacy Addendum
          </a>
          .
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          We keep your data for as long as your account is active so your
          history and rating stay intact. You can delete your entire account
          and everything attached to it yourself: Dashboard, Settings, Delete
          account. To delete specific footage only, or if you prefer email,
          contact{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          from your account address and we will complete the deletion within 30
          days.
        </p>
        <p>
          Billing records work a little differently. While a Pro subscription is
          on file, deleting your account is refused, because deleting it here
          would not stop the subscription and you would keep being charged for
          an account you can no longer sign into. That block stays in place
          through the run-out period after you cancel, when your plan is still
          Pro. Cancel in Settings first, then delete once your plan returns to
          Free, or write to support and we will delete it for you sooner. When
          the account goes, the billing details listed above go with it. The
          payment provider still keeps its own record of the payments you made,
          because the law requires it to keep financial records, and that record
          is not ours to erase.
        </p>
      </Section>

      <Section title="Age requirements">
        <p>
          Vollyio is not directed to children under 13, and we do not knowingly
          collect data from them. If you are under 18, use Vollyio with the
          knowledge and permission of a parent or guardian. If you believe a
          child under 13 has created an account, contact us and we will delete
          it.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Your data is encrypted in transit, and footage and analysis records
          are access-scoped to your account. No system is perfectly secure, but
          limiting what we collect and who can see it is the core of how
          Vollyio is built.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can request a copy of your data, correct it, or delete it at any
          time by contacting us. Depending on where you live, you may have
          additional rights under laws such as the GDPR or CCPA; we honor
          access, correction, deletion, and portability requests from everyone,
          regardless of jurisdiction.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If we change this policy in a way that matters, we will post the new
          version here with a new effective date and email the address on your
          account. Questions or requests:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
