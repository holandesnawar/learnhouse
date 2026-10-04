"""Recordatorio a un alumno que lleva días sin entrar (Panel → Progreso)."""

from datetime import datetime
from unittest.mock import patch

from sqlmodel import select

from src.db.recordatorios import StudentReminder  # noqa: F401  (crea la tabla en la base de pruebas)

from src.services.panel.alumnos import clase_para_seguir
from src.services.panel.recordatorio import DE_FABRICA, mezclar, rellenar, tipo_para
from src.services.users.emails import send_recordatorio_alumno_email


def test_rellenar_pone_los_huecos_y_no_rompe_con_llaves_raras():
    assert rellenar("Hola {nombre}, {dias} días · {clase} · {otra}", {"nombre": "Ana", "dias": 4, "clase": "1.4 Lezen"}) == (
        "Hola Ana, 4 días · 1.4 Lezen · {otra}"
    )
    assert rellenar("{nombre} {", {}) == " {"


def test_tipo_segun_los_dias():
    assert tipo_para(3) == "tres_dias"
    assert tipo_para(6) == "tres_dias"
    assert tipo_para(7) == "semana"
    assert tipo_para(None) == "semana"


def test_mezclar_no_deja_huecos_vacios():
    m = mezclar({"semana": {"asunto": "  ", "texto": "Mi texto"}, "botones": {"victoria": "Cuéntanos tu logro"}})
    assert m["semana"]["asunto"] == DE_FABRICA["semana"]["asunto"]
    assert m["semana"]["texto"] == "Mi texto"
    assert m["botones"]["victoria"] == "Cuéntanos tu logro"
    assert m["botones"]["seguir"] == DE_FABRICA["botones"]["seguir"]


def test_seguir_lleva_a_la_abierta_o_a_la_siguiente():
    assert clase_para_seguir({"como": "abrio", "uuid": "a2"}, {"uuid": "a3"}) == "a2"
    assert clase_para_seguir({"como": "termino", "uuid": "a2"}, {"uuid": "a3"}) == "a3"
    assert clase_para_seguir(None, None) == ""


def test_el_correo_escapa_el_texto_y_lleva_los_tres_botones():
    r = send_recordatorio_alumno_email(
        "ana@correo.com", asunto="Ana, <hola>", texto="Línea *importante*\n\n<script>x</script>",
        seguir_url="https://e/seguir", victoria_url="https://e/com", consulta_url="https://e/con", preview=True,
    )
    h = r["html"]
    assert "<script>" not in h and "&lt;script&gt;" in h
    assert "<strong>importante</strong>" in h
    for url in ("https://e/seguir", "https://e/com", "https://e/con"):
        assert url in h
    assert "Seguir donde lo dejé" in h and "Compartir una victoria" in h and "Hacer una consulta" in h


async def test_enviar_apunta_el_recordatorio_y_la_prueba_no(db, org, user_role, regular_user, course, chapter, activity, monkeypatch):
    from src.db.organization_config import OrganizationConfig
    from src.db.recordatorios import StudentReminder
    from src.services.panel import avance as avance_mod
    from src.services.panel import recordatorio

    monkeypatch.setattr(avance_mod, "FORMACION_UUID", "test")
    monkeypatch.setattr("src.services.panel.alumnos.STUDENT_ROLE_ID", user_role.id)
    db.add(OrganizationConfig(org_id=org.id, config={}, creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()

    enviados = []
    with patch("src.services.users.emails.send_email", side_effect=lambda **k: enviados.append(k) or {"html": k["body"]}):
        v = await recordatorio.montar(org.id, regular_user.id, "semana", "", "", db)
        assert enviados[-1]["dry_run"] is True
        assert "esta semana no has entrado" in v["asunto"]

        await recordatorio.enviar(org.id, regular_user.id, "semana", "", "", "Admin", db, a_mi="yo@equipo.com")
        assert enviados[-1]["to"] == "yo@equipo.com" and enviados[-1]["dry_run"] is False
        assert (await db.execute(select(StudentReminder))).scalars().all() == []

        await recordatorio.enviar(org.id, regular_user.id, "tres_dias", "Hola {nombre}", "Texto", "Admin", db)
        assert enviados[-1]["to"] == regular_user.email
    filas = (await db.execute(select(StudentReminder))).scalars().all()
    assert len(filas) == 1 and filas[0].tipo == "tres_dias" and filas[0].sent_by == "Admin"


# --- Cada botón debajo de su frase -----------------------------------------

from src.services.panel.recordatorio import colocar_botones  # noqa: E402


def test_los_botones_van_donde_esta_su_marca():
    t = "Hola:\n\nSigue aquí.\n\n[seguir]\n\nCuenta tu victoria.\n[victoria]\n\nDudas.\n\n[consulta]"
    assert colocar_botones(t) == [
        ("texto", "Hola:\n\nSigue aquí."),
        ("boton", "seguir"),
        ("texto", "Cuenta tu victoria."),
        ("boton", "victoria"),
        ("texto", "Dudas."),
        ("boton", "consulta"),
    ]


def test_marca_que_falta_va_al_final_y_repetida_cuenta_una_vez():
    t = "A\n\n[seguir]\n\nB\n\n[seguir]"
    assert colocar_botones(t) == [("texto", "A"), ("boton", "seguir"), ("texto", "B"), ("boton", "victoria"), ("boton", "consulta")]


def test_texto_viejo_sin_marcas_pone_cada_boton_debajo_de_su_parrafo():
    t = "Hola:\n\nSeguir justo donde lo dejaste.\n\n¿Alguna victoria?\n\nSi tienes dudas, haz una consulta."
    assert [x for x in colocar_botones(t)] == [
        ("texto", "Hola:"),
        ("texto", "Seguir justo donde lo dejaste."),
        ("boton", "seguir"),
        ("texto", "¿Alguna victoria?"),
        ("boton", "victoria"),
        ("texto", "Si tienes dudas, haz una consulta."),
        ("boton", "consulta"),
    ]


def test_el_correo_de_fabrica_no_ensenya_las_marcas():
    from src.services.panel.recordatorio import DE_FABRICA, rellenar

    for tipo in ("tres_dias", "semana"):
        h = send_recordatorio_alumno_email(
            "a@b.com", asunto="x", texto=rellenar(DE_FABRICA[tipo]["texto"], {"nombre": "Ana", "dias": 4}), preview=True
        )["html"]
        assert "[seguir]" not in h and "[victoria]" not in h and "[consulta]" not in h
        # El de seguir va antes que el de victoria, y este antes que el de consulta.
        assert h.index("Seguir donde lo dejé") < h.index("Compartir una victoria") < h.index("Hacer una consulta")


# --- A dónde llevan los botones ---------------------------------------------

from src.services.panel.recordatorio import url_enlace  # noqa: E402


def test_victoria_va_al_canal_de_victorias_por_defecto():
    assert DE_FABRICA["enlaces"]["victoria"] == "/community/community_bbe57cb8-5197-4195-bc1f-6615aed4dcab"


def test_url_enlace():
    base = "https://app.ejemplo.com"
    assert url_enlace("/community/x", "/def", base) == "https://app.ejemplo.com/community/x"
    assert url_enlace("https://otra.com/a", "/def", base) == "https://otra.com/a"
    assert url_enlace("javascript:alert(1)", "/def", base) == "https://app.ejemplo.com/def"
    assert url_enlace("", "/def", base + "/") == "https://app.ejemplo.com/def"
