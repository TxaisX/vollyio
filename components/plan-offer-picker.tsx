"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OFFERS, renewalSentence, type OfferKey } from "@/lib/offers";
import { PLAN_LABEL } from "@/lib/plans";

// Fires the downsell at most once per tab. sessionStorage and not localStorage:
// a player who closed the modal an hour ago in another session is a different
// visit, but one who dismissed it thirty seconds ago and scrolled back up is
// not, and re-opening it on the same page read is the behaviour that makes exit
// modals hated.
const SEEN_KEY = "vollyio:downsell-seen";

const ATTESTATION =
  "I am authorized to use this payment method and I understand this subscription renews until I cancel it.";

/**
 * The purchase control: pick a cadence, read what it costs, buy it.
 *
 * This is one client component rather than a picker plus the server-rendered
 * disclosure it used to sit under, because the disclosure has to CHANGE with
 * the selection. A server-rendered "renews each month" above a control that can
 * select a weekly subscription is not a stale string, it is the wrong renewal
 * terms on the surface that takes the card.
 */
export function PlanOfferPicker({
  offers,
  downsellAvailable,
  metered,
}: {
  /** Selectable offers this deployment has a configured price for. */
  offers: OfferKey[];
  /** Whether STRIPE_PRICE_DOWNSELL is set. No price, no modal. */
  downsellAvailable: boolean;
  metered: boolean;
}) {
  const [selected, setSelected] = useState<OfferKey>(offers[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attested, setAttested] = useState(false);
  const [downsell, setDownsell] = useState(false);
  // Read in the exit handler, which is registered once. Without the ref the
  // handler closes over the first render's `busy` forever and would pop the
  // modal over a checkout already in flight.
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!downsellAvailable) return;
    if (sessionStorage.getItem(SEEN_KEY)) return;

    // `clientY <= 0` with no relatedTarget is the pointer crossing the top edge
    // of the viewport, which is the only exit signal a page actually gets.
    // There is no mobile equivalent, and this product is mobile-first inside a
    // TWA, so this reaches desktop visitors and essentially nobody else. That
    // is a real limit of exit intent, not a bug in this handler.
    function onExit(event: MouseEvent) {
      if (event.clientY > 0 || event.relatedTarget) return;
      if (busyRef.current) return;
      sessionStorage.setItem(SEEN_KEY, "1");
      setDownsell(true);
    }

    document.addEventListener("mouseout", onExit);
    return () => document.removeEventListener("mouseout", onExit);
  }, [downsellAvailable]);

  async function buy(offer: OfferKey) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer }),
      });
      const body = (await res.json().catch(() => null)) as {
        url?: unknown;
        error?: unknown;
      } | null;
      // Only ever hand the browser an https destination our own server chose.
      // location.assign() will happily run a `javascript:` string.
      const url = typeof body?.url === "string" ? body.url : null;
      if (!res.ok || !url || !url.startsWith("https://")) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "That didn't work. Try again in a moment.",
        );
      }
      // No setBusy(false): the page is leaving.
      window.location.assign(url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const offer = OFFERS[selected];

  return (
    <>
      {offers.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="mt-4 flex gap-2"
        >
          {offers.map((key) => {
            const option = OFFERS[key];
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(key)}
                // border-line-control, not border-line: these are pressable and
                // their border is the only thing identifying them, which is the
                // exact case the 41% token exists for (WCAG 1.4.11).
                className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-gold bg-gold/10 text-chalk"
                    : "border-line-control text-chalk-dim hover:text-chalk"
                }`}
              >
                <span className="block font-display font-bold">
                  {option.choiceLabel}
                </span>
                <span className="block font-mono text-[11px]">
                  {option.priceLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Auto-renewal, price and how to stop, before the purchase rather than
          after it, which is what California's ARL asks for. */}
      <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
        {renewalSentence(offer)}
        {!metered &&
          " Limits are not switched on yet, so this is early support rather than more reps today."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-chalk-dim">
        By subscribing you agree to the{" "}
        <Link
          href="/terms"
          className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
        >
          Terms of Service
        </Link>
        .
      </p>

      <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-chalk-dim">
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
        />
        <span>{ATTESTATION}</span>
      </label>

      <button
        type="button"
        onClick={() => buy(selected)}
        disabled={busy || !attested}
        aria-busy={busy}
        className="btn-primary mt-4 min-h-11 text-sm disabled:opacity-40"
      >
        {busy ? "Opening…" : `Upgrade to ${PLAN_LABEL.pro}`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-coral">
          {error}
        </p>
      )}

      {downsell && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="downsell-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4"
        >
          <div className="card w-full max-w-sm p-5">
            <h3 id="downsell-heading" className="font-display text-lg font-bold">
              Stay for {OFFERS.downsell.priceLabel}
            </h3>
            {/* The lower price is permanent, and says so. A "first month"
                discount that silently reverts is where the refund requests and
                the chargebacks come from. */}
            <p className="mt-2 text-xs leading-relaxed text-chalk-dim">
              {renewalSentence(OFFERS.downsell)} This is the rate for as long as
              you stay subscribed, not an introductory month.
            </p>
            {/* The attestation gates this button exactly as it gates the one
                on the card. A downsell that skipped it would make the cheaper,
                more impulsive path the one with less disclosure, which is the
                opposite of what D-073 is for. */}
            {!attested && (
              <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-chalk-dim">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                />
                <span>{ATTESTATION}</span>
              </label>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => buy("downsell")}
                disabled={busy || !attested}
                aria-busy={busy}
                className="btn-primary min-h-11 text-sm disabled:opacity-40"
              >
                {busy
                  ? "Opening…"
                  : `Take ${OFFERS.downsell.priceLabel}`}
              </button>
              <button
                type="button"
                onClick={() => setDownsell(false)}
                className="btn-ghost min-h-11 text-sm"
              >
                No thanks
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-xs text-coral">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
