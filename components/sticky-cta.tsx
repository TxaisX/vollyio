"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Mobile-only bottom CTA bar that stays out of the way while the hero's own
// CTA (the watch target, by element id) is on screen, so the fold never
// shows two identical gold buttons. Slide/fade is transform+opacity only and
// the global reduced-motion block collapses it to an instant swap; the bar's
// presence is the state, so no information is carried by motion alone.
export function StickyCta({
  watch,
  label,
  href,
}: {
  watch: string;
  label: string;
  href: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [watch]);

  return (
    <div
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      aria-hidden={shown ? undefined : true}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy/90 px-3 pt-3 backdrop-blur-md transition-[opacity,transform] duration-300 ease-court md:hidden ${
        shown
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <Link href={href} className="btn-primary w-full py-3.5" tabIndex={shown ? undefined : -1}>
        {label}
      </Link>
    </div>
  );
}
