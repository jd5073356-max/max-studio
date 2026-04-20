"""Cliente Supabase vía REST (PostgREST).

Evitamos `supabase-py` porque su dep `pyiceberg` no tiene wheels para Python 3.14.
Usamos httpx contra la API REST directa — cubre el 95% de los casos de uso.
"""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings


class SupabaseError(Exception):
    """Error al hablar con Supabase."""


class SupabaseRest:
    """Wrapper mínimo sobre la REST API de Supabase.

    Uso:
        sb = SupabaseRest()
        user = await sb.select_one("users", {"email": "me@x.com"})
        await sb.insert("users", {"email": "new@x.com", "password_hash": "..."})
    """

    def __init__(self, url: str | None = None, key: str | None = None) -> None:
        settings = get_settings()
        self._url = (url or settings.supabase_url).rstrip("/")
        self._key = key or settings.supabase_service_key
        if not self._url or not self._key:
            raise SupabaseError(
                "SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos. "
                "Copiar .env.example → .env y rellenar."
            )

    def _headers(self, prefer: str | None = None) -> dict[str, str]:
        h = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }
        if prefer:
            h["Prefer"] = prefer
        return h

    def _table_url(self, table: str) -> str:
        return f"{self._url}/rest/v1/{table}"

    @staticmethod
    def _filters_to_params(filters: dict[str, Any]) -> dict[str, str]:
        return {k: f"eq.{v}" for k, v in filters.items()}

    async def select_one(
        self, table: str, filters: dict[str, Any], *, columns: str = "*"
    ) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._table_url(table),
                params={**self._filters_to_params(filters), "select": columns, "limit": "1"},
                headers=self._headers(),
            )
        if resp.status_code != 200:
            raise SupabaseError(f"select_one {table} failed: {resp.status_code} {resp.text}")
        rows = resp.json()
        return rows[0] if rows else None

    async def select_many(
        self,
        table: str,
        filters: dict[str, Any] | None = None,
        *,
        columns: str = "*",
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {"select": columns}
        if filters:
            params.update(self._filters_to_params(filters))
        if order:
            params["order"] = order
        if limit:
            params["limit"] = str(limit)

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._table_url(table), params=params, headers=self._headers()
            )
        if resp.status_code != 200:
            raise SupabaseError(f"select_many {table} failed: {resp.status_code} {resp.text}")
        return resp.json()

    async def insert(
        self, table: str, row: dict[str, Any], *, returning: bool = True
    ) -> dict[str, Any] | None:
        prefer = "return=representation" if returning else "return=minimal"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._table_url(table),
                json=row,
                headers=self._headers(prefer=prefer),
            )
        if resp.status_code not in (200, 201):
            raise SupabaseError(f"insert {table} failed: {resp.status_code} {resp.text}")
        if not returning:
            return None
        rows = resp.json()
        return rows[0] if rows else None

    async def update(
        self, table: str, filters: dict[str, Any], patch: dict[str, Any]
    ) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                self._table_url(table),
                params=self._filters_to_params(filters),
                json=patch,
                headers=self._headers(prefer="return=representation"),
            )
        if resp.status_code not in (200, 204):
            raise SupabaseError(f"update {table} failed: {resp.status_code} {resp.text}")
        return resp.json() if resp.content else []

    async def select_many_filtered(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: dict[str, Any] | None = None,
        ilike: dict[str, str] | None = None,
        order: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """select_many con soporte de filtros ILIKE y paginación."""
        params: dict[str, str] = {
            "select": columns,
            "limit": str(limit),
            "offset": str(offset),
        }
        if filters:
            params.update(self._filters_to_params(filters))
        if ilike:
            for col, val in ilike.items():
                params[col] = f"ilike.*{val}*"
        if order:
            params["order"] = order

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._table_url(table), params=params, headers=self._headers()
            )
        if resp.status_code != 200:
            raise SupabaseError(
                f"select_many_filtered {table} failed: {resp.status_code} {resp.text}"
            )
        return resp.json()

    async def upsert(
        self, table: str, row: dict[str, Any], *, on_conflict: str = "id"
    ) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._table_url(table),
                params={"on_conflict": on_conflict},
                json=row,
                headers=self._headers(prefer="resolution=merge-duplicates,return=representation"),
            )
        if resp.status_code not in (200, 201):
            raise SupabaseError(f"upsert {table} failed: {resp.status_code} {resp.text}")
        rows = resp.json()
        return rows[0] if rows else None

    async def delete(self, table: str, filters: dict[str, Any]) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                self._table_url(table),
                params=self._filters_to_params(filters),
                headers=self._headers(),
            )
        if resp.status_code not in (200, 204):
            raise SupabaseError(f"delete {table} failed: {resp.status_code} {resp.text}")


def get_supabase() -> SupabaseRest:
    """FastAPI dependency para inyectar el cliente."""
    try:
        return SupabaseRest()
    except SupabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
