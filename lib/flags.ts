// Coach chat is hidden while API spend is capped (D-047). NEXT_PUBLIC so the
// client nav and the server surfaces read the same build-time value; flipping
// the env var in Vercel brings the feature back with the hardened quotas
// already in force.
export const COACH_ENABLED = process.env.NEXT_PUBLIC_COACH_ENABLED === "true";
