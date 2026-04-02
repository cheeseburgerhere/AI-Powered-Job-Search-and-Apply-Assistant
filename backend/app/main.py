import argparse
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_tables
from app.routers import profile, jobs, cover_letters, tracker, job_boards, apply
from app.config import get_settings

app = FastAPI(title="AI Job Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:*",      # Any localhost port (Electron)
        "file://",                 # Electron file:// protocol
        "*",                       # Fallback for desktop packaging
    ],
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


# ---------------------------------------------------------------------------
# CLI entry-point (used by PyInstaller / Electron)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser(description="AI Job Assistant Backend")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port)

