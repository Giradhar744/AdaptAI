from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from typing import AsyncGenerator, Tuple, Dict, Any
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings


def get_normalized_database_url_and_args(raw_url: str) -> Tuple[str, Dict[str, Any]]:
    """Normalizes cloud PostgreSQL URLs (e.g. Render, Supabase, Neon, Railway, AWS RDS)
    to support asyncpg and SSL correctly.
    """
    url = raw_url.strip()

    # Normalize scheme: asyncpg requires postgresql+asyncpg://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    connect_args: Dict[str, Any] = {}

    # For remote/cloud databases (Supabase, Render, Neon, etc.), enforce SSL
    if "sslmode" in url:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        ssl_mode = query_params.pop("sslmode", ["require"])[0]
        if ssl_mode in ("require", "verify-ca", "verify-full"):
            connect_args["ssl"] = "require"
        new_query = urlencode(query_params, doseq=True)
        url = urlunparse(parsed._replace(query=new_query))
    elif "localhost" not in url and "127.0.0.1" not in url and not url.startswith("sqlite"):
        connect_args["ssl"] = "require"

    return url, connect_args


db_url, connect_args = get_normalized_database_url_and_args(settings.DATABASE_URL)

# Create asynchronous engine with connection pooling for cloud resiliency
engine_kwargs: Dict[str, Any] = {
    "connect_args": connect_args,
    "echo": False,
    "future": True,
}

if "sqlite" not in db_url:
    engine_kwargs.update({
        "pool_size": 15,
        "max_overflow": 25,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "pool_pre_ping": False,
    })

engine = create_async_engine(db_url, **engine_kwargs)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

