from pydantic import BaseModel, Field


class PositionCreate(BaseModel):
    option_id: str
    visibility: str = "PSEUDONYMOUS"
    sensitive_data_consent_version: str = "2026-08-18"


class CommentCreate(BaseModel):
    body: str = Field(min_length=10, max_length=2000)

