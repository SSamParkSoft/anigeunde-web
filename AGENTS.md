# 아니근데 에이전트 안내

이 저장소에서 작업하는 에이전트는 구현 전에 다음 문서를 순서대로 확인한다.

1. [`README.md`](./README.md) — 현재 실행 방법과 구현 상태
2. [`docs/README.md`](./docs/README.md) — 개발 문서 지도
3. [`docs/plans/active/README.md`](./docs/plans/active/README.md) — 현재 진행 중인 구현 계약
4. [`anigeunde-service-design.md`](./anigeunde-service-design.md) — 전체 제품·운영·보안 설계

## 현재 중요한 경계

- MVP 기간에는 [`mvp-delivery-priority.md`](./docs/plans/active/mvp-delivery-priority.md)를 먼저 적용한다. CI/CD가 다음 구현 1순위이며, 테스트는 문서에 정의한 핵심 위험 범위만 작성한다.
- 쟁점은 이용자가 작성하지 않는다. 뉴스 API와 공개자료는 후보 발견에만 사용하고 `EDITOR` 또는 `ADMIN`이 검수한 쟁점만 최종 발행한다.
- 기사 본문·사진·영상은 자동 저장하거나 재배포하지 않는다. 제목, 검색 결과 요약, 원문 URL과 발행 시각 등 최소 메타데이터만 후보함에 저장한다.
- 뉴스 수집기나 AI는 `PUBLISHED` 상태를 직접 만들 수 없다.
- 현재 코드는 SQLite와 데모 사용자 헤더를 사용하는 로컬 검증 구현이다. 문서에 적힌 OAuth, Supabase, 뉴스 수집 및 관리자 기능을 구현 완료로 오인하지 않는다.
- 웹 코드를 수정할 때는 자동 생성된 [`apps/web/AGENTS.md`](./apps/web/AGENTS.md)의 Next.js 지침도 함께 따른다.

## 문서 유지 규칙

- 진행 중인 기능의 구체적인 구현 계약은 `docs/plans/active/`에 둔다.
- 결정이나 범위가 바뀌면 코드보다 먼저 또는 같은 변경에서 active 문서를 갱신한다.
- 완료 기준을 모두 검증한 문서는 `docs/plans/completed/YYYY-MM-DD-<name>.md`로 이동하고 active 색인에서 제거한다.
- 장기 제품 원칙은 `anigeunde-service-design.md`에 반영하고, active 문서에는 현재 구현에 필요한 범위와 검증 기준을 적는다.
