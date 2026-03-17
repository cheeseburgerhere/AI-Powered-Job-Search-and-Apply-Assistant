from urllib.parse import urlparse

from app.models.cover_letter import CoverLetter
from app.models.job import Job
from app.models.profile import Profile


CANONICAL_REQUIRED_FIELDS = [
    "full_name",
    "email",
    "phone",
    "location",
    "work_authorization",
    "sponsorship_required",
    "resume",
    "cover_letter",
]


def _detect_adapter(job: Job) -> tuple[str, float, list[str]]:
    reasons: list[str] = []
    host = ""
    try:
        host = (urlparse(job.url).hostname or "").lower() if job.url else ""
    except Exception:
        host = ""

    source = (job.source or "").lower()

    if "greenhouse" in host or host.endswith("boards.greenhouse.io") or source == "greenhouse":
        reasons.append("Matched Greenhouse domain/source signal")
        return "greenhouse", 0.95, reasons

    if "lever.co" in host or host.startswith("jobs.lever.co") or source == "lever":
        reasons.append("Matched Lever domain/source signal")
        return "lever", 0.95, reasons

    if "ashbyhq.com" in host or host.startswith("jobs.ashbyhq.com") or source == "ashby":
        reasons.append("Matched Ashby domain/source signal")
        return "ashby", 0.95, reasons

    if source in {"jsearch", "adzuna", "manual"} and job.url:
        reasons.append("Known source but unknown ATS pattern")
        return "generic", 0.55, reasons

    reasons.append("No reliable ATS signal found")
    return "generic", 0.35, reasons


def _mode_recommendation(adapter_type: str, confidence: float, has_url: bool) -> str:
    if not has_url:
        return "manual_only"
    if adapter_type == "generic" and confidence < 0.7:
        return "manual_only"
    return "assisted"


def _missing_fields(profile: Profile | None, cover_letter: CoverLetter | None, has_url: bool) -> list[str]:
    missing: list[str] = []

    if not profile or not (profile.full_name or "").strip():
        missing.append("full_name")
    if not profile or not (profile.email or "").strip():
        missing.append("email")
    if not profile or not (profile.phone or "").strip():
        missing.append("phone")
    if not profile or not (profile.location or "").strip():
        missing.append("location")

    prefs = (profile.preferences or {}) if profile else {}
    if prefs.get("work_authorization") in (None, ""):
        missing.append("work_authorization")
    if prefs.get("sponsorship_required") in (None, ""):
        missing.append("sponsorship_required")

    has_resume = bool(profile and ((profile.resume_file_path or "").strip() or (profile.raw_resume_text or "").strip()))
    if not has_resume:
        missing.append("resume")

    if not cover_letter or not (cover_letter.content or "").strip():
        missing.append("cover_letter")

    if not has_url:
        missing.append("apply_url")

    return missing


def build_apply_plan(job: Job, profile: Profile | None, cover_letter: CoverLetter | None) -> dict:
    adapter_type, confidence, reasons = _detect_adapter(job)
    has_url = bool((job.url or "").strip())
    mode = _mode_recommendation(adapter_type, confidence, has_url)
    missing = _missing_fields(profile, cover_letter, has_url)

    prefs = (profile.preferences or {}) if profile else {}

    return {
        "job_id": job.id,
        "adapter_type": adapter_type,
        "mode_recommendation": mode,
        "confidence_score": round(confidence, 2),
        "required_fields": CANONICAL_REQUIRED_FIELDS,
        "missing_fields": missing,
        "detection_reasons": reasons,
        "prefill_payload": {
            "identity": {
                "full_name": (profile.full_name if profile else "") or "",
                "email": (profile.email if profile else "") or "",
                "phone": (profile.phone if profile else "") or "",
                "location": (profile.location if profile else "") or "",
            },
            "eligibility": {
                "work_authorization": prefs.get("work_authorization"),
                "sponsorship_required": prefs.get("sponsorship_required"),
            },
            "materials": {
                "resume_file_path": (profile.resume_file_path if profile else None),
                "resume_text": (profile.raw_resume_text if profile else "") or "",
                "cover_letter": (cover_letter.content if cover_letter else "") or "",
            },
            "custom_questions": [],
        },
    }
