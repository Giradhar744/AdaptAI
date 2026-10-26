from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, description="Password must be at least 6 characters")
    role: Literal["teacher", "student", "parent"]
    display_name: str = Field(min_length=1, max_length=100)
    age: Optional[int] = Field(default=None, ge=5, le=100, description="Age required for student registration")
    disability_type_code: Optional[str] = Field(default=None, description="Declared disability type (asd, adhd, dyslexia, other_idd)")
    parent_user_id: Optional[str] = Field(default=None, description="Optional parent ID if student registered under parent")


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    display_name: str
    user: Optional["UserProfileResponse"] = None


class DisabilityInfo(BaseModel):
    code: str
    label: str


class UserProfileResponse(BaseModel):
    id: str
    email: str
    role: str
    display_name: str
    is_active: bool
    student_id: Optional[str] = None
    teacher_id: Optional[str] = None
    age: Optional[int] = None
    age_band: Optional[str] = None
    disabilities: List[DisabilityInfo] = Field(default_factory=list)


TokenResponse.model_rebuild()
