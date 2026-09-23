from fastapi import APIRouter
from pydantic import BaseModel

from app.services.capabilities import get_capabilities

router = APIRouter(prefix="/api/meta", tags=["meta"])


class CapabilitiesResponse(BaseModel):
    server_ai: bool
    ai_provider: str
    search_sources: list[str]


@router.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities():
    return get_capabilities()
