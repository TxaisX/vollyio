"use client";

import { useEffect, useState } from "react";

const isProd = process.env.NODE_ENV === "production";

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!isProd) {
      // Registering a service worker in dev fights hot reload and caches
      // stale bundles, so it stays off; log the skip so it is not a mystery.
      console.info("[pwa] service worker registration skipped in development");
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            setWaiting(registration.waiting);
          }
          registration.addEventListener("updatefound", () => {
            const next = registration.installing;
            if (!next) return;
            next.addEventListener("statechange", () => {
              // A worker reaching "installed" while another controls the page
              // means an update is ready, not a first install.
              if (
                next.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setWaiting(registration.waiting ?? next);
              }
            });
          });
        })
        .catch((err) => {
          console.error("[pwa] service worker registration failed", err);
        });
    };

    // Gate on the load event so registration never competes with the
    // first paint; run immediately if the page has already loaded.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  const reload = () => {
    waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  };

  if (!waiting || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6"
    >
      <div className="card flex items-center gap-3 px-4 py-3 shadow-lift">
        <p className="text-sm text-chalk">A new version is ready.</p>
        <button
          type="button"
          onClick={reload}
          className="btn-primary px-4 text-sm"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="flex h-11 w-11 items-center justify-center rounded-control text-chalk-dim transition-colors hover:text-chalk"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>
    </div>
  );
}
