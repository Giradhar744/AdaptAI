from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfileResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    req: UserRegisterRequest,
    session: AsyncSession = Depends(get_db),
):
    """Registers a new Teacher, Student, or Parent user and returns an access token."""
    return await AuthService.register(session, req)


@router.post("/login", response_model=TokenResponse)
async def login(
    req: UserLoginRequest,
    session: AsyncSession = Depends(get_db),
):
    """Authenticates a user by email/password and returns a JWT access token."""
    return await AuthService.login(session, req)


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves the authenticated user's profile and active roles/associations."""
    return await AuthService.get_user_profile(session, current_user.id)
