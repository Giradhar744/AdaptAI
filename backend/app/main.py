from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.reference import router as reference_router
from app.api.v1.courses import router as courses_router
from app.api.v1.content_gen import router as content_gen_router
from app.api.v1.diagnostic import router as diagnostic_router
from app.api.v1.practice import router as practice_router
from app.api.v1.struggle import router as struggle_router
from app.api.v1.consent import router as consent_router
from app.api.v1.tests import router as tests_router
from app.api.v1.analytics import router as analytics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting AdaptAI backend in {settings.ENVIRONMENT} mode")
    try:
        from app.db.session import AsyncSessionLocal
        from app.db.seed_loader import load_seed_data
        import app.db.models  # ensure models are loaded

        async with AsyncSessionLocal() as session:
            await load_seed_data(session)
        logger.info("Database connection and reference seeds verified.")
    except Exception as e:
        logger.warning(f"Database startup check skipped or deferred: {e}")

    yield
    logger.info("Shutting down AdaptAI backend")


def create_app() -> FastAPI:
    app = FastAPI(
        title="AdaptAI API",
        description="AI-Powered Educational Platform for Specially-Abled Students",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routers
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(reference_router, prefix="/api/v1")
    app.include_router(courses_router, prefix="/api/v1")
    app.include_router(content_gen_router, prefix="/api/v1")
    app.include_router(diagnostic_router, prefix="/api/v1")
    app.include_router(practice_router, prefix="/api/v1")
    app.include_router(struggle_router, prefix="/api/v1")
    app.include_router(consent_router, prefix="/api/v1")
    app.include_router(tests_router, prefix="/api/v1")
    app.include_router(analytics_router, prefix="/api/v1")

    return app


app = create_app()
