import { MONTHLY_ALLOWANCE, PLAN_LABEL, PRO_PRICE_LABEL } from "./plans.ts";

// The purchasable shapes of Pro. Every one of them grants the SAME plan, `pro`,
// and therefore the same allowance: they differ only in how often the card is
// charged and how much. Nothing downstream of the webhook needs to know which
// one was bought, which is why `profiles.plan` stays a two-value column and no
// migration comes with this file.
//
// Deliberately NOT `server-only`. The picker is a client component and needs
// the labels; what must never reach the browser is the provider price id, and
// that lives in lib/stripe.ts behind the env vars, keyed by the strings here.
// Splitting it this way means a client import can leak a price LABEL, which is
// already printed on the page, and can never leak a price ID.

export const OFFER_KEYS = ["weekly", "monthly", "downsell"] as const;
export type OfferKey = (typeof OFFER_KEYS)[number];

export function isOfferKey(value: unknown): value is OfferKey {
  return typeof value === "string" && (OFFER_KEYS as readonly string[]).includes(value);
}

export type Offer = {
  key: OfferKey;
  /** Name of the env var holding this offer's provider price id. */
  envVar: string;
  /** What the player is charged, for display only. The provider is the authority. */
  priceLabel: string;
  /** The billing period, singular, as it appears mid-sentence. */
  period: string;
  /** Short label for the picker control. */
  choiceLabel: string;
  /**
   * Whether the picker lists it. The downsell is false on purpose: it is the
   * exit-intent offer and listing it beside the others would make the $29.99
   * the price nobody ever pays. See the note in docs about it being reachable
   * anyway by anyone who reads the network tab; that is inherent to a
   * client-triggered downsell, not a hole this flag pretends to close.
   */
  selectable: boolean;
};

// The monthly label is imported rather than retyped, because `PRO_PRICE_LABEL`
// is already quoted into the Terms and the checkout page. Two strings for one
// price is the exact shape of the bug where the Terms promise one number and
// the card charges another.
export const OFFERS: Record<OfferKey, Offer> = {
  weekly: {
    key: "weekly",
    envVar: "STRIPE_PRICE_WEEKLY",
    priceLabel: "$7.99/wk",
    period: "week",
    choiceLabel: "Weekly",
    selectable: true,
  },
  monthly: {
    key: "monthly",
    envVar: "STRIPE_PRICE_MONTHLY",
    priceLabel: PRO_PRICE_LABEL,
    period: "month",
    choiceLabel: "Monthly",
    selectable: true,
  },
  downsell: {
    key: "downsell",
    envVar: "STRIPE_PRICE_DOWNSELL",
    priceLabel: "$19.99/mo",
    period: "month",
    choiceLabel: "Monthly",
    selectable: false,
  },
};

/** The offer a purchase surface starts on when the player has chosen nothing. */
export const DEFAULT_OFFER: OfferKey = "monthly";

export const SELECTABLE_OFFERS: readonly Offer[] = OFFER_KEYS.map((k) => OFFERS[k]).filter(
  (o) => o.selectable,
);

/**
 * The renewal disclosure, built from the offer rather than typed per surface.
 *
 * This exists because the same sentence has to appear in three places that used
 * to be written independently: the plan card, the provider's hosted page, and
 * the Terms. When only a monthly price existed, "each month" was safe to
 * hardcode; with a weekly price it becomes a false statement on two of those
 * three surfaces, and the one place a false renewal statement is most expensive
 * is the one taking the card.
 */
export function renewalSentence(offer: Offer): string {
  // The ALLOWANCE is quoted here as well as the price, and it is deliberately
  // the same figure for every offer: cadence changes what the card is charged
  // and how often, never what the plan grants. Dropping it was tried and
  // `lib/stripe.test.ts` refused the change - correctly, because a disclosure
  // that names a price without naming what it buys is worse than the one it
  // replaced.
  return (
    `${PLAN_LABEL.pro} is ${offer.priceLabel} for ${MONTHLY_ALLOWANCE.pro} analyses a ` +
    `month. It renews automatically at ${offer.priceLabel} every ${offer.period} until ` +
    `you cancel. Cancel any time in Settings; you keep ${PLAN_LABEL.pro} to the end of ` +
    `the ${offer.period} you paid for, and unused time is not refunded.`
  );
}
