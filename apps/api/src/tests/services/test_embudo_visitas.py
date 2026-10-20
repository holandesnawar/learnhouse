"""Hasta dónde llega cada visita de los embudos de la web (20/10/2026).

- Lo que no es de un embudo conocido, o no trae una sesión con forma de
  sesión, se ignora.
- Cada paso de la misma sesión sube la misma fila; el vídeo solo sube.
- El canal (anuncio u orgánico) sale del utm_medium.
- El resumen cuenta por embudo y canal, y llegar a un paso de más adelante
  cuenta los de antes que no son del vídeo.
"""

from types import SimpleNamespace

import pytest
from sqlmodel import select

from src.db.embudo_visita import EmbudoVisita
from src.services.contactos import embudo_visitas as V

S = "sesion-de-prueba-1"


def test_lo_que_no_vale_se_ignora():
    assert V.leer_paso({"s": "x", "e": "anuncio", "p": "visita"}) is None  # sesión corta
    assert V.leer_paso({"s": S, "e": "otro", "p": "visita"}) is None
    assert V.leer_paso({"s": S, "e": "anuncio", "p": "pagar"}) is None
    assert V.leer_paso({"s": S, "e": "anuncio", "p": "video", "v": "250"})["video_pct"] == 100
    assert V.canal_de_utm("paid") == "ads" and V.canal_de_utm("") == "organico" and V.canal_de_utm("Paid") == "ads"


@pytest.mark.asyncio
async def test_cada_paso_sube_la_misma_fila(db):
    base = {"s": S, "e": "anuncio", "utm_medium": "paid", "utm_campaign": "vsl-matricula-oct26", "utm_content": "VIDEO | UGC | VSL | A"}
    for paso in ({"p": "visita"}, {"p": "datos"}, {"p": "video", "v": 50}, {"p": "video", "v": 25}, {"p": "formulario"}):
        assert await V.apuntar_paso({**base, **paso}, db)
    filas = (await db.execute(select(EmbudoVisita))).scalars().all()
    assert len(filas) == 1
    f = filas[0]
    assert f.visita and f.datos and f.formulario and not f.preguntas
    assert f.video_pct == 50  # el 25 que llegó después no la baja
    assert f.canal == "ads" and f.utm_campaign == "vsl-matricula-oct26" and len(f.dia) == 10
    # Otra sesión, otra fila; otro embudo de la misma sesión, otra fila.
    await V.apuntar_paso({"s": "otra-sesion-12345", "e": "anuncio", "p": "visita"}, db)
    await V.apuntar_paso({"s": S, "e": "web", "p": "visita"}, db)
    assert len((await db.execute(select(EmbudoVisita))).scalars().all()) == 3
    assert not await V.apuntar_paso({"s": "corta", "e": "anuncio", "p": "visita"}, db)


def _f(embudo="anuncio", canal="ads", **pasos):
    base = dict(embudo=embudo, canal=canal, dia="2026-10-20", visita=True, datos=False, video_pct=0,
                formulario=False, preguntas=False, reserva=False)
    base.update(pasos)
    return SimpleNamespace(**base)


def test_el_resumen_por_embudo_y_canal():
    filas = [
        _f(),  # entra y se va
        _f(),
        _f(datos=True),  # deja datos y no da al play
        _f(datos=True, video_pct=30),
        _f(datos=True, video_pct=100, formulario=True),
        _f(video_pct=100, reserva=True),  # el aviso de datos se perdió: cuenta igual
        _f(embudo="admision", canal="organico", datos=True),
    ]
    r = V.resumen(filas)
    pasos = {p["clave"]: p for p in r["anuncio"]["canales"]["ads"]}
    assert pasos["visita"]["n"] == 6 and pasos["datos"]["n"] == 4
    assert pasos["datos"]["pct_anterior"] == round(4 * 100 / 6, 1)
    assert pasos["play"]["n"] == 3 and pasos["mitad"]["n"] == 2 and pasos["entero"]["n"] == 2
    assert pasos["formulario"]["n"] == 2 and pasos["preguntas"]["n"] == 1 and pasos["reserva"]["n"] == 1
    assert pasos["reserva"]["pct_total"] == round(100 / 6, 1)
    assert r["anuncio"]["canales"]["organico"][0]["n"] == 0
    assert r["admision"]["canales"]["organico"][1]["n"] == 1
    assert r["todos"]["canales"]["todos"][0]["n"] == 7
    assert V.visitas_por_dia(filas) == {"2026-10-20": {"visitas": 7, "datos": 5}}
