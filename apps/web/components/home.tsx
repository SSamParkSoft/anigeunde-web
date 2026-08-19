"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { IssueSummary } from "@/lib/types";

const formatNumber = new Intl.NumberFormat("ko-KR");

export function Home() {
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [category, setCategory] = useState("전체");
  const [sort, setSort] = useState("활발한");
  const [error, setError] = useState("");

  useEffect(() => {
    api.issues().then(({ items }) => setIssues(items)).catch((reason: Error) => setError(reason.message));
  }, []);

  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(issues.map((issue) => issue.category)))],
    [issues],
  );
  const visible = category === "전체" ? issues : issues.filter((issue) => issue.category === category);
  const rankedIssues = [...issues].sort((a, b) => activityScore(b) - activityScore(a));
  const hottest = rankedIssues[0];

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
            <em>오늘 +128</em>
            <span><i /> 실시간 집계</span>
          </div>
        </div>

        <section className="community-feed">
          {error ? (
            <div className="community-error"><b>API 연결 대기 중</b><span>{error}</span></div>
          ) : null}

          {hottest ? (
            <Link href={`/issues/${hottest.slug}`} className="hot-issue">
              <div className="hot-topline">
                <span><i /> 지금 가장 뜨거운 쟁점</span>
                <span>{hottest.category} · 실시간 1위</span>
              </div>
              <h2>{hottest.question}</h2>
              <p>{hottest.brief}</p>
              <div className="hot-footer">
                <div>
                  <span><b>{formatNumber.format(hottest.participant_count)}</b>인 참여</span>
                  <span><b>{hottest.comment_count}</b>개 의견</span>
                  <span className="hot-surge">참여 속도 1위</span>
                </div>
                <strong>지금 토론 참여하기 →</strong>
              </div>
            </Link>
          ) : null}

          <div className="feed-controls">
            <div className="sort-tabs" aria-label="정렬">
              {["활발한", "최신", "마감임박"].map((item) => (
                <button key={item} className={sort === item ? "active" : ""} onClick={() => setSort(item)}>{item}</button>
              ))}
            </div>
            <div className="category-select">
              {categories.map((item) => (
                <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
          </div>

          <div className="feed-title-row">
            <h2>전체 쟁점</h2>
            <span>{visible.length}개</span>
          </div>

          <div className="community-issue-list">
            {visible.map((issue) => <CommunityIssue issue={issue} key={issue.id} />)}
            {!issues.length && !error ? [1, 2, 3].map((item) => <div className="community-skeleton" key={item} />) : null}
          </div>
        </section>

        <aside className="community-sidebar">
          <section className="sidebar-box">
            <div className="sidebar-heading ranking-heading"><b>🔥 쟁점 랭킹</b><span>실시간</span></div>
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
      </div>
    </main>
  );
}

function activityScore(issue: IssueSummary) {
  return issue.participant_count + issue.comment_count * 20;
}

function CommunityIssue({ issue }: { issue: IssueSummary }) {
  return (
    <article className="community-issue">
      <div className="issue-vote-box"><span>참여</span><b>{formatNumber.format(issue.participant_count)}</b></div>
      <div className="community-issue-body">
        <div className="community-issue-meta"><span>{issue.category}</span><span>토론 중</span><time>방금 전</time></div>
        <Link href={`/issues/${issue.slug}`}><h3>{issue.question}</h3></Link>
        <p>{issue.brief}</p>
        <div className="community-issue-footer">
          <span>💬 의견 {issue.comment_count}</span>
          <span>↳ 댓글 {Math.max(issue.comment_count * 3, 12)}</span>
          <span>🔗 자료 {issue.source_count}</span>
          <Link href={`/issues/${issue.slug}`}>토론 들어가기 →</Link>
        </div>
      </div>
    </article>
  );
}
