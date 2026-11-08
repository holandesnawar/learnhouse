"""Datos inventados para la escuela de PRUEBAS (rama `diseno`, 07/11/2026).

Para qué: la escuela de pruebas de Railway nace vacía (su propia base de
datos, sin nadie de verdad). Para ver el rediseño hace falta que tenga vida:
alumnos, dos grupos, la clase semanal con sus semanas (presentación,
ejercicios, tarea, grabación), la formación con avance, y la comunidad con
publicaciones. Todo lo que hay aquí es INVENTADO: nombres, correos
(@ejemplo.com, que no existe) y textos.

Cuándo se ejecuta: al arrancar la API, y SOLO si se cumplen las tres cosas:
  1. la variable `LEARNHOUSE_DATOS_DE_PRUEBA` vale «si» (se pone a mano en
     Railway, solo en el entorno de pruebas);
  2. la escuela tiene como mucho 3 usuarios (una escuela de verdad tiene
     decenas: así, aunque alguien pusiera la variable en producción, no hace
     nada);
  3. no se ha hecho antes (marca `datos_prueba` en la configuración).

No manda ningún correo, no llama a Stripe, a Calendly, a systeme.io ni a nada
de fuera. Solo escribe en la base de datos y deja unos PDF de ejemplo en el
volumen de la escuela.

La alumna de ejemplo es `marta@ejemplo.com`. Su contraseña sale de
`LEARNHOUSE_DATOS_DE_PRUEBA_CLAVE` (si no está, una al azar: entonces solo
se puede mirar como administrador).
"""

from __future__ import annotations

import json
import logging
import os
import random
import secrets
from datetime import date, datetime, timedelta
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)

FORMACION_UUID = "course_8a1d1fab-ffbb-44ef-8f21-04ef63676d6e"
CLASE_ROOD_UUID = "course_bfbcb42b-7dc3-4448-9df8-5d7b96135859"
CLASE_BLAUW_UUID = "course_7c2e5d10-4b8a-4f1e-9a3c-2d6b8e0f1a77"
VIDEO_EJEMPLO = "https://www.youtube.com/embed/aqz-KE-bpKQ"  # Big Buck Bunny (Blender): de relleno
PROFE = "Sanne"

ALUMNOS = [
    # (nombre, apellido, grupo)
    ("Marta", "Ruiz", "rood"),
    ("Luis", "Gómez", "rood"),
    ("Carla", "Méndez", "rood"),
    ("Andrés", "Torres", "rood"),
    ("Lucía", "Fernández", "rood"),
    ("Pablo", "Castro", "blauw"),
    ("Elena", "Ortiz", "blauw"),
    ("Raúl", "Vidal", "blauw"),
    ("Nuria", "Campos", "blauw"),
    ("Sofía", "Herrera", "blauw"),
]

# (módulo de courseData, nombre del capítulo, lecciones)
FORMACION = [
    ("over-jou", "MODULE 1 - Over jou", ["les-1-voorstellen", "les-2-voornaamwoorden", "les-3-werkwoorden"]),
    ("familie-vrienden", "MODULE 2 - Familie & vrienden", ["m2-les-1-familie", "m2-les-3-kalender"]),
    ("eten-en-drinken", "MODULE 3 - Eten en drinken", ["m3-les-1-eten-en-drinken"]),
]
PARTES = [("resumen", "Samenvatting"), ("flashcards", "Flashcards"), ("vocabulary", "Oefeningen"), ("lezen", "Lezen"), ("luisteren", "Luisteren")]

# Semanas de la clase: (desplazamiento en semanas desde esta, tema, módulo, lección)
SEMANAS = [
    (-3, "Over jou: presentarte", "over-jou", "les-1-voorstellen"),
    (-2, "De familie", "familie-vrienden", "m2-les-1-familie"),
    (-1, "Dagen en tijden", "familie-vrienden", "m2-les-3-kalender"),
    (0, "Eten en drinken", "eten-en-drinken", "m3-les-1-eten-en-drinken"),
    (1, "Boodschappen doen", "eten-en-drinken", "m3-les-1-eten-en-drinken"),
]
TAREAS = {
    "Over jou: presentarte": "Grábate 30 segundos presentándote: cómo te llamas, de dónde eres, dónde vives y qué haces.",
    "De familie": "Escribe 5 frases sobre tu familia (Ik heb een broer… Mijn moeder heet…).",
    "Dagen en tijden": "Cuenta tu semana: qué haces el lunes, el miércoles y el sábado, con la hora.",
    "Eten en drinken": "Pide en voz alta un café y algo de comer, como en una cafetería. Mándalo en una nota de voz.",
    "Boodschappen doen": "Escribe tu lista de la compra en neerlandés con 8 cosas y cuánto quieres de cada una.",
}
# Las grabaciones de antes de las semanas, en su capítulo del mes (como en la
# escuela de verdad): semanas 6, 5 y 4 antes de esta.
ARCHIVO = [(6, "Het weer"), (5, "Kleuren en kleding"), (4, "Getallen tot 100")]
_MESES = ("ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE")


def activado() -> bool:
    return (os.environ.get("LEARNHOUSE_DATOS_DE_PRUEBA") or "").strip().lower() in ("si", "sí", "1", "true", "yes")


def _ahora(d: Optional[datetime] = None) -> str:
    return str(d or datetime.now())


def doc(*parrafos: str) -> str:
    """Texto en el formato del editor (ProseMirror), un párrafo por cadena."""
    return json.dumps(
        {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": p}]} for p in parrafos if p]},
        ensure_ascii=False,
    )


def _pdf_texto(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def pdf_presentacion(tema: str, puntos: list[str]) -> bytes:
    """Un PDF sencillo de tres diapositivas, apaisado, con la franja azul de
    la marca. Hecho a mano para no añadir dependencias."""
    paginas = [
        (tema, ["Clase semanal · Holandés Nawar", "Presentación de ejemplo (escuela de pruebas)"]),
        ("Lo que vamos a ver", puntos),
        ("Para practicar después", ["Ejercicios de la semana en Mis clases", "Tarea: en la página de la semana", "Dudas: en Consultas o en la comunidad"]),
    ]
    objetos: list[bytes] = []

    def add(b: str | bytes) -> int:
        objetos.append(b.encode("latin-1", "replace") if isinstance(b, str) else b)
        return len(objetos)

    add("<< /Type /Catalog /Pages 2 0 R >>")
    add("")  # páginas, se rellena luego
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    kids = []
    for titulo, lineas in paginas:
        cuerpo = ["0.114 0 0.518 rg 0 470 842 125 re f", "BT /F1 34 Tf 1 1 1 rg 60 515 Td (" + _pdf_texto(titulo) + ") Tj ET"]
        y = 400
        for ln in lineas:
            cuerpo.append("BT /F2 22 Tf 0.04 0.09 0.34 rg 70 %d Td (- %s) Tj ET" % (y, _pdf_texto(ln)))
            y -= 50
        flujo = "\n".join(cuerpo).encode("latin-1", "replace")
        c = add(b"<< /Length %d >>\nstream\n" % len(flujo) + flujo + b"\nendstream")
        kids.append(add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>" % c))
    objetos[1] = ("<< /Type /Pages /Kids [%s] /Count %d >>" % (" ".join(f"{k} 0 R" for k in kids), len(kids))).encode()
    out = bytearray(b"%PDF-1.4\n")
    pos = []
    for i, o in enumerate(objetos, 1):
        pos.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1)
    for p in pos:
        out += b"%010d 00000 n \n" % p
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objetos) + 1, xref)
    return bytes(out)


def _lunes(d: date) -> date:
    return d - timedelta(days=d.weekday())


async def sembrar(db: AsyncSession) -> str:
    """Crea los datos. Devuelve qué ha hecho (para el registro)."""
    from src.db.communities.communities import Community
    from src.db.communities.discussion_comments import DiscussionComment
    from src.db.communities.discussion_votes import DiscussionVote
    from src.db.communities.discussions import Discussion
    from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
    from src.db.courses.chapter_activities import ChapterActivity
    from src.db.courses.chapters import Chapter
    from src.db.courses.course_chapters import CourseChapter
    from src.db.courses.courses import Course
    from src.db.organization_config import OrganizationConfig
    from src.db.organizations import Organization
    from src.db.student_progress import StudentProgress
    from src.db.tareas import TareaEntrega, TareaSemana
    from src.db.trail_runs import TrailRun
    from src.db.trail_steps import TrailStep
    from src.db.trails import Trail
    from src.db.user_organizations import UserOrganization
    from src.db.usergroup_resources import UserGroupResource
    from src.db.usergroup_user import UserGroupUser
    from src.db.usergroups import UserGroup
    from src.db.users import User
    from src.security.security import security_hash_password

    org = (await db.execute(select(Organization))).scalars().first()
    if org is None:
        return "sin escuela"
    fila = (await db.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org.id))).scalars().first()
    config = json.loads(json.dumps((fila.config if fila else None) or {}))
    if config.get("datos_prueba"):
        # Lo que se añadió después: las carpetas de Recursos (07/11) y la
        # escuela en español (08/11; sin eso salía «Course Lessons»).
        hecho = []
        if not (config.get("datos_prueba") or {}).get("recursos"):
            await _recursos(db, int(org.id or 0))
            config["datos_prueba"] = {**config["datos_prueba"], "recursos": True}
            hecho.append("las carpetas de Recursos")
        if _en_espanol(config):
            hecho.append("el idioma español")
        if not hecho:
            return "ya estaban"
        fila.config = config
        fila.update_date = _ahora()
        db.add(fila)
        await db.commit()
        return "añadido: " + ", ".join(hecho)
    n_usuarios = (await db.execute(select(func.count()).select_from(UserOrganization).where(UserOrganization.org_id == org.id))).scalar() or 0
    if n_usuarios > 3:
        return f"la escuela ya tiene {n_usuarios} usuarios: no se toca"

    rnd = random.Random(7)
    hoy = date.today()
    ahora = datetime.now()
    org_id = int(org.id or 0)
    clave = (os.environ.get("LEARNHOUSE_DATOS_DE_PRUEBA_CLAVE") or "").strip() or secrets.token_urlsafe(18)

    # ── Personas ─────────────────────────────────────────────────────────
    async def persona(nombre: str, apellido: str, rol: int, alta: datetime) -> User:
        usuario = f"{nombre}.{apellido.split()[0]}".lower()
        for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u")):
            usuario = usuario.replace(a, b)
        u = User(
            username=usuario,
            first_name=nombre,
            last_name=apellido,
            email="marta@ejemplo.com" if nombre == "Marta" else f"{usuario}@ejemplo.com",
            password=security_hash_password(clave if nombre == "Marta" else secrets.token_urlsafe(18)),
            user_uuid=f"user_{uuid4()}",
            email_verified=True,
            creation_date=_ahora(alta),
            update_date=_ahora(alta),
        )
        db.add(u)
        await db.flush()
        db.add(UserOrganization(user_id=u.id, org_id=org_id, role_id=rol, creation_date=_ahora(alta), update_date=_ahora(alta)))
        return u

    profe = await persona(PROFE, "de Vries", 5, ahora - timedelta(days=90))
    alumnos: list[tuple[User, str]] = []
    for i, (n, a, g) in enumerate(ALUMNOS):
        alta = ahora - timedelta(days=36 - i * 2)
        alumnos.append((await persona(n, a, 4, alta), g))
    marta = alumnos[0][0]

    grupos: dict[str, UserGroup] = {}
    for clave_g, nombre in (("rood", "Groep rood"), ("blauw", "Groep blauw"), ("programa", "Programa nuevo")):
        g = UserGroup(name=nombre, description="Grupo de ejemplo", org_id=org_id, usergroup_uuid=f"usergroup_{uuid4()}", creation_date=_ahora(), update_date=_ahora())
        db.add(g)
        await db.flush()
        grupos[clave_g] = g
    for u, g in alumnos:
        for clave_g in (g, "programa"):
            db.add(UserGroupUser(usergroup_id=grupos[clave_g].id, user_id=u.id, org_id=org_id, creation_date=_ahora(), update_date=_ahora()))

    # ── Cursos ───────────────────────────────────────────────────────────
    async def curso(uuid: str, nombre: str, descripcion: str, publico: bool) -> Course:
        c = Course(name=nombre, description=descripcion, about=descripcion, public=publico, published=True, open_to_contributors=False,
                   org_id=org_id, course_uuid=uuid, creation_date=_ahora(), update_date=_ahora())
        db.add(c)
        await db.flush()
        return c

    async def capitulo(c: Course, nombre: str, orden: int) -> Chapter:
        ch = Chapter(name=nombre, description="", org_id=org_id, course_id=c.id, chapter_uuid=f"chapter_{uuid4()}", creation_date=_ahora(), update_date=_ahora())
        db.add(ch)
        await db.flush()
        db.add(CourseChapter(order=orden, course_id=c.id, chapter_id=ch.id, org_id=org_id, creation_date=_ahora(), update_date=_ahora()))
        return ch

    async def actividad(c: Course, ch: Chapter, orden: int, nombre: str, tipo, subtipo, contenido: dict, cuando: Optional[datetime] = None) -> Activity:
        au = f"activity_{uuid4()}"
        act = Activity(name=nombre, activity_type=tipo, activity_sub_type=subtipo, content={**contenido, "activity_uuid": au} if tipo == ActivityTypeEnum.TYPE_DOCUMENT else contenido,
                       published=True, org_id=org_id, course_id=c.id, activity_uuid=au, creation_date=_ahora(cuando), update_date=_ahora(cuando))
        db.add(act)
        await db.flush()
        db.add(ChapterActivity(order=orden, chapter_id=ch.id, activity_id=act.id, course_id=c.id, org_id=org_id, creation_date=_ahora(), update_date=_ahora()))
        return act

    def embed(url: str) -> dict:
        return {"embed_url": url}

    DYN, EMB = ActivityTypeEnum.TYPE_DYNAMIC, ActivitySubTypeEnum.SUBTYPE_DYNAMIC_EMBED

    formacion = await curso(FORMACION_UUID, "Formación Nawar A0-A1", "De cero al A1 de neerlandés en 16 semanas, explicado en español.", False)
    acts_formacion: list[Activity] = []
    for i, (modulo, nombre_cap, lecciones) in enumerate(FORMACION):
        ch = await capitulo(formacion, nombre_cap, i)
        orden = 0
        for li, leccion in enumerate(lecciones, 1):
            for parte, nombre_parte in PARTES:
                acts_formacion.append(await actividad(formacion, ch, orden, f"{li}.{PARTES.index((parte, nombre_parte)) + 1} {nombre_parte}", DYN, EMB, embed(f"nawar:{modulo}/{leccion}/{parte}")))
                orden += 1
    db.add(UserGroupResource(usergroup_id=grupos["programa"].id, resource_uuid=FORMACION_UUID, org_id=org_id, creation_date=_ahora(), update_date=_ahora()))

    # Las dos clases semanales (mismo nombre: son hermanas, con «Mira también»)
    carpeta = os.path.join("content", "orgs", org.org_uuid, "courses")
    clases = []
    for uuid, grupo, dia_semana, etiqueta in ((CLASE_ROOD_UUID, "rood", 1, "Groep rood"), (CLASE_BLAUW_UUID, "blauw", 3, "Groep blauw")):
        c = await curso(uuid, "Clase semanal", "La clase en directo de cada semana, con su presentación, ejercicios y tarea.", False)
        db.add(UserGroupResource(usergroup_id=grupos[grupo].id, resource_uuid=uuid, org_id=org_id, creation_date=_ahora(), update_date=_ahora()))
        clases.append((c, grupo, dia_semana, etiqueta))

    semanas_creadas: list[tuple[TareaSemana, str, date]] = []
    for c, grupo, dia_semana, etiqueta in clases:
        orden_cap = 0
        # El archivo de antes, por meses, con el día en el nombre de la grabación
        meses: dict[str, Chapter] = {}
        for k, (atras, tema) in enumerate(ARCHIVO):
            d = _lunes(hoy) - timedelta(weeks=atras) + timedelta(days=dia_semana)
            nombre_mes = f"{_MESES[d.month - 1]} - {d.year}"
            if nombre_mes not in meses:
                meses[nombre_mes] = await capitulo(c, nombre_mes, orden_cap)
                orden_cap += 1
            await actividad(c, meses[nombre_mes], k, f"{d.strftime('%d-%m')} {tema} | {PROFE} de Vries", DYN, EMB, embed(VIDEO_EJEMPLO), datetime.combine(d, datetime.min.time()))
        for desp, tema, modulo, leccion in SEMANAS:
            dia_clase = _lunes(hoy) + timedelta(weeks=desp, days=dia_semana)
            ch = await capitulo(c, tema, orden_cap)
            orden_cap += 1
            orden = 0
            pres = await actividad(c, ch, orden, "Presentación", ActivityTypeEnum.TYPE_DOCUMENT, ActivitySubTypeEnum.SUBTYPE_DOCUMENT_PDF,
                                   {"filename": "documentpdf_presentacion.pdf"}, datetime.combine(dia_clase - timedelta(days=3), datetime.min.time()))
            orden += 1
            try:
                destino = os.path.join(carpeta, c.course_uuid, "activities", pres.activity_uuid, "documentpdf")
                os.makedirs(destino, exist_ok=True)
                with open(os.path.join(destino, "documentpdf_presentacion.pdf"), "wb") as f:
                    f.write(pdf_presentacion(tema, ["Vocabulario del tema", "Frases para el día a día", "Práctica en parejas"]))
            except OSError as e:  # sin volumen: la clase sale igual, sin el PDF
                logger.warning("Datos de prueba: no se pudo escribir el PDF (%s)", e)
            for parte, nombre_parte in (("flashcards", "Flashcards"), ("vocabulary", "Oefeningen")):
                await actividad(c, ch, orden, nombre_parte, DYN, EMB, embed(f"nawar:{modulo}/{leccion}/{parte}"))
                orden += 1
            if dia_clase < hoy:
                await actividad(c, ch, orden, f"Grabación · {tema}", DYN, EMB, embed(VIDEO_EJEMPLO), datetime.combine(dia_clase + timedelta(days=1), datetime.min.time()))
            s = TareaSemana(
                org_id=org_id, course_uuid=c.course_uuid.replace("course_", "", 1), chapter_uuid=ch.chapter_uuid, tema=tema,
                fecha=dia_clase.isoformat(), enunciado=TAREAS.get(tema, ""), fecha_limite="", creada_por=f"{PROFE} de Vries",
                created_at=_ahora(), updated_at=_ahora(), aviso_presentacion="si", aviso_grabacion="si",
            )
            de_grupo = [u for u, g in alumnos if g == grupo]
            if dia_clase < hoy:
                s.asistencia = json.dumps({str(u.id): {"fue": rnd.random() > 0.25, "por": PROFE, "at": _ahora()} for u in de_grupo})
            elif desp == 0:
                s.confirmaciones = json.dumps({str(u.id): {"va": rnd.random() > 0.3, "at": _ahora()} for u in de_grupo[1:]})
            db.add(s)
            await db.flush()
            semanas_creadas.append((s, grupo, dia_clase))

    # Entregas de la tarea
    for s, grupo, dia_clase in semanas_creadas:
        if dia_clase >= hoy:
            continue
        for u, g in alumnos:
            if g != grupo:
                continue
            semanas_atras = (hoy - dia_clase).days // 7
            if u.id == marta.id:
                estado = "corregida" if semanas_atras >= 2 else "entregada"
            else:
                estado = rnd.choice(["corregida", "corregida", "entregada", None])
            if estado is None:
                continue
            e = TareaEntrega(tarea_id=s.id, user_id=u.id, texto="Hallo! Ik heet " + u.first_name + ". Ik kom uit Spanje en ik woon in Utrecht.",
                             entregada_at=_ahora(datetime.combine(dia_clase + timedelta(days=2), datetime.min.time())), actualizada_at=_ahora(), estado=estado)
            if estado == "corregida":
                e.correccion_texto = "¡Muy bien! Ojo con el orden: «In Utrecht woon ik» o «Ik woon in Utrecht». La pronunciación de «ui» en «uit» va mejorando."
                e.corregida_por_id = profe.id or 0
                e.corregida_por = f"{PROFE} de Vries"
                e.corregida_at = _ahora(datetime.combine(dia_clase + timedelta(days=4), datetime.min.time()))
                if u.id == marta.id and semanas_atras >= 3:
                    e.vista_at = _ahora()
            db.add(e)

    # ── Avance en la formación ───────────────────────────────────────────
    for idx, (u, _) in enumerate(alumnos):
        hechas = acts_formacion[: max(3, 22 - idx * 2 + rnd.randint(-3, 3))]
        trail = Trail(org_id=org_id, user_id=u.id, trail_uuid=f"trail_{uuid4()}", creation_date=_ahora(), update_date=_ahora())
        db.add(trail)
        await db.flush()
        run = TrailRun(trail_id=trail.id, course_id=formacion.id, org_id=org_id, user_id=u.id, creation_date=_ahora(), update_date=_ahora())
        db.add(run)
        await db.flush()
        for k, a in enumerate(hechas):
            cuando = _ahora(ahora - timedelta(days=max(0, len(hechas) - k) // 2, hours=rnd.randint(0, 8)))
            db.add(TrailStep(complete=True, teacher_verified=False, grade="", data={}, trailrun_id=run.id, trail_id=trail.id, activity_id=a.id,
                             course_id=formacion.id, org_id=org_id, user_id=u.id, creation_date=cuando, update_date=cuando))
        sig = acts_formacion[min(len(hechas), len(acts_formacion) - 1)]
        db.add(StudentProgress(user_id=u.id, last_visit_date=(hoy - timedelta(days=idx % 4)).isoformat(), current_streak=max(1, 6 - idx), longest_streak=9,
                               current_position={"course_uuid": FORMACION_UUID.replace("course_", "", 1), "activity_uuid": sig.activity_uuid.replace("activity_", "", 1)},
                               onboarding_state={"welcomed": True, "collapsed": True}, creation_date=_ahora(), update_date=_ahora()))

    # ── Comunidad ────────────────────────────────────────────────────────
    async def canal(nombre: str, descripcion: str, tipo: str) -> Community:
        cm = Community(name=nombre, description=descripcion, public=True, kind=tipo, org_id=org_id, community_uuid=f"community_{uuid4()}",
                       moderation_words=[], creation_date=_ahora(), update_date=_ahora())
        db.add(cm)
        await db.flush()
        return cm

    bienvenida = await canal("📌 Lo esencial", "Lo primero que tienes que saber de la escuela", "posts")
    presentate = await canal("👋 Preséntate", "Cuéntanos quién eres y dónde vives", "posts")
    noticias = await canal("📢 Noticias", "Novedades de la escuela", "posts")
    victorias = await canal("🏆 Victorias", "Tus logros, por pequeños que sean", "posts")
    general = await canal("💬 General", "Charla de todo", "chat")
    dudas = await canal("❓ Dudas de neerlandés", "Pregunta lo que no entiendas", "chat")

    todos = [profe] + [u for u, _ in alumnos]

    async def publicar(cm: Community, autor: User, titulo: str, texto: list[str], horas: float, likes: int = 0, fijado: bool = False, comentarios: list[tuple[User, str]] = ()):
        cuando = _ahora(ahora - timedelta(hours=horas))
        d = Discussion(title=titulo, content=doc(*texto), label="general", community_id=cm.id, org_id=org_id, author_id=autor.id,
                       discussion_uuid=f"discussion_{uuid4()}", upvote_count=likes, is_pinned=fijado, creation_date=cuando, update_date=cuando)
        db.add(d)
        await db.flush()
        for votante in todos[:likes]:
            db.add(DiscussionVote(discussion_id=d.id, user_id=votante.id, vote_uuid=f"vote_{uuid4()}", creation_date=cuando))
        for j, (quien, txt) in enumerate(comentarios):
            cc = _ahora(ahora - timedelta(hours=max(0.1, horas - 1 - j)))
            db.add(DiscussionComment(content=doc(txt), discussion_id=d.id, author_id=quien.id, comment_uuid=f"comment_{uuid4()}", creation_date=cc, update_date=cc))

    a = {u.first_name: u for u, _ in alumnos}
    await publicar(bienvenida, profe, "Bienvenida a la escuela", [
        "¡Hola y bienvenido! Aquí tienes todo lo que necesitas para empezar con buen pie.",
        "1. Preséntate en el canal Preséntate. 2. Entra en Mis clases y mira tu clase de esta semana. 3. Empieza el módulo 1 de la formación: 20 minutos al día bastan.",
        "Si te pierdes, escríbenos en Mensajes. Estamos para ayudarte.",
    ], 24 * 30, likes=9, fijado=True)
    await publicar(bienvenida, profe, "Cómo funciona una semana", [
        "Antes de la clase: mira la presentación. En la clase: hablamos y practicamos. Después: ejercicios y una tarea corta que te corregimos.",
        "Todo está en Mis clases → Esta semana.",
    ], 24 * 29, likes=6)
    await publicar(presentate, a["Luis"], "Hola, soy Luis 👋", ["Vivo en Utrecht desde hace 6 meses, trabajo en logística y quiero poder hablar con mis compañeros sin pasar al inglés."], 50, likes=5,
                   comentarios=[(profe, "Welkom, Luis! Verás que en pocas semanas ya te defiendes en el trabajo."), (a["Carla"], "¡Yo también estoy en Utrecht! 🙌")])
    await publicar(presentate, a["Elena"], "Elena, desde Rotterdam", ["Soy enfermera y necesito el neerlandés para homologar mi título. ¡Muchas ganas de empezar!"], 30, likes=7,
                   comentarios=[(a["Raúl"], "¡Mucho ánimo, Elena! Yo estoy en Den Haag.")])
    await publicar(presentate, a["Pablo"], "Hola a todos", ["Me llamo Pablo, vivo en Eindhoven con mi pareja holandesa y mis suegros solo hablan neerlandés 😅"], 12, likes=4)
    await publicar(noticias, profe, "Esta semana: «Eten en drinken»", ["La presentación ya está en Mis clases → Esta semana. Mírala antes de la clase y trae una pregunta."], 20, likes=3, fijado=True)
    await publicar(noticias, profe, "Nuevo: confirma si vienes a la clase", ["En la tarjeta de la clase tienes «Voy» o «No puedo». Así preparamos los grupos de práctica."], 70, likes=5)
    await publicar(victorias, a["Marta"], "Hoy pedí cita en el huisarts yo sola", ["Llevo 3 años en Holanda y siempre llamaba mi pareja. Hoy lo hice yo, con las frases del módulo 2. ¡Me entendió a la primera!"], 5, likes=8,
                   comentarios=[(profe, "¡Enorme, Marta! Esto es exactamente para lo que estamos aquí 💪"), (a["Lucía"], "¡Qué bien! A mí todavía me da miedo llamar por teléfono.")])
    await publicar(victorias, a["Andrés"], "Primera conversación en el supermercado", ["«Mag ik een tasje?» y me contestó en neerlandés, no en inglés 😅"], 28, likes=6)
    await publicar(victorias, a["Nuria"], "Entendí la carta del ayuntamiento", ["Sin traductor. Era sobre la recogida de basura, pero cuenta 😂"], 75, likes=5,
                   comentarios=[(a["Sofía"], "¡Claro que cuenta!")])

    async def chat(cm: Community, mensajes: list[tuple[User, str, float]]):
        for autor, txt, horas in mensajes:
            cuando = _ahora(ahora - timedelta(hours=horas))
            db.add(Discussion(title="", content=doc(txt), label="general", community_id=cm.id, org_id=org_id, author_id=autor.id,
                              discussion_uuid=f"discussion_{uuid4()}", creation_date=cuando, update_date=cuando))

    await chat(general, [(a["Luis"], "¿Alguien sabe dónde está la presentación de esta semana?", 3.2), (a["Carla"], "En Mis clases → Esta semana, arriba del todo 🙂", 3.1),
                         (a["Luis"], "¡Gracias! Ya la tengo", 3.0), (a["Raúl"], "¿Quedamos un día para practicar en Den Haag?", 1.5), (a["Elena"], "¡Yo me apunto!", 1.2)])
    await chat(dudas, [(a["Sofía"], "¿Cuándo se dice «het» y cuándo «de»?", 26), (profe, "Buena pregunta: la mayoría son «de». Los diminutivos (-je) siempre «het». Lo vemos en el módulo 2, lección 4.", 25),
                       (a["Pablo"], "¿«Ik ben 30 jaar» o «Ik heb 30 jaar»?", 6), (profe, "«Ik ben dertig jaar». En neerlandés la edad va con «zijn», no con «hebben».", 5.5)])

    # ── Configuración: salas, eventos y la marca ─────────────────────────
    salas = config.get("salas") if isinstance(config.get("salas"), dict) else {}
    for c, grupo, dia_semana, etiqueta in clases:
        salas[c.course_uuid.replace("course_", "", 1)] = {
            "directo": True, "activo": False, "grabadas": True, "etiqueta": etiqueta,
            "banner": {"next_weekday": str(dia_semana + 1), "schedule": "19:00", "teacher": f"{PROFE} de Vries", "duration": "60 min",
                       "subtitle": "", "live_url": "", "next_day": "", "next_date": ""},
        }
    config["salas"] = salas
    custom = config.get("customization") if isinstance(config.get("customization"), dict) else {}
    eventos = [
        {"id": "ev-prueba-1", "title": "Spreekclub: practica hablando", "date": (hoy + timedelta(days=2)).isoformat(), "time": "18:00", "description": "Media hora de conversación en grupos pequeños."},
        {"id": "ev-prueba-2", "title": "Masterclass: el orden de la frase", "date": (hoy + timedelta(days=5)).isoformat(), "time": "19:30", "description": "Por qué el verbo va segundo."},
        {"id": "ev-prueba-3", "title": "Café en neerlandés (Utrecht)", "date": (hoy + timedelta(days=9)).isoformat(), "time": "11:00", "description": "Quedada de alumnos."},
    ]
    custom["events"] = {"events": eventos}
    config["customization"] = custom
    _en_espanol(config)
    await _recursos(db, org_id)
    config["datos_prueba"] = {"creados": _ahora(), "alumna": "marta@ejemplo.com", "recursos": True}
    if fila is None:
        fila = OrganizationConfig(org_id=org_id, config=config, creation_date=_ahora(), update_date=_ahora())
    else:
        fila.config = config
        fila.update_date = _ahora()
    db.add(fila)
    await db.commit()
    return f"creados {len(alumnos)} alumnos, 2 clases con {len(SEMANAS)} semanas, la formación y 6 canales"


RECURSOS = [
    ("Para la clase en directo", "Lo que necesitas para entrar y seguir la clase.", [
        ("Cómo entrar a la sala desde el móvil", "https://www.holandesnawar.com"),
        ("Normas de la clase", "https://www.holandesnawar.com"),
    ]),
    ("Diccionarios y traductores", "Los que usamos en la escuela.", [
        ("Van Dale (diccionario)", "https://www.vandale.nl"),
        ("Woordenlijst (cómo se escribe)", "https://woordenlijst.org"),
        ("Forvo (cómo se pronuncia)", "https://forvo.com/languages/nl/"),
    ]),
    ("Vivir en Países Bajos", "Trámites y exámenes.", [
        ("Inburgering: lo que tienes que saber", "https://www.inburgeren.nl"),
        ("DUO: exámenes de neerlandés", "https://www.duo.nl"),
    ]),
]


def _en_espanol(config: dict) -> bool:
    """La escuela de pruebas en español, como la de verdad. True si lo cambia."""
    custom = config.get("customization") if isinstance(config.get("customization"), dict) else {}
    general = custom.get("general") if isinstance(custom.get("general"), dict) else {}
    if general.get("default_language") == "es":
        return False
    general["default_language"] = "es"
    custom["general"] = general
    config["customization"] = custom
    return True


async def _recursos(db: AsyncSession, org_id: int) -> None:
    from src.db.recursos import ResourceFolder, ResourceItem

    for i, (nombre, descripcion, items) in enumerate(RECURSOS):
        f = ResourceFolder(org_id=org_id, name=nombre, description=descripcion, position=i, created_at=_ahora(), private=False, grupos="")
        db.add(f)
        await db.flush()
        for j, (titulo, url) in enumerate(items):
            db.add(ResourceItem(org_id=org_id, folder_id=f.id, kind="link", title=titulo, url=url, file_name="", size=0, position=j, created_at=_ahora()))


async def sembrar_si_toca() -> None:
    """Lo llama el arranque. Nunca rompe el arranque: cualquier fallo se
    queda en el registro."""
    if not activado():
        return
    try:
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from config.config import get_learnhouse_config

        url = str(get_learnhouse_config().database_config.sql_connection_string)  # type: ignore
        url = url.replace("postgresql+psycopg2://", "postgresql+asyncpg://").replace("postgresql://", "postgresql+asyncpg://")
        motor = create_async_engine(url, echo=False, pool_pre_ping=True)
        try:
            async with async_sessionmaker(motor, class_=AsyncSession, expire_on_commit=False)() as db:
                logger.warning("Datos de prueba: %s", await sembrar(db))
        finally:
            await motor.dispose()
    except Exception as e:  # noqa: BLE001
        logger.warning("Datos de prueba: no se pudieron crear (%s)", e)
