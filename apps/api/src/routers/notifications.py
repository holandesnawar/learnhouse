"""
Inbound notification webhooks from other services in the Nawar stack.

Currently:
  * `POST /notifications/consulta-answered` — fired by the consultas
    Supabase edge function when an admin saves a reply to a consulta.
    We turn the payload into our branded "tienes respuesta" email so
    students see the same Nawar look across every transactional mail
    (welcome, reset, payment, consulta).

All endpoints under this router are authenticated with a shared header
secret (`LEARNHOUSE_CONSULTAS_WEBHOOK_SECRET`). Don't expose anything
here that doesn't check the secret.
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel, EmailStr

from src.services.users.emails import send_consulta_answered_email


logger = logging.getLogger(__name__)
router = APIRouter()


class ConsultaAnsweredPayload(BaseModel):
    email: EmailStr
    name: str = "alumno/a"
    title: str = "tu consulta"
    # Deep link to the answer (consultas-tau or wherever the user reads it).
    link: str | None = None


def _check_secret(provided: str) -> None:
    expected = os.environ.get("LEARNHOUSE_CONSULTAS_WEBHOOK_SECRET", "").strip()
    if not expected:
        # Fail closed: refuse to broadcast emails on a misconfigured server.
        raise HTTPException(status_code=503, detail="webhook secret not configured")
    if not provided or provided.strip() != expected:
        raise HTTPException(status_code=401, detail="invalid secret")


@router.get(
    "/health",
    summary="Quick diagnostic for the consulta-answered webhook secret.",
    description=(
        "Hit this from a browser to confirm whether the running container "
        "actually sees LEARNHOUSE_CONSULTAS_WEBHOOK_SECRET. Returns only "
        "whether it's set and how long it is — never the value itself."
    ),
)
async def api_notifications_health():
    raw = os.environ.get("LEARNHOUSE_CONSULTAS_WEBHOOK_SECRET", "")
    stripped = raw.strip()
    return {
        "consulta_webhook_secret_configured": bool(stripped),
        "secret_length": len(stripped),
        "had_whitespace_padding": len(raw) != len(stripped),
    }


@router.post(
    "/consulta-answered",
    summary="Inbound webhook: a consulta got a reply — email the student.",
    description=(
        "Called by the consultas Supabase edge function (or any other "
        "trusted upstream) when `consultas.respuesta_nawar` flips from "
        "NULL to a value. We render the academy-branded email and hand "
        "it to Resend in a background task so the upstream doesn't have "
        "to wait on email I/O."
    ),
    responses={
        200: {"description": "queued"},
        401: {"description": "invalid X-Consultas-Secret header"},
        503: {"description": "server missing LEARNHOUSE_CONSULTAS_WEBHOOK_SECRET"},
    },
)
async def api_consulta_answered(
    payload: ConsultaAnsweredPayload,
    background: BackgroundTasks,
    x_consultas_secret: str = Header(default="", alias="X-Consultas-Secret"),
):
    _check_secret(x_consultas_secret)
    background.add_task(
        send_consulta_answered_email,
        email=payload.email,
        name=payload.name or "alumno/a",
        question_excerpt=payload.title or "tu consulta",
        link=payload.link,
    )
    return {"ok": True}
