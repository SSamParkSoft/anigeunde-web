import type { Comment, IssueDetail, IssueSummary } from "./types";
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
  session: () => request<{ authenticated: boolean; requires_bootstrap?: boolean }>("/api/v1/auth/session"),
  bootstrapProfile: () => request("/api/v1/profile/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      age_confirmed: true,
      age_gate_version: "2026-08-19",
      terms_version: "2026-08-19",
      privacy_version: "2026-08-19",
    }),
  }),
  consentSensitivePosition: () => request("/api/v1/consents", {
    method: "POST",
    body: JSON.stringify({
      consent_type: "SENSITIVE_POSITION",
      version: "2026-08-19",
      granted: true,
    }),
  }),
  issues: () => request<{ items: IssueSummary[] }>("/api/v1/issues"),
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
          visibility: "PSEUDONYMOUS",
          sensitive_data_consent_version: "2026-08-19",
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
  toggleReaction: async (comment: Comment, type: "like" | "dislike") => {
    const normalized = type === "like" ? "LIKE" : "DISLIKE";
    const active = comment.viewer_reactions.includes(normalized);
    return request<Comment | undefined>(`/api/v1/comments/${comment.id}/reactions/${type}`, {
      method: active ? "DELETE" : "PUT",
    });
  },
};
