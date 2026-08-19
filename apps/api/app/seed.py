from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Comment, Issue, IssueOption, IssueSource, Reaction

ISSUES = [
    {
        "slug": "four-and-half-day-workweek",
        "question": "주 4.5일제, 법으로 추진해야 할까?",
        "brief": "노동시간 단축이 삶의 질과 생산성을 높일 수 있다는 기대와 중소기업의 비용 부담이 맞섭니다. 전국 법제화와 업종별 시범 도입 중 어떤 순서가 현실적일까요?",
        "category": "사회",
        "featured": 1,
        "options": [
            ("전국적으로 법제화해야 한다", "전국 법제화", 0, 618),
            ("업종별 시범 도입부터 해야 한다", "시범 도입", 1, 441),
            ("법제화에 반대한다", "법제화 반대", 2, 179),
            ("아직 판단하기 어렵다", "판단 유보", 3, 46),
        ],
        "sources": [
            ("근로시간 제도 개편 관련 자료", "고용노동부", "https://www.moel.go.kr", "OFFICIAL"),
            ("근로시간 단축과 생산성 연구", "한국노동연구원", "https://www.kli.re.kr", "RESEARCH"),
        ],
    },
    {
        "slug": "ai-textbook-policy",
        "question": "AI 디지털교과서, 학교에 계속 확대해야 할까?",
        "brief": "개인화 학습의 가능성과 교실 내 디지털 의존, 예산 부담이 동시에 제기됩니다. 전면 확대보다 효과 검증이 먼저일까요?",
        "category": "교육",
        "featured": 0,
        "options": [
            ("계획대로 확대해야 한다", "계획대로 확대", 0, 287),
            ("제한적으로 검증해야 한다", "제한적 검증", 1, 529),
            ("도입을 중단해야 한다", "도입 중단", 2, 166),
        ],
        "sources": [
            ("AI 디지털교과서 정책 안내", "교육부", "https://www.moe.go.kr", "OFFICIAL"),
        ],
    },
    {
        "slug": "delivery-platform-fee",
        "question": "배달 플랫폼 수수료에 상한을 둬야 할까?",
        "brief": "자영업자 부담을 낮추기 위한 규제가 필요하다는 주장과 가격·서비스 경쟁을 제한할 수 있다는 우려가 충돌합니다.",
        "category": "경제",
        "featured": 0,
        "options": [
            ("법정 상한이 필요하다", "상한 필요", 0, 403),
            ("자율 상생안을 우선해야 한다", "자율안 우선", 1, 211),
            ("시장 경쟁에 맡겨야 한다", "시장 경쟁", 2, 97),
        ],
        "sources": [
            ("온라인 플랫폼 거래 정책자료", "공정거래위원회", "https://www.ftc.go.kr", "OFFICIAL"),
        ],
    },
]


def seed_database(db: Session) -> None:
    if db.scalar(select(func.count(Issue.id))):
        ensure_mock_replies(db)
        return

    created: list[Issue] = []
    for data in ISSUES:
        issue = Issue(
            slug=data["slug"],
            question=data["question"],
            brief=data["brief"],
            category=data["category"],
            featured=data["featured"],
        )
        for label, short_label, sort_order, seed_votes in data["options"]:
            issue.options.append(
                IssueOption(
                    label=label,
                    short_label=short_label,
                    sort_order=sort_order,
                    seed_votes=seed_votes,
                )
            )
        for title, publisher, url, source_type in data["sources"]:
            issue.sources.append(
                IssueSource(
                    title=title,
                    publisher=publisher,
                    url=url,
                    source_type=source_type,
                )
            )
        db.add(issue)
        created.append(issue)

    db.flush()
    featured = created[0]
    comments = [
        Comment(
            issue_id=featured.id,
            user_id="seed-haneul",
            nickname="느린하늘",
            body="전면 도입보다 업종별 시범 운영이 먼저라고 봐요. 노동집약 업종과 지식산업의 생산성 구조가 다른데 하나의 기준으로 밀어붙이면 작은 사업장이 충격을 먼저 받습니다.",
            position_option_id=featured.options[1].id,
        ),
        Comment(
            issue_id=featured.id,
            user_id="seed-wave",
            nickname="검은파도",
            body="시범사업만 반복하면 실제 변화는 계속 미뤄집니다. 법으로 큰 방향과 최소 기준을 정하고 업종별 유예기간을 두는 편이 예측 가능성도 높습니다.",
            position_option_id=featured.options[0].id,
        ),
        Comment(
            issue_id=featured.id,
            user_id="seed-pencil",
            nickname="연필심",
            body="노동시간만 줄이고 업무량이 그대로라면 압축 노동이 될 수 있습니다. 임금 보전과 인력 충원 방안이 함께 제시되기 전에는 판단을 유보하고 싶습니다.",
            position_option_id=featured.options[3].id,
        ),
    ]
    db.add_all(comments)
    db.flush()
    for index, comment in enumerate(comments):
        for number in range(14 - index * 3):
            db.add(
                Reaction(
                    comment_id=comment.id,
                    user_id=f"seed-reaction-{index}-{number}",
                    reaction_type="LIKE" if number > 2 else "DISLIKE",
                )
            )
    db.commit()
    ensure_mock_replies(db)


def ensure_mock_replies(db: Session) -> None:
    if db.scalar(select(func.count(Comment.id)).where(Comment.depth > 0)):
        return

    issue = db.scalar(select(Issue).where(Issue.slug == "four-and-half-day-workweek"))
    if not issue:
        return
    roots = list(
        db.scalars(
            select(Comment)
            .where(Comment.issue_id == issue.id, Comment.parent_id.is_(None))
            .order_by(Comment.created_at.asc())
        )
    )
    if len(roots) < 3:
        return

    replies = [
        Comment(
            issue_id=issue.id,
            user_id="seed-reply-1",
            nickname="퇴근은언제",
            body="시범 운영을 하더라도 종료 시점과 본사업 전환 조건을 먼저 공개해야 한다고 봅니다.",
            parent_id=roots[0].id,
            depth=1,
            position_option_id=issue.options[1].id,
        ),
        Comment(
            issue_id=issue.id,
            user_id="seed-reply-2",
            nickname="작은가게",
            body="직원 다섯 명인 사업장은 한 명만 빠져도 운영이 어렵습니다. 지원책 없이 기간만 줄이면 버티기 힘들어요.",
            parent_id=roots[0].id,
            depth=1,
            position_option_id=issue.options[2].id,
        ),
        Comment(
            issue_id=issue.id,
            user_id="seed-reply-3",
            nickname="월요일싫어",
            body="유예기간을 길게 주더라도 최소 기준을 법으로 정해야 회사가 준비를 시작하지 않을까요?",
            parent_id=roots[1].id,
            depth=1,
            position_option_id=issue.options[0].id,
        ),
        Comment(
            issue_id=issue.id,
            user_id="seed-reply-4",
            nickname="통계보는중",
            body="임금과 실제 업무시간을 함께 공개하는 시범사업 데이터가 있어야 판단할 수 있을 것 같아요.",
            parent_id=roots[2].id,
            depth=1,
            position_option_id=issue.options[3].id,
        ),
    ]
    db.add_all(replies)
    db.flush()
    nested = [
        Comment(
            issue_id=issue.id,
            user_id="seed-nested-1",
            nickname="기준이먼저",
            body="맞아요. 생산성과 이직률을 몇 개월 동안 측정할지까지 정해야 단순 홍보성 시범사업이 안 됩니다.",
            parent_id=replies[0].id,
            depth=2,
            position_option_id=issue.options[1].id,
        ),
        Comment(
            issue_id=issue.id,
            user_id="seed-nested-2",
            nickname="현실주의자",
            body="그래서 영세 사업장에는 인건비 지원이나 공동 대체인력 같은 별도 장치가 필요해 보여요.",
            parent_id=replies[1].id,
            depth=2,
            position_option_id=issue.options[1].id,
        ),
        Comment(
            issue_id=issue.id,
            user_id="seed-nested-3",
            nickname="반대편도봄",
            body="법제화 방향에는 동의하지만 일괄 시행보다 업종별 시행일을 다르게 두는 게 현실적이겠네요.",
            parent_id=replies[2].id,
            depth=2,
            position_option_id=issue.options[0].id,
        ),
    ]
    db.add_all(nested)
    db.commit()
