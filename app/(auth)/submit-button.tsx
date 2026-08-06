"use client";

import { track } from "@vercel/analytics";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  idleLabel,
  pendingLabel,
  className = "btn-primary mt-2 w-full",
  trackEvent,
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
  // Fires on the attempt, not on the outcome. A submit that the schema then
  // rejects still counts, on purpose: the gap between attempts and accounts is
  // exactly the validation friction worth seeing.
  trackEvent?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      onClick={trackEvent ? () => track(trackEvent) : undefined}
      className={`${className} disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
