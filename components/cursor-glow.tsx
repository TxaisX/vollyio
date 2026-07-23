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

  // Re-evaluate pointer-fine and reduced-motion whenever the user changes
  // them mid-session, rather than capturing the decision once at mount.
  useEffect(() => {
    const fineMq = window.matchMedia("(pointer: fine)");
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => setActive(fineMq.matches && !reduceMq.matches);
    evaluate();
    fineMq.addEventListener("change", evaluate);
    reduceMq.addEventListener("change", evaluate);
    return () => {
      fineMq.removeEventListener("change", evaluate);
      reduceMq.removeEventListener("change", evaluate);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
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
          "radial-gradient(circle, color-mix(in oklab, var(--color-gold) 7%, transparent), transparent 60%)",
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
  const [active, setActive] = useState(false);

  // Re-evaluate pointer-fine and reduced-motion whenever the user changes
  // them mid-session so the spotlight stops the instant reduce is enabled.
  useEffect(() => {
    const fineMq = window.matchMedia("(pointer: fine)");
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => setActive(finePointer());
    evaluate();
    fineMq.addEventListener("change", evaluate);
    reduceMq.addEventListener("change", evaluate);
    return () => {
      fineMq.removeEventListener("change", evaluate);
      reduceMq.removeEventListener("change", evaluate);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    let raf = 0;
    let px = 0;
    let py = 0;
    // Batch all per-card rect reads into a single rAF per pointer move
    // instead of a synchronous layout read for every `.spot` on every event.
    const apply = () => {
      raf = 0;
      for (const card of el.querySelectorAll<HTMLElement>(".spot")) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${px - rect.left}px`);
        card.style.setProperty("--my", `${py - rect.top}px`);
      }
    };
    const move = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.addEventListener("pointermove", move, { passive: true });
    return () => {
      el.removeEventListener("pointermove", move);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function Tilt({
  children,
  className = "",
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  // Re-evaluate pointer-fine and reduced-motion whenever the user changes
  // them mid-session so the card settles flat the instant reduce is enabled.
  useEffect(() => {
    const fineMq = window.matchMedia("(pointer: fine)");
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => setActive(finePointer());
    evaluate();
    fineMq.addEventListener("change", evaluate);
    reduceMq.addEventListener("change", evaluate);
    return () => {
      fineMq.removeEventListener("change", evaluate);
      reduceMq.removeEventListener("change", evaluate);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let raf = 0;
    let rx = 0;
    let ry = 0;
    // The persistent short transition is what makes tracking feel weighted:
    // each pointermove retargets it, so the plane follows the cursor with a
    // slight lag instead of snapping, and pointerleave reuses it to settle.
    el.style.transition = "transform 0.2s var(--ease-court)";
    const apply = () => {
      raf = 0;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    };
    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      ry = px * 2 * max;
      rx = -py * 2 * max;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => {
      rx = 0;
      ry = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      el.style.transform = "";
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
      // Settle flat instantly when the effect tears down (unmount or reduce
      // enabled mid-session), never strand a card mid-rotation.
      el.style.transition = "";
      el.style.transform = "";
    };
  }, [active, max]);

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
  const [active, setActive] = useState(false);

  // Re-evaluate pointer-fine and reduced-motion whenever the user changes
  // them mid-session so the pull stops (and resets) the instant reduce is on.
  useEffect(() => {
    const fineMq = window.matchMedia("(pointer: fine)");
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => setActive(finePointer());
    evaluate();
    fineMq.addEventListener("change", evaluate);
    reduceMq.addEventListener("change", evaluate);
    return () => {
      fineMq.removeEventListener("change", evaluate);
      reduceMq.removeEventListener("change", evaluate);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    };
    const leave = () => {
      el.style.transition = "transform 0.35s var(--ease-court)";
      el.style.transform = "translate(0, 0)";
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        el.style.transition = "";
      }, 350);
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      if (resetTimer) clearTimeout(resetTimer);
      // Settle back to the origin instantly when the effect tears down
      // (unmount, strength change, or reduce enabled mid-session).
      el.style.transition = "";
      el.style.transform = "";
    };
  }, [active, strength]);

  return (
    <div ref={ref} className={`inline-block ${className}`}>
      {children}
    </div>
  );
}
