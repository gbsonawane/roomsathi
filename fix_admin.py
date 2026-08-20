import asyncio
from sqlalchemy import select, update
from backend.db.database import AsyncSessionLocal
from backend.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        # Find user with phone +918600924307 or 8600924307
        result = await db.execute(
            select(User).where(User.phone.in_(["+918600924307", "8600924307"]))
        )
        target_user = result.scalar_one_or_none()
        
        if target_user:
            target_user.role = "admin"
            print(f"Set role 'admin' for user: {target_user.full_name} ({target_user.phone})")
        else:
            print("Target user not found.")

        # Find users with role admin and phone NULL
        result = await db.execute(
            select(User).where(User.role == "admin").where(User.phone == None)
        )
        null_phone_admins = result.scalars().all()
        
        for admin in null_phone_admins:
            if admin != target_user:
                admin.role = "seeker"
                print(f"Demoted admin with NULL phone to seeker: {admin.full_name} ({admin.email})")

        await db.commit()

        # Print final state
        result = await db.execute(
            select(User).where(User.role == "admin")
        )
        final_admins = result.scalars().all()
        
        print("\nFinal Admins:")
        for admin in final_admins:
            print(f"- {admin.full_name}, Phone: {admin.phone}, Email: {admin.email}, Role: {admin.role}")

if __name__ == "__main__":
    asyncio.run(main())
