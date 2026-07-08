"use client";

import { useFormStatus } from "react-dom";

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H9" />
    </svg>
  );
}

export function LogoutButton({ variant }: { variant: "sidebar" | "mobile" }) {
  const { pending } = useFormStatus();
  const label = pending ? "Logging out…" : "Log out";

  if (variant === "mobile") {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm text-chalk-dim transition-colors hover:bg-navy-light hover:text-chalk disabled:cursor-wait disabled:opacity-70"
      >
        <LogoutIcon />
        {label}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm text-chalk-dim transition-colors hover:bg-navy-light hover:text-chalk disabled:cursor-wait disabled:opacity-70"
    >
      <LogoutIcon />
      {label}
    </button>
  );
}
