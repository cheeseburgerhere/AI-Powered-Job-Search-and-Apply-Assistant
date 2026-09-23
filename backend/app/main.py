from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_tables
from app.routers import profile, jobs, cover_letters, tracker, job_boards, apply, meta
from app.config import get_settings

app = FastAPI(title="AI Job Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(jobs.router)
app.include_router(job_boards.router)
app.include_router(cover_letters.router)
app.include_router(tracker.router)
app.include_router(apply.router)
app.include_router(meta.router)


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/api/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "ai_provider": (settings.ai_provider or "anthropic").lower(),
    }
