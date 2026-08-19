from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import Comment, Issue, IssueOption, Position, Reaction
from app.schemas import CommentCreate, PositionCreate
from app.seed import seed_database

settings = get_settings()
REACTION_TYPES = {"like": "LIKE", "dislike": "DISLIKE"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
        db.execute(
            update(Reaction)
            .where(Reaction.reaction_type == "MAKES_SENSE")
            .values(reaction_type="LIKE")
        )
        db.execute(
            update(Reaction)
            .where(Reaction.reaction_type == "CHANGED_MIND")
            .values(reaction_type="DISLIKE")
        )
        db.commit()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(HTTPException)
async def problem_details(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "about:blank",
            "title": exc.detail,
            "status": exc.status_code,
            "detail": exc.detail,
            "instance": request.url.path,
            "request_id": request.headers.get("X-Request-ID", ""),
        },
        media_type="application/problem+json",
    )


def require_viewer(x_viewer_id: str | None = Header(default=None)) -> str:
    if not x_viewer_id:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    return x_viewer_id


def issue_or_404(db: Session, identifier: str) -> Issue:
    issue = db.scalar(select(Issue).where((Issue.id == identifier) | (Issue.slug == identifier)))
    if not issue:
        raise HTTPException(status_code=404, detail="쟁점을 찾을 수 없습니다")
    return issue


def result_payload(db: Session, issue: Issue) -> dict:
    live_counts = dict(
        db.execute(
            select(Position.option_id, func.count(Position.id))
            .where(Position.issue_id == issue.id)
            .group_by(Position.option_id)
        ).all()
    )
    counts = [option.seed_votes + live_counts.get(option.id, 0) for option in issue.options]
    total = sum(counts)
    return {
        "total": total,
        "updated_at": datetime.now(UTC).isoformat(),
        "options": [
            {
                "option_id": option.id,
                "label": option.short_label,
                "count": count,
                "percentage": round(count / total * 100) if total else 0,
            }
            for option, count in zip(issue.options, counts, strict=True)
        ],
    }


def comment_payload(db: Session, comment: Comment, viewer_id: str | None) -> dict:
    option = db.get(IssueOption, comment.position_option_id)
    reaction_rows = db.execute(
        select(Reaction.reaction_type, func.count(Reaction.id))
        .where(Reaction.comment_id == comment.id)
        .group_by(Reaction.reaction_type)
    ).all()
    reactions = dict(reaction_rows)
    viewer_reactions: list[str] = []
    if viewer_id:
        viewer_reactions = list(
            db.scalars(
                select(Reaction.reaction_type).where(
                    Reaction.comment_id == comment.id, Reaction.user_id == viewer_id
                )
            ).all()
        )
    replies = list(
        db.scalars(
            select(Comment)
            .where(Comment.parent_id == comment.id)
            .order_by(Comment.created_at.asc())
        )
    )
    return {
        "id": comment.id,
        "nickname": comment.nickname,
        "body": comment.body,
        "position": option.short_label if option else "입장 비공개",
        "created_at": comment.created_at.isoformat(),
        "depth": comment.depth,
        "parent_id": comment.parent_id,
        "is_mine": comment.user_id == viewer_id,
        "like_count": reactions.get("LIKE", 0),
        "dislike_count": reactions.get("DISLIKE", 0),
        "rebuttal_count": len(replies),
        "viewer_reactions": viewer_reactions,
        "replies": [comment_payload(db, reply, viewer_id) for reply in replies],
    }


@app.get("/health/live")
def health_live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(select(1))
    return {"status": "ready"}


@app.get("/api/v1/issues")
def list_issues(db: Session = Depends(get_db)) -> dict:
    issues = list(db.scalars(select(Issue).order_by(Issue.featured.desc(), Issue.created_at.desc())))
    return {
        "items": [
            {
                "id": issue.id,
                "slug": issue.slug,
                "question": issue.question,
                "brief": issue.brief,
                "category": issue.category,
                "status": issue.status,
                "featured": bool(issue.featured),
                "participant_count": sum(option.seed_votes for option in issue.options)
                + (db.scalar(select(func.count(Position.id)).where(Position.issue_id == issue.id)) or 0),
                "comment_count": db.scalar(
                    select(func.count(Comment.id)).where(Comment.issue_id == issue.id)
                )
                or 0,
                "source_count": len(issue.sources),
            }
            for issue in issues
        ]
    }


@app.get("/api/v1/issues/{slug}")
def get_issue(
    slug: str,
    x_viewer_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    issue = issue_or_404(db, slug)
    position = None
    if x_viewer_id:
        position = db.scalar(
            select(Position).where(Position.issue_id == issue.id, Position.user_id == x_viewer_id)
        )
    return {
        "id": issue.id,
        "slug": issue.slug,
        "question": issue.question,
        "brief": issue.brief,
        "category": issue.category,
        "status": issue.status,
        "updated_at": issue.updated_at.isoformat(),
        "options": [
            {"id": option.id, "label": option.label, "short_label": option.short_label}
            for option in issue.options
        ],
        "sources": [
            {
                "id": source.id,
                "title": source.title,
                "publisher": source.publisher,
                "url": source.url,
                "source_type": source.source_type,
            }
            for source in issue.sources
        ],
        "my_position_id": position.option_id if position else None,
        "results": result_payload(db, issue) if position else None,
    }


@app.post("/api/v1/issues/{issue_id}/positions")
def set_position(
    issue_id: str,
    payload: PositionCreate,
    viewer_id: str = Depends(require_viewer),
    db: Session = Depends(get_db),
) -> dict:
    issue = issue_or_404(db, issue_id)
    option = db.scalar(
        select(IssueOption).where(IssueOption.id == payload.option_id, IssueOption.issue_id == issue.id)
    )
    if not option:
        raise HTTPException(status_code=422, detail="유효하지 않은 선택지입니다")
    position = db.scalar(
        select(Position).where(Position.issue_id == issue.id, Position.user_id == viewer_id)
    )
    if position:
        position.option_id = option.id
        position.updated_at = datetime.now(UTC)
    else:
        db.add(Position(issue_id=issue.id, option_id=option.id, user_id=viewer_id))
    db.commit()
    return {"my_position_id": option.id, "results": result_payload(db, issue)}


@app.get("/api/v1/issues/{issue_id}/comments")
def list_comments(
    issue_id: str,
    parent_id: str | None = Query(default=None),
    x_viewer_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    issue = issue_or_404(db, issue_id)
    query = select(Comment).where(Comment.issue_id == issue.id)
    query = query.where(Comment.parent_id == parent_id) if parent_id else query.where(Comment.parent_id.is_(None))
    comments = list(db.scalars(query.order_by(Comment.created_at.desc())))
    return {"items": [comment_payload(db, comment, x_viewer_id) for comment in comments]}


def create_comment_record(
    db: Session,
    issue: Issue,
    viewer_id: str,
    payload: CommentCreate,
    parent: Comment | None = None,
) -> Comment:
    position = db.scalar(
        select(Position).where(Position.issue_id == issue.id, Position.user_id == viewer_id)
    )
    if not position:
        raise HTTPException(status_code=409, detail="먼저 내 입장을 선택해 주세요")
    if parent and parent.depth >= 5:
        raise HTTPException(status_code=409, detail="댓글은 최대 5단계까지 작성할 수 있습니다")
    comment = Comment(
        issue_id=issue.id,
        user_id=viewer_id,
        nickname="새까만콩",
        body=payload.body.strip(),
        parent_id=parent.id if parent else None,
        depth=(parent.depth + 1) if parent else 0,
        position_option_id=position.option_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.post("/api/v1/issues/{issue_id}/comments", status_code=status.HTTP_201_CREATED)
def create_comment(
    issue_id: str,
    payload: CommentCreate,
    viewer_id: str = Depends(require_viewer),
    db: Session = Depends(get_db),
) -> dict:
    issue = issue_or_404(db, issue_id)
    return comment_payload(db, create_comment_record(db, issue, viewer_id, payload), viewer_id)


@app.post("/api/v1/comments/{comment_id}/rebuttals", status_code=status.HTTP_201_CREATED)
def create_rebuttal(
    comment_id: str,
    payload: CommentCreate,
    viewer_id: str = Depends(require_viewer),
    db: Session = Depends(get_db),
) -> dict:
    parent = db.get(Comment, comment_id)
    if not parent:
        raise HTTPException(status_code=404, detail="의견을 찾을 수 없습니다")
    issue = issue_or_404(db, parent.issue_id)
    return comment_payload(db, create_comment_record(db, issue, viewer_id, payload, parent), viewer_id)


@app.put("/api/v1/comments/{comment_id}/reactions/{reaction_type}")
def add_reaction(
    comment_id: str,
    reaction_type: str,
    viewer_id: str = Depends(require_viewer),
    db: Session = Depends(get_db),
) -> dict:
    normalized = REACTION_TYPES.get(reaction_type)
    comment = db.get(Comment, comment_id)
    if not normalized or not comment:
        raise HTTPException(status_code=404, detail="반응 대상을 찾을 수 없습니다")
    if comment.user_id == viewer_id:
        raise HTTPException(status_code=409, detail="내 의견에는 반응할 수 없습니다")
    existing = db.scalar(
        select(Reaction).where(
            Reaction.comment_id == comment.id,
            Reaction.user_id == viewer_id,
            Reaction.reaction_type == normalized,
        )
    )
    if not existing:
        db.add(Reaction(comment_id=comment.id, user_id=viewer_id, reaction_type=normalized))
        db.commit()
    return comment_payload(db, comment, viewer_id)


@app.delete("/api/v1/comments/{comment_id}/reactions/{reaction_type}", status_code=204)
def remove_reaction(
    comment_id: str,
    reaction_type: str,
    viewer_id: str = Depends(require_viewer),
    db: Session = Depends(get_db),
) -> Response:
    normalized = REACTION_TYPES.get(reaction_type)
    reaction = db.scalar(
        select(Reaction).where(
            Reaction.comment_id == comment_id,
            Reaction.user_id == viewer_id,
            Reaction.reaction_type == normalized,
        )
    )
    if reaction:
        db.delete(reaction)
        db.commit()
    return Response(status_code=204)
