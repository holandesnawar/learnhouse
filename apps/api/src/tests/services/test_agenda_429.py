import asyncio

import httpx

from src.services.contactos import agenda as A


def _evento(uuid, updated="2026-11-14T10:00:00Z"):
    return {"uri": f"https://api.calendly.com/scheduled_events/{uuid}", "updated_at": updated,
            "status": "active", "start_time": "2026-11-20T10:00:00.000000Z",
            "end_time": "2026-11-20T10:45:00.000000Z", "name": "Llamada"}


def test_la_agenda_no_pide_otra_vez_los_invitados_y_aguanta_un_429(monkeypatch):
    monkeypatch.setenv("LEARNHOUSE_CALENDLY_TOKEN", "x")
    A._cache.update({"hasta": 0.0, "datos": None})
    A._invitados.clear()
    A._yo.update({"hasta": 0.0, "datos": None})
    pedidas = []
    fallar = {"si": False}

    async def falso(cliente, url, params=None):
        pedidas.append(url)
        if fallar["si"]:
            raise httpx.HTTPStatusError("429", request=httpx.Request("GET", url),
                                        response=httpx.Response(429, request=httpx.Request("GET", url)))
        if url.endswith("/users/me"):
            return {"resource": {"uri": "u"}}
        if url.endswith("/scheduled_events"):
            return {"collection": [_evento("a"), _evento("b")]}
        return {"collection": [{"email": "ana@x.com", "name": "Ana", "status": "active"}]}

    monkeypatch.setattr(A, "_get", falso)
    primera = asyncio.run(A.agenda(forzar=True))
    assert len(primera["citas"]) == 2
    n = len(pedidas)
    asyncio.run(A.agenda(forzar=True))
    # Segunda vez: solo la lista de citas (ni «quién soy» ni invitados).
    assert len(pedidas) - n == 1
    fallar["si"] = True
    otra = asyncio.run(A.agenda(forzar=True))
    assert "error" not in otra and len(otra["citas"]) == 2
