"""
Las semanas de las clases en directo, sus tareas y el seguimiento. La
explicación entera está en `src/services/tareas/tareas.py`.

- Ver las semanas, abrir una tarea y entregarla: quien puede ver la clase (la
  misma comprobación que la página del curso, `salas._curso`).
- Escuchar una nota de voz: el alumno las suyas; el equipo, todas.
- Corregir, el seguimiento semanal y los check-in: el equipo (administradores,
  moderadores y profes, `STAFF_ROLE_IDS`).
- Crear, cambiar y borrar semanas: administradores.
"""

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.routers.salas import _curso, _roles
from src.security.auth import get_current_user
from src.security.rbac.resource_access import check_resource_access
from src.security.rbac.types import AccessAction, AccessContext
from src.services.tareas import tareas as T

router = APIRouter()


def _error(exc: T.TareaError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.mensaje)


def _nombre(user) -> str:
    nombre = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return nombre or getattr(user, "username", "") or "Equipo"


def _nombre_para_el_alumno(user) -> str:
    """Quién corrige, tal como lo lee el alumno: su nombre, nunca el usuario
    («admin»). Sin nombre en la cuenta, vacío y la pantalla dice «Corregida»."""
    return f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()


def _con_sesion(current_user) -> None:
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", 0):
        raise HTTPException(status_code=401, detail="Entra en la escuela para ver tus tareas")


async def _equipo(current_user, org_id: int, db_session: AsyncSession) -> bool:
    """El equipo (o 403). Devuelve si además es administrador."""
    _con_sesion(current_user)
    equipo, admin = await _roles(current_user, org_id, db_session)
    if not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo de la escuela")
    return admin


async def _admin(current_user, org_id: int, db_session: AsyncSession) -> None:
    if not await _equipo(current_user, org_id, db_session):
        raise HTTPException(status_code=403, detail="Solo los administradores")


async def _tarea_y_curso(request: Request, tarea_id: int, current_user, db_session: AsyncSession) -> tuple:
    try:
        t = await T.tarea(tarea_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    curso = await _curso(request, t.course_uuid, current_user, db_session)
    return t, curso


async def _leer_audio(audio: Optional[UploadFile]) -> Optional[tuple[str, bytes]]:
    if audio is None:
        return None
    datos = await audio.read(T.MAX_AUDIO_BYTES + 1)
    if not datos:
        return None
    return (audio.filename or "nota.webm", datos)


# ── El alumno ───────────────────────────────────────────────────────────────


@router.get("/course/{course_uuid}/semanas", summary="Las semanas de una clase en directo, con lo que ha hecho quien pregunta.")
async def api_semanas(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, admin = await _roles(current_user, curso.org_id, db_session)
    datos = await T.semanas_para_alumno(curso, current_user.id, db_session, equipo=equipo, con_archivo=True)
    hermanas = await T.hermanas_para_el_equipo(curso, db_session) if equipo else []
    return {**datos, "equipo": equipo, "admin": admin, "hermanas": hermanas}


@router.get("/course/{course_uuid}/mira-tambien", summary="Las grabaciones de la otra clase con el mismo nombre (el otro grupo).")
async def api_mira_tambien(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    equipo, _ = await _roles(current_user, curso.org_id, db_session)
    return await T.mira_tambien(curso, db_session, equipo=equipo)


@router.get("/course/{course_uuid}/mira-tambien/{activity_uuid}/video", summary="El vídeo subido de una grabación de la otra clase.")
async def api_mira_tambien_video(
    request: Request,
    course_uuid: str,
    activity_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    ruta = await T.archivo_de_hermana(curso, activity_uuid, db_session)
    if ruta is None:
        raise HTTPException(status_code=404, detail="No existe esa grabación")
    return FileResponse(ruta)


@router.get("/mi-semana", summary="«Tu semana» del Inicio: la semana en curso de cada clase que ve y las correcciones sin escuchar.")
async def api_mi_semana(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)

    async def puede_ver(course: Course) -> bool:
        if course.org_id != org_id:
            return False
        decision = await check_resource_access(
            request, db_session, current_user, course.course_uuid, AccessAction.READ,
            context=AccessContext.DASHBOARD, raise_on_deny=False,
        )
        return bool(decision.allowed)

    return await T.mi_semana(org_id, current_user.id, puede_ver, db_session)


@router.get("/tarea/{tarea_id}", summary="Una tarea y la entrega de quien pregunta.")
async def api_tarea(
    request: Request,
    tarea_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    t, curso = await _tarea_y_curso(request, tarea_id, current_user, db_session)
    equipo, admin = await _roles(current_user, curso.org_id, db_session)
    return {**await T.tarea_para(t, curso, current_user.id, db_session, equipo=equipo), "equipo": equipo, "admin": admin}


@router.post("/tarea/{tarea_id}/entrega", summary="Entrega (o cambia) la tarea: texto y/o nota de voz.")
async def api_entregar(
    request: Request,
    tarea_id: int,
    texto: str = Form(""),
    audio_seg: int = Form(0),
    quitar_audio: bool = Form(False),
    audio: Optional[UploadFile] = File(None),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    t, curso = await _tarea_y_curso(request, tarea_id, current_user, db_session)
    equipo, _admin_ok = await _roles(current_user, curso.org_id, db_session)
    try:
        return await T.entregar(
            t, current_user.id, texto, await _leer_audio(audio), audio_seg, quitar_audio, db_session, equipo=equipo
        )
    except T.TareaError as exc:
        raise _error(exc)


@router.post("/tarea/{tarea_id}/vista", summary="El alumno ha visto la corrección (apaga el aviso).")
async def api_vista(
    request: Request,
    tarea_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    t, _curso_ok = await _tarea_y_curso(request, tarea_id, current_user, db_session)
    return await T.marcar_vista(t, current_user.id, db_session)


@router.get("/audio/{entrega_id}/{cual}", summary="Una nota de voz de una entrega: la del alumno o la de la corrección.")
async def api_audio(
    entrega_id: int,
    cual: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    _con_sesion(current_user)
    try:
        e = await T.entrega(entrega_id, db_session)
        t = await T.tarea(e.tarea_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    if e.user_id != current_user.id:
        equipo, _admin_ok = await _roles(current_user, t.org_id, db_session)
        if not equipo:
            raise HTTPException(status_code=403, detail="Esa nota de voz no es tuya")
    encontrado = T.audio_de(e, "correccion" if cual == "correccion" else "alumno")
    if encontrado is None:
        raise HTTPException(status_code=404, detail="No hay nota de voz")
    ruta, mime = encontrado
    return FileResponse(ruta, media_type=mime, headers={"Cache-Control": "private, no-store"})


# ── Semanas (administradores) ───────────────────────────────────────────────


class SemanaIn(BaseModel):
    chapter_uuid: Optional[str] = None
    tema: Optional[str] = None
    fecha: Optional[str] = None
    enunciado: Optional[str] = None
    fecha_limite: Optional[str] = None
    # Las casillas «avisar en la campana» (05/11/2026).
    avisar_presentacion: Optional[bool] = None
    avisar_grabacion: Optional[bool] = None


@router.post("/course/{course_uuid}/semanas", summary="Convierte un capítulo de la clase en una semana con su tarea (equipo).")
async def api_crear_semana(
    request: Request,
    course_uuid: str,
    data: SemanaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    curso = await _curso(request, course_uuid, current_user, db_session)
    # Desde el 02/11/2026 también los profes: preparan sus semanas.
    await _equipo(current_user, curso.org_id, db_session)
    try:
        return await T.crear_semana(curso.org_id, curso, data.model_dump(exclude_unset=True), _nombre(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)


class ClaseNuevaIn(BaseModel):
    fecha: str
    tema: Optional[str] = ""
    profe: Optional[str] = ""
    repetir: Optional[int] = 1
    tambien: Optional[bool] = False


@router.post("/course/{course_uuid}/clase", summary="Crea una clase desde el calendario: día, quién la da y, si se quiere, el tema (equipo).")
async def api_clase_nueva(
    request: Request,
    course_uuid: str,
    data: ClaseNuevaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.security.rbac import AccessAction, check_resource_access
    from src.services.tareas import clase_nueva as CN

    curso = await _curso(request, course_uuid, current_user, db_session)
    admin = await _equipo(current_user, curso.org_id, db_session)
    # Lo mismo que pide crear un capítulo a mano: un monitor, solo en su Spreekclub.
    await check_resource_access(request, db_session, current_user, curso.course_uuid, AccessAction.CREATE)
    try:
        return await CN.crear_clases(curso, data.model_dump(), _nombre(current_user), admin, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.put("/semana/{semana_id}", summary="Cambia el tema, el día o la tarea de una semana (equipo).")
async def api_editar_semana(
    semana_id: int,
    data: SemanaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        # Los profes ajustan los deberes (02/11/2026).
        await _equipo(current_user, s.org_id, db_session)
        return await T.editar_semana(s, data.model_dump(exclude_unset=True, exclude={"chapter_uuid"}), db_session)
    except T.TareaError as exc:
        raise _error(exc)


# ── El material del profe (09/11/2026, material_profe.py) ──────────────────


class NotasProfeIn(BaseModel):
    notas: str = ""


class QuienProfeIn(BaseModel):
    profe: str = ""


class MensajeProfeIn(BaseModel):
    mensaje: str = ""


class EnlaceProfeIn(BaseModel):
    nombre: str = ""
    url: str


async def _semana_equipo(semana_id: int, current_user, db_session: AsyncSession):
    try:
        s = await T.tarea(semana_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    admin = await _equipo(current_user, s.org_id, db_session)
    return s, admin


# ── La misma semana en los dos grupos (10/11/2026, gemelas.py) ──────────────


async def _gemela(s, db_session: AsyncSession):
    """La semana gemela (la del otro grupo), su curso y su nombre con etiqueta."""
    from src.services.salas.salas import nombre_con_etiqueta
    from src.services.tareas import gemelas as G

    curso = await T.curso_de(s.course_uuid, db_session)
    if curso is None:
        return None, ""
    config = await T._config(curso.org_id, db_session)
    candidatas: list = []
    for h in await T.hermanas(curso, db_session, config):
        for o in await T.semanas_de(h.org_id, h.course_uuid, db_session):
            candidatas.append({"id": o.id, "tema": o.tema, "fecha": o.fecha, "fila": o, "curso": nombre_con_etiqueta(config, h.course_uuid, h.name)})
    elegida = G.elegir_gemela({"id": s.id, "tema": s.tema, "fecha": s.fecha}, candidatas)
    return (elegida["fila"], elegida["curso"]) if elegida else (None, "")


@router.get("/semana/{semana_id}/gemela", summary="La misma semana en la clase del otro grupo, si la hay (equipo).")
async def api_gemela(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    s, _admin_ok = await _semana_equipo(semana_id, current_user, db_session)
    g, curso = await _gemela(s, db_session)
    return {"gemela": {"id": g.id, "tema": g.tema, "fecha": g.fecha, "curso": curso} if g else None}


@router.post("/semana/{semana_id}/gemela/igualar", summary="Copia a la semana del otro grupo el tema, la tarea, las notas y la presentación completa (equipo).")
async def api_igualar_gemela(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import gemelas as G
    from src.services.tareas import material_profe as MP

    s, _admin_ok = await _semana_equipo(semana_id, current_user, db_session)
    g, curso = await _gemela(s, db_session)
    if g is None:
        raise HTTPException(status_code=404, detail="Esta semana no tiene gemela en la clase del otro grupo")
    cambios = G.igualar(s, g, MP._ahora())
    if cambios:
        db_session.add(g)
        await db_session.commit()
    return {"gemela": {"id": g.id, "tema": g.tema, "fecha": g.fecha, "curso": curso}, "cambios": cambios}


@router.put("/semana/{semana_id}/profe/notas", summary="Las notas para el profe de esa semana (equipo).")
async def api_notas_profe(
    semana_id: int,
    data: NotasProfeIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, _admin_ok = await _semana_equipo(semana_id, current_user, db_session)
    return await MP.guardar(s, MP.con_notas(MP.leer(s.material_profe), data.notas), db_session)


class DespuesIn(BaseModel):
    texto: str = ""


@router.put("/semana/{semana_id}/profe/despues", summary="Cómo fue la clase: dos líneas del profe después de darla (equipo).")
async def api_despues_profe(
    semana_id: int,
    data: DespuesIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, _ = await _semana_equipo(semana_id, current_user, db_session)
    return await MP.guardar(s, MP.con_despues(MP.leer(s.material_profe), data.texto, _nombre(current_user)), db_session)


@router.put("/semana/{semana_id}/profe/quien", summary="Quién da esa semana (solo administradores).")
async def api_quien_profe(
    semana_id: int,
    data: QuienProfeIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, admin = await _semana_equipo(semana_id, current_user, db_session)
    if not admin:
        raise HTTPException(status_code=403, detail="Solo un administrador decide quién da la clase")
    return await MP.guardar(s, MP.con_profe(MP.leer(s.material_profe), data.profe), db_session)


@router.put("/semana/{semana_id}/profe/mensaje", summary="El mensaje del administrador para el profe (solo administradores).")
async def api_mensaje_profe(
    semana_id: int,
    data: MensajeProfeIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, admin = await _semana_equipo(semana_id, current_user, db_session)
    if not admin:
        raise HTTPException(status_code=403, detail="Solo un administrador deja mensajes para el profe")
    return await MP.guardar(s, MP.con_mensaje(MP.leer(s.material_profe), data.mensaje, _nombre(current_user)), db_session)


@router.post("/semana/{semana_id}/profe/mensaje/leido", summary="El profe marca el mensaje como leído (equipo).")
async def api_mensaje_leido(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, _admin = await _semana_equipo(semana_id, current_user, db_session)
    try:
        m = MP.leido(MP.leer(s.material_profe), _nombre(current_user))
    except T.TareaError as exc:
        raise _error(exc)
    return await MP.guardar(s, m, db_session)


@router.post("/semana/{semana_id}/profe/enlace", summary="Añade un enlace al material del profe (equipo).")
async def api_enlace_profe(
    semana_id: int,
    data: EnlaceProfeIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, _admin_ok = await _semana_equipo(semana_id, current_user, db_session)
    try:
        m = MP.con_enlace(MP.leer(s.material_profe), data.nombre, data.url, _nombre(current_user))
    except T.TareaError as exc:
        raise _error(exc)
    return await MP.guardar(s, m, db_session)


@router.post("/semana/{semana_id}/profe/archivo", summary="Sube un archivo al material del profe (equipo).")
async def api_archivo_profe(
    semana_id: int,
    archivo: UploadFile = File(...),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, _admin_ok = await _semana_equipo(semana_id, current_user, db_session)
    datos = await archivo.read(MP.MAX_BYTES + 1)
    try:
        m = MP.leer(s.material_profe)
        if len(m["archivos"]) >= MP.MAX_ARCHIVOS:
            raise T.TareaError(f"Como mucho {MP.MAX_ARCHIVOS} cosas por semana")
        relativa, _ext = MP.guardar_archivo(s.org_id, archivo.filename or "archivo", datos)
        m = MP.con_archivo(m, archivo.filename or "archivo", relativa, len(datos), _nombre(current_user))
    except T.TareaError as exc:
        raise _error(exc)
    return await MP.guardar(s, m, db_session)


@router.delete("/semana/{semana_id}/profe/{archivo_id}", summary="Quita algo del material del profe (quien lo subió o un administrador).")
async def api_quitar_profe(
    semana_id: int,
    archivo_id: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from src.services.tareas import material_profe as MP

    s, admin = await _semana_equipo(semana_id, current_user, db_session)
    try:
        m, ruta = MP.sin(MP.leer(s.material_profe), archivo_id, _nombre(current_user), admin)
    except T.TareaError as exc:
        raise _error(exc)
    salida = await MP.guardar(s, m, db_session)
    # Una copia de la semana (clase duplicada) puede apuntar al mismo archivo.
    from sqlmodel import select
    from src.db.tareas import TareaSemana

    otras = (await db_session.execute(select(TareaSemana).where(TareaSemana.material_profe.contains(ruta or "~")))).scalars().all()  # type: ignore[attr-defined]
    if ruta and not otras:
        MP.borrar_del_disco(ruta)
    return salida


@router.get("/semana/{semana_id}/profe/{archivo_id}", summary="Baja un archivo del material del profe (equipo).")
async def api_bajar_profe(
    semana_id: int,
    archivo_id: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    from urllib.parse import quote

    from src.services.tareas import material_profe as MP

    s, _admin_ok = await _semana_equipo(semana_id, current_user, db_session)
    encontrado = MP.archivo(MP.leer(s.material_profe), archivo_id)
    if encontrado is None:
        raise HTTPException(status_code=404, detail="Ese archivo ya no está")
    ruta, mime, nombre = encontrado
    return FileResponse(
        ruta,
        media_type=mime,
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(nombre)}",
        },
    )


@router.delete("/semana/{semana_id}", summary="Deja de ser una semana: borra su tarea y las entregas (administradores).")
async def api_borrar_semana(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        await _admin(current_user, s.org_id, db_session)
        return await T.borrar_semana(s, db_session)
    except T.TareaError as exc:
        raise _error(exc)


# ── El equipo ───────────────────────────────────────────────────────────────


class AvisoIn(BaseModel):
    filtro: str = "todos"
    titulo: str = ""
    texto: str = ""
    campana: bool = True
    correo: bool = False
    prueba: bool = False


def _mandar_correos(destinos: list, correo: dict) -> None:
    """En segundo plano: un fallo no tumba nada."""
    import logging

    from src.services.users.emails import send_news_email

    enviados = 0
    for email, nombre in destinos:
        try:
            send_news_email(
                email=email, name=nombre or "", title=correo["titulo"], body_html=correo["html"],
                cta_label=correo["boton"], cta_url=correo["url"],
            )
            enviados += 1
        except Exception as exc:  # noqa: BLE001
            logging.getLogger(__name__).warning("Aviso de clase no enviado: %s", exc)
    logging.getLogger(__name__).info("Aviso de clase: %s de %s correos", enviados, len(destinos))


@router.get("/semana/{semana_id}/destinatarios", summary="A quién le llegaría un aviso con cada filtro, y los avisos ya mandados (equipo).")
async def api_destinatarios(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        await _equipo(current_user, s.org_id, db_session)
        return await T.destinatarios(s.org_id, s, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.post("/semana/{semana_id}/avisar", summary="Avisa a la clase (o a parte) por la campana y/o por correo (equipo).")
async def api_avisar(
    semana_id: int,
    data: AvisoIn,
    background: BackgroundTasks,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        await _equipo(current_user, s.org_id, db_session)
        r = await T.avisar_clase(s.org_id, s, data.model_dump(), _nombre(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)
    if r.get("prueba"):
        email = (getattr(current_user, "email", "") or "").strip()
        if not email:
            raise HTTPException(status_code=400, detail="Tu cuenta no tiene correo")
        _mandar_correos([(email, getattr(current_user, "first_name", "") or "")], r["correo"])
        return {"ok": True, "prueba": True, "a": email}
    if r.get("destinos"):
        background.add_task(_mandar_correos, r["destinos"], r["correo"])
    return {"ok": True, "alumnos": r["alumnos"], "campana": r["campana"], "correos": len(r.get("destinos") or [])}


class VoyIn(BaseModel):
    va: Optional[bool] = None


class ListaIn(BaseModel):
    # {user_id: true (vino) / false (no vino) / null (quitar la marca)}
    marcas: dict[str, Optional[bool]]


@router.put("/semana/{semana_id}/voy", summary="«¿Vienes a la clase?»: el alumno dice si va (o lo quita).")
async def api_voy(
    request: Request,
    semana_id: int,
    data: VoyIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    t, _curso_ok = await _tarea_y_curso(request, semana_id, current_user, db_session)
    try:
        return await T.confirmar_asistencia(t, current_user.id, data.va, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.get("/semana/{semana_id}/lista", summary="La lista de la clase de esa semana, para marcar quién vino (equipo).")
async def api_lista(
    semana_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        await _equipo(current_user, s.org_id, db_session)
        return await T.lista_de_clase(s.org_id, s, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.put("/semana/{semana_id}/lista", summary="Guarda quién vino a la clase (equipo).")
async def api_pasar_lista(
    semana_id: int,
    data: ListaIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    try:
        s = await T.tarea(semana_id, db_session)
        await _equipo(current_user, s.org_id, db_session)
        return await T.pasar_lista(s.org_id, s, data.marcas, _nombre_para_el_alumno(current_user) or _nombre(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/grupo", summary="«Tu grupo esta semana»: por dónde va, qué falla, sus consultas (equipo).")
async def api_grupo(
    org_id: int,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    from src.services.tareas.grupo import grupo_de_la_clase

    try:
        return await grupo_de_la_clase(org_id, course_uuid, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/resumen-clases", summary="Las clases lado a lado: la semana en curso de cada una (equipo).")
async def api_resumen_clases(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    return {"clases": await T.resumen_clases(org_id, db_session)}


@router.get("/org/{org_id}/clases", summary="Las clases en directo que pueden tener semanas (equipo).")
async def api_clases(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    admin = await _equipo(current_user, org_id, db_session)
    clases = await T.clases_en_directo(org_id, db_session)
    # Nawar (08/11/2026): un monitor solo tiene el Spreekclub.
    from src.services.equipo.monitores import es_clase_del_monitor, es_monitor

    monitor = await es_monitor(current_user.id, org_id, db_session)
    if monitor:
        clases = [c for c in clases if es_clase_del_monitor(c["nombre"])]
    return {"clases": clases, "admin": admin, "monitor": monitor}


@router.get("/org/{org_id}/seguimiento", summary="Seguimiento semanal de una clase: alumno a alumno (equipo).")
async def api_seguimiento(
    org_id: int,
    course_uuid: str,
    semana_id: Optional[int] = None,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.seguimiento(org_id, course_uuid, semana_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.get("/org/{org_id}/por-corregir", summary="Las tareas entregadas sin corregir (equipo).")
async def api_por_corregir(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    return {"entregas": await T.por_corregir(org_id, db_session)}


async def _entrega_del_equipo(entrega_id: int, current_user, db_session: AsyncSession):
    try:
        e = await T.entrega(entrega_id, db_session)
        t = await T.tarea(e.tarea_id, db_session)
    except T.TareaError as exc:
        raise _error(exc)
    await _equipo(current_user, t.org_id, db_session)
    return e


@router.get("/entrega/{entrega_id}", summary="Una entrega con su tarea, para corregirla (equipo).")
async def api_entrega(
    entrega_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    e = await _entrega_del_equipo(entrega_id, current_user, db_session)
    return await T.entrega_con_tarea(e, db_session)


@router.post("/entrega/{entrega_id}/correccion", summary="Corrige una entrega con texto y/o nota de voz (equipo).")
async def api_corregir(
    entrega_id: int,
    texto: str = Form(""),
    audio_seg: int = Form(0),
    audio: Optional[UploadFile] = File(None),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    e = await _entrega_del_equipo(entrega_id, current_user, db_session)
    try:
        return await T.corregir(e, texto, await _leer_audio(audio), audio_seg, current_user.id, _nombre_para_el_alumno(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)


@router.delete("/entrega/{entrega_id}/correccion", summary="Quita la corrección: vuelve a «por corregir» (equipo).")
async def api_reabrir(
    entrega_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    e = await _entrega_del_equipo(entrega_id, current_user, db_session)
    return await T.reabrir(e, db_session)


class CheckinIn(BaseModel):
    user_id: int
    hito: int
    nota: str = ""


@router.get("/org/{org_id}/checkins", summary="A quién le toca el check-in de las semanas 4, 8 y 12 (equipo).")
async def api_checkins(
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    return await T.checkins(org_id, db_session)


@router.post("/org/{org_id}/checkins", summary="Apunta un check-in hecho (equipo).")
async def api_checkin_hecho(
    org_id: int,
    data: CheckinIn,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    await _equipo(current_user, org_id, db_session)
    try:
        return await T.marcar_checkin(org_id, data.user_id, data.hito, data.nota, _nombre(current_user), db_session)
    except T.TareaError as exc:
        raise _error(exc)
