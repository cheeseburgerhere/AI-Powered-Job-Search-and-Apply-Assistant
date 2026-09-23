from sqlalchemy import Column, Integer, String, Float, Boolean, Text
from app.models.types import UTCDateTime
from sqlalchemy.sql import func

from app.database import Base


class JobBoard(Base):
    __tablename__ = "job_boards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    domain = Column(String, nullable=False, unique=True, index=True)
    query = Column(String, nullable=False)
    location = Column(String, nullable=True)
    remote_only = Column(Boolean, default=False)
    min_fit_score = Column(Float, nullable=True)
    score_results = Column(Boolean, default=True)
    max_scored_jobs = Column(Integer, default=8)
    auto_apply_enabled = Column(Boolean, default=False)
    apply_mode = Column(String, default="manual_review")
    notes = Column(Text, nullable=True)
    last_run_at = Column(UTCDateTime(), nullable=True)
    created_at = Column(UTCDateTime(), server_default=func.now())
    updated_at = Column(UTCDateTime(), server_default=func.now(), onupdate=func.now())
