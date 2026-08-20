# 카카오톡 주제 공유

- 최종 갱신일: `2026-08-19`
- 공개 URL: `https://anigeunde.bukae.co.kr/issues/{slug}`

## 목적

주제 상세 화면에서 사용자가 친구 또는 채팅방에 `너는 어떻게 생각해?`라는 질문과 함께
현재 주제를 보낼 수 있게 한다. 공유받은 사람은 카드의 `내 생각 고르기` 버튼으로 같은
주제에 바로 진입한다.

## 사용자 흐름

1. 주제 질문과 설명 바로 아래의 `카톡으로 물어보기`를 누른다.
2. Kakao JavaScript SDK를 사용할 수 있으면 카카오톡 친구·채팅방 선택 화면을 연다.
3. 공유 카드에는 서비스명, `친구야, 너는 어떻게 생각해?`, 실제 주제 질문과
   `내 생각 고르기` 링크를 표시한다. 프로필 영역에는 `아니근데`와 원형 서비스 로고를
   명시적으로 전달한다.
4. SDK를 사용할 수 없는 모바일 브라우저에서는 OS 공유 시트를 연다.
5. 공유 시트도 지원하지 않는 데스크톱 브라우저에서는 주제 링크를 복사한다.

## Kakao Developers 설정

Kakao Developers 앱의 JavaScript 키를 Vercel과 로컬 웹 환경의
`NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`에 설정한다. REST API 키나 Client Secret을 이 값으로
사용하지 않는다.

- JavaScript SDK 도메인
  - `http://localhost:3000`
  - `https://anigeunde.bukae.co.kr`
- 제품 링크 Web 도메인
  - `https://anigeunde.bukae.co.kr`
- 배포 환경 공개 URL
  - `NEXT_PUBLIC_SITE_URL=https://anigeunde.bukae.co.kr`

JavaScript 키는 브라우저에 전달되는 플랫폼 키이므로 도메인 등록으로 사용 범위를 제한한다.
DB 비밀번호, REST API secret 또는 Admin 키는 웹 저장소와 Vercel의 `NEXT_PUBLIC_*` 환경에
넣지 않는다.

## MVP 검증 기준

- 390px 모바일 화면에서 주제 제목과 공유 버튼이 가로 스크롤 없이 보인다.
- 카카오톡 공유 카드의 버튼이 정확한 주제 slug로 이동한다.
- SDK 미설정·로딩 실패 환경에서도 공유 버튼이 무반응 상태가 되지 않는다.
- 공유받은 사용자는 로그인하지 않아도 주제와 의견을 읽을 수 있다.
- 공유 발송 성공 집계는 MVP 이후 Kakao Talk Share 웹훅으로 추가한다.
