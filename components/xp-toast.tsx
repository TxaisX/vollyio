"use client";

import { useEffect, useRef, useState } from "react";

export function XpToast({ amount }: { amount: number }) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => setVisible(false), 4000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!visible || amount <= 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 animate-fade-up rounded-full border border-gold/40 bg-navy-light pl-4 pr-1 shadow-glow md:bottom-8"
    >
      <span className="font-display text-sm font-bold text-gold">
        +{amount} XP
      </span>
      <span className="text-sm text-chalk-dim">rep analyzed</span>
      <button
        type="button"
        onClick={() => {
          if (timer.current) clearTimeout(timer.current);
          setVisible(false);
        }}
        aria-label="Dismiss"
        className="icon-btn"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          &times;
        </span>
      </button>
    </div>
  );
}
