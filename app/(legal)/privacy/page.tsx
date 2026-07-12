import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Sideout handles your account, your film, and your analysis data.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE = "July 12, 2026";

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
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-chalk-dim">
        Sideout analyzes volleyball technique from film you choose to record or
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
          you record or upload for analysis, still frames extracted from them,
          and the motion-tracking measurements computed from those frames.
        </p>
        <p>
          <strong className="text-chalk">Your training record.</strong> Scores,
          breakdowns, insights, goals, streaks, XP, and your conversations with
          the coach chat.
        </p>
        <p>
          <strong className="text-chalk">Technical basics.</strong> Cookies
          used to keep you signed in. We do not use advertising trackers or
          third-party analytics on Sideout.
        </p>
      </Section>

      <Section title="How we use your film">
        <p>
          When you submit a rep, still frames and motion measurements from your
          clip are sent to our servers and processed by the coaching service to
          produce your breakdown: the scores, timestamped insights, and the
          priority fix you see. Your clip and its frames are stored privately
          against your account so you can review past reps.
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
          We share data only with the service providers we use to run Sideout
          (hosting, storage, and the coaching service that generates your
          breakdown), and only as needed to provide the product. They process
          it on our behalf and are not permitted to use it for their own
          advertising. We never sell your personal information. We may disclose
          information if the law requires it.
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          We keep your data for as long as your account is active so your
          history and rating stay intact. To delete specific footage or your
          entire account and everything attached to it, email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          from your account address and we will complete the deletion within 30
          days.
        </p>
      </Section>

      <Section title="Age requirements">
        <p>
          Sideout is not directed to children under 13, and we do not knowingly
          collect data from them. If you are under 18, use Sideout with the
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
          Sideout is built.
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
          version here with a new effective date and note the change in the
          app. Questions or requests:{" "}
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
