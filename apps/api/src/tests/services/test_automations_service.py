"""
El motor de automatizaciones.

Lo que de verdad importa aquí no es que funcione cuando todo va bien, sino que
**no tumbe un alta ni un cobro cuando va mal**: se ejecuta justo después de
crear una cuenta y justo después de cobrar.
"""

import pytest
from sqlmodel import select

from src.db.automations import Automation
from src.services.automations.engine import (
    ACTIONS,
    TRIGGERS,
    _fill,
    build_context,
    run_one,
    run_trigger,
    valid_action,
    valid_trigger,
)


def test_fill_survives_stray_braces():
    # El texto lo escribe una persona: una llave suelta no puede reventar nada.
    out = _fill("Hola {nombre}, {no_existe} y esto {", {"nombre": "Rida"})
    assert out == "Hola Rida, {no_existe} y esto {"


def test_fill_with_no_context_leaves_text_alone():
    assert _fill("Sin variables", {}) == "Sin variables"


def test_registries_are_coherent():
    # Lo que la pantalla ofrece es exactamente lo que el motor acepta.
    for trigger in TRIGGERS:
        assert valid_trigger(trigger["id"])
        assert trigger["label"] and trigger["description"]
    for action in ACTIONS:
        assert valid_action(action["id"])
        assert action["label"] and action["description"]
    assert not valid_trigger("inventado")
    assert not valid_action("inventado")


@pytest.mark.asyncio
async def test_run_one_reports_unknown_action():
    row = Automation(org_id=1, trigger="student_joined", action="hacer_magia", config={})
    assert await run_one(row, {}, None) == "Acción desconocida: hacer_magia"  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_run_one_returns_the_error_instead_of_raising(db, org, admin_user):
    # Un correo sin destinatario falla; el motor lo cuenta, no explota.
    row = Automation(
        org_id=org.id,
        trigger="student_joined",
        action="send_email",
        config={"subject": "Hola", "body": "Qué tal"},
    )
    error = await run_one(row, {"nombre": "Rida", "email": ""}, db)
    assert error and "correo" in error


@pytest.mark.asyncio
async def test_run_trigger_with_nothing_configured_does_nothing(db, org, admin_user):
    # El caso normal: nadie ha creado automatizaciones. Ni error ni ruido.
    await run_trigger("student_joined", org.id, admin_user.id, db)
    rows = (await db.execute(select(Automation))).scalars().all()
    assert rows == []


@pytest.mark.asyncio
async def test_run_trigger_records_the_failure_on_the_row(db, org, admin_user):
    # Una automatización rota se apunta en su propia fila (es lo que se enseña
    # en el panel) y el resto de la escuela sigue como si nada.
    row = Automation(
        org_id=org.id,
        name="Rota",
        trigger="student_joined",
        action="add_to_group",
        config={"usergroup_id": 999999},
        enabled=True,
    )
    db.add(row)
    await db.commit()

    await run_trigger("student_joined", org.id, admin_user.id, db)

    await db.refresh(row)
    assert row.run_count == 1
    assert row.last_error
    assert row.last_run_at


@pytest.mark.asyncio
async def test_disabled_automations_are_skipped(db, org, admin_user):
    row = Automation(
        org_id=org.id,
        name="Apagada",
        trigger="student_joined",
        action="add_to_group",
        config={"usergroup_id": 999999},
        enabled=False,
    )
    db.add(row)
    await db.commit()

    await run_trigger("student_joined", org.id, admin_user.id, db)

    await db.refresh(row)
    assert row.run_count == 0


@pytest.mark.asyncio
async def test_build_context_has_what_the_texts_need(db, org, admin_user):
    context = await build_context(admin_user.id, org.id, db)
    assert context["user_id"] == admin_user.id
    assert context["org_id"] == org.id
    # Siempre hay algo que poner en {nombre}, aunque la ficha esté a medias.
    assert context["nombre"]
    assert "email" in context
