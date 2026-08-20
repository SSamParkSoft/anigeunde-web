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
  const description = issue.brief.replace(/\s+/g, " ").slice(0, 150);
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
      images: [{ url: "/share-card", width: 1200, height: 630, alt: "아니근데 주제 공유" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "친구야, 너는 어떻게 생각해?",
      description: issue.question,
      images: ["/share-card"],
    },
  };
}

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <IssueView slug={slug} />;
}
