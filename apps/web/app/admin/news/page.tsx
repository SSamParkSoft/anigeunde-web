import type { Metadata } from "next";
import { NewsCandidatePool } from "@/components/news-candidate-pool";

export const metadata: Metadata = {
  title: "뉴스 후보함 — 아니근데 운영",
  robots: { index: false, follow: false },
};

export default function AdminNewsPage() {
  return <NewsCandidatePool />;
}
