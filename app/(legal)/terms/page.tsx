import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement that governs your use of Vollyio.",
  alternates: { canonical: "/terms" },
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

export default function TermsPage() {
  return (
    <article>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Effective {EFFECTIVE}
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-chalk-dim">
        These terms are the agreement between you and Vollyio when you use the
        service. By creating an account or analyzing a rep, you accept them.
        How we handle your data is covered separately in the{" "}
        <Link
          href="/privacy"
          className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <Section title="Who can use Vollyio">
        <p>
          You must be at least 13 years old to create an account. If you are
          under 18, you may only use Vollyio with the permission of a parent or
          guardian, who agrees to these terms on your behalf.
        </p>
      </Section>

      <Section title="What Vollyio is, and is not">
        <p>
          Vollyio provides automated, evidence-cited feedback on volleyball
          technique from film you submit. It is a training aid, not a
          substitute for a qualified coach, athletic trainer, or medical
          professional.
        </p>
        <p>
          Scores and insights are estimates produced by automated analysis.
          They can be wrong. Every note is pinned to the frame it came from so
          you can judge it yourself; treat the output as a second opinion, not
          ground truth.
        </p>
        <p>
          Volleyball is a physical activity that carries risk of injury. You
          are responsible for training within your own limits, using safe
          conditions and equipment, and consulting a professional before acting
          on feedback if you have any doubt. To the extent permitted by law,
          you assume the risks inherent in physical training.
        </p>
      </Section>

      <Section title="Your film stays yours">
        <p>
          You own the clips and photos you submit. You grant Vollyio a limited
          license to store and process them solely to provide the service to
          you: generating your breakdowns, showing your history, and powering
          coach chat. Use of your footage to train future analysis features
          happens only if you opt in, as described in the Privacy Policy.
        </p>
        <p>
          Only submit film you have the right to use. If other people appear in
          your clips, it is your responsibility to have their permission to
          film them.
        </p>
      </Section>

      <Section title="Pricing">
        <p>
          Your first breakdown is free and requires no payment card. If we
          introduce paid plans or change what is included in the free tier, we
          will state the price in the app before you are asked to pay anything,
          and you will never be charged without explicitly signing up for a
          paid plan.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Don&rsquo;t misuse the service: no attempting to access other
          users&rsquo; accounts or footage, no probing or disrupting the
          service, no submitting unlawful content, and no reselling access.
          We may suspend or terminate accounts that do.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can stop using Vollyio and request deletion of your account at
          any time. We may suspend or close accounts that violate these terms,
          and we will tell you why unless the law prevents it.
        </p>
      </Section>

      <Section title="Disclaimers and limitation of liability">
        <p>
          Vollyio is provided &ldquo;as is&rdquo; without warranties of any
          kind, express or implied. To the maximum extent permitted by law,
          Vollyio is not liable for indirect, incidental, or consequential
          damages arising from your use of the service, and our total
          liability for any claim is limited to the amount you paid us in the
          twelve months before the claim arose. Some jurisdictions do not
          allow certain limitations, so parts of this section may not apply to
          you.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we make a material change to these terms, we will post the updated
          version here with a new effective date and note the change in the
          app. Continuing to use Vollyio after a change takes effect means you
          accept the updated terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms:{" "}
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
