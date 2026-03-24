from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cover_letter import CoverLetter
from app.models.job import Job
from app.models.profile import Profile
from app.schemas.apply import ApplyPlanResponse, ApplyFromLinkRequest, ApplyFromLinkResponse, JobDetailsFromLink
from app.services.apply_planner import build_apply_plan
from app.services.ai_service import get_ai_service
from app.services.link_scraper import scrape_job_from_url
from app.services.company_info import fetch_company_info
from app.services.resume_parser import profile_to_text

router = APIRouter(prefix="/api/apply", tags=["apply"])


@router.post("/plan/{job_id}", response_model=ApplyPlanResponse)
def generate_apply_plan(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    profile = db.query(Profile).first()
    cover_letter = (
        db.query(CoverLetter)
        .filter(CoverLetter.job_id == job.id)
        .order_by(CoverLetter.updated_at.desc())
        .first()
    )

    return build_apply_plan(job=job, profile=profile, cover_letter=cover_letter)


@router.post("/scrape", response_model=JobDetailsFromLink)
async def scrape_job_details(request: ApplyFromLinkRequest):
    """
    Scrape and extract job details from a URL (without generating cover letter).
    Also fetches company information.
    """
    # Scrape job details from URL
    try:
        job_details = await scrape_job_from_url(request.url, "")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to scrape job posting: {str(exc)}")

    # Fetch company information
    try:
        company_info = fetch_company_info(job_details["company"])
        job_details["company_info"] = company_info
    except Exception:
        # Company info is optional, don't fail if it errors
        pass

    return JobDetailsFromLink(
        title=job_details["title"],
        company=job_details["company"],
        description=job_details["description"],
        link=job_details["link"],
        company_info=job_details.get("company_info", ""),
    )


@router.post("/from-link", response_model=ApplyFromLinkResponse)
async def generate_cover_letter_from_link(request: ApplyFromLinkRequest, db: Session = Depends(get_db)):
    """
    Process a job posting URL:
    1. Scrape job details from the page
    2. Fetch company information
    3. Generate a cover letter
    """
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile not set up. Complete onboarding first.")

    # Convert profile to text
    profile_text = profile_to_text(profile)

    # Scrape job details from URL
    try:
        job_details = await scrape_job_from_url(request.url, profile_text)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to scrape job posting: {str(exc)}")

    # Fetch company information
    try:
        company_info = fetch_company_info(job_details["company"])
        job_details["company_info"] = company_info
    except Exception:
        # Company info is optional, don't fail if it errors
        pass

    # Generate cover letter
    try:
        ai_service = get_ai_service()
        cover_letter = ai_service.generate_cover_letter(
            profile_text=profile_text,
            voice_profile=profile.voice_profile or "",
            jd_text=job_details["description"],
            company=job_details["company"],
            title=job_details["title"],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate cover letter: {str(exc)}")

    return ApplyFromLinkResponse(
        job={
            "title": job_details["title"],
            "company": job_details["company"],
            "description": job_details["description"],
            "link": job_details["link"],
            "company_info": job_details.get("company_info", ""),
        },
        cover_letter=cover_letter,
        company_info=job_details.get("company_info", ""),
    )
