#!/usr/bin/env python3
"""
seed_superadmins.py — Create the first superadmin account(s).

There's no signup UI for admin accounts on purpose — the very first
superadmin(s) have to be created directly against the database. After
that, superadmins can create workers (and, if you add it, additional
superadmins) through the /admin/workers API instead of this script.

Usage (from Railway shell or locally with DATABASE_URL set):
    python seed_superadmins.py

You'll be prompted for a name, email, and password for each superadmin.
Press Enter on an empty name to stop adding more.
"""
import asyncio
import getpass
import sys

from app.db.session import AsyncSessionLocal
from app.services.admin_user_service import AdminUserService


async def seed():
    async with AsyncSessionLocal() as db:
        service = AdminUserService(db)
        try:
            while True:
                name = input("Superadmin name (Enter to stop): ").strip()
                if not name:
                    break
                email = input("Email: ").strip()
                if not email:
                    print("Email is required — skipping.")
                    continue

                existing = await service.get_by_email(email)
                if existing:
                    print(f"  ⚠️  An admin account already exists for {email} — skipping.")
                    continue

                password = getpass.getpass("Password (min 8 chars): ")
                if len(password) < 8:
                    print("  ⚠️  Password too short — skipping.")
                    continue

                admin = await service.create_superadmin(name, email, password)
                await db.flush()
                print(f"  ✅ Superadmin created — id={admin.id} email={email}")

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    print("\nDone.")


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(0)
