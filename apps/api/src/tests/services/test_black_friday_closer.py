"""Black Friday en Matrículas para los closers (29/10/2026): quién entra en el
tablero, en qué columna, y el bloque «Black Friday» de la ficha con los
correos de systeme.io calculados por su calendario."""

from datetime import datetime, timedelta, timezone

from src.services.panel import black_friday as bf
from src.services.panel.pipeline import colocar, en_tablero

AHORA = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)


def _dia(n: float) -> str:
    """Hace `n` días respecto a AHORA (negativo = antes)."""
    return (AHORA + timedelta(days=n)).isoformat()


def _ev(kind: str, when: str, **campos) -> dict:
    base = {
        "kind": kind, "when": when, "email": "ana@x.com", "phone": "", "recorrido": "", "referrer": "",
        "utm_source": "", "utm_medium": "", "utm_campaign": "", "utm_content": "", "extra": {},
    }
    base.update(campos)
    return base


def _ficha(*eventos: dict, **mas) -> dict:
    pasos: list[str] = []
    for e in eventos:
        for p in (e.get("recorrido") or "").split(","):
            if p and p not in pasos:
                pasos.append(p)
    f = {
        "email": "ana@x.com", "nombre": "Ana", "telefono": "", "etapa": "lead", "matricula_at": "",
        "primer_contacto": {"kind": eventos[0]["kind"], "que": "", "when": eventos[0]["when"]},
        "ultimo_contacto": {"kind": eventos[-1]["kind"], "que": "", "when": eventos[-1]["when"]},
        "pasos": pasos, "eventos": list(eventos),
    }
    f.update(mas)
    return f


def test_quien_entra_en_el_tablero():
    compro = _ficha(_ev("bf-lista", _dia(-3)), _ev("ebook", _dia(-1)))
    con_whatsapp = _ficha(_ev("bf-lista", _dia(-1), phone="+31612345678"))
    sin_telefono = _ficha(_ev("bf-lista", _dia(-1)))
    guia = _ficha(_ev("guia", _dia(-1)))

    assert bf.marca(compro) == "ebook" and en_tablero(compro)
    assert bf.marca(con_whatsapp) == "lista" and en_tablero(con_whatsapp)
    # Desde el botón de un correo no se deja teléfono: no entra.
    assert bf.marca(sin_telefono) == "lista" and not en_tablero(sin_telefono)
    assert bf.marca(guia) == "" and not en_tablero(guia)


def test_columnas_nuevo_para_el_ebook_por_llamar_para_la_lista():
    # Compró ayer el ebook (aunque bajó una guía hace meses): Nuevo, y llega
    # el día de la compra, no el de la guía.
    compro = _ficha(_ev("guia", _dia(-90)), _ev("ebook", _dia(-1)))
    t = colocar(compro, None, None, AHORA)
    assert t["etapa"] == "nuevo" and t["black_friday"] == "ebook"
    assert t["llegada"] == _dia(-1)

    # Solo desbloqueó (con WhatsApp), aunque fuera hoy: Por llamar.
    lista = _ficha(_ev("bf-lista", _dia(-0.1), phone="+31612345678"))
    t = colocar(lista, None, None, AHORA)
    assert t["etapa"] == "llamar" and t["black_friday"] == "lista"


def test_sin_correos_encendidos_lo_dice():
    r = bf.resumen(_ficha(_ev("bf-lista", _dia(-3))), AHORA, "")
    assert r and r["titulo"] == "Desbloqueó la oferta, sin comprar el ebook"
    assert r["aviso"] == "Los correos de systeme.io aún no están encendidos."
    assert r["correos"] == [] and r["campana"] == ""


def test_quien_entro_antes_de_encenderlos_no_esta_en_ninguna_campana():
    r = bf.resumen(_ficha(_ev("bf-lista", _dia(-9))), AHORA, _dia(-5)[:10])
    assert "antes de encender" in r["aviso"] and r["correos"] == []


def test_los_correos_de_no_compradores_por_calendario():
    # Se apuntó hace 4 días: días 0, 1 y 3 ya; el del día 5, mañana.
    r = bf.resumen(_ficha(_ev("bf-lista", _dia(-4))), AHORA, _dia(-20)[:10])
    assert r["campana"] == "No compradores"
    assert [c["id"] for c in r["correos"]] == ["sys-n0", "sys-n1", "sys-n3"]
    assert r["proximo"]["id"] == "sys-n5"


def test_al_comprar_pasa_a_compradores():
    # Se apuntó hace 4 días y compró hace 2: de No compradores solo le
    # llegaron los de los días 0 y 1; de Compradores, el del día 1 (ayer).
    r = bf.resumen(_ficha(_ev("bf-lista", _dia(-4)), _ev("ebook", _dia(-2))), AHORA, _dia(-20)[:10])
    assert r["titulo"] == "Compró el ebook" and r["campana"] == "Compradores"
    assert [c["id"] for c in r["correos"]] == ["sys-n0", "sys-n1", "sys-c1"]
    assert r["proximo"]["id"] == "sys-c3"


def test_reservar_la_llamada_le_saca_de_las_campanas():
    r = bf.resumen(
        _ficha(_ev("bf-lista", _dia(-6)), _ev("ebook", _dia(-5)), _ev("reunion", _dia(-3))),
        AHORA, _dia(-20)[:10],
    )
    assert r["salida"]["motivo"] == "Reservó su llamada"
    assert r["campana"] == "" and r["proximo"] is None
    # Compradores desde hace 5 días: solo el del día 1 antes de reservar.
    assert [c["id"] for c in r["correos"]] == ["sys-n0", "sys-c1"]
    assert r["llamada"] == "Reservó su llamada"


def test_no_encajar_en_el_formulario_de_black_friday_le_saca():
    r = bf.resumen(
        _ficha(
            _ev("ebook", _dia(-6)),
            _ev("cualificacion", _dia(-4), extra={"apto": False, "embudo": "black-friday"}),
        ),
        AHORA, _dia(-20)[:10],
    )
    assert r["salida"]["motivo"].startswith("No encaja")
    assert r["llamada"] == "Terminó las preguntas de la llamada: no encaja"


def test_por_que_correo_volvio_y_que_paginas_vio():
    r = bf.resumen(
        _ficha(
            _ev("bf-lista", _dia(-5), recorrido="bf-desbloquear", utm_source="email", utm_medium="newsletter",
                utm_campaign="black-friday", utm_content="nl-abrimos-1"),
            _ev("admision", _dia(-1), recorrido="black-friday,bf-admision", utm_source="systeme", utm_medium="email",
                utm_campaign="black-friday", utm_content="nl-lista", extra={"embudo": "black-friday"}),
        ),
        AHORA, _dia(-20)[:10],
    )
    assert [v["asunto"] for v in r["volvio_por"]] == [
        "Este Black Friday no lo vamos a anunciar en público",
        "Tenemos algo importante que contarte",
    ]
    assert r["desbloqueo"]["via"] == "un correo («Este Black Friday no lo vamos a anunciar en público»)"
    assert [p["id"] for p in r["paginas"]] == ["bf-desbloquear", "black-friday", "bf-admision"]
    assert r["llamada"] == "Empezó el formulario de la llamada y no lo terminó"


def test_quien_no_paso_por_black_friday_no_tiene_bloque():
    assert bf.resumen(_ficha(_ev("guia", _dia(-1))), AHORA, "2026-11-01") is None


def test_asuntos_de_los_correos():
    assert bf.asunto_de("sys-c5") == "«No tengo tiempo», «a mi edad», «ya lo intenté»"
    # Los de la campaña que mandaba la escuela también se reconocen.
    assert bf.asunto_de("c1") == "Cómo sacarle partido a tu ebook"
    assert bf.asunto_de("otro") == ""
    assert bf.es_de_correo("systeme", "email") and bf.es_de_correo("", "newsletter")
    assert not bf.es_de_correo("facebook", "paid")


def test_quien_abre_el_pago_y_no_paga_entra_en_no_compradores():
    # 31/10: rellenó nombre y correo en la ventana del ebook (sin pasar por la
    # portada) y no pagó. Abrir el pago le pone la etiqueta de la lista en
    # systeme.io, así que está en «No compradores» desde ese momento.
    r = bf.resumen(_ficha(_ev("ebook-empezado", _dia(-2))), AHORA, _dia(-20)[:10])
    assert r["titulo"] == "Abrió el pago del ebook y no lo compró"
    assert r["campana"] == "No compradores"
    assert [c["id"] for c in r["correos"]] == ["sys-n0", "sys-n1"]
    assert r["proximo"]["id"] == "sys-n3"
    # Si se apuntó en la portada antes, cuenta lo primero.
    r = bf.resumen(_ficha(_ev("bf-lista", _dia(-4)), _ev("ebook-empezado", _dia(-2))), AHORA, _dia(-20)[:10])
    assert [c["id"] for c in r["correos"]] == ["sys-n0", "sys-n1", "sys-n3"]
