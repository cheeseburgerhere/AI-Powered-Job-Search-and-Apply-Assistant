from pydantic import BaseModel
from typing import Any


class ApplyPlanResponse(BaseModel):
    job_id: int
    adapter_type: str
    mode_recommendation: str
    confidence_score: float
    required_fields: list[str]
    missing_fields: list[str]
    detection_reasons: list[str]
    prefill_payload: dict[str, Any]


class JobDetailsFromLink(BaseModel):
    title: str
    company: str
    description: str
    link: str
    company_info: str = ""


class ApplyFromLinkRequest(BaseModel):
    url: str


class ApplyFromLinkResponse(BaseModel):
    job: JobDetailsFromLink
    cover_letter: str
    company_info: str
