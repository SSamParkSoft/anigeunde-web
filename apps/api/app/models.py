from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_id() -> str:
    return str(uuid4())


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    question: Mapped[str] = mapped_column(String(300))
    brief: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30), index=True)
    status: Mapped[str] = mapped_column(String(30), default="PUBLISHED")
    featured: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    options: Mapped[list["IssueOption"]] = relationship(
        back_populates="issue", cascade="all, delete-orphan", order_by="IssueOption.sort_order"
    )
    sources: Mapped[list["IssueSource"]] = relationship(
        back_populates="issue", cascade="all, delete-orphan"
    )


class IssueOption(Base):
    __tablename__ = "issue_options"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(160))
    short_label: Mapped[str] = mapped_column(String(60))
    sort_order: Mapped[int] = mapped_column(Integer)
    seed_votes: Mapped[int] = mapped_column(Integer, default=0)

    issue: Mapped[Issue] = relationship(back_populates="options")


class IssueSource(Base):
    __tablename__ = "issue_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    publisher: Mapped[str] = mapped_column(String(120))
    url: Mapped[str] = mapped_column(String(1000))
    source_type: Mapped[str] = mapped_column(String(30), default="OFFICIAL")

    issue: Mapped[Issue] = relationship(back_populates="sources")


class Position(Base):
    __tablename__ = "positions"
    __table_args__ = (UniqueConstraint("issue_id", "user_id", name="uq_position_issue_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    option_id: Mapped[str] = mapped_column(ForeignKey("issue_options.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(80), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(80), index=True)
    nickname: Mapped[str] = mapped_column(String(40))
    body: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("comments.id"), nullable=True, index=True)
    depth: Mapped[int] = mapped_column(Integer, default=0)
    position_option_id: Mapped[str] = mapped_column(ForeignKey("issue_options.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", "reaction_type", name="uq_reaction_user_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    comment_id: Mapped[str] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(80), index=True)
    reaction_type: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
