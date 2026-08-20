"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { parseApiDate } from "@/lib/datetime";
import type {
  NewsCandidate,
  NewsCandidatePool as CandidatePoolResponse,
  NewsFetchResult,
  NewsSearchQuery,
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
type View = "candidates" | "queries" | "drafts";
type CandidateDeleteTarget = NewsCandidate | "all" | { publishedDate: string };

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

function DraftEditor({
  draft,
  index,
  selected,
  onToggle,
  onPublished,
  onDeleted,
}: {
  draft: SelectedNewsDraft;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onPublished: (issueId: string) => void;
  onDeleted: (issueId: string) => void;
}) {
  const support = draft.issue.options.find((option) => option.stance === "SUPPORT");
  const oppose = draft.issue.options.find((option) => option.stance === "OPPOSE");
  const initial = {
    question: draft.issue.question,
    brief: draft.issue.brief,
    category: draft.issue.category,
    support: support?.short_label ?? "",
    oppose: oppose?.short_label ?? "",
  };
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [working, setWorking] = useState<"save" | "publish" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  function validationError() {
    if (form.question.trim().length < 10) return "질문은 10자 이상 입력해 주세요.";
    if (form.brief.trim().length < 20) return "내부 브리프는 20자 이상 입력해 주세요.";
    if (!form.category.trim()) return "카테고리를 입력해 주세요.";
    if (!form.support.trim() || !form.oppose.trim()) return "두 선택지를 모두 입력해 주세요.";
    if (form.support.trim().length > 20 || form.oppose.trim().length > 20) return "선택지는 각각 20자 이내로 입력해 주세요.";
    return "";
  }

  async function saveDraft() {
    const invalid = validationError();
    if (invalid) throw new Error(invalid);
    await api.updateSelectedNewsDraft(draft.issue.id, {
      question: form.question.trim(),
      brief: form.brief.trim(),
      category: form.category.trim(),
      options: [
        { stance: "SUPPORT", label: form.support.trim() },
        { stance: "OPPOSE", label: form.oppose.trim() },
      ],
    });
    const normalized = {
      question: form.question.trim(),
      brief: form.brief.trim(),
      category: form.category.trim(),
      support: form.support.trim(),
      oppose: form.oppose.trim(),
    };
    setForm(normalized);
    setSaved(normalized);
  }

  async function handleSave() {
    setWorking("save");
    setError("");
    setNotice("");
    try {
      await saveDraft();
      setNotice("수정 내용을 저장했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안을 저장하지 못했습니다.");
    } finally {
      setWorking(null);
    }
  }

  async function handlePublish() {
    setWorking("publish");
    setError("");
    setNotice("");
    try {
      if (dirty) await saveDraft();
      await api.confirmSelectedNewsDraft(draft.issue.id);
      onPublished(draft.issue.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "서비스에 주제를 등록하지 못했습니다.");
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete() {
    setWorking("delete");
    setError("");
    try {
      await api.deleteSelectedNewsDraft(draft.issue.id);
      onDeleted(draft.issue.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안을 삭제하지 못했습니다.");
      setDeleteConfirm(false);
    } finally {
      setWorking(null);
    }
  }

  return (
    <article className="admin-draft">
      <div className="admin-draft-heading admin-draft-edit-heading">
        <div className="admin-draft-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`${draft.issue.question} 초안 선택`}
          />
          <span>{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div>
          <p>
            <b>{saved.category}</b>
            <i />
            {draft.generation_status === "GEMINI" ? "Gemini 생성" : "대체 초안"}
            <i />
            {formatTime(draft.selected_at)}
          </p>
          <label>
            <span>주제 질문</span>
            <textarea
              value={form.question}
              maxLength={300}
              onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
            />
          </label>
        </div>
      </div>

      <div className="admin-draft-edit-grid">
        <label>
          <span>카테고리</span>
          <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
            {CANDIDATE_CATEGORIES.slice(1).map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
        <label className="admin-draft-brief-field">
          <span>내부 브리프</span>
          <textarea
            value={form.brief}
            maxLength={10_000}
            onChange={(event) => setForm((current) => ({ ...current, brief: event.target.value }))}
          />
        </label>
      </div>

      <div className="admin-draft-options admin-draft-edit-options">
        <label>
          <span>찬성 선택지 · 20자 이내</span>
          <input value={form.support} maxLength={20} onChange={(event) => setForm((current) => ({ ...current, support: event.target.value }))} />
        </label>
        <label>
          <span>반대 선택지 · 20자 이내</span>
          <input value={form.oppose} maxLength={20} onChange={(event) => setForm((current) => ({ ...current, oppose: event.target.value }))} />
        </label>
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

      {error && <p className="admin-draft-message error">{error}</p>}
      {notice && <p className="admin-draft-message">{notice}</p>}
      <div className="admin-draft-final">
        <p>{dirty ? "저장하지 않은 변경 사항이 있습니다." : "등록 즉시 공개되며 7일 뒤 참여가 마감됩니다."}</p>
        <div>
          <button type="button" className="danger" disabled={working !== null} onClick={() => setDeleteConfirm(true)}>
            초안 삭제
          </button>
          <button type="button" className="secondary" disabled={!dirty || working !== null} onClick={() => void handleSave()}>
            {working === "save" ? "저장 중" : "수정 저장"}
          </button>
          <button type="button" disabled={working !== null} onClick={() => void handlePublish()}>
            {working === "publish" ? "등록 중" : "서비스에 등록"}
          </button>
        </div>
      </div>
      {deleteConfirm && (
        <div className="comment-confirm-backdrop" role="presentation">
          <section className="comment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`draft-delete-${draft.issue.id}`}>
            <h2 id={`draft-delete-${draft.issue.id}`}>이 초안을 삭제할까요?</h2>
            <p>아직 공개되지 않은 주제 초안을 삭제하고 원본 뉴스 후보를 다시 선택할 수 있게 되돌립니다.</p>
            <div>
              <button type="button" disabled={working !== null} onClick={() => setDeleteConfirm(false)}>취소</button>
              <button type="button" className="danger" disabled={working !== null} onClick={() => void handleDelete()}>
                {working === "delete" ? "삭제 중" : "초안 삭제"}
              </button>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

function DraftConfirmation({ refreshToken }: { refreshToken: number }) {
  const [drafts, setDrafts] = useState<SelectedNewsDraft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    api.selectedNewsDrafts()
      .then((response) => {
        if (active) setDrafts(response.items);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "최종 확인 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  if (loading) return <p className="admin-news-state">AI 초안을 불러오는 중입니다.</p>;

  function removeDrafts(issueIds: string[]) {
    const removed = new Set(issueIds);
    setDrafts((current) => current.filter((item) => !removed.has(item.issue.id)));
    setSelected((current) => {
      const next = new Set(current);
      for (const issueId of issueIds) next.delete(issueId);
      return next;
    });
  }

  function toggleDraft(issueId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  }

  function toggleAllDrafts() {
    const allSelected = drafts.length > 0 && drafts.every((draft) => selected.has(draft.issue.id));
    setSelected(allSelected ? new Set() : new Set(drafts.map((draft) => draft.issue.id)));
  }

  async function deleteSelectedDrafts() {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    setError("");
    try {
      const issueIds = [...selected];
      await api.deleteSelectedNewsDrafts(issueIds);
      removeDrafts(issueIds);
      setBulkConfirm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "선택한 초안을 삭제하지 못했습니다.");
      setBulkConfirm(false);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <section className="admin-drafts" aria-label="최종 확인할 AI 주제 초안">
      {error && <p className="admin-news-error">{error}</p>}
      {!error && drafts.length === 0 && <p className="admin-news-state">최종 확인을 기다리는 주제 초안이 없습니다.</p>}
      {drafts.length > 0 && (
        <div className="admin-draft-bulk-toolbar">
          <label>
            <input
              type="checkbox"
              checked={drafts.every((draft) => selected.has(draft.issue.id))}
              onChange={toggleAllDrafts}
            />
            전체 선택
          </label>
          <span>선택 {selected.size}개</span>
          <button type="button" disabled={selected.size === 0} onClick={() => setBulkConfirm(true)}>선택 초안 삭제</button>
        </div>
      )}
      {drafts.map((draft, index) => (
        <DraftEditor
          draft={draft}
          index={index}
          key={draft.issue.id}
          selected={selected.has(draft.issue.id)}
          onToggle={() => toggleDraft(draft.issue.id)}
          onPublished={(issueId) => removeDrafts([issueId])}
          onDeleted={(issueId) => removeDrafts([issueId])}
        />
      ))}
      {bulkConfirm && (
        <div className="comment-confirm-backdrop" role="presentation">
          <section className="comment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bulk-draft-delete-title">
            <h2 id="bulk-draft-delete-title">선택한 초안을 삭제할까요?</h2>
            <p>선택한 초안 {selected.size}개를 삭제하고 각 원본 뉴스 후보를 다시 선택 가능한 상태로 되돌립니다.</p>
            <div>
              <button type="button" disabled={bulkDeleting} onClick={() => setBulkConfirm(false)}>취소</button>
              <button type="button" className="danger" disabled={bulkDeleting} onClick={() => void deleteSelectedDrafts()}>
                {bulkDeleting ? "삭제 중" : "선택 초안 삭제"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function fetchSummary(result: NewsFetchResult) {
  return `수신 ${result.received_count} · 신규 ${result.new_count} · 중복 ${result.duplicate_count} · 제외 ${result.filtered_count} · 새 묶음 ${result.created_cluster_count}`;
}

function QueryManagement({
  refreshToken,
  onCandidatesChanged,
}: {
  refreshToken: number;
  onCandidatesChanged: () => void;
}) {
  const [queries, setQueries] = useState<NewsSearchQuery[]>([]);
  const [category, setCategory] = useState<(typeof CANDIDATE_CATEGORIES)[number]>("정치");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | "new" | "batch" | "all" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<Category>("정치");
  const [editKeyword, setEditKeyword] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [deletingQuery, setDeletingQuery] = useState<NewsSearchQuery | null>(null);

  useEffect(() => {
    let active = true;
    api.newsQueries()
      .then((response) => {
        if (active) setQueries(response.items);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "검색어를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  async function runQuery(item: NewsSearchQuery) {
    setRunning(item.id);
    setError("");
    setNotice("");
    try {
      const result = await api.fetchNewsQuery(item.id);
      setNotice(`‘${item.query}’ 검색 완료 — ${fetchSummary(result)}`);
      const response = await api.newsQueries();
      setQueries(response.items);
      onCandidatesChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "뉴스 검색을 실행하지 못했습니다.");
    } finally {
      setRunning(null);
    }
  }

  async function runBatch(scope: "selected" | "all") {
    const queryIds = scope === "all"
      ? queries.filter((item) => item.enabled).map((item) => item.id)
      : [...selected].filter((id) => queries.some((item) => item.id === id && item.enabled));
    if (queryIds.length === 0) return;
    setRunning(scope === "all" ? "all" : "batch");
    setError("");
    setNotice("");
    try {
      const result = await api.fetchNewsQueries(queryIds);
      setNotice(
        `${scope === "all" ? "전체" : "선택"} 검색 완료 — 성공 ${result.succeeded_count} · 실패 ${result.failed_count} · 새 묶음 ${result.created_cluster_count}`,
      );
      const response = await api.newsQueries();
      setQueries(response.items);
      onCandidatesChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검색어 일괄 검색을 실행하지 못했습니다.");
    } finally {
      setRunning(null);
    }
  }

  function startEdit(item: NewsSearchQuery) {
    setEditingId(item.id);
    setEditCategory(item.category as Category);
    setEditKeyword(item.query);
    setEditEnabled(item.enabled);
    setError("");
    setNotice("");
  }

  async function saveQuery(item: NewsSearchQuery) {
    if (!editKeyword.trim() || editCategory === "전체") return;
    setRunning(item.id);
    setError("");
    try {
      const updated = await api.updateNewsQuery(item, editCategory, editKeyword.trim(), editEnabled);
      setQueries((current) => current.map((row) => row.id === item.id ? updated : row));
      if (!updated.enabled) {
        setSelected((current) => {
          const next = new Set(current);
          next.delete(updated.id);
          return next;
        });
      }
      setEditingId(null);
      setNotice("검색어를 수정했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검색어를 수정하지 못했습니다.");
    } finally {
      setRunning(null);
    }
  }

  async function confirmDeleteQuery() {
    if (!deletingQuery) return;
    setRunning(deletingQuery.id);
    setError("");
    try {
      await api.deleteNewsQuery(deletingQuery.id);
      setQueries((current) => current.filter((item) => item.id !== deletingQuery.id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(deletingQuery.id);
        return next;
      });
      setNotice(`‘${deletingQuery.query}’ 검색어를 삭제했습니다.`);
      setDeletingQuery(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검색어를 삭제하지 못했습니다.");
    } finally {
      setRunning(null);
    }
  }

  function toggleSelected(queryId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(queryId)) next.delete(queryId);
      else next.add(queryId);
      return next;
    });
  }

  function toggleAllSelected() {
    const activeIds = queries.filter((item) => item.enabled).map((item) => item.id);
    const allSelected = activeIds.length > 0 && activeIds.every((id) => selected.has(id));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of activeIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function addAndRunQuery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword || category === "전체") return;
    setRunning("new");
    setError("");
    setNotice("");
    try {
      const created = await api.createNewsQuery(category, normalizedKeyword);
      setQueries((current) => [...current, created]);
      setKeyword("");
      const result = await api.fetchNewsQuery(created.id);
      setNotice(`‘${created.query}’ 추가·검색 완료 — ${fetchSummary(result)}`);
      const response = await api.newsQueries();
      setQueries(response.items);
      onCandidatesChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검색어를 추가하지 못했습니다.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="admin-query-manager" aria-label="뉴스 검색어 관리">
      <form className="admin-query-form" onSubmit={(event) => void addAndRunQuery(event)}>
        <div>
          <span>새 검색어</span>
          <h2>키워드를 추가하고 바로 검색합니다.</h2>
        </div>
        <label>
          <span>카테고리</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {CANDIDATE_CATEGORIES.slice(1).map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
        <label className="admin-query-keyword">
          <span>검색 키워드</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="예: 반도체 지원 정책"
            maxLength={200}
          />
        </label>
        <button type="submit" disabled={!keyword.trim() || running !== null}>
          {running === "new" ? "검색 중" : "추가 후 검색"}
        </button>
      </form>

      {error && <p className="admin-news-error">{error}</p>}
      {notice && <p className="admin-news-notice">{notice}</p>}
      {loading && <p className="admin-news-state">검색어를 불러오는 중입니다.</p>}
      {!loading && queries.length === 0 && <p className="admin-news-state">등록된 검색어가 없습니다.</p>}
      {!loading && queries.length > 0 && (
        <div className="admin-query-list">
          <div className="admin-query-list-heading">
            <div>
              <b>현재 검색어 {queries.length}개</b>
              <span>선택 {selected.size}개 · 수동 검색도 일일 API 호출 예산에 포함됩니다.</span>
            </div>
            <div className="admin-query-batch-actions">
              <label className="admin-query-select-all">
                <input
                  type="checkbox"
                  checked={queries.some((item) => item.enabled) && queries.filter((item) => item.enabled).every((item) => selected.has(item.id))}
                  disabled={!queries.some((item) => item.enabled) || running !== null}
                  onChange={toggleAllSelected}
                />
                전체 선택
              </label>
              <button type="button" disabled={selected.size === 0 || running !== null} onClick={() => void runBatch("selected")}>
                {running === "batch" ? "검색 중" : "선택 검색"}
              </button>
              <button type="button" disabled={!queries.some((item) => item.enabled) || running !== null} onClick={() => void runBatch("all")}>
                {running === "all" ? "검색 중" : "전체 검색"}
              </button>
            </div>
          </div>
          {queries.map((item) => (
            <article className={editingId === item.id ? "editing" : ""} key={item.id}>
              <label className="admin-query-check">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  disabled={!item.enabled || running !== null}
                  onChange={() => toggleSelected(item.id)}
                  aria-label={`${item.query} 선택`}
                />
              </label>
              {editingId === item.id ? (
                <div className="admin-query-edit-fields">
                  <select value={editCategory} onChange={(event) => setEditCategory(event.target.value as Category)}>
                    {CANDIDATE_CATEGORIES.slice(1).map((categoryItem) => <option value={categoryItem} key={categoryItem}>{categoryItem}</option>)}
                  </select>
                  <input value={editKeyword} maxLength={200} onChange={(event) => setEditKeyword(event.target.value)} />
                  <label><input type="checkbox" checked={editEnabled} onChange={(event) => setEditEnabled(event.target.checked)} /> 사용</label>
                </div>
              ) : (
                <>
                  <span className="admin-query-category">{item.category}</span>
                  <div className="admin-query-copy">
                    <b>{item.query}</b>
                    <p>
                      {item.enabled ? "사용 중" : "중지됨"}
                      <i />
                      {item.last_fetched_at ? `마지막 검색 ${formatTime(item.last_fetched_at)}` : "검색 기록 없음"}
                    </p>
                  </div>
                </>
              )}
              <div className="admin-query-row-actions">
                {editingId === item.id ? (
                  <>
                    <button type="button" disabled={!editKeyword.trim() || running !== null} onClick={() => void saveQuery(item)}>저장</button>
                    <button type="button" disabled={running !== null} onClick={() => setEditingId(null)}>취소</button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={!item.enabled || running !== null} onClick={() => void runQuery(item)}>
                      {running === item.id ? "처리 중" : "검색"}
                    </button>
                    <button type="button" disabled={running !== null} onClick={() => startEdit(item)}>수정</button>
                    <button type="button" className="danger" disabled={running !== null} onClick={() => setDeletingQuery(item)}>삭제</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {deletingQuery && (
        <div className="comment-confirm-backdrop" role="presentation">
          <section className="comment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="query-delete-title">
            <h2 id="query-delete-title">검색어를 삭제할까요?</h2>
            <p>‘{deletingQuery.query}’ 검색어를 삭제합니다. 이미 수집된 후보와 주제는 유지됩니다.</p>
            <div>
              <button type="button" disabled={running !== null} onClick={() => setDeletingQuery(null)}>취소</button>
              <button type="button" className="danger" disabled={running !== null} onClick={() => void confirmDeleteQuery()}>삭제</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export function NewsCandidatePool() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<View>("candidates");
  const [category, setCategory] = useState<Category>("전체");
  const [pool, setPool] = useState<CandidatePoolResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CandidateDeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteDate, setDeleteDate] = useState("");

  useEffect(() => {
    let active = true;
    api.session()
      .then((session) => {
        if (!active) return;
        if (session.profile?.role === "ADMIN") {
          setAuthorized(true);
        } else {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
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
  }, [authorized, category, refreshToken]);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      if (deleteTarget === "all") {
        const result = await api.clearNewsCandidates();
        setNotice(`뉴스 후보 ${result.deleted_count}개를 삭제했습니다.`);
      } else if ("publishedDate" in deleteTarget) {
        const result = await api.clearNewsCandidatesByDate(deleteTarget.publishedDate);
        setNotice(`${result.published_date} 발행 후보 ${result.deleted_count}개를 삭제했습니다.`);
      } else {
        await api.deleteNewsCandidate(deleteTarget.id);
        setNotice("뉴스 후보를 삭제했습니다.");
      }
      setDeleteTarget(null);
      setLoading(true);
      setRefreshToken((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "뉴스 후보를 삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
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

  if (!authorized) {
    return <main className="admin-news-page"><p className="admin-news-state">관리자 권한을 확인하는 중입니다.</p></main>;
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
        <button type="button" className={view === "queries" ? "active" : ""} onClick={() => setView("queries")}>
          검색관리
        </button>
        <button type="button" className={view === "drafts" ? "active" : ""} onClick={() => setView("drafts")}>
          최종 확인
        </button>
      </nav>

      {view === "queries" ? (
        <QueryManagement
          refreshToken={refreshToken}
          onCandidatesChanged={() => setRefreshToken((value) => value + 1)}
        />
      ) : view === "drafts" ? (
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
              <span>전체 <b>{pool?.total_count ?? 0}</b></span>
              {CANDIDATE_CATEGORIES.slice(1).map((item) => (
                <span key={item}>{item} <b>{pool?.category_counts[item] ?? 0}</b></span>
              ))}
            </p>
          </div>

          <div className="admin-news-date-delete">
            <div>
              <b>날짜별 후보 삭제</b>
              <span>한국 시각 기준으로 해당 날짜에 발행된 전체 카테고리 후보를 삭제합니다.</span>
            </div>
            <div>
              <input type="date" value={deleteDate} onChange={(event) => setDeleteDate(event.target.value)} />
              <button type="button" disabled={!deleteDate} onClick={() => setDeleteTarget({ publishedDate: deleteDate })}>날짜별 삭제</button>
            </div>
          </div>

          {error && <p className="admin-news-error">{error}</p>}
          {notice && <p className="admin-news-notice">{notice}</p>}
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
                    <button
                      type="button"
                      className="danger"
                      disabled={deleting}
                      onClick={() => setDeleteTarget(candidate)}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!loading && pool && (
            <div className="admin-news-clear">
              <div>
                <b>후보 전체 정리</b>
                <span>날짜와 관계없이 후보함의 모든 기사와 기사 묶음을 삭제합니다.</span>
              </div>
              <div className="admin-news-clear-actions">
                <button type="button" onClick={() => setDeleteTarget("all")}>후보 전체 삭제</button>
              </div>
            </div>
          )}
        </>
      )}

      {deleteTarget && (
        <div className="comment-confirm-backdrop" role="presentation">
          <section className="comment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="news-delete-title">
            <h2 id="news-delete-title">
              {deleteTarget === "all"
                ? "후보를 전부 삭제할까요?"
                : "publishedDate" in deleteTarget
                  ? `${deleteTarget.publishedDate} 후보를 삭제할까요?`
                  : "이 후보를 삭제할까요?"}
            </h2>
            <p>
              {deleteTarget === "all"
                ? "후보 기사와 기사 묶음이 모두 삭제됩니다. 검색어와 이미 생성된 주제는 유지됩니다."
                : "publishedDate" in deleteTarget
                  ? "해당 날짜에 발행된 전체 카테고리 후보와 연결 기록을 삭제합니다. 검색어와 이미 생성된 주제는 유지됩니다."
                  : `‘${deleteTarget.title}’ 후보와 연결된 수집 기록을 삭제합니다.`}
            </p>
            <div>
              <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>취소</button>
              <button type="button" className="danger" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? "삭제 중" : "삭제"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
