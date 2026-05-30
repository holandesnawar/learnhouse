"""
Systeme.io CRM integration.

Counterpart of `lib/systeme.ts` in the holandesnawar/nawar-web repo:
when the visitor submits the matrícula form there, that endpoint tags
their contact in Systeme with "Matriculado sin pagar".

This module covers the academy side. When Stripe confirms the payment
we drop that tag and add "Alumno", so the re-engagement campaign
("matriculados que NO pagaron") never reaches a paying student.

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


async def mark_as_alumno(email: str) -> None:
    """Adds "Alumno", removes "Matriculado sin pagar". Never raises.

    Called from the Stripe webhook after a confirmed payment.
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
            try:
                rm = await client.delete(
                    f"{SYSTEME_BASE}/contacts/{contact_id}/tags/{TAG_ID_SIN_PAGAR}",
                    headers=_headers(),
                )
                if rm.status_code in (200, 204, 404):
                    logger.info("[systeme] -Matriculado sin pagar %s", clean_email)
                else:
                    logger.error("[systeme] error -tag: %s %s", rm.status_code, rm.text[:200])
            except httpx.HTTPError as exc:
                logger.error("[systeme] -tag network error: %s", exc)
    except Exception:
        logger.exception("[systeme] mark_as_alumno failed for %s", clean_email)
