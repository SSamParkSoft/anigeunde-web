import type { Metadata } from "next";
import { IssueView } from "@/components/issue-view";
import type { IssueDetail } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://anigeunde.bukae.co.kr").replace(/\/$/, "");

async function loadIssue(slug: string): Promise<IssueDetail | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/issues/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const issue = await loadIssue(slug);
  if (!issue) return { title: "주제 — 아니근데" };
  const url = `${SITE_URL}/issues/${encodeURIComponent(slug)}`;
  const description = "내 생각을 선택하고 다른 사람의 의견을 확인해보세요.";
  return {
    title: `${issue.question} — 아니근데`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "아니근데",
      title: "친구야, 너는 어떻게 생각해?",
      description: issue.question,
    },
    twitter: {
      card: "summary",
      title: "친구야, 너는 어떻게 생각해?",
      description: issue.question,
    },
  };
}

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <IssueView slug={slug} />;
}
