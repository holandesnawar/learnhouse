from src.services.salas import estudio_grabaciones as EG


def _caja(tipo: bytes, tam: int) -> bytes:
    return tam.to_bytes(4, "big") + tipo + b"\0" * (min(tam, 64) - 8)


def test_leer_cajas_y_veredicto():
    con_moov = _caja(b"ftyp", 24) + _caja(b"moov", 40) + (5000).to_bytes(4, "big") + b"mdat"
    assert EG.leer_cajas(con_moov)[:3] == ["ftyp", "moov", "mdat"]
    assert "bien" in EG.explicar_video({"status": 206, "tamano": 10, "primeros": con_moov, "cajas": EG.leer_cajas(con_moov)})

    al_final = _caja(b"ftyp", 24) + (900_000_000).to_bytes(4, "big") + b"mdat"
    v = EG.explicar_video({"status": 206, "tamano": 900_000_100, "primeros": al_final, "cajas": EG.leer_cajas(al_final)})
    assert "FINAL" in v and "858 MB" in v

    assert "trozos del vídeo" in EG.explicar_video({"status": 200, "tamano": 0, "primeros": b"", "cajas": []})
    assert "HLS" in EG.explicar_video({"status": 206, "primeros": b"#EXTM3U\n", "cajas": []})
    assert "403" in EG.explicar_video({"status": 403})


def test_un_mp4_en_trozos_no_esta_bien():
    """La grabación del 16/11: «ftyp · moov · styp». No se puede saltar."""
    en_trozos = _caja(b"ftyp", 24) + _caja(b"moov", 40) + _caja(b"styp", 24) + _caja(b"moof", 40)
    cajas = EG.leer_cajas(en_trozos)
    assert cajas[:3] == ["ftyp", "moov", "styp"]
    texto = EG.explicar_video({"status": 206, "tamano": 3_407_000_000, "primeros": en_trozos, "cajas": cajas})
    assert "en trozos" in texto and "bien" not in texto
