"""El resumen semanal por correo (services/notifications/resumen_semanal.py)."""

from datetime import date, datetime, timezone

from sqlmodel import select

from src.db.organization_config import OrganizationConfig
# Las tablas que lee la lista de alumnos: importadas para que el motor de
# pruebas las cree (create_all solo crea las que conoce).
import src.db.enrollment  # noqa: F401,E402
import src.db.student_progress  # noqa: F401,E402
from src.db.recordatorios import StudentReminder
from src.db.tareas import TareaEntrega, TareaSemana
from src.services.notifications import resumen_semanal as R
from src.services.users.emails import cuerpo_del_resumen, send_weekly_digest_email
from src.tests.services.test_tareas import _clase_con_semana

LUNES = date(2026, 11, 23)
# Lunes 23/11/2026 a las 08:30 de Países Bajos.
AHORA = datetime(2026, 11, 23, 7, 30, tzinfo=timezone.utc)

CLASE = {"curso": "Conversatieles", "palabra": "clase", "fecha": "2026-11-26", "hora": "19:00", "tema": "Mijn huis", "url": "https://e/c"}
FORMACION = R.formacion_de(
    {"total": 40, "hechas": 6, "pct": 15, "siguiente": {"modulo": "MODULE 1", "clase": "2.1 Samenvatting", "uuid": "a"}, "seguir_uuid": "a"},
    2,
    "https://e/f",
)


def _motivo(resumen, **k):
    base = dict(email="a@b.c", baja=False, enviado_esta_semana=False, alta="2026-10-01", ultima_entrada="2026-11-20", hoy=LUNES)
    return R.motivo_de_no(resumen, **{**base, **k})


# ── Lo puro ────────────────────────────────────────────────────────────────


def test_hora_y_palabra():
    assert R.hora_de("19:00 (CET)") == "19:00"
    assert R.hora_de("a las 9.30 h") == "09:30"
    assert R.hora_de("por la tarde") == ""
    assert R.palabra("Spreek Club") == "sesión"
    assert R.palabra("Conversatieles") == "clase"
    assert R.palabra("Masterclass") == "clase"


def test_cuando_cae():
    assert R.cuando_cae("2026-11-23", LUNES) == "hoy"
    assert R.cuando_cae("2026-11-24", LUNES) == "mañana"
    assert R.cuando_cae("2026-11-26", LUNES) == "el jueves 26 nov"


def test_la_semana_empieza_el_lunes_en_paises_bajos():
    # Domingo 22 a las 23:30 UTC ya es lunes 23 en Países Bajos (00:30).
    casi = datetime(2026, 11, 22, 23, 30, tzinfo=timezone.utc)
    assert R.inicio_de_semana_utc(casi) == "2026-11-22T23:00:00Z"
    assert R.inicio_de_semana_utc(AHORA) == "2026-11-22T23:00:00Z"
    assert R.proximo_lunes(LUNES) == LUNES
    assert R.proximo_lunes(date(2026, 11, 24)) == date(2026, 11, 30)


def test_la_formacion_dice_lo_que_toca_sin_renir():
    assert FORMACION["toca"] == {"modulo": "MODULE 1", "clase": "2.1 Samenvatting", "a_medias": False}
    assert "terminaste 2 clases" in FORMACION["texto"] and "Llevas 6 de 40" in FORMACION["texto"]
    assert "No pasa nada" in R.texto_formacion(0, 6, 40)
    assert "no has empezado" in R.texto_formacion(0, 0, 40)
    # La dejó a medias: el botón va a esa.
    f = R.formacion_de(
        {"total": 40, "hechas": 6, "siguiente": {"modulo": "M1", "clase": "2.1", "uuid": "a"},
         "donde": {"modulo": "M1", "clase": "2.3 Lezen", "uuid": "b", "como": "abrio"}, "seguir_uuid": "b"},
        0, "u",
    )
    assert f["toca"]["clase"] == "2.3 Lezen" and f["toca"]["a_medias"]
    # Terminó la formación (o no hay formación): esa parte no sale.
    assert R.formacion_de({"total": 40, "hechas": 40, "siguiente": None}, 0, "u") is None
    assert R.formacion_de({"total": 0, "hechas": 0, "siguiente": None}, 0, "u") is None


def test_solo_salen_las_partes_que_tienen_algo():
    r = R.armar("Lucía Pérez", clases=[CLASE], formacion=FORMACION)
    assert r["nombre"] == "Lucía" and r["partes"] == ["clase", "formación"]
    html = cuerpo_del_resumen(r, LUNES)
    assert "En directo esta semana" in html and "el jueves 26 nov a las 19:00" in html and "Tema: Mijn huis" in html
    assert "Tu formación" in html and "2.1 Samenvatting" in html and 'href="https://e/f"' in html
    assert "Tu tarea" not in html and "Lectura de la semana" not in html

    solo_tarea = R.armar("Ana", tareas=[{"tarea_id": 3, "tema": "Mijn dag", "hasta": "domingo 29 nov", "url": "https://e/t"}])
    html = cuerpo_del_resumen(solo_tarea, LUNES)
    assert "Te queda por entregar la tarea de «Mijn dag»" in html and "Tienes hasta el domingo 29 nov" in html
    assert "En directo" not in html and "Tu formación" not in html


def test_en_el_spreek_club_se_dice_sesion_y_lo_de_fuera_va_escapado():
    r = R.armar("Ana", clases=[{**CLASE, "curso": "Spreek Club <b>", "palabra": "sesión", "tema": "Eten & drinken"}])
    html = cuerpo_del_resumen(r, LUNES)
    assert "tienes sesión" in html and "Ver la sesión" in html
    assert "<b>" not in html and "Eten &amp; drinken" in html


def test_a_quien_no_se_le_manda():
    con_algo = R.armar("Ana", formacion=FORMACION)
    assert _motivo(con_algo) == ""
    assert _motivo(con_algo, baja=True) == "baja"
    assert _motivo(con_algo, enviado_esta_semana=True) == "enviado"
    assert _motivo(con_algo, email=" ") == "sin-correo"
    # Terminó su camino (más de 16 semanas) y lleva más de un mes sin entrar.
    assert _motivo(con_algo, alta="2026-06-01", ultima_entrada="2026-10-01") == "se-fue"
    assert _motivo(con_algo, alta="2026-06-01", ultima_entrada="") == "se-fue"
    # Terminó su camino pero sigue entrando: sí.
    assert _motivo(con_algo, alta="2026-06-01", ultima_entrada="2026-11-15") == ""
    # Nuevo que aún no ha entrado nunca: sí (es a quien más le sirve).
    assert _motivo(con_algo, alta="2026-11-20", ultima_entrada="") == ""
    # La lectura sola no basta.
    assert _motivo(R.armar("Ana", lectura={"titulo": "Sinterklaas", "url": "u"})) == "nada"
    assert _motivo(R.armar("Ana", clases=[CLASE])) == ""


def test_el_correo_lleva_su_enlace_de_baja_y_el_ejemplo_es_creible():
    r = send_weekly_digest_email("a@b.c", "Ana", resumen=R.armar("Ana", formacion=FORMACION), baja_url="https://e/baja", hoy=LUNES, preview=True)
    assert r["subject"] == "Tu semana en la escuela"
    assert "Hola Ana" in r["html"] and 'href="https://e/baja"' in r["html"] and "No quiero recibir este resumen" in r["html"]
    assert "Seguir donde lo dejé" in r["html"]
    # Sin resumen (el catálogo de correos): el de ejemplo, con todas sus partes.
    ej = send_weekly_digest_email("a@b.c", "Rida", preview=True)["html"]
    assert "Hola Rida" in ej and "En directo esta semana" in ej and "Lectura de la semana" in ej
    assert "No quiero recibir este resumen" not in ej  # sin enlace, no se promete


def test_el_enlace_de_baja_solo_vale_para_esa_persona_y_para_eso():
    from src.services.payments.enlace import firmar

    token = R.enlace_baja(7).rsplit("/", 1)[1]
    assert R.leer_token(token) == 7
    assert R.leer_token(token + "x") == 0
    assert R.leer_token(firmar({"u": 7, "t": "otra-cosa"}, R._secreto(), dias=1)) == 0


# ── Con la base de datos ───────────────────────────────────────────────────


async def _escuela(db, org):
    """Masterclass del grupo azul (Ana 7 y Luis 8; «Otra clase» 9 no la ve), con
    la sesión del jueves 26 y su tarea."""
    await _clase_con_semana(db, org)
    db.add(OrganizationConfig(org_id=org.id, config={"salas": {"mc": {"banner": {"schedule": "19:00 (CET)"}}}}))
    db.add(TareaSemana(id=1, org_id=org.id, course_uuid="mc", chapter_uuid="chapter_kleding", tema="De kleding",
                       fecha="2026-11-26", enunciado="Describe tu ropa"))
    # La de la semana pasada: Ana la entregó; Luis, no (y el plazo ya pasó).
    db.add(TareaSemana(id=2, org_id=org.id, course_uuid="mc", chapter_uuid="x", tema="Het weer", fecha="2026-11-19", enunciado="El tiempo"))
    db.add(TareaEntrega(tarea_id=2, user_id=7, estado="corregida", corregida_por="Luna", corregida_at="2026-11-22T10:00:00+00:00", vista_at=""))
    await db.commit()


async def test_cada_alumno_lleva_lo_suyo(db, org):
    await _escuela(db, org)
    por = {x["alumno"]["user_id"]: x for x in await R.reunir(org.id, db, AHORA)}
    ana, luis, otra = por[7], por[8], por[9]
    assert ana["motivo"] == "" and luis["motivo"] == ""
    c = ana["resumen"]["clases"][0]
    assert (c["curso"], c["fecha"], c["hora"], c["tema"], c["palabra"]) == ("Masterclass", "2026-11-26", "19:00", "De kleding", "clase")
    assert ana["resumen"]["corregidas"][0]["tema"] == "Het weer" and ana["resumen"]["corregidas"][0]["por"] == "Luna"
    # La tarea del jueves no ha abierto todavía y la pasada ya cerró: ninguna pendiente.
    assert ana["resumen"]["tareas"] == [] and luis["resumen"]["tareas"] == []
    assert luis["resumen"]["corregidas"] == []
    # Quien no ve la clase ni tiene formación: nada que contarle.
    assert otra["resumen"]["clases"] == [] and otra["motivo"] == "nada"

    # El viernes, la clase del jueves ya pasó (no sale) y su tarea está abierta.
    viernes = datetime(2026, 11, 27, 9, 0, tzinfo=timezone.utc)
    luis = {x["alumno"]["user_id"]: x for x in await R.reunir(org.id, db, viernes)}[8]
    assert luis["resumen"]["clases"] == []
    assert [t["tema"] for t in luis["resumen"]["tareas"]] == ["De kleding"]


async def test_apagado_no_manda_y_encendido_uno_por_semana(db, org, monkeypatch):
    await _escuela(db, org)
    mandados = []
    monkeypatch.setattr(R, "_mandar", lambda email, resumen, baja_url, hoy, preview=False: mandados.append((email, baja_url)))

    # Apagado de serie: solo dice a cuántos.
    r = await R.enviar_semana(org.id, db, AHORA)
    assert r == {"activo": False, "enviados": 0, "le_tocaria_a": 2, "quedan": 0} and mandados == []

    await R.guardar_ajuste(org.id, True, "Rida", db)
    r = await R.enviar_semana(org.id, db, AHORA)
    assert r["enviados"] == 2 and r["fallos"] == 0 and r["quedan"] == 0
    assert sorted(e for e, _ in mandados) == ["u7@example.com", "u8@example.com"]
    assert all("/resumen-semanal/baja/" in b for _, b in mandados)

    # La segunda vuelta del lunes (o lanzarla a mano el miércoles) no repite.
    r = await R.enviar_semana(org.id, db, AHORA)
    assert r["enviados"] == 0 and len(mandados) == 2
    r = await R.enviar_semana(org.id, db, datetime(2026, 11, 25, 9, 0, tzinfo=timezone.utc))
    assert r["enviados"] == 0
    # El lunes siguiente, otra vez (Ana sigue con su corrección sin ver).
    r = await R.enviar_semana(org.id, db, datetime(2026, 11, 30, 7, 30, tzinfo=timezone.utc))
    assert r["enviados"] == 1 and mandados[-1][0] == "u7@example.com"


async def test_si_el_envio_falla_se_reintenta_y_la_baja_se_respeta(db, org, monkeypatch):
    await _escuela(db, org)
    await R.guardar_ajuste(org.id, True, "Rida", db)

    def falla(email, resumen, baja_url, hoy, preview=False):
        raise RuntimeError("Resend no contesta")

    monkeypatch.setattr(R, "_mandar", falla)
    r = await R.enviar_semana(org.id, db, AHORA)
    assert r["enviados"] == 0 and r["fallos"] == 2
    # No queda marca: la segunda vuelta lo vuelve a intentar.
    assert (await db.execute(select(StudentReminder).where(StudentReminder.tipo == R.TIPO))).scalars().all() == []

    # Ana se da de baja desde su correo.
    await R.dar_de_baja(7, db)
    await R.dar_de_baja(7, db)  # dos veces no duplica
    assert await R.esta_de_baja(7, db)
    mandados = []
    monkeypatch.setattr(R, "_mandar", lambda email, *a, **k: mandados.append(email))
    r = await R.enviar_semana(org.id, db, AHORA)
    assert mandados == ["u8@example.com"]
    panel = await R.estado_panel(org.id, db, AHORA)
    assert [a["motivo"] for a in panel["no_les_toca"] if a["user_id"] == 7] == ["baja"]

    # La lista de Progreso lo dice y no lo cuenta como «le recordaste».
    from src.services.panel.alumnos import listar_alumnos

    por = {a["user_id"]: a for a in (await listar_alumnos(org.id, db))["alumnos"]}
    assert por[7]["resumen"]["baja"] and por[7]["ultimo_recordatorio"] is None
    assert por[8]["resumen"]["ultimo"] and por[8]["ultimo_recordatorio"] is None

    # Y puede volver.
    await R.volver_a_apuntar(7, db)
    assert not await R.esta_de_baja(7, db)
