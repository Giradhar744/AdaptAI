from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Server & Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # Database (PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/adaptai"
    DATABASE_SYNC_URL: str = "postgresql://postgres:postgres@localhost:5432/adaptai"

    # Security & Auth
    JWT_SECRET: str = "insecure-dev-secret-change-in-production-min32chars"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # Provider Seams (PROJECT.md §7)
    LLM_PROVIDER: str = "fake"
    LLM_API_KEY: str = "fake-dev-key"
    LLM_MODEL: str = "fake-default"
    LLM_MAX_RETRIES: int = 2
    LLM_TIMEOUT_SECONDS: int = 30

    TTS_PROVIDER: str = "fake"
    STT_PROVIDER: str = "fake"
    VIDEO_PROVIDER: str = "fake"
    LOCAL_UPLOAD_DIR: str = "./uploads"

    # Pedagogical & Priority Engine Parameters (PROJECT.md §9, §11, §13)
    CONSENT_COOLDOWN_MINUTES: int = 30
    RATING_MIN_ATTEMPTS: int = 5
    DPP_DEFAULT_QUESTIONS: int = 5
    TEST_DEFAULT_QUESTIONS: int = 10
    TEST_DEFAULT_MINUTES: int = 20
    STRUGGLE_WINDOW_QUESTIONS: int = 4

    # Agent Feature Flags (PROJECT.md §10.1, §16)
    AGENT_DIAGNOSTIC_ENABLED: bool = True
    AGENT_ZPD_HINT_ENABLED: bool = True
    AGENT_CONTENT_GEN_ENABLED: bool = True
    AGENT_STRUGGLE_ENABLED: bool = True
    AGENT_CONSENT_ENABLED: bool = True
    AGENT_TEACHER_COPILOT_ENABLED: bool = True


settings = Settings()
