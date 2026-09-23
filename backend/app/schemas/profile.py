from pydantic import BaseModel, computed_field
from typing import Optional
from datetime import datetime


class Experience(BaseModel):
    company: str = ""
    title: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: list[str] = []


class Education(BaseModel):
    school: str = ""
    degree: str = ""
    field: str = ""
    start_date: str = ""
    end_date: str = ""


class Certification(BaseModel):
    name: str = ""
    issuer: str = ""
    date: str = ""


class Preferences(BaseModel):
    roles: list[str] = []
    locations: list[str] = []
    remote: bool = True
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    industries: list[str] = []


class ProfileBase(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    summary: str = ""
    skills: list[str] = []
    experiences: list[Experience] = []
    education: list[Education] = []
    certifications: list[Certification] = []
    preferences: Preferences = Preferences()


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[list[str]] = None
    experiences: Optional[list[Experience]] = None
    education: Optional[list[Education]] = None
    certifications: Optional[list[Certification]] = None


class PreferencesUpdate(BaseModel):
    roles: Optional[list[str]] = None
    locations: Optional[list[str]] = None
    remote: Optional[bool] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    industries: Optional[list[str]] = None


class WritingSampleInput(BaseModel):
    text: str


class ProfileResponse(ProfileBase):
    id: int
    raw_resume_text: str = ""
    resume_file_path: Optional[str] = None
    writing_samples: list[str] = []
    voice_profile: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def needs_parsing(self) -> bool:
        """Resume text is stored but nobody has structured it into a profile yet."""
        return bool((self.raw_resume_text or "").strip()) and not (self.full_name or "").strip()
