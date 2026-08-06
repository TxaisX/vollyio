// Which identity providers this deployment can actually complete a round trip
// with.
//
// The list is READ FROM THE ENVIRONMENT rather than hardcoded, and the default
// is empty, because a "Continue with Google" button is worse than no button at
// all when the provider is not configured: the player taps the fastest-looking
// path, the auth service answers `validation_failed` for an unsupported
// provider, and they land back on the form having learned only that the app is
// broken. Fail closed. A button appears when, and only when, someone has
// deliberately named the provider in `OAUTH_PROVIDERS`.
//
// This is SERVER-ONLY on purpose. The pages that render the buttons are server
// components, so they can read it directly and pass the result down as props.
// The browser has no use for the list, and a client-visible provider list is
// one step from a client-supplied one -- which is the bug where the caller gets
// to say which provider to authenticate against. `signInWithProvider` validates
// the submitted value against this same list server-side for that reason.

export const OAUTH_PROVIDERS = ["google", "apple"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_LABEL: Record<OAuthProvider, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
};

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return (
    typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value)
  );
}

/**
 * Parse `OAUTH_PROVIDERS` into the providers to offer.
 *
 * Comma separated, whitespace and case insensitive, unknown names dropped
 * rather than throwing: a typo in an environment variable should cost one
 * button, not the whole signup page. Order follows OAUTH_PROVIDERS rather than
 * the environment string, so the buttons cannot silently reorder themselves
 * between deployments, and duplicates collapse.
 */
export function enabledOAuthProviders(raw: string | undefined | null): OAuthProvider[] {
  if (!raw) return [];
  const named = new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part !== ""),
  );
  return OAUTH_PROVIDERS.filter((provider) => named.has(provider));
}
