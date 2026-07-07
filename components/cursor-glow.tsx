"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

function finePointer() {
  return (
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!finePointer()) return;
    setActive(true);
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let tx = -600;
    let ty = -600;
    let x = tx;
    let y = ty;

    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate(${x - 300}px, ${y - 300}px)`;
      raf =
        Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5
          ? requestAnimationFrame(tick)
          : 0;
    };

    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) {
    return <div ref={ref} className="hidden" aria-hidden />;
  }
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 h-[600px] w-[600px] rounded-full"
      style={{
        transform: "translate(-600px, -600px)",
        background:
          "radial-gradient(circle, rgb(232 185 59 / 0.07), transparent 60%)",
      }}
    />
  );
}

export function SpotlightGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer()) return;
    const move = (e: PointerEvent) => {
      for (const card of el.querySelectorAll<HTMLElement>(".spot")) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        card.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }
    };
    el.addEventListener("pointermove", move, { passive: true });
    return () => el.removeEventListener("pointermove", move);
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function Magnetic({
  children,
  className = "",
  strength = 0.25,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer()) return;
    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    };
    const leave = () => {
      el.style.transition = "transform 0.35s var(--ease-court)";
      el.style.transform = "translate(0, 0)";
      setTimeout(() => (el.style.transition = ""), 350);
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={`inline-block ${className}`}>
      {children}
    </div>
  );
}
