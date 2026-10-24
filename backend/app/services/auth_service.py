from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password, create_access_token
from app.db.models.identity import User, Teacher, Student, DisabilityProfile
from app.db.models.reference import AgeBand, DisabilityType
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, TokenResponse, UserProfileResponse, DisabilityInfo


class AuthService:

    @staticmethod
    async def register(session: AsyncSession, req: UserRegisterRequest) -> TokenResponse:
        # Check if email is already registered
        existing = await session.execute(select(User).where(User.email == req.email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

        hashed_pw = hash_password(req.password)
        user = User(email=req.email, password_hash=hashed_pw, role=req.role)
        session.add(user)
        await session.flush()

        display_name = req.display_name

        if req.role == "teacher":
            teacher = Teacher(user_id=user.id, display_name=display_name)
            session.add(teacher)

        elif req.role == "student":
            if req.age is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Age is required for student registration.",
                )

            # Resolve AgeBand based on placement_min_age and placement_max_age
            # Note: Age 15 is routed to 11-15 (PROJECT.md §15.2)
            ab_stmt = select(AgeBand).where(
                and_(
                    AgeBand.placement_min_age <= req.age,
                    AgeBand.placement_max_age >= req.age,
                )
            )
            ab_res = await session.execute(ab_stmt)
            age_band = ab_res.scalar_one_or_none()

            student = Student(
                user_id=user.id,
                parent_user_id=req.parent_user_id,
                display_name=display_name,
                age=req.age,
                age_band_id=age_band.id if age_band else None,
            )
            session.add(student)
            await session.flush()

            # Record declared disability type if specified
            if req.disability_type_code:
                dt_stmt = select(DisabilityType).where(DisabilityType.code == req.disability_type_code)
                dt_res = await session.execute(dt_stmt)
                disability_type = dt_res.scalar_one_or_none()
                if disability_type:
                    profile = DisabilityProfile(
                        student_id=student.id,
                        disability_type_id=disability_type.id,
                    )
                    session.add(profile)

        await session.commit()

        token = create_access_token(subject=user.id, role=user.role)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role=user.role,
            user_id=user.id,
            display_name=display_name,
        )

    @staticmethod
    async def login(session: AsyncSession, req: UserLoginRequest) -> TokenResponse:
        stmt = (
            select(User)
            .where(User.email == req.email)
            .options(
                selectinload(User.teacher_profile),
                selectinload(User.student_profile),
            )
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive.",
            )

        display_name = user.email.split("@")[0]
        if user.teacher_profile:
            display_name = user.teacher_profile.display_name
        elif user.student_profile:
            display_name = user.student_profile.display_name

        token = create_access_token(subject=user.id, role=user.role)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role=user.role,
            user_id=user.id,
            display_name=display_name,
        )

    @staticmethod
    async def get_user_profile(session: AsyncSession, user_id: str) -> UserProfileResponse:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.teacher_profile),
                selectinload(User.student_profile)
                .selectinload(Student.age_band),
                selectinload(User.student_profile)
                .selectinload(Student.disabilities)
                .selectinload(DisabilityProfile.disability_type),
            )
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        display_name = user.email
        teacher_id: Optional[str] = None
        student_id: Optional[str] = None
        age: Optional[int] = None
        age_band_label: Optional[str] = None
        disabilities: list[DisabilityInfo] = []

        if user.teacher_profile:
            display_name = user.teacher_profile.display_name
            teacher_id = user.teacher_profile.id
        elif user.student_profile:
            sp = user.student_profile
            display_name = sp.display_name
            student_id = sp.id
            age = sp.age
            if sp.age_band:
                age_band_label = sp.age_band.label
            for d in sp.disabilities:
                if d.disability_type:
                    disabilities.append(DisabilityInfo(code=d.disability_type.code, label=d.disability_type.label))

        return UserProfileResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            display_name=display_name,
            is_active=user.is_active,
            teacher_id=teacher_id,
            student_id=student_id,
            age=age,
            age_band=age_band_label,
            disabilities=disabilities,
        )
