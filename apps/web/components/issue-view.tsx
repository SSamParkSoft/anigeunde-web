"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ACCOUNT_READY_EVENT,
  clearPendingParticipation,
  readPendingParticipation,
  startSocialLogin,
  type LoginProvider,
  type PendingParticipation,
} from "@/lib/auth";
import { api } from "@/lib/api";
import { parseApiDate } from "@/lib/datetime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Comment, CommentReportReason, IssueDetail } from "@/lib/types";
import { SocialLoginButtons } from "@/components/social-login-buttons";
import { IssueShare } from "@/components/issue-share";
import { Pagination } from "@/components/pagination";

const COMMENT_PAGE_SIZE = 20;

export function IssueView({ slug }: { slug: string }) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [commentSort, setCommentSort] = useState<"latest" | "popular">("popular");
  const [commentPage, setCommentPage] = useState(1);
  const [accountReadyVersion, setAccountReadyVersion] = useState(0);
  const pendingParticipation = useRef<PendingParticipation | null>(null);
  const resumingLogin = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => setIsAuthenticated(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      queueMicrotask(() => setError("로그인을 완료하지 못했습니다. 다시 시도해주세요."));
      window.history.replaceState({}, "", window.location.pathname);
    }

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleAccountReady = () => setAccountReadyVersion((current) => current + 1);
    window.addEventListener(ACCOUNT_READY_EVENT, handleAccountReady);
    return () => window.removeEventListener(ACCOUNT_READY_EVENT, handleAccountReady);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let active = true;
    api.issue(slug)
      .then(async (issueData) => {
        const commentData = await api.comments(issueData.id);
        if (!active) return;
        setIssue(issueData);
        setComments(commentData.items);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!isAuthenticated || !issue || resumingLogin.current) return;
    const pending = readPendingParticipation(slug);
    if (!pending) return;

    resumingLogin.current = true;
    void (async () => {
      try {
        const authSession = await api.session();
        if (authSession.requires_bootstrap) return;

        if (pending.kind === "position" && pending.optionId) {
          try {
            const result = await api.choosePosition(issue.id, pending.optionId);
            setIssue((current) => current ? {
              ...current,
              my_position_id: result.my_position_id,
              results: result.results,
            } : current);
            clearPendingParticipation();
          } catch (reason) {
            const message = reason instanceof Error ? reason.message : "참여를 완료하지 못했습니다.";
            if (message.includes("민감정보") || message.includes("필수 동의")) {
              pendingParticipation.current = pending;
              setLoginOpen(true);
            } else {
              throw reason;
            }
          }
        } else if (pending.kind === "comment") {
          setError("로그인이 완료되었습니다. 의견을 등록하려면 먼저 위에서 내 생각을 선택해주세요.");
          clearPendingParticipation();
        } else {
          clearPendingParticipation();
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "로그인 후 참여 준비를 완료하지 못했습니다.");
      } finally {
        resumingLogin.current = false;
      }
    })();
  }, [accountReadyVersion, isAuthenticated, issue, slug]);

  async function persistPosition(optionId: string) {
    if (!issue || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api.choosePosition(issue.id, optionId);
      setIssue({ ...issue, my_position_id: result.my_position_id, results: result.results });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "입장을 저장하지 못했습니다.";
      if (isAuthenticated && (message.includes("민감정보") || message.includes("필수 동의"))) {
        pendingParticipation.current = { version: 1, issueSlug: slug, kind: "position", optionId };
        setLoginOpen(true);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function choosePosition(optionId: string) {
    if (isAuthenticated) {
      void persistPosition(optionId);
      return;
    }
    pendingParticipation.current = { version: 1, issueSlug: slug, kind: "position", optionId };
    setLoginOpen(true);
  }

  function requireParticipation(action: () => void | Promise<void>) {
    const continueAfterLogin = () => {
      if (!issue?.my_position_id) {
        setError("먼저 위에서 내 생각을 선택해주세요.");
        document.querySelector(".position-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      return action();
    };
    if (isAuthenticated) {
      void continueAfterLogin();
      return;
    }
    pendingParticipation.current = { version: 1, issueSlug: slug, kind: "retry" };
    setLoginOpen(true);
  }

  async function beginSocialLogin(provider: LoginProvider) {
    const pending = pendingParticipation.current ?? {
      version: 1 as const,
      issueSlug: slug,
      kind: "retry" as const,
    };
    await startSocialLogin(provider, pending);
  }

  async function completeAuthenticatedParticipation() {
    await api.consentSensitivePosition();
    const pending = pendingParticipation.current;
    pendingParticipation.current = null;
    setLoginOpen(false);
    if (pending?.kind === "position" && pending.optionId) {
      await persistPosition(pending.optionId);
      clearPendingParticipation();
    }
  }

  async function createComment(body: string) {
    if (!issue) return;
    const created = await api.createComment(issue.id, body);
    setComments((current) => [created, ...current]);
    setCommentPage(1);
  }

  async function submitOpinion(body: string) {
    if (!isAuthenticated) {
      pendingParticipation.current = { version: 1, issueSlug: slug, kind: "comment", commentBody: body };
      setLoginOpen(true);
      return false;
    }
    if (!issue?.my_position_id) {
      setError("의견을 등록하려면 먼저 위에서 내 생각을 선택해주세요.");
      document.querySelector(".position-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    await createComment(body);
    return true;
  }

  async function createRebuttal(commentId: string, body: string) {
    await api.createRebuttal(commentId, body);
    await refreshComments();
  }

  async function refreshComments() {
    if (!issue) return;
    const refreshed = await api.comments(issue.id);
    setComments(refreshed.items);
  }

  function requireLogin(action: () => void | Promise<void>) {
    if (isAuthenticated) {
      void action();
      return;
    }
    pendingParticipation.current = { version: 1, issueSlug: slug, kind: "retry" };
    setLoginOpen(true);
  }

  async function deleteComment(comment: Comment) {
    try {
      await api.deleteComment(comment.id);
      await refreshComments();
      setNotice("의견을 삭제했습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "의견을 삭제하지 못했습니다.");
    }
  }

  async function reportComment(
    comment: Comment,
    reasonCode: CommentReportReason,
    description: string,
  ) {
    try {
      const result = await api.reportComment(comment.id, reasonCode, description);
      setNotice(result.duplicate ? "이미 접수된 신고입니다." : "신고가 접수되었습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "신고를 접수하지 못했습니다.");
      throw reason;
    }
  }

  async function blockCommentAuthor(comment: Comment) {
    try {
      await api.blockCommentAuthor(comment.id);
      await refreshComments();
      setNotice("이 이용자의 의견을 가렸습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이용자를 차단하지 못했습니다.");
    }
  }

  async function unblockCommentAuthor(comment: Comment) {
    try {
      await api.unblockCommentAuthor(comment.id);
      await refreshComments();
      setNotice("이용자 차단을 해제했습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "차단을 해제하지 못했습니다.");
    }
  }

  async function react(comment: Comment, type: "like" | "dislike") {
    const updated = await api.toggleReaction(comment, type);
    if (updated) {
      setComments((current) => replaceComment(current, updated));
    } else {
      const refreshed = await api.comments(issue!.id);
      setComments(refreshed.items);
    }
  }

  if (loading) return <main className="issue-page"><div className="issue-loading">주제를 읽는 중<span>...</span></div></main>;
  if (!issue) return <main className="issue-page"><div className="fatal-error"><b>주제를 열지 못했습니다.</b><p>{error}</p><Link href="/">홈으로</Link></div></main>;

  const selectedOption = issue.options.find((option) => option.id === issue.my_position_id);
  const sortedComments = [...comments].sort((a, b) => (
    commentSort === "popular"
      ? popularityScore(b) - popularityScore(a) || parseApiDate(b.created_at).getTime() - parseApiDate(a.created_at).getTime()
      : parseApiDate(b.created_at).getTime() - parseApiDate(a.created_at).getTime()
  ));
  const commentTotalPages = Math.max(1, Math.ceil(sortedComments.length / COMMENT_PAGE_SIZE));
  const currentCommentPage = Math.min(commentPage, commentTotalPages);
  const pagedComments = sortedComments.slice(
    (currentCommentPage - 1) * COMMENT_PAGE_SIZE,
    currentCommentPage * COMMENT_PAGE_SIZE,
  );

  function changeCommentPage(page: number) {
    setCommentPage(page);
    document.querySelector(".discussion-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="issue-page">
      <div className="issue-shell">
        <section className="issue-intro">
          <div className="issue-kicker">
            <span>{issue.category}</span>
            <span className="status-dot">{issue.participation_open ? "토론 중" : "마감"}</span>
            <span>업데이트 2026.08.18</span>
          </div>
          <h1>{issue.question}</h1>
        </section>

        <div className="issue-share-desktop">
          <IssueShare slug={issue.slug} question={issue.question} />
        </div>

        {!issue.my_position_id && issue.participation_open ? (
          <section className="position-panel">
            <div className="panel-label"><span>STEP 01</span><b>아니근데, 너는?</b></div>
            <>
              <h2>먼저 내 생각을 골라주세요.</h2>
              <p className="privacy-copy">선택하기 전에는 다른 참여자의 결과가 보이지 않습니다.</p>
              <div className="option-grid">
                {issue.options.map((option, index) => (
                  <button onClick={() => choosePosition(option.id)} disabled={submitting} key={option.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {option.label}
                    <b>→</b>
                  </button>
                ))}
              </div>
              <small className="consent-note">선택 시 정치적 견해에 해당할 수 있는 정보 처리에 동의합니다.</small>
            </>
          </section>
        ) : !issue.my_position_id ? (
          <section className="position-panel"><h2>참여가 마감된 주제입니다.</h2><p>기존 의견과 결과는 계속 확인할 수 있습니다.</p>{issue.results ? <ResultPanel issue={issue} selectedLabel="" onChange={() => undefined} /> : null}</section>
        ) : null}

        {!issue.my_position_id ? (
          <div className="issue-share-mobile">
            <IssueShare slug={issue.slug} question={issue.question} />
          </div>
        ) : null}

        {error ? <div className="inline-error">{error}</div> : null}
        {notice ? <div className="action-toast" role="status" aria-live="polite">{notice}</div> : null}

        {issue.my_position_id ? (
          <div className="discussion-layout">
            <section className="discussion-section">
              <div className="discussion-heading">
                <div><h2>의견</h2></div>
              </div>
              <div className="discussion-toolbar">
                <span>{comments.length}개의 의견</span>
                <div className="comment-sort-toggle" role="group" aria-label="의견 정렬">
                  <button className={commentSort === "popular" ? "active" : ""} onClick={() => { setCommentSort("popular"); setCommentPage(1); }}>인기순</button>
                  <button className={commentSort === "latest" ? "active" : ""} onClick={() => { setCommentSort("latest"); setCommentPage(1); }}>최신순</button>
                </div>
              </div>
              <div className="comment-list">
                {pagedComments.map((comment, index) => (
                  <CommentCard
                    comment={comment}
                    index={(currentCommentPage - 1) * COMMENT_PAGE_SIZE + index}
                    key={comment.id}
                    onReact={react}
                    onRebuttal={createRebuttal}
                    requireParticipation={requireParticipation}
                    requireLogin={requireLogin}
                    onDelete={deleteComment}
                    onReport={reportComment}
                    onBlock={blockCommentAuthor}
                    onUnblock={unblockCommentAuthor}
                    participationOpen={issue.participation_open}
                  />
                ))}
              </div>
              <Pagination currentPage={currentCommentPage} totalPages={commentTotalPages} label="의견 목록 페이지" onPageChange={changeCommentPage} />
              {issue.participation_open ? <Composer title="의견을 남겨보세요." actionLabel="입력" onSubmit={submitOpinion} inline /> : <p className="consent-note">7일의 참여 기간이 종료되었습니다.</p>}
            </section>
            <aside className="results-sidebar">
              <ResultPanel issue={issue} selectedLabel={selectedOption?.label ?? ""} onChange={() => setIssue({ ...issue, my_position_id: null, results: null })} />
            </aside>
            <div className="issue-share-mobile">
              <IssueShare slug={issue.slug} question={issue.question} />
            </div>
          </div>
        ) : (
          <section className="discussion-section public-discussion">
            <div className="discussion-heading">
              <div><h2>의견</h2><p>의견은 누구나 읽을 수 있어요.</p></div>
            </div>
            <div className="discussion-toolbar">
              <span>{comments.length}개의 의견</span>
              <div className="comment-sort-toggle" role="group" aria-label="의견 정렬">
                <button className={commentSort === "popular" ? "active" : ""} onClick={() => { setCommentSort("popular"); setCommentPage(1); }}>인기순</button>
                <button className={commentSort === "latest" ? "active" : ""} onClick={() => { setCommentSort("latest"); setCommentPage(1); }}>최신순</button>
              </div>
            </div>
            <div className="comment-list">
              {pagedComments.map((comment, index) => (
                <CommentCard
                  comment={comment}
                  index={(currentCommentPage - 1) * COMMENT_PAGE_SIZE + index}
                  key={comment.id}
                  onReact={react}
                  onRebuttal={createRebuttal}
                  requireParticipation={requireParticipation}
                  requireLogin={requireLogin}
                  onDelete={deleteComment}
                  onReport={reportComment}
                  onBlock={blockCommentAuthor}
                  onUnblock={unblockCommentAuthor}
                  participationOpen={issue.participation_open}
                />
              ))}
            </div>
            <Pagination currentPage={currentCommentPage} totalPages={commentTotalPages} label="의견 목록 페이지" onPageChange={changeCommentPage} />
            {issue.participation_open ? <Composer title="의견을 남겨보세요." actionLabel="입력" onSubmit={submitOpinion} inline /> : <p className="consent-note">7일의 참여 기간이 종료되었습니다.</p>}
          </section>
        )}
      </div>
      {loginOpen ? <LoginGate onClose={() => {
        pendingParticipation.current = null;
        setLoginOpen(false);
      }} isAuthenticated={isAuthenticated} onConsentComplete={completeAuthenticatedParticipation} onProvider={beginSocialLogin} /> : null}
    </main>
  );
}

function ResultPanel({ issue, selectedLabel, onChange }: { issue: IssueDetail; selectedLabel: string; onChange: () => void }) {
  return (
    <div className="result-panel">
      {selectedLabel ? <div className="my-position-row">
        <div><small>내 생각</small><b>{selectedLabel}</b></div>
        {issue.participation_open ? <button onClick={onChange}>변경하기</button> : null}
      </div> : null}
      <div className="result-heading">
        <h2>참여자 {issue.results?.total.toLocaleString("ko-KR")}인의 선택</h2>
        <span>실시간 집계 · 대표성 없음</span>
      </div>
      <div className="result-bars">
        {issue.results?.options.map((option) => (
          <div className="result-row" key={option.option_id}>
            <div><b>{option.label}</b><strong>{option.percentage}%</strong></div>
            <span><i style={{ width: `${option.percentage}%` }} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

const reportReasons: Array<{ value: CommentReportReason; label: string }> = [
  { value: "POLICY_VIOLATION", label: "운영정책 위반" },
  { value: "HARASSMENT_OR_HATE", label: "괴롭힘·욕설·혐오" },
  { value: "FALSE_OR_DEFAMATORY", label: "허위사실·명예훼손" },
  { value: "PRIVACY", label: "개인정보 노출" },
  { value: "ILLEGAL_OR_DANGEROUS", label: "불법·위험 콘텐츠" },
  { value: "SPAM", label: "도배·광고" },
  { value: "OTHER", label: "기타" },
];

function CommentCard({
  comment,
  index,
  onReact,
  onRebuttal,
  requireParticipation,
  requireLogin,
  onDelete,
  onReport,
  onBlock,
  onUnblock,
  participationOpen,
  parentNickname,
}: {
  comment: Comment;
  index: number;
  onReact: (comment: Comment, type: "like" | "dislike") => Promise<void>;
  onRebuttal: (commentId: string, body: string) => Promise<void>;
  requireParticipation: (action: () => void | Promise<void>) => void;
  requireLogin: (action: () => void | Promise<void>) => void;
  onDelete: (comment: Comment) => Promise<void>;
  onReport: (
    comment: Comment,
    reasonCode: CommentReportReason,
    description: string,
  ) => Promise<void>;
  onBlock: (comment: Comment) => Promise<void>;
  onUnblock: (comment: Comment) => Promise<void>;
  participationOpen: boolean;
  parentNickname?: string;
}) {
  const [replying, setReplying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState<CommentReportReason>("POLICY_VIOLATION");
  const [reportDescription, setReportDescription] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "block" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!confirmAction) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmAction(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [confirmAction]);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionBusy(true);
    try {
      await onReport(comment, reportReason, reportDescription);
      setReporting(false);
      setMenuOpen(false);
      setReportDescription("");
    } finally {
      setActionBusy(false);
    }
  }

  function requestConfirmation(action: "delete" | "block") {
    setMenuOpen(false);
    setConfirmAction(action);
  }

  function runConfirmedAction() {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "delete") requireLogin(() => onDelete(comment));
    if (action === "block") requireLogin(() => onBlock(comment));
  }

  return (
    <div className={`comment-thread comment-depth-${Math.min(comment.depth, 2)}`}>
      <article className={`comment-card${comment.is_deleted ? " is-deleted" : ""}${comment.is_blocked ? " is-blocked" : ""}`}>
        <div className="comment-index">#{String(index + 1).padStart(2, "0")}</div>
        <div className="comment-main">
          <header>
            <div><b>{comment.nickname}</b><span>{comment.position} · {formatCommentTime(comment.created_at)}</span></div>
            <div className="comment-header-actions">
              {comment.is_mine && !comment.is_deleted ? <em>내 의견</em> : null}
              {!comment.is_deleted && !comment.is_blocked ? (
                <div className="comment-menu" ref={menuRef}>
                  <button type="button" className="comment-menu-trigger" aria-label="의견 메뉴" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>···</button>
                  {menuOpen ? (
                    <div className="comment-menu-popover">
                      {comment.can_delete ? (
                        <button type="button" className="danger" onClick={() => requestConfirmation("delete")}>삭제하기</button>
                      ) : (
                        <>
                          <button type="button" onClick={() => requireLogin(() => { setReporting(true); setMenuOpen(false); })}>신고하기</button>
                          <button type="button" onClick={() => requestConfirmation("block")}>이 사용자 차단</button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>
          <p className={comment.is_deleted || comment.is_blocked ? "comment-placeholder" : undefined}>
            {parentNickname ? <b className="reply-target">@{parentNickname}</b> : null}
            {comment.body}
          </p>
          {comment.is_blocked ? (
            <div className="comment-actions"><button type="button" onClick={() => requireLogin(() => onUnblock(comment))}>차단 해제</button></div>
          ) : !comment.is_deleted ? (
            <div className="comment-actions">
              <button disabled={!participationOpen} className={comment.viewer_reactions.includes("LIKE") ? "active" : ""} onClick={() => requireParticipation(() => onReact(comment, "like"))}>
                좋아요 <b>{comment.like_count}</b>
              </button>
              <button disabled={!participationOpen} className={comment.viewer_reactions.includes("DISLIKE") ? "active dark" : ""} onClick={() => requireParticipation(() => onReact(comment, "dislike"))}>
                싫어요 <b>{comment.dislike_count}</b>
              </button>
              <button disabled={!participationOpen} className="rebuttal-button" onClick={() => requireParticipation(() => setReplying((value) => !value))}>
                댓글 <b>{comment.rebuttal_count}</b> <span>↳</span>
              </button>
            </div>
          ) : null}
          {reporting ? (
            <form className="comment-report-form" onSubmit={submitReport}>
              <label>
                신고 사유
                <select value={reportReason} onChange={(event) => setReportReason(event.target.value as CommentReportReason)}>
                  {reportReasons.map((reason) => <option value={reason.value} key={reason.value}>{reason.label}</option>)}
                </select>
              </label>
              <label>
                추가 설명 <small>선택</small>
                <textarea maxLength={500} value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} placeholder="운영자가 확인할 내용을 적어주세요." />
              </label>
              <div><button type="button" onClick={() => setReporting(false)}>취소</button><button type="submit" disabled={actionBusy}>신고 접수</button></div>
            </form>
          ) : null}
          {replying ? <Composer title={`@${comment.nickname}에게 댓글`} actionLabel="댓글 달기" onSubmit={async (body) => { await onRebuttal(comment.id, body); setReplying(false); }} compact /> : null}
        </div>
      </article>
      {confirmAction ? (
        <div className="comment-confirm-backdrop" role="presentation" onMouseDown={() => setConfirmAction(null)}>
          <section className="comment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`comment-confirm-${comment.id}`} onMouseDown={(event) => event.stopPropagation()}>
            <h2 id={`comment-confirm-${comment.id}`}>{confirmAction === "delete" ? "의견을 삭제할까요?" : "이 사용자를 차단할까요?"}</h2>
            <p>{confirmAction === "delete" ? "답글이 있으면 삭제 안내 문구만 남습니다." : "이 사용자의 의견이 가려지며 언제든 차단을 해제할 수 있습니다."}</p>
            <div>
              <button type="button" onClick={() => setConfirmAction(null)}>취소</button>
              <button type="button" className={confirmAction === "delete" ? "danger" : "primary"} onClick={runConfirmedAction}>{confirmAction === "delete" ? "삭제" : "차단"}</button>
            </div>
          </section>
        </div>
      ) : null}
      {comment.replies?.length ? (
        <div className="reply-list">
          {comment.replies.map((reply, replyIndex) => (
            <CommentCard
              comment={reply}
              index={replyIndex}
              key={reply.id}
              onReact={onReact}
              onRebuttal={onRebuttal}
              requireParticipation={requireParticipation}
              requireLogin={requireLogin}
              onDelete={onDelete}
              onReport={onReport}
              onBlock={onBlock}
              onUnblock={onUnblock}
              participationOpen={participationOpen}
              parentNickname={comment.is_deleted || comment.is_blocked ? undefined : comment.nickname}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function popularityScore(comment: Comment) {
  return comment.like_count * 2 + comment.rebuttal_count - comment.dislike_count;
}

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(parseApiDate(value));
}

function LoginGate({ onClose, isAuthenticated, onConsentComplete, onProvider }: {
  onClose: () => void;
  isAuthenticated: boolean;
  onConsentComplete: () => Promise<void>;
  onProvider: (provider: LoginProvider) => Promise<void>;
}) {
  const [sensitiveConsent, setSensitiveConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueWithProvider(provider: LoginProvider) {
    if (isAuthenticated && !sensitiveConsent) {
      setError("필수 동의 항목을 확인해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (isAuthenticated) {
        await onConsentComplete();
        setBusy(false);
      } else {
        await onProvider(provider);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "소셜 로그인을 시작하지 못했습니다.");
      setBusy(false);
    }
  }

  return (
    <div className="login-gate-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="login-gate compact-login-gate" role="dialog" aria-modal="true" aria-labelledby="login-gate-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="login-gate-close" type="button" aria-label="로그인 창 닫기" onClick={onClose}>×</button>
        <div className="login-modal-heading">
          <h2 id="login-gate-title">{isAuthenticated ? "참여 동의" : "아니근데에 로그인"}</h2>
          <p>{isAuthenticated ? "입장을 반영하려면 필수 동의를 확인해주세요." : "소셜 계정으로 계속하세요."}</p>
        </div>
        {isAuthenticated ? (
          <div className="login-consents">
            <label><input type="checkbox" checked={sensitiveConsent} onChange={(event) => setSensitiveConsent(event.target.checked)} /><span><b>[필수]</b> 선택한 입장이 정치적 견해에 해당할 수 있으며, 참여 집계와 토론 제공을 위해 처리되는 것에 동의합니다.</span></label>
          </div>
        ) : null}
        {error ? <p className="login-gate-error">{error}</p> : null}
        {isAuthenticated ? (
          <button className="participation-continue-button" type="button" onClick={() => void continueWithProvider("google")} disabled={busy}>동의하고 계속하기</button>
        ) : (
          <SocialLoginButtons busy={busy} onSelect={(provider) => void continueWithProvider(provider)} />
        )}
      </section>
    </div>
  );
}

function replaceComment(comments: Comment[], updated: Comment): Comment[] {
  return comments.map((comment) => {
    if (comment.id === updated.id) return updated;
    if (!comment.replies?.length) return comment;
    return { ...comment, replies: replaceComment(comment.replies, updated) };
  });
}

function Composer({ title, actionLabel, onSubmit, compact = false, inline = false }: {
  title: string;
  actionLabel: string;
  onSubmit: (body: string) => Promise<boolean | void>;
  compact?: boolean;
  inline?: boolean;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (body.trim().length === 0) { setError("내용을 입력해주세요."); return; }
    setBusy(true);
    try {
      const submitted = await onSubmit(body.trim());
      if (submitted !== false) setBody("");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "등록하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return (
    <form className={`composer ${compact ? "compact" : ""} ${inline ? "inline" : ""}`} onSubmit={submit}>
      <label htmlFor={`composer-${title}`}>{title}</label>
      <textarea
        id={`composer-${title}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
        maxLength={2000}
        enterKeyHint="send"
        placeholder="주장과 이유를 함께 적어주세요."
      />
      <div><span className={error ? "form-error" : ""}>{error || `${body.length} / 2,000`}</span><button disabled={busy}>{busy ? "올리는 중" : actionLabel} →</button></div>
    </form>
  );
}
