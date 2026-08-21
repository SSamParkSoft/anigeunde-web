"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ModerationAppeal, ModerationReport, RightsCase } from "@/lib/types";

const contentActions = [
  ["HIDE", "숨김"],
  ["DELETE", "삭제"],
  ["RESTORE", "복구"],
  ["LOCK", "잠금"],
  ["UNLOCK", "잠금 해제"],
  ["TEMP_BLOCK", "임시 숨김"],
  ["LEGAL_REMOVE", "법적 제한"],
] as const;

function ReportCard({ report, onChanged }: { report: ModerationReport; onChanged: () => void }) {
  const [reason, setReason] = useState(report.action_reason);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(task: () => Promise<unknown>) {
    if (reason.trim().length < 2) {
      setError("조치 사유를 2자 이상 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await task();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "조치를 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`moderation-card priority-${report.priority.toLowerCase()}`}>
      <header>
        <div><b>{report.priority}</b><span>{report.reason_code}</span><span>{report.status}</span></div>
        <time>{new Date(report.created_at).toLocaleString("ko-KR")}</time>
      </header>
      <p className="moderation-comment-body">{report.comment_body ?? "삭제된 콘텐츠"}</p>
      {report.description ? <p className="moderation-description">신고 설명: {report.description}</p> : null}
      <label>
        <span>조치 사유</span>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} />
      </label>
      {error ? <p className="admin-news-error">{error}</p> : null}
      <div className="moderation-actions">
        {contentActions.map(([action, label]) => (
          <button type="button" disabled={busy} key={action} onClick={() => void run(() => api.moderateComment(report.comment_id, action, reason.trim()))}>{label}</button>
        ))}
      </div>
      <div className="moderation-actions report-states">
        {(["TRIAGED", "IN_REVIEW", "ACTIONED", "REJECTED", "CLOSED"] as const).map((nextStatus) => (
          <button type="button" disabled={busy} key={nextStatus} onClick={() => void run(() => api.updateModerationReport(report.id, nextStatus, reason.trim()))}>{nextStatus}</button>
        ))}
      </div>
      {report.comment_author_id ? (
        <div className="moderation-actions sanctions">
          <button type="button" disabled={busy} onClick={() => void run(() => api.sanctionUser(report.comment_author_id!, "WARN", reason.trim()))}>경고</button>
          <button type="button" disabled={busy} onClick={() => void run(() => api.sanctionUser(report.comment_author_id!, "SUSPEND", reason.trim(), 7))}>7일 정지</button>
          <button type="button" disabled={busy} onClick={() => void run(() => api.sanctionUser(report.comment_author_id!, "SUSPEND", reason.trim(), 30))}>30일 정지</button>
          <button type="button" disabled={busy} onClick={() => void run(() => api.sanctionUser(report.comment_author_id!, "PERMANENT_RESTRICTION", reason.trim()))}>영구 제한</button>
        </div>
      ) : null}
    </article>
  );
}

function AppealCard({ appeal, onChanged }: { appeal: ModerationAppeal; onChanged: () => void }) {
  const [resolution, setResolution] = useState(appeal.resolution);
  const [busy, setBusy] = useState(false);
  async function resolve(nextStatus: "ACCEPTED" | "REJECTED" | "CLOSED") {
    if (resolution.trim().length < 2) return;
    setBusy(true);
    try {
      await api.resolveModerationAppeal(appeal.id, nextStatus, resolution.trim());
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="moderation-card appeal-card">
      <header><b>이의제기</b><span>{appeal.status}</span></header>
      <p>{appeal.statement}</p>
      <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="검토 결과와 근거" />
      <div className="moderation-actions">
        <button disabled={busy} onClick={() => void resolve("ACCEPTED")}>인용</button>
        <button disabled={busy} onClick={() => void resolve("REJECTED")}>기각</button>
        <button disabled={busy} onClick={() => void resolve("CLOSED")}>종결</button>
      </div>
    </article>
  );
}

function RightsCaseCard({ item, onChanged }: { item: RightsCase; onChanged: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [reason, setReason] = useState(item.action_reason);
  const [authorStatement, setAuthorStatement] = useState(item.author_statement);
  const [requesterNotified, setRequesterNotified] = useState(Boolean(item.requester_notified_at));
  const [authorNotified, setAuthorNotified] = useState(Boolean(item.author_notified_at));
  const [busy, setBusy] = useState(false);
  async function save() {
    if (reason.trim().length < 2) return;
    setBusy(true);
    try {
      await api.updateRightsCase(item.id, {
        status,
        action_reason: reason.trim(),
        author_statement: authorStatement.trim(),
        requester_notified: requesterNotified,
        author_notified: authorNotified,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`moderation-card priority-${item.priority.toLowerCase()}`}>
      <header><div><b>{item.priority}</b><span>{item.case_type}</span><span>{item.status}</span></div><time>{new Date(item.created_at).toLocaleString("ko-KR")}</time></header>
      <p className="moderation-comment-body">{item.statement}</p>
      <p className="moderation-description">신청인: {item.requester_name} · {item.requester_email}<br />대상: <a href={item.target_url} target="_blank" rel="noreferrer">{item.target_url}</a></p>
      <label><span>처리 상태</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{["RECEIVED", "NEEDS_INFORMATION", "IN_REVIEW", "TEMP_HIDDEN", "AUTHOR_RESPONSE", "RESTORED", "REMOVED", "REJECTED", "CLOSED"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>조치 사유</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label><span>작성자 소명</span><textarea value={authorStatement} onChange={(event) => setAuthorStatement(event.target.value)} /></label>
      <div className="moderation-checks"><label><input type="checkbox" checked={requesterNotified} onChange={(event) => setRequesterNotified(event.target.checked)} /> 신청인 결과 통지 완료</label><label><input type="checkbox" checked={authorNotified} onChange={(event) => setAuthorNotified(event.target.checked)} /> 작성자 조치 통지 완료</label></div>
      <div className="moderation-actions"><button disabled={busy} onClick={() => void save()}>기록 저장·조치</button></div>
    </article>
  );
}

export function ModerationConsole() {
  const router = useRouter();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [rightsCases, setRightsCases] = useState<RightsCase[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rightsForm, setRightsForm] = useState({ case_type: "DEFAMATION", requester_name: "", requester_email: "", target_url: "", comment_id: "", statement: "", priority: "NORMAL" as "NORMAL" | "HIGH" | "URGENT" });

  async function refresh(includeRights = isAdmin) {
    setLoading(true);
    try {
      const [reportResult, appealResult, rightsResult] = await Promise.all([api.moderationReports(), api.moderationAppeals(), includeRights ? api.rightsCases() : Promise.resolve({ items: [] })]);
      setReports(reportResult.items);
      setAppeals(appealResult.items);
      setRightsCases(rightsResult.items);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "신고 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void api.session().then((session) => {
      if (!active) return;
      if (["MODERATOR", "ADMIN"].includes(session.profile?.role ?? "")) {
        const admin = session.profile?.role === "ADMIN";
        setAuthorized(true);
        setIsAdmin(admin);
        void refresh(admin);
      } else {
        router.replace("/");
      }
    }).catch(() => router.replace("/"));
    return () => { active = false; };
    // `refresh` is intentionally invoked once after the role check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function submitRightsCase() {
    await api.createRightsCase({ ...rightsForm, comment_id: rightsForm.comment_id || undefined });
    setRightsForm({ case_type: "DEFAMATION", requester_name: "", requester_email: "", target_url: "", comment_id: "", statement: "", priority: "NORMAL" });
    await refresh(true);
  }

  if (!authorized) return <main className="admin-news-page"><p className="admin-news-state">관리자 권한을 확인하는 중입니다.</p></main>;

  return (
    <main className="admin-news-page moderation-page">
      <header className="admin-news-header">
        <div><span>OPERATIONS / MODERATION</span><h1>신고 관리</h1><p>긴급 신고를 우선 확인하고 모든 조치 사유를 기록합니다.</p></div>
        <button type="button" onClick={() => void refresh(isAdmin)}>새로고침</button>
      </header>
      {error ? <p className="admin-news-error">{error}</p> : null}
      {loading ? <p className="admin-news-state">신고를 불러오는 중입니다.</p> : null}
      {!loading ? (
        <>
          <section className="moderation-section"><h2>신고 {reports.length}건</h2><div className="moderation-list">{reports.map((report) => <ReportCard report={report} onChanged={() => void refresh()} key={report.id} />)}</div></section>
          <section className="moderation-section"><h2>이의제기 {appeals.length}건</h2><div className="moderation-list">{appeals.map((appeal) => <AppealCard appeal={appeal} onChanged={() => void refresh()} key={appeal.id} />)}</div></section>
          {isAdmin ? <section className="moderation-section"><h2>권리침해 사건 {rightsCases.length}건</h2><div className="rights-intake"><select value={rightsForm.case_type} onChange={(event) => setRightsForm((value) => ({ ...value, case_type: event.target.value }))}>{["DEFAMATION", "PRIVACY", "PERSONAL_INFORMATION", "COPYRIGHT_STOP", "COPYRIGHT_RESUME"].map((value) => <option key={value}>{value}</option>)}</select><input placeholder="신청인 성명" value={rightsForm.requester_name} onChange={(event) => setRightsForm((value) => ({ ...value, requester_name: event.target.value }))} /><input type="email" placeholder="신청인 이메일" value={rightsForm.requester_email} onChange={(event) => setRightsForm((value) => ({ ...value, requester_email: event.target.value }))} /><input placeholder="대상 URL" value={rightsForm.target_url} onChange={(event) => setRightsForm((value) => ({ ...value, target_url: event.target.value }))} /><input placeholder="댓글 ID (있는 경우)" value={rightsForm.comment_id} onChange={(event) => setRightsForm((value) => ({ ...value, comment_id: event.target.value }))} /><textarea placeholder="권리침해 요청 내용" value={rightsForm.statement} onChange={(event) => setRightsForm((value) => ({ ...value, statement: event.target.value }))} /><button type="button" onClick={() => void submitRightsCase()}>이메일 사건 등록</button></div><div className="moderation-list">{rightsCases.map((item) => <RightsCaseCard item={item} onChanged={() => void refresh(true)} key={item.id} />)}</div></section> : null}
        </>
      ) : null}
    </main>
  );
}
