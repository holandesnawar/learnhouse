"""«Mijn eerste week» (10/11/2026): el reto personalizado de 7 días."""

import json

import pytest

from src.db.contact_event import ContactEvent  # noqa: F401  (para que la tabla exista en la prueba)
from src.db.reto import RetoSemana
from src.services.reto import reto as R

ANA = {"vive": "nl", "ciudad": "Utrecht", "origen": "colombia", "motivo": "medico", "trabajo": "zorg", "nivel": "nada"}


def test_el_plan_lleva_sus_datos():
    dias = R.armar("Ana García", ANA)
    assert [d["n"] for d in dias] == [1, 2, 3, 4, 5, 6, 7]
    d1 = [f["nl"] for f in dias[0]["frases"]]
    assert d1[:3] == ["Hoi, ik ben Ana.", "Ik kom uit Colombia.", "Ik woon in Utrecht."]
    assert dias[2]["frases"][0]["nl"] == "Ik werk in de zorg."
    # El día 4 es su motivo; el 6, el súper (que le sirve a todo el mundo).
    assert dias[3]["nl"] == "Bij de huisarts" and dias[5]["nl"] == "In de supermarkt"
    assert dias[6]["presentacion"]["nl"].startswith("Hoi, ik ben Ana. Ik kom uit Colombia en ik woon in Utrecht. Ik werk in de zorg.")
    # Cada frase con su traducción, y ninguna vacía.
    for d in dias:
        assert d["intro"] and d["reto"] and len(d["frases"]) >= 5
        assert all(f["nl"].strip() and f["es"].strip() for f in d["frases"])


def test_cada_respuesta_cambia_el_plan():
    # Quien eligió el día a día: el 4 es el súper y el 6, el médico.
    dias = R.armar("Luis", {**ANA, "motivo": "dia"})
    assert dias[3]["nl"] == "In de supermarkt" and dias[5]["nl"] == "Bij de huisarts"
    # Quien aún no vive allí, sin ciudad ni país de la lista.
    fuera = R.armar("Marta", {"vive": "fuera", "origen": "otro", "trabajo": "zoek", "motivo": "trabajo"})
    d1 = [f["nl"] for f in fuera[0]["frases"]]
    assert "Ik woon nog niet in Nederland." in d1 and not any(f.startswith("Ik kom uit") for f in d1)
    assert fuera[2]["frases"][0]["nl"] == "Ik zoek werk."
    assert "Ik ben overdag thuis." in [f["nl"] for f in fuera[2]["frases"]]
    assert "Ik ga binnenkort in Nederland wonen." in fuera[6]["presentacion"]["nl"]
    # Bélgica sin ciudad; con algo de nivel, una frase más el día 2.
    be = R.armar("Eva", {"vive": "be", "origen": "espana", "nivel": "algo"})
    assert "Ik woon in België." in [f["nl"] for f in be[0]["frases"]]
    assert "Zeg ik dat goed?" in [f["nl"] for f in be[1]["frases"]]
    # Todos los motivos y trabajos dan un plan entero.
    for m in R.MOTIVOS:
        for t in R.TRABAJOS:
            assert len(R.armar("Ana", {**ANA, "motivo": m["id"], "trabajo": t[0]})) == 7


def test_respuestas_raras_no_rompen_nada():
    r = R.limpiar_respuestas({"vive": "marte", "ciudad": "<b>Den Haag</b>;", "origen": 3, "motivo": None})
    assert r == {"vive": "nl", "ciudad": "bDen Haagb", "origen": "otro", "motivo": "dia", "trabajo": "anders", "nivel": "nada"}
    assert len(R.armar("", None)) == 7


def test_un_dia_cada_dia():
    assert R.se_abre("2026-11-10", 1) == "2026-11-10" and R.se_abre("2026-11-10", 7) == "2026-11-16"
    assert R.esta_abierto("2026-11-10", 2, "2026-11-10") is False
    assert R.esta_abierto("2026-11-10", 2, "2026-11-11") is True
    assert R.esta_abierto("2026-11-10", 7, "2026-11-10", todo=True) is True
    # Le toca el primero abierto sin hacer; si lo abierto está hecho, el último abierto.
    assert R.siguiente({}, "2026-11-10", "2026-11-12") == 1
    assert R.siguiente({1: "x", 2: "x"}, "2026-11-10", "2026-11-12") == 3
    assert R.siguiente({1: "x"}, "2026-11-10", "2026-11-10") == 1


@pytest.fixture
def _sin_correo(monkeypatch):
    monkeypatch.setattr(R, "_mandar_enlace", lambda *a, **k: None)
    monkeypatch.setattr(R, "_secreto", lambda: "secreto-de-prueba-largo-de-verdad-123")
    monkeypatch.setattr(R, "url_de_la_llamada", lambda nombre, email, hoy=None: "https://ejemplo/llamada")


async def test_apuntarse_avanzar_y_la_ficha(db, _sin_correo, monkeypatch):
    monkeypatch.setattr(R, "hoy_nl", lambda: "2026-11-10")
    datos = {"nombre": "Ana García", "email": " Ana@Ejemplo.com ", "telefono": "+31 6 1234 5678", "respuestas": ANA, "utm_source": "instagram"}
    r = await R.empezar(datos, db)
    assert r["nuevo"] and R.email_de(r["token"]) == "ana@ejemplo.com"

    plan = await R.leer(r["token"], db)
    assert plan["nombre"] == "Ana" and plan["toca"] == 1 and plan["hechos"] == 0
    # De un día cerrado no salen las frases.
    assert plan["dias"][0]["abierto"] and "frases" in plan["dias"][0]
    assert not plan["dias"][1]["abierto"] and "frases" not in plan["dias"][1] and plan["dias"][1]["se_abre"] == "2026-11-11"

    # Termina el día 1; el 2 aún no se deja.
    plan = await R.terminar_dia(r["token"], 1, db)
    assert plan["hechos"] == 1 and plan["dias"][0]["hecho"]
    with pytest.raises(R.RetoError) as exc:
        await R.terminar_dia(r["token"], 2, db)
    assert exc.value.status == 409
    # Un administrador lo ve todo abierto.
    assert all(d["abierto"] for d in (await R.leer(r["token"], db, todo=True))["dias"])

    # Al día siguiente, el 2.
    monkeypatch.setattr(R, "hoy_nl", lambda: "2026-11-11")
    plan = await R.terminar_dia(r["token"], 2, db)
    assert plan["hechos"] == 2 and plan["toca"] == 2

    # Apuntarse otra vez con el mismo correo no empieza de cero ni cambia sus respuestas.
    otra = await R.empezar({**datos, "respuestas": {**ANA, "motivo": "colegio"}}, db)
    assert not otra["nuevo"]
    assert (await R.leer(otra["token"], db))["hechos"] == 2

    # La ficha del closer.
    f = await R.para_la_ficha("ana@ejemplo.com", db)
    assert f["hechos"] == 2 and f["motivo"] == "El médico y la farmacia" and f["trabajo"] == "Sanidad o cuidados"
    assert f["vive"] == "En Países Bajos · Utrecht" and f["origen"] == "Colombia" and not f["caliente"]
    await R.pulso_la_llamada(r["token"], db)
    assert (await R.para_la_ficha("ana@ejemplo.com", db))["caliente"]
    assert await R.para_la_ficha("nadie@ejemplo.com", db) is None

    # Queda en Contactos, con de dónde vino.
    from sqlmodel import select

    from src.db.contact_event import ContactEvent

    ev = (await db.execute(select(ContactEvent).where(ContactEvent.kind == "reto"))).scalars().all()
    assert len(ev) == 1 and ev[0].utm_source == "instagram" and ev[0].phone == "+31612345678"
    assert json.loads(ev[0].extra)["respuestas"]["motivo"] == "medico"


async def test_lo_que_no_vale(db, _sin_correo):
    for malo in ({"nombre": "", "email": "a@b.co", "telefono": "+31612345678"}, {"nombre": "Ana", "email": "mal", "telefono": "+31612345678"}, {"nombre": "Ana", "email": "a@b.co", "telefono": "12"}):
        with pytest.raises(R.RetoError):
            await R.empezar(malo, db)
    with pytest.raises(R.RetoError) as exc:
        await R.leer("enlace-inventado", db)
    assert exc.value.status == 404
    assert (await db.execute(__import__("sqlmodel").select(RetoSemana))).scalars().all() == []
