import type { Metadata } from "next";
import { Matchmaker } from "@/components/matchmaker";
export const metadata: Metadata = { title: "My AI Matchmaker" };
export default function Page() {
  return <Matchmaker />;
}
