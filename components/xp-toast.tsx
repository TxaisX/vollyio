"use client";

import { useEffect, useState } from "react";

export function XpToast({ amount }: { amount: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!visible || amount <= 0) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-full border border-gold/40 bg-navy-light px-4 py-2 shadow-glow md:bottom-8"
    >
      <span className="font-display text-sm font-bold text-gold">
        +{amount} XP
      </span>
      <span className="ml-2 text-sm text-chalk-dim">rep analyzed</span>
    </div>
  );
}
