"""
Guion de llamada del closer: qué contar, en qué orden, y cómo responder a las
dudas de siempre. Así cualquiera que llame dice lo mismo que la web (precio,
garantía, qué incluye).

Vive en org_config["guion_llamada"] como texto: lo editan el administrador
y el closer desde la propia pantalla. Si no hay nada guardado, sale el
de fábrica de abajo. Formato sencillo: "## " es un título, "### " un
subtítulo (las preguntas), "- " un punto.

**Enfoque** (25/10/2026, "un documento para el closer con el cambio
explicado… con puntos y preguntas que puede tener la gente, junto con precio
y todo"): una segunda página igual, en org_config["enfoque_closer"], con el
programa nuevo (masterclass y spreekuren) contado para vender. Lo que no se
sabía al escribirla (días, horas, grabaciones…) va como «[POR COMPLETAR: …]»:
no se inventa nada, se rellena desde la pantalla.

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
- Formación A0 → A1: 16 semanas, 10 módulos, más de 15 h de vídeo explicado desde el español.
- Lecciones y ejercicios paso a paso en la escuela, con su progreso.
- En directo cada semana (desde el 26/10): una masterclass con un profesor y dos spreekuren para practicar hablando con otros alumnos. Lo explica todo la pestaña «Enfoque».
- Comunidad privada de alumnos y dudas con el equipo.
- 6 meses de acceso y certificado al terminar.
- Con 20-30 minutos al día llega a presentarse, pedir cita y hacer la compra en neerlandés.
- Conéctalo con lo que te ha contado: "Me dijiste que [su motivo]; esto está pensado justo para eso."

## 4. Precio
- "La inversión es de 597 €, IVA incluido. Lo puedes pagar de una vez con iDEAL o tarjeta, o con Klarna a plazos sin recargo."
- Solo si Klarna no le vale o no le funciona: nuestro plan a plazos, 3 pagos de 230 € (690 €). Entra con el primer pago (botón «A plazos» de su ficha).
- Garantía de 15 días: si no es para él, escribe a soporte@holandesnawar.com y se le devuelve el 100 %.
- Después del precio, calla y deja que conteste.

## 5. Dudas de siempre
- "Es caro": "¿Comparado con qué? Una academia presencial sale a más al mes. Y con Klarna lo puedes pagar a plazos sin recargo."
- "No tengo tiempo": "Son 20-30 minutos al día, cuando a ti te venga: las lecciones están abiertas a cualquier hora. ¿Cuánto tiempo pierdes ahora por no entender?"
- "Lo tengo que pensar": "Claro. ¿Qué es lo que te hace dudar exactamente?" Resuélvelo. Si aún quiere pensarlo, pon fecha para volver a llamar.
- "Lo tengo que hablar con mi pareja": "Perfecto. ¿Qué crees que te va a preguntar?" Queda en una hora concreta para volver a hablar.
- "Ya probé y no me funcionó": "¿Qué faltó? Aquí tienes una masterclass en directo cada semana, dos sesiones para hablar y un camino ordenado, no vídeos sueltos."
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




ENFOQUE_DE_FABRICA = """## Qué ha cambiado (desde el 26/10/2026)
- Quien se matricula desde el 26/10 entra en el programa nuevo: cada semana, una masterclass en directo y dos spreekuren para practicar hablando.
- Ya NO se vende la «clase semanal de conversación». Esa clase sigue, pero solo para los alumnos de la primera convocatoria (la beta).
- La formación es la misma: lecciones, ejercicios, módulos, consultas, comunidad y certificado. Cambia solo la parte en directo.
- El precio: 597 € (ver «Precio»).
- Por qué (para ti, no para la llamada): la masterclass la pueden seguir muchos alumnos a la vez, y para hablar están los spreekuren. Así podemos atender a más gente sin que las clases se llenen.

## Cómo es una semana del alumno
- Sus lecciones y ejercicios en la escuela: 20-30 minutos al día, cuando le venga bien.
- 1 masterclass en directo con un profesor. [POR COMPLETAR: día, hora y duración]
- 2 spreekuren: sesiones en directo para hablar en neerlandés con otros alumnos, con un profe que guía la conversación. [POR COMPLETAR: días, horas, duración y cuántos alumnos por sesión]
- Dudas por consultas y la comunidad de alumnos, cuando quiera.

## Qué incluye
- Formación A0 → A1: 16 semanas, 10 módulos, más de 15 h de vídeo explicado desde el español.
- Lecciones y ejercicios paso a paso en la escuela, con su progreso.
- Empieza el día que paga, sin esperar a una convocatoria. Los módulos 1 y 2 están abiertos desde el primer día y los siguientes se le abren según termina los anteriores (como mucho uno por semana, para que no se agobie).
- 1 masterclass en directo a la semana.
- 2 spreekuren a la semana para practicar hablando.
- Consultas con el equipo y comunidad privada de alumnos.
- 6 meses de acceso y certificado al terminar.

## Precio
- 597 €, IVA incluido. De una vez con iDEAL o tarjeta, o con Klarna a plazos sin recargo.
- Si Klarna no le vale o no le funciona: nuestro plan a plazos, 3 pagos de 230 € (690 €). Entra con el primer pago. Botón «A plazos» de su ficha.
- Si en la llamada no le funciona el pago, puede reservar su plaza con una señal de 50 € («Cobrar una señal» en su ficha). Con la señal no entra todavía: entra al pagar el resto.
- Garantía de 15 días: si no es para él, escribe a soporte@holandesnawar.com y se le devuelve el 100 %.

## Cómo contarlo en la llamada
- "Además de las lecciones, cada semana tienes tres momentos en directo: una masterclass con el profesor y dos sesiones para hablar neerlandés con otros alumnos."
- Engancha los spreekuren con lo que te haya contado: si le da vergüenza hablar o nunca practica, esto es justo para eso.
- No digas «clase semanal de conversación»: era de la primera convocatoria.
- Si te pregunta algo que no está en esta página (un día exacto, un profe concreto), no lo inventes: "Te lo confirmo hoy por WhatsApp", y pregúntalo al equipo.

## Leads con los que hablaste antes del cambio
- A quien antes del 26/10 se le vendió la clase de conversación (por ejemplo, los que están en «Por pagar»), se le respeta: cuando pague, Rida le pone en la beta, con la clase de conversación.
- Si le prometiste la clase de conversación, déjalo en una nota de su ficha: «Se le vendió la clase de conversación».
- A todos los demás, desde el 26/10, el programa nuevo.

## Preguntas que te van a hacer

### ¿Qué es la masterclass?
Una clase en directo cada semana con un profesor de la escuela. [POR COMPLETAR: qué se trabaja en ella (el tema del módulo, dudas…), día, hora y duración]

### ¿Qué son los spreekuren?
Sesiones en directo, dos veces por semana, para practicar hablando en neerlandés con otros alumnos, con un profe que guía la conversación. Son para soltarse a hablar con lo que va aprendiendo en las lecciones. [POR COMPLETAR: días, horas, duración y cuántos alumnos por sesión]

### ¿Tengo que saber hablar para ir a los spreekuren?
No hace falta saber hablar: son para practicar lo que va aprendiendo, a su nivel. [POR COMPLETAR: si puede ir desde el primer día o a partir de cierto módulo]

### ¿Es una clase de conversación?
Hay más práctica de hablar que eso: dos veces por semana habla en los spreekuren, y además tiene la masterclass para aprender con el profesor.

### ¿Y si no puedo ir en directo?
Las lecciones y los ejercicios están abiertos a cualquier hora. [POR COMPLETAR: si la masterclass queda grabada y dónde se ve]. Los spreekuren son para hablar en directo.

### ¿Quién da las clases?
[POR COMPLETAR: quién da la masterclass y quién los spreekuren]

### ¿Cuándo empiezo?
El mismo día que paga: le llega un correo para crear su contraseña y entra en la escuela. El acceso a la masterclass y a los spreekuren se lo activamos nosotros en cuanto vemos su pago.

### ¿Cuánto dura?
16 semanas y 10 módulos, con 6 meses de acceso. Con 20-30 minutos al día va a buen ritmo.

### ¿Cuánto cuesta? ¿Se puede pagar a plazos?
597 €, IVA incluido, de una vez o con Klarna a plazos sin recargo. Si Klarna no le vale, nuestro plan a plazos: 3 pagos de 230 € (690 €).

### ¿Por qué a plazos sale más caro?
Pagando de una vez o con Klarna son 597 €. Nuestro plan a plazos es para quien no puede usar Klarna, y por eso cuesta algo más.

### ¿Y si no me gusta?
Tiene 15 días de garantía: si no es para él, se le devuelve el 100 %.

### ¿Hay certificado?
Sí, al terminar la formación.

### ¿Puedo preguntar mis dudas?
Sí: por consultas al equipo y en la comunidad de alumnos.

### Un amigo mío tiene clase de conversación, ¿por qué yo no?
Era el formato de la primera convocatoria. Desde el 26/10 la formación tiene una masterclass y dos spreekuren a la semana: más tiempo para hablar.
"""


async def _leer(org_id: int, clave: str, de_fabrica: str, db_session: AsyncSession) -> dict:
    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    guardado = ""
    if fila and isinstance(fila.config, dict):
        guardado = str((fila.config.get(clave) or {}).get("texto") or "")
    return {"texto": guardado or de_fabrica, "de_fabrica": not guardado}


async def _guardar(org_id: int, clave: str, texto: str, db_session: AsyncSession) -> None:
    """Texto vacío = volver al de fábrica."""
    import json

    fila = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    if fila is None:
        raise ValueError("La escuela no tiene configuración")
    config = json.loads(json.dumps(fila.config or {}))
    config[clave] = {"texto": (texto or "").strip()[:20000]}
    fila.config = config
    fila.update_date = str(datetime.now())
    db_session.add(fila)
    await db_session.commit()


async def leer_guion(org_id: int, db_session: AsyncSession) -> dict:
    return await _leer(org_id, "guion_llamada", GUION_DE_FABRICA, db_session)


async def guardar_guion(org_id: int, texto: str, db_session: AsyncSession) -> dict:
    """Texto vacío = volver al de fábrica."""
    await _guardar(org_id, "guion_llamada", texto, db_session)
    return await leer_guion(org_id, db_session)


async def leer_enfoque(org_id: int, db_session: AsyncSession) -> dict:
    return await _leer(org_id, "enfoque_closer", ENFOQUE_DE_FABRICA, db_session)


async def guardar_enfoque(org_id: int, texto: str, db_session: AsyncSession) -> dict:
    """Texto vacío = volver al de fábrica."""
    await _guardar(org_id, "enfoque_closer", texto, db_session)
    return await leer_enfoque(org_id, db_session)
