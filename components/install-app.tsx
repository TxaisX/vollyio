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

export function InstallApp({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("none");
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (alreadyInstalled()) return;

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
  }, []);

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

  if (mode === "ios") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setShowIosSteps((v) => !v)}
          aria-expanded={showIosSteps}
          className="min-h-11 font-mono text-[11px] uppercase tracking-[0.08em] text-gold transition-colors hover:text-chalk"
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
        className="min-h-11 font-mono text-[11px] uppercase tracking-[0.08em] text-gold transition-colors hover:text-chalk"
      >
        Install the app &rarr;
      </button>
    </div>
  );
}
