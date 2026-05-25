# CLAUDE.md — Holandés Nawar (LearnHouse self-hosted)

> Memoria del proyecto para que cualquier sesión nueva arranque con todo el contexto.
> Última actualización: 2026-05.

## Resumen
Academia de cursos **"Holandesrida"** sobre **LearnHouse**, auto-alojada.
- URL pública: **https://academia.holandesnawar.nl**
- Edición: **OSS (open-source)** · modo **single-org / single-tenancy** · `mode: oss`
- Idioma del usuario: **español**. No técnico — explicar claro, paso a paso.

## Infraestructura (Railway)
Proyecto `cooperative-tenderness`, 3 servicios: **learnhouse** (la app, Dockerfile multi-stage: nginx + web Next.js + api FastAPI + collab), **Postgres**, **Redis**.
- Repo: `holandesnawar/learnhouse`.
- **Rama que despliega Railway: `dev`** (auto-deploy al hacer push).
- **Desarrollo/preview en la rama `claude/adoring-dijkstra-rI3FL`.** Para previsualizar: Railway → learnhouse → Settings → Source → cambiar la rama a esa; para volver atrás, poner `dev` (es la red de seguridad).
- Volumen persistente montado en **`/app/api/content`** (logos/imágenes/uploads; si no, se pierden en cada redeploy).

### Lecciones de puertos/URLs (NO romper)
- nginx escucha en **80**; web Next.js en **8000**; api en **9000**; collab en **4000**.
- Variable **`PORT=8000`** (si no, Next.js arranca donde Railway diga y se salta nginx → 502).
- **Target port del dominio en Railway = `80`** (nginx es la puerta de entrada).
- **`NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL` DEBE terminar en `/`** (ej. `https://academia.holandesnawar.nl/`). El código concatena `content/...` y `api/v1/...` directamente; sin la barra se rompen imágenes/streaming. (Las llamadas API quitan la barra solas, así que es seguro.)
- **NO** poner `NEXT_PUBLIC_LEARNHOUSE_API_URL` a pelo (causó el bug `railway.apporgs`). Dejar que se derive de BACKEND_URL.
- **`LEARNHOUSE_REDIS_CONNECTION_STRING`** debe ser correcta (idealmente referencia `${{Redis.REDIS_URL}}`). El **login usa Redis** (rate-limit); si Redis falla → **500 en /login** (se ve como "contraseña incorrecta", engañoso).

### Variables clave (nombres, NO valores)
Backend: `LEARNHOUSE_TENANCY=single`, `LEARNHOUSE_DOMAIN`, `LEARNHOUSE_FRONTEND_DOMAIN` (academia.holandesnawar.nl), `LEARNHOUSE_SSL=true`, `LEARNHOUSE_AUTH_JWT_SECRET_KEY` (≥32 chars, requerida al arrancar), `LEARNHOUSE_SQL_CONNECTION_STRING`, `LEARNHOUSE_REDIS_CONNECTION_STRING`.
Frontend: `NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL` (con `/`), `NEXT_PUBLIC_LEARNHOUSE_DOMAIN`, `NEXT_PUBLIC_LEARNHOUSE_HTTPS=true`, `PORT=8000`.
Email (Resend): `LEARNHOUSE_EMAIL_PROVIDER=resend`, `LEARNHOUSE_RESEND_API_KEY`, `LEARNHOUSE_SYSTEM_EMAIL_ADDRESS=noreply@holandesnawar.com` (dominio **holandesnawar.com** verificado en Resend; la web es .nl, da igual).
Instalación inicial (solo se usan con BD vacía): `LEARNHOUSE_INITIAL_ADMIN_EMAIL`, `LEARNHOUSE_INITIAL_ADMIN_PASSWORD`, `LEARNHOUSE_INITIAL_ORG_NAME`, `LEARNHOUSE_INITIAL_ORG_SLUG`.

## Cloudflare (DNS)
Zona `holandesnawar.nl`. Registros `academia` y `*.academia` → CNAME a los targets de Railway, en **"Solo DNS" (gris, NO proxied)**. Proxied (naranja) causó **Error 1000**. SSL lo gestiona Railway.

## Cuenta admin
Usuario `admin`, email **holandesnawar@gmail.com** (superadmin). Se creó vía instalador automático (cli.py, con BD vacía + `LEARNHOUSE_INITIAL_ADMIN_PASSWORD`). La contraseña se reseó una vez por SQL (hash **Argon2**, pwdlib 0.3.0, sin pepper — un hash generado fuera vale). La contraseña actual la conoce el usuario.

## Marca — Sistema de diseño Holandés Nawar
- Azul oscuro marca: **#1D0084** (fondos dark, texto sobre blanco). Acentos: **#025dc7** (sobre blanco), **#4da3ff** (sobre dark / CTAs). Naranja **#F58220** SOLO estrellas/ratings.
- Neutros: blanco, off-white **#F0F5FF**, bordes **#DDE6F5**.
- Tipografía: **Inter** (UI/cuerpo) + **Poppins** (títulos). Botones radius **8px**.
- Efectos: glow radial azul + patrón de puntos blancos sutiles (rgba(255,255,255,0.06)) + título con gradiente blanco→transparente sobre dark.
- **Regla:** secciones dark (#1D0084) o light (blanco/#F0F5FF), nunca mezclar. **El contenido principal (cursos) SIEMPRE blanco** para legibilidad.

## Hecho
- **Barra lateral izquierda** (`apps/web/components/Objects/Menus/OrgSidebar.tsx`, usada en `apps/web/app/orgs/[orgslug]/(withmenu)/layout.tsx`): azul Nawar profundo + glow blanco + puntos, texto blanco, activo #4da3ff, **botón colapsar** (persistido en localStorage), cajón móvil. Reemplaza el menú superior `OrgMenu`.
- Email transaccional con **Resend** (invitaciones, reset de contraseña, etc.).
- **Volumen** para uploads (logos persisten).
- Login admin funcionando.

## Hoja de ruta (pendiente)
1. **Pagos** (OSS NO tiene checkout nativo — es función Enterprise EE). Plan acordado: **Stripe** (Payment Link nivel 1, o Embedded Checkout nivel 2 dentro de LearnHouse) + **endpoint de alta propio** que yo construyo en la API (webhook `checkout.session.completed` → crea usuario + lo mete en **grupo de usuarios** del curso → acceso). **SIN Zapier/Make/n8n** (puente first-party). Falta: el usuario elige nivel A/B y da cursos+precios.
2. **Embeber Consultas** (https://consultas-tau.vercel.app): vía iframe. Bloqueado: la app devuelve 403 + necesita cabecera `Content-Security-Policy: frame-ancestors https://academia.holandesnawar.nl` (el usuario controla ese proyecto en Vercel). Luego: página "Consultas" + ítem en barra (alumnos) y sección en panel admin.
3. **Restyle visual** Apple+Circle: tarjetas de curso, Poppins en títulos, home del alumno tipo feed.
4. **Rebrand de emails**: las plantillas son código (`apps/api/src/services/users/emails.py` + `email/utils.py`). Llevan logo y enlaces a `university.learnhouse.io` y remitente "LearnHouse" (hardcodeado en email/utils.py) → cambiar a marca Holandesrida.
5. **Email marketing alumnos** (Brevo u otra) vía webhooks para automatizaciones por comportamiento (re-enganche "no entra en 7 días", etc.).

## Notas de flujo de trabajo
- Desarrollar en `claude/adoring-dijkstra-rI3FL`.
- **`git push` está bloqueado** en el entorno cloud → publicar con las tools de GitHub MCP (`mcp__github__push_files`). Requiere permiso de **escritura** del repo concedido a la conexión de Claude Code.
- Preview: cambiar la rama Source en Railway; `dev` = fallback seguro. Railway solo publica builds que compilan (un build roto no tumba la web).
- Web: **Bun**. Verificar tipos con `bunx tsc --noEmit` antes de subir.
