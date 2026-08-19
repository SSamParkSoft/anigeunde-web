"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  clearPendingParticipation,
  readPendingParticipation,
  startSocialLogin,
  type LoginProvider,
  type PendingParticipation,
} from "@/lib/auth";
import { api } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Comment, IssueDetail } from "@/lib/types";

export function IssueView({ slug }: { slug: string }) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [commentSort, setCommentSort] = useState<"latest" | "popular">("popular");
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
        await api.bootstrapProfile();
        await api.consentSensitivePosition();

        if (pending.kind === "position" && pending.optionId) {
          const result = await api.choosePosition(issue.id, pending.optionId);
          setIssue((current) => current ? {
            ...current,
            my_position_id: result.my_position_id,
            results: result.results,
          } : current);
        } else if (pending.kind === "comment") {
          setError("로그인이 완료되었습니다. 의견을 등록하려면 먼저 위에서 내 생각을 선택해주세요.");
        }
        clearPendingParticipation();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "로그인 후 참여 준비를 완료하지 못했습니다.");
      } finally {
        resumingLogin.current = false;
      }
    })();
  }, [isAuthenticated, issue, slug]);

  async function persistPosition(optionId: string) {
    if (!issue || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api.choosePosition(issue.id, optionId);
      setIssue({ ...issue, my_position_id: result.my_position_id, results: result.results });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "입장을 저장하지 못했습니다.");
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

  async function createComment(body: string) {
    if (!issue) return;
    const created = await api.createComment(issue.id, body);
    setComments((current) => [created, ...current]);
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
    const refreshed = await api.comments(issue!.id);
    setComments(refreshed.items);
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

  if (loading) return <main className="issue-page"><div className="issue-loading">쟁점을 읽는 중<span>...</span></div></main>;
  if (!issue) return <main className="issue-page"><div className="fatal-error"><b>쟁점을 열지 못했습니다.</b><p>{error}</p><Link href="/">홈으로</Link></div></main>;

  const selectedOption = issue.options.find((option) => option.id === issue.my_position_id);
  const sortedComments = [...comments].sort((a, b) => (
    commentSort === "popular"
      ? popularityScore(b) - popularityScore(a) || Date.parse(b.created_at) - Date.parse(a.created_at)
      : Date.parse(b.created_at) - Date.parse(a.created_at)
  ));

  return (
    <main className="issue-page">
      <div className="issue-shell">
        <section className="issue-intro">
          <div className="issue-kicker">
            <span>{issue.category}</span>
            <span className="status-dot">토론 중</span>
            <span>업데이트 2026.08.18</span>
          </div>
          <h1>{issue.question}</h1>
          <p>{issue.brief}</p>
        </section>

        <section className="source-strip">
          <span className="source-title">참고자료 {String(issue.sources.length).padStart(2, "0")}</span>
          <div>
            {issue.sources.map((source) => (
              <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                <small>{source.publisher}</small>
                {source.title}<b>↗</b>
              </a>
            ))}
          </div>
        </section>

        {!issue.my_position_id ? (
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
              <small className="consent-note">선택 시 정치적 견해에 해당할 수 있는 정보 처리에 동의합니다. 데모 데이터는 로컬에만 저장됩니다.</small>
            </>
          </section>
        ) : null}

        {error ? <div className="inline-error">{error}</div> : null}

        {issue.my_position_id ? (
          <div className="discussion-layout">
            <section className="discussion-section">
              <div className="discussion-heading">
                <div><h2>의견</h2></div>
              </div>
              <div className="discussion-toolbar">
                <span>{comments.length}개의 의견</span>
                <div className="comment-sort-toggle" role="group" aria-label="의견 정렬">
                  <button className={commentSort === "popular" ? "active" : ""} onClick={() => setCommentSort("popular")}>인기순</button>
                  <button className={commentSort === "latest" ? "active" : ""} onClick={() => setCommentSort("latest")}>최신순</button>
                </div>
              </div>
              <div className="comment-list">
                {sortedComments.map((comment, index) => (
                  <CommentCard
                    comment={comment}
                    index={index}
                    key={comment.id}
                    onReact={react}
                    onRebuttal={createRebuttal}
                    requireParticipation={requireParticipation}
                  />
                ))}
              </div>
              <Composer title="의견을 남겨보세요." actionLabel="입력" onSubmit={submitOpinion} inline />
            </section>
            <aside className="results-sidebar">
              <ResultPanel issue={issue} selectedLabel={selectedOption?.label ?? ""} onChange={() => setIssue({ ...issue, my_position_id: null, results: null })} />
            </aside>
          </div>
        ) : (
          <section className="discussion-section public-discussion">
            <div className="discussion-heading">
              <div><h2>의견</h2><p>의견은 누구나 읽을 수 있어요.</p></div>
            </div>
            <div className="discussion-toolbar">
              <span>{comments.length}개의 의견</span>
              <div className="comment-sort-toggle" role="group" aria-label="의견 정렬">
                <button className={commentSort === "popular" ? "active" : ""} onClick={() => setCommentSort("popular")}>인기순</button>
                <button className={commentSort === "latest" ? "active" : ""} onClick={() => setCommentSort("latest")}>최신순</button>
              </div>
            </div>
            <div className="comment-list">
              {sortedComments.map((comment, index) => (
                <CommentCard comment={comment} index={index} key={comment.id} onReact={react} onRebuttal={createRebuttal} requireParticipation={requireParticipation} />
              ))}
            </div>
            <Composer title="의견을 남겨보세요." actionLabel="입력" onSubmit={submitOpinion} inline />
          </section>
        )}
      </div>
      {loginOpen ? <LoginGate onClose={() => {
        pendingParticipation.current = null;
        setLoginOpen(false);
      }} onProvider={beginSocialLogin} /> : null}
    </main>
  );
}

function ResultPanel({ issue, selectedLabel, onChange }: { issue: IssueDetail; selectedLabel: string; onChange: () => void }) {
  return (
    <div className="result-panel">
      <div className="my-position-row">
        <div><small>내 생각</small><b>{selectedLabel}</b></div>
        <button onClick={onChange}>변경하기</button>
      </div>
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

function CommentCard({ comment, index, onReact, onRebuttal, requireParticipation, parentNickname }: {
  comment: Comment;
  index: number;
  onReact: (comment: Comment, type: "like" | "dislike") => Promise<void>;
  onRebuttal: (commentId: string, body: string) => Promise<void>;
  requireParticipation: (action: () => void | Promise<void>) => void;
  parentNickname?: string;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <div className={`comment-thread comment-depth-${Math.min(comment.depth, 2)}`}>
      <article className="comment-card">
        <div className="comment-index">#{String(index + 1).padStart(2, "0")}</div>
        <div className="comment-main">
          <header>
            <div><b>{comment.nickname}</b><span>{comment.position} · 방금 전</span></div>
            {comment.is_mine ? <em>내 의견</em> : null}
          </header>
          <p>
            {parentNickname ? <b className="reply-target">@{parentNickname}</b> : null}
            {comment.body}
          </p>
          <div className="comment-actions">
            <button className={comment.viewer_reactions.includes("LIKE") ? "active" : ""} onClick={() => requireParticipation(() => onReact(comment, "like"))}>
              좋아요 <b>{comment.like_count}</b>
            </button>
            <button className={comment.viewer_reactions.includes("DISLIKE") ? "active dark" : ""} onClick={() => requireParticipation(() => onReact(comment, "dislike"))}>
              싫어요 <b>{comment.dislike_count}</b>
            </button>
            <button className="rebuttal-button" onClick={() => requireParticipation(() => setReplying((value) => !value))}>
              댓글 <b>{comment.rebuttal_count}</b> <span>↳</span>
            </button>
          </div>
          {replying ? <Composer title={`@${comment.nickname}에게 댓글`} actionLabel="댓글 달기" onSubmit={async (body) => { await onRebuttal(comment.id, body); setReplying(false); }} compact /> : null}
        </div>
      </article>
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
              parentNickname={comment.nickname}
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

function LoginGate({ onClose, onProvider }: {
  onClose: () => void;
  onProvider: (provider: LoginProvider) => Promise<void>;
}) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [serviceConsent, setServiceConsent] = useState(false);
  const [sensitiveConsent, setSensitiveConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueWithProvider(provider: LoginProvider) {
    if (!ageConfirmed || !serviceConsent || !sensitiveConsent) {
      setError("세 가지 필수 항목을 모두 확인해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onProvider(provider);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "소셜 로그인을 시작하지 못했습니다.");
      setBusy(false);
    }
  }

  return (
    <div className="login-gate-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="login-gate" role="dialog" aria-modal="true" aria-labelledby="login-gate-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="login-gate-close" type="button" aria-label="로그인 창 닫기" onClick={onClose}>×</button>
        <span className="login-gate-kicker">로그인된 익명</span>
        <h2 id="login-gate-title">선택은 익명으로,<br />참여는 한 계정으로.</h2>
        <p>로그인은 중복 참여와 도배를 줄이기 위한 장치예요. 소셜 계정과 이메일은 다른 이용자에게 보이지 않고, 아니근데 닉네임만 표시됩니다.</p>
        <div className="login-consents">
          <label><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /><span><b>[필수]</b> 만 14세 이상입니다.</span></label>
          <label><input type="checkbox" checked={serviceConsent} onChange={(event) => setServiceConsent(event.target.checked)} /><span><b>[필수]</b> <Link href="/terms" target="_blank">이용약관</Link>과 <Link href="/privacy" target="_blank">개인정보 처리방침</Link>을 확인했습니다.</span></label>
          <label><input type="checkbox" checked={sensitiveConsent} onChange={(event) => setSensitiveConsent(event.target.checked)} /><span><b>[필수]</b> 선택한 입장이 정치적 견해에 해당할 수 있으며, 참여 집계와 토론 제공을 위해 처리되는 것에 동의합니다.</span></label>
        </div>
        {error ? <p className="login-gate-error">{error}</p> : null}
        <div className="social-login-buttons">
          <button type="button" onClick={() => void continueWithProvider("google")} disabled={busy}>G <span>Google로 계속하기</span></button>
          <button className="kakao-login" type="button" onClick={() => void continueWithProvider("kakao")} disabled={busy}>K <span>카카오로 계속하기</span></button>
        </div>
        <small>소셜 계정 정보는 로그인 확인에만 사용되며 다른 이용자에게 공개되지 않습니다.</small>
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
    if (body.trim().length < 10) { setError("10자 이상 적어주세요."); return; }
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
      <textarea id={`composer-${title}`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder="주장과 이유를 함께 적어주세요." />
      <div><span className={error ? "form-error" : ""}>{error || `${body.length} / 2,000`}</span><button disabled={busy}>{busy ? "올리는 중" : actionLabel} →</button></div>
    </form>
  );
}
