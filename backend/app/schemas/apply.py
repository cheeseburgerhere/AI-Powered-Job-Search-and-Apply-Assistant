from pydantic import BaseModel
from typing import Any, Optional


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
    company_website: str = ""


class ApplyFromLinkRequest(BaseModel):
    url: str


class ApplyFromLinkResponse(BaseModel):
    job: JobDetailsFromLink
    cover_letter: str
    company_info: str


class ApplyGenerateCoverLetterRequest(BaseModel):
    job: JobDetailsFromLink


class ApplyRefineCoverLetterRequest(BaseModel):
    cover_letter: str
    feedback: str


class ApplyCoverLetterPdfRequest(BaseModel):
    cover_letter: str


class CompanyContextRequest(BaseModel):
    company: str
    company_website: str


class CompanyContextResponse(BaseModel):
    company: str
    company_website: str
    context_summary: str = ""


class ApplyChatRequest(BaseModel):
    question: str
    job: Optional[JobDetailsFromLink] = None
    cover_letter: Optional[str] = None


class ApplyChatResponse(BaseModel):
    answer: str


class ScrapeDebugResponse(BaseModel):
    url: str
    title: str
    company: str
    description: str
    location: str = ""
    salary: str = ""
    employment_type: str = ""
    company_info: str = ""
    extraction_method: str = ""
    confidence: float = 0.0
    raw_text: str = ""
    brave_result: dict = {}
    html_length: int = 0
    scraper_used: str = ""

