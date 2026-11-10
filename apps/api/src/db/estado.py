"""
Estado de la escuela (10/11/2026): lo que falla y lo que va lento, apuntado
por la propia escuela para enterarse antes que los alumnos. La explicación
entera, en `src/services/estado/estado.py`.

Una sola tabla, `estado_evento`. Cada fila es una de estas cosas (`tipo`):

- `error-api`: una petición que acabó en 5xx o en una excepción sin capturar.
- `lenta`: una petición que tardó más del umbral (2 s).
- `error-pantalla`: una pantalla que se rompió en el navegador de alguien.
- `arranque`: la API acaba de arrancar (un reinicio o un despliegue).
- `tiempos`: cuánto tardaron TODAS las peticiones de una ruta en una hora
  (un histograma en `mensaje`, en JSON), para sacar la mediana y el p95.

Sin datos personales: la ruta va como plantilla (`/tareas/course/{course_uuid}`),
el mensaje pasa por `limpiar_texto` (fuera correos y claves) y de la persona
solo se guarda su id.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class EstadoEvento(SQLModel, table=True):
    __tablename__ = "estado_evento"

    id: Optional[int] = Field(default=None, primary_key=True)
    tipo: str = Field(default="", index=True, max_length=20)
    # Momento del primer caso (ISO, UTC). En `tiempos`, el principio de la hora.
    cuando: str = Field(default="", index=True, max_length=32)
    # El último caso agrupado en esta fila (ISO, UTC).
    ultima: str = Field(default="", max_length=32)
    # Para agrupar los repetidos del mismo minuto (o de la misma hora en
    # `tiempos`): un resumen de tipo + ruta + método + status + mensaje +
    # persona + minuto.
    clave: str = Field(default="", index=True, max_length=40)
    ruta: str = Field(default="", max_length=200)
    metodo: str = Field(default="", max_length=8)
    status: int = 0
    # Lo que tardó (el caso más lento de los agrupados). En `tiempos`, la suma.
    ms: int = 0
    # Clase del error y su primera línea, ya limpio. En `tiempos`, el histograma.
    mensaje: str = Field(default="", max_length=600)
    user_id: Optional[int] = Field(default=None, index=True)
    rol: str = Field(default="", max_length=20)
    # «iPhone · Safari 17».
    navegador: str = Field(default="", max_length=60)
    # La pantalla de la escuela desde la que se pidió (ruta del front).
    pagina: str = Field(default="", max_length=200)
    # Detalles sueltos: «traducida», «app», «trozo».
    extra: str = Field(default="", max_length=80)
    # El commit desplegado (los 12 primeros caracteres).
    version: str = Field(default="", max_length=40)
    veces: int = 1
