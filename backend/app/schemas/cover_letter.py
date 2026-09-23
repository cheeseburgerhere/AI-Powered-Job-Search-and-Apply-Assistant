from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CoverLetterGenerate(BaseModel):
    job_id: int
    company_website: Optional[str] = None
    company_context: Optional[str] = None


class CoverLetterRefine(BaseModel):
    feedback: str


class CoverLetterStatusUpdate(BaseModel):
    status: str  # "draft" or "ready"


class CoverLetterContentUpdate(BaseModel):
    content: str


class CoverLetterManualVersionCreate(BaseModel):
    content: str
    feedback: Optional[str] = "Manual edit"


class CoverLetterResponse(BaseModel):
    id: int
    job_id: int
    version: int
    content: str
    feedback: Optional[str] = None
    status: str
    source: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
