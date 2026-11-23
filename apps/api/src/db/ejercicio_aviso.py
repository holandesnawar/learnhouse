"""
«¿Ves un fallo? Avísanos» (23/11/2026): lo que un alumno avisa de un
ejercicio de las lecciones. La lógica y el porqué, en
`services/ejercicios/avisos.py`.

Tabla nueva: la crea `create_all` al arrancar. Una fila por alumno y
ejercicio (si avisa otra vez del mismo, se actualiza la suya).
"""

from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class EjercicioAviso(SQLModel, table=True):
    __tablename__ = "ejercicio_aviso"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=0, index=True)
    user_id: int = Field(default=0, index=True)
    # La lección de `courseData.ts` («m2-les-1-familie») y el id del ejercicio
    # dentro de ella («m2l1e-7»). Con los dos se encuentra en el código.
    lesson_id: str = Field(default="", max_length=120, index=True)
    exercise_id: str = Field(default="", max_length=160, index=True)
    # respuesta · varias · texto · audio · otra
    motivo: str = Field(default="otra", max_length=12)
    comentario: str = Field(default="", sa_column=Column(Text, default=""))
    # Lo que se veía en pantalla, en JSON: tipo, enunciado, opciones, la
    # respuesta que la escuela da por buena, lo que contestó el alumno, el
    # nombre de la lección y del módulo y, si se abrió dentro de la formación,
    # el curso y la clase.
    datos: str = Field(default="{}", sa_column=Column(Text, default="{}"))
    # nuevo · arreglado · no-era
    estado: str = Field(default="nuevo", max_length=12, index=True)
    created_at: str = ""
    updated_at: str = ""
    cerrado_at: str = ""
    cerrado_por: str = Field(default="", max_length=120)
