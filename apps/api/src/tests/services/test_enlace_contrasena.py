"""Volver a dar a un alumno su enlace de «crear contraseña» (17/11/2026):
services/panel/enlace_contrasena.py.

- Da un enlace nuevo con el correo de la cuenta y el código guardado.
- Con `enviar`, sale el correo de bienvenida; si falla, se dice por qué.
- Solo cuentas de esta escuela.
"""

from datetime import datetime

import pytest

from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.panel import enlace_contrasena as E
from src.services.payments import payments
from src.services.users import emails


async def _cuenta(db, org, uid=7, email="ana@ejemplo.com", de_aqui=True):
    db.add(User(id=uid, username=f"u{uid}", first_name="Ana", last_name="Ruiz", email=email, password="x",
                user_uuid=f"user_{uid}", creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()
    if de_aqui:
        db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=4, creation_date="", update_date=""))
        await db.commit()


async def test_da_el_enlace_y_manda_el_correo(db, org, monkeypatch):
    await _cuenta(db, org)
    monkeypatch.setattr(payments, "_store_reset_code", lambda user, org_uuid="": "CODIGO12")
    enviados = []
    monkeypatch.setattr(emails, "send_payment_welcome_email", lambda **kw: enviados.append(kw))
    r = await E.dar_enlace(org.id, 7, True, db)
    assert r["ok"] and r["correo_enviado"]
    assert "/auth/crear-cuenta?email=ana%40ejemplo.com&resetCode=CODIGO12" in r["enlace"]
    assert enviados and enviados[0]["reset_code"] == "CODIGO12"

    # Solo el enlace, sin correo.
    enviados.clear()
    r = await E.dar_enlace(org.id, 7, False, db)
    assert r["enlace"] and not r["correo_enviado"] and not enviados


async def test_si_el_correo_falla_lo_dice(db, org, monkeypatch):
    await _cuenta(db, org)
    monkeypatch.setattr(payments, "_store_reset_code", lambda user, org_uuid="": "CODIGO12")

    def falla(**kw):
        raise RuntimeError("Resend no contesta")

    monkeypatch.setattr(emails, "send_payment_welcome_email", falla)
    r = await E.dar_enlace(org.id, 7, True, db)
    assert r["enlace"] and not r["correo_enviado"] and "Resend no contesta" in r["motivo"]


async def test_solo_cuentas_de_esta_escuela(db, org, monkeypatch):
    await _cuenta(db, org, de_aqui=False)
    monkeypatch.setattr(payments, "_store_reset_code", lambda user, org_uuid="": "CODIGO12")
    with pytest.raises(ValueError):
        await E.dar_enlace(org.id, 7, False, db)
    with pytest.raises(ValueError):
        await E.dar_enlace(org.id, 999, False, db)


async def test_cambiar_correo_de_acceso(db, org):
    await _cuenta(db, org)
    r = await E.cambiar_correo(org.id, 7, "  Ana.Nueva@Ejemplo.com ", db)
    assert r["cambiado"] and r["email"] == "ana.nueva@ejemplo.com" and r["antes"] == "ana@ejemplo.com"
    u = (await db.execute(E.select(User).where(User.id == 7))).scalars().first()
    assert u.email == "ana.nueva@ejemplo.com" and u.email_verified

    # Un correo que ya usa otra cuenta, no.
    await _cuenta(db, org, uid=8, email="otra@ejemplo.com")
    with pytest.raises(ValueError):
        await E.cambiar_correo(org.id, 7, "OTRA@ejemplo.com", db)
    # Mal escrito, no.
    with pytest.raises(ValueError):
        await E.cambiar_correo(org.id, 7, "sin-arroba", db)
    # Un administrador, no.
    db.add(User(id=9, username="u9", first_name="Ad", last_name="Min", email="ad@ejemplo.com", password="x",
                user_uuid="user_9", creation_date="", update_date=""))
    await db.commit()
    db.add(UserOrganization(user_id=9, org_id=org.id, role_id=1, creation_date="", update_date=""))
    await db.commit()
    with pytest.raises(PermissionError):
        await E.cambiar_correo(org.id, 9, "nuevo@ejemplo.com", db)
    # Cuenta de otra escuela, no.
    with pytest.raises(LookupError):
        await E.cambiar_correo(org.id, 999, "x@ejemplo.com", db)
