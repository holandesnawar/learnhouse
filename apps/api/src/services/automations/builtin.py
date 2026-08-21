"""
Lo que la escuela hace sola, contado en cristiano.

Esto NO es configuración: es el mapa de lo que ya está escrito en el código,
puesto en un sitio donde se pueda leer sin abrir un fichero .py. Sirve para
responder a la pregunta de siempre — "¿qué pasa exactamente cuando alguien se
da de alta?" — y para no montar dos veces la misma automatización.

Regla al tocar este fichero: **si cambias el código, cambia el texto**. Un mapa
que miente es peor que no tener mapa. Cada paso lleva el fichero donde vive,
para poder comprobarlo.
"""

from __future__ import annotations

BUILTIN_FLOWS: list[dict] = [
    {
        "id": "payment",
        "title": "Cuando alguien paga la formación",
        "summary": "Del cobro en Stripe a un alumno dentro de la escuela con su contraseña.",
        "steps": [
            {
                "text": "Stripe confirma el cobro y avisa a la escuela.",
                "where": "routers/payments.py · webhook payment_intent.succeeded",
            },
            {
                "text": "La matrícula pasa de «empezada» a «pagada», con el importe y la fecha.",
                "where": "services/payments/payments.py · _handle_payment_intent",
            },
            {
                "text": "Se crea su cuenta con el correo ya verificado (viene de un pago, es de fiar).",
                "where": "services/payments/payments.py · _create_paid_user",
            },
            {
                "text": "Entra automáticamente en el grupo «Alumnos».",
                "where": "services/orgs/groups.py · add_user_to_students",
            },
            {
                "text": "Recibe el correo «Crea tu contraseña» con su enlace personal.",
                "where": "services/users/emails.py · send_payment_welcome_email",
            },
            {
                "text": "Se genera la factura en PDF con numeración NAWAR-XXXX.",
                "where": "services/payments/payments.py · _create_post_hoc_invoice",
            },
        ],
    },
    {
        "id": "signup",
        "title": "Cuando alguien entra en la escuela",
        "summary": "Vale igual si paga, si le invitas o si le das de alta a mano.",
        "steps": [
            {
                "text": "Se le enlaza con la escuela como alumno.",
                "where": "services/users/users.py · create_user",
            },
            {
                "text": "Entra automáticamente en el grupo «Alumnos».",
                "where": "services/orgs/groups.py · add_user_to_students",
            },
            {
                "text": "Se le abre su conversación con el equipo, con la bienvenida ya dentro.",
                "where": "services/messages/direct.py · get_or_create_thread",
            },
            {
                "text": "Se ejecutan tus automatizaciones de «Cuando alguien entra en la escuela».",
                "where": "services/automations/engine.py",
            },
        ],
    },
    {
        "id": "first_messages",
        "title": "La bienvenida en Mis mensajes",
        "summary": "Le está esperando desde el momento en que se crea la cuenta.",
        "steps": [
            {
                "text": "Nada más crearse la cuenta se le abre su conversación con el equipo.",
                "where": "services/orgs/groups.py · add_user_to_students",
            },
            {
                "text": "Nace con el mensaje de bienvenida dentro (el que tú escribes en Ajustes de los mensajes).",
                "where": "services/messages/direct.py · welcome_text",
            },
            {
                "text": "El sobre del menú se le enciende sin tener que entrar a mirar, y a ti te aparece ya en la bandeja.",
                "where": "services/messages/direct.py · unread_total",
            },
        ],
    },
    {
        "id": "progress",
        "title": "Mientras estudia",
        "summary": "Lo que la escuela va apuntando sola, sin que el alumno haga nada.",
        "steps": [
            {
                "text": "Al abrir una clase se cuenta el tiempo (solo con la pestaña delante, máximo una hora por visita).",
                "where": "components/…/LessonViewer.tsx",
            },
            {
                "text": "Al terminarla se guarda como completada y se le suma el tiempo.",
                "where": "routers/student.py · lesson-completions",
            },
            {
                "text": "Cada visita mantiene viva su racha de días.",
                "where": "routers/student.py · visit",
            },
            {
                "text": "Cada ejercicio guarda la nota y las palabras que ha fallado, para el repaso.",
                "where": "routers/exercise_attempts.py",
            },
        ],
    },
    {
        "id": "drip",
        "title": "El goteo de los módulos",
        "summary": "Los módulos se van abriendo según los días que lleve matriculado.",
        "steps": [
            {
                "text": "Se calcula con su fecha de alta y los días que hayas configurado en el curso.",
                "where": "services/courses/locks.py",
            },
            {
                "text": "Cuando toca abrirse, aparece en su campana de avisos.",
                "where": "routers/community_engagement.py · notifications",
            },
            {
                "text": "No se guarda nada: se calcula cada vez, así que cambiar los días afecta a todos al momento.",
                "where": "services/courses/locks.py",
            },
        ],
    },
    {
        "id": "community",
        "title": "En la comunidad",
        "summary": "Lo que enciende el punto rojo de la campana. Nada de esto manda correo.",
        "steps": [
            {
                "text": "Si le mencionan con @su-nombre o con @all.",
                "where": "routers/community_engagement.py",
            },
            {
                "text": "Si fijas un mensaje como importante.",
                "where": "services/communities/discussions.py",
            },
            {
                "text": "Si mandas un aviso desde el panel.",
                "where": "routers/superadmin.py · avisos",
            },
        ],
    },
]
