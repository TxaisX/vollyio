"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Reveal } from "@/components/motion";
import { RewardMark, RewardToast } from "@/components/reward-toast";
import { saveGame, type SaveGamePayload } from "@/app/(app)/scoreboard/actions";

type Team = "a" | "b";
type SetScore = { a: number; b: number };
type Phase = "live" | "set_over" | "match_over";

type Snapshot = {
  phase: Phase;
  sets: SetScore[];
  a: number;
  b: number;
  serving: Team | null;
  endedAt: number | null;
};

type Match = Snapshot & {
  teamA: string;
  teamB: string;
  bestOf: 3 | 5;
  startedAt: number;
  history: Snapshot[];
};

const STORAGE_KEY = "sideout:live-match";

function targetFor(setIndex: number, bestOf: number) {
  return setIndex === bestOf - 1 ? 15 : 25;
}

function setsWonBy(sets: SetScore[], team: Team) {
  return sets.filter((s) => (team === "a" ? s.a > s.b : s.b > s.a)).length;
}

function takesSet(score: number, opp: number, target: number) {
  return score >= target && score - opp >= 2;
}

function snapshotOf(m: Match): Snapshot {
  return {
    phase: m.phase,
    sets: m.sets,
    a: m.a,
    b: m.b,
    serving: m.serving,
    endedAt: m.endedAt,
  };
}

function computePoint(m: Match, team: Team): { next: Match; announce: string } {
  const now = Date.now();
  const history = [...m.history, snapshotOf(m)];
  const a = team === "a" ? m.a + 1 : m.a;
  const b = team === "b" ? m.b + 1 : m.b;
  const name = team === "a" ? m.teamA : m.teamB;
  const target = targetFor(m.sets.length, m.bestOf);
  const score = team === "a" ? a : b;
  const opp = team === "a" ? b : a;
  if (!takesSet(score, opp, target)) {
    return {
      next: { ...m, a, b, serving: team, history },
      announce: `Point ${name}. ${m.teamA} ${a}, ${m.teamB} ${b}.`,
    };
  }
  const sets = [...m.sets, { a, b }];
  const winsA = setsWonBy(sets, "a");
  const winsB = setsWonBy(sets, "b");
  const matchWon = setsWonBy(sets, team) >= (m.bestOf + 1) / 2;
  const next: Match = {
    ...m,
    sets,
    a: 0,
    b: 0,
    serving: team,
    history,
    phase: matchWon ? "match_over" : "set_over",
    endedAt: matchWon ? now : null,
  };
  if (matchWon) {
    const setLine = team === "a" ? `${winsA}–${winsB}` : `${winsB}–${winsA}`;
    return { next, announce: `${name} wins the match, ${setLine}.` };
  }
  return {
    next,
    announce: `Set ${sets.length} to ${name}. Sets ${winsA} to ${winsB}.`,
  };
}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isSetScore(v: unknown): v is SetScore {
  return (
    typeof v === "object" &&
    v !== null &&
    isCount((v as SetScore).a) &&
    isCount((v as SetScore).b)
  );
}

function isSnapshot(v: unknown): v is Snapshot {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Snapshot;
  return (
    (s.phase === "live" ||
      s.phase === "set_over" ||
      s.phase === "match_over") &&
    Array.isArray(s.sets) &&
    s.sets.length <= 5 &&
    s.sets.every(isSetScore) &&
    isCount(s.a) &&
    isCount(s.b) &&
    (s.serving === null || s.serving === "a" || s.serving === "b") &&
    (s.endedAt === null || typeof s.endedAt === "number")
  );
}

function loadStored(): Match | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSnapshot(parsed)) return null;
    const c = parsed as Match;
    if (
      typeof c.teamA !== "string" ||
      c.teamA.length < 1 ||
      c.teamA.length > 30
    )
      return null;
    if (
      typeof c.teamB !== "string" ||
      c.teamB.length < 1 ||
      c.teamB.length > 30
    )
      return null;
    if (c.bestOf !== 3 && c.bestOf !== 5) return null;
    if (typeof c.startedAt !== "number" || !Number.isFinite(c.startedAt))
      return null;
    return {
      phase: c.phase,
      sets: c.sets,
      a: c.a,
      b: c.b,
      serving: c.serving,
      endedAt: c.endedAt,
      teamA: c.teamA,
      teamB: c.teamB,
      bestOf: c.bestOf,
      startedAt: c.startedAt,
      history: Array.isArray(c.history) ? c.history.filter(isSnapshot) : [],
    };
  } catch {
    return null;
  }
}

export function Scoreboard() {
  const [match, setMatch] = useState<Match | null>(null);
  const [ready, setReady] = useState(false);
  const [pop, setPop] = useState<Team | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reward, setReward] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [saving, startSaving] = useTransition();
  const popTimer = useRef<number | null>(null);
  const reduceRef = useRef(false);

  useEffect(() => {
    setMatch(loadStored());
    setReady(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceRef.current = mq.matches;
    const onChange = () => {
      reduceRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      if (match) localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage may be unavailable (private mode, quota); scoring must keep working
    }
  }, [match, ready]);

  useEffect(
    () => () => {
      if (popTimer.current) window.clearTimeout(popTimer.current);
    },
    [],
  );

  function start(teamA: string, teamB: string, bestOf: 3 | 5) {
    setSaveError(null);
    setReward(null);
    setConfirmAbandon(false);
    setAnnounce("");
    setMatch({
      phase: "live",
      sets: [],
      a: 0,
      b: 0,
      serving: null,
      endedAt: null,
      teamA,
      teamB,
      bestOf,
      startedAt: Date.now(),
      history: [],
    });
  }

  function point(team: Team) {
    const m = match;
    if (!m || m.phase !== "live") return;
    const { next, announce: msg } = computePoint(m, team);
    setMatch(next);
    setAnnounce(msg);
    if (!reduceRef.current) {
      setPop(team);
      if (popTimer.current) window.clearTimeout(popTimer.current);
      popTimer.current = window.setTimeout(() => setPop(null), 180);
    }
  }

  function minusOne(team: Team) {
    const m = match;
    if (!m || m.phase !== "live") return;
    if ((team === "a" ? m.a : m.b) === 0) return;
    const a = team === "a" ? m.a - 1 : m.a;
    const b = team === "b" ? m.b - 1 : m.b;
    const name = team === "a" ? m.teamA : m.teamB;
    setMatch({ ...m, a, b, history: [...m.history, snapshotOf(m)] });
    setAnnounce(
      `Point removed from ${name}. ${m.teamA} ${a}, ${m.teamB} ${b}.`,
    );
  }

  function undo() {
    setSaveError(null);
    const m = match;
    if (!m || m.history.length === 0) return;
    const snap = m.history[m.history.length - 1];
    const next = { ...m, ...snap, history: m.history.slice(0, -1) };
    setMatch(next);
    setAnnounce(`Undone. ${m.teamA} ${next.a}, ${m.teamB} ${next.b}.`);
  }

  function abandon() {
    setConfirmAbandon(false);
    setSaveError(null);
    setAnnounce("");
    setMatch(null);
  }

  function continueMatch() {
    setMatch((m) =>
      m && m.phase === "set_over" ? { ...m, phase: "live" } : m,
    );
  }

  function save() {
    if (!match || match.phase !== "match_over" || saving) return;
    const winsA = setsWonBy(match.sets, "a");
    const winsB = setsWonBy(match.sets, "b");
    const payload: SaveGamePayload = {
      team_a: match.teamA,
      team_b: match.teamB,
      best_of: match.bestOf,
      sets: match.sets,
      winner: winsA > winsB ? "a" : "b",
      started_at: new Date(match.startedAt).toISOString(),
      duration_s: Math.max(
        0,
        Math.round(((match.endedAt ?? Date.now()) - match.startedAt) / 1000),
      ),
    };
    startSaving(async () => {
      const result = await saveGame(payload);
      if (result.ok) {
        setSaveError(null);
        const winnerName = payload.winner === "a" ? match.teamA : match.teamB;
        setReward({
          title: "Match saved",
          detail: `${winnerName} wins ${winsA}-${winsB}.`,
        });
        setMatch(null);
      } else {
        setSaveError(result.error);
      }
    });
  }

  let body: ReactNode;

  if (!ready) {
    body = (
      <div aria-hidden="true">
        <div className="grid grid-cols-2 gap-3">
          <div className="card skeleton min-h-[38vh] md:min-h-[320px]" />
          <div className="card skeleton min-h-[38vh] md:min-h-[320px]" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="skeleton h-11 rounded-[var(--radius-control)] border border-line" />
          <div className="skeleton h-11 rounded-[var(--radius-control)] border border-line" />
          <div className="skeleton h-11 rounded-[var(--radius-control)] border border-line" />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="skeleton h-2 w-12 rounded-full" />
          <span className="skeleton h-3 w-24 rounded" />
          <span className="skeleton h-2 w-12 rounded-full" />
        </div>
      </div>
    );
  } else if (!match) {
    body = <Setup onStart={start} />;
  } else {
    const setIndex = match.sets.length;
    const target = targetFor(setIndex, match.bestOf);
    const setsToWin = (match.bestOf + 1) / 2;
    const winsA = setsWonBy(match.sets, "a");
    const winsB = setsWonBy(match.sets, "b");

    const badgeFor = (team: Team): "set" | "match" | null => {
      if (match.phase !== "live") return null;
      const score = team === "a" ? match.a : match.b;
      const opp = team === "a" ? match.b : match.a;
      if (!takesSet(score + 1, opp, target)) return null;
      const wins = team === "a" ? winsA : winsB;
      return wins + 1 >= setsToWin ? "match" : "set";
    };

    if (match.phase === "match_over") {
      const winner: Team = winsA > winsB ? "a" : "b";
      const winnerName = winner === "a" ? match.teamA : match.teamB;
      const setLine =
        winner === "a" ? `${winsA}–${winsB}` : `${winsB}–${winsA}`;
      body = (
        <Reveal>
          <div className="card reward-panel p-6 text-center">
            <RewardMark className="mx-auto" />
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-gold">
              Match complete
            </p>
            <h2 className="mt-3 break-words font-display text-4xl font-bold">
              <span className="text-sheen">{winnerName}</span> wins {setLine}
            </h2>
            <p className="mt-3 font-mono text-sm text-chalk-dim">
              {match.sets.map((s) => `${s.a}-${s.b}`).join(" · ")}
            </p>
            {saveError && (
              <p role="alert" className="mt-3 text-sm text-coral">
                {saveError}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="btn-primary"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving" : "Save match"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={abandon}
                disabled={saving}
              >
                Discard
              </button>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={undo}
                className="inline-flex min-h-11 items-center px-3 font-mono text-[10px] uppercase tracking-widest text-chalk-dim transition hover:text-chalk"
              >
                Undo last rally
              </button>
            </div>
          </div>
        </Reveal>
      );
    } else {
      const lastSet = match.sets[match.sets.length - 1];
      body = (
        <div>
          {match.phase === "live" ? (
            <div className="grid grid-cols-2 gap-3">
              <TapZone
                name={match.teamA}
                score={match.a}
                serving={match.serving === "a"}
                badge={badgeFor("a")}
                popping={pop === "a"}
                tone="home"
                onPoint={() => point("a")}
              />
              <TapZone
                name={match.teamB}
                score={match.b}
                serving={match.serving === "b"}
                badge={badgeFor("b")}
                popping={pop === "b"}
                tone="guest"
                onPoint={() => point("b")}
              />
            </div>
          ) : (
            <Reveal>
              <div className="card reward-panel flex min-h-[38vh] flex-col items-center justify-center gap-4 p-6 text-center">
                <RewardMark />
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-gold">
                  Set complete
                </p>
                <p className="font-display text-3xl font-bold">
                  Set {match.sets.length} ·{" "}
                  {lastSet.a > lastSet.b ? match.teamA : match.teamB}{" "}
                  {Math.max(lastSet.a, lastSet.b)}:
                  {Math.min(lastSet.a, lastSet.b)}
                </p>
                {setIndex === match.bestOf - 1 && (
                  <p className="font-mono text-xs text-chalk-dim">
                    Deciding set · first to 15
                  </p>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={continueMatch}
                >
                  Continue
                </button>
              </div>
            </Reveal>
          )}

          <div className="mt-3 grid grid-cols-3 items-center gap-2">
            <button
              type="button"
              className="btn-ghost min-h-11 px-3 py-2 text-sm disabled:pointer-events-none disabled:opacity-40"
              onClick={() => minusOne("a")}
              disabled={match.phase !== "live" || match.a === 0}
              aria-label={`Remove a point from ${match.teamA}`}
            >
              −1
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11 px-3 py-2 text-sm disabled:pointer-events-none disabled:opacity-40"
              onClick={undo}
              disabled={match.history.length === 0}
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 3v4h4" />
                <path d="M2.9 7a5.2 5.2 0 1 0 1.5-3.3L2.5 5.5" />
              </svg>
              Undo
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11 px-3 py-2 text-sm disabled:pointer-events-none disabled:opacity-40"
              onClick={() => minusOne("b")}
              disabled={match.phase !== "live" || match.b === 0}
              aria-label={`Remove a point from ${match.teamB}`}
            >
              −1
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <SetDots
              total={setsToWin}
              won={winsA}
              team={match.teamA}
              tone="home"
            />
            <span className="font-mono text-xs text-chalk-dim">
              Set {setIndex + 1} · to {target}
            </span>
            <SetDots
              total={setsToWin}
              won={winsB}
              team={match.teamB}
              tone="guest"
            />
          </div>

          <div className="mt-5 flex justify-center">
            {confirmAbandon ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm text-chalk-dim">
                  Abandon this match?
                </span>
                <button
                  type="button"
                  className="btn-ghost min-h-11 px-3 py-1.5 text-sm text-coral"
                  onClick={abandon}
                >
                  Yes, abandon
                </button>
                <button
                  type="button"
                  className="btn-ghost min-h-11 px-3 py-1.5 text-sm"
                  onClick={() => setConfirmAbandon(false)}
                >
                  Keep playing
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-ghost min-h-11 border-transparent px-3 py-1.5 text-sm text-chalk-dim"
                onClick={() => setConfirmAbandon(true)}
              >
                Abandon match
              </button>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
      {body}
      {reward && (
        <RewardToast
          title={reward.title}
          detail={reward.detail}
          onDismiss={() => setReward(null)}
        />
      )}
    </>
  );
}

function TapZone({
  name,
  score,
  serving,
  badge,
  popping,
  tone,
  onPoint,
}: {
  name: string;
  score: number;
  serving: boolean;
  badge: "set" | "match" | null;
  popping: boolean;
  tone: "home" | "guest";
  onPoint: () => void;
}) {
  const badgeText =
    badge === "set" ? " Set point." : badge === "match" ? " Match point." : "";
  return (
    <button
      type="button"
      onClick={onPoint}
      aria-label={`Point for ${name}${serving ? ", serving" : ""}. Score ${score}.${badgeText}`}
      className={`card card-lift flex min-h-[38vh] touch-manipulation select-none flex-col items-center justify-center gap-3 border-t-2 px-2 py-6 md:min-h-[320px] ${
        tone === "home" ? "border-t-court-blue" : "border-t-coral"
      }`}
    >
      <span className="flex max-w-full items-center gap-2 px-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full bg-gold animate-pulse-dot ${serving ? "" : "invisible"}`}
          aria-hidden="true"
        />
        <span className="truncate font-display text-lg font-bold">{name}</span>
      </span>
      <span
        className={`font-display text-7xl font-bold tabular-nums transition-transform duration-[180ms] ease-[var(--ease-court)] md:text-8xl ${
          tone === "home" ? "text-court-blue" : "text-coral"
        } ${popping ? "scale-110" : "scale-100"}`}
      >
        {score}
      </span>
      <span className="flex h-5 items-center">
        {badge === "set" && (
          <span className="reward-earned rounded bg-navy-lighter px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-chalk-dim">
            Set point
          </span>
        )}
        {badge === "match" && (
          <span className="reward-earned rounded bg-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gold">
            Match point
          </span>
        )}
      </span>
    </button>
  );
}

function SetDots({
  total,
  won,
  team,
  tone,
}: {
  total: number;
  won: number;
  team: string;
  tone: "home" | "guest";
}) {
  const wonColor = tone === "home" ? "bg-court-blue" : "bg-coral";
  return (
    <span
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${team}: ${won} of ${total} sets won`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < won ? `set-dot-won ${wonColor}` : "border border-line"
          }`}
        />
      ))}
    </span>
  );
}

function Setup({
  onStart,
}: {
  onStart: (teamA: string, teamB: string, bestOf: 3 | 5) => void;
}) {
  const [teamA, setTeamA] = useState("Home");
  const [teamB, setTeamB] = useState("Guest");
  const [bestOf, setBestOf] = useState<3 | 5>(3);

  return (
    <div className="card p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
            Home
          </span>
          <input
            className="input-field mt-1.5"
            value={teamA}
            maxLength={30}
            placeholder="Home"
            onChange={(e) => setTeamA(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
            Guest
          </span>
          <input
            className="input-field mt-1.5"
            value={teamB}
            maxLength={30}
            placeholder="Guest"
            onChange={(e) => setTeamB(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
          Best of
        </span>
        <button
          type="button"
          className={`chip min-h-11 ${bestOf === 3 ? "chip-active" : ""}`}
          aria-pressed={bestOf === 3}
          onClick={() => setBestOf(3)}
        >
          3
        </button>
        <button
          type="button"
          className={`chip min-h-11 ${bestOf === 5 ? "chip-active" : ""}`}
          aria-pressed={bestOf === 5}
          onClick={() => setBestOf(5)}
        >
          5
        </button>
      </div>
      <button
        type="button"
        className="btn-primary mt-6 w-full"
        onClick={() =>
          onStart(
            teamA.trim().slice(0, 30) || "Home",
            teamB.trim().slice(0, 30) || "Guest",
            bestOf,
          )
        }
      >
        Start match
      </button>
    </div>
  );
}
