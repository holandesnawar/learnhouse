"""
El texto de las tarjetas de Nextcloud Deck viene en Markdown; el editor de la
escuela (Tiptap) lee HTML. Aquí, un traductor pequeño y sin dependencias para
lo que se usa de verdad en las tarjetas: títulos, negrita, cursiva, tachado,
código, enlaces, listas (también con casillas), citas, líneas y tablas.

Todo se escapa antes de dar formato: lo que venga en el texto nunca se pinta
como HTML suyo. Además, la pantalla solo lo enseña a través del editor, que
tira cualquier etiqueta que no conoce.
"""

from __future__ import annotations

import html
import re

_URL = re.compile(r"(?<![\"'=>])\b(https?://[^\s<>()]+[^\s<>().,;:!?\"'])")


def _seguro(url: str) -> str:
    u = html.unescape(url or "").strip()
    return u if re.match(r"^(https?://|mailto:)", u, re.I) else ""


def linea(texto: str) -> str:
    """Formato dentro de una línea. Recibe texto SIN escapar."""
    s = html.escape(texto or "", quote=False)
    guardados: list[str] = []

    def guardar(fragmento: str) -> str:
        guardados.append(fragmento)
        return f"\x00{len(guardados) - 1}\x00"

    # Código: lo de dentro no se toca.
    s = re.sub(r"`([^`]+)`", lambda m: guardar(f"<code>{m.group(1)}</code>"), s)

    # Enlaces [texto](url)
    def enlace(m: re.Match) -> str:
        url = _seguro(m.group(2))
        if not url:
            return m.group(1)
        return guardar(f'<a href="{html.escape(url, quote=True)}">{m.group(1)}</a>')

    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)", enlace, s)
    # Direcciones sueltas.
    s = _URL.sub(lambda m: guardar(f'<a href="{html.escape(html.unescape(m.group(1)), quote=True)}">{m.group(1)}</a>'), s)

    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"__(.+?)__", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"<em>\1</em>", s)
    s = re.sub(r"~~(.+?)~~", r"<s>\1</s>", s)

    return re.sub(r"\x00(\d+)\x00", lambda m: guardados[int(m.group(1))], s)


def _celdas(fila: str) -> list[str]:
    fila = fila.strip()
    if fila.startswith("|"):
        fila = fila[1:]
    if fila.endswith("|"):
        fila = fila[:-1]
    return [c.strip() for c in fila.split("|")]


def _es_separador(fila: str) -> bool:
    return bool(re.match(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$", fila))


def markdown_a_html(md: str) -> str:
    """Markdown → HTML para el editor. Vacío → vacío."""
    texto = (md or "").replace("\r\n", "\n").replace("\r", "\n")
    if not texto.strip():
        return ""
    lineas = texto.split("\n")
    salida: list[str] = []
    parrafo: list[str] = []
    i = 0

    def cerrar_parrafo() -> None:
        if parrafo:
            salida.append("<p>" + "<br>".join(linea(p) for p in parrafo) + "</p>")
            parrafo.clear()

    while i < len(lineas):
        raw = lineas[i]
        l = raw.strip()

        if not l:
            cerrar_parrafo()
            i += 1
            continue

        # Títulos
        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*$", l)
        if m:
            cerrar_parrafo()
            nivel = min(max(len(m.group(1)), 1), 3)
            salida.append(f"<h{nivel}>{linea(m.group(2))}</h{nivel}>")
            i += 1
            continue

        # Línea
        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", l):
            cerrar_parrafo()
            salida.append("<hr>")
            i += 1
            continue

        # Tabla: una fila con | seguida de un separador.
        if "|" in l and i + 1 < len(lineas) and _es_separador(lineas[i + 1]):
            cerrar_parrafo()
            cab = _celdas(l)
            i += 2
            filas: list[list[str]] = []
            while i < len(lineas) and "|" in lineas[i] and lineas[i].strip():
                filas.append(_celdas(lineas[i]))
                i += 1
            t = "<table><tbody><tr>" + "".join(f"<th><p>{linea(c)}</p></th>" for c in cab) + "</tr>"
            for f in filas:
                f = (f + [""] * len(cab))[: len(cab)]
                t += "<tr>" + "".join(f"<td><p>{linea(c)}</p></td>" for c in f) + "</tr>"
            salida.append(t + "</tbody></table>")
            continue

        # Cita
        if l.startswith(">"):
            cerrar_parrafo()
            citas = []
            while i < len(lineas) and lineas[i].strip().startswith(">"):
                citas.append(lineas[i].strip()[1:].lstrip())
                i += 1
            salida.append("<blockquote>" + "".join(f"<p>{linea(c)}</p>" for c in citas if c) + "</blockquote>")
            continue

        # Listas (con o sin casillas)
        m = re.match(r"^([-*+]|\d+[.)])\s+(.*)$", l)
        if m:
            cerrar_parrafo()
            ordenada = m.group(1)[0].isdigit()
            items: list[str] = []
            while i < len(lineas):
                mm = re.match(r"^\s*([-*+]|\d+[.)])\s+(.*)$", lineas[i])
                if not mm or (mm.group(1)[0].isdigit()) != ordenada:
                    break
                cuerpo = mm.group(2)
                casilla = re.match(r"^\[( |x|X)\]\s*(.*)$", cuerpo)
                if casilla:
                    marca = "☑ " if casilla.group(1).lower() == "x" else "☐ "
                    cuerpo = marca + casilla.group(2)
                items.append(f"<li><p>{linea(cuerpo)}</p></li>")
                i += 1
            etiqueta = "ol" if ordenada else "ul"
            salida.append(f"<{etiqueta}>" + "".join(items) + f"</{etiqueta}>")
            continue

        parrafo.append(l)
        i += 1

    cerrar_parrafo()
    return "".join(salida)
