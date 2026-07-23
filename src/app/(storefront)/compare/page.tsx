import type { Metadata } from "next";
import { ComparePageClient } from "./compare-page-client";

export const metadata: Metadata = {
  title: "Compare",
  robots: { index: false, follow: false },
};

export default function ComparePage() {
  return <ComparePageClient />;
}
