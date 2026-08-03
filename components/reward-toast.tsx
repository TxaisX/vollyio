"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function RewardMark({ className = "" }: { className?: string }) {
  return (
    <span className={`reward-mark ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

export function RewardToast({
  title,
  detail,
  duration = 4200,
  onDismiss,
}: {
  title: string;
  detail?: string;
  duration?: number;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  // Portal host, set after mount so server rendering never touches document.
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.body);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible || !host) return null;

  // Portaled to <body>, not rendered in place, because `position: fixed`
  // anchors to the nearest TRANSFORMED ancestor rather than the viewport, and
  // several callers sit inside a Reveal whose animation applies a transform.
  // On the dashboard goals board that pinned the toast to the card's own box,
  // out of view: the DOM said role=status, the screen said nothing. The portal
  // makes "fixed" mean the viewport for every caller, present and future.
  return createPortal(
    <div
      className="fixed bottom-24 left-1/2 z-50 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 md:bottom-8"
    >
      <div
        role="status"
        aria-live="polite"
        className="reward-toast flex items-center gap-3 rounded-card border border-gold/40 bg-navy-light p-3 pr-1 shadow-glow"
      >
        <RewardMark />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold text-gold">
            {title}
          </span>
          {detail && (
            <span className="mt-0.5 block text-sm text-chalk-dim">{detail}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          aria-label="Dismiss"
          className="icon-btn"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            &times;
          </span>
        </button>
      </div>
    </div>,
    host,
  );
}
