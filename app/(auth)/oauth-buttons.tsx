"use client";

import { track } from "@vercel/analytics";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import { OAUTH_LABEL, type OAuthProvider } from "@/lib/oauth";
import { signInWithProvider } from "./actions";

// The marks live in `public/` rather than inline, because both are third-party
// brand assets that must keep their own prescribed colors: Google's four-color
// G, and Apple's logo in white on a dark control. Inlining them would put those
// literals in a component, where the design-token lint rule correctly refuses
// them -- the rule guards OUR palette, and neither of these is ours to restyle.
const MARK: Record<OAuthProvider, { src: string; size: number }> = {
  google: { src: "/google-mark.svg", size: 18 },
  apple: { src: "/apple-mark.svg", size: 19 },
};

function ProviderMark({ provider }: { provider: OAuthProvider }) {
  const { src, size } = MARK[provider];
  return (
    <Image src={src} alt="" aria-hidden="true" width={size} height={size} className="shrink-0" />
  );
}

function ProviderButton({ provider }: { provider: OAuthProvider }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={() => track("auth_oauth_start", { provider })}
      className="flex min-h-11 w-full items-center justify-center gap-3 rounded-control border border-chalk/20 bg-chalk/[0.04] px-4 py-2.5 font-display text-sm font-semibold text-chalk transition-colors hover:border-chalk/35 hover:bg-chalk/[0.08] disabled:cursor-wait disabled:opacity-70"
    >
      <ProviderMark provider={provider} />
      {pending ? "Taking you there…" : OAUTH_LABEL[provider]}
    </button>
  );
}

/**
 * The one-tap lane, above the password form because it is the faster of the two
 * and the order is the recommendation.
 *
 * Renders nothing at all when no provider is enabled, so an unconfigured
 * deployment shows the password form exactly as it looked before, with no
 * orphaned divider hanging over it.
 */
export function OAuthButtons({ providers }: { providers: OAuthProvider[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2.5">
        {providers.map((provider) => (
          <form key={provider} action={signInWithProvider}>
            <input type="hidden" name="provider" value={provider} />
            <ProviderButton provider={provider} />
          </form>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
          or
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
