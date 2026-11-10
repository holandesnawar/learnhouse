"""Reseñas en vídeo (10/11/2026), contra una base de datos de verdad (SQLite en
memoria) y con los vídeos en una carpeta temporal."""

import pytest
from sqlmodel import select

from src.db.resenas import Resena
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.resenas import resenas as R

MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200
MOV = b"\x00\x00\x00\x14ftypqt  " + b"\x00" * 200
WEBM = b"\x1a\x45\xdf\xa3" + b"\x01" * 200


class Archivo:
    """Lo que da FastAPI: algo que se lee a trozos."""

    def __init__(self, datos: bytes, content_type: str = "", filename: str = "blob"):
        self.datos, self.content_type, self.filename, self.pos = datos, content_type, filename, 0

    async def read(self, n: int = -1) -> bytes:
        trozo = self.datos[self.pos :] if n < 0 else self.datos[self.pos : self.pos + n]
        self.pos += len(trozo)
        return trozo


@pytest.fixture(autouse=True)
def _carpeta(tmp_path, monkeypatch):
    monkeypatch.setattr(R, "CONTENT_DIR", tmp_path)
    return tmp_path


async def _escuela(db):
    """Dos alumnas, un administrador y una profe."""
    for uid, nombre, rol in ((10, "Marta", 4), (11, "Lucía", 4), (1, "Rida", 1), (5, "Sanne", 5)):
        db.add(
            User(
                id=uid,
                username=nombre.lower(),
                first_name=nombre,
                last_name="",
                email=f"{nombre.lower()}@ejemplo.com",
                password="x",
                user_uuid=f"user_{uid}",
                creation_date="2026-10-01 10:00:00",
                update_date="",
            )
        )
        db.add(UserOrganization(user_id=uid, org_id=1, role_id=rol, creation_date="2026-10-01 10:00:00", update_date=""))
    await db.commit()


def test_el_video_se_reconoce_por_lo_que_es():
    # Sin extensión y sin tipo (el móvil), por sus primeros bytes.
    assert R.tipo_de_video(MP4[:64]) == (".mp4", "video/mp4")
    assert R.tipo_de_video(MOV[:64]) == (".mov", "video/quicktime")
    assert R.tipo_de_video(WEBM[:64]) == (".webm", "video/webm")
    # Un .mov antiguo, sin «ftyp».
    assert R.tipo_de_video(b"\x00\x00\x00\x08wide" + b"\x00" * 20) == (".mov", "video/quicktime")
    # Si los bytes no dicen nada, lo que diga el navegador.
    assert R.tipo_de_video(b"algo raro", "video/webm;codecs=vp9") == (".webm", "video/webm")
    # Una foto o un PDF, no.
    assert R.tipo_de_video(b"%PDF-1.7 ...", "application/pdf") is None
    assert R.tipo_de_video(b"\xff\xd8\xff\xe0", "image/jpeg") is None


def test_usos_casillas_y_plazo():
    assert R.limpiar_usos("redes,web,telegram") == ["web", "redes"]
    assert R.limpiar_usos('["anuncios","web"]') == ["web", "anuncios"]
    assert R.limpiar_usos(None) == [] and R.limpiar_usos("") == []
    assert R.es_si("true") and R.es_si("on") and R.es_si(True)
    assert not R.es_si("") and not R.es_si("false") and not R.es_si(None)
    from datetime import date

    p = R.plazo_de("2026-11-10T09:00:00+00:00", date(2026, 11, 13))
    assert p == {"hasta": "2026-11-20", "quedan": 7}
    # Pasado el plazo sigue pudiendo grabar: solo se enseña.
    assert R.plazo_de("2026-11-10T09:00:00+00:00", date(2026, 11, 22))["quedan"] == -2
    assert R.plazo_de("")["quedan"] is None


def test_el_whatsapp_presenta_el_regalo_como_agradecimiento():
    t = R.texto_whatsapp("Marta López", "Un mes de Spreekclub", "https://escuela/resena")
    assert t.startswith("Hola Marta,") and "https://escuela/resena" in t
    assert "Como agradecimiento por tu tiempo: Un mes de Spreekclub." in t
    assert "lo bueno y lo que mejorarías" in t
    assert "agradecimiento" not in R.texto_whatsapp("Marta", "", "x")


async def test_invitar_no_duplica_y_solo_a_alumnos(db):
    await _escuela(db)
    r = await R.invitar(1, [10, 11, 5, 999, 10], "", "Un mes de Spreekclub", "Rida", db)
    # La profe (5) y quien no existe (999) no entran; Marta, una sola vez.
    assert r["nuevas"] == 2 and r["cifras"]["invitadas"] == 2
    otra = await R.invitar(1, [10], "Otro mensaje", "Dos meses de Spreekclub", "Rida", db)
    assert otra["nuevas"] == 0 and otra["repetidas"] == 1 and otra["cifras"]["total"] == 2
    filas = (await db.execute(select(Resena).where(Resena.user_id == 10))).scalars().all()
    # Sigue sin grabar: se le actualizan el mensaje y el regalo.
    assert len(filas) == 1 and filas[0].mensaje == "Otro mensaje" and filas[0].regalo == "Dos meses de Spreekclub"
    with pytest.raises(R.ResenaError):
        await R.invitar(1, [], "", "", "Rida", db)

    lista = await R.invitables(1, db)
    assert {a["user_id"] for a in lista} == {10, 11}
    assert all(a["resena"] == "invitada" for a in lista)


async def test_sin_permiso_no_se_guarda_nada(db, _carpeta):
    await _escuela(db)
    # Sin invitación, no.
    with pytest.raises(R.ResenaError) as e:
        await R.grabar(10, Archivo(MP4), "", "true", "web", 70, db)
    assert e.value.status == 403

    await R.invitar(1, [10], "", "Un mes de Spreekclub", "Rida", db)
    with pytest.raises(R.ResenaError) as e:
        await R.grabar(10, Archivo(MP4), "Me encanta", "", "web", 70, db)
    assert e.value.status == 400 and "permiso" in e.value.mensaje
    with pytest.raises(R.ResenaError):
        await R.grabar(10, Archivo(MP4), "", "true", "", 70, db)
    # Algo que no es un vídeo.
    with pytest.raises(R.ResenaError) as e:
        await R.grabar(10, Archivo(b"%PDF-1.7 hola", "application/pdf"), "", "true", "web", 0, db)
    assert e.value.status == 415
    r = await R.mia(10, db)
    assert r.estado == "invitada" and r.video == "" and not r.permiso
    assert not list(_carpeta.rglob("*.*"))


async def test_grabar_volver_a_grabar_y_revisar(db, _carpeta, monkeypatch):
    await _escuela(db)
    await R.invitar(1, [10], "", "Un mes de Spreekclub", "Rida", db)
    d = await R.grabar(10, Archivo(MP4, filename="image"), " Estoy muy contenta ", "true", "web,redes", "72.4", db)
    assert d["resena"]["estado"] == "grabada" and d["resena"]["tiene_video"] and d["resena"]["video_seg"] == 72
    assert d["resena"]["usos"] == ["web", "redes"] and d["resena"]["texto"] == "Estoy muy contenta"
    r = await R.mia(10, db)
    # Se guarda el texto exacto que aceptó y cuándo.
    assert r.permiso and r.permiso_texto == R.PERMISO_TEXTO and r.permiso_at
    primero = r.video
    assert primero.startswith("privado/resenas/1/") and primero.endswith(".mp4")
    assert (_carpeta / primero).is_file()

    # Vuelve a grabarla (ahora desde el navegador, en webm): el vídeo viejo se borra.
    await R.grabar(10, Archivo(WEBM, "video/webm"), "", "on", '["web"]', 65, db)
    r = await R.mia(10, db)
    assert r.video != primero and r.video.endswith(".webm") and r.video_mime == "video/webm"
    assert not (_carpeta / primero).exists() and (_carpeta / r.video).is_file()

    # Revisar: descartar, volver a pendiente y aprobar.
    assert (await R.revisar(1, r.id, "descartada", "Rida", db))["estado"] == "descartada"
    pendiente = await R.revisar(1, r.id, "pendiente", "Rida", db)
    assert pendiente["estado"] == "grabada" and pendiente["revisada_por"] == ""
    aprobada = await R.revisar(1, r.id, "aprobada", "Rida", db)
    assert aprobada["estado"] == "aprobada" and aprobada["revisada_por"] == "Rida" and aprobada["revisada_at"]
    # Aprobada, ya no se cambia desde la escuela del alumno.
    with pytest.raises(R.ResenaError) as e:
        await R.grabar(10, Archivo(MP4), "", "true", "web", 60, db)
    assert e.value.status == 409
    # De otra escuela, no existe.
    with pytest.raises(R.ResenaError) as e:
        await R.revisar(2, r.id, "aprobada", "Rida", db)
    assert e.value.status == 404

    # El regalo no depende de aprobar: se marca aparte, y se puede quitar.
    datos = await R.listar(1, db)
    assert datos["cifras"]["aprobadas"] == 1 and datos["cifras"]["regalos_por_dar"] == 1
    dado = await R.cambiar(1, r.id, {"regalo_dado": True, "nota": "Muy buena, para la web"}, db)
    assert dado["regalo_dado_at"] and dado["nota"] == "Muy buena, para la web"
    assert (await R.listar(1, db))["cifras"]["regalos_por_dar"] == 0
    assert (await R.cambiar(1, r.id, {"regalo_dado": False}, db))["regalo_dado_at"] == ""

    # Borrar se lleva el vídeo del disco.
    video = (await R.mia(10, db)).video
    await R.borrar(1, r.id, db)
    assert await R.mia(10, db) is None and not (_carpeta / video).exists()


async def test_sin_video_no_se_aprueba(db):
    await _escuela(db)
    await R.invitar(1, [11], "", "", "Rida", db)
    r = await R.mia(11, db)
    with pytest.raises(R.ResenaError):
        await R.revisar(1, r.id, "aprobada", "Rida", db)
    # Una invitación sí se puede descartar, y volver a dejar pendiente.
    assert (await R.revisar(1, r.id, "descartada", "Rida", db))["estado"] == "descartada"
    # Invitación retirada: ni aviso en la campana ni puede mandar el vídeo.
    assert await R.avisos_para(11, 1, db) == []
    with pytest.raises(R.ResenaError) as e:
        await R.grabar(11, Archivo(MP4), "", "true", "web", 60, db)
    assert e.value.status == 403
    assert (await R.revisar(1, r.id, "pendiente", "Rida", db))["estado"] == "invitada"


async def test_el_video_pesa_demasiado(db, _carpeta, monkeypatch):
    await _escuela(db)
    await R.invitar(1, [10], "", "", "Rida", db)
    monkeypatch.setattr(R, "MAX_BYTES", 100)
    with pytest.raises(R.ResenaError) as e:
        await R.grabar(10, Archivo(MP4), "", "true", "web", 60, db)
    assert e.value.status == 413
    # No queda ni el archivo a medias ni el vídeo apuntado.
    assert not list(_carpeta.rglob("*.mp4")) and (await R.mia(10, db)).video == ""


async def test_quien_puede_ver_el_video_y_donde_vive(db, _carpeta):
    await _escuela(db)
    await R.invitar(1, [10], "", "", "Rida", db)
    await R.grabar(10, Archivo(MOV), "", "true", "anuncios", 80, db)
    r = await R.mia(10, db)
    assert R.puede_ver_video(r, 10, False)  # la alumna, el suyo
    assert R.puede_ver_video(r, 1, True)  # un administrador
    assert not R.puede_ver_video(r, 11, False)  # otra alumna
    assert not R.puede_ver_video(r, 5, False)  # una profe
    assert not R.puede_ver_video(r, 0, False)
    ruta, mime, nombre = R.video_de(r)
    assert mime == "video/quicktime" and nombre == "Resena-Marta.mov" and ruta.is_file()
    # Solo se sirve lo que está dentro de privado/resenas/.
    assert R.ruta_segura("privado/tareas/1/x.webm") is None
    assert R.ruta_segura("privado/resenas/../../etc/passwd") is None
    assert R.ruta_segura("/etc/passwd") is None


async def test_avisos_de_la_campana(db):
    await _escuela(db)
    assert await R.avisos_para(10, 1, db) == []
    await R.invitar(1, [10, 11], "", "Un mes de Spreekclub", "Rida", db)
    aviso = await R.avisos_para(10, 1, db)
    assert len(aviso) == 1 and aviso[0]["kind"] == "resena" and aviso[0]["url"] == "/resena"
    assert aviso[0]["title"] == "Nos encantaría tu opinión en vídeo" and "Un mes de Spreekclub" in aviso[0]["excerpt"]
    assert set(aviso[0]) == {"id", "kind", "title", "excerpt", "url", "date"}
    # Nadie ha grabado: al administrador, nada.
    assert await R.avisos_para(1, 1, db) == []

    await R.grabar(10, Archivo(MP4), "", "true", "web", 70, db)
    # Ya grabó: a ella se le va, y al administrador le sale por revisar.
    assert await R.avisos_para(10, 1, db) == []
    admin = await R.avisos_para(1, 1, db)
    assert len(admin) == 1 and admin[0]["title"] == "1 reseña por revisar" and "Marta" in admin[0]["excerpt"]
    assert admin[0]["url"] == "/dash/estadisticas?tab=resenas"
    # La profe no ve las reseñas.
    assert await R.avisos_para(5, 1, db) == []
    r = await R.mia(10, db)
    await R.revisar(1, r.id, "aprobada", "Rida", db)
    assert await R.avisos_para(1, 1, db) == []
