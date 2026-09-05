import '../styles/globals.css'
import { getLEARNHOUSE_TOP_DOMAIN_VAL, getLEARNHOUSE_TELEMETRY_DISABLED_VAL } from '@services/config/config'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import Providers from '@components/Providers'
import { Wix_Madefor_Text, Poppins, Inter, Noto_Color_Emoji } from 'next/font/google'

const isDevEnv = getLEARNHOUSE_TOP_DOMAIN_VAL() === 'localhost'
const isTelemetryDisabled = getLEARNHOUSE_TELEMETRY_DISABLED_VAL() === 'true'

// El icono de la pestaña por defecto: **el mismo archivo que la web**
// (`nawar-web/public/favicon.png`, copiado aquí byte a byte). Antes apuntaba a
// `docs.holandesnawar.com/img/Nawar.favicon.png`, que es un icono viejo y
// distinto del de la web, y encima colgaba de un dominio de fuera.
//
// Esto es solo el valor por defecto: las páginas de la organización y las de
// `/auth` siguen usando el favicon subido desde el panel, que manda.
const NAWAR_FAVICON = '/nawar-favicon.png'

// El icono de la pantalla de inicio al instalar la escuela como app. Es el
// mismo dibujo que el favicon pero SIN transparencia: iOS no respeta el alfa
// en los iconos de pantalla de inicio y las esquinas redondeadas saldrían
// negras. Se generan desde `nawar-favicon.png` (ver manifest.webmanifest).
const NAWAR_APPLE_ICON = '/nawar-apple-touch-icon.png'

export const metadata: Metadata = {
  applicationName: 'Holandés Nawar',
  // Instalar la escuela en el móvil (ver components/PWA/InstallAppPrompt.tsx).
  // El archivo vive en /public y el nombre lleva punto a propósito: el matcher
  // de `proxy.ts` excluye `[\w-]+\.\w+`, así que los archivos sueltos de /public
  // no pasan por el middleware de tenancy. Una carpeta (/icons/…) SÍ pasaría.
  manifest: '/manifest.webmanifest',
  icons: {
    icon: NAWAR_FAVICON,
    shortcut: NAWAR_FAVICON,
    apple: NAWAR_APPLE_ICON,
  },
  appleWebApp: {
    capable: true,
    title: 'Nawar',
    // `default` y no `black-translucent`: el translúcido mete el contenido por
    // debajo de la barra de estado y obligaría a repasar los safe-area de
    // todas las pantallas. No es trabajo de la semana de lanzar.
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1D0084',
}

const wixMadeforText = Wix_Madefor_Text({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-default',
})

// Brand fonts for the native exercises (Holandés Nawar): Poppins for titles,
// Inter for body. Exposed as CSS variables consumed via var(--font-poppins).
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-poppins',
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// Emoji consistentes en todos los dispositivos: en Apple se usan los nativos
// (van antes en el stack), y en Windows/Linux/Android este webfont sustituye
// a los emojis del sistema (los de Segoe en Windows son feos). Solo se
// descarga cuando el sistema no tiene Apple Color Emoji.
const notoEmoji = Noto_Color_Emoji({
  subsets: ['emoji'],
  weight: '400',
  display: 'swap',
  variable: '--font-emoji',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html className={`${wixMadeforText.variable} ${poppins.variable} ${inter.variable} ${notoEmoji.variable}`} lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronous script — blocks parsing to guarantee window.__RUNTIME_CONFIG__ exists before any JS runs.
            Next.js <Script strategy="beforeInteractive"> is not truly blocking in all browsers (Safari). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/runtime-config.js" />
        {/* Prevent white flash on embed routes: set html+body bg before body is painted.
            Reads the optional ?bgcolor param (hex-validated) or defaults to dark. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/embed-bg.js" />
        {/* Next escribe `mobile-web-app-capable` a partir de `appleWebApp`, y
            esa es la etiqueta moderna. Pero Safari solo la entiende desde
            iOS 16.4: en un iPhone más viejo, sin la versión con prefijo, el
            icono instalado abre Safari con su barra en vez de a pantalla
            completa. Se escribe a mano porque el API de metadatos ya no la
            genera. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning>
        {
            isDevEnv ? '' : isTelemetryDisabled ? '' :
                            <Script
                                data-website-id="a1af6d7a-9286-4a1f-8385-ddad2a29fcbb"
                                src="/umami/script.js"
                            />
        }
        <Providers>
          <main className="animate-fade-in">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
