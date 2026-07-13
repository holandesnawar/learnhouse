# 🤖 Agente de Reportes — Playbook

> Instrucciones que sigue el agente CADA vez que genera un parte para el CEO,
> ya sea el aviso automático de los lunes o una petición bajo demanda ("status").
> El CEO es no técnico y habla español. Explicar claro, directo, sin jerga.

## Cuándo se dispara
1. **Automático:** lunes por la mañana (trigger programado → notificación al móvil).
2. **Bajo demanda:** cuando el CEO escribe "status", "ponme al día", "cómo vamos", "novedades", etc.

## Qué hacer en cada parte (paso a paso)

### 1. Leer el estado guardado
- Abrir `.ceo/PROGRESO-FORMACION.md` para saber en qué punto estaba la formación y contra qué meta medimos (M1–M8 para principios de septiembre 2026).

### 2. Mirar la actividad real en los DOS repos
Revisar desde la fecha del último parte (o últimos 7 días si es el lunes):
- **holandesnawar/learnhouse** (la plataforma / academia): commits nuevos, PRs abiertos/fusionados, subidas de archivos ("Add files via upload" suele ser contenido que sube el CEO/profes), ramas nuevas.
- **holandesnawar/portal** (Portal Estudiantes): lo mismo.
- Traducir lo técnico a lenguaje de negocio: "se subió X", "se publicó Y", "esto lleva parado desde…".

> ⚠️ **Límite conocido:** el contenido que un profe sube DENTRO de la academia
> (lecciones, presentaciones colgadas en una clase) vive en la base de datos de
> la plataforma, **no siempre en git**. Git capta lo que se sube al repo; para
> captar el 100% de la actividad de contenido haría falta enchufar el agente a
> la API de la plataforma (ver "Fase 2" abajo). Mientras tanto, el estado de
> producción se lleva en `PROGRESO-FORMACION.md` (lo que ve git + lo que el CEO
> reporta).

### 3. Calcular si vamos a tiempo
- Semanas restantes hasta el **1 de septiembre 2026**.
- Módulos hechos vs. módulos que faltan crear (M5–M8 son los pesados).
- Ritmo necesario: (módulos por crear) ÷ (semanas restantes). Decir claramente **verde / ámbar / rojo**.

### 4. Escribir el parte (formato)
Siempre en español, formato CEO ocupado:

```
📋 PARTE — [fecha]

🟢/🟡/🔴 ¿Vamos a tiempo para septiembre (M1–M8)?  → una frase.

✅ Novedades (qué se movió desde el último parte)
🔧 En curso ahora mismo
⬜ Pendiente / sin empezar (lo que preocupa)
🙋 Decisiones que necesito de ti (si hay)
```
Corto por defecto. Si el CEO pide detalle, ampliar con la tabla por módulo.

### 5. Actualizar el tracker
- Si hubo novedades reales, actualizar `.ceo/PROGRESO-FORMACION.md` (tabla + bitácora + fecha) y commitear a la rama `claude/ceo-project-status-qelnyw`.
- Si el CEO da datos nuevos ("ya edité M2", "subí presentaciones M5"), reflejarlos en la tabla.

### 6. No dar la lata
- Si NO hay novedades desde el último parte, decirlo en una línea, sin inventar relleno.
- Preguntar solo lo imprescindible para afinar el tracker.

## Fase 2 (futuro, cuando el CEO quiera)
Enchufar el agente a la API de la academia para leer en vivo qué cursos,
lecciones y presentaciones existen y cuáles se subieron esta semana — así el
parte de "qué subió cada profe" sale solo, sin depender de lo que git vea.
Semilla ya existente: el endpoint de KPIs del PR #4 (`/api/v1/dashboard/overview`).

## Contexto del proyecto
- Meta: formación completa para principios de septiembre 2026; mínimo M1–M8.
- "Clase lista" = contenido + presentación + ejercicios (lezen/luisteren/diálogo/situación real/vocabulario) + edición.
- Repos vigilados: `holandesnawar/learnhouse` (plataforma) y `holandesnawar/portal`.
- Los cambios de plataforma (PRs sin fusionar, rediseños) están APARCADOS por decisión del CEO — el foco es el contenido de la formación.
