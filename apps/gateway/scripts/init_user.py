"""CLI para crear el usuario inicial de MAX Studio.

Uso (desde apps/gateway con venv activo):
    python scripts/init_user.py

Requiere `.env` con SUPABASE_URL y SUPABASE_SERVICE_KEY.
"""

from __future__ import annotations

import asyncio
import getpass
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.auth.password import hash_password  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.supabase import SupabaseError, get_supabase  # noqa: E402

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def create_user(email: str, password: str) -> dict:
    sb = get_supabase()
    existing = await sb.select_one("users", {"email": email}, columns="id")
    if existing:
        raise SystemExit(f"Ya existe un usuario con email {email} (id={existing['id']}).")

    password_hash = hash_password(password)
    created = await sb.insert("users", {"email": email, "password_hash": password_hash})
    row = created[0] if isinstance(created, list) and created else created
    return row


def prompt_email() -> str:
    email = input("Email: ").strip().lower()
    if not EMAIL_RE.match(email):
        raise SystemExit("Email inválido.")
    return email


def prompt_password() -> str:
    pwd = getpass.getpass("Password (min 8): ")
    if len(pwd) < 8:
        raise SystemExit("Password muy corta (min 8 caracteres).")
    confirm = getpass.getpass("Confirmar password: ")
    if pwd != confirm:
        raise SystemExit("Las passwords no coinciden.")
    return pwd


async def main() -> None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise SystemExit("Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en .env")

    print(f"→ Supabase: {settings.supabase_url}")
    email = prompt_email()
    password = prompt_password()

    try:
        user = await create_user(email, password)
    except SupabaseError as exc:
        raise SystemExit(f"Error creando usuario: {exc}") from exc

    print(f"\n✓ Usuario creado: {user.get('email')} (id={user.get('id')})")


if __name__ == "__main__":
    asyncio.run(main())
