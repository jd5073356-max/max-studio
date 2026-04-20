"""Web Push — suscripciones y envío de notificaciones.

Endpoints:
  POST   /push/subscribe         — registrar suscripción del browser
  DELETE /push/subscribe         — eliminar suscripción
  POST   /internal/notify        — enviar push a todos (autenticado con INTERNAL_API_KEY)
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.deps import CurrentUser, SupabaseDep

router = APIRouter(tags=["push"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


class NotifyRequest(BaseModel):
    title: str = "MAX"
    body: str
    url: str = "/chat"
    icon: str = "/icon.svg"


# ── Rutas públicas (con auth de usuario) ─────────────────────────────────────

@router.post("/push/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    body: PushSubscription,
    user: CurrentUser,  # noqa: ARG001 — verifica auth
    sb: SupabaseDep,
) -> dict[str, bool]:
    """Guarda o actualiza la suscripción push del browser."""
    await sb.upsert(
        "push_subscriptions",
        {
            "endpoint": body.endpoint,
            "p256dh": body.keys.p256dh,
            "auth": body.keys.auth,
        },
        on_conflict="endpoint",
    )
    return {"ok": True}


@router.delete("/push/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    body: PushSubscription,
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
) -> None:
    """Elimina la suscripción push."""
    await sb.delete("push_subscriptions", {"endpoint": body.endpoint})


# ── Ruta interna (solo INTERNAL_API_KEY) ─────────────────────────────────────

@router.post("/internal/notify")
async def notify(
    body: NotifyRequest,
    sb: SupabaseDep,
    x_internal_key: str | None = Header(default=None, alias="x-internal-key"),
) -> dict[str, Any]:
    """Envía una notificación push a todos los dispositivos suscritos.

    Requiere header X-Internal-Key con el valor de INTERNAL_API_KEY.
    Llamado por MAX backend (Dispatch / cron) para notificaciones proactivas.
    """
    settings = get_settings()

    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if not settings.vapid_private_key or settings.vapid_private_key == "placeholder":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VAPID no configurado en el servidor",
        )

    # Import tardío para no crashear si pywebpush no está instalado
    try:
        from pywebpush import WebPushException, webpush  # type: ignore[import]
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="pywebpush no instalado",
        ) from exc

    subs = await sb.select_many("push_subscriptions", {})
    sent = 0
    stale: list[str] = []

    payload = json.dumps({
        "title": body.title,
        "body": body.body,
        "url": body.url,
        "icon": body.icon,
    })

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            sent += 1
        except WebPushException as exc:
            # 410 Gone = suscripción expirada → limpiar
            if exc.response is not None and exc.response.status_code == 410:
                stale.append(sub["endpoint"])

    # Limpiar suscripciones inválidas
    for endpoint in stale:
        await sb.delete("push_subscriptions", {"endpoint": endpoint})

    return {"ok": True, "sent": sent, "total": len(subs), "stale_removed": len(stale)}
