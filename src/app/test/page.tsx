import type { Metadata } from "next";
import SamjhoApp from "@/components/SamjhoApp";

export const metadata: Metadata = {
  title: "Samjho · test mode",
  description: "Just the tool: paste or upload a lab report and see every result, with no story in front.",
};

/** Test mode for judges: the report box first, no story, no closing sections. */
export default function TestPage() {
  return <SamjhoApp mode="test" />;
}
