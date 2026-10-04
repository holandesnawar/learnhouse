"""Recordatorio automático «1 semana sin entrar» y el grupo Testers."""

from datetime import date, datetime
from unittest.mock import patch

from sqlmodel import select

from src.db.recordatorios import StudentReminder  # noqa: F401  (crea la tabla en la base de pruebas)
import src.services.panel.alumnos  # noqa: F401,E402  (y las de progreso y recorrido)
from src.services.panel.recordatorio import toca_automatico
from src.services.panel.testers import es_grupo_de_testers

HOY = date(2026, 10, 20)


def test_toca_desde_la_ultima_entrada():
    assert toca_automatico("2026-10-13", "2026-09-01", "", HOY) is True       # 7 días
    assert toca_automatico("2026-10-14T18:00:00Z", "2026-09-01", "", HOY) is False  # 6 días


def test_sin_entrar_nunca_cuenta_desde_el_alta():
    assert toca_automatico("", "2026-10-10", "", HOY) is True
    assert toca_automatico("", "2026-10-15", "", HOY) is False
    assert toca_automatico("", "", "", HOY) is False


def test_uno_por_racha_de_silencio():
    # Ya se le recordó después de su última entrada: no se repite.
    assert toca_automatico("2026-10-01", "2026-09-01", "2026-10-09T07:00:00Z", HOY) is False
    # El recordatorio era de ANTES de volver a entrar: esta es otra racha.
    assert toca_automatico("2026-10-05", "2026-09-01", "2026-09-30T07:00:00Z", HOY) is True


def test_nombre_del_grupo_de_testers():
    for n in ("Testers", "testers", " Tester ", "Pruebas", "Cuentas de prueba"):
        assert es_grupo_de_testers(n)
    for n in ("Alumnos", "VIP", "Testing team", ""):
        assert not es_grupo_de_testers(n)


async def _alumno_viejo(db, org, user_role, regular_user):
    """El alumno de prueba, dado de alta hace mucho y sin entrar nunca."""
    from src.db.organization_config import OrganizationConfig
    from src.db.user_organizations import UserOrganization

    uo = (await db.execute(select(UserOrganization).where(UserOrganization.user_id == regular_user.id))).scalars().first()
    uo.creation_date = "2026-01-01 10:00:00"
    db.add(uo)
    db.add(OrganizationConfig(org_id=org.id, config={}, creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()


async def test_apagado_no_manda_y_encendido_manda_una_vez(db, org, user_role, regular_user, monkeypatch):
    from src.services.panel import recordatorio

    monkeypatch.setattr("src.services.panel.alumnos.STUDENT_ROLE_ID", user_role.id)
    await _alumno_viejo(db, org, user_role, regular_user)

    enviados = []
    with patch("src.services.users.emails.send_email", side_effect=lambda **k: enviados.append(k) or {"html": k["body"]}):
        r = await recordatorio.recordatorio_automatico(org.id, db)
        assert r == {"activo": False, "enviados": 0, "le_tocaria_a": 1}
        assert enviados == []

        await recordatorio.guardar_auto(org.id, True, "Admin", db)
        r = await recordatorio.recordatorio_automatico(org.id, db)
        assert r["enviados"] == 1 and enviados[-1]["to"] == regular_user.email and enviados[-1]["dry_run"] is False

        # Al día siguiente (o si la tarea se lanza dos veces) no se repite.
        r = await recordatorio.recordatorio_automatico(org.id, db)
        assert r["enviados"] == 0
    filas = (await db.execute(select(StudentReminder))).scalars().all()
    assert len(filas) == 1 and filas[0].sent_by == "Automático" and filas[0].tipo == "semana"


async def test_los_testers_no_reciben_nada(db, org, user_role, regular_user, monkeypatch):
    from src.db.usergroup_user import UserGroupUser
    from src.db.usergroups import UserGroup
    from src.services.notifications.broadcast import list_org_recipients
    from src.services.panel import recordatorio

    monkeypatch.setattr("src.services.panel.alumnos.STUDENT_ROLE_ID", user_role.id)
    monkeypatch.setattr("src.services.notifications.broadcast.ROL_ALUMNO", user_role.id)
    await _alumno_viejo(db, org, user_role, regular_user)
    assert [e for e, _ in await list_org_recipients(org.id, db)] == [regular_user.email]

    g = UserGroup(name="Testers", description="", org_id=org.id, usergroup_uuid="usergroup_t", creation_date="", update_date="")
    db.add(g)
    await db.commit()
    await db.refresh(g)
    db.add(UserGroupUser(usergroup_id=g.id, user_id=regular_user.id, org_id=org.id, creation_date="", update_date=""))
    await db.commit()

    assert await list_org_recipients(org.id, db) == []
    await recordatorio.guardar_auto(org.id, True, "Admin", db)
    with patch("src.services.users.emails.send_email") as envio:
        r = await recordatorio.recordatorio_automatico(org.id, db)
    assert r["enviados"] == 0 and r["candidatos"] == 0 and not envio.called
