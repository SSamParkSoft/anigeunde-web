"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { api } from "@/lib/api";
import { apiTimestamp, parseApiDate } from "@/lib/datetime";
import type { IssueSummary } from "@/lib/types";
import { Pagination } from "@/components/pagination";

const formatNumber = new Intl.NumberFormat("ko-KR");
const ISSUE_PAGE_SIZE = 8;

export function Home() {
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [category, setCategory] = useState("전체");
  const [sort, setSort] = useState("활발한");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [issuePage, setIssuePage] = useState(1);
  const [mobilePanel, setMobilePanel] = useState<"ranking" | "guide" | null>(null);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const sheetDragStart = useRef<number | null>(null);
  const sheetDragDistance = useRef(0);

  useEffect(() => {
    api.issues()
      .then(({ items }) => setIssues(items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mobilePanel) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobilePanel(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobilePanel]);

  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(issues.map((issue) => issue.category)))],
    [issues],
  );
  const categoryFiltered = category === "전체" ? issues : issues.filter((issue) => issue.category === category);
  const filtered = categoryFiltered.filter((issue) => (
    sort === "마감" ? isIssueClosed(issue) : !isIssueClosed(issue)
  ));
  const visible = [...filtered].sort((a, b) => {
    if (sort === "최신") return apiTimestamp(b.published_at, 0) - apiTimestamp(a.published_at, 0);
    if (sort === "마감") {
      return apiTimestamp(b.closes_at, apiTimestamp(b.published_at, 0))
        - apiTimestamp(a.closes_at, apiTimestamp(a.published_at, 0));
    }
    return activityScore(b) - activityScore(a);
  });
  const rankedIssues = issues.filter((issue) => !isIssueClosed(issue)).sort((a, b) => activityScore(b) - activityScore(a));
  const hottest = rankedIssues[0];
  const issueTotalPages = Math.max(1, Math.ceil(visible.length / ISSUE_PAGE_SIZE));
  const currentIssuePage = Math.min(issuePage, issueTotalPages);
  const pagedIssues = visible.slice(
    (currentIssuePage - 1) * ISSUE_PAGE_SIZE,
    currentIssuePage * ISSUE_PAGE_SIZE,
  );

  function startSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    sheetDragStart.current = event.clientY;
    sheetDragDistance.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (sheetDragStart.current === null) return;
    const distance = Math.max(0, event.clientY - sheetDragStart.current);
    sheetDragDistance.current = distance;
    setSheetDragOffset(distance);
  }

  function endSheetDrag() {
    if (sheetDragDistance.current >= 80) setMobilePanel(null);
    sheetDragStart.current = null;
    sheetDragDistance.current = 0;
    setSheetDragOffset(0);
  }

  return (
    <main className="community-page">
      <div className="community-shell">
        <div className="community-welcome">
          <div>
            <span className="community-label">오늘의 커뮤니티</span>
            <h1>지금 무슨 얘기 중?</h1>
            <p>결과부터 보지 말고, 내 생각부터 고르세요.</p>
          </div>
        </div>

        <div className="participation-stat">
          <span className="participation-label">지금까지 함께한 참여자</span>
          <div className="participation-number">
            <b>{formatNumber.format(issues.reduce((sum, issue) => sum + issue.participant_count, 0))}</b>
            <strong>인</strong>
          </div>
          <div className="participation-live">
            <span><i /> 실시간 반영</span>
          </div>
        </div>

        <section className="community-feed">
          {error ? (
            <div className="community-error"><b>API 연결 대기 중</b><span>{error}</span></div>
          ) : null}

          {hottest ? (
            <Link href={`/issues/${hottest.slug}`} className="hot-issue">
              <div className="hot-topline">
                <span><i /> 지금 가장 뜨거운 주제</span>
                <span>{hottest.category} · 실시간 1위{hottest.ai_assisted ? " · AI 보조 작성" : ""}</span>
              </div>
              <h2>{hottest.question}</h2>
              <div className="hot-footer">
                <div>
                  <span><b>{formatNumber.format(hottest.participant_count)}</b>인 참여</span>
                  <span><b>{hottest.comment_count}</b>개 의견</span>
                </div>
                <strong>지금 토론 참여하기 →</strong>
              </div>
            </Link>
          ) : null}

          <div className="feed-controls">
            <div className="sort-tabs" aria-label="정렬">
              {["활발한", "최신", "마감"].map((item) => (
                <button key={item} className={sort === item ? "active" : ""} onClick={() => { setSort(item); setIssuePage(1); }}>{item}</button>
              ))}
            </div>
            <div className="category-select">
              {categories.map((item) => (
                <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setIssuePage(1); }}>{item}</button>
              ))}
            </div>
          </div>

          <div className="feed-title-row">
            <h2>{sort === "마감" ? "마감된 주제" : "전체 주제"}</h2>
            <span>{visible.length}개</span>
          </div>

          <div className="community-issue-list">
            {pagedIssues.map((issue) => <CommunityIssue issue={issue} key={issue.id} />)}
            {loading ? [1, 2, 3].map((item) => <div className="community-skeleton" key={item} />) : null}
            {!loading && !visible.length && !error ? (
              <div className="community-error">
                <b>{sort === "마감" ? "아직 마감된 주제가 없습니다." : "현재 열린 주제가 없습니다."}</b>
                <span>{sort === "마감" ? "참여 기간이 끝난 주제가 여기에 모입니다." : "검수가 끝난 새 주제가 발행되면 여기에 표시됩니다."}</span>
              </div>
            ) : null}
          </div>
          <Pagination
            currentPage={currentIssuePage}
            totalPages={issueTotalPages}
            label="주제 목록 페이지"
            onPageChange={(page) => {
              setIssuePage(page);
              document.querySelector(".feed-title-row")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </section>

        <aside className="community-sidebar">
          <section className="sidebar-box">
            <div className="sidebar-heading ranking-heading"><b>🔥 주제 랭킹</b><span>실시간</span></div>
            <ol className="ranking-list">
              {rankedIssues.map((issue, index) => (
                <li className={index === 0 ? "rank-first" : ""} key={issue.id}>
                  <b>{index + 1}</b>
                  <Link href={`/issues/${issue.slug}`}>{issue.question}</Link>
                  <span>{index === 0 ? "🔥" : "↗"}</span>
                </li>
              ))}
            </ol>
            <p className="ranking-basis">참여와 댓글 활동 기준 · 실시간 반영</p>
          </section>

          <section className="sidebar-box guide-box">
            <div className="sidebar-heading"><b>대화 가이드</b></div>
            <p><b>01</b> 사람 말고 주장에 댓글 달기</p>
            <p><b>02</b> 사실을 말할 땐 출처 붙이기</p>
            <p><b>03</b> 생각이 바뀌면 솔직하게 누르기</p>
            <a href="#">커뮤니티 운영원칙 보기 →</a>
          </section>

          <p className="sidebar-notice">참여 결과는 여론조사가 아니며 전체 사회를 대표하지 않습니다.</p>
        </aside>

        <div className="mobile-community-tools" role="group" aria-label="커뮤니티 정보">
          <button type="button" onClick={() => setMobilePanel("ranking")}>🔥 주제 랭킹</button>
        </div>

        {mobilePanel ? (
          <div className="mobile-community-sheet-backdrop" onClick={() => setMobilePanel(null)}>
            <section
              className="mobile-community-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={mobilePanel === "ranking" ? "주제 랭킹" : "대화 가이드"}
              onClick={(event) => event.stopPropagation()}
              style={{ transform: `translateY(${sheetDragOffset}px)` }}
            >
              <div
                className="mobile-sheet-drag-area"
                aria-hidden="true"
                onPointerDown={startSheetDrag}
                onPointerMove={moveSheetDrag}
                onPointerUp={endSheetDrag}
                onPointerCancel={endSheetDrag}
              >
                <div className="mobile-sheet-handle" />
              </div>
              <header>
                <div className="mobile-sheet-tabs" role="tablist" aria-label="커뮤니티 정보 선택">
                  <button type="button" role="tab" aria-selected={mobilePanel === "ranking"} className={mobilePanel === "ranking" ? "active" : ""} onClick={() => setMobilePanel("ranking")}>🔥 주제 랭킹</button>
                  <button type="button" role="tab" aria-selected={mobilePanel === "guide"} className={mobilePanel === "guide" ? "active" : ""} onClick={() => setMobilePanel("guide")}>대화 가이드</button>
                </div>
                <button className="mobile-sheet-close" type="button" aria-label="닫기" onClick={() => setMobilePanel(null)}>×</button>
              </header>

              {mobilePanel === "ranking" ? (
                <div className="mobile-sheet-ranking">
                  <div className="sidebar-heading ranking-heading"><b>실시간 주제 랭킹</b><span>실시간</span></div>
                  <ol className="ranking-list">
                    {rankedIssues.map((issue, index) => (
                      <li className={index === 0 ? "rank-first" : ""} key={issue.id}>
                        <b>{index + 1}</b>
                        <Link href={`/issues/${issue.slug}`} onClick={() => setMobilePanel(null)}>{issue.question}</Link>
                        <span>{index === 0 ? "🔥" : "↗"}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="ranking-basis">참여와 댓글 활동 기준 · 실시간 반영</p>
                </div>
              ) : (
                <div className="mobile-sheet-guide">
                  <p><b>01</b> 사람 말고 주장에 댓글 달기</p>
                  <p><b>02</b> 사실을 말할 땐 출처 붙이기</p>
                  <p><b>03</b> 생각이 바뀌면 솔직하게 누르기</p>
                  <Link href="/community-guidelines" onClick={() => setMobilePanel(null)}>커뮤니티 운영원칙 보기 →</Link>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function activityScore(issue: IssueSummary) {
  return issue.participant_count + issue.comment_count * 20;
}

function isIssueClosed(issue: IssueSummary) {
  return issue.status === "CLOSED"
    || (issue.closes_at !== null && parseApiDate(issue.closes_at).getTime() <= Date.now());
}

function remainingLabel(value: string | null) {
  if (!value) return "마감 미정";
  const milliseconds = parseApiDate(value).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(milliseconds / 86_400_000));
  return days === 0 ? "오늘 마감" : `${days}일 후 마감`;
}

function closedLabel(value: string | null) {
  if (!value) return "참여 마감";
  return `${new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(parseApiDate(value))} 마감`;
}

function CommunityIssue({ issue }: { issue: IssueSummary }) {
  const closed = isIssueClosed(issue);
  return (
    <article className="community-issue">
      <div className="community-issue-body">
        <div className="community-issue-meta"><span>{issue.category}</span><span>{closed ? "마감" : "토론 중"}</span>{issue.ai_assisted ? <span>AI 보조 작성</span> : null}<time>{closed ? closedLabel(issue.closes_at) : remainingLabel(issue.closes_at)}</time></div>
        <Link href={`/issues/${issue.slug}`}><h3>{issue.question}</h3></Link>
        <div className="community-issue-footer">
          <span>참여 {formatNumber.format(issue.participant_count)}명 ·</span>
          <span>의견 {formatNumber.format(issue.comment_count)}개</span>
          <Link href={`/issues/${issue.slug}`}>{closed ? "결과 보기" : "토론 들어가기"} →</Link>
        </div>
      </div>
    </article>
  );
}
