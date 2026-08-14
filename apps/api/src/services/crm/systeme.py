"""
Systeme.io CRM integration.

Counterpart of `lib/systeme.ts` in the holandesnawar/nawar-web repo:
when the visitor submits the matrícula form there, that endpoint tags
their contact in Systeme with "Matriculado sin pagar".

This module covers the academy side. When Stripe confirms the payment
we add "Alumno" and drop the two tags that mean "todavía no ha
comprado" — "Matriculado sin pagar" and "Lista de espera" — so no
sales campaign (re-engagement or launch) ever reaches a paying student.

Tag IDs come from the URL of each tag in the Systeme dashboard.

The function is best-effort: a CRM hiccup must never block a paid
checkout — we log and move on.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SYSTEME_BASE = "https://api.systeme.io/api"

# Tag IDs in systeme.io (visible in the dashboard URL for each tag).
TAG_ID_SIN_PAGAR = 2033154   # "Matriculado sin pagar"
TAG_ID_ALUMNO = 2033155      # "Alumno"

# "Lista de espera" is tagged by the website (nawar-web), which keeps its id in
# SYSTEME_WAITLIST_TAG_ID. We accept the same variable here; if it is missing we
# fall back to looking the tag up by name, so this keeps working even when only
# Vercel has the id configured.
TAG_NAME_LISTA_ESPERA = "Lista de espera"

_HTTP_TIMEOUT = httpx.Timeout(8.0, connect=4.0)


def _headers() -> dict:
    return {
        "X-API-Key": os.environ.get("SYSTEME_API_KEY", ""),
        "Content-Type": "application/json",
        "accept": "application/json",
    }


async def _find_contact_id(client: httpx.AsyncClient, email: str) -> Optional[int]:
    try:
        r = await client.get(
            f"{SYSTEME_BASE}/contacts",
            params={"email": email},
            headers=_headers(),
        )
    except httpx.HTTPError as exc:
        logger.warning("[systeme] find_contact_id network error: %s", exc)
        return None
    if r.status_code >= 400:
        logger.warning("[systeme] find_contact_id %s: %s", r.status_code, r.text[:200])
        return None
    try:
        data = r.json()
    except ValueError:
        return None
    # API has shifted shapes over time; try the common ones in order.
    items = data.get("items") if isinstance(data, dict) else None
    if items is None and isinstance(data, dict):
        items = data.get("contacts")
    if items is None and isinstance(data, list):
        items = data
    if isinstance(items, list) and items:
        first = items[0]
        if isinstance(first, dict):
            return first.get("id")
    if isinstance(data, dict):
        return data.get("id")
    return None


def _normalize(value) -> str:
    """Compares tag names without tripping over accents or double spaces."""
    return " ".join(str(value or "").split()).strip().lower()


async def _find_tag_id_by_name(client: httpx.AsyncClient, name: str) -> Optional[int]:
    """Fallback when no id is configured: page through the tag list.

    Same approach as the website's `findTagId`, including the real pagination:
    asking for a single page silently missed the tag when the account grew.
    """
    target = _normalize(name)
    seen: list[str] = []
    for page in range(1, 6):
        try:
            r = await client.get(
                f"{SYSTEME_BASE}/tags",
                params={"itemsPerPage": 50, "page": page},
                headers=_headers(),
            )
        except httpx.HTTPError as exc:
            logger.warning("[systeme] listado de etiquetas, error de red: %s", exc)
            return None
        if r.status_code >= 400:
            logger.warning("[systeme] listado de etiquetas %s: %s", r.status_code, r.text[:200])
            return None
        try:
            data = r.json()
        except ValueError:
            return None
        items = data if isinstance(data, list) else (data.get("items") or data.get("data") or [])
        if not isinstance(items, list) or not items:
            break
        for tag in items:
            if not isinstance(tag, dict):
                continue
            if tag.get("name"):
                seen.append(str(tag["name"]))
            if _normalize(tag.get("name")) == target and tag.get("id"):
                return int(tag["id"])
        if len(items) < 50:
            break
    logger.warning(
        "[systeme] etiqueta no encontrada: %s — vistas: %s",
        name,
        " | ".join(seen[:15]) or "(ninguna)",
    )
    return None


async def _waitlist_tag_id(client: httpx.AsyncClient) -> Optional[int]:
    raw = (os.environ.get("SYSTEME_WAITLIST_TAG_ID") or "").strip()
    if raw.isdigit() and int(raw) > 0:
        return int(raw)
    return await _find_tag_id_by_name(client, TAG_NAME_LISTA_ESPERA)


async def _remove_tag(
    client: httpx.AsyncClient, contact_id: int, tag_id: int, label: str, email: str
) -> None:
    """Best-effort: a CRM hiccup must never surface in the payment flow."""
    try:
        r = await client.delete(
            f"{SYSTEME_BASE}/contacts/{contact_id}/tags/{tag_id}",
            headers=_headers(),
        )
        # 404 = the contact did not carry the tag, which is the desired state.
        if r.status_code in (200, 204, 404):
            logger.info("[systeme] -%s %s", label, email)
        else:
            logger.error("[systeme] error -%s: %s %s", label, r.status_code, r.text[:200])
    except httpx.HTTPError as exc:
        logger.error("[systeme] -%s network error: %s", label, exc)


async def mark_as_alumno(email: str) -> None:
    """Adds "Alumno" and removes "Matriculado sin pagar" + "Lista de espera".

    Never raises. Called from the Stripe webhook after a confirmed payment,
    so from that moment those two tags mean exactly "aún no ha comprado" and
    a campaign sent to either of them cannot reach a student who already paid.
    """
    if not os.environ.get("SYSTEME_API_KEY"):
        logger.warning("[systeme] SYSTEME_API_KEY not set, skipping for %s", email)
        return

    clean_email = (email or "").strip().lower()
    if not clean_email:
        return

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            contact_id = await _find_contact_id(client, clean_email)
            if not contact_id:
                logger.error("[systeme] contacto no encontrado: %s", clean_email)
                return

            # Add "Alumno"
            try:
                add = await client.post(
                    f"{SYSTEME_BASE}/contacts/{contact_id}/tags",
                    headers=_headers(),
                    json={"tagId": TAG_ID_ALUMNO},
                )
                if add.status_code in (200, 201, 204, 409):
                    logger.info("[systeme] +Alumno %s", clean_email)
                else:
                    logger.error("[systeme] error +Alumno: %s %s", add.status_code, add.text[:200])
            except httpx.HTTPError as exc:
                logger.error("[systeme] +Alumno network error: %s", exc)

            # Remove "Matriculado sin pagar"
            await _remove_tag(
                client, contact_id, TAG_ID_SIN_PAGAR, "Matriculado sin pagar", clean_email
            )

            # Remove "Lista de espera": whoever just paid must not receive the
            # launch campaign that goes out to that tag.
            waitlist_id = await _waitlist_tag_id(client)
            if waitlist_id:
                await _remove_tag(
                    client, contact_id, waitlist_id, TAG_NAME_LISTA_ESPERA, clean_email
                )
    except Exception:
        logger.exception("[systeme] mark_as_alumno failed for %s", clean_email)
