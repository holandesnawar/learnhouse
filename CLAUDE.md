# CLAUDE.md — Holandés Nawar (LearnHouse self-hosted)

> Memoria del proyecto para que cualquier sesión nueva arranque con todo el contexto.
> Última actualización: 2026-05-30.

## Resumen
Academia de cursos sobre **LearnHouse**, auto-alojada en Railway.
- URL pública (academia/plataforma): **https://app.holandesnawar.com**
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

### Dominio (cambiado ago 2026: `.nl` → `.com`)
La escuela vive en **https://app.holandesnawar.com** (antes
`academia.holandesnawar.nl`). Subdominio del MISMO dominio que la web, a
propósito: los correos salen de `mail.holandesnawar.com`, así que los enlaces
coinciden con el remitente (mejor para el spam), y la matrícula deja de ser
cross-site.
- Cloudflare zona `.com`: registro `app` en **"Solo DNS" (gris)**. En naranja
  da **Error 1000**, igual que pasó en la zona `.nl`.
- **El dominio sale de UN solo sitio en cada lado**: en el backend de
  `emails.py::_school_url()` (lee `LEARNHOUSE_DOMAIN`), y en el front de
  `services/config/config.ts::getSchoolUrl()` (lee
  `NEXT_PUBLIC_LEARNHOUSE_DOMAIN` + `..._HTTPS`). En `nawar-web`,
  `PUBLIC_ESCUELA_URL`. **No volver a escribirlo a mano en ningún sitio.**
- **NO apagar el `.nl`**: los correos ya enviados llevan enlaces a él. Debe
  quedarse redirigiendo.
- Al cambiar de host **todo el mundo se desloguea**: en single-tenancy la
  cookie es host-only (`auth.py::get_cookie_domain_for_request` → `None`).
  No se pierde nada, pero hay que avisar.

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
**Backend:** `LEARNHOUSE_TENANCY=single`, `LEARNHOUSE_DOMAIN`, `LEARNHOUSE_FRONTEND_DOMAIN` (app.holandesnawar.com), `LEARNHOUSE_SSL=true`, `LEARNHOUSE_AUTH_JWT_SECRET_KEY` (≥32 chars), `LEARNHOUSE_SQL_CONNECTION_STRING`, `LEARNHOUSE_REDIS_CONNECTION_STRING`.
**Frontend:** `NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL` (con `/`), `NEXT_PUBLIC_LEARNHOUSE_DOMAIN`, `NEXT_PUBLIC_LEARNHOUSE_HTTPS=true`, `PORT=8000`.
**Email (Resend):** `LEARNHOUSE_EMAIL_PROVIDER=resend`, `LEARNHOUSE_RESEND_API_KEY`, `LEARNHOUSE_SYSTEM_EMAIL_ADDRESS=noreply@mail.holandesnawar.com` (subdominio `mail.holandesnawar.com` verificado en Resend).
**Stripe (test ahora):** `LEARNHOUSE_STRIPE_SECRET_KEY=sk_test_...`, `LEARNHOUSE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (necesaria para el embedded checkout Elements), `LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET=whsec_test_...`, `LEARNHOUSE_STRIPE_FORMACION_PRICE_ID=price_...` (el del producto "Formación Nawar A0-A1" en modo test). Para Live: misma config con `sk_live_` / `pk_live_` / `whsec_` de Live.

## Cloudflare (DNS)
Zona **`holandesnawar.com`** (la de la escuela desde ago 2026): registro `app` → CNAME al target de Railway, en **"Solo DNS" (gris, NO proxied)**. Proxied (naranja) causa **Error 1000** — pasó en la zona `.nl` y volvió a pasar al montar `app` la primera vez. SSL lo gestiona Railway.
Zona `holandesnawar.nl` (la vieja): `academia` y `*.academia` siguen apuntando a Railway **a propósito**, redirigiendo al `.com`, porque los correos ya enviados llevan enlaces a ella.
Zona `holandesnawar.com` (la web principal) la gestiona el usuario aparte.

## Cuenta admin
Usuario `admin`, email **holandesnawar@gmail.com** (superadmin). Creado vía cli.py. Contraseña actual la conoce el usuario.

## Vocabulario del producto
- **La palabra es "la escuela"**, NO "academia" (decisión del usuario, ago 2026: no le gusta "academia"). Vale para pantallas, correos y avisos: "Entrar a la escuela", "Novedades de la escuela". El **dominio sigue siendo `app.holandesnawar.com`** y la constante `ACADEMY_URL` no se toca.
- Alumno / profe / clase semanal / formación: el resto del vocabulario se mantiene.

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

### Reglas de aplicación de la marca (repaso ago 2026)
Decidido tras ver que la plataforma "parecía Temu": el problema no era una pantalla, era el sistema.
- **Nada de naranja/ámbar saturado en la interfaz del alumno.** Racha, fallos, notas y avisos van en azul de marca. El ámbar solo como señal apagada (`#8A6A2A` sobre `#FFFBF2`, o un punto `#E4B252`), y el verde solo para "hecho/dominado". El `#F58220` es **solo** estrellas/valoraciones.
- **Peso tipográfico:** cifras grandes en `font-semibold` (no bold ni extrabold), etiquetas pequeñas en mayúsculas en `font-semibold` + `tracking-[0.08em]`. El `font-extrabold` no se usa en pantallas de alumno.
- **Texto sobre `#4da3ff` siempre `#0a1656`**, nunca blanco (se leía mal).
- **Cabecera de página estándar** (Mi progreso, Mis notas, Mis mensajes, Eventos, Ejercicios): `GeneralWrapperStyled` + `<Icono size={24} className="text-[#025dc7]" />` + `<h1 className="text-2xl sm:text-3xl font-bold text-gray-900">`. Ninguna pantalla se inventa su propio ancho ni su propio color de título.
- Verde/rojo en los ejercicios (acierto/fallo) **sí** se quedan: son la señal que el alumno necesita.

### Portadas y piezas gráficas — cómo se hacen (decidido ago 2026)

**Al usuario le gusta este lenguaje visual. Es el que hay que repetir.** Se
llegó a él descartando: primero una foto de banco de imágenes (sonrisas,
birrete, bandera) que "restaba credibilidad a 397 €", luego una versión
demasiado plana, luego un bloque azul oscuro que competía con la barra lateral.

**Reglas de la portada:**
- **Fondo claro siempre.** Blanco → `#F0F5FF`, nunca azul oscuro: la barra
  lateral ya es azul y dos azules grandes juntos oscurecen media pantalla.
- **Fondo por capas**, no un degradado liso (que se lee "plantilla"): mancha
  `#4da3ff` difusa arriba-derecha, otra `#1D0084` abajo-izquierda, arco de luz,
  malla fina de 78 px con máscara radial y la trama de puntos de la marca.
- **Titular en `#1D0084`** con **marca de rotulador `#4da3ff`** bajo la palabra
  clave — es el mismo gesto de resaltar que el alumno usa en las lecciones.
  Ojo: el `.mark` debe envolver algo que NO parta de línea, o la marca se
  estira al ancho del bloque.
- **Logo Nawar arriba** con un filete y el rótulo al lado.
- **La portada NO repite el nombre del curso**: la página ya lo escribe encima.
- **Mockups con los ejercicios REALES**: estilos copiados de
  `components/exercises-app/LessonViewer.tsx` y contenido de `courseData.ts`.
  Nada inventado — quien conoce la escuela reconoce la pantalla.
- Cero naranja fuera del logo, cero fotos de stock.

**Cómo se generan** (`/tmp/.../scratchpad/portada/`, recrear si se perdió):
HTML+CSS renderizado con Playwright + Chromium
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) a `device_scale_factor=2`.
Fuentes Poppins/Inter incrustadas en base64 desde Google Fonts. **Iterar
mirando el PNG con la herramienta Read** — diseñar a ciegas no funciona.

**Formatos que pide el usuario:** `1600×560` (el contenedor real del curso,
2,86:1), `1680×720` (21:9), `1600×900` (16:9) y `1400×2100` (2:3, mockup de
libro). No es la misma imagen recortada: cada proporción recoloca las piezas.
**Zona segura del banner:** los 1160 px centrales — en móvil el `cover` se come
los laterales; en escritorio, arriba y abajo.

**Logo:** el bueno, con transparencia, está en la propia escuela:
`content/orgs/org_d790ce63-.../logos/3e936ab0-..._logo.png` (el slug de la org
es `holandesrida`). `docs.holandesnawar.com` y CloudFront están **bloqueados**
por el proxy del entorno con 403 de política — no insistir.

## Estabilidad — qué evita que la escuela se caiga
- **Todo bajo pm2, nginx incluido** (`docker/start.sh`). Antes, si nginx moría, el contenedor seguía "vivo" sin servir nada. Además `--restart-delay 3000 --max-restarts 10000`. Tras arrancar nginx se comprueba el puerto 80 de verdad y, si no responde, se arranca a mano.
- **Página `docker/offline.html`** servida por el propio nginx (`error_page 502 503 504`): mientras la app reinicia, el alumno ve "Volvemos en un momento" (recarga sola cada 8s) en vez del 502 blanco. Las rutas `/api/v1` devuelven **JSON** 503, no HTML, para que el front lo trate como fallo de red.
- **`railway.json`**: `healthcheckPath: /api/v1/health`. Railway no cambia a la versión nueva hasta que responde → los despliegues dejan de tener ventana de 502.
- **Arranque de la API tolerante** (`core/events/database.py`): 12 intentos × 5s esperando a Postgres, y `create_all` en su propio try (un fallo de DDL no puede impedir el arranque con las tablas ya creadas).
- **`SafeArea`** (`components/Objects/StyledElements/Error/SafeArea.tsx`): cortafuegos por trozo de pantalla. Envuelve las tarjetas del Inicio y el visor de lecciones; si una se rompe, se sustituye por un aviso pequeño y el resto sigue.
- **react-query**: 3 reintentos con espera creciente, pero **nunca** en 4xx.
- Redis ya falla en abierto en todas partes (rate-limit, cachés): si Redis cae, se sigue pudiendo entrar y navegar.
- **Pendiente del usuario (no es código):** activar copias de seguridad del Postgres en Railway. Es el único riesgo que el código no puede cubrir.

## Stripe — flujo de pagos (estado actual)

### Configuración en Stripe Dashboard
- **Cuenta única** para todos los negocios del usuario; productos separados.
- Producto "Formación Nawar A0-A1" con su Price ID (one-time payment, ~297€).
- **Branding** (Settings → Branding): logo + color `#1D0084` + acento `#4da3ff`. El logo sustituye al texto "Holandés Nawar" en los recibos.
- **Statement descriptor**: `HOLANDES NAWAR` (lo que ve el alumno en el extracto bancario).
- **Customer emails** (Settings → Customer emails): activar "Successful payments" + "Email customers for finalized invoices" — **¡por separado para Test y Live!** Test mode no manda emails por defecto.
- **Invoice number prefix**: `NAWAR` → facturas salen `NAWAR-0001`, `NAWAR-0002`...
- **Webhook** en Test mode: endpoint `https://app.holandesnawar.com/api/v1/payments/webhook`, eventos **`checkout.session.completed` + `payment_intent.succeeded`** (los dos), signing secret va en `LEARNHOUSE_STRIPE_WEBHOOK_STANDARD_SECRET`. Live tendrá el suyo aparte.
- **Métodos de pago activos**: tarjeta + iDEAL + Klarna + Bancontact (Apple Pay / Google Pay van solos como overlay sobre `card`). **Stripe Link y SEPA Direct Debit están desactivados a nivel de código** (`payment_method_types` explícito en `enroll_and_payment_intent`) — no depende del Dashboard.

### Flujo end-to-end actual — Embedded Checkout (Stripe Elements, sin Stripe-hosted)
1. Botón en landing de holandesnawar.com → `/matricula-formacion-nawar-a0-a1` (Astro en `nawar-web`).
2. Form Nawar (nombre, apellidos, email, teléfono, país, ciudad) → POST a `/api/enroll` (proxy Astro) → `https://app.holandesnawar.com/api/v1/payments/enroll-intent`.
3. Backend (`apps/api/src/services/payments/payments.py::enroll_and_payment_intent`) crea: row en tabla `enrollment` (status=pending), Stripe Customer con datos pre-rellenos, **`PaymentIntent`** con `payment_method_types=["card","ideal","klarna","bancontact"]`, devuelve `{enrollment_id, client_secret, publishable_key, payment_url}`.
4. El `payment_url` apunta a `https://app.holandesnawar.com/auth/matricula-formacion-nawar-a0-a1?ei=…&cs=…&pk=…&amt=…&cur=…&em=…&nm=…&ph=…`. Toda la data del paso 1 viaja en URL params para que el paso 2 la muestre ("Pagando como X · email") y pre-rellene los campos de Stripe.
5. La página `apps/web/app/auth/matricula-formacion-nawar-a0-a1/page.tsx` dispatchea: sin `cs/pk` → renderiza form de matricula (fallback). Con `cs/pk` → renderiza `checkout.tsx` (Stripe Elements). Por qué el dispatch en la misma ruta y no `/auth/pago-…`: cualquier subruta nueva 404aba por el bug del middleware antes de descubrir el fix; el embedded sigue viviendo aquí hasta que migremos.
6. `confirmPayment` → 3DS si toca → `return_url = https://app.holandesnawar.com/auth/bienvenido`.
7. Webhook `payment_intent.succeeded` (`process_webhook_event` → `_handle_payment_intent`):
   - Busca enrollment por `metadata.enrollment_id`, lo marca `paid`.
   - Crea cuenta en LearnHouse (`_create_paid_user`) con email_verified=true, linkeada a la org como rol 4 (alumno).
   - Genera reset_code en Redis.
   - Manda email "¡Bienvenido a Holandés Nawar! Crea tu contraseña" (Resend) con enlace a `https://app.holandesnawar.com/auth/crear-cuenta?email=…&resetCode=…`.
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

## Estado actual de la plataforma (app.holandesnawar.com)

### Hecho (rama `claude/adoring-dijkstra-rI3FL`)
- **Barra lateral** (`OrgSidebar.tsx`): azul Nawar + glow + puntos, colapsable, móvil. Reemplaza OrgMenu.
- **Login / forgot / reset / crear-cuenta**: layout dark-gradient Nawar con eye-toggle en contraseñas. Page metadata en español, sin "LearnHouse".
- **Inicio**: `OnboardingCard` ("Empieza aquí" persistido en backend), `ContinueWhereLeftOff`, `StreakBadge`, `CommunityChannelsCards`, `UpcomingEvents` con icono.
- **Comunidad**: lista de canales como tarjetas, panel "Sobre la comunidad" editable por admin (guardado en org_config), 2 columnas.
- **Tu espacio (zona personal del alumno)**: sección "Tu espacio" en `OrgSidebar.tsx` (encima de Progreso) con **Mis consultas** (→ `/account/consultas`) y **Mis notas** (→ `/mis-notas`). La cuenta se llama ahora "Mi cuenta" (`account.title`). Quitado "Compras" del menú de cuenta (pago único, la factura va por email) y el breadcrumb superior (daba 404 en "Cuenta").
- **Resaltar + notas en lecciones** (subrayado tipo Notion/anotador, por alumno): al seleccionar texto en la lección sale un popup con 4 colores pastel + "añadir nota". Sustituye al `AICanvaToolkit` (popup de IA/traducir). Render por **decorations** de ProseMirror (no muta el doc, read-only safe): extensión `DynamicCanva/Highlights/LessonHighlightExtension.ts` + capa React `HighlightLayer.tsx`. Icono de nota al inicio del bloque (widget). Persistencia backend tabla **`lesson_highlight`** (user_id, activity_uuid, color, quote, note, pm_from/pm_to). Endpoints en el router `/student`: GET `/highlights?activity_uuid=`, GET `/highlights/all`, POST `/highlights`, PATCH/DELETE `/highlights/{id}`. Servicio web `services/student/highlights.ts`. Página "Mis notas" (`/mis-notas` → `MyNotesBoard.tsx`) agrupa por lección con enlace a la lección. Anclaje por posiciones PM + quote (si el admin edita la lección y cambian los offsets, ese resaltado puede descuadrar — edge case asumido).
- **Reset password**: el front usa los endpoints **v2** (`/users/reset_password/{send_reset_code,change_password}` con email en el body, NO en la URL; la variante con email terminado en `.com` por el proxy relativo devolvía no-JSON → "algo salió mal"). Parseo robusto texto→JSON + manejo de fallo de red. Mensajes del backend en español.
- **Cursos**: vista de lección reformada — back button, capítulos plegables con sidebar `CourseLessonsSidebar`, auto-completar en "Siguiente", `NextActivityButton` se convierte en "Finalizar" en última lección. Currículum sin número de módulo. Tarjetas de comunidad en lugar de foros.
- **⚠️ Acceso a lecciones = ABIERTO Y GUIADO (decisión jun 2026, NO volver a candados).** Se probó un gating por fases/lotes (vídeo → samenvatting+flashcards+oefening → lezen+luisteren+situación) que dependía de detectar el % de vídeo visto en el iframe de **Bunny**, y eso es **intrínsecamente frágil** (Bunny no expone bien el progreso; cada parche destapaba otro fallo). Decisión con el usuario: **quitar todos los candados**. Todo accesible, el camino se guía por orden + botón "Siguiente" + checkmarks de completado + % de progreso. Coherente con "Done > perfect" y con una cohorte fundadora de 30-40 que pagan y QUIEREN hacer el camino. Se borraron `lib/course/gating.ts` y `lib/course/clientProgress.ts`. La compleción se sigue registrando (vídeo ~85% vía `handleVideoProgress`, ejercicios vía `onComplete`, contenido al abrir) solo para progreso/checks, **no bloquea**. `canAdvanceCurrent = true` siempre. Si en el futuro se quiere gating, decidirlo CON DATOS de alumnos reales y con un mecanismo que NO dependa del % de vídeo de Bunny (p. ej. secuencial al avanzar).
- **"Continúa donde lo dejaste" vuelve a la FORMACIÓN, no a los ejercicios**: `student_progress.current_position` guarda además `course_uuid` + `activity_uuid` cuando la lección se abre dentro del curso (`LessonViewer` recibe `courseLocation` desde `NativeExerciseActivity` ← `activity.tsx`). La tarjeta del Inicio enlaza a `/course/<uuid>/activity/<uuid>` — que es la sección exacta, porque cada sección (Luisteren, Lezen…) es su propia clase del curso. Si no hay esa info, cae a la portada del curso y, en último caso, a la app de ejercicios (que es solo para repasar).
- **Ejercicios**: módulos desbloqueados todos, breadcrumb arriba, switcher de módulos en horizontal, dots por sección en cada lección (vocabulario/flashcards/lezen/luisteren), persistencia `exercise_attempt` table (último intento + palabras flojas), banner "Última vez X/Y · Fallaste en..." al volver. Tracking de posición → ContinueCard del Inicio.
- **Inicio v2 + Progreso v2 (jul 2026, datos REALES del servidor)**: servicio `services/student/insights.ts` (`getStudentInsights`) agrega en una llamada: `student/me` + `lesson-completions` + `exercise-attempts/all` + `weak-words` → semana actual (días activos, lecciones, prácticas, % aciertos, delta vs semana pasada), nota media global, tiempo total. Inicio (`StudentHome` + `StudentPulse.tsx`): WeekStrip L-D con puntos de actividad junto a la racha, ContinueCard grande (sección exacta + barra de secciones hechas + si terminó → propone la siguiente lección), WeekCard "Esta semana", RepasoCard (palabras flojas), FormacionCard (% formación/nota/racha/tiempo). **Se eliminaron los widgets muertos** `ExerciseProgressCard` y `ProgressSummary` viejos (leían de Supabase no configurado → siempre vacíos) y `ContinueWhereLeftOff` (sustituido). `/ejercicios/progreso` (`MiProgreso.tsx`) reconstruida 100% server-side: stats, "te conviene repasar" (secciones <60% + palabras falladas), mapa por módulos con dots por sección coloreados y check de completada, "lo que dominas" (≥85%). **Progreso v3 (fiable y testeado)**: lógica pura en `lib/exercises-app/progressMap.ts` (mapa módulo→lección: secciones, nota, 'te quedaste en', peor sección a repasar) + `computeInsights` puro en insights.ts, ambos con tests bun (`bun test lib/exercises-app/__tests__/progress.test.ts`, 8 tests). Frescura: useStudentInsights con staleTime 0 + refetchOnMount 'always' (caché pinta al instante, refresco en background SIEMPRE) + bus onAttemptSaved en lastAttempts.ts que invalida la query al guardar cualquier intento (cierra la carrera guardar→navegar). La tira semanal cuenta también los días de la RACHA (visitas sin práctica). MiProgreso rediseñada: el mapa por módulos es el corazón — cada lección muestra check/dots/nota + línea de estado ('Fallaste 3 · Lezen 6/9' con botón ámbar 'Repasar fallos' directo al peor, o 'Te quedaste en: X' con botón 'Continuar'); fuera el bloque 'Te conviene repasar' separado. **Tiempo por lección HECHO**: ticker en `LessonViewer` (cuenta solo con pestaña visible, cap 1h/visita), vuelca a `lesson_completion.time_seconds` (el backend SUMA incrementos) al completar la lección y al salir en revisitas de lecciones ya completadas (nunca crea compleciones falsas por solo mirar).
- **Avisos (panel admin) → 2 pestañas**: *Escribir un aviso* (redactor rich-text que manda el correo de novedades) y *Correos automáticos* (`EmailCatalog.tsx`): lista los 10 correos que la academia manda sola, los renderiza con datos de ejemplo dentro de un `<iframe srcDoc>` y permite "Enviármelo". Backend: `send_email(..., dry_run=True)` devuelve `{subject, html}` sin enviar; cada plantilla de `emails.py` acepta `preview: bool`; catálogo en `services/demo/email_catalog.py`; endpoints `GET /superadmin/email-templates`, `GET /superadmin/email-templates/{id}/preview`, `POST /superadmin/email-templates/{id}/send-test`. **Editar los textos desde el panel NO está hecho** (las plantillas siguen en código).
- **Campana de notificaciones del alumno** (`NotificationsBell.tsx`, en la cabecera de `OrgSidebar` y en la barra superior de móvil). Cuatro fuentes, **ninguna manda email**: menciones (`@nombre`/`@all`), mensajes fijados como importantes (`Discussion.is_pinned`), avisos mandados desde el panel (tabla nueva `org_notification`, una fila por aviso — no una por alumno) y módulos abiertos por el goteo (**calculado**: alta del alumno + días configurados, últimas 3 semanas; no guarda nada). Cada fuente va en su propio try: si una falla, la campana enseña el resto. Tabla nueva `notification_seen` (`user_id` + `last_seen_at`, sin migración). Endpoints `GET /community-engagement/notifications` y `PUT /community-engagement/notifications/seen`. Abrir la campana apaga el punto rojo pero NO marca los canales como leídos.
- **Mensajes directos alumno ↔ equipo** (`/mensajes`, `MessagesPage.tsx`): tablas nuevas `direct_thread` + `direct_message`. Hilo **con el equipo** (`staff_id` NULL, lo ve cualquier moderador) o **con una persona** (`staff_id` puesto: lo ven esa persona y los administradores). El alumno tiene siempre el del equipo y puede buscar a un moderador en el directorio; el equipo busca alumnos y escribe primero (`GET /messages/directory?q=`, `POST /messages/open/{peer_id}`). En móvil es una columna: lista → conversación con flecha de volver. **`direct_thread.staff_id` se añadió después**: como la tabla podía existir ya en producción, `src/core/events/database.py` ejecuta al arrancar una lista `_ADDED_COLUMNS` de `ALTER TABLE ... IF NOT EXISTS` (idempotente) — ahí van las columnas nuevas de tablas ya desplegadas, que `create_all` NO añade. **Notas de voz** grabadas con `MediaRecorder` (`VoiceRecorder.tsx`), se escuchan antes de mandarlas y se guardan en `content/orgs/<org_uuid>/voice/` (volumen). Endpoints `/api/v1/messages/{threads,unread,thread,thread/{id},thread/{id}/read,send}` (send va en multipart). **Bienvenida automática**: el hilo se crea solo la primera vez que el alumno consulta sus no leídos, y nace con el mensaje de bienvenida dentro (texto en org_config `direct_welcome`, editable desde la propia pantalla). Sobre en la cabecera del sidebar + entrada "Mis mensajes" en Tu espacio. Cada mensaje del otro lado lleva **foto**: la del moderador, y el **logo de la academia** en los automáticos o si el moderador no tiene avatar (`_avatar_path` / `_org_logo` devuelven rutas relativas que el front completa con `mediaSrc`).
- **Onboarding (`StudentOnboarding.tsx`) — por qué salía "a veces sí y a veces no"**: tenía un `MutationObserver` que escondía el widget si detectaba CUALQUIER elemento `fixed inset-0` visible (cajones, fondos decorativos…). Eliminado. Además `welcomed` y `dismissed` se guardan ahora en `student_progress.onboarding_state` (servidor) y no en localStorage — ojo: el backend **reemplaza** ese objeto, hay que mandarlo entero (`saveState`).
- **Certificado del alumno**: página `/certificates/{user_certification_uuid}` (`MyCertificatePage.tsx`) — el certificado en español, botón **Descargar en PDF** y explicación del código de verificación. Es a donde lleva el correo "tu certificado ya está listo" (antes iba a `/verify`, que es la página pública para quien lo comprueba).
- **Email rebrand**: todos los emails (welcome, reset, invite, role-changed, verify, payment-welcome) usan layout Nawar (banner cloudfront + logo footer + ¿Dudas? info@holandesnawar.com + Términos/Privacidad apuntando a holandesnawar.com). Color del botón `#4da3ff` + texto `#0a1656`, no se invierte en dark mode. Constante `BANNER_URL` + `LOGO_URL` + `TERMS_URL`/`PRIVACY_URL` en `apps/api/src/services/users/emails.py`.
- **Backend nuevo**:
  - Tabla `exercise_attempt` (último intento por sección + falladas).
  - Tabla `student_progress` (streak, posición, onboarding state, theme, time total).
  - Tabla `lesson_completion` (lecciones terminadas + tiempo).
  - Tabla `enrollment` (matrículas: pending/paid/abandoned).
  - Endpoints `/api/v1/student/{me,visit,lesson-completions,weak-words,insights}` (auth). **`/student/insights`** devuelve progress+completions+attempts+weak_words en UN viaje; el front (`useStudentInsights`, react-query, staleTime 60s) lo cachea → Inicio/Progreso pintan al instante al navegar. El front cae a las 4 llamadas clásicas si el endpoint no responde (skew de deploy).
  - Endpoints `/api/v1/exercise-attempts/{section_key,/all}` (auth).
  - Endpoints `/api/v1/payments/{checkout/formacion,enroll,webhook}` (públicos).
  - Endpoint `/api/v1/superadmin/email-test/all?to=X&name=Y` para mandar los 4 emails de prueba.
- **CORS**: ya abierto a cualquier origen http(s) en single-tenancy (`src/core/middleware/cors.py`). holandesnawar.com → app.holandesnawar.com funciona sin tocar nada.
- **Boards, Copilot, Playgrounds** ocultos del sidebar (no aportan para academia).
- **Volumen** para uploads (logos persisten).
- **Embedded checkout Nawar** (`checkout.tsx`): el alumno NO sale del dominio. Logo arriba-izquierda, card blanca con resumen del curso a la derecha (imagen 16:9, features con checks `#4da3ff`, total dinámico tirando del Stripe Price vía URL params), tabs de pago Tarjeta/iDEAL/Klarna/Bancontact con Appearance API Nawar (`#F0F5FF` inputs, `#4da3ff` focus, texto pinned a `#1D0084` en cualquier estado del tab para no quedarse en blanco-sobre-blanco), banner "Pagando como X · email" con botón Cambiar que vuelve al form, mobile-friendly (`overflow-x-hidden`, `min-w-0`, paddings reducidos en sm).
- **Middleware proxy.ts arreglado**: ya pasa cualquier `/auth/<x>` directamente a su ruta (antes 404aba todas las nuevas).

- **Estadísticas (panel admin, `/dash/estadisticas`)**: los números del negocio, calculados de NUESTRA base de datos (sin Tinybird — la pantalla `Analytics` original de LearnHouse depende de ese servicio externo y de un plan de pago, así que está muerta). Backend: `services/stats/periods.py` (agrupar por mes/trimestre, lógica pura con 12 tests) + `services/stats/school.py` (ventas, embudo del checkout, alumnos, avance por módulo, datos manuales) + router `/api/v1/stats/org/{org_id}` (GET) y `/manual` (PUT/DELETE), todo con `rbac_check ... "update"` (solo administradores). Front: `components/Dashboard/Pages/Estadisticas/EstadisticasPage.tsx` + `services/stats/school.ts`.
  - **Columnas nuevas en `enrollment`**: `product` (default `formacion-a0-a1`, deja sitio al siguiente curso), `amount_cents`, `currency`, `paid_at`. Se rellenan en el webhook al confirmar el cobro → la tabla de ventas sale de Postgres, sin llamar a Stripe. Van en `_ADDED_COLUMNS` (la tabla ya existía en producción).
  - **Tabla nueva `school_manual_entry`** (`kind` + `period`): lo que no se puede deducir solo. `cost` = gasto del mes (para el coste por lead, dividido entre las matrículas empezadas ese mes) y `attendance` = asistentes a cada clase en vivo. **Decisión del usuario (ago 2026): la asistencia se apunta A MANO**, no se rastrea; y **NO se consulta Systeme.io** desde la escuela, así que "lista → venta" NO está y el embudo empieza en la matrícula.
  - **"Completó el módulo"** = ese alumno terminó TODAS las clases del capítulo. Se calcula cruzando los pares (alumno, clase) de `trail_step`; agregando por clase se mentía (dos alumnos con media clase cada uno parecían uno completo).
  - **Enlaces UTM**: bloc de notas en la pestaña "Enlaces UTM", guardado en org_config `utm_links`. **Los UTM NO se capturan** (decisión del usuario): la escuela no sabe de qué campaña viene cada venta. Si algún día se quiere, hay que guardarlos en `enrollment` y que la web los pase.
  - **Bug arreglado de paso**: `get_cached_course_meta` cacheaba la ficha del curso en Redis con una clave SIN usuario, pero el payload lleva `is_locked`/`unlock_date` del goteo, que dependen de la fecha de alta de cada alumno → quien calentaba la caché decidía los candados que veían los demás durante un minuto. Ahora la clave lleva el usuario y la invalidación borra por patrón.

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
4. **Embeber Consultas** (https://consultas-tau.vercel.app): bloqueado por CSP en su lado. Pendiente que el usuario active `frame-ancestors https://app.holandesnawar.com`.
5. **Modo nocturno** plataforma (ThemeProvider + variantes `dark:` clave + persistir en `student_progress.theme`).
6. **Certificado PDF** al terminar formación (motivación).

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

## ⚠️ Contenido del curso de holandés = `courseData.ts` (NO Supabase)

**IMPORTANTE (no volver a equivocarse):** todo el contenido de las lecciones de holandés (módulos, lecciones, **vocabulario, frases, diálogos/Luisteren, Lezen, ejercicios**) vive en **CÓDIGO**, en el archivo:
`apps/web/lib/exercises-app/courseData.ts`.

- Existe una capa opcional de **Supabase** (`apps/web/lib/exercises-app/supabase.ts`) como "migración progresiva", PERO **NO está configurada en producción** (sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`). Cuando faltan esas env vars, `supabase` es `null` y la app **cae automáticamente a `courseData.ts`**. → En la práctica **producción usa `courseData.ts`**, no Supabase.
- Para **añadir/editar contenido** (un texto de Lezen, vocabulario, un diálogo, ejercicios): se edita `courseData.ts` y se hace `git push`. Railway despliega. **Sin keys, sin Supabase, sin SQL.** Así se metió todo el contenido existente.
- NO decirle al usuario que hace falta Supabase/SQL para añadir contenido. Es código de este repo y lo edito directamente.
- Estructura por lección: `blocks: [{type:'summary'}, {type:'vocabulary'}, {type:'phrases'}, {type:'lezen'}, {type:'dialogue'}, {type:'practice'}, {type:'review'}]`. El mapeo a secciones de la academia: summary→Samenvatting, vocabulary→Flashcards, practice→Oefening, **lezen→1.4 Lezen**, dialogue→1.5 Luisteren, situación→1.6.
- Tipos de ejercicio (`ExerciseType` en `types.ts`): multiple_choice, fill_blank, true_false (`correctAnswer: 'verdadero'|'falso'`), order_sentence, match_pairs, odd_one_out, letter_dash, word_scramble, emoji_choice, listen_and_choose, listen_translate, pair_memory.
- **TTS de los diálogos (Luisteren):** voz por defecto ElevenLabs en la ruta `apps/web/app/api/tts/route.ts` (`language_code: 'nl'` para evitar acento inglés). Los diálogos alternan **dos voces** por interlocutor: `DIALOGUE_VOICE_A`/`DIALOGUE_VOICE_B` en `LessonViewer.tsx` (A=chico `5zhopMftSdRGaPYVcwKK`, B=chica `yO6w2xlECAQRFP6pX7Hw`). La API key va en env `ELEVENLABS_API_KEY` (Railway).

## Notas de flujo de trabajo
- Desarrollar en `claude/adoring-dijkstra-rI3FL`.
- `git push` está bloqueado en el contenedor → usar MCP GitHub (`mcp__github__push_files`) o, en este entorno, el sandbox permite `git push` directo via http://127.0.0.1.
- Preview: cambiar la rama Source en Railway; `dev` = fallback seguro. Railway solo publica builds que compilan.
- **Verificar tipos antes de subir**: `cd apps/web && bunx tsc --noEmit`.
- **Verificar Python**: `cd apps/api && python -m py_compile <archivos>`.
- ⚠️ **`py_compile` NO BASTA. Antes de subir CUALQUIER cosa del backend, importar la aplicación:**
  `cd apps/api && python -m pytest src/tests/test_app_imports.py -q`
  **Por qué (apagón del 21/08/2026):** en `src/router.py` se escribió
  `router.include_router(...)` en vez de `v1_router.include_router(...)`. Eso es un
  **NameError de nivel de módulo**: `py_compile` solo mira la SINTAXIS y pasó limpia,
  pero al importar, la API murió en el arranque. nginx y la web seguían perfectos —
  por eso el síntoma fue **502 solo en `/api/v1`** y la escuela inservible.
  El test `src/tests/test_app_imports.py` importa el router y comprueba que siguen
  registradas las rutas de las que vive la escuela (health, users, orgs, messages,
  student, payments). Está verificado que falla si se reintroduce ese bug.
  **Diagnóstico rápido de un apagón:** `curl -o /dev/null -w "%{http_code}" .../api/v1/health`
  → 502 con `/login` a 200 significa **API caída, nginx y web bien** (mira los logs de
  la API, no toques nginx). Si TODO da 502, entonces sí es nginx o el contenedor.
- **El bug de routing de Next.js root-level**: NO crear páginas en `app/<x>/page.tsx`. Siempre dentro de subcarpetas existentes (`app/auth/<x>/`, etc.) hasta que se entienda la causa.

## MCP GitHub
Esta sesión solo tiene acceso al repo `holandesnawar/learnhouse`. Para tocar `nawar-web` hay que **abrir otra sesión** de Claude Code conectada a ese repo, pasarle el contexto desde aquí (este CLAUDE.md) y trabajar en paralelo. Los archivos HTML que esa sesión necesita están en `/tmp/nawar-web-files/`.
