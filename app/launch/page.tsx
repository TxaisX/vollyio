import type { Metadata } from "next";
import { LaunchFilm } from "@/components/launch-film";

export const metadata: Metadata = {
  title: "Launch film",
  description: "Sideout launch film. See what changed and know what to do next.",
  robots: { index: false, follow: false },
};

export default async function LaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string }>;
}) {
  const { capture } = await searchParams;
  return <LaunchFilm capture={capture === "1"} />;
}
