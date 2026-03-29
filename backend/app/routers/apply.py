from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cover_letter import CoverLetter
from app.models.job import Job
from app.models.profile import Profile
from app.schemas.apply import (
    ApplyPlanResponse,
    ApplyFromLinkRequest,
    ApplyFromLinkResponse,
    JobDetailsFromLink,
    ScrapeDebugResponse,
    ApplyGenerateCoverLetterRequest,
    ApplyRefineCoverLetterRequest,
    ApplyCoverLetterPdfRequest,
    CompanyContextRequest,
    CompanyContextResponse,
    ApplyChatRequest,
    ApplyChatResponse,
)
from app.services.apply_planner import build_apply_plan
from app.services.ai_service import get_ai_service
from app.services.link_scraper import scrape_job_from_url
from app.services.company_info import fetch_company_info
from app.services.resume_parser import profile_to_text
from app.services.pdf_generator import generate_text_pdf
from app.routers.profile import _build_content_disposition

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


@router.post("/scrape/debug", response_model=ScrapeDebugResponse)
async def scrape_debug(request: ApplyFromLinkRequest):
    """
    Debug endpoint showing the full scrape result including raw text,
    extraction method, confidence, and Brave results.
    """
    try:
        job_details = await scrape_job_from_url(request.url, "")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to scrape job posting: {str(exc)}")

    # Fetch company information
    company_info = ""
    try:
        company_info = fetch_company_info(job_details["company"])
    except Exception:
        pass

    return ScrapeDebugResponse(
        url=request.url,
        title=job_details["title"],
        company=job_details["company"],
        description=job_details["description"],
        location=job_details.get("location", ""),
        salary=job_details.get("salary", ""),
        employment_type=job_details.get("employment_type", ""),
        company_info=company_info,
        extraction_method=job_details.get("extraction_method", ""),
        confidence=job_details.get("confidence", 0.0),
        raw_text=job_details.get("raw_text", ""),
        brave_result=job_details.get("brave_result", {}),
        html_length=job_details.get("html_length", 0),
        scraper_used=job_details.get("extraction_method", ""),
    )


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
        company_website="",
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


@router.post("/generate-cover-letter", response_model=ApplyFromLinkResponse)
async def generate_cover_letter_from_details(request: ApplyGenerateCoverLetterRequest, db: Session = Depends(get_db)):
    """
    Generate a cover letter directly from existing job details without rescraping.
    """
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile not set up. Complete onboarding first.")

    # Convert profile to text
    profile_text = profile_to_text(profile)

    # Generate cover letter
    try:
        company_context = request.job.company_info or ""
        if request.job.company_website:
            website_info = fetch_company_info(request.job.company, request.job.company_website)
            if website_info:
                company_context = f"{company_context}\n\n{website_info}".strip() if company_context else website_info

        ai_service = get_ai_service()
        cover_letter = ai_service.generate_cover_letter(
            profile_text=profile_text,
            voice_profile=profile.voice_profile or "",
            jd_text=request.job.description,
            company=request.job.company,
            title=request.job.title,
            company_website=request.job.company_website,
            company_context=company_context,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate cover letter: {str(exc)}")

    return ApplyFromLinkResponse(
        job=request.job,
        cover_letter=cover_letter,
        company_info=request.job.company_info,
    )


@router.post("/company-context", response_model=CompanyContextResponse)
def fetch_company_context(request: CompanyContextRequest):
    if not request.company.strip() or not request.company_website.strip():
        raise HTTPException(status_code=400, detail="Both company and company_website are required")

    try:
        context_summary = fetch_company_info(request.company.strip(), request.company_website.strip())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch company website context: {str(exc)}")

    return CompanyContextResponse(
        company=request.company.strip(),
        company_website=request.company_website.strip(),
        context_summary=context_summary or "",
    )


@router.post("/refine-cover-letter")
def refine_cover_letter_text(request: ApplyRefineCoverLetterRequest):
    """
    Refine a cover letter text based on user feedback (without needing a saved DB record).
    """
    if not request.cover_letter or not request.feedback:
        raise HTTPException(status_code=400, detail="Both cover_letter and feedback are required")

    try:
        ai_service = get_ai_service()
        refined_content = ai_service.refine_cover_letter(request.cover_letter, request.feedback)
        return {"cover_letter": refined_content}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to refine cover letter: {str(exc)}")


@router.post("/cover-letter/pdf")
def download_cover_letter_pdf(request: ApplyCoverLetterPdfRequest, db: Session = Depends(get_db)):
    if not request.cover_letter.strip():
        raise HTTPException(status_code=400, detail="Cover letter cannot be empty")

    profile = db.query(Profile).first()
    author = (profile.full_name or "AI Job Assistant").strip() if profile else "AI Job Assistant"
    filename = "cover_letter.pdf"
    pdf_buffer = generate_text_pdf(
        request.cover_letter,
        filename=filename,
        author=author,
        title="Cover Letter",
    )
    headers = {"Content-Disposition": _build_content_disposition(filename)}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)


@router.post("/chat", response_model=ApplyChatResponse)
def apply_chat(request: ApplyChatRequest, db: Session = Depends(get_db)):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile not set up. Complete onboarding first.")

    job = request.job
    if not job:
        raise HTTPException(status_code=400, detail="Job details are required")

    profile_text = profile_to_text(profile)
    cover_letter = (request.cover_letter or "").strip()

    ai_service = get_ai_service()
    try:
        answer = ai_service.answer_apply_question(
            profile_text=profile_text,
            job_title=job.title,
            job_company=job.company,
            job_description=job.description,
            cover_letter=cover_letter,
            question=request.question,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(exc)}")

    return ApplyChatResponse(answer=answer)
