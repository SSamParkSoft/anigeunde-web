import type { Metadata } from "next";
import { ModerationConsole } from "@/components/moderation-console";

export const metadata: Metadata = { title: "신고 관리 — 아니근데" };

export default function ModerationPage() {
  return <ModerationConsole />;
}
