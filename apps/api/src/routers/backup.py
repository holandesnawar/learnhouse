"""
Copia de seguridad del volumen de archivos.

La base de datos ya se copia sola cada noche (`.github/workflows/db-backup.yaml`),
pero **los archivos no están en la base de datos**: los logos de la escuela, las
imágenes subidas y las **notas de voz** de los mensajes viven en el volumen
`content/`, que en Railway solo se puede leer desde dentro del contenedor.

Este router existe para que el workflow `content-backup.yaml` pueda bajarse ese
volumen empaquetado y guardarlo en Cloudflare R2, al lado de los volcados del
Postgres.

──────────────────────────────────────────────────────────────────────────────
POR QUÉ ESTE ROUTER ESTÁ APARTE Y NO EN `superadmin.py`
──────────────────────────────────────────────────────────────────────────────
El router de superadmin se monta con `get_non_api_token_user`, que rechaza a
propósito cualquier acceso con token de API. Es un buen valor por defecto para
las herramientas que viven ahí (sembrar la comunidad, mandar correos de prueba):
cosas que hace una persona sentada delante, no un robot.

Pero un workflow de GitHub no tiene sesión: solo puede identificarse con un
token. Así que esta ruta se monta en su propio router **sin** esa dependencia, y
la puerta la pone `require_superadmin`, que:

  * rechaza a los anónimos (401);
  * rechaza los tokens de organización (403) — nunca son superadmin;
  * acepta los tokens de superadmin (`lh_sa_`), que están hasheados, se pueden
    revocar y pueden caducar;
  * y **vuelve a comprobar que quien creó el token sigue siendo superadmin**, de
    forma que degradar a esa persona invalida todos sus tokens de golpe.

Lo que esto abre, dicho claro: quien tenga un token de superadmin puede
descargarse los archivos de los alumnos, notas de voz incluidas. Un superadmin
con sesión ya podía hacerlo; la diferencia es que ahora esa llave también existe
como secreto en GitHub. Por eso el token con el que se usa debería llevar
caducidad y revocarse en cuanto deje de hacer falta.
"""

import hashlib
import hmac
import logging
import os
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.background import BackgroundTask

from src.core.events.database import get_db_session
from src.security.superadmin import require_superadmin

logger = logging.getLogger(__name__)

router = APIRouter()

#: Cabecera y variable de entorno del secreto con el que se identifica el
#: workflow. Mismo nombre las dos, a propósito: un solo nombre que recordar.
#:
#: Existe porque **en esta edición no se pueden crear tokens de superadmin**: la
#: pantalla del panel llama a `ee/superadmin/tokens/`, que es una ruta de la
#: edición Enterprise y aquí no existe (da 404). La pantalla de "Acceso API" que
#: sí funciona crea tokens de ORGANIZACIÓN (`lh_`), y esos los rechaza
#: `require_superadmin` a propósito.
#:
#: Es el mismo patrón que ya usa el webhook de Inrō en la web. Se revoca
#: cambiando la variable en Railway, que además es más fácil de explicar que una
#: pantalla de tokens.
CABECERA_SECRETO = "LEARNHOUSE_BACKUP_TOKEN"


def _mismo_secreto(a: str, b: str) -> bool:
    """Compara sin filtrar por dónde dejan de parecerse.

    Se comparan los hashes y no los textos: así los dos búferes miden siempre
    lo mismo y la longitud del secreto tampoco se filtra.
    """
    ha = hashlib.sha256(a.encode("utf-8")).digest()
    hb = hashlib.sha256(b.encode("utf-8")).digest()
    return hmac.compare_digest(ha, hb)


async def _autorizar(request: Request, db_session: AsyncSession) -> str:
    """Deja pasar al workflow de copias o a un superadmin. Devuelve quién entró.

    Se prueba primero el secreto porque es el camino del robot, que es el que
    se recorre todas las noches. Si no hay secreto configurado, esa puerta
    simplemente no existe y solo entra un superadmin.
    """
    esperado = (os.environ.get(CABECERA_SECRETO) or "").strip()
    recibido = (request.headers.get(CABECERA_SECRETO) or "").strip()
    if esperado and recibido and _mismo_secreto(recibido, esperado):
        return "workflow-de-copias"

    # Sin secreto válido, la puerta normal: una sesión de superadmin. Sirve para
    # bajarse el paquete a mano desde el navegador.
    from src.security.auth import get_current_user

    current_user = await get_current_user(request, db_session)
    await require_superadmin(current_user=current_user, db_session=db_session)
    return f"user_id={getattr(current_user, 'id', '?')}"

# Misma ruta que usa `local_content.py` para servir los archivos: relativa al
# directorio de trabajo de la API, que en el contenedor es /app/api.
CONTENT_DIR = Path("content")


@router.get(
    "/content-archive",
    summary="Descarga el volumen de archivos (logos, imágenes, notas de voz) en un tar.gz.",
    description=(
        "Empaqueta el directorio `content/` y lo devuelve como un tar.gz. Lo "
        "llama el workflow `content-backup.yaml`, que lo sube a Cloudflare R2 "
        "junto a las copias del Postgres.\n\n"
        "Dos formas de entrar: la cabecera `LEARNHOUSE_BACKUP_TOKEN` con el "
        "secreto (es la que usa el workflow) o una sesión de superadmin (para "
        "bajárselo a mano). Cada descarga queda en el log con quién y cuánto."
    ),
    responses={
        401: {"description": "Sin autenticar."},
        403: {"description": "No es superadmin."},
        404: {"description": "No hay directorio content/ que empaquetar."},
        500: {"description": "El paquete no se pudo crear o salió vacío."},
    },
)
async def api_content_archive(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
):
    quien = await _autorizar(request, db_session)

    if not CONTENT_DIR.is_dir():
        raise HTTPException(status_code=404, detail="No hay directorio content/ que empaquetar")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    nombre = f"content-{stamp}.tar.gz"

    # A fichero temporal y no en streaming: el contenido son logos, imágenes y
    # notas de voz —archivos pequeños—, así que cabe de sobra en el disco
    # efímero. Y un tar terminado en disco se puede medir antes de mandarlo,
    # cosa que uno a medio construir no permite.
    tmp = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
    tmp.close()
    ruta_tmp = Path(tmp.name)

    try:
        with tarfile.open(ruta_tmp, "w:gz") as tar:
            tar.add(str(CONTENT_DIR), arcname="content")
    except Exception:
        ruta_tmp.unlink(missing_ok=True)
        logger.exception("No se pudo empaquetar el volumen de contenido")
        raise HTTPException(status_code=500, detail="No se pudo empaquetar el contenido")

    tamano = ruta_tmp.stat().st_size
    if tamano <= 0:
        ruta_tmp.unlink(missing_ok=True)
        # Un archivo vacío que se sube tan campante es peor que un fallo: la
        # copia parece existir hasta el día que hace falta.
        raise HTTPException(status_code=500, detail="El paquete salió vacío")

    logger.info(
        "Descarga del volumen de contenido: %s (%.2f MB) por %s",
        nombre,
        tamano / 1_048_576,
        quien,
    )

    return FileResponse(
        ruta_tmp,
        media_type="application/gzip",
        filename=nombre,
        background=BackgroundTask(lambda: ruta_tmp.unlink(missing_ok=True)),
    )
