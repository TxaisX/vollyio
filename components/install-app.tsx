"use client";

import { useEffect, useState } from "react";

/**
 * "Install app", offered rather than described.
 *
 * WHY THIS EXISTS. vollyio.com has met every one of Chrome's installability
 * criteria for a long time (HTTPS, a manifest with 192 and 512 icons,
 * display:standalone, and a service worker with a fetch handler in
 * public/sw.js), so any Android visitor could already have had a real app icon
 * with no address bar and no store. Nothing said so. The landing page mentioned
 * it in one clause of one FAQ answer and left the reader to find Chrome's
 * overflow menu on their own, which is the same as not shipping it.
 *
 * This matters commercially and not only cosmetically: the installed PWA is the
 * ONE distribution surface that needs nobody's permission. Play open testing is
 * still behind 12 testers for 14 consecutive days, and a sideloaded APK asks a
 * stranger to enable "install unknown apps". This asks for one tap.
 *
 * TWO BROWSERS, TWO DIFFERENT THINGS. Chrome and Edge fire
 * `beforeinstallprompt` and hand over a prompt we can call. iOS Safari never
 * fires it and has no API at all: Add to Home Screen exists only inside the
 * share sheet, so there the honest move is to say where it is rather than show
 * a button that cannot work. Everything else renders nothing at all, because a
 * dead "Install" button is worse than no button.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    // Stashed by the inline script in app/layout.tsx. The event fires once, on
    // page load, and is usually gone before React hydrates, so catching it in
    // this component's own effect would miss it on most visits.
    __installPrompt?: InstallPromptEvent | null;
  }
}

type Mode = "none" | "prompt" | "ios";

function alreadyInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own, non-standard flag: it is the only signal on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Chrome, Firefox and Edge on iOS are Safari underneath but have NO Add to
  // Home Screen, so telling their users to look in the share sheet is a lie.
  return iOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

// Dismissing the banner is remembered, because a bar that returns on every
// visit stops reading as an offer and starts reading as an ad. The inline
// variant is not gated on this: that one sits in the flow of the page and is
// only ever seen by someone who scrolled to it.
const DISMISSED_KEY = "vollyio.install-banner-dismissed";

export function InstallApp({
  className = "",
  variant = "inline",
}: {
  className?: string;
  /** "banner" pins a slim bar to the very top of the page, above the nav, and
   *  is the first thing a visitor sees. "inline" sits wherever it is placed. */
  variant?: "inline" | "banner";
}) {
  const [mode, setMode] = useState<Mode>("none");
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (alreadyInstalled()) return;
    if (variant === "banner") {
      try {
        if (localStorage.getItem(DISMISSED_KEY)) {
          setDismissed(true);
          return;
        }
      } catch {
        // Private mode and blocked storage both throw here. Losing the memory
        // of a dismissal is better than losing the offer, so carry on.
      }
    }

    const settle = () => {
      if (window.__installPrompt) setMode("prompt");
      else if (isIosSafari()) setMode("ios");
    };
    settle();

    // The event can also arrive AFTER hydration, so both paths are covered:
    // the stash above for the common case, this listener for the late one.
    const onReady = () => setMode("prompt");
    const onInstalled = () => setMode("none");
    window.addEventListener("vollyio:installready", onReady);
    window.addEventListener("vollyio:installed", onInstalled);
    return () => {
      window.removeEventListener("vollyio:installready", onReady);
      window.removeEventListener("vollyio:installed", onInstalled);
    };
  }, [variant]);

  // HOW TALL THE BANNER IS, published so the fixed nav can sit under it rather
  // than behind it. components/landing-nav.tsx is `fixed`, so without this the
  // bar and the nav occupy the same strip and one of them wins by z-index
  // alone. The nav's fallback is 0px, so nothing special happens when there is
  // no bar.
  //
  // ONLY THE BANNER WRITES THIS. The landing page renders this component twice
  // (the bar up top, an inline offer at the closing CTA) and an early version
  // let both write: the inline one is never a banner, so it published 0px and
  // clobbered the real height, leaving the nav sitting on top of the bar. An
  // instance that is not the banner has no opinion about the banner's height.
  useEffect(() => {
    if (variant !== "banner") return;
    const root = document.documentElement;
    const showing = mode !== "none" && !dismissed;
    root.style.setProperty("--install-banner-h", showing ? "2.75rem" : "0px");
    return () => {
      root.style.removeProperty("--install-banner-h");
    };
  }, [variant, mode, dismissed]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // See above: a forgotten dismissal is survivable, a thrown error is not.
    }
  }

  async function install() {
    const event = window.__installPrompt;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    // The button goes either way, because a prompt can only be used once
    // whatever the answer, and re-offering something just declined is nagging.
    // The browser's own menu still has it for anyone who changes their mind.
    window.__installPrompt = null;
    setMode("none");
  }

  if (mode === "none") return null;

  if (variant === "banner") {
    if (dismissed) return null;
    const ios = mode === "ios";
    return (
      // STICKY, NOT FIXED, and that is the whole point of the element. Fixed
      // took it out of flow, so it sat ON TOP of the first 45px of the page and
      // covered the wordmark and the start of the hero. Sticky keeps it pinned
      // while occupying real height, so everything below starts underneath it
      // and nothing is hidden. z-50 clears the nav's z-40, which is fixed to
      // the same edge and offsets itself by --install-banner-h.
      <div className="sticky top-0 z-50 border-b border-line bg-navy-lighter/95 backdrop-blur-md">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-5 md:px-8">
          <p className="min-w-0 flex-1 truncate text-sm text-chalk">
            <span className="text-gold-ink">Install Vollyio</span>{" "}
            <span className="text-chalk-dim">
              {ios
                ? "· Share, then Add to Home Screen"
                : "· full screen, straight from your home screen"}
            </span>
          </p>
          {ios ? (
            // No API exists on iOS, so the sentence above IS the instruction
            // and there is nothing to click.
            <span aria-hidden="true" className="shrink-0 text-gold-ink">
              &uarr;
            </span>
          ) : (
            <button
              type="button"
              onClick={install}
              // THE TOUCH FLOOR APPLIES HERE MOST OF ALL. This banner only
              // ever renders on a phone, and it shipped a 28px-tall primary
              // button: the one control in the product guaranteed never to be
              // clicked with a mouse was the shortest one in it.
              className="btn-primary min-h-11 shrink-0 px-4 text-xs"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install offer"
            // 32px wide against a 44px floor, and it is the control a player
            // reaches for when they do not want the banner at all.
            className="flex h-11 w-11 shrink-0 items-center justify-center text-chalk-dim transition-colors hover:text-chalk"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              &times;
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "ios") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setShowIosSteps((v) => !v)}
          aria-expanded={showIosSteps}
          className="min-h-11 font-mono text-[11px] uppercase tracking-[0.08em] text-gold-ink transition-colors hover:text-chalk"
        >
          Install on your iPhone &rarr;
        </button>
        {showIosSteps && (
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-chalk-dim">
            Tap the Share button in Safari, then{" "}
            <span className="text-chalk">Add to Home Screen</span>. Vollyio opens
            full screen after that, with no address bar.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={install}
        className="min-h-11 font-mono text-[11px] uppercase tracking-[0.08em] text-gold-ink transition-colors hover:text-chalk"
      >
        Install the app &rarr;
      </button>
    </div>
  );
}
