"""
Contactos: todo lo que la escuela sabe de cada persona, en un solo sitio.

Para qué
--------
Antes de escribir a alguien hay que saber tres cosas: qué ha visto (¿el
precio?), de qué campaña viene y qué ha hecho con nosotros (¿descargó una
guía?, ¿llegó al pago?, ¿ya paga?). Eso estaba repartido en tres tablas y en
systeme.io. Aquí se junta por correo y se enseña como un historial.

De dónde sale cada cosa
-----------------------
- `enrollment_request`  → "pidió plaza" (el formulario que no cobra).
- `enrollment`          → "empezó la matrícula" y, si pagó, "pagó".
- `contact_event`       → lo demás: guías, Instagram, reuniones…
- `user`                → si ya tiene cuenta en la escuela.
- systeme.io (en vivo)  → sus etiquetas, que es "en qué campaña está".

La fusión es una función pura (`fusionar_contactos`) para poder probarla sin
base de datos. Lo que habla con systeme.io va aparte y falla en blando: si el
CRM no contesta, el historial se enseña igual, sin etiquetas.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.contact_event import ContactEvent, ContactEventCreate
from src.db.enrollment import Enrollment
from src.db.enrollment_request import EnrollmentRequest
from src.db.users import User
from src.services.crm.systeme import SYSTEME_BASE, _headers
from src.services.payments.solicitudes import resumen_del_lead

logger = logging.getLogger(__name__)

#: Cómo se llama en cristiano cada cosa que pudo hacer.
NOMBRES_TIPO = {
    "guia-bases": "Descargó la guía de las bases",
    "guia-hebben": "Descargó la guía hebben/zijn",
    "guia": "Descargó una guía",
    "lista-espera": "Se apuntó a la lista de espera",
    "instagram": "Escribió por Instagram",
    "solicitud": "Pidió plaza por el formulario",
    "matricula": "Empezó la matrícula (llegó al pago)",
    "pago": "Pagó la formación",
    "reunion": "Reservó una reunión",
    "alta-manual": "Dado de alta a mano",
}

#: Los tipos en los que la persona ha visto el precio con seguridad: llegar al
#: pago es ver el precio, por definición.
_CON_PRECIO = {"matricula", "pago"}


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _instante(texto: str) -> float:
    """Fecha guardada como texto → número comparable. Las fechas vienen de
    tres tablas escritas en épocas distintas (con y sin zona horaria); aquí se
    igualan. Una fecha rota vale cero, no revienta la lista."""
    if not texto:
        return 0.0
    try:
        d = datetime.fromisoformat(str(texto).replace("Z", "+00:00"))
        if d.tzinfo is not None:
            d = d.astimezone(timezone.utc).replace(tzinfo=None)
        return d.timestamp()
    except Exception:  # noqa: BLE001
        return 0.0


async def registrar_evento(data: ContactEventCreate, db_session: AsyncSession) -> ContactEvent:
    """Guarda lo que hizo una persona. Se recorta todo: viene de fuera."""
    fila = ContactEvent(
        email=str(data.email).strip().lower()[:255],
        kind=(data.kind or "").strip()[:40],
        first_name=(data.first_name or "").strip()[:120],
        last_name=(data.last_name or "").strip()[:120],
        phone=(data.phone or "").strip()[:40],
        source=(data.source or "").strip()[:40],
        tag=(data.tag or "").strip()[:120],
        recorrido=",".join(x for x in (data.recorrido or []) if x)[:400],
        referrer=(data.referrer or "").strip()[:120],
        utm_source=(data.utm_source or "").strip()[:120],
        utm_medium=(data.utm_medium or "").strip()[:120],
        utm_campaign=(data.utm_campaign or "").strip()[:120],
        extra=json.dumps(data.extra or {}, ensure_ascii=False)[:2000],
        created_at=_ahora(),
    )
    db_session.add(fila)
    await db_session.commit()
    await db_session.refresh(fila)
    return fila


def _evento(kind: str, when: str, email: str, **campos) -> dict:
    base = {
        "kind": kind,
        "que": NOMBRES_TIPO.get(kind, kind),
        "when": when or "",
        "email": email,
        "first_name": "",
        "last_name": "",
        "phone": "",
        "source": "",
        "tag": "",
        "recorrido": "",
        "referrer": "",
        "utm_source": "",
        "utm_medium": "",
        "utm_campaign": "",
        "extra": {},
    }
    base.update({k: v for k, v in campos.items() if v is not None})
    return base


def fusionar_contactos(eventos: list[dict], con_cuenta: set[str]) -> list[dict]:
    """
    Agrupa los eventos por correo y saca una ficha por persona.

    Función pura: recibe listas y devuelve listas. Es la que tiene test.
    """
    por_email: dict[str, list[dict]] = {}
    for ev in eventos:
        email = (ev.get("email") or "").strip().lower()
        if not email:
            continue
        por_email.setdefault(email, []).append(ev)

    fichas: list[dict] = []
    for email, lista in por_email.items():
        lista.sort(key=lambda e: _instante(e.get("when", "")))

        def ultimo(campo: str) -> str:
            for e in reversed(lista):
                v = (e.get(campo) or "").strip() if isinstance(e.get(campo), str) else ""
                if v:
                    return v
            return ""

        tipos = {e["kind"] for e in lista}
        if email in con_cuenta or "pago" in tipos:
            estado = "alumno"
        elif "matricula" in tipos:
            estado = "matriculado-sin-pagar"
        else:
            estado = "lead"

        # Lo que vio: cualquier recorrido que pase por la página con precio, o
        # haber llegado al pago, que enseña el precio por definición.
        vio_precio = bool(tipos & _CON_PRECIO)
        recorridos = [e.get("recorrido") or "" for e in lista if e.get("recorrido")]
        pasos: list[str] = []
        for r in recorridos:
            for p in r.split(","):
                if p and p not in pasos:
                    pasos.append(p)
        if "landing-precio" in pasos:
            vio_precio = True

        etiquetas = []
        for e in lista:
            t = (e.get("tag") or "").strip()
            if t and t not in etiquetas:
                etiquetas.append(t)

        primero, ult = lista[0], lista[-1]
        nombre = f"{ultimo('first_name')} {ultimo('last_name')}".strip()
        resumen = resumen_del_lead(",".join(pasos), ultimo("referrer"), ultimo("source"))

        fichas.append(
            {
                "email": email,
                "nombre": nombre,
                "telefono": ultimo("phone"),
                "estado": estado,
                "vio_precio": vio_precio,
                "vino_de": resumen.get("vino_de", ""),
                "camino": resumen.get("camino", ""),
                "utm_source": ultimo("utm_source"),
                "utm_medium": ultimo("utm_medium"),
                "utm_campaign": ultimo("utm_campaign"),
                "etiquetas": etiquetas,
                "primer_contacto": {"kind": primero["kind"], "que": primero["que"], "when": primero["when"]},
                "ultimo_contacto": {"kind": ult["kind"], "que": ult["que"], "when": ult["when"]},
                "n_eventos": len(lista),
                "eventos": lista,
            }
        )

    fichas.sort(key=lambda f: _instante(f["ultimo_contacto"]["when"]), reverse=True)
    return fichas


async def _todos_los_eventos(db_session: AsyncSession) -> list[dict]:
    eventos: list[dict] = []

    for r in (await db_session.execute(select(ContactEvent))).scalars().all():
        try:
            extra = json.loads(r.extra) if r.extra else {}
        except Exception:  # noqa: BLE001
            extra = {}
        eventos.append(
            _evento(
                r.kind, r.created_at, r.email,
                first_name=r.first_name, last_name=r.last_name, phone=r.phone,
                source=r.source, tag=r.tag, recorrido=r.recorrido, referrer=r.referrer,
                utm_source=r.utm_source, utm_medium=r.utm_medium, utm_campaign=r.utm_campaign,
                extra=extra,
            )
        )

    for r in (await db_session.execute(select(EnrollmentRequest))).scalars().all():
        eventos.append(
            _evento(
                "solicitud", r.created_at, r.email,
                first_name=r.first_name, last_name=r.last_name, phone=r.phone,
                source=r.source, recorrido=r.recorrido, referrer=r.referrer,
                utm_source=getattr(r, "utm_source", ""), utm_medium=getattr(r, "utm_medium", ""),
                utm_campaign=getattr(r, "utm_campaign", ""),
                extra={"contactada": bool(r.contacted_at)},
            )
        )

    for r in (await db_session.execute(select(Enrollment))).scalars().all():
        comunes = dict(
            first_name=r.first_name, last_name=r.last_name, phone=r.phone,
            recorrido=getattr(r, "recorrido", ""), referrer=getattr(r, "referrer", ""),
            utm_source=getattr(r, "utm_source", ""), utm_medium=getattr(r, "utm_medium", ""),
            utm_campaign=getattr(r, "utm_campaign", ""),
        )
        eventos.append(_evento("matricula", r.created_at, r.email, source="checkout", **comunes))
        if r.status == "paid":
            eventos.append(
                _evento(
                    "pago", r.paid_at or r.updated_at or r.created_at, r.email,
                    source="stripe",
                    extra={"importe_cents": r.amount_cents, "currency": r.currency, "product": r.product},
                    **comunes,
                )
            )
    return eventos


async def _emails_con_cuenta(db_session: AsyncSession) -> set[str]:
    filas = (await db_session.execute(select(User.email))).all()
    return {str(e[0]).strip().lower() for e in filas if e and e[0]}


async def listar_contactos(q: str, limit: int, db_session: AsyncSession) -> dict:
    fichas = fusionar_contactos(await _todos_los_eventos(db_session), await _emails_con_cuenta(db_session))
    total = len(fichas)
    q = (q or "").strip().lower()
    if q:
        fichas = [
            f for f in fichas
            if q in f["email"] or q in f["nombre"].lower() or q in f["telefono"]
            or q in f["utm_campaign"].lower() or any(q in t.lower() for t in f["etiquetas"])
        ]
    # La lista va sin el historial entero: pesa y no hace falta hasta abrir uno.
    ligeras = [{k: v for k, v in f.items() if k != "eventos"} for f in fichas[: max(1, limit)]]
    return {"total": total, "mostrados": len(ligeras), "contactos": ligeras}


async def detalle_contacto(email: str, db_session: AsyncSession) -> Optional[dict]:
    email = (email or "").strip().lower()
    if not email:
        return None
    eventos = [e for e in await _todos_los_eventos(db_session) if e["email"] == email]
    if not eventos:
        return None
    ficha = fusionar_contactos(eventos, await _emails_con_cuenta(db_session))[0]
    ficha["systeme"] = await etiquetas_en_systeme(email)
    return ficha


async def etiquetas_en_systeme(email: str) -> dict:
    """
    Lo que systeme.io tiene de esa persona: etiquetas (= en qué campaña está)
    y campos. En vivo y en blando: si no hay clave o no contesta, se dice y ya.
    """
    if not os.environ.get("SYSTEME_API_KEY"):
        return {"ok": False, "motivo": "SYSTEME_API_KEY no está puesta", "etiquetas": [], "campos": []}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(6.0, connect=3.0)) as client:
            res = await client.get(f"{SYSTEME_BASE}/contacts", params={"email": email}, headers=_headers())
            if res.status_code != 200:
                return {"ok": False, "motivo": f"systeme.io contestó {res.status_code}", "etiquetas": [], "campos": []}
            data = res.json()
            items = data.get("items") if isinstance(data, dict) else data
            if not items:
                return {"ok": True, "existe": False, "etiquetas": [], "campos": []}
            c = items[0]
            etiquetas = [t.get("name") for t in (c.get("tags") or []) if isinstance(t, dict) and t.get("name")]
            campos = [
                {"slug": f.get("slug"), "valor": f.get("value")}
                for f in (c.get("fields") or [])
                if isinstance(f, dict) and f.get("value")
            ]
            return {"ok": True, "existe": True, "id": c.get("id"), "etiquetas": etiquetas, "campos": campos}
    except Exception as exc:  # noqa: BLE001
        logger.warning("systeme.io no contestó para %s: %s", email, exc)
        return {"ok": False, "motivo": "systeme.io no contestó", "etiquetas": [], "campos": []}
