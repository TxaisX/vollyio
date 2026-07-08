import type { Metadata } from "next";
import { AnalyzeFlow } from "@/components/analyze-flow";

export const metadata: Metadata = {
  title: "Analyze a rep",
  description: "Record or upload a rep and get it scored frame by frame.",
};

export default function Analyze() {
  return <AnalyzeFlow />;
}
