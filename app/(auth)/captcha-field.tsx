"use client";

import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SCRIPT_URL } from "@/lib/captcha";

type Turnstile = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "flexible" | "compact";
    },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptPromise: Promise<void> | null = null;

// One script tag per document, however many forms mount. The promise is cached
// rather than the boolean, so two components mounting in the same tick both
// await the same load instead of racing two <script> insertions.
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * An invisible bot check that rides along with the auth forms.
 *
 * Renders a hidden input and, when a site key is configured, a Turnstile widget
 * in `interaction-only` mode: the player sees nothing and does nothing unless
 * Cloudflare actually decides they look automated, which is the entire point.
 * A captcha that made a real teenager solve a puzzle would be paying for bot
 * protection with the conversion the funnel work just bought.
 *
 * The field is always present in the form, even unconfigured, so the server
 * action reads one shape rather than branching on whether captcha exists.
 */
export function CaptchaField({ siteKey }: { siteKey: string | null }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let widgetId: string | null = null;
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId = window.turnstile.render(holder.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          callback: (t) => setToken(t),
          // A Turnstile token is single-use and expires in ~5 minutes. Someone
          // who opens signup, wanders off, and comes back would otherwise
          // submit a stale token and be told their details were wrong.
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => {
        // Cloudflare unreachable, or blocked by an extension. Leave the token
        // empty and let the server decide: if Supabase is not enforcing
        // captcha, nothing changes; if it is, the player gets the calm retry
        // message rather than a broken form with no explanation.
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  return (
    <>
      <input type="hidden" name="captcha_token" value={token} readOnly />
      {siteKey ? <div ref={holder} className="contents" /> : null}
    </>
  );
}
