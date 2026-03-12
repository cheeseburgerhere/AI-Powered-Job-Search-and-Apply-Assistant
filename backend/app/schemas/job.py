from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class JobCreate(BaseModel):
    title: str
    company: str
    description: str
    url: Optional[str] = None
    location: Optional[str] = None
    remote_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None


class JobUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    next_follow_up: Optional[datetime] = None


class JobResponse(BaseModel):
    id: int
    external_id: Optional[str] = None
    source: str = "manual"
    title: str
    company: str
    location: str = ""
    remote_type: str = ""
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    description: str
    url: Optional[str] = None
    fit_score: Optional[float] = None
    fit_reasoning: Optional[str] = None
    status: str
    date_saved: Optional[datetime] = None
    date_applied: Optional[datetime] = None
    next_follow_up: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class JobSearchRequest(BaseModel):
    query: Optional[str] = None
    location: Optional[str] = None
    remote_only: bool = False
    page: int = 1
    per_page: int = 20
