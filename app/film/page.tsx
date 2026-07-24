import type { Metadata } from "next";
import { FilmScene } from "@/components/film-scene";

export const metadata: Metadata = {
  title: "Court vision film",
  description:
    "Vollyio court vision film. Watch a spike get read frame by frame.",
  robots: { index: false, follow: false },
};

export default async function FilmPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; debug?: string }>;
}) {
  const { variant, debug } = await searchParams;
  return (
    <FilmScene
      variant={variant === "ambient" ? "ambient" : "film"}
      debug={debug === "1"}
    />
  );
}
