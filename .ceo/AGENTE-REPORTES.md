# 🤖 Agente de Reportes — Playbook

> Instrucciones que sigue el agente CADA vez que genera un parte para el CEO,
> ya sea el aviso automático de los lunes o una petición bajo demanda ("status").
> El CEO es no técnico y habla español. Explicar claro, directo, sin jerga.

## Cuándo se dispara
1. **Automático:** lunes por la mañana (trigger programado → notificación al móvil + email).
2. **Bajo demanda:** cuando el CEO escribe "status", "ponme al día", "cómo vamos", "novedades", etc.

## Qué hacer en cada parte (paso a paso)

### 1. Leer el estado guardado
- Abrir `.ceo/PROGRESO-FORMACION.md` para saber en qué punto estaba la formación y contra qué meta medimos: **M1–M10 listos para principios de septiembre 2026**, con **deadline de grabaciones el 9 de agosto**.

### 2. Mirar la actividad real en los DOS repos
Revisar desde la fecha del último parte (o últimos 7 días si es el lunes):
- **holandesnawar/learnhouse** (la plataforma / academia): commits nuevos, PRs abiertos/fusionados, subidas de archivos ("Add files via upload" suele ser contenido), ramas nuevas.
- **holandesnawar/portal** (Portal Estudiantes): lo mismo.
- Traducir lo técnico a lenguaje de negocio.

> ⚠️ **Límite conocido:** las presentaciones/lecciones que un profe sube DENTRO
> de la academia (o en una herramienta de decks externa) **no siempre están en
> git**. Git capta lo que se sube al repo. Para captar el 100% de la actividad de
> contenido haría falta enchufar el agente a la API de la plataforma o a la
> herramienta de presentaciones (ver "Fase 2"). Mientras tanto, el estado de
> producción se lleva en `PROGRESO-FORMACION.md` (git + lo que el CEO reporta).

### 3. Calcular si vamos a tiempo (DOS hitos)
- **Grabación:** ¿llegan las profes al **9 de agosto**? (M1/M10 profe A, M6/M7 profe B, M8/M9 profe C, M5 director).
- **Post-producción:** ¿da tiempo a **editar/cortar/montar + presentaciones + ejercicios** de los 10 módulos antes del **1 de septiembre**? Este es el riesgo real — vigilarlo cada semana.
- Decir claramente **verde / ámbar / rojo** para cada hito.

### 4. Escribir el parte (formato)
Siempre en español, formato CEO ocupado:

```
📋 PARTE — [fecha]

🟢/🟡/🔴 Grabación (deadline 9 ago) → una frase.
🟢/🟡/🔴 Montaje/edición (deadline 1 sep) → una frase.

✅ Novedades (qué se movió desde el último parte)
🔧 En curso ahora mismo
⬜ Pendiente / lo que preocupa
🙋 Decisiones que necesito de ti (si hay)
```
Corto por defecto. Si el CEO pide detalle, ampliar con la tabla por módulo.

### 5. Actualizar el tracker
- Si hubo novedades reales o el CEO da datos nuevos, actualizar `.ceo/PROGRESO-FORMACION.md` (tabla + bitácora + fecha) y commitear a la rama `claude/ceo-project-status-qelnyw`.

### 6. No dar la lata
- Si NO hay novedades, decirlo en una línea, sin inventar relleno.

## Fase 2 (futuro, cuando el CEO quiera)
Enchufar el agente a: (a) la API de la academia (`/api/v1/dashboard/overview`,
PR #4) para leer qué lecciones/presentaciones existen y cuáles son nuevas; y/o
(b) la herramienta de presentaciones (p.ej. Canva, si ahí montan los decks) para
detectar decks nuevos. Así "qué subió cada profe esta semana" sale solo.

## Contexto del proyecto
- Meta: **M1–M10** completos para principios de septiembre 2026. Deadline grabaciones: **9 ago**.
- "Clase lista" = grabación + presentación + ejercicios (lezen/luisteren/diálogo/situación real/vocabulario) + edición/montaje.
- Riesgo principal: **post-producción** (edición/corte/montaje/presentaciones), no la grabación.
- Repos vigilados: `holandesnawar/learnhouse` (plataforma) y `holandesnawar/portal`.
- Los cambios de CÓDIGO de plataforma (PRs sin fusionar, rediseños) están APARCADOS por decisión del CEO — el foco es el contenido de la formación.
