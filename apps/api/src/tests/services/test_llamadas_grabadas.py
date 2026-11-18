"""Las llamadas de Zoom a Drive: quién era cada grabación (18/11/2026)."""

from src.db.contact_seguimiento import CallOutcome  # noqa: F401  (crea la tabla)
from src.db.enrollment import Enrollment  # noqa: F401
from src.db.panel_negocio import LeadPipeline  # noqa: F401
from src.services.contactos import llamadas_grabadas as LG


def _cita(email, inicio, enlace="", anfitrion="diego@nawar.es", estado="activa"):
    return {"email": email, "nombre": email.split("@")[0], "inicio": inicio, "enlace": enlace,
            "anfitrion_email": anfitrion, "estado": estado, "id": f"ev:{email}"}


def test_id_de_zoom():
    assert LG.id_zoom_de("https://us02web.zoom.us/j/86012345678?pwd=abc") == "86012345678"
    assert LG.id_zoom_de("https://meet.google.com/abc") == ""


def test_emparejar_por_numero_de_reunion():
    citas = [_cita("ana@x.com", "2026-11-10T17:00:00Z", "https://zoom.us/j/86012345678?pwd=1"),
             _cita("luis@x.com", "2026-11-10T17:05:00Z")]
    item = {"meeting_id": "860 1234 5678", "inicio": "2026-11-10T17:06:00Z"}
    assert LG.emparejar(item, citas)["email"] == "ana@x.com"


def test_emparejar_por_hora_y_anfitrion():
    citas = [_cita("ana@x.com", "2026-11-10T17:00:00Z", anfitrion="belen@nawar.es"),
             _cita("luis@x.com", "2026-11-10T17:00:00Z", anfitrion="diego@nawar.es"),
             _cita("lejos@x.com", "2026-11-10T19:00:00Z"),
             _cita("cancelada@x.com", "2026-11-10T17:02:00Z", estado="cancelada")]
    item = {"meeting_id": "999", "inicio": "2026-11-10T17:03:00Z", "anfitrion_email": "Diego@nawar.es"}
    assert LG.emparejar(item, citas)["email"] == "luis@x.com"
    # Sin anfitrión y dos a la misma hora: no se adivina.
    assert LG.emparejar({"inicio": "2026-11-10T17:03:00Z"}, citas) is None
    # Nada a menos de 20 minutos.
    assert LG.emparejar({"inicio": "2026-11-10T18:00:00Z"}, citas) is None


async def test_clasificar_quien_compro(db, org, monkeypatch):
    from src.db.enrollment import Enrollment
    from src.db.panel_negocio import LeadPipeline

    db.add(Enrollment(email="ana@x.com", status="paid", amount_cents=43500))
    db.add(LeadPipeline(email="ana@x.com", etapa="", closer="Diego", closer_id=3))
    await db.commit()

    async def citas(desde, hasta):
        return [_cita("luis@x.com", "2026-11-10T17:00:00Z", "https://zoom.us/j/11122233344")]

    monkeypatch.setattr(LG, "citas_entre", citas)
    r = await LG.clasificar(
        [
            {"clave": "a", "email": "Ana@x.com"},
            {"clave": "b", "meeting_id": "11122233344", "inicio": "2026-11-10T17:01:00Z"},
            {"clave": "c", "inicio": "2026-11-12T10:00:00Z"},
        ],
        db,
    )
    ll = r["llamadas"]
    assert ll["a"]["compro"] is True and ll["a"]["pagado_eur"] == 435.0 and ll["a"]["closer"] == "Diego"
    assert ll["b"]["identificada"] is True and ll["b"]["email"] == "luis@x.com" and ll["b"]["compro"] is False
    assert ll["c"] == {"identificada": False}
