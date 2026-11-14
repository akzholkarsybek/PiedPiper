import type { Metadata } from "next";
import { Diagnostics } from "@/components/diagnostics";
export const metadata: Metadata = {
  title: "Diagnostics",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Diagnostics />;
}
