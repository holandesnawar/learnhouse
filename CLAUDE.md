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

### ⚠️ Bug del middleware `/auth/*` (RESUELTO, importante para futuras páginas auth)
`proxy.ts` (el middleware de Next que mete tenancy/rewrite) **reescribía cualquier `/auth/<x>` no listado explícitamente** hacia `/orgs/<slug>/auth/<x>`, ruta que no existe → 404 silencioso. Por eso `/login`, `/forgot`, `/reset`, etc. funcionaban (estaban listados en step 3) pero `/auth/bienvenido`, `/auth/crear-cuenta`, `/auth/matricula-…` y cualquier página nueva caía al catch-all → 404. Nos confundió durante mucho tiempo porque parecía bug de cache de Docker.
**Fix (commit `6d52a62`):** se añadió step 4b en `proxy.ts` que pasa por defecto cualquier `/auth/*` directamente a su ruta resolviendo tenant para cookies (sin reescribir a `/orgs/...`). Cualquier `/auth/<x>/page.tsx` nuevo a partir de ahora funcionará sin tocar el middleware.

### Variables clave (nombres, NO valores)
**Backend:** `LEARNHOUSE_TENANCY=single`, `LEARNHOUSE_DOMAIN`, `LEARNHOUSE_FRONTEND_DOMAIN` (academia.holandesnawar.nl), `LEARNHOUSE_SSL=true`, `LEARNHOUSE_AUTH_JWT_SECRET_KEY` (≥32 chars), `LEARNHOUSE_SQL_CONNECTION_STRING`, `LEARNHOUSE_REDIS_CONNECTION_STRING`.
**Frontend:** `NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL` (con `/`), `NEXT_PUBLIC_LEARNHOUSE_DOMAIN`, `NEXT_PUBLIC_LEARNHOUSE_HTTPS=true`, `PORT=8000`.
**Email (Resend):** `LEARNHOUSE_EMAIL_PROVIDER=resend`, `LEARNHOUSE_RESEND_API_KEY`, `LEARNHOUSE_SYSTEM_EMAIL_ADDRESS=noreply@mail.holandesnawar.com` (subdominio `mail.holandesnawar.com` verificado en Resend).
**Stripe (test ahora):** `LEARNHOUSE_STRIPE_SECRET_KEY=sk_test_...`, `LEARNHOUSE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (necesaria para el embedded checkout Elements), `LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET=whsec_test_...`, `LEARNHOUSE_STRIPE_FORMACION_PRICE_ID=price_...` (el del producto "Formación Nawar A0-A1" en modo test). Para Live: misma config con `sk_live_` / `pk_live_` / `whsec_` de Live.

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
- **Webhook** en Test mode: endpoint `https://academia.holandesnawar.nl/api/v1/payments/webhook`, eventos **`checkout.session.completed` + `payment_intent.succeeded`** (los dos), signing secret va en `LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET`. Live tendrá el suyo aparte.
- **Métodos de pago activos**: tarjeta + iDEAL + Klarna + Bancontact (Apple Pay / Google Pay van solos como overlay sobre `card`). **Stripe Link y SEPA Direct Debit están desactivados a nivel de código** (`payment_method_types` explícito en `enroll_and_payment_intent`) — no depende del Dashboard.

### Flujo end-to-end actual — Embedded Checkout (Stripe Elements, sin Stripe-hosted)
1. Botón en landing de holandesnawar.com → `/matricula-formacion-nawar-a0-a1` (Astro en `nawar-web`).
2. Form Nawar (nombre, apellidos, email, teléfono, país, ciudad) → POST a `/api/enroll` (proxy Astro) → `https://academia.holandesnawar.nl/api/v1/payments/enroll-intent`.
3. Backend (`apps/api/src/services/payments/payments.py::enroll_and_payment_intent`) crea: row en tabla `enrollment` (status=pending), Stripe Customer con datos pre-rellenos, **`PaymentIntent`** con `payment_method_types=["card","ideal","klarna","bancontact"]`, devuelve `{enrollment_id, client_secret, publishable_key, payment_url}`.
4. El `payment_url` apunta a `https://academia.holandesnawar.nl/auth/matricula-formacion-nawar-a0-a1?ei=…&cs=…&pk=…&amt=…&cur=…&em=…&nm=…&ph=…`. Toda la data del paso 1 viaja en URL params para que el paso 2 la muestre ("Pagando como X · email") y pre-rellene los campos de Stripe.
5. La página `apps/web/app/auth/matricula-formacion-nawar-a0-a1/page.tsx` dispatchea: sin `cs/pk` → renderiza form de matricula (fallback). Con `cs/pk` → renderiza `checkout.tsx` (Stripe Elements). Por qué el dispatch en la misma ruta y no `/auth/pago-…`: cualquier subruta nueva 404aba por el bug del middleware antes de descubrir el fix; el embedded sigue viviendo aquí hasta que migremos.
6. `confirmPayment` → 3DS si toca → `return_url = https://academia.holandesnawar.nl/auth/bienvenido`.
7. Webhook `payment_intent.succeeded` (`process_webhook_event` → `_handle_payment_intent`):
   - Busca enrollment por `metadata.enrollment_id`, lo marca `paid`.
   - Crea cuenta en LearnHouse (`_create_paid_user`) con email_verified=true, linkeada a la org como rol 4 (alumno).
   - Genera reset_code en Redis.
   - Manda email "¡Bienvenido a Holandés Nawar! Crea tu contraseña" (Resend) con enlace a `https://academia.holandesnawar.nl/auth/crear-cuenta?email=…&resetCode=…`.
   - Genera **factura post-hoc** (`_create_post_hoc_invoice`): InvoiceItem + Invoice + finalize + pay_out_of_band → así sigues teniendo el PDF con numeración `NAWAR-XXXX` que daba el Checkout Session.
   - Tagging Systeme.io (`mark_as_alumno`).
8. Alumno hace click en email → crea contraseña → entra a academia con onboarding "Empieza aquí".

> El handler viejo `checkout.session.completed` (`_handle_checkout_session`) sigue activo en el webhook por si quedan matrículas colgadas del flujo Stripe-hosted, pero todos los pagos nuevos vienen por PaymentIntent.

### Design tokens del checkout (para clavar el look en otras páginas — ej. matricula en `nawar-web`)
Fichero canónico: `apps/web/app/auth/matricula-formacion-nawar-a0-a1/checkout.tsx`. Copiar de ahí para mantener consistencia.

- **Fondo de página**: `#1D0084` base + 3 capas de `background-image` apiladas:
  ```css
  background-image:
    radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px),
    radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%),
    radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%);
  background-size: 28px 28px, auto, auto;
  background-repeat: repeat, no-repeat, no-repeat;
  ```
  Aplicar en el contenedor de la página (no `position: fixed`) para que escrolle con el contenido.
- **Card central**: `bg-white rounded-2xl p-4 sm:p-7 shadow-xl`, centrada con `max-w-md mx-auto` (form) o `max-w-5xl` + grid `lg:grid-cols-[minmax(0,1fr)_360px]` (checkout con summary lateral).
- **Logo**: `https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png` arriba dentro del contenedor (no fixed al viewport): `h-10 sm:h-11 mb-5 sm:mb-6`, linkeado a `https://www.holandesnawar.com/`. Sin navbar ni footer.
- **Eyebrow** encima del título: `text-[12px] font-bold text-[#4da3ff] tracking-wider uppercase` → "PASO 1 DE 2" / "PASO 2 DE 2".
- **Título**: Poppins, `text-[24px] sm:text-[30px] font-bold text-[#1D0084] leading-tight mt-1`.
- **Inputs**: `bg-[#F0F5FF] rounded-xl px-4 py-3 text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors`.
- **Labels**: `text-[13px] font-semibold text-[#0a1656] tracking-[0.01em] mb-1.5`.
- **Botón primario**: `bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-3.5 rounded-xl text-[15px] inline-flex items-center justify-center gap-2.5`, con `ArrowRight size={15} strokeWidth={2.5}` al final.
- **Banner info** (`#F0F5FF` rounded-xl px-3 sm:px-4 py-3) con icono `Info` size=16 `text-[#4da3ff]` a la izquierda + texto `text-[13px] text-[#0a1656] leading-relaxed`.
- **Errores**: `bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-[13.5px]` con `AlertTriangle size={16}`.
- **Mobile**: `overflow-x-hidden` en root, `px-3 sm:px-6` en main, `min-w-0` en grid children, `p-4 sm:p-7` en cards.

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
- **Embedded checkout Nawar** (`checkout.tsx`): el alumno NO sale del dominio. Logo arriba-izquierda, card blanca con resumen del curso a la derecha (imagen 16:9, features con checks `#4da3ff`, total dinámico tirando del Stripe Price vía URL params), tabs de pago Tarjeta/iDEAL/Klarna/Bancontact con Appearance API Nawar (`#F0F5FF` inputs, `#4da3ff` focus, texto pinned a `#1D0084` en cualquier estado del tab para no quedarse en blanco-sobre-blanco), banner "Pagando como X · email" con botón Cambiar que vuelve al form, mobile-friendly (`overflow-x-hidden`, `min-w-0`, paddings reducidos en sm).
- **Middleware proxy.ts arreglado**: ya pasa cualquier `/auth/<x>` directamente a su ruta (antes 404aba todas las nuevas).

### Hoja de ruta inmediata (sigue aquí)
1. **Rebrandear `/matricula-formacion-nawar-a0-a1` en `nawar-web`** para que case con el embedded checkout (mismo logo arriba, misma card blanca sobre fondo Nawar, mismos inputs `#F0F5FF`, mismo botón `#4da3ff` con texto `#0a1656`). Otra sesión Claude del repo `nawar-web` — pásale los tokens de la sección "Design tokens del checkout" más arriba. Mantener todos los campos del form (`first_name`, `last_name`, `email`, `phone`, `country`, `city`, honeypot `website`) y el POST a `/api/enroll`.
2. **Migrar landing + bienvenido a `holandesnawar.com`** (repo `nawar-web`, otra sesión Claude):
   - Página `bienvenido` lista como HTML standalone en `/tmp/nawar-web-files/bienvenido.html` (ya entregada al usuario por SendUserFile).
   - Cuando esté desplegada en holandesnawar.com, **cambiar `return_url` en `checkout.tsx`** + `success_url` (flujo viejo) en `payments.py` para apuntar ahí.
2. **CRM para matriculados sin pagar** (re-engagement):
   - Datos ya guardados en tabla `enrollment` (status=`pending` = se matriculó pero no pagó).
   - Plan: webhook desde nuestro `enroll_and_checkout` → push a Brevo (o el CRM elegido) con tags `matriculado-sin-pagar` para que el usuario lance campañas de recuperación.
   - Listar candidatos manualmente: query `SELECT * FROM enrollment WHERE status='pending' AND created_at < now() - interval '1 hour'`.
3. **Otros automation emails intern**: weekly_digest, module_unlocked, new_announcement, event_upcoming, consulta_answered. Templates ya listos en `emails.py` (probados vía `/superadmin/email-test/all`); falta cablear los disparadores reales (cron lunes para digest, hook al desbloquear módulo, etc.).
4. **Embeber Consultas** (https://consultas-tau.vercel.app): bloqueado por CSP en su lado. Pendiente que el usuario active `frame-ancestors https://academia.holandesnawar.nl`.
5. **Tiempo invertido** por lección (pendiente ticker cliente).
6. **Modo nocturno** plataforma (ThemeProvider + variantes `dark:` clave + persistir en `student_progress.theme`).
7. **Certificado PDF** al terminar formación (motivación).

## Estrategia de negocio y lanzamiento (plan 2026)

> Decidido con el usuario en sesiones de junio 2026. Filosofía base (Hormozi): no competir en el medio indiferenciado; el negocio es de **entrega limitada**, así que el polo es **premium**, no barato. Subir precios con prueba es lo normal y sano (NO bajar). High-ticket = **acceso + personalización + velocidad + accountability + garantía**, NUNCA "más contenido".

### Principio de foco (recordar siempre)
El lanzamiento se decide por **(1) audiencia/lista de email, (2) claridad de la oferta, (3) resultados reales de los primeros alumnos → testimonios**. NO por pulir la plataforma. La plataforma ya está lista para lanzar. Done > perfect.

### Hoja de ruta de lanzamientos
- **Septiembre 2026:** lanzar **Formación A0-A1**, cohorte fundadora **30-40 plazas**, **solo por email** (sin redes todavía), precio **397€ "fundador"**. Objetivo: feedback + testimonios. Escasez real.
- **Sept→dic:** entregar excelente, recoger feedback y testimonios. Pedir testimonio "en caliente" al lograr el resultado.
- **Enero 2027:** mejorar A0-A1 (con feedback) + lanzar **A1-A2** como continuación (ascensión) + montar el **VIP**. Subir Formación a **497€**. Bundle "ruta A0→A2" opcional (no obligar).
- **Feb/Mar 2027:** lanzar **Nawar+** (suscripción de entrada). NO en enero (no saturar; evitar canibalizar).

### Escalera de productos / precios
| Producto | Cuándo | Precio | Rol |
|---|---|---|---|
| Guías gratis (hebben-zijn…) | ya | 0€ | Captar emails |
| **Nawar+** (suscripción) | feb/mar | ~mensual | Puerta de entrada / "los que no se atreven" |
| **Formación A0-A1** | sept 397 fundador → enero **497** | 397→497 | Camino estructurado al resultado |
| **A0-A1 VIP** | enero | **997** (plazas limitadas) | Acceso + personalización |
| **A1-A2** (+ VIP / bundle) | enero | — | Ascensión |

- VIP a **997** (no 897): el hueco 497→997 (el doble) **auto-selecciona** a los comprometidos y cubre el coste de TU tiempo. Se puede subir luego.
- **Nawar+ posicionamiento (clave anti-canibalización):** Nawar+ = comunidad + clase semanal en grupo + práctica ("mantente conectado"). Formación = camino estructurado A0-A1 con sistema, progreso y certificado ("de verdad aprendes el nivel"). Nawar+ **alimenta** la formación y capta gente **entre cohortes**.

### Diferenciadores del VIP (sin quitar nada al base)
El base (497) debe lograr el resultado A0-A1 **completo y satisfactorio por sí solo**. El VIP **AÑADE** (no quita): correcciones personales async + notas de voz de pronunciación + consultas con prioridad (<24h) + clase de conversación en grupo reducido + plan de estudio personalizado + prep examen inburgering/NT2 + canal de comunidad exclusivo VIP + insignia + certificado + acceso anticipado + **garantía de esfuerzo** ("si completas y no llegas a X, sesiones extra gratis"). Elegir 4-5 que cuesten poco entregar pero se perciban mucho (las async + grupo reducido + prioridad + certificado).

### Separación de grupos en la plataforma (construir en ENERO)
Usar el sistema de **grupos de usuarios** (el mismo que usan los bloqueos del drip):
- Crear grupo **"VIP / Nawar Pro"**.
- Contenido + **canal de comunidad exclusivos** gateados a ese grupo (como el drip oculta módulos).
- **Insignia VIP** en comunidad + marca visible para el admin para saber a quién responder primero (prioridad).
- El base no ve lo VIP; el VIP ve todo + lo suyo. (Es código que se puede construir: pendiente para enero.)

### Mecánica de venta del high-ticket (VIP) — solicitud → reunión, en oleadas
La formación 497 se vende por **email a la lista filtrada** con checkout normal. El VIP NO: se vende **por solicitud + reunión** (a 997 convierte mucho mejor hablando que con un botón).
1. Formulario de cualificación en la lista (urgencia, para qué, cuándo) → etiquetar a los **más calientes/urgentes**.
2. A los **~10 más comprometidos** → email SEPARADO (antes de que compren la 497 por su cuenta) invitando a **reservar una reunión** (Calendly). En la llamada se vende el VIP.
3. Si de esos 10 compran solo ~5 → **segunda oleada**: email a los siguientes 10 más comprometidos. Escasez real ("quedan X plazas VIP").
4. Plazas VIP limitadas (~5-10) = escasez + capacidad de entrega real.

### Equipo / entrega (staffing)
- **Ahora: NO sueldos fijos.** Demanda no probada → coste variable. Usar los **profes ZZP (freelance) que ya hay, pago por clase/hora**. El coste de una clase grupal es trivial frente a los ingresos.
- El **director académico** coordina + entrega los 1-a-1 del VIP + accountability.
- **VIP:** mezclar — pocos 1-a-1 puros (2-3 sesiones clave) + **conversación en grupo reducido** + **async** (correcciones, notas de voz) para no vivir en la agenda. Limitar plazas.
- **Sueldo fijo solo más adelante**, con demanda estable y utilización casi plena. Hasta entonces, freelance = más rentable y sin coste muerto. NO sobre-contratar antes de ingresos probados.

### Otros motores (después de tener prueba B2C)
- **Referidos:** orgánico (pedirlo a alumnos felices en el pico de su victoria) desde ya; **incentivado en enero** (trae a un amigo → crédito siguiente nivel / sesión extra / cash) con **cupones manuales** (sin plataforma de afiliados aún); afiliación formal con comisiones más adelante (promotores/influencers).
- **B2B:** gran potencial (empresas con extranjeros, inburgering/gemeente con presupuesto público, expats), pero es **otro deporte** (ciclo largo, facturas, contratos). **Aparcar hasta tener prueba B2C**; coger leads calientes de forma oportunista.

## Notas de flujo de trabajo
- Desarrollar en `claude/adoring-dijkstra-rI3FL`.
- `git push` está bloqueado en el contenedor → usar MCP GitHub (`mcp__github__push_files`) o, en este entorno, el sandbox permite `git push` directo via http://127.0.0.1.
- Preview: cambiar la rama Source en Railway; `dev` = fallback seguro. Railway solo publica builds que compilan.
- **Verificar tipos antes de subir**: `cd apps/web && bunx tsc --noEmit`.
- **Verificar Python**: `cd apps/api && python -m py_compile <archivos>`.
- **El bug de routing de Next.js root-level**: NO crear páginas en `app/<x>/page.tsx`. Siempre dentro de subcarpetas existentes (`app/auth/<x>/`, etc.) hasta que se entienda la causa.

## MCP GitHub
Esta sesión solo tiene acceso al repo `holandesnawar/learnhouse`. Para tocar `nawar-web` hay que **abrir otra sesión** de Claude Code conectada a ese repo, pasarle el contexto desde aquí (este CLAUDE.md) y trabajar en paralelo. Los archivos HTML que esa sesión necesita están en `/tmp/nawar-web-files/`.
