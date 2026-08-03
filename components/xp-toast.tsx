"use client";

import { useState } from "react";
import { RewardToast } from "@/components/reward-toast";
import { ACHIEVEMENT_BY_KEY, type AchievementKey } from "@/lib/achievements";

// New badges, celebrated one at a time. Every toast anchors to the same spot,
// so showing two at once would stack them into an unreadable pile; this queues
// them instead, each running its own auto-dismiss.
export function BadgeToasts({ badges }: { badges: readonly AchievementKey[] }) {
  const [index, setIndex] = useState(0);
  const key = badges[index];
  if (!key) return null;
  const def = ACHIEVEMENT_BY_KEY[key];
  return (
    <RewardToast
      key={key}
      title={def.name}
      detail={`+${def.xp} XP. ${def.description}`}
      onDismiss={() => setIndex((i) => i + 1)}
    />
  );
}

// What lands after a rep is saved: the XP first, then any badge the rep just
// earned, in sequence for the same anchoring reason as above.
export function RepToasts({
  amount,
  badges,
}: {
  amount: number;
  badges: readonly AchievementKey[];
}) {
  const [xpDone, setXpDone] = useState(amount <= 0);
  if (!xpDone) {
    return (
      <RewardToast
        title={`+${amount} XP`}
        detail="Rep analyzed."
        onDismiss={() => setXpDone(true)}
      />
    );
  }
  return <BadgeToasts badges={badges} />;
}
