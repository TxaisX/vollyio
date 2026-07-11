import type { Metadata } from "next";
import { AnalyzeFlow } from "@/components/analyze-flow";
import { isSkill } from "@/lib/skills";

export const metadata: Metadata = {
  title: "Analyze a rep",
  description: "Record or upload a rep and get it scored frame by frame.",
};

export default async function Analyze({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const { skill } = await searchParams;
  return <AnalyzeFlow initialSkill={skill && isSkill(skill) ? skill : null} />;
}
