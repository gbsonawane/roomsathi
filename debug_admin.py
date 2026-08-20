"""Debug script to diagnose admin login failure."""
import asyncio
import sys
import os

# Check settings load
from backend.core.config import settings

print("=== Settings Check ===")
print(f"ADMIN_SECRET_PASSWORD repr: {repr(settings.ADMIN_SECRET_PASSWORD)}")
print(f"ADMIN_SECRET_PASSWORD len: {len(settings.ADMIN_SECRET_PASSWORD)}")
print(f"ENVIRONMENT: {settings.ENVIRONMENT}")
print()

# Check database user
from sqlalchemy import select, or_
from backend.db.database import AsyncSessionLocal
from backend.models.user import User

async def check_user():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                or_(User.phone.in_(["+918600924307", "8600924307"]), User.role == "admin")
            )
        )
        users = result.scalars().all()
        print("=== Relevant Users in DB ===")
        for u in users:
            print(f"  id={u.id}, name={u.full_name}, phone={repr(u.phone)}, email={repr(u.email)}, role={u.role}")
        print()

asyncio.run(check_user())

# Test password match
test_password = "Admin@123"
print("=== Password Match Test ===")
print(f"Input password repr: {repr(test_password)}")
print(f"Stored password repr: {repr(settings.ADMIN_SECRET_PASSWORD)}")
print(f"Match: {test_password == settings.ADMIN_SECRET_PASSWORD}")
