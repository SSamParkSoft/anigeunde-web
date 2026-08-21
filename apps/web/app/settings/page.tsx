import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";

export const metadata: Metadata = { title: "계정 설정 — 아니근데" };

export default function SettingsPage() {
  return <AccountSettings />;
}
