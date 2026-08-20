"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { parseApiDate } from "@/lib/datetime";
import type {
  NewsCandidate,
  NewsCandidatePool as CandidatePoolResponse,
  SelectedNewsDraft,
} from "@/lib/types";

const CANDIDATE_CATEGORIES = [
  "전체",
  "정치",
  "연예",
  "논란",
  "이슈",
  "국민의힘",
  "더불어민주당",
  "부동산",
  "사회",
  "경제",
] as const;

type Category = (typeof CANDIDATE_CATEGORIES)[number];
type View = "candidates" | "drafts";

const statusLabels: Record<string, string> = {
  AI_REVIEW_REQUIRED: "미검토",
  VERIFICATION_REQUIRED: "사실확인 필요",
  AI_HOLD: "AI 보류",
  AI_REJECTED: "AI 제외 의견",
  VERIFIED: "검증 완료",
  PROMOTED: "초안 생성",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(parseApiDate(value));
}

function DraftConfirmation({ refreshToken }: { refreshToken: number }) {
  const [drafts, setDrafts] = useState<SelectedNewsDraft[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.selectedNewsDrafts()
      .then((response) => {
        if (active) setDrafts(response.items);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "최종 확인 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  async function confirmDraft(draft: SelectedNewsDraft) {
    setConfirming(draft.issue.id);
    setError("");
    try {
      await api.confirmSelectedNewsDraft(draft.issue.id);
      setDrafts((current) => current.filter((item) => item.issue.id !== draft.issue.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "서비스에 주제를 등록하지 못했습니다.");
    } finally {
      setConfirming(null);
    }
  }

  if (loading) return <p className="admin-news-state">AI 초안을 불러오는 중입니다.</p>;

  return (
    <section className="admin-drafts" aria-label="최종 확인할 AI 주제 초안">
      {error && <p className="admin-news-error">{error}</p>}
      {!error && drafts.length === 0 && (
        <p className="admin-news-state">최종 확인을 기다리는 주제 초안이 없습니다.</p>
      )}
      {drafts.map((draft, index) => (
        <article className="admin-draft" key={draft.issue.id}>
          <div className="admin-draft-heading">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p>
                <b>{draft.issue.category}</b>
                <i />
                {draft.generation_status === "GEMINI" ? "Gemini 생성" : "대체 초안"}
                <i />
                {formatTime(draft.selected_at)}
              </p>
              <h2>{draft.issue.question}</h2>
            </div>
          </div>

          <p className="admin-draft-brief">{draft.issue.brief}</p>

          <div className="admin-draft-options">
            {draft.issue.options.map((option) => (
              <div key={option.id}>
                <span>{option.stance === "SUPPORT" ? "찬성 선택지" : "반대 선택지"}</span>
                <b>{option.label}</b>
                <small>{option.short_label}</small>
              </div>
            ))}
          </div>

          {draft.duplicate_status !== "NEW" && (
            <div className="admin-draft-warning">
              <b>중복 가능성 확인</b>
              <p>{draft.duplicate_reason}</p>
              {draft.duplicate_issue_question && <span>기존 주제: {draft.duplicate_issue_question}</span>}
            </div>
          )}

          <div className="admin-draft-sources">
            <b>연결 출처 {draft.issue.sources.length}</b>
            <div>
              {draft.issue.sources.map((source) => (
                <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                  {source.publisher} · {source.title}
                </a>
              ))}
            </div>
          </div>

          <div className="admin-draft-final">
            <p>등록 즉시 공개되며 7일 뒤 참여가 마감됩니다.</p>
            <button
              type="button"
              disabled={confirming === draft.issue.id}
              onClick={() => void confirmDraft(draft)}
            >
              {confirming === draft.issue.id ? "등록 중" : "서비스에 등록"}
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

export function NewsCandidatePool() {
  const [view, setView] = useState<View>("candidates");
  const [category, setCategory] = useState<Category>("전체");
  const [pool, setPool] = useState<CandidatePoolResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    api.newsCandidates(category === "전체" ? undefined : category)
      .then((response) => {
        if (active) setPool(response);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "후보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, refreshToken]);

  function changeCategory(next: Category) {
    if (next === category) return;
    setLoading(true);
    setError("");
    setCategory(next);
  }

  function refresh() {
    setLoading(true);
    setError("");
    setRefreshToken((value) => value + 1);
  }

  async function selectCandidate(candidate: NewsCandidate) {
    if (!candidate.cluster_id) return;
    setTriaging(candidate.cluster_id);
    setError("");
    try {
      await api.selectNewsCluster(candidate.cluster_id);
      setRefreshToken((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "주제 초안을 생성하지 못했습니다.");
    } finally {
      setTriaging(null);
    }
  }

  return (
    <main className="admin-news-page">
      <header className="admin-news-header">
        <div>
          <span>OPERATIONS / NEWS POOL</span>
          <h1>뉴스 후보함</h1>
          <p>후보를 선택해 AI 초안을 만들고, 최종 확인 뒤 실제 서비스에 등록합니다.</p>
        </div>
        <button type="button" onClick={refresh}>새로고침</button>
      </header>

      <nav className="admin-news-view-tabs" aria-label="뉴스 운영 단계">
        <button type="button" className={view === "candidates" ? "active" : ""} onClick={() => setView("candidates")}>
          뉴스 후보
        </button>
        <button type="button" className={view === "drafts" ? "active" : ""} onClick={() => setView("drafts")}>
          최종 확인
        </button>
      </nav>

      {view === "drafts" ? (
        <DraftConfirmation refreshToken={refreshToken} />
      ) : (
        <>
          <div className="admin-news-toolbar">
            <div className="admin-news-tabs" aria-label="후보 카테고리">
              {CANDIDATE_CATEGORIES.map((item) => (
                <button
                  type="button"
                  className={category === item ? "active" : ""}
                  onClick={() => changeCategory(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="admin-news-counts">
              {CANDIDATE_CATEGORIES.slice(1).map((item) => (
                <span key={item}>{item} <b>{pool?.category_counts[item] ?? 0}</b></span>
              ))}
            </p>
          </div>

          {error && <p className="admin-news-error">{error}</p>}
          {loading && <p className="admin-news-state">후보를 불러오는 중입니다.</p>}
          {!loading && !error && pool?.items.length === 0 && (
            <p className="admin-news-state">표시할 최신 후보가 없습니다.</p>
          )}

          {!loading && pool && pool.items.length > 0 && (
            <ol className="admin-news-list">
              {pool.items.map((candidate, index) => (
                <li key={candidate.id}>
                  <span className="admin-news-index">{String(index + 1).padStart(3, "0")}</span>
                  <div className="admin-news-copy">
                    <div className="admin-news-meta">
                      <b>{candidate.categories.join(" · ")}</b>
                      <span>{formatTime(candidate.published_at)}</span>
                      <span>{candidate.publisher_domain}</span>
                      {candidate.cluster_status && (
                        <em>{statusLabels[candidate.cluster_status] ?? candidate.cluster_status}</em>
                      )}
                    </div>
                    <a href={candidate.url} target="_blank" rel="noreferrer">{candidate.title}</a>
                    {candidate.description && <p>{candidate.description}</p>}
                  </div>
                  <div className="admin-news-actions">
                    <a href={candidate.url} target="_blank" rel="noreferrer">원문</a>
                    <button
                      type="button"
                      disabled={
                        !candidate.cluster_id ||
                        candidate.cluster_status === "MERGED" ||
                        candidate.cluster_status === "DISMISSED" ||
                        candidate.cluster_status === "PROMOTED" ||
                        triaging === candidate.cluster_id
                      }
                      onClick={() => void selectCandidate(candidate)}
                    >
                      {candidate.cluster_status === "PROMOTED"
                        ? "생성 완료"
                        : triaging === candidate.cluster_id
                          ? "생성 중"
                          : "선택·생성"}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}
