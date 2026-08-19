# 뉴스 후보 수집과 관리자 쟁점 발행

- 상태: `ACTIVE`
- 최종 갱신일: `2026-08-18`
- 대상: FastAPI, 수집 워커, 관리자 웹
- 기준 설계: [`anigeunde-service-design.md` 9장](../../../anigeunde-service-design.md#9-쟁점뉴스-소스-생성-및-관리자-워크플로)

## 1. 목표

카테고리별 뉴스와 공공자료에서 쟁점 후보를 발견하고, 중복 기사 묶음과 근거자료를 관리자 후보함에 제공한다. AI는 쟁점 질문·선택지·브리프 초안만 작성하며, 최종 발행은 관리자가 명시적으로 승인한다.

이 기능은 뉴스 피드나 기사 재배포 서비스가 아니다. 외부 기사는 쟁점을 발견하고 사실을 확인하는 참고자료이며, 공개 화면의 중심 콘텐츠는 회사가 작성·검수한 질문형 쟁점이다.

## 2. 확정된 제품 결정

- 뉴스 후보 수집원은 NAVER API HUB 뉴스 검색 API로 시작한다.
- API에 카테고리 파라미터가 없으므로 내부 검색어 묶음과 자체 분류기를 사용한다.
- 기사 본문, 사진과 영상은 저장하지 않는다.
- 동일 사건의 기사를 URL·정규화 제목·유사도 기준으로 묶는다.
- 후보 점수는 관리자 검토 순서에만 사용하고 자동 발행에 사용하지 않는다.
- 가능하면 정부·국회·법원·선관위·KOSIS 등 1차 자료를 연결한다.
- AI 또는 수집기는 `DRAFT`까지만 만들 수 있다.
- `EDITOR` 또는 `ADMIN`의 승인 없이는 `PUBLISHED`로 전환할 수 없다.
- 이용자가 직접 쟁점을 작성하거나 발행하는 기능은 제공하지 않는다.

## 3. 현재 구현 상태

현재 API에는 SQLite 기반 `issues`, `issue_options`, `issue_sources`와 공개 조회 API만 있다. 뉴스 수집기, 후보 테이블, 관리자 인증·후보함·편집기·발행 감사 로그는 아직 구현되지 않았다.

개발 중 데모 데이터가 존재하더라도 뉴스 파이프라인이 구현된 것으로 간주하지 않는다.

## 4. 외부 API

### 4.1 NAVER API HUB

- 뉴스 검색: `GET https://naverapihub.apigw.ntruss.com/search/v1/news`
- 검색어 트렌드: `POST https://naverapihub.apigw.ntruss.com/search-trend/v1/search`
- 뉴스 검색 응답: 제목, 원문 URL, 네이버 URL, 검색 결과 요약, 게시 시각
- 뉴스 검색 호출 한도: 하루 25,000회
- 신규 애플리케이션은 NAVER Cloud Platform의 NAVER API HUB에서 발급한다.

공식 문서:

- [뉴스 검색 결과 조회](https://api.ncloud-docs.com/docs/naver-api-hub-search-news)
- [검색어 트렌드 조회](https://api.ncloud-docs.com/docs/naver-api-hub-search-trend)
- [NAVER API HUB 사용](https://guide.ncloud-docs.com/docs/apihub-use)
- [NAVER API 서비스 이용약관](https://developers.naver.com/products/terms/)

필요 환경변수:

```text
NAVER_API_HUB_CLIENT_ID=
NAVER_API_HUB_CLIENT_SECRET=
NEWS_FETCH_ENABLED=false
NEWS_FETCH_INTERVAL_MINUTES=60
NEWS_DAILY_CALL_BUDGET=5000
```

비밀값은 저장소, 브라우저 번들, 로그와 오류 응답에 노출하지 않는다. API 호출은 백엔드 또는 별도 워커에서만 수행한다.

## 5. 카테고리와 검색어

초기 카테고리는 다음 여섯 개로 시작한다.

| 코드 | 검색어 예시 |
|---|---|
| `POLITICS` | 국회, 정부, 대통령실, 정당, 선거, 법안, 국정감사 |
| `ECONOMY` | 금리, 물가, 부동산, 고용, 세금, 기업, 최저임금 |
| `SOCIETY` | 교육, 노동, 복지, 의료, 범죄, 교통, 재난 |
| `TECH` | 인공지능, 플랫폼, 개인정보, 게임, 반도체, 과학기술 |
| `ENVIRONMENT` | 기후, 탄소, 원전, 재생에너지, 미세먼지, 환경 |
| `WORLD` | 외교, 안보, 국제분쟁, 무역, 미국, 중국, 일본 |

검색어는 코드에 하드코딩하지 않고 관리자 설정 또는 DB에서 활성 여부, 호출 주기와 마지막 수집 시각을 관리한다. 하나의 기사는 여러 카테고리 후보가 될 수 있으며 관리자가 발행 전에 최종 카테고리를 정한다.

## 6. 수집과 분류 흐름

```text
활성 검색어 조회
  → sort=date, display<=100으로 뉴스 검색
  → 응답 스키마와 URL 검증
  → 제목·요약의 HTML 태그 제거
  → URL 정규화와 해시 생성
  → 동일 URL 중복 제거
  → 유사 제목 클러스터링
  → 카테고리 점수 계산
  → 검색 추이와 1차 자료 후보 연결
  → 관리자 후보함 저장
```

30분 주기로 6개 카테고리 × 카테고리당 10개 검색어를 호출하면 하루 약 2,880회다. 첫 운영은 60분 주기와 하루 5,000회 내부 예산으로 시작한다. 429·5xx 응답에는 지수 백오프와 무작위 지연을 적용하며 일일 예산을 넘으면 다음 날까지 자동 중단한다.

카테고리 판정 순서:

1. 후보를 발견한 검색어의 기본 카테고리
2. 제목·요약에 포함된 기관·인물·법안·정책 키워드 점수
3. 여러 검색어에서 발견된 경우 카테고리별 누적 점수
4. 애매한 후보에 한해 제한된 AI 분류
5. 관리자의 최종 선택

## 7. 저장 모델

구현 시 다음 테이블을 추가한다. 실제 마이그레이션 이름은 프로젝트 규칙을 따르되 의미와 제약을 유지한다.

### `news_search_queries`

| 필드 | 설명 |
|---|---|
| `id` | 기본키 |
| `category` | 내부 카테고리 코드 |
| `query` | 네이버 검색어 |
| `enabled` | 수집 활성 여부 |
| `interval_minutes` | 검색어별 호출 주기 |
| `last_fetched_at` | 마지막 성공 시각 |

### `news_candidates`

| 필드 | 설명 |
|---|---|
| `id` | 기본키 |
| `provider` | `NAVER_API_HUB` |
| `title` | 태그를 제거한 원문 제목 |
| `description` | API 검색 결과 요약문 |
| `original_url` | 원문 URL |
| `naver_url` | 네이버 뉴스 URL, 없으면 null |
| `publisher_domain` | 검증한 원문 호스트 |
| `published_at` | 기사 게시 시각 |
| `first_seen_at`, `last_seen_at` | 최초·최종 발견 시각 |
| `normalized_url_hash` | 정규화 URL 중복 방지, unique |
| `status` | `NEW`, `CLUSTERED`, `PROMOTED`, `DISMISSED` |

### `news_candidate_hits`

하나의 후보가 어떤 검색어와 카테고리에서 언제 발견됐는지 기록한다. `(candidate_id, query_id, fetched_at bucket)`의 불필요한 중복을 막는다.

### `news_clusters`

| 필드 | 설명 |
|---|---|
| `id` | 기본키 |
| `representative_title` | 관리자 후보함 대표 제목 |
| `category_scores` | 카테고리별 점수 |
| `unique_publisher_count` | 고유 언론사 수 |
| `candidate_score` | 검토 순서 점수 |
| `status` | `OPEN`, `DRAFTED`, `DISMISSED`, `LINKED_TO_ISSUE` |
| `first_seen_at`, `last_seen_at` | 사건 관찰 구간 |

후보와 클러스터는 다대다 관계로 연결한다. 관리자가 후보를 쟁점 초안으로 승격하면 기존 `issues`와 연결하되 원본 후보를 지우지 않는다.

## 8. 후보 점수

점수는 설명 가능해야 하며 다음 신호만 사용한다.

- 고유 언론사 수
- 최근 게시와 업데이트 빈도
- 여러 카테고리 검색어에서의 반복 발견
- 네이버 검색어 트렌드 상승
- 정부·국회·법원·KOSIS 등 1차 자료 존재
- 광고성 문구, 동일 보도자료 복제와 단일 출처 여부

점수는 사실성, 중요성 또는 발행 가능성을 보증하지 않는다. 후보함에 점수 구성요소를 함께 표시한다.

## 9. 관리자 워크플로

1. `EDITOR`가 후보 클러스터 목록을 최신순·점수순·카테고리별로 조회한다.
2. 같은 사건으로 잘못 묶인 기사를 분리하고 중복 클러스터를 합친다.
3. 원문 링크를 확인하고 광고·낚시·단순 인사·보도자료 복제 후보를 제외한다.
4. 법안, 판결, 보도자료, 통계 등 1차 자료를 연결한다.
5. 선택한 클러스터를 `DRAFT` 쟁점으로 승격한다.
6. AI 초안을 요청하면 질문, 2~4개 선택지, 확인된 사실, 불확실한 점과 문장별 근거를 생성한다.
7. 관리자가 문장과 출처를 수정하고 선거·명예훼손·저작권·개인정보 위험도를 지정한다.
8. `EDITOR` 또는 `ADMIN`이 최종 승인·예약 발행한다.
9. 발행 후 모든 수정은 개정 이력과 감사 로그에 남긴다.

초안 생성과 발행 API를 분리한다. 수집기 및 AI 서비스 계정에는 발행 권한을 부여하지 않는다.

## 10. 공개 콘텐츠와 저작권 경계

- API 응답 원문을 쟁점 본문으로 자동 복사하지 않는다.
- 기사 본문·사진·영상·도표를 다운로드하거나 재호스팅하지 않는다.
- 공개 쟁점의 브리프는 관리자가 여러 출처를 확인하여 독자적인 문장으로 작성한다.
- 출처에는 언론사, 원문 제목, URL과 게시 시각을 표시한다.
- 유료기사의 접근 제한을 우회하거나 검색 요약문으로 원문을 대체하지 않는다.
- 삭제·정정된 원문을 주기적으로 확인하고 쟁점에 정정 이력을 표시한다.
- 네이버 API 결과를 공개 화면에 직접 노출하는 기능을 추가한다면 당시 이용약관의 표시·변형 제한을 다시 검토한다.

## 11. API와 권한 계약

예상 관리자 API:

```text
GET  /admin/news-candidates
GET  /admin/news-clusters/{id}
POST /admin/news-clusters/{id}/merge
POST /admin/news-clusters/{id}/split
POST /admin/news-clusters/{id}/dismiss
POST /admin/news-clusters/{id}/promote-to-issue
POST /admin/issues/{id}/generate-draft
POST /admin/issues/{id}/submit-review
POST /admin/issues/{id}/approve
POST /admin/issues/{id}/schedule
POST /admin/issues/{id}/publish
```

- 후보 조회·편집: `EDITOR`, `ADMIN`
- 최종 승인·발행: `EDITOR`, `ADMIN`
- 수집 작업 실행: 내부 워커 자격증명
- 모든 상태 전환: 행위자, 이전·이후 상태, 시각과 사유를 감사 로그에 기록

## 12. 구현 순서

1. 설정·비밀값·NAVER API HUB 클라이언트와 계약 테스트
2. 검색어·후보·hit 테이블 및 마이그레이션
3. URL 정규화, 중복 제거와 호출 예산 워커
4. 후보 클러스터링과 설명 가능한 점수
5. 관리자 후보함과 클러스터 수정 기능
6. 후보에서 기존 `Issue` 초안으로 승격
7. 관리자 검수·승인·발행 권한과 감사 로그
8. 1차 자료 연결과 AI 초안 생성
9. 원문 링크 상태·정정 감시

## 13. 완료 기준

- [ ] 실제 NAVER API HUB 테스트 키로 뉴스 검색 계약 테스트가 통과한다.
- [ ] 카테고리 검색어를 코드 배포 없이 활성화·중지할 수 있다.
- [ ] 같은 원문 URL이 여러 검색어에서 발견돼도 후보는 하나만 생성된다.
- [ ] 수집 실패, 429, 일일 예산 초과 시 안전하게 중단·재시도한다.
- [ ] 기사 본문·이미지가 DB, 로그, 오류 추적과 공개 응답에 저장되지 않는다.
- [ ] 관리자가 후보 병합·분리·제외 및 카테고리 수정을 할 수 있다.
- [ ] 후보를 출처가 연결된 `DRAFT` 쟁점으로 승격할 수 있다.
- [ ] 수집기와 AI 권한으로는 발행 API 호출이 거부된다.
- [ ] 관리자 승인과 감사 로그 없이는 쟁점이 `PUBLISHED`가 되지 않는다.
- [ ] 발행된 쟁점에 출처, 비대표성 고지와 정정 이력이 표시된다.
- [ ] API·워커·관리자 흐름의 테스트와 운영 복구 절차가 문서화된다.

## 14. 시작 전 필요한 외부 입력

- NAVER Cloud Platform 계정
- NAVER API HUB 애플리케이션의 Client ID와 Client Secret
- 운영 관리자 계정과 `EDITOR`·`ADMIN` 권한 부여 방식
- 첫 운영 카테고리·검색어 목록의 관리자 승인

외부 키가 없어도 클라이언트 인터페이스, 저장 모델, 테스트 fixture와 관리자 화면은 구현할 수 있다. 실제 호출 검증과 운영 활성화는 키가 준비된 후 완료한다.
