"use client";

import { useLinkStatus } from "next/link";

/**
 * A fixed-size pending affordance for a <Link> into a dynamic route that has
 * no loading.tsx (here: /drills/[slug]). Renders as a descendant of the Link
 * so useLinkStatus can read that link's in-flight state. The dot is absolutely
 * placed and never changes layout; its parent must be positioned. The 100ms
 * reveal delay (in .vt-link-pending) means a fast prefetched navigation never
 * flashes it. Decorative: the destination page announces itself on arrival.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className="vt-link-pending" data-pending={pending || undefined} />
  );
}
