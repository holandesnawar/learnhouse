"""Quien ya pagó deja de salir para llamar (03/10: Zulay pagó y seguía en
«Para llamar hoy», y en Llamadas no había forma de decir «Pagó»)."""

import pytest

from src.db.contact_seguimiento import ContactRecordatorio
from src.db.enrollment import Enrollment
from src.services.contactos.resultado_llamada import RESULTADOS, guardar_resultado
from src.services.contactos.seguimiento import todos_los_recordatorios


@pytest.mark.asyncio
async def test_quien_pago_no_sale_para_llamar(db):
    db.add(Enrollment(email="zulay@x.com", first_name="Zulay", last_name="G", status="paid", created_at="2026-10-01"))
    db.add(ContactRecordatorio(email="zulay@x.com", fecha="2026-10-03"))
    db.add(ContactRecordatorio(email="lead@x.com", fecha="2026-10-03"))
    await db.commit()

    tocan = await todos_los_recordatorios(db)
    assert "lead@x.com" in tocan
    assert "zulay@x.com" not in tocan


@pytest.mark.asyncio
async def test_resultado_pagado_existe_y_quita_la_fecha(db):
    assert RESULTADOS["pagado"] == "Pagó"
    db.add(ContactRecordatorio(email="ana@x.com", fecha="2026-10-03"))
    await db.commit()

    await guardar_resultado("cita-1", "ana@x.com", "pagado", "", "2026-10-02T10:00:00Z", "Closer", None, db)

    tocan = await todos_los_recordatorios(db)
    assert "ana@x.com" not in tocan
