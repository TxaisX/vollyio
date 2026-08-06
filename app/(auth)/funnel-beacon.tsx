"use client";

import { track } from "@vercel/analytics";
import { useEffect, useRef } from "react";

/**
 * Fires one analytics event when an auth step is reached.
 *
 * This exists because the signup funnel could not be read. Analytics showed 113
 * players on the landing page and 13 arriving at `/signup`, and then nothing at
 * all until an account row appeared: whether the rest abandoned the form, chose
 * the social lane, or died waiting on a confirmation email was unknowable, so
 * every fix was a guess. These events make the drop-off measurable within a
 * week rather than inferable never.
 *
 * The ref guard matters in development, where React's strict mode mounts every
 * component twice and would otherwise double every count in the funnel.
 */
export function FunnelBeacon({
  event,
  data,
}: {
  event: string;
  data?: Record<string, string | number | boolean | null>;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event, data);
  }, [event, data]);
  return null;
}
