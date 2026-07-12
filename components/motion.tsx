"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

export function useReducedMotion() {
  // Starts false everywhere so the first client render matches the server
  // HTML (reading matchMedia in the initializer caused a hydration mismatch
  // for reduce users); the effect below settles the real value post-mount.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useInView<T extends Element>(margin = "-40px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      // threshold 0 so content taller than the viewport still reveals; a
      // fractional threshold strands a very tall section at opacity 0.
      { rootMargin: margin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, inView };
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  immediate = false,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  immediate?: boolean;
  as?: ElementType;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const Tag = as as ElementType;
  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;

  if (immediate) {
    return (
      <Tag className={`reveal-static ${className}`} style={style}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "in" : ""} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}

export function CountUp({
  to,
  duration = 900,
  className = "",
  prefix = "",
  suffix = "",
}: {
  to: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const reducedMotion = useReducedMotion();
  // Seed with the real target so the server-rendered HTML and the no-JS
  // experience show the actual number; the count animation is enhancement.
  const [value, setValue] = useState(to);
  const valueRef = useRef(to);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView) return;
    const set = (v: number) => {
      valueRef.current = v;
      setValue(v);
    };
    if (reducedMotion) {
      startedRef.current = true;
      set(to);
      return;
    }
    // First reveal counts up from 0; a later `to` change tweens from the
    // value currently on screen, never a jump back to 0.
    const from = startedRef.current ? valueRef.current : 0;
    startedRef.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      set(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reducedMotion]);

  const format = (n: number) =>
    `${prefix}${n.toLocaleString("en-US")}${suffix}`;

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{format(value)}</span>
      <span className="sr-only">{format(to)}</span>
    </span>
  );
}
