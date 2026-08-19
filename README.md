# 아니근데 Web

`아니근데`의 공개 Next.js 프론트엔드 저장소입니다.

- 프로덕션 웹: <https://anigeunde.bukae.co.kr>
- 프로덕션 API: <https://api.anigeunde.bukae.co.kr>
- API 저장소: `SSamParkSoft/anigeunde-api` (private)

브라우저는 Supabase 데이터베이스에 직접 쓰지 않습니다. 로그인은 Supabase
Auth를 사용하고, 쟁점·투표·의견 데이터는 FastAPI를 통해 처리합니다.

## 로컬 실행

```bash
pnpm install
pnpm dev
```

- 웹: <http://localhost:3000>
- 기본 API: <http://localhost:8000>

API 주소를 바꾸려면 `apps/web/.env.example`을 `apps/web/.env.local`로
복사하고 `NEXT_PUBLIC_API_URL`을 설정합니다.

Supabase Project URL과 publishable key는 공개 클라이언트 설정으로
`.env.example`에 기록되어 있습니다. DB 비밀번호와 secret/service-role
키는 이 저장소에서 사용하지 않습니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 배포

GitHub Actions의 `Deploy Web` 워크플로가 Vercel production 배포를
담당합니다. 최초 수동 배포가 성공한 뒤 저장소 변수
`CD_WEB_ENABLED=true`로 자동 배포를 활성화합니다.

필요한 `production-web` 환경 secret은 다음과 같습니다.

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Vercel 프로젝트의 Root Directory는 `apps/web`입니다.

## 공개 저장소 경계

이 저장소에는 브라우저에 전달되어도 안전한 코드와 설정만 둡니다.
데이터베이스 접속 문자열, Supabase secret/service-role 키, OAuth client
secret, OCI SSH 키와 관리자 운영 로직은 넣지 않습니다.

개발자는 [`AGENTS.md`](./AGENTS.md)와 [`docs/README.md`](./docs/README.md)를
먼저 확인합니다.
