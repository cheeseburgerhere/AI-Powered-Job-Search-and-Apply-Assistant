from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.job import JobResponse


class TrackerEventResponse(BaseModel):
    id: int
    job_id: int
    from_status: str
    to_status: str
    note: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TrackerBoardResponse(BaseModel):
    interested: list = []
    applied: list = []
    follow_up: list = []
    interview: list = []
    offer: list = []
    rejected: list = []


class TrackerStatsResponse(BaseModel):
    total: int = 0
    interested: int = 0
    applied: int = 0
    follow_up: int = 0
    interview: int = 0
    offer: int = 0
    rejected: int = 0


class TrackerRejectedBinResponse(BaseModel):
    key: str
    label: str
    count: int = 0
    jobs: list[JobResponse] = []
