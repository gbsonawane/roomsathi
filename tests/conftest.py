"""
Shared test configuration and fixtures for RoomSathi backend tests.

Uses an async in-memory SQLite database to avoid needing PostgreSQL.
PostgreSQL-specific types (UUID, ARRAY, JSONB, Numeric) are shimmed via
SQLAlchemy's generic fallbacks where possible, or models are recreated in
a test-friendly way using dependency_overrides.
"""
import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta, date
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import event
from sqlalchemy.pool import StaticPool

from httpx import AsyncClient, ASGITransport

from backend.main import app
from backend.db.dependencies import get_db, get_current_user, get_current_user_optional
from backend.core.security import create_access_token
from backend.core.config import settings

# Tests expect console OTP (dev_otp); never hit real SMTP from local .env
settings.EMAIL_PROVIDER = "dev"

# ── In-memory SQLite engine (no PostgreSQL needed) ─────────────────────────
# We use aiosqlite and render_as_batch to handle all migrations in-memory.
SQLITE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# ── Patch PostgreSQL-specific SQLAlchemy types before importing models ──────
# Monkey-patch dialect-specific types to work with SQLite
import sqlalchemy.dialects.postgresql as pg_dialect


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create fresh tables and yield a test async session."""
    # Import metadata after model monkeypatching
    from backend.db.database import Base

    # Import all models so they register on Base.metadata
    import backend.models  # noqa: F401

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    # Tear down
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def test_client(db_session):
    """Return an AsyncClient with the test DB session overriding real DB."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test/") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_optional, None)


# ── User helpers ────────────────────────────────────────────────────────────

def _make_user(role="seeker", phone=None, email=None, plan_type="free", plan_expires_at=None):
    from backend.models.user import User
    uid = uuid.uuid4()
    return User(
        id=uid,
        full_name=f"Test {role.capitalize()}",
        phone=phone or f"91{str(uid.int)[:10]}",
        email=email,
        role=role,
        plan_type=plan_type,
        plan_expires_at=plan_expires_at,
    )


def _token_for(user):
    return create_access_token({"sub": str(user.id), "role": user.role})


def _headers_for(user):
    return {"Authorization": f"Bearer {_token_for(user)}"}


@pytest_asyncio.fixture
async def test_user(db_session):
    user = _make_user(role="seeker")
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def test_owner(db_session):
    user = _make_user(role="owner", phone="9100000001")
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def test_admin(db_session):
    user = _make_user(role="admin", phone="9100000002")
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
def user_headers(test_user):
    return _headers_for(test_user)


@pytest.fixture
def owner_headers(test_owner):
    return _headers_for(test_owner)


@pytest.fixture
def admin_headers(test_admin):
    return _headers_for(test_admin)


# ── Listing helper ──────────────────────────────────────────────────────────

def _make_listing(owner_id, city="Pune", area="Baner", rent=12000, status="approved",
                  property_type="1bhk", gender_preference="any", furnishing="semi",
                  latitude=None, longitude=None, is_boosted=False):
    from backend.models.listing import Listing
    return Listing(
        id=uuid.uuid4(),
        owner_id=owner_id,
        listing_type="room_available",
        title=f"{property_type} in {area}",
        property_type=property_type,
        gender_preference=gender_preference,
        furnishing=furnishing,
        parking="none",
        city=city,
        area=area,
        rent=rent,
        deposit=rent * 2,
        available_from=date(2026, 9, 1),
        listing_plan="basic",
        status=status,
        is_active=True,
        is_boosted=is_boosted,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        latitude=latitude,
        longitude=longitude,
        photos=[],
    )


@pytest_asyncio.fixture
async def test_listing(db_session, test_owner):
    listing = _make_listing(owner_id=test_owner.id)
    db_session.add(listing)
    await db_session.flush()
    return listing


# ── Re-export helpers for test files ────────────────────────────────────────
__all__ = [
    "db_session", "test_client", "test_user", "test_owner", "test_admin",
    "user_headers", "owner_headers", "admin_headers", "test_listing",
    "_make_user", "_make_listing", "_token_for", "_headers_for",
]
