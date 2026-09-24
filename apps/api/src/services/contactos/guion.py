"""
Guion de llamada del closer: qué contar, en qué orden, y cómo responder a las
dudas de siempre. Así cualquiera que llame dice lo mismo que la web (precio,
garantía, qué incluye).

Vive en org_config["guion_llamada"] como texto: lo editan el administrador
y el closer desde la propia pantalla. Si no hay nada guardado, sale el
de fábrica de abajo. Formato sencillo: "## " es un título, "- " un punto.

⚠️ Si cambian el precio, la garantía o lo que incluye la formación, hay que
cambiarlo aquí también (y en la landing y el checkout: ver CLAUDE.md).
"""

from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organization_config import OrganizationConfig

GUION_DE_FABRICA = """## Antes de llamar
- Abre su ficha: lee sus respuestas (nivel, para qué lo quiere, horas, dinero) y tus notas de la última vez.
- Mira si ya vio el precio. Si no, no lo sueltes al principio: primero su caso.
- Ten a mano el botón "Crear su enlace de pago": si dice que sí, se lo mandas en la misma llamada.

## 1. Abrir (2 min)
- "Hola [nombre], soy [tu nombre] de Holandés Nawar. Rellenaste el formulario para hablar de tu neerlandés, ¿te pillo bien? Son unos 20-30 minutos."
- Di para qué es la llamada: ver su caso y decirle con sinceridad si la formación le sirve o no.

## 2. Su situación (10 min, que hable él)
- "¿Qué te hizo buscar clases ahora?"
- "¿Para qué lo necesitas: trabajo, papeles, el día a día, tus hijos?"
- "¿Qué has probado ya y por qué no te funcionó?"
- "¿Qué cambiaría en tu vida si en unos meses pudieras defenderte en neerlandés?"
- "¿Cuánto tiempo al día le puedes dar de verdad?"
- Apunta lo que diga en las notas: es lo que usarás al presentar.

## 3. Presentar la formación (5 min, con SUS palabras)
- Formación A0 → A1: 16 semanas, 7 módulos, más de 15 h de vídeo explicado desde el español.
- Lecciones y ejercicios paso a paso en la escuela, con su progreso.
- Una clase en directo cada semana con un profesor (y si no puede, queda grabada).
- Comunidad privada de alumnos y dudas con el equipo.
- 6 meses de acceso y certificado al terminar.
- Con 20-30 minutos al día llega a presentarse, pedir cita y hacer la compra en neerlandés.
- Conéctalo con lo que te ha contado: "Me dijiste que [su motivo]; esto está pensado justo para eso."

## 4. Precio
- "La inversión es de 397 €, precio de la cohorte fundadora. Después pasa a 497 €."
- Pago único con IVA incluido. Se puede pagar con iDEAL o tarjeta, o a plazos con Klarna sin recargo.
- Garantía de 15 días: si no es para él, escribe a soporte@holandesnawar.com y se le devuelve el 100 %.
- Después del precio, calla y deja que conteste.

## 5. Dudas de siempre
- "Es caro": "¿Comparado con qué? Una academia presencial sale a más al mes. Y con Klarna lo puedes pagar a plazos sin recargo."
- "No tengo tiempo": "Son 20-30 minutos al día y las clases quedan grabadas. ¿Cuánto tiempo pierdes ahora por no entender?"
- "Lo tengo que pensar": "Claro. ¿Qué es lo que te hace dudar exactamente?" Resuélvelo. Si aún quiere pensarlo, pon fecha para volver a llamar.
- "Lo tengo que hablar con mi pareja": "Perfecto. ¿Qué crees que te va a preguntar?" Queda en una hora concreta para volver a hablar.
- "Ya probé y no me funcionó": "¿Qué faltó? Aquí tienes clase en directo cada semana y un camino ordenado, no vídeos sueltos."
- "Tengo miedo de no seguir el ritmo": "Hay semanas de repaso entre módulos y tienes 6 meses de acceso. Y la garantía de 15 días."

## 6. Cerrar
- "¿Te parece bien que te mande ahora el enlace para apuntarte?" Crea su enlace de pago y mándaselo por WhatsApp mientras seguís hablando.
- Quédate en la llamada hasta que pague si puede; si no, queda en una hora concreta.
- Si no es el momento: pon la fecha de "volver a llamar" y una nota con el motivo.

## Después de colgar
- Nota corta: qué le frena y qué le dijiste.
- Marca la llamada como atendida.
- Si pagó, no hace falta nada más: le llega solo el correo para entrar a la escuela.
"""


async def leer_guion(org_id: int, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    guardado = ""
    if fila and isinstance(fila.config, dict):
        guardado = str((fila.config.get("guion_llamada") or {}).get("texto") or "")
    return {"texto": guardado or GUION_DE_FABRICA, "de_fabrica": not guardado}


async def guardar_guion(org_id: int, texto: str, db_session: AsyncSession) -> dict:
    """Texto vacío = volver al de fábrica."""
    import json

    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    config = json.loads(json.dumps(fila.config or {}))
    config["guion_llamada"] = {"texto": (texto or "").strip()[:20000]}
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()
    return await leer_guion(org_id, db_session)
