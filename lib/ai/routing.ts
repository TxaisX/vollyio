/**
 * WHERE OUR USERS' DATA IS ALLOWED TO GO, expressed as routing preferences the
 * gateway enforces for us.
 *
 * THE DEFAULT WAS WRONG FOR THIS PRODUCT. OpenRouter's `data_collection`
 * defaults to `"allow"`, which permits routing to upstream providers that
 * retain prompts non-transiently and may train on them. Everything this app
 * sends is a video of a person performing a sport: `app/api/analyze/route.ts`
 * base64s the whole clip into the request body. Vollyio's declared Play
 * audience starts at 13, so the default meant a minor's footage of themselves
 * could land on an endpoint that keeps it and learns from it, chosen by routing
 * luck rather than by us. Nothing in the product needs that, so it is switched
 * off at every call site.
 *
 * `deny` restricts routing to providers that do not collect user data. It is
 * preferred over the stricter `zdr: true` flag because the two are ORed with
 * account-level settings anyway, and `deny` expresses the actual requirement:
 * do not hand this footage to anyone who keeps it.
 *
 * This is a floor, not the whole answer. The account-level privacy settings at
 * openrouter.ai/settings/privacy apply on top, and prompt logging there is
 * opt-in and must stay off. A signed DPA is enterprise-tier only and Vollyio
 * does not have one, which matters under GDPR wherever the digital-consent age
 * runs above 13.
 */
export const PRIVATE_ROUTING = { data_collection: "deny" } as const;

/**
 * Merge the routing floor into whatever provider preferences a call already
 * has, so a call that pins an upstream keeps its pin AND the privacy setting.
 * Written as a helper rather than spread by hand at each site because a call
 * that silently loses `data_collection` looks identical in a diff.
 */
export function withPrivateRouting(
  preferences?: Record<string, unknown>,
): { provider: Record<string, unknown> } {
  return { provider: { ...PRIVATE_ROUTING, ...(preferences ?? {}) } };
}
