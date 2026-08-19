# 아니근데 Web 에이전트 안내

이 저장소는 공개 Next.js 프론트엔드 전용 저장소다.

구현 전에 다음 문서를 순서대로 확인한다.

1. [`README.md`](./README.md) — 실행, 검증, 배포와 저장소 경계
2. [`docs/README.md`](./docs/README.md) — 공개 개발 문서 지도
3. [`apps/web/AGENTS.md`](./apps/web/AGENTS.md) — 현재 Next.js 버전 지침

## 저장소 경계

- FastAPI, DB migration, 뉴스 수집, 관리자 운영 로직과 OCI 인프라는
  private `SSamParkSoft/anigeunde-api` 저장소에서 관리한다.
- 브라우저에 노출되면 안 되는 비밀값을 코드, 문서, 예시 또는 GitHub
  Actions 로그에 남기지 않는다.
- 프론트와 API는 HTTPS/OpenAPI 계약으로 연결한다.
- API 계약 변경이 필요한 경우 private API 저장소의 구현과 배포 순서를
  먼저 확인한다.
- MVP 테스트는 lint, TypeScript 검사와 production build를 필수로 하고,
  광범위한 UI 테스트는 출시 이후로 미룬다.

## 문서 유지

- 공개 UI, 브랜드와 프론트 배포에 필요한 문서만 이 저장소에 둔다.
- 인증·데이터·운영 정책의 기준 문서는 private API 저장소에서 관리한다.
