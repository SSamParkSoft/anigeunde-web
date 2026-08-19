import { IssueView } from "@/components/issue-view";

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <IssueView slug={slug} />;
}

