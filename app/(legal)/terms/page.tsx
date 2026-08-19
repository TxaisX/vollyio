import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";
import { OFFERS } from "@/lib/offers";
import {
  MONTHLY_ALLOWANCE,
  SIGNUP_GRANT,
  PLAN_LABEL,
  PRO_PRICE_LABEL,
} from "@/lib/plans";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement that governs your use of Vollyio.",
  alternates: { canonical: "/terms" },
};

// Bumped 2026-08-11 for the objectionable-content and reporting sections. The
// "Changes to these terms" section below promises existing account holders an
// email when a material change lands, and that email is owed for this one.
const EFFECTIVE = "August 11, 2026";

// The price as a bare amount, for the sentences where "$9.99/mo every month"
// would read wrong. Derived from the same constant the plan card and the limit
// offer quote, rather than retyped here, because a stale number on this page is
// a false statement about money in the document that governs the charge.
const PRO_PRICE = PRO_PRICE_LABEL.replace("/mo", "");
// Quoted from the offer catalog, never retyped: a price in the Terms that
// disagrees with the price the card is charged is a false statement in a legal
// document, which is the same trap the SIGNUP_GRANT comment in lib/plans.ts
// records having already sprung once.
const WEEKLY_PRICE = OFFERS.weekly.priceLabel;
const DOWNSELL_PRICE = OFFERS.downsell.priceLabel;

// The short-term wall from migration 028 (`consume_api_quota`, scope 'analyze').
// Stated on this page because the monthly count is not the only thing that can
// refuse a rep, and a page that reads as an exhaustive account of refusals must
// not leave one out.
const HOURLY_ANALYSIS_LIMIT = 20;

// Advance notice before a price change binds an existing subscriber. Email is
// the channel because email is the only notice channel the product actually
// has; there is no in-app change-notice surface to promise.
const PRICE_NOTICE_DAYS = 30;

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
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
        Effective {EFFECTIVE}
      </p>
      <h1 className="mt-3 font-display text-page-title md:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-chalk-dim">
        These terms are the agreement between you and Vollyio when you use the
        service. By creating an account or analyzing a rep, you accept them.
        How we handle your data is covered separately in the{" "}
        <Link
          href="/privacy"
          className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <Section title="The short version">
        <p>
          <strong className="text-chalk">What you get.</strong> Vollyio scores
          one rep from a short clip and hands you the single highest-leverage
          fix. {PLAN_LABEL.free} costs nothing and needs no payment card.
        </p>
        <p>
          <strong className="text-chalk">What {PLAN_LABEL.pro} costs.</strong>{" "}
          {PRO_PRICE} a month, in US dollars, for a larger allowance of
          analyses. A weekly option is also offered at {WEEKLY_PRICE}, and a
          reduced monthly rate of {DOWNSELL_PRICE} is sometimes offered; both
          buy exactly the same {PLAN_LABEL.pro} allowance and differ only in
          what you pay and how often. The price you are shown before you
          confirm is the price you are charged. There is no free trial and no
          annual plan.
        </p>
        <p>
          <strong className="text-chalk">When you are charged.</strong> The
          first charge is taken at checkout, then on that same date every
          billing period until you cancel: every month on a monthly plan, every
          week on the weekly one.
        </p>
        <p>
          <strong className="text-chalk">How to stop.</strong> Cancel yourself
          in Settings, any time. You keep {PLAN_LABEL.pro} until the end of the
          period you already paid for.
        </p>
        <p>The rest of this page is the detail behind those four answers.</p>
      </Section>

      <Section title="Who can use Vollyio">
        <p>
          Vollyio is for anyone who plays volleyball. You must be at least 13
          years old to create an account, and you confirm that you are when you
          sign up. We do not knowingly accept accounts from anyone under 13, and
          if we learn an account belongs to someone younger we will close it and
          delete its footage.
        </p>
      </Section>

      <Section title="What Vollyio is, and is not">
        <p>
          Vollyio scores your volleyball technique from a clip you upload, and
          names what it saw at each checkpoint of that skill. It is a training
          aid, not a substitute for a qualified coach, athletic trainer, or
          medical professional.
        </p>
        <p>
          Scores and insights are estimates produced by automated analysis.
          They can be wrong. Because every note says what was seen, you can
          play the rep back and judge it yourself; treat the output as a
          second opinion, not ground truth.
        </p>
        <p>
          Volleyball is a physical activity that carries risk of injury. Train
          within your own limits. Use safe conditions and equipment. Ask a
          professional before acting on anything you doubt. Volleyball can hurt
          you, and to the extent permitted by law that risk is yours.
        </p>
      </Section>

      <Section title="Your film stays yours">
        <p>
          You own the clips and photos you submit. You grant Vollyio a limited
          license to store and process them solely to provide the service to
          you: generating your breakdowns, showing your history, and, if we
          turn on coach chat, powering your conversations with it. Use of your
          footage to train future analysis features happens only if you opt in,
          as described in the Privacy Policy.
        </p>
        <p>
          Only submit film you have the right to use. If other people appear in
          your clips, it is your responsibility to have their permission to
          film them.
        </p>
      </Section>

      <Section title="Plans and prices">
        <p>
          Vollyio has two plans. They differ in how many reps you can analyze
          in a month. If we ever add another difference between them, it will
          be described here.
        </p>
        <p>
          <strong className="text-chalk">{PLAN_LABEL.free}.</strong>{" "}
          {SIGNUP_GRANT} completed analyses when the account is created, then{" "}
          {MONTHLY_ALLOWANCE.free} completed analysis per calendar month, at no
          cost and with no payment card. The {SIGNUP_GRANT} are granted once
          against the life of the account rather than once per month: whichever
          months you use them in, the account settles at{" "}
          {MONTHLY_ALLOWANCE.free} a month once {SIGNUP_GRANT} completed
          analyses exist on it, and deleting analyses does not restore them.
        </p>
        <p>
          <strong className="text-chalk">{PLAN_LABEL.pro}.</strong>{" "}
          {MONTHLY_ALLOWANCE.pro} completed analyses per subscription month, for{" "}
          {PRO_PRICE_LABEL}. Your month starts on the day you subscribe and
          refills on that date, not on the 1st.
        </p>
        <p>
          <strong className="text-chalk">
            Monthly limits are not switched on at all times.
          </strong>{" "}
          While they are off, nobody is counted, both plans are unmetered, and{" "}
          {PLAN_LABEL.pro} does not buy you extra analyses for that period. What
          it does is set your allowance at {MONTHLY_ALLOWANCE.pro} a month for
          when counting starts, against {MONTHLY_ALLOWANCE.free} on{" "}
          {PLAN_LABEL.free} once the starter analyses are gone, and support the
          product early. The Plan card in
          Settings always says which of the two is true today, and limits
          starting to count is a change we make under the notice section below.
        </p>
        <p>
          Prices are in US dollars. The amount shown is the amount charged, and
          nothing is added on top at checkout. If your bank is outside the US it
          converts that amount and may add its own fee, so your statement can
          read differently from the price here.
        </p>
        <p>
          There is no free trial, no annual plan, no credit packs or one-off
          purchases, and no team or coach plan.
        </p>
      </Section>

      <Section title="Your subscription renews automatically">
        <p>
          <strong className="text-chalk">
            {PLAN_LABEL.pro} renews by itself. It charges {PRO_PRICE} every
            month, automatically, to the payment method you have on file, and
            it keeps doing that until you cancel it.
          </strong>{" "}
          There is no minimum term and no cancellation fee, and the next
          section says exactly how to stop it.
        </p>
        <p>
          The first charge is taken at checkout. After that you are charged on
          that same date each billing period, monthly or weekly depending on
          the plan you chose, and that is also the date your analyses reset:
          one clock, not two. Your subscription details, including the date of
          your next charge, are on the payment provider&rsquo;s billing page,
          which Settings opens.
        </p>
        <p>
          If you are under 18, the parent or guardian who agreed to these terms
          has to be the one who starts the subscription and authorizes the
          payment, using their own payment method or one they have given you
          permission to use.
        </p>
        <p>
          Checkout happens on the payment provider&rsquo;s page, not ours. You
          can pay by card, by a phone wallet, straight from a bank account, or
          through one of the pay-later services, whichever the provider offers
          you at checkout. Your card number never reaches Vollyio.
        </p>
        <p>
          What we keep on our side is which plan you are on, your renewal date,
          when the last billing update reached us, and two code numbers the
          provider uses to find your account and your subscription. None of
          those is a card detail.
        </p>
      </Section>

      <Section title="How to cancel">
        <p>
          Cancel {PLAN_LABEL.pro} yourself, online, at any time: Settings in
          your dashboard, the Plan card, the Manage plan button. That opens the
          payment provider&rsquo;s own billing page, and the button to cancel
          is there.
        </p>
        <p>
          You never have to email us, call us, or sit through a retention offer
          to cancel. If the billing page will not open for you, write to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          and we will cancel it for you.
        </p>
        <p>
          Cancelling stops the next charge. You keep {PLAN_LABEL.pro} until the
          end of the period you already paid for, then your plan goes back to{" "}
          {PLAN_LABEL.free}. There is no partial refund for the days you did
          not use.
        </p>
        <p>
          Cancelling does not reset the period&rsquo;s usage. Once monthly
          limits are counting, analyses you already ran still count, so if you
          ran more than {MONTHLY_ALLOWANCE.free} of them before landing back on{" "}
          {PLAN_LABEL.free}, you will have none left until that count next
          resets. On {PLAN_LABEL.free} that is the 1st. The starter analyses do
          not return on cancellation: an account that has ever completed{" "}
          {SIGNUP_GRANT} of them is past that grant permanently.
        </p>
      </Section>

      <Section title="If a renewal payment fails">
        <p>
          If a monthly charge is declined, the payment provider retries it over
          the following few days, and {PLAN_LABEL.pro} keeps working while it
          does. Most retries succeed, so a card that expires on a Tuesday does
          not cost you the rest of your month.
        </p>
        <p>
          Update your payment details on the billing page you open from
          Settings and the next retry goes through. If the retries run out, the
          subscription ends and your plan goes back to {PLAN_LABEL.free}.
        </p>
      </Section>

      <Section title="How many analyses you get, and when they reset">
        <p>
          This section describes how counting works in the periods when monthly
          limits are switched on.
        </p>
        <p>
          <strong className="text-chalk">
            On {PLAN_LABEL.pro}, your allowance runs on the month you paid for.
          </strong>{" "}
          It resets on your renewal date, the same date you are charged, not on
          the 1st. Subscribe on the 20th and your count refills on the 20th of
          each month. Your renewal date is on the payment provider&rsquo;s
          billing page, which Settings opens.
        </p>
        <p>
          <strong className="text-chalk">
            On {PLAN_LABEL.free}, there is no purchase to date it from,
          </strong>{" "}
          so the allowance runs on the calendar month in UTC and resets on the
          1st. If you cancel {PLAN_LABEL.pro} and later land back on{" "}
          {PLAN_LABEL.free}, your count goes back to the 1st with it.
        </p>
        <p>
          Changing plan does not reset the count, in either direction. Upgrading
          part-way through a period does not wipe what you have already used: in
          that first period you get {MONTHLY_ALLOWANCE.pro} minus whatever you
          had already run before upgrading, and the full{" "}
          {MONTHLY_ALLOWANCE.pro} starts on your first renewal date. Cancelling
          works the same way, as described above.
        </p>
        <p>
          Only completed analyses count. A clip that fails, times out, or hits
          a capacity outage does not count against your allowance, because we
          count the breakdowns we actually saved for you rather than the
          attempts you made. A retry may need a minute or two before it will
          start.
        </p>
        <p>
          There is also a short-term limit, on every plan and whether or not
          monthly limits are on: no more than {HOURLY_ANALYSIS_LIMIT} analyses
          in an hour, and one running at a time. It is there to keep the
          service up. In practice the monthly allowance is the limit you will
          feel first. The hourly wall only matters if you spend a large share
          of a month&rsquo;s {MONTHLY_ALLOWANCE.pro} analyses in one sitting,
          and then the next rep waits for the hour to turn over rather than
          being lost.
        </p>
        <p>Analyses you do not use do not carry into the next month.</p>
      </Section>

      <Section title="Refunds">
        <p>
          <strong className="text-chalk">
            Payments are not refundable, and we do not refund unused time.
          </strong>{" "}
          If you decide {PLAN_LABEL.pro} is not for you, cancel: you keep it
          until the end of the period you already paid for, and you are not
          charged again. We do not refund a period you have started, whether or
          not you used the analyses in it.
        </p>
        <p>
          The exception is a charge that should never have been taken, which we
          correct in full: a duplicate charge, a charge taken after you had
          already confirmed a cancellation, a charge on an account that never
          got access, and a subscription started by someone under 18 on an
          adult&rsquo;s payment method without that adult&rsquo;s permission.
          That is us fixing our own billing error, not a change-of-mind refund.
        </p>
        <p>
          Write to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          and tell us what happened. We answer support email within two
          business days. If you think a charge is wrong, write to us before
          disputing it with your bank, because we can usually fix it faster
          than a dispute can.
        </p>
        <p>
          None of this removes any right you have under the law where you live.
        </p>
      </Section>

      <Section title="If the price changes">
        <p>
          If we change the price of {PLAN_LABEL.pro} for people who are already
          subscribed, we will email the address on your account at least{" "}
          {PRICE_NOTICE_DAYS} days before the new price applies. You can cancel
          in Settings any time before then. Staying subscribed past that date
          means you accept the new price. A price change never applies to a
          period you have already paid for.
        </p>
      </Section>

      <Section title="Deleting your account while you are subscribed">
        <p>
          While a {PLAN_LABEL.pro} subscription is on file, we refuse to delete
          your account and ask you to cancel first. Deleting your account here
          does not cancel anything at the payment provider, so going ahead
          would leave a subscription running and charging you every month for
          an account you can no longer sign into.
        </p>
        <p>
          That block stays in place through the run-out period. After you
          cancel, your plan stays {PLAN_LABEL.pro} until the period you paid
          for ends, and deletion is refused for that time too. If you want your
          account and your film gone sooner than that, write to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          and we will do it for you.
        </p>
        <p>
          If you have just paid, wait until Settings shows you on{" "}
          {PLAN_LABEL.pro} before you delete anything. With some payment
          methods the money takes hours to move, and until it lands your
          account does not yet show the subscription.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Don&rsquo;t misuse the service: no attempting to access other
          users&rsquo; accounts or footage, no probing or disrupting the
          service, and no reselling access. We may suspend or terminate accounts
          that do.
        </p>
      </Section>

      <Section title="Content that is not allowed here">
        <p>
          This applies to everything you put into Vollyio and everything you
          publish out of it: the clips you upload, anything you write, and any
          breakdown you share by link. Do not submit or share:
        </p>
        <p>
          Sexual or sexually suggestive content. Content that sexualizes a
          minor in any way, or that puts a child at risk. Hate speech, or
          content that attacks or degrades a person or group. Bullying,
          harassment, or threats. Graphic violence, or content that encourages
          self-harm, dangerous acts, or illegal activity. Content that
          impersonates someone. Content that is deceptive or designed to
          mislead. Content that infringes someone else&rsquo;s rights.
        </p>
        <p>
          <strong className="text-chalk">Other people in your clips.</strong>{" "}
          Volleyball is a team sport played at public events, so teammates,
          opponents and spectators end up in almost every clip. That is normal
          and it is fine. Filming your own rep at a match or an open gym does
          not require you to get a release from everyone on the court.
        </p>
        <p>
          Three things are still on you. Do not film where filming is not
          allowed, which usually means a venue rule, a school or club policy, or
          a changing area. If someone tells you they do not want to be in your
          footage, take it down. And take real care with clips that feature
          somebody else&rsquo;s child rather than incidentally including them,
          because a shared link is public to anyone holding it and a junior
          player is not the one who decided to publish it.
        </p>
        <p>
          If you are in a clip on Vollyio and you want it gone, use the Report
          control on the page or write to us. You do not need an account and you
          do not have to explain yourself. We will take it down.
        </p>
        <p>
          We review reported content and we act on it. Depending on what we
          find, that can mean removing a clip, revoking a share link, closing an
          account, or reporting the matter to the authorities. We may do any of
          those without notice where someone is at risk.
        </p>
      </Section>

      <Section title="Reporting something">
        <p>
          Every breakdown, every coach answer, and every shared breakdown page
          carries a <strong className="text-chalk">Report</strong> control. You
          do not need an account to use the one on a shared page, so if someone
          sent you a link and the film in it should not be there, you can say so
          from the page itself.
        </p>
        <p>
          Tell us what is wrong: film of someone who did not agree to it, sexual
          content, hate or harassment, something violent or dangerous, something
          that puts a child at risk, something deceptive, or anything else. You
          can add a note. Reports reach us directly and we review them.
        </p>
        <p>
          You can also write to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
          >
            {SUPPORT_EMAIL}
          </a>
          , which is also the address to use if you believe content here
          infringes your copyright or shows you without your permission. We
          answer within two business days. If someone is in immediate danger,
          contact your local emergency services first; we cannot respond at that
          speed.
        </p>
      </Section>

      <Section title="What Vollyio&rsquo;s automated coaching is, and how it can be wrong">
        <p>
          Your breakdowns and your conversations with the coach are generated
          automatically. That means they can be mistaken, and occasionally they
          can produce something that reads badly or that you did not expect. We
          test against that, and the Report control above is how you tell us
          when we missed.
        </p>
        <p>
          Do not rely on automated coaching for medical, safety, or legal
          decisions. It scores volleyball technique from a clip, and that is all
          it is built to do.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can stop using Vollyio at any time, and delete your account
          yourself, subject to the cancel-first rule above. We may suspend or
          close accounts that violate these terms, and we will tell you why
          unless the law prevents it.
        </p>
        <p>
          If we close a paid account, we cancel the subscription as part of
          that, so nothing keeps charging you, and we refund the unused part of
          the period you had already paid for. That is the one case where
          unused time is refunded, and it exists because ending the plan was
          our decision rather than yours.
        </p>
      </Section>

      <Section title="Disclaimers and limitation of liability">
        <p>
          Vollyio is provided &ldquo;as is&rdquo; without warranties of any
          kind, express or implied. To the maximum extent permitted by law,
          Vollyio is not liable for indirect, incidental, or consequential
          damages arising from your use of the service. Our total liability for
          any claim is limited to the amount you paid us in the twelve months
          before the claim arose.
        </p>
        <p>
          In plain terms: Vollyio can get things wrong, and if something goes
          wrong, the most we can owe you is what you paid us in the last twelve
          months.
        </p>
        <p>
          Nothing in this section limits our liability for death or personal
          injury caused by our negligence, or for fraud. Some jurisdictions do
          not allow certain limitations, so parts of this section may not apply
          to you, and where you live may give you rights this cannot take away.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we make a material change to these terms, we will post the updated
          version here with a new effective date and email the address on your
          account. Continuing to use Vollyio after a change takes effect means
          you accept the updated terms.
        </p>
      </Section>

      <Section title="Who you are agreeing with, and whose law applies">
        <p>
          Vollyio is operated as a sole proprietorship based in California,
          United States. That means the counterparty to this agreement is a
          person rather than a company, and the service is provided by that
          person directly.
        </p>
        <p>
          These terms are governed by the laws of the State of California,
          without regard to its conflict-of-laws rules. Any dispute that is not
          resolved by writing to us first belongs in the state or federal courts
          located in Sacramento County, California, and you and we each agree to
          that venue. Nothing here takes away a right you have under the law
          where you live, including any right to bring a claim in your local
          small-claims court.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms, cancellations, deletion requests, or
          anything about a charge:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold-ink"
          >
            {SUPPORT_EMAIL}
          </a>
          . We answer within two business days.
        </p>
      </Section>
    </article>
  );
}
