# CLAUDE.md — Holandés Nawar (LearnHouse self-hosted)

> Memoria del proyecto para que cualquier sesión nueva arranque con todo el contexto.
> Última actualización: 2026-05-30.

## Resumen
Academia de cursos sobre **LearnHouse**, auto-alojada en Railway.
- URL pública (academia/plataforma): **https://academia.holandesnawar.nl**
- Web principal / landing / matrícula (otro repo): **https://www.holandesnawar.com** — repo público `holandesnawar/nawar-web`.
- Edición: **OSS** · modo **single-org / single-tenancy** · `mode: oss`.
- Idioma del usuario: **español**, no técnico — explicar claro, paso a paso, móvil.

## Infraestructura (Railway)
Proyecto `cooperative-tenderness`, 3 servicios: **learnhouse** (la app, Dockerfile multi-stage: nginx + web Next.js + api FastAPI + collab), **Postgres**, **Redis**.
- Repo de la academia: `holandesnawar/learnhouse`.
- Repo de la web principal: `holandesnawar/nawar-web` (público, **otra sesión** porque MCP GitHub está scoped solo a learnhouse aquí).
- **Rama Railway por defecto: `dev`** (auto-deploy al hacer push).
- **Desarrollo activo en rama `claude/adoring-dijkstra-rI3FL`.** Para previsualizar: Railway → learnhouse → Settings → Source → cambiar a esa rama; para volver atrás, poner `dev` (red de seguridad).
- Volumen persistente en **`/app/api/content`** (logos/imágenes/uploads).

### Lecciones de puertos/URLs (NO romper)
- nginx escucha en **80**; web Next.js en **8000**; api en **9000**; collab en **4000**.
- `PORT=8000` (si no, Next.js arranca donde Railway diga y se salta nginx → 502).
- Target port del dominio en Railway = **80** (nginx es la puerta).
- **`NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL` DEBE terminar en `/`** (el código concatena `content/...` y `api/v1/...`).
- **NO** poner `NEXT_PUBLIC_LEARNHOUSE_API_URL` a pelo (causó el bug `railway.apporgs`).
- `LEARNHOUSE_REDIS_CONNECTION_STRING` con referencia `${{Redis.REDIS_URL}}`. Login usa Redis (rate-limit); si Redis falla → **500 en /login** con cara de "contraseña incorrecta" (engañoso).

### ⚠️ Bug de routing root-level en Next.js standalone en Railway
Páginas creadas en `apps/web/app/<nombre>/page.tsx` (root level, fuera de subcarpetas) **devuelven 404 en Railway aunque el build local las incluya** en el `routes-manifest.json`. Probado con `/bienvenido`, `/gracias`, etc. — el build verifica que el route compila, pero el contenedor en producción no la sirve.
**Workaround:** poner las páginas nuevas **dentro de subcarpetas que ya existen** (ej. `app/auth/<nombre>/page.tsx` funciona). Por eso `/auth/bienvenido`, `/auth/crear-cuenta`, `/auth/matricula-formacion-nawar-a0-a1` viven bajo `/auth/`.
**Solución limpia futura:** mover esas páginas (matricula, bienvenido) a `holandesnawar.com` y dejar la academia solo para el producto.

### Variables clave (nombres, NO valores)
**Backend:** `LEARNHOUSE_TENANCY=single`, `LEARNHOUSE_DOMAIN`, `LEARNHOUSE_FRONTEND_DOMAIN` (academia.holandesnawar.nl), `LEARNHOUSE_SSL=true`, `LEARNHOUSE_AUTH_JWT_SECRET_KEY` (≥32 chars), `LEARNHOUSE_SQL_CONNECTION_STRING`, `LEARNHOUSE_REDIS_CONNECTION_STRING`.
**Frontend:** `NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL` (con `/`), `NEXT_PUBLIC_LEARNHOUSE_DOMAIN`, `NEXT_PUBLIC_LEARNHOUSE_HTTPS=true`, `PORT=8000`.
**Email (Resend):** `LEARNHOUSE_EMAIL_PROVIDER=resend`, `LEARNHOUSE_RESEND_API_KEY`, `LEARNHOUSE_SYSTEM_EMAIL_ADDRESS=noreply@mail.holandesnawar.com` (subdominio `mail.holandesnawar.com` verificado en Resend).
**Stripe (test ahora):** `LEARNHOUSE_STRIPE_SECRET_KEY=sk_test_...`, `LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET=whsec_test_...`, `LEARNHOUSE_STRIPE_FORMACION_PRICE_ID=price_...` (el del producto "Formación Nawar A0-A1" en modo test). Para Live: misma config con `sk_live_` y `whsec_` de Live.

## Cloudflare (DNS)
Zona `holandesnawar.nl`. Registros `academia` y `*.academia` → CNAME a los targets de Railway, en **"Solo DNS" (gris, NO proxied)**. Proxied (naranja) causó **Error 1000**. SSL lo gestiona Railway.
Zona `holandesnawar.com` (la web principal) la gestiona el usuario aparte.

## Cuenta admin
Usuario `admin`, email **holandesnawar@gmail.com** (superadmin). Creado vía cli.py. Contraseña actual la conoce el usuario.

## Marca — Sistema de diseño Holandés Nawar
- Azul oscuro marca: **#1D0084** (fondos dark, texto sobre blanco).
- Acentos: **#025dc7** (sobre blanco), **#4da3ff** (CTAs, sobre dark).
- Letra sobre CTA `#4da3ff`: **#0a1656** (azul muy oscuro).
- Naranja **#F58220** SOLO estrellas/ratings.
- Neutros: blanco, off-white **#F0F5FF**, bordes **#DDE6F5**.
- Tipografía: **Inter** (UI/cuerpo) + **Poppins** (títulos).
- Botones radius **8px** (rounded-lg).
- Patrón: glow radial azul + puntos blancos sutiles `rgba(255,255,255,0.06)`.
- **Regla:** secciones dark (#1D0084) o light (blanco/#F0F5FF), nunca mezclar. Contenido principal SIEMPRE blanco.

## Stripe — flujo de pagos (estado actual)

### Configuración en Stripe Dashboard
- **Cuenta única** para todos los negocios del usuario; productos separados.
- Producto "Formación Nawar A0-A1" con su Price ID (one-time payment, ~297€).
- **Branding** (Settings → Branding): logo + color `#1D0084` + acento `#4da3ff`. El logo sustituye al texto "Holandés Nawar" en los recibos.
- **Statement descriptor**: `HOLANDES NAWAR` (lo que ve el alumno en el extracto bancario).
- **Customer emails** (Settings → Customer emails): activar "Successful payments" + "Email customers for finalized invoices" — **¡por separado para Test y Live!** Test mode no manda emails por defecto.
- **Invoice number prefix**: `NAWAR` → facturas salen `NAWAR-0001`, `NAWAR-0002`...
- **Webhook** en Test mode: endpoint `https://academia.holandesnawar.nl/api/v1/payments/webhook`, evento `checkout.session.completed`, signing secret va en `LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET`. Live tendrá el suyo aparte.

### Flujo end-to-end (cuando esté todo en holandesnawar.com)
1. Botón en landing de holandesnawar.com → `/matricula-formacion-nawar-a0-a1`.
2. Form Nawar (nombre, apellidos, email, teléfono, país, ciudad) → POST a `https://academia.holandesnawar.nl/api/v1/payments/enroll`.
3. Backend (`apps/api/src/services/payments/payments.py::enroll_and_checkout`) crea: row en tabla `enrollment` (status=pending), Stripe Customer con los datos pre-rellenos, Checkout Session vinculado al Customer + `invoice_creation.enabled=true` + `allow_promotion_codes=true`. Devuelve `checkout_url`.
4. Front redirige a Stripe (pre-rellenado).
5. Tras pagar → `success_url` = `https://www.holandesnawar.com/bienvenido?session_id=...` (cuando esté la web nueva; por ahora `https://academia.holandesnawar.nl/auth/bienvenido`).
6. Webhook `checkout.session.completed` (`apps/api/src/services/payments/payments.py::process_webhook_event`):
   - Marca enrollment como `paid`.
   - Crea cuenta en LearnHouse (`_create_paid_user`) con email_verified=true, linkeada a la org como rol 4 (alumno).
   - Genera reset_code en Redis.
   - Manda email "¡Bienvenido a Holandés Nawar! Crea tu contraseña" (Resend) con enlace a `https://academia.holandesnawar.nl/auth/crear-cuenta?email=...&resetCode=...`.
7. Alumno hace click → crea contraseña → entra a academia con onboarding "Empieza aquí".

### Notas / gotchas Stripe
- `stripe.Webhook.construct_event` devuelve un `StripeObject` que NO soporta `.get()` en Python 3.14 — siempre parsear el payload con `json.loads(payload)` después de verificar firma. Aprendido a las malas.
- Si el recibo muestra un nombre incorrecto ("Holandesna test ebook" etc.), es porque el `price_id` apunta a un Producto distinto del esperado en Stripe. Ese campo se hereda del Product, no del Price.
- Modo Test envía emails solo si el toggle "Send successful payment emails" está ON **estando en modo Test** (toggles independientes por modo).
- Mínimo de cobro Stripe = **0,50 €** en EUR. Cupones del 100% (gratis) sí valen para tests en Live sin gastar.

## Estado actual de la plataforma (academia.holandesnawar.nl)

### Hecho (rama `claude/adoring-dijkstra-rI3FL`)
- **Barra lateral** (`OrgSidebar.tsx`): azul Nawar + glow + puntos, colapsable, móvil. Reemplaza OrgMenu.
- **Login / forgot / reset / crear-cuenta**: layout dark-gradient Nawar con eye-toggle en contraseñas. Page metadata en español, sin "LearnHouse".
- **Inicio**: `OnboardingCard` ("Empieza aquí" persistido en backend), `ContinueWhereLeftOff`, `StreakBadge`, `CommunityChannelsCards`, `UpcomingEvents` con icono.
- **Comunidad**: lista de canales como tarjetas, panel "Sobre la comunidad" editable por admin (guardado en org_config), 2 columnas.
- **Cursos**: vista de lección reformada — back button, capítulos plegables con sidebar `CourseLessonsSidebar`, auto-completar en "Siguiente", `NextActivityButton` se convierte en "Finalizar" en última lección. Currículum sin número de módulo. Tarjetas de comunidad en lugar de foros.
- **Ejercicios**: módulos desbloqueados todos, breadcrumb arriba, switcher de módulos en horizontal, dots por sección en cada lección (vocabulario/flashcards/lezen/luisteren), persistencia `exercise_attempt` table (último intento + palabras flojas), banner "Última vez X/Y · Fallaste en..." al volver. Tracking de posición → ContinueWhereLeftOff.
- **Email rebrand**: todos los emails (welcome, reset, invite, role-changed, verify, payment-welcome) usan layout Nawar (banner cloudfront + logo footer + ¿Dudas? info@holandesnawar.com + Términos/Privacidad apuntando a holandesnawar.com). Color del botón `#4da3ff` + texto `#0a1656`, no se invierte en dark mode. Constante `BANNER_URL` + `LOGO_URL` + `TERMS_URL`/`PRIVACY_URL` en `apps/api/src/services/users/emails.py`.
- **Backend nuevo**:
  - Tabla `exercise_attempt` (último intento por sección + falladas).
  - Tabla `student_progress` (streak, posición, onboarding state, theme, time total).
  - Tabla `lesson_completion` (lecciones terminadas + tiempo).
  - Tabla `enrollment` (matrículas: pending/paid/abandoned).
  - Endpoints `/api/v1/student/{me,visit,lesson-completions,weak-words}` (auth).
  - Endpoints `/api/v1/exercise-attempts/{section_key,/all}` (auth).
  - Endpoints `/api/v1/payments/{checkout/formacion,enroll,webhook}` (públicos).
  - Endpoint `/api/v1/superadmin/email-test/all?to=X&name=Y` para mandar los 4 emails de prueba.
- **CORS**: ya abierto a cualquier origen http(s) en single-tenancy (`src/core/middleware/cors.py`). holandesnawar.com → academia.holandesnawar.nl funciona sin tocar nada.
- **Boards, Copilot, Playgrounds** ocultos del sidebar (no aportan para academia).
- **Volumen** para uploads (logos persisten).

### Hoja de ruta inmediata (sigue aquí)
1. **Migrar landing + matrícula + bienvenido a `holandesnawar.com`** (repo `nawar-web`, otra sesión Claude):
   - Páginas listas como HTML standalone en `/tmp/nawar-web-files/{matricula.html,bienvenido.html}` (ya entregadas al usuario por SendUserFile).
   - El form POSTea a `https://academia.holandesnawar.nl/api/v1/payments/enroll` (CORS abierto).
   - Cuando estén desplegadas en holandesnawar.com, **cambiar `success_url` y `cancel_url` en `payments.py`** para apuntar ahí (1 línea cada uno).
2. **CRM para matriculados sin pagar** (re-engagement):
   - Datos ya guardados en tabla `enrollment` (status=`pending` = se matriculó pero no pagó).
   - Plan: webhook desde nuestro `enroll_and_checkout` → push a Brevo (o el CRM elegido) con tags `matriculado-sin-pagar` para que el usuario lance campañas de recuperación.
   - Listar candidatos manualmente: query `SELECT * FROM enrollment WHERE status='pending' AND created_at < now() - interval '1 hour'`.
3. **Otros automation emails intern**: weekly_digest, module_unlocked, new_announcement, event_upcoming, consulta_answered. Templates ya listos en `emails.py` (probados vía `/superadmin/email-test/all`); falta cablear los disparadores reales (cron lunes para digest, hook al desbloquear módulo, etc.).
4. **Embeber Consultas** (https://consultas-tau.vercel.app): bloqueado por CSP en su lado. Pendiente que el usuario active `frame-ancestors https://academia.holandesnawar.nl`.
5. **Tiempo invertido** por lección (pendiente ticker cliente).
6. **Modo nocturno** plataforma (ThemeProvider + variantes `dark:` clave + persistir en `student_progress.theme`).
7. **Certificado PDF** al terminar formación (motivación).

## Notas de flujo de trabajo
- Desarrollar en `claude/adoring-dijkstra-rI3FL`.
- `git push` está bloqueado en el contenedor → usar MCP GitHub (`mcp__github__push_files`) o, en este entorno, el sandbox permite `git push` directo via http://127.0.0.1.
- Preview: cambiar la rama Source en Railway; `dev` = fallback seguro. Railway solo publica builds que compilan.
- **Verificar tipos antes de subir**: `cd apps/web && bunx tsc --noEmit`.
- **Verificar Python**: `cd apps/api && python -m py_compile <archivos>`.
- **El bug de routing de Next.js root-level**: NO crear páginas en `app/<x>/page.tsx`. Siempre dentro de subcarpetas existentes (`app/auth/<x>/`, etc.) hasta que se entienda la causa.

## MCP GitHub
Esta sesión solo tiene acceso al repo `holandesnawar/learnhouse`. Para tocar `nawar-web` hay que **abrir otra sesión** de Claude Code conectada a ese repo, pasarle el contexto desde aquí (este CLAUDE.md) y trabajar en paralelo. Los archivos HTML que esa sesión necesita están en `/tmp/nawar-web-files/`.
