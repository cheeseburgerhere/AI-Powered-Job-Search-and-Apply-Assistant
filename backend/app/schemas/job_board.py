from datetime import datetime

from pydantic import BaseModel

from app.schemas.job import JobResponse


class JobBoardCreate(BaseModel):
    name: str
    domain: str
    query: str
    location: str | None = None
    remote_only: bool = False
    min_fit_score: float | None = 6.5
    score_results: bool = True
    max_scored_jobs: int = 8
    auto_apply_enabled: bool = False
    apply_mode: str = "manual_review"
    notes: str | None = None


class JobBoardUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    query: str | None = None
    location: str | None = None
    remote_only: bool | None = None
    min_fit_score: float | None = None
    score_results: bool | None = None
    max_scored_jobs: int | None = None
    auto_apply_enabled: bool | None = None
    apply_mode: str | None = None
    notes: str | None = None


class JobBoardResponse(BaseModel):
    id: int
    name: str
    domain: str
    query: str
    location: str | None = None
    remote_only: bool
    min_fit_score: float | None = None
    score_results: bool
    max_scored_jobs: int
    auto_apply_enabled: bool
    apply_mode: str
    notes: str | None = None
    last_run_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class JobBoardRunResponse(BaseModel):
    board: JobBoardResponse
    total_found: int
    fit_matched: int
    apply_ready: int
    matched_jobs: list[JobResponse]
