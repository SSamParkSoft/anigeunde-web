import type {
  AdminIssue,
  Comment,
  CommentReportReason,
  IssueDetail,
  IssueSummary,
  NewsCandidatePool,
  NewsBatchFetchResult,
  NewsFetchResult,
  NewsSearchQuery,
  SelectedNewsDraft,
  ModerationAppeal,
  ModerationReport,
  RightsCase,
  MyModerationStatus,
} from "./types";
import { getSupabaseBrowserClient } from "./supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const accessToken = data.session?.access_token;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.detail ?? "요청을 처리하지 못했습니다.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<{
    authenticated: boolean;
    requires_bootstrap?: boolean;
    requires_terms_consent?: boolean;
    profile: {
      id: string;
      nickname: string;
      role: "USER" | "MODERATOR" | "EDITOR" | "ADMIN";
      status: string;
      age_gate_confirmed: boolean;
    } | null;
  }>("/api/v1/auth/session"),
  bootstrapProfile: () => request("/api/v1/profile/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      age_confirmed: true,
      terms_agreed: true,
    }),
  }),
  consentSensitiveParticipation: () => request("/api/v1/consents", {
    method: "POST",
    body: JSON.stringify({
      consent_type: "SENSITIVE_PARTICIPATION",
      granted: true,
    }),
  }),
  consentStatus: () => request<{
    required_versions: Record<string, string>;
    items: Array<{ consent_type: string; version: string; granted: boolean }>;
  }>("/api/v1/consents/status"),
  withdrawSensitiveParticipation: () =>
    request<void>("/api/v1/consents/sensitive-participation", { method: "DELETE" }),
  deleteAccount: () => request<void>("/api/v1/me", { method: "DELETE" }),
  moderationReports: () => request<{ items: ModerationReport[] }>("/api/v1/admin/moderation/reports"),
  updateModerationReport: (reportId: string, nextStatus: string, reason: string) =>
    request<{ id: string; status: string }>(`/api/v1/admin/moderation/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, reason }),
    }),
  moderateComment: (commentId: string, action: string, reason: string) =>
    request<{ id: string; status: string; locked: boolean }>(`/api/v1/admin/moderation/comments/${commentId}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    }),
  sanctionUser: (userId: string, sanctionType: string, reason: string, durationDays?: number) =>
    request<{ id: string; status: string }>(`/api/v1/admin/moderation/users/${userId}/sanctions`, {
      method: "POST",
      body: JSON.stringify({ sanction_type: sanctionType, reason, duration_days: durationDays }),
    }),
  moderationAppeals: () => request<{ items: ModerationAppeal[] }>("/api/v1/admin/moderation/appeals"),
  myModerationStatus: () => request<MyModerationStatus>("/api/v1/moderation/status"),
  createModerationAppeal: (commentId: string, reportId: string, sanctionId: string, statement: string) =>
    request<{ id: string; status: string }>("/api/v1/moderation/appeals", {
      method: "POST",
      body: JSON.stringify({
        comment_id: commentId || null,
        report_id: reportId || null,
        sanction_id: sanctionId || null,
        statement,
      }),
    }),
  resolveModerationAppeal: (appealId: string, nextStatus: string, resolution: string) =>
    request<{ id: string; status: string }>(`/api/v1/admin/moderation/appeals/${appealId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, resolution }),
    }),
  rightsCases: () => request<{ items: RightsCase[] }>("/api/v1/admin/moderation/rights-cases"),
  createRightsCase: (payload: {
    case_type: string;
    requester_name: string;
    requester_email: string;
    target_url: string;
    comment_id?: string;
    statement: string;
    priority: "NORMAL" | "HIGH" | "URGENT";
  }) => request<{ id: string; status: string }>("/api/v1/admin/moderation/rights-cases", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  updateRightsCase: (caseId: string, payload: {
    status: string;
    action_reason: string;
    author_statement: string;
    requester_notified: boolean;
    author_notified: boolean;
  }) => request<{ id: string; status: string }>(`/api/v1/admin/moderation/rights-cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
  issues: () => request<{ items: IssueSummary[] }>("/api/v1/issues"),
  newsCandidates: (category?: string) =>
    request<NewsCandidatePool>(
      `/api/v1/admin/news/candidates?limit=200${category ? `&category=${encodeURIComponent(category)}` : ""}`,
    ),
  newsQueries: () =>
    request<{ items: NewsSearchQuery[] }>("/api/v1/admin/news/queries"),
  createNewsQuery: (category: string, query: string) =>
    request<NewsSearchQuery>("/api/v1/admin/news/queries", {
      method: "POST",
      body: JSON.stringify({ category, query }),
    }),
  updateNewsQuery: (item: NewsSearchQuery, category: string, query: string, enabled: boolean) =>
    request<NewsSearchQuery>(`/api/v1/admin/news/queries/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        category,
        query,
        enabled,
        interval_minutes: item.interval_minutes,
        priority: item.priority,
      }),
    }),
  deleteNewsQuery: (queryId: string) =>
    request<{ query_id: string; deleted: boolean }>(`/api/v1/admin/news/queries/${queryId}`, {
      method: "DELETE",
    }),
  fetchNewsQuery: (queryId: string) =>
    request<NewsFetchResult>(`/api/v1/admin/news/queries/${queryId}/fetch`, {
      method: "POST",
    }),
  fetchNewsQueries: (queryIds: string[]) =>
    request<NewsBatchFetchResult>("/api/v1/admin/news/queries/fetch", {
      method: "POST",
      body: JSON.stringify({ query_ids: queryIds }),
    }),
  deleteNewsCandidate: (candidateId: string) =>
    request<{ candidate_id: string; deleted: boolean }>(
      `/api/v1/admin/news/candidates/${candidateId}`,
      { method: "DELETE" },
    ),
  clearNewsCandidates: () =>
    request<{ deleted_count: number; deleted_cluster_count: number }>(
      "/api/v1/admin/news/candidates",
      {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE_ALL_CANDIDATES" }),
      },
    ),
  clearNewsCandidatesByDate: (publishedDate: string) =>
    request<{ published_date: string; deleted_count: number }>(
      "/api/v1/admin/news/candidates/bulk/by-published-date",
      {
        method: "DELETE",
        body: JSON.stringify({
          published_date: publishedDate,
          confirmation: "DELETE_PUBLISHED_DATE",
        }),
      },
    ),
  selectNewsCluster: (clusterId: string) =>
    request<{ issue_id: string; status: string; duplicate_status: string }>(
      `/api/v1/admin/news/clusters/${clusterId}/select`,
      { method: "POST" },
    ),
  selectedNewsDrafts: () =>
    request<{ items: SelectedNewsDraft[] }>("/api/v1/admin/news/selected-drafts"),
  confirmSelectedNewsDraft: (issueId: string) =>
    request<AdminIssue>(`/api/v1/admin/news/selected-drafts/${issueId}/confirm`, {
      method: "POST",
    }),
  updateSelectedNewsDraft: (
    issueId: string,
    payload: {
      question: string;
      brief: string;
      category: string;
      requires_sensitive_consent: boolean;
      options: Array<{ stance: "SUPPORT" | "OPPOSE"; label: string }>;
    },
  ) =>
    request<AdminIssue>(`/api/v1/admin/news/selected-drafts/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteSelectedNewsDraft: (issueId: string) =>
    request<{ issue_id: string; deleted: boolean; cluster_id: string; cluster_status: string | null }>(
      `/api/v1/admin/news/selected-drafts/${issueId}`,
      { method: "DELETE" },
    ),
  deleteSelectedNewsDrafts: (issueIds: string[]) =>
    request<{ deleted_count: number }>("/api/v1/admin/news/selected-drafts", {
      method: "DELETE",
      body: JSON.stringify({
        issue_ids: issueIds,
        confirmation: "DELETE_SELECTED_DRAFTS",
      }),
    }),
  issue: (slug: string) => request<IssueDetail>(`/api/v1/issues/${slug}`),
  comments: (issueId: string) =>
    request<{ items: Comment[] }>(`/api/v1/issues/${issueId}/comments`),
  choosePosition: (issueId: string, optionId: string) =>
    request<{ my_position_id: string; results: NonNullable<IssueDetail["results"]> }>(
      `/api/v1/issues/${issueId}/positions`,
      {
        method: "POST",
        body: JSON.stringify({
          option_id: optionId,
          visibility: "PRIVATE",
        }),
      },
    ),
  createComment: (issueId: string, body: string) =>
    request<Comment>(`/api/v1/issues/${issueId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  createRebuttal: (commentId: string, body: string) =>
    request<Comment>(`/api/v1/comments/${commentId}/rebuttals`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  deleteComment: (commentId: string) =>
    request<void>(`/api/v1/comments/${commentId}`, { method: "DELETE" }),
  reportComment: (commentId: string, reasonCode: CommentReportReason, description: string) =>
    request<{ id: string; status: string; duplicate: boolean }>(
      `/api/v1/comments/${commentId}/reports`,
      {
        method: "POST",
        body: JSON.stringify({ reason_code: reasonCode, description }),
      },
    ),
  blockCommentAuthor: (commentId: string) =>
    request<{ blocked: boolean }>(`/api/v1/comments/${commentId}/author-block`, {
      method: "PUT",
    }),
  unblockCommentAuthor: (commentId: string) =>
    request<void>(`/api/v1/comments/${commentId}/author-block`, { method: "DELETE" }),
  toggleReaction: async (comment: Comment, type: "like" | "dislike") => {
    const normalized = type === "like" ? "LIKE" : "DISLIKE";
    const active = comment.viewer_reactions.includes(normalized);
    return request<Comment | undefined>(`/api/v1/comments/${comment.id}/reactions/${type}`, {
      method: active ? "DELETE" : "PUT",
    });
  },
};
