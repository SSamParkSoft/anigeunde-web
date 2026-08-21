import type { Provider } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase/client";

export const PENDING_PARTICIPATION_KEY = "anigeunde:pending-participation";
export const ACCOUNT_READY_EVENT = "anigeunde:account-ready";

export type LoginProvider = Extract<Provider, "google" | "kakao">;

export type PendingParticipation = {
  version: 1;
  issueSlug: string;
  kind: "position" | "comment" | "retry";
  optionId?: string;
  commentBody?: string;
};

export async function startSocialLogin(provider: LoginProvider, pending: PendingParticipation) {
  sessionStorage.setItem(PENDING_PARTICIPATION_KEY, JSON.stringify(pending));

  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", window.location.pathname);

  const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      scopes: undefined,
    },
  });

  if (error) {
    sessionStorage.removeItem(PENDING_PARTICIPATION_KEY);
    throw error;
  }
}

export async function startAccountLogin(provider: LoginProvider) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", window.location.pathname);
  const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      scopes: undefined,
    },
  });
  if (error) {
    throw error;
  }
}

export function readPendingParticipation(issueSlug: string) {
  const raw = sessionStorage.getItem(PENDING_PARTICIPATION_KEY);
  if (!raw) return null;

  try {
    const pending = JSON.parse(raw) as PendingParticipation;
    if (pending.version !== 1 || pending.issueSlug !== issueSlug) return null;
    return pending;
  } catch {
    sessionStorage.removeItem(PENDING_PARTICIPATION_KEY);
    return null;
  }
}

export function clearPendingParticipation() {
  sessionStorage.removeItem(PENDING_PARTICIPATION_KEY);
}
