"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { ACCOUNT_READY_EVENT, startAccountLogin, type LoginProvider } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SocialLoginButtons } from "@/components/social-login-buttons";

export function HeaderAuth() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<"USER" | "MODERATOR" | "EDITOR" | "ADMIN">("USER");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "reconsent">("login");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    async function syncSession(nextSession: Session | null) {
      setSession(nextSession);
      if (!nextSession) {
        setRole("USER");
        setMode("login");
        return;
      }
      try {
        const authSession = await api.session();
        setRole(authSession.profile?.role ?? "USER");
        if (authSession.requires_bootstrap) {
          setAgeConfirmed(false);
          setTermsConsent(false);
          setMode("signup");
          setOpen(true);
        } else if (authSession.requires_terms_consent) {
          setMode("reconsent");
          setAgeConfirmed(true);
          setTermsConsent(false);
          setOpen(true);
        } else {
          setOpen(false);
        }
      } catch (reason) {
        setRole("USER");
        setError(reason instanceof Error ? reason.message : "계정 상태를 확인하지 못했습니다.");
      }
    }
    void supabase.auth.getSession().then(({ data }) => syncSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => void syncSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function login(provider: LoginProvider) {
    setBusy(true);
    setError("");
    try {
      await startAccountLogin(provider);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "로그인을 시작하지 못했습니다.");
      setBusy(false);
    }
  }

  async function completeSignup() {
    if ((mode === "signup" && !ageConfirmed) || !termsConsent) {
      setError("두 가지 필수 항목을 모두 확인해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.bootstrapProfile();
      window.dispatchEvent(new Event(ACCOUNT_READY_EVENT));
      setMode("login");
      setAgeConfirmed(false);
      setTermsConsent(false);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "가입을 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    const { error: logoutError } = await getSupabaseBrowserClient().auth.signOut();
    setAgeConfirmed(false);
    setTermsConsent(false);
    setBusy(false);
    if (logoutError) setError(logoutError.message);
  }

  async function closeModal() {
    setOpen(false);
    setError("");
    if (mode !== "login") {
      await getSupabaseBrowserClient().auth.signOut();
      setAgeConfirmed(false);
      setTermsConsent(false);
      setMode("login");
    }
  }

  return (
    <div className="header-auth">
      <Link href="/privacy" className={`header-link${pathname === "/privacy" ? " active" : ""}`}>정책</Link>
      {role === "ADMIN" ? (
          <Link href="/admin/news" className={`header-link header-admin-link${pathname === "/admin/news" ? " active" : ""}`}>뉴스 관리</Link>
      ) : null}
      {["MODERATOR", "ADMIN"].includes(role) ? (
          <Link href="/admin/moderation" className={`header-link header-admin-link${pathname === "/admin/moderation" ? " active" : ""}`}>신고 관리</Link>
      ) : null}
      {session ? (
        <>
          <Link href="/settings" className={`header-link${pathname === "/settings" ? " active" : ""}`}>설정</Link>
          <button className="header-auth-button" type="button" onClick={() => void logout()} disabled={busy}>로그아웃</button>
        </>
      ) : (
        <button className="header-auth-button primary" type="button" onClick={() => { setMode("login"); setError(""); setOpen(true); }}>로그인</button>
      )}

      {open ? createPortal(
        <div className="login-gate-backdrop" role="presentation" onMouseDown={() => void closeModal()}>
          <section className="login-gate compact-login-gate" role="dialog" aria-modal="true" aria-labelledby="header-login-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="login-gate-close" type="button" aria-label="로그인 창 닫기" onClick={() => void closeModal()}>×</button>
            <div className="login-modal-heading">
              <h2 id="header-login-title">{mode === "signup" ? "가입 동의" : mode === "reconsent" ? "이용약관 재동의" : "아니근데에 로그인"}</h2>
              <p>{mode === "signup" ? "처음 이용하는 계정입니다. 필수 항목을 확인해주세요." : mode === "reconsent" ? "중요한 약관 변경사항을 확인해주세요." : "소셜 계정으로 계속하세요."}</p>
            </div>
            {mode !== "login" ? (
              <div className="login-consents">
                {mode === "signup" ? <label><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /><span><b>[필수]</b> 만 14세 이상입니다.</span></label> : null}
                <label><input type="checkbox" checked={termsConsent} onChange={(event) => setTermsConsent(event.target.checked)} /><span><b>[필수]</b> <Link href="/terms" target="_blank">이용약관</Link>에 동의합니다.</span></label>
                <p className="signup-policy-link"><Link href="/privacy" target="_blank">개인정보 처리방침 확인</Link></p>
              </div>
            ) : null}
            {error ? <p className="login-gate-error">{error}</p> : null}
            {mode !== "login" ? (
              <button className="participation-continue-button" type="button" onClick={() => void completeSignup()} disabled={busy}>{mode === "signup" ? "동의하고 가입하기" : "동의하고 계속하기"}</button>
            ) : (
              <SocialLoginButtons busy={busy} onSelect={(provider) => void login(provider)} />
            )}
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
