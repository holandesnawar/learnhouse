"""
Que la aplicación se pueda importar. Nada más, y es el test más importante.

Por qué existe
--------------
El 21/08/2026 la escuela estuvo caída porque `src/router.py` llamaba a
`router.include_router(...)` cuando la variable se llama `v1_router`. Eso es un
NameError de nivel de módulo: no salta al compilar, salta al **importar**. La
comprobación que se hacía antes de subir era `python -m py_compile`, que solo
mira la sintaxis, así que pasó limpia. En producción la API murió en el
arranque, nginx devolvió 502 en todo `/api/v1` y la escuela quedó inservible
aunque la web y nginx estuvieran perfectos.

Este test importa el router entero y comprueba que las rutas de las que depende
la escuela siguen ahí. Es rápido y coge toda una familia de errores —un nombre
mal escrito, un import que ya no existe, un decorador roto— antes de que salgan
de aquí.

Nota sobre las dependencias: en un contenedor de desarrollo puede faltar alguna
librería opcional (pgvector, google-genai…). Eso NO es un fallo nuestro, así
que se salta. Un error de los nuestros sí falla.
"""

import pytest


def _import_router():
    try:
        from src.router import v1_router

        return v1_router
    except ModuleNotFoundError as exc:  # pragma: no cover - depende del entorno
        pytest.skip(f"Falta una dependencia del entorno, no es cosa nuestra: {exc.name}")


def test_the_router_imports():
    # Si esto falla con NameError o AttributeError, la API no arranca en
    # producción. No lo arregles saltándote el test.
    assert _import_router() is not None


def _all_paths(router) -> set[str]:
    """Todas las rutas, mirando también dentro de los routers incluidos."""
    paths: set[str] = set()
    pending = [router]
    while pending:
        current = pending.pop()
        for route in getattr(current, "routes", []):
            path = getattr(route, "path", None)
            if isinstance(path, str):
                paths.add(path)
            inner = getattr(route, "router", None) or getattr(route, "app", None)
            if inner is not None and hasattr(inner, "routes"):
                pending.append(inner)
    return paths


@pytest.mark.parametrize(
    "needle",
    [
        # Railway mira esta para decidir si la versión nueva está viva.
        "/health",
        # Entrar, y las pantallas de las que depende el alumno todos los días.
        "/users",
        "/orgs",
        "/messages",
        "/student",
        # El cobro: si esto desaparece, se pierden matrículas.
        "/payments",
    ],
)
def test_the_paths_the_school_lives_on_are_registered(needle):
    paths = _all_paths(_import_router())
    if not paths:
        pytest.skip("Esta versión de FastAPI no deja leer las rutas incluidas")
    assert any(needle in p for p in paths), f"No hay ninguna ruta con «{needle}»"
