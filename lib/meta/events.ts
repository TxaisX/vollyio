// The conversion vocabulary the ad platform is allowed to know about, and the
// payload builder that decides what leaves this system. Pure on purpose: the
// network call lives in `capi.ts`, so every decision that can be wrong (which
// events exist, what identifiers travel, how the browser and server halves
// deduplicate) is testable under `node --test` with no fetch and no env.
//
// THE PRIVACY RULE THAT SHAPES THIS FILE: no personal data goes to the ad
// platform. Not an email, not a hashed email, not a name, not a user id.
//
// That is stricter than the platform's own guidance, which actively encourages
// sending hashed emails to improve match rates, and it costs real attribution
// accuracy. It is deliberate. The product's stated audience is junior club
// players, a population that is substantially 13-17, and it ingests video of
// them. Hashing is not anonymisation: an email hash is a stable cross-site
// identifier for a specific child, and handing one to an ad network is a
// different act from measuring a conversion. Match quality is worth less than
// not doing that.
//
// What travels instead is the platform's own first-party cookies (`_fbp`, and
// `_fbc` when the click carried one), which exist only because the pixel set
// them on this domain, plus the request IP and user agent the network already
// sees. That is enough for the platform to attribute a click it made itself,
// and it introduces no identifier this system was not already handing it.

/**
 * The four moments worth reporting. Names are the platform's standard events
 * rather than custom ones, because only standard events can be selected as an
 * optimization goal in the campaign UI: a custom event can be reported and
 * counted, but the delivery algorithm cannot be told to chase it.
 *
 * SIGNUP is the cheap one and ACTIVATED is the honest one. Optimizing delivery
 * toward SIGNUP buys accounts that never upload a clip, which cost
 * `SIGNUP_GRANT` x the per-analysis price in real money (see lib/plans.ts) and
 * return nothing. ACTIVATED fires only once a rep has actually been scored, so
 * it is the first event that correlates with a player who might pay.
 */
export const META_EVENTS = {
  /** Account created. Cheap, early, and a poor optimization target on its own. */
  SIGNUP: "Lead",
  /** First analysis completed. The real activation moment. */
  ACTIVATED: "CompleteRegistration",
  /** Upgrade intent: the player reached the payment provider. */
  CHECKOUT: "InitiateCheckout",
  /** A subscription actually started. Server-side only, and carries value. */
  SUBSCRIBED: "Subscribe",
} as const;

export type MetaEvent = (typeof META_EVENTS)[keyof typeof META_EVENTS];

/**
 * The platform's browser cookies, the only identifiers this file will forward.
 * `_fbp` is set by the pixel on this domain; `_fbc` is derived from the `fbclid`
 * query parameter on a click the platform itself sent.
 */
export type MetaCookies = {
  fbp?: string | null;
  fbc?: string | null;
};

export type MetaEventInput = {
  event: MetaEvent;
  /** Shared with the browser pixel so the two halves collapse into one. */
  eventId: string;
  /** Seconds since epoch. Passed in rather than read, so tests are not clocks. */
  eventTimeS: number;
  sourceUrl?: string | null;
  cookies?: MetaCookies;
  clientIp?: string | null;
  userAgent?: string | null;
  /** Money, for SUBSCRIBED only. Ignored elsewhere: a Lead has no value. */
  valueUsd?: number | null;
};

// Shape the Graph API expects. Declared rather than inlined so the test can
// assert against the real field names, which are snake_case on the wire and
// silently ignored when misspelled: a typo here does not error, it just makes
// the event unattributable, which is the worst failure mode available.
export type MetaCapiEvent = {
  event_name: MetaEvent;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: Record<string, string>;
  custom_data?: { value: number; currency: "USD" };
};

/**
 * Build one Conversions API event.
 *
 * Returns null when there is no identifier at all. The platform rejects an
 * event with an empty `user_data`, and a rejected batch fails the whole request,
 * so a visitor who blocked the pixel is dropped here rather than being allowed
 * to poison a batch that also carries good events.
 */
export function buildCapiEvent(input: MetaEventInput): MetaCapiEvent | null {
  const user: Record<string, string> = {};
  if (input.cookies?.fbp) user.fbp = input.cookies.fbp;
  if (input.cookies?.fbc) user.fbc = input.cookies.fbc;
  if (input.clientIp) user.client_ip_address = input.clientIp;
  if (input.userAgent) user.client_user_agent = input.userAgent;
  if (Object.keys(user).length === 0) return null;

  const event: MetaCapiEvent = {
    event_name: input.event,
    event_time: Math.floor(input.eventTimeS),
    event_id: input.eventId,
    action_source: "website",
    user_data: user,
  };
  if (input.sourceUrl) event.event_source_url = input.sourceUrl;

  // Value rides on the subscription event alone. Attaching revenue to a Lead
  // teaches the delivery algorithm that a free signup is worth $9.99, which is
  // the single most expensive lie you can tell a bidding system.
  if (input.event === META_EVENTS.SUBSCRIBED && typeof input.valueUsd === "number") {
    if (Number.isFinite(input.valueUsd) && input.valueUsd > 0) {
      event.custom_data = { value: input.valueUsd, currency: "USD" };
    }
  }
  return event;
}

/**
 * Read `_fbp` / `_fbc` out of a raw Cookie header.
 *
 * Hand-parsed rather than pulled from the framework's cookie helper because
 * this also runs against the header string a webhook sees, where no request
 * object is available.
 */
export function readMetaCookies(cookieHeader: string | null | undefined): MetaCookies {
  if (!cookieHeader) return {};
  const out: MetaCookies = {};
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!value) continue;
    if (name === "_fbp") out.fbp = value;
    else if (name === "_fbc") out.fbc = value;
  }
  return out;
}

/**
 * The id both halves of one conversion share.
 *
 * The browser pixel and the server both report the same moment. Without a
 * shared id the platform counts it twice and every cost-per-result you read is
 * half what you are really paying. Derived from the thing the event is about
 * (an account id, a subscription id) so both halves compute the same string
 * without having to pass one to the other.
 *
 * The subject id is FOLDED, not concatenated. An earlier version of this
 * function returned `${event}.${subjectId}`, which put a raw internal account
 * id on the wire and quietly broke the promise at the top of this file: it
 * handed the ad network one stable token per account, tying that account's four
 * events together across sessions. The test in events.test.ts caught it.
 *
 * This is a dedup key, not a security boundary. The fold is FNV-1a: no
 * dependency, identical in both runtimes, and synchronous, which the browser
 * half needs (Web Crypto's digest is async and the pixel fires inline). It is
 * not reversible without already knowing the id, which is the only property
 * required here.
 */
export function metaEventId(event: MetaEvent, subjectId: string): string {
  return `${event}.${fold(`${event}:${subjectId}`)}`;
}

function fold(input: string): string {
  // FNV-1a, 32-bit, in the unsigned range. Math.imul keeps the multiply from
  // silently losing precision once the accumulator passes 2^53.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
