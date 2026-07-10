"use client";

import { RewardToast } from "@/components/reward-toast";

export function XpToast({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return <RewardToast title={`+${amount} XP`} detail="Rep analyzed." />;
}
