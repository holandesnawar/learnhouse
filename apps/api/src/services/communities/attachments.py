"""
Adjuntos del chat de la comunidad: fotos, audios y archivos.

Dónde se guardan
----------------
Si hay un bucket de Cloudflare R2 configurado, ahí. Si no, en el volumen de
siempre (`content/orgs/<uuid>/chat/`), que es lo que hay hoy. Así esto funciona
desde el primer día y el bucket se puede conectar después sin tocar el código
ni perder lo ya subido.

Por qué R2 y no el interruptor global de S3 que ya existe: ese interruptor
cambia **todo** el contenido a la vez (logos, avatares, notas de voz), y la
ruta que sirve `/content` solo lee del disco local — cambiarlo entero dejaría
los logos en blanco. Los adjuntos del chat van por su cuenta.

Variables (todas opcionales; si falta una, se usa el volumen):
    NAWAR_R2_ACCOUNT_ID         · el identificador de tu cuenta de Cloudflare
    NAWAR_R2_BUCKET             · el nombre del bucket
    NAWAR_R2_ACCESS_KEY_ID      · del token de API de R2
    NAWAR_R2_SECRET_ACCESS_KEY  · del token de API de R2
    NAWAR_R2_PUBLIC_BASE_URL    · https://media.tudominio.com (o el de r2.dev)
"""

from __future__ import annotations

import logging
import os
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from src.security.file_validation import get_safe_filename, validate_upload
from src.services.utils.upload_content import upload_content

logger = logging.getLogger(__name__)

# Topes. Generosos para una foto de móvil, cortos para no llenar el disco.
MAX_IMAGE_BYTES = 12 * 1024 * 1024   # 12 MB
MAX_AUDIO_BYTES = 20 * 1024 * 1024   # 20 MB
MAX_FILE_BYTES = 25 * 1024 * 1024    # 25 MB

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "heic", "heif"}
AUDIO_EXTENSIONS = {"mp3", "m4a", "wav", "ogg", "webm", "oga"}


def _r2_settings() -> Optional[dict]:
    """La configuración de R2, o None si no está completa."""
    account = os.environ.get("NAWAR_R2_ACCOUNT_ID", "").strip()
    bucket = os.environ.get("NAWAR_R2_BUCKET", "").strip()
    key_id = os.environ.get("NAWAR_R2_ACCESS_KEY_ID", "").strip()
    secret = os.environ.get("NAWAR_R2_SECRET_ACCESS_KEY", "").strip()
    public = os.environ.get("NAWAR_R2_PUBLIC_BASE_URL", "").strip().rstrip("/")
    if not all([account, bucket, key_id, secret, public]):
        return None
    return {
        "endpoint": f"https://{account}.r2.cloudflarestorage.com",
        "bucket": bucket,
        "key_id": key_id,
        "secret": secret,
        "public": public,
    }


def storage_backend() -> str:
    """`r2` o `volumen`. Sirve para enseñarlo en el panel."""
    return "r2" if _r2_settings() else "volumen"


def _kind_for(extension: str, content_type: str) -> str:
    ext = (extension or "").lower().lstrip(".")
    if ext in IMAGE_EXTENSIONS or (content_type or "").startswith("image/"):
        return "image"
    if ext in AUDIO_EXTENSIONS or (content_type or "").startswith("audio/"):
        return "audio"
    return "file"


def _limits_for(kind: str) -> tuple[list[str], int]:
    if kind == "image":
        return ["image"], MAX_IMAGE_BYTES
    if kind == "audio":
        # `validate_upload` no conoce el audio; se valida por extensión y tamaño.
        return [], MAX_AUDIO_BYTES
    return ["document"], MAX_FILE_BYTES


async def _put_in_r2(settings: dict, key: str, data: bytes, content_type: str) -> str:
    import boto3
    import botocore.config

    client = boto3.client(
        "s3",
        endpoint_url=settings["endpoint"],
        aws_access_key_id=settings["key_id"],
        aws_secret_access_key=settings["secret"],
        region_name="auto",
        config=botocore.config.Config(
            connect_timeout=10, read_timeout=60, retries={"max_attempts": 2}
        ),
    )
    try:
        client.put_object(
            Bucket=settings["bucket"],
            Key=key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
            # Un año: el nombre lleva un uuid, así que el fichero nunca cambia.
            CacheControl="public, max-age=31536000, immutable",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("R2: no se pudo subir %s", key)
        raise HTTPException(status_code=502, detail=f"No se pudo guardar el archivo: {exc}")
    return f"{settings['public']}/{key}"


async def upload_attachment(file: UploadFile, org_uuid: str) -> dict:
    """
    Guarda un adjunto y devuelve con qué pintarlo.

    Devuelve `{url, name, kind, size}` — `kind` es `image`, `audio` o `file`.
    """
    original = file.filename or "archivo"
    extension = original.split(".")[-1] if "." in original else ""
    kind = _kind_for(extension, file.content_type or "")
    allowed, max_size = _limits_for(kind)

    if kind == "audio":
        # Validación propia: extensión conocida y tamaño razonable.
        if extension.lower() not in AUDIO_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Ese formato de audio no vale")
        data = await file.read()
        if len(data) > max_size:
            raise HTTPException(status_code=400, detail="El audio pesa demasiado")
    else:
        _, data = validate_upload(file, allowed, max_size)

    safe_name = get_safe_filename(original, f"{uuid4()}_chat")
    settings = _r2_settings()

    if settings:
        key = f"chat/{org_uuid}/{safe_name}"
        url = await _put_in_r2(settings, key, data, file.content_type or "")
    else:
        await upload_content(
            directory="chat",
            type_of_dir="orgs",
            uuid=org_uuid,
            file_binary=data,
            file_and_format=safe_name,
            allowed_formats=None,  # ya validado arriba
        )
        url = f"/content/orgs/{org_uuid}/chat/{safe_name}"

    return {
        "url": url,
        "name": original[:120],
        "kind": kind,
        "size": len(data),
    }
