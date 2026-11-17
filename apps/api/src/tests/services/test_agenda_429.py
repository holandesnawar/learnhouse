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



class _RedisFalso:
    def __init__(self):
        self.d = {}

    def set(self, k, v, ex=None):
        self.d[k] = v

    def get(self, k):
        return self.d.get(k)


def _limpiar(monkeypatch):
    monkeypatch.setenv("LEARNHOUSE_CALENDLY_TOKEN", "x")
    A._cache.clear()
    A._cache.update({"hasta": 0.0, "datos": None})
    A._invitados.clear()
    A._yo.update({"hasta": 0.0, "datos": None})


def test_tras_un_despliegue_si_calendly_falla_se_usa_la_ultima_de_redis(monkeypatch):
    _limpiar(monkeypatch)
    redis = _RedisFalso()
    monkeypatch.setattr(A, "_redis", lambda: redis)
    fallar = {"si": False}

    async def falso(cliente, url, params=None):
        if fallar["si"]:
            raise httpx.ConnectError("caído")
        if url.endswith("/users/me"):
            return {"resource": {"uri": "u"}}
        if url.endswith("/scheduled_events"):
            return {"collection": [_evento("a")]}
        return {"collection": [{"email": "ana@x.com", "name": "Ana", "status": "active"}]}

    monkeypatch.setattr(A, "_get", falso)
    assert len(asyncio.run(A.agenda(forzar=True))["citas"]) == 1
    assert A._CLAVE_ULTIMA in redis.d
    # «Despliegue»: la memoria se vacía y Calendly no contesta.
    A._cache.update({"hasta": 0.0, "datos": None})
    fallar["si"] = True
    otra = asyncio.run(A.agenda(forzar=True))
    assert "error" not in otra and [c["email"] for c in otra["citas"]] == ["ana@x.com"]


def test_varias_pantallas_a_la_vez_piden_la_agenda_una_sola_vez(monkeypatch):
    _limpiar(monkeypatch)
    monkeypatch.setattr(A, "_redis", lambda: None)
    listas = []

    async def falso(cliente, url, params=None):
        if url.endswith("/users/me"):
            return {"resource": {"uri": "u"}}
        if url.endswith("/scheduled_events"):
            listas.append(url)
            await asyncio.sleep(0.05)
            return {"collection": [_evento("a")]}
        return {"collection": [{"email": "ana@x.com", "name": "Ana", "status": "active"}]}

    monkeypatch.setattr(A, "_get", falso)

    async def cinco():
        return await asyncio.gather(*(A.agenda() for _ in range(5)))

    resultados = asyncio.run(cinco())
    assert len(listas) == 1 and all(len(r["citas"]) == 1 for r in resultados)


def test_con_muchas_paginas_no_se_pierden_las_lejanas(monkeypatch):
    _limpiar(monkeypatch)
    monkeypatch.setattr(A, "_redis", lambda: None)
    paginas = {"n": 0}

    async def falso(cliente, url, params=None):
        if url.endswith("/users/me"):
            return {"resource": {"uri": "u"}}
        if url.endswith("/invitees"):
            return {"collection": [{"email": "ana@x.com", "name": "Ana", "status": "active"}]}
        # 8 páginas de una cita cada una (antes se cortaba en 5).
        paginas["n"] += 1
        n = paginas["n"]
        return {
            "collection": [_evento(f"e{n}")],
            "pagination": {"next_page": f"https://api.calendly.com/pagina/{n + 1}" if n < 8 else None},
        }

    monkeypatch.setattr(A, "_get", falso)
    assert len(asyncio.run(A.agenda(forzar=True))["citas"]) == 8
