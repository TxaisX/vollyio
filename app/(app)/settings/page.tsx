import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { DeleteAccount } from "@/components/delete-account";
import { PlanCard } from "@/components/plan-card";
import { Reveal } from "@/components/motion";
import { isPlan, type Plan } from "@/lib/plans";
import {
  ANALYZE_DISCIPLINES,
  DISCIPLINE_LABEL,
  disciplineGroup,
  type Discipline,
} from "@/lib/skills";
import {
  FREQUENCY_OPTIONS,
  LEVEL_OPTIONS,
  POSITION_OPTIONS,
  type PlayFrequency,
  type Position,
} from "@/lib/funnel";
import type { Level } from "@/lib/skills";
import { logout } from "@/app/(auth)/actions";
import { setTrainingConsent, updateProfile } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  description: "Account, coaching level, player profile, and privacy.",
};

type ProfileRow = {
  display_name: string | null;
  discipline: Discipline;
  level: Level | null;
  position: Position | null;
  play_frequency: PlayFrequency | null;
  training_consent: boolean | null;
  plan: string | null;
};

/**
 * One labelled row of chips, submitting one profile field (D-117).
 *
 * The four of these in the player-profile card used to be a label stacked over
 * its chips, four times, at roughly 90px each: about 360px of one card spent
 * saying four words and offering eleven buttons. From `sm` the label moves
 * beside the chips instead, which is the same move the rest of this pass makes
 * everywhere - compare down one axis - and takes the group to about 52px.
 *
 * It stays STACKED on a phone deliberately. A 7rem label column is a quarter
 * of a 360px screen, and taking it out of the chips is what would start
 * wrapping "Twice a week" onto two lines.
 *
 * Each group is its own form because each submits one field, and the label
 * carries the id the form's `aria-labelledby` points at: on its own, a button
 * reading "Indoor" or "Setter" arrives with no statement of what it sets.
 */
function ChipGroup({
  id,
  label,
  name,
  options,
  isActive,
  action,
}: {
  id: string;
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  isActive: (value: string) => boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3">
      <p
        id={id}
        className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim"
      >
        {label}
      </p>
      <form
        action={action}
        role="group"
        aria-labelledby={id}
        className="mt-2 flex flex-wrap gap-2 sm:mt-0"
      >
        {options.map(({ value, label: optionLabel }) => (
          <button
            key={value}
            type="submit"
            name={name}
            value={value}
            aria-pressed={isActive(value)}
            className={`chip min-h-11 ${isActive(value) ? "chip-active" : ""}`}
          >
            {optionLabel}
          </button>
        ))}
      </form>
    </div>
  );
}

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const { checkout } = await searchParams;
  const userId = await getAuthUserId(supabase);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const email = authUser?.email ?? null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "display_name, discipline, level, position, play_frequency, training_consent, plan",
    )
    .eq("id", userId!)
    .single();
  if (error) throw error;
  const profile = data as ProfileRow;

  // A plan string this build cannot name falls back to the free card, the same
  // direction lib/plans.ts fails: never show a player a larger entitlement than
  // the reservation will actually honour.
  const plan: Plan = isPlan(profile.plan) ? profile.plan : "free";

  // The checkout route returns the payer to /settings?checkout=complete#plan.
  // Until the provider's webhook lands, the stored plan still reads free, and a
  // card that keeps offering Upgrade in that window invites a second checkout
  // session, and with it a second customer record (D-064's read-then-act race,
  // but with real money attached). The marker holds the card in a waiting state
  // instead. Once the plan reads pro the marker is spent and ignored.
  const checkoutPending = checkout === "complete" && plan !== "pro";

  // Legacy 'beach' profiles light up the "Grass & sand" chip: the two wire
  // values are one environment everywhere the player sees it (D-035).
  const activeDiscipline = (d: Discipline) =>
    disciplineGroup(d) === disciplineGroup(profile.discipline);

  return (
    <section className="max-w-5xl">
      {/* THE OPENING BAND (D-117), replacing the kicker-and-rule header this
          page shared with /history before both were converted. */}
      <Reveal>
        <div className="hero-band card spot p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-ink">
            Settings
          </p>
          <h1 className="mt-1.5 font-display text-page-title">
            Your game, your way.
          </h1>
        </div>
      </Reveal>

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <Reveal delay={60}>
        <div className="card p-4 sm:p-5">
          <h2 className="section-head">Account</h2>
          <form action={updateProfile} className="mt-3">
            <label
              htmlFor="display_name"
              className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim"
            >
              Display name
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="display_name"
                name="display_name"
                defaultValue={profile.display_name ?? ""}
                maxLength={40}
                required
                className="input-field min-h-11 flex-1"
                autoComplete="name"
              />
              <button type="submit" className="btn-ghost min-h-11 px-4 text-sm">
                Save
              </button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-chalk-dim">{email ?? "Signed in"}</p>
            <form action={logout}>
              <button type="submit" className="btn-ghost min-h-11 px-4 text-sm">
                Sign out
              </button>
            </form>
          </div>
          <DeleteAccount />
        </div>
      </Reveal>

      <Reveal delay={120}>
        <PlanCard plan={plan} checkoutPending={checkoutPending} />
      </Reveal>

      <Reveal delay={180}>
        <div className="card p-4 sm:p-5">
          <h2 className="section-head">Player profile</h2>
          <p className="mt-1.5 text-xs text-chalk-dim">
            Where and how you usually play. New film starts from these.
          </p>

          <div className="mt-4 divide-y divide-line">
            <ChipGroup
              id="settings-environment"
              label="Environment"
              name="discipline"
              action={updateProfile}
              options={ANALYZE_DISCIPLINES.map((d) => ({
                value: d,
                label: DISCIPLINE_LABEL[d],
              }))}
              isActive={(v) => activeDiscipline(v as Discipline)}
            />

            {/* The level was set once at onboarding and then frozen, while it
                drives assignment difficulty, the plan seed and the coaching
                voice. A player who levels up should not need a new account for
                the coaching to notice. */}
            <ChipGroup
              id="settings-level"
              label="Coaching level"
              name="level"
              action={updateProfile}
              options={LEVEL_OPTIONS}
              isActive={(v) => profile.level === v}
            />

            <ChipGroup
              id="settings-position"
              label="Position"
              name="position"
              action={updateProfile}
              options={POSITION_OPTIONS[profile.discipline]}
              isActive={(v) => profile.position === v}
            />

            <ChipGroup
              id="settings-frequency"
              label="How often you play"
              name="play_frequency"
              action={updateProfile}
              options={FREQUENCY_OPTIONS}
              isActive={(v) => profile.play_frequency === v}
            />
          </div>
        </div>
      </Reveal>

      <Reveal delay={240}>
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0 max-w-md">
            <h2 id="settings-consent" className="section-head">
              Improve future analysis
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
              Allow your clips and frames to help train future analysis
              features. Footage stays private to your account either way.
            </p>
          </div>
          <form action={setTrainingConsent}>
            <input
              type="hidden"
              name="allow"
              value={profile.training_consent ? "false" : "true"}
            />
            {/* Named from the card title: "Allowed" on its own does not say
                what was allowed. */}
            <button
              type="submit"
              aria-pressed={!!profile.training_consent}
              aria-describedby="settings-consent"
              className={`chip min-h-11 ${profile.training_consent ? "chip-active" : ""}`}
            >
              {profile.training_consent ? "Allowed" : "Not allowed"}
            </button>
          </form>
        </div>
      </Reveal>
      </div>

    </section>
  );
}
