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
    status: Optional[str] = None
    cover_letter: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    location: Optional[str] = None
    remote_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    next_follow_up: Optional[datetime] = None
    cover_letter: Optional[str] = None


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
    category: str = ""
    priority: str = ""
    status: str
    date_saved: Optional[datetime] = None
    date_applied: Optional[datetime] = None
    next_follow_up: Optional[datetime] = None
    notes: Optional[str] = None
    link_type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class JobSearchRequest(BaseModel):
    query: Optional[str] = None
    location: Optional[str] = None
    remote_only: Optional[bool] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    sources: Optional[list[str]] = None  # jsearch, adzuna, google_scrape
    score_results: bool = True
    min_fit_score: Optional[float] = None
    max_scored_jobs: int = 8
    country: Optional[str] = None  # Adzuna country code, e.g. us, gb, de
    scrape_sites: Optional[list[str]] = None  # e.g. ["boards.greenhouse.io", "jobs.lever.co"]
    company_slugs: Optional[list[str]] = None  # e.g. ["stripe", "figma"] for direct ATS search
    page: int = 1
    per_page: int = 20
