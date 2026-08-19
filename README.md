# 아니근데

뉴스가 아니라 쟁점을 읽고, 내 입장을 고르고, 서로의 의견에 댓글을
다는 정치·사회 이슈 토론 서비스입니다.

현재 구현은 Supabase 연결 전에도 전체 제품 흐름을 검증할 수 있는 로컬
MVP입니다. FastAPI는 SQLite에 데모 데이터와 사용자 행동을 저장합니다.

## 현재 개발 우선순위

MVP를 최대한 빠르게 배포하는 것이 현재 목표입니다. 다음 구현 작업은
CI/CD 구축을 가장 먼저 진행하며, 자동 테스트는 인증 우회, 중복 참여,
핵심 쓰기 흐름과 배포 실패 방지에 필요한 범위만 유지합니다. 광범위한 UI,
브라우저 조합과 비핵심 예외 테스트는 MVP 출시 이후로 미룹니다.

구체적인 범위와 완료 기준은
[MVP 출시 우선순위 문서](./docs/plans/active/mvp-delivery-priority.md)를 따릅니다.

## 구현된 흐름

- 쟁점 목록과 카테고리 필터
- 입장 선택 전 결과 비공개
- 입장 선택 및 변경 후 참여자 분포 공개
- 비로그인 공개 의견 열람과 로그인 요구 화면 목업
- 만 14세 이상·일반 약관·민감정보 별도 동의 목업
- 의견 작성
- 특정 의견에 댓글 작성
- `좋아요`, `싫어요` 토글
- 반응형 검정·흰색 UI
- 이용약관·개인정보 처리방침·커뮤니티 운영정책·권리침해 신고 초안
- FastAPI live/ready 상태 확인

인증 UI는 `로그인된 익명` 흐름을 검증하는 목업이며, 실제 API 쓰기는
고정된 데모 사용자 헤더를 사용합니다. Google·Kakao 버튼은 실제 OAuth가
아닙니다. 공개 배포 전 OAuth 세션과 CSRF 보호로 교체해야 합니다.

## 로컬 실행

백엔드:

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/uvicorn app.main:app --reload
```

프론트엔드:

```bash
pnpm install
pnpm dev
```

- 웹: <http://localhost:3000>
- API 문서: <http://localhost:8000/docs>
- API 상태: <http://localhost:8000/health/ready>

`apps/web/.env.example`을 `.env.local`로 복사하면 API 주소를 변경할 수
있습니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm build
cd apps/api && .venv/bin/ruff check . && .venv/bin/pytest
```

## 개발 문서

에이전트와 개발자는 다음 순서로 문서를 확인합니다.

1. [에이전트 안내](./AGENTS.md)
2. [개발 문서 지도](./docs/README.md)
3. [현재 active 계획](./docs/plans/active/README.md)
4. [전체 서비스 설계서](./anigeunde-service-design.md)
5. [OCI 인프라 문서](./infra/README.md)

현재 뉴스 API 후보 수집과 관리자 최종 발행 구현 계약은
[active 문서](./docs/plans/active/news-issue-pipeline.md)에 있습니다.
로그인된 익명 참여와 Google·Kakao OAuth 구현 계약은
[인증 active 문서](./docs/plans/active/authenticated-anonymous-participation.md)에 있습니다.
일반 신고와 권리침해·저작권 처리 구현 계약은
[법적 신고 active 문서](./docs/plans/active/legal-reporting-operations.md)에 있습니다.
