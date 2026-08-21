"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MyModerationStatus } from "@/lib/types";

type Confirmation = "withdraw" | "delete" | null;

export function AccountSettings() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [hasSensitiveConsent, setHasSensitiveConsent] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [assuranceLevel, setAssuranceLevel] = useState("");
  const [appealCommentId, setAppealCommentId] = useState("");
  const [appealReportId, setAppealReportId] = useState("");
  const [appealSanctionId, setAppealSanctionId] = useState("");
  const [appealStatement, setAppealStatement] = useState("");
  const [moderationStatus, setModerationStatus] = useState<MyModerationStatus | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const session = await api.session();
    if (!session.profile) {
      router.replace("/");
      return;
    }
    setIsOperator(["MODERATOR", "EDITOR", "ADMIN"].includes(session.profile.role));
    const [status, moderation] = await Promise.all([
      api.consentStatus(),
      api.myModerationStatus(),
    ]);
    setHasSensitiveConsent(status.items.some((item) => item.consent_type === "SENSITIVE_PARTICIPATION" && item.granted));
    setModerationStatus(moderation);
    setLoaded(true);
    if (["MODERATOR", "EDITOR", "ADMIN"].includes(session.profile.role)) {
      const supabase = getSupabaseBrowserClient();
      const [{ data: factors }, { data: aal }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      setMfaFactorId(factors?.totp.find((factor) => factor.status === "verified")?.id ?? "");
      setAssuranceLevel(aal?.currentLevel ?? "aal1");
    }
  }

  useEffect(() => {
    queueMicrotask(() => { void load().catch(() => router.replace("/")); });
    // `load` is intentionally scoped to this mount-only authentication check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function confirmAction() {
    if (!confirmation) return;
    setBusy(true);
    setError("");
    try {
      if (confirmation === "withdraw") {
        await api.withdrawSensitiveParticipation();
        setHasSensitiveConsent(false);
        setNotice("민감정보 처리 동의를 철회하고 연결된 참여정보를 삭제했습니다.");
        setConfirmation(null);
      } else {
        await api.deleteAccount();
        await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
        router.replace("/");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "요청을 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function beginMfaEnrollment() {
    setBusy(true);
    setError("");
    try {
      const { data, error: enrollError } = await getSupabaseBrowserClient().auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "아니근데 관리자",
      });
      if (enrollError) throw enrollError;
      setMfaFactorId(data.id);
      setMfaSecret(data.totp.secret);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "다중 인증 등록을 시작하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa() {
    if (!mfaFactorId || mfaCode.trim().length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const { error: verifyError } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode.trim(),
      });
      if (verifyError) throw verifyError;
      setAssuranceLevel("aal2");
      setMfaSecret("");
      setMfaCode("");
      setNotice("관리자 다중 인증이 확인되었습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "인증번호를 확인하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAppeal() {
    if ((!appealCommentId.trim() && !appealReportId.trim() && !appealSanctionId.trim()) || appealStatement.trim().length < 2) {
      setError("댓글·신고·제재 중 하나의 식별정보와 이의제기 내용을 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createModerationAppeal(
        appealCommentId.trim(),
        appealReportId.trim(),
        appealSanctionId.trim(),
        appealStatement.trim(),
      );
      setAppealCommentId("");
      setAppealReportId("");
      setAppealSanctionId("");
      setAppealStatement("");
      setModerationStatus(await api.myModerationStatus());
      setNotice("운영조치 이의제기를 접수했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "이의제기를 접수하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <main className="settings-page"><p>계정 정보를 확인하는 중입니다.</p></main>;

  return (
    <main className="settings-page">
      <header><span>ACCOUNT</span><h1>계정 설정</h1><p>동의 상태와 계정 정보를 관리합니다.</p></header>
      {notice ? <p className="settings-notice" role="status">{notice}</p> : null}
      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      <section>
        <div><h2>민감정보 처리 동의</h2><p>정치·사회적 주제의 입장, 댓글과 반응 처리에 대한 동의입니다.</p></div>
        <div className="settings-action-row"><b>{hasSensitiveConsent ? "동의함" : "동의하지 않음"}</b>{hasSensitiveConsent ? <button type="button" onClick={() => setConfirmation("withdraw")}>동의 철회</button> : null}</div>
      </section>
      {isOperator ? (
        <section>
          <div><h2>관리자 다중 인증</h2><p>신고·뉴스 관리 기능은 인증 앱의 6자리 번호로 한 번 더 확인한 세션에서만 사용할 수 있습니다.</p></div>
          <div className="settings-mfa">
            <b>{assuranceLevel === "aal2" ? "인증 완료" : mfaFactorId ? "인증 필요" : "미등록"}</b>
            {!mfaFactorId ? <button type="button" disabled={busy} onClick={() => void beginMfaEnrollment()}>인증 앱 등록</button> : null}
            {mfaSecret ? <code>{mfaSecret}</code> : null}
            {mfaFactorId && assuranceLevel !== "aal2" ? <><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} aria-label="관리자 인증번호" placeholder="6자리 번호" /><button type="button" disabled={busy || mfaCode.length !== 6} onClick={() => void verifyMfa()}>확인</button></> : null}
          </div>
        </section>
      ) : null}
      <section>
        <div><h2>개인정보와 정책</h2><p>처리 항목, 보유기간과 권리 행사 방법을 확인할 수 있습니다.</p></div>
        <div className="settings-links"><Link href="/privacy">개인정보 처리방침</Link><Link href="/rights">권리침해 신고 안내</Link></div>
      </section>
      <section className="settings-appeal-section">
        <div><h2>운영조치 이의제기</h2><p>조치 통지 후 30일 이내에 대상 식별정보와 소명 내용을 제출할 수 있습니다.</p></div>
        <div>
          {moderationStatus?.sanctions.length ? <div className="settings-sanction-list">{moderationStatus.sanctions.map((item) => <button type="button" key={item.id} onClick={() => setAppealSanctionId(item.id)}><b>{item.type} · {item.status}</b><span>{item.reason}</span><small>제재 ID {item.id}</small></button>)}</div> : <p className="settings-empty">표시할 계정 제재가 없습니다.</p>}
          <div className="settings-appeal-form"><input value={appealCommentId} onChange={(event) => setAppealCommentId(event.target.value)} placeholder="댓글 ID" /><input value={appealReportId} onChange={(event) => setAppealReportId(event.target.value)} placeholder="신고 ID" /><input value={appealSanctionId} onChange={(event) => setAppealSanctionId(event.target.value)} placeholder="제재 ID" /><textarea value={appealStatement} onChange={(event) => setAppealStatement(event.target.value)} placeholder="사실관계와 이의제기 사유" maxLength={5000} /><button type="button" disabled={busy} onClick={() => void submitAppeal()}>이의제기 접수</button></div>
        </div>
      </section>
      <section className="danger-zone">
        <div><h2>회원 탈퇴</h2><p>OAuth 계정 연결, 입장과 반응을 삭제하고 댓글은 정책에 따라 삭제 또는 익명화합니다.</p></div>
        <button type="button" onClick={() => setConfirmation("delete")}>회원 탈퇴</button>
      </section>
      {confirmation ? (
        <div className="comment-confirm-backdrop" role="presentation" onMouseDown={() => !busy && setConfirmation(null)}>
          <section className="comment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="settings-confirm-title">{confirmation === "withdraw" ? "민감정보 처리 동의를 철회할까요?" : "회원 탈퇴를 진행할까요?"}</h2>
            <p>{confirmation === "withdraw" ? "기존 입장·반응과 작성 댓글이 삭제되며 되돌릴 수 없습니다. 주제 열람은 계속 가능합니다." : "계정 개인정보와 참여정보가 삭제되며 되돌릴 수 없습니다."}</p>
            <div><button disabled={busy} onClick={() => setConfirmation(null)}>취소</button><button className="danger" disabled={busy} onClick={() => void confirmAction()}>{busy ? "처리 중" : "확인"}</button></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
