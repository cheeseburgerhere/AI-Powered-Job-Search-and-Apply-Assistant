from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CoverLetterGenerate(BaseModel):
    job_id: int


class CoverLetterRefine(BaseModel):
    feedback: str


class CoverLetterStatusUpdate(BaseModel):
    status: str  # "draft" or "ready"


class CoverLetterContentUpdate(BaseModel):
    content: str


class CoverLetterResponse(BaseModel):
    id: int
    job_id: int
    version: int
    content: str
    feedback: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
