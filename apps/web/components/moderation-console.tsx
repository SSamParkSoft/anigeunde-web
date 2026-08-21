"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ModerationAppeal, ModerationReport } from "@/lib/types";

const contentActions = [
  ["HIDE", "숨김"],
  ["DELETE", "삭제"],
  ["RESTORE", "복구"],
] as const;

const priorityLabels: Record<string, string> = {
  URGENT: "긴급",
  HIGH: "높음",
  NORMAL: "일반",
};

const reasonLabels: Record<string, string> = {
  HARASSMENT: "욕설·괴롭힘",
  HATE_OR_DISCRIMINATION: "혐오·차별",
  PERSONAL_INFORMATION: "개인정보·신상정보 노출",
  FALSE_OR_DEFAMATORY: "허위사실·명예훼손",
  PRIVACY_INVASION: "사생활 침해",
  ILLEGAL_OR_SEXUAL: "불법·성적 콘텐츠",
  SPAM: "스팸·도배",
  IMPERSONATION: "사칭",
  VIOLENCE_THREAT: "실제 폭력·살해 위협",
  NONCONSENSUAL_SEXUAL: "불법촬영물",
  CSAM: "아동·청소년 성착취물",
  DOXXING: "주소·전화번호 등 신상털이",
  ONGOING_CRIME: "현재 진행 중인 범죄 위험",
  OTHER: "기타",
};

const reportStatusActions = [
  ["REJECTED", "반려"],
  ["OPEN", "처리 전"],
  ["ACTIONED", "처리 완료"],
] as const;

function visibleReportStatus(status: string) {
  if (status === "REJECTED") return { className: "status-rejected", label: "반려" };
  if (["ACTIONED", "CLOSED"].includes(status)) return { className: "status-actioned", label: "처리 완료" };
  return { className: "status-open", label: "처리 전" };
}

function visibleAppealStatus(status: string) {
  return status === "OPEN"
    ? { className: "status-open", label: "처리 전" }
    : { className: "status-closed", label: "처리 완료" };
}

const PAGE_SIZE = 8;

function Pagination({
  label,
  page,
  totalPages,
  onChange,
}: {
  label: string;
  page: number;
  totalPages: number;
  onChange: (nextPage: number) => void;
}) {
  return (
    <nav className="moderation-pagination" aria-label={`${label} 페이지`}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>이전</button>
      <span><b>{page}</b> / {totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>다음</button>
    </nav>
  );
}

function ReportCard({ report, onChanged }: { report: ModerationReport; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState(report.action_reason);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visibleStatus = visibleReportStatus(report.status);

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
    <article className={`moderation-card moderation-compact priority-${report.priority.toLowerCase()}`}>
      <button className="moderation-summary" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
        <span className="moderation-summary-main">
          <span className="moderation-summary-meta"><b>{priorityLabels[report.priority] ?? "일반"}</b><span>{reasonLabels[report.reason_code] ?? "기타"}</span></span>
          <strong>{report.comment_body ?? "삭제된 콘텐츠"}</strong>
        </span>
        <time>{new Date(report.created_at).toLocaleString("ko-KR")}</time>
        <span className={`moderation-status ${visibleStatus.className}`}>{visibleStatus.label}</span>
        <span className="moderation-summary-toggle">{expanded ? "접기" : "보기"}</span>
      </button>
      {expanded ? (
        <div className="moderation-details">
          <p className="moderation-comment-body">{report.comment_body ?? "삭제된 콘텐츠"}</p>
          {report.description ? <p className="moderation-description">신고 설명: {report.description}</p> : null}
          <label>
            <span>조치 사유</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} />
          </label>
          {error ? <p className="admin-news-error">{error}</p> : null}
          <div className="moderation-action-group">
            <div><b>댓글 처리</b><span>신고된 댓글을 숨기거나 삭제하고 필요하면 복구합니다.</span></div>
            <div className="moderation-actions">
              {contentActions.map(([action, label]) => (
                <button type="button" disabled={busy} key={action} onClick={() => void run(() => api.moderateComment(report.comment_id, action, reason.trim(), report.comment_status))}>{label}</button>
              ))}
            </div>
          </div>
          <div className="moderation-action-group">
            <div><b>신고 상태</b><span>신고의 처리 여부와 반려 결과를 기록합니다.</span></div>
            <div className="moderation-actions report-states">
              {reportStatusActions.map(([nextStatus, label]) => (
                <button type="button" disabled={busy || report.status === nextStatus} key={nextStatus} onClick={() => void run(() => api.updateModerationReport(report.id, nextStatus, reason.trim(), report.status))}>{label}</button>
              ))}
            </div>
          </div>
          {report.comment_author_id ? (
            <div className="moderation-action-group">
              <div><b>유저 처리</b><span>댓글 작성자의 서비스 이용을 제한합니다.</span></div>
              <div className="moderation-actions sanctions">
                <button type="button" disabled={busy} onClick={() => void run(() => api.sanctionUser(report.comment_author_id!, "SUSPEND", reason.trim(), 7))}>7일 정지</button>
                <button type="button" disabled={busy} onClick={() => void run(() => api.sanctionUser(report.comment_author_id!, "SUSPEND", reason.trim(), 30))}>30일 정지</button>
                <button type="button" disabled={busy} onClick={() => void run(() => api.sanctionUser(report.comment_author_id!, "PERMANENT_RESTRICTION", reason.trim()))}>영구 제한</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function AppealCard({ appeal, onChanged }: { appeal: ModerationAppeal; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const statementParts = appeal.statement.split("\n\n");
  const appealTitle = statementParts.length > 1 ? statementParts[0] : "이의제기";
  const appealBody = statementParts.length > 1 ? statementParts.slice(1).join("\n\n") : appeal.statement;
  const visibleStatus = visibleAppealStatus(appeal.status);
  async function updateStatus(nextStatus: "OPEN" | "CLOSED") {
    setBusy(true);
    try {
      await api.resolveModerationAppeal(appeal.id, nextStatus, nextStatus === "OPEN" ? "처리 전으로 변경" : "처리 완료", appeal.status);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="moderation-card moderation-compact appeal-card">
      <button className="moderation-summary appeal-summary" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
        <span className="moderation-summary-main">
          <strong>{appealTitle}</strong>
          <span className="appeal-submitter-email">{appeal.submitter_email ?? "제출자 이메일 확인 불가"}</span>
        </span>
        <time>{new Date(appeal.created_at).toLocaleString("ko-KR")}</time>
        <span className={`moderation-status ${visibleStatus.className}`}>{visibleStatus.label}</span>
        <span className="moderation-summary-toggle">{expanded ? "접기" : "보기"}</span>
      </button>
      {expanded ? (
        <div className="moderation-details appeal-details">
          <p>{appealBody}</p>
          <div className="moderation-action-group">
            <div><b>이의제기 처리</b><span>이의제기의 처리 상태를 변경합니다.</span></div>
            <div className="moderation-actions appeal-status-actions">
              <button type="button" className={appeal.status === "OPEN" ? "current" : ""} disabled={busy || appeal.status === "OPEN"} onClick={() => void updateStatus("OPEN")}>처리 전</button>
              <button type="button" className={appeal.status !== "OPEN" ? "current" : ""} disabled={busy || appeal.status !== "OPEN"} onClick={() => void updateStatus("CLOSED")}>처리 완료</button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ModerationConsole() {
  const router = useRouter();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [reportPage, setReportPage] = useState(1);
  const [appealPage, setAppealPage] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);
  const [appealTotal, setAppealTotal] = useState(0);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [appealTotalPages, setAppealTotalPages] = useState(1);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (nextReportPage: number, nextAppealPage: number, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [reportResult, appealResult] = await Promise.all([
        api.moderationReports(nextReportPage, PAGE_SIZE),
        api.moderationAppeals(nextAppealPage, PAGE_SIZE),
      ]);
      setReports(reportResult.items);
      setAppeals(appealResult.items);
      setReportPage(reportResult.page);
      setAppealPage(appealResult.page);
      setReportTotal(reportResult.total);
      setAppealTotal(appealResult.total);
      setReportTotalPages(reportResult.total_pages);
      setAppealTotalPages(appealResult.total_pages);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "신고 목록을 불러오지 못했습니다.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api.session().then((session) => {
      if (!active) return;
      if (["MODERATOR", "ADMIN"].includes(session.profile?.role ?? "")) {
        setAuthorized(true);
        void refresh(1, 1);
      } else {
        router.replace("/");
      }
    }).catch(() => router.replace("/"));
    return () => { active = false; };
  }, [refresh, router]);

  if (!authorized) return <main className="admin-news-page"><p className="admin-news-state">관리자 권한을 확인하는 중입니다.</p></main>;

  return (
    <main className="admin-news-page moderation-page">
      <header className="admin-news-header">
        <div><span>OPERATIONS / MODERATION</span><h1>신고 관리</h1><p>긴급 신고를 우선 확인하고 모든 조치 사유를 기록합니다.</p></div>
        <button type="button" onClick={() => void refresh(reportPage, appealPage)}>새로고침</button>
      </header>
      {error ? <p className="admin-news-error">{error}</p> : null}
      {loading ? <p className="admin-news-state">신고를 불러오는 중입니다.</p> : null}
      {!loading ? (
        <>
          <section className="moderation-section">
            <h2>신고 {reportTotal}건</h2>
            <div className="moderation-list">{reports.map((report) => <ReportCard report={report} onChanged={() => void refresh(reportPage, appealPage, false)} key={report.id} />)}</div>
            {!reports.length ? <p className="admin-news-state">접수된 신고가 없습니다.</p> : null}
            <Pagination label="신고" page={reportPage} totalPages={reportTotalPages} onChange={(nextPage) => void refresh(nextPage, appealPage)} />
          </section>
          <section className="moderation-section">
            <h2>이의제기 {appealTotal}건</h2>
            <div className="moderation-list">{appeals.map((appeal) => <AppealCard appeal={appeal} onChanged={() => void refresh(reportPage, appealPage, false)} key={appeal.id} />)}</div>
            {!appeals.length ? <p className="admin-news-state">접수된 이의제기가 없습니다.</p> : null}
            <Pagination label="이의제기" page={appealPage} totalPages={appealTotalPages} onChange={(nextPage) => void refresh(reportPage, nextPage)} />
          </section>
        </>
      ) : null}
    </main>
  );
}
