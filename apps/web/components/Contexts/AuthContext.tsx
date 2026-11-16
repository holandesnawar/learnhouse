'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import {
  getAPIUrl,
  getLEARNHOUSE_TOP_DOMAIN_VAL,
  getLEARNHOUSE_DOMAIN_VAL,
} from '@services/config/config'
import { isSubdomainOf, isSameHost, isLocalhost as isLocalhostCheck } from '@services/utils/ts/hostUtils'
import { QueryClientContext } from '@tanstack/react-query'
import {
  ESPERA_ENTRE_FORZADAS_MS,
  MARGEN_PETICION_MS,
  esDeLaApi,
  esperaReintento,
  expiraDelJwt,
  queHacerConRefresco,
  sePuedeRepetir,
  tocaRenovar,
  tokenDeCabeceras,
} from '@/lib/nawar/sesion'

// Types matching NextAuth's session structure
export interface Session {
  user: any | undefined
  roles?: string[] | undefined
  tokens?: {
    access_token?: string | undefined
    refresh_token?: string | undefined
    expiry?: number | undefined
  } | undefined
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface UseSessionReturn {
  data: Session | null
  status: SessionStatus
  update: (force?: boolean) => Promise<void>
}

export interface SignInOptions {
  redirect?: boolean
  callbackUrl?: string
  email?: string
  password?: string
  // SSO fields
  sso?: string
  sso_access_token?: string
  sso_refresh_token?: string
  sso_user?: string
  sso_expiry?: number
  // For OAuth
  orgId?: number
  orgSlug?: string
}

export interface SignInResult {
  ok: boolean
  error: string | null
  url: string | null
  status: number
}

export interface SignOutOptions {
  callbackUrl?: string
  redirect?: boolean
}

// Session cache for performance (similar to NextAuth's 10s cache)
interface SessionCache {
  data: Session
  timestamp: number
}

const SESSION_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const TOKEN_REFRESH_THRESHOLD = 60 * 1000 // 1 minute before expiry
const AUTH_BROADCAST_CHANNEL = 'learnhouse_auth_sync'
const OAUTH_STATE_COOKIE = 'LH_oauth_state'

type ResultadoToken =
  | { tipo: 'ok'; access_token: string; expiry: number | null }
  | { tipo: 'fuera' }
  | { tipo: 'reintentar' }

// Context
interface AuthContextValue {
  session: Session | null
  status: SessionStatus
  accessToken: string | null
  refreshSession: (force?: boolean) => Promise<void>
  signIn: (provider: string, options?: SignInOptions) => Promise<SignInResult | void>
  signOut: (options?: SignOutOptions) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Generate cryptographically secure random string for CSRF protection
function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Check if current hostname is a custom domain
function isCustomDomain(): boolean {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  const domain = getLEARNHOUSE_DOMAIN_VAL()
  return !isSubdomainOf(hostname, domain) && !isSameHost(hostname, domain) && !isLocalhostCheck(hostname)
}

// Get cookie attributes based on current domain context
function getCookieAttributes(): { secureAttr: string; domainAttr: string; sameSiteAttr: string } {
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const secureAttr = isSecure ? '; Secure' : ''
  const topDomain = getLEARNHOUSE_TOP_DOMAIN_VAL()

  // For custom domains, don't set domain attribute (host-only cookie)
  // For localhost, don't set domain attribute
  // For subdomains of main domain, set domain to allow sharing
  let domainAttr = ''
  if (!isCustomDomain() && topDomain !== 'localhost') {
    domainAttr = `; domain=.${topDomain}`
  }

  // SameSite=Lax is generally safe and allows top-level navigation
  const sameSiteAttr = '; SameSite=Lax'

  return { secureAttr, domainAttr, sameSiteAttr }
}

// Store OAuth CSRF state in a cookie (shared across subdomains, unlike sessionStorage)
// For custom domains, cookie is host-only so it stays on the same origin.
// For subdomains, cookie is scoped to top domain so callback on main domain can read it.
function setOAuthStateCookie(csrf: string): void {
  const { secureAttr, domainAttr, sameSiteAttr } = getCookieAttributes()
  // 5 minute expiry matching the state validation window
  const expires = new Date(Date.now() + 5 * 60 * 1000).toUTCString()
  const value = JSON.stringify({ csrf, timestamp: Date.now() })
  document.cookie = `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}; path=/${sameSiteAttr}${secureAttr}${domainAttr}; expires=${expires}`
}

function getOAuthStateCookie(): { csrf: string; timestamp: number } | null {
  try {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.trim().split('=')
      if (name === OAUTH_STATE_COOKIE) {
        return JSON.parse(decodeURIComponent(rest.join('=')))
      }
    }
  } catch {}
  return null
}

function clearOAuthStateCookie(): void {
  const { secureAttr, domainAttr, sameSiteAttr } = getCookieAttributes()
  document.cookie = `${OAUTH_STATE_COOKIE}=; path=/${sameSiteAttr}${secureAttr}${domainAttr}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

// Session Provider Component
interface SessionProviderProps {
  children: React.ReactNode
  refetchInterval?: number
}

export function SessionProvider({
  children,
  refetchInterval = 60000,
}: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null)
  const sessionCacheRef = useRef<SessionCache | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  // Puede no haberlo (fuera de <QueryClientProvider>): entonces no se invalida nada.
  const queryClient = useContext(QueryClientContext)

  // Lo último de verdad, para lo que vive fuera del render (los eventos de la
  // ventana, el reloj y el vigilante de fetch). Se escriben al cambiar el
  // permiso y se sincronizan con el estado en cada render.
  const tokenRef = useRef<string | null>(null)
  const expiryRef = useRef<number | null>(null)
  const statusRef = useRef<SessionStatus>('loading')

  // Una sola petición a /api/auth/refresh a la vez en esta pestaña, y una sola
  // renovación entera (permiso + sesión) a la vez.
  const refreshPromiseRef = useRef<Promise<ResultadoToken> | null>(null)
  const renovandoRef = useRef<Promise<string | null> | null>(null)
  // Reintento tras un fallo de red (con espera creciente).
  const reintentoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentosRef = useRef(0)
  // Cuándo se forzó la última renovación por un 401 (para no entrar en bucle).
  const ultimaForzadaRef = useRef(0)
  // El fetch del navegador SIN el vigilante: las peticiones de la propia sesión
  // van por aquí (si fueran por el vigilante, una renovación se esperaría a sí misma).
  const fetchCrudoRef = useRef<typeof fetch | null>(null)
  const crudo = (input: string, init?: RequestInit): Promise<Response> =>
    (fetchCrudoRef.current || fetch)(input, init)

  useEffect(() => {
    tokenRef.current = accessToken
    expiryRef.current = tokenExpiry
  }, [accessToken, tokenExpiry])
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const ponerToken = (token: string, expiry?: number | null) => {
    const exp = typeof expiry === 'number' ? expiry : expiraDelJwt(token)
    tokenRef.current = token
    expiryRef.current = exp
    setAccessToken(token)
    setTokenExpiry(exp)
  }

  const cancelarReintento = () => {
    if (reintentoRef.current) clearTimeout(reintentoRef.current)
    reintentoRef.current = null
  }

  // La sesión ya no vale de verdad: como siempre, a «sin sesión».
  const cerrarLocal = () => {
    cancelarReintento()
    setSession(null)
    setAccessToken(null)
    setTokenExpiry(null)
    setStatus('unauthenticated')
    tokenRef.current = null
    expiryRef.current = null
    statusRef.current = 'unauthenticated'
    sessionCacheRef.current = null
  }

  // Fetch user session from backend.
  // Devuelve la sesión, 'fuera' si el servidor dice que el permiso no vale
  // (401) o null si ha fallado otra cosa (red, 500…), que NO saca a nadie.
  const fetchUserSession = useCallback(async (token: string, expiry?: number): Promise<Session | 'fuera' | null> => {
    try {
      const response = await crudo(`${getAPIUrl()}users/session`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      })

      if (response.status === 401) return 'fuera'
      if (!response.ok) {
        console.error(`Session fetch failed with status: ${response.status}`)
        return null
      }

      const data = await response.json()
      return {
        user: data.user,
        roles: data.roles,
        tokens: {
          access_token: token,
          refresh_token: undefined, // Stored in httpOnly cookie
          expiry: expiry,
        },
      }
    } catch (error) {
      console.error('Error fetching user session:', error)
      return null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if a session might exist (marker cookie is set alongside httpOnly auth cookies)
  const hasSessionMarker = useCallback((): boolean => {
    return typeof document !== 'undefined' && document.cookie.includes('LH_session')
  }, [])

  // Pide un permiso a /api/auth/refresh. `force` se salta el atajo del
  // servidor de Next (que devuelve el permiso de la cookie si aún le quedan
  // más de 2 minutos) y pide uno nuevo de verdad a la API.
  const pedirToken = (force: boolean): Promise<ResultadoToken> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current
    refreshPromiseRef.current = (async (): Promise<ResultadoToken> => {
      try {
        const response = await crudo(`/api/auth/refresh${force ? '?force=1' : ''}`, {
          method: 'GET',
          credentials: 'include',
        })
        const que = queHacerConRefresco(response.status)
        if (que === 'fuera') return { tipo: 'fuera' }
        if (que === 'reintentar') return { tipo: 'reintentar' }
        const data = await response.json().catch(() => null)
        if (!data?.access_token) {
          console.error('Invalid refresh response: missing access_token')
          return { tipo: 'reintentar' }
        }
        return {
          tipo: 'ok',
          access_token: data.access_token,
          expiry: typeof data.expiry === 'number' ? data.expiry : expiraDelJwt(data.access_token),
        }
      } catch (error) {
        console.error('Token refresh failed:', error)
        return { tipo: 'reintentar' }
      } finally {
        refreshPromiseRef.current = null
      }
    })()
    return refreshPromiseRef.current
  }

  const renovarRef = useRef<(opciones?: { force?: boolean; conSesion?: boolean }) => Promise<string | null>>(
    async () => null
  )

  const programarReintento = () => {
    if (reintentoRef.current) return
    const espera = esperaReintento(intentosRef.current)
    intentosRef.current += 1
    reintentoRef.current = setTimeout(() => {
      reintentoRef.current = null
      renovarRef.current({ conSesion: !sessionCacheRef.current })
    }, espera)
  }

  /**
   * Renueva el permiso y, si cambia o no hay sesión, vuelve a pedir la sesión.
   * Devuelve el permiso vigente o null. Un fallo de red deja todo como está y
   * vuelve a probar sola; solo un 401 del refresco cierra la sesión.
   */
  renovarRef.current = (opciones = {}) => {
    if (renovandoRef.current) return renovandoRef.current
    renovandoRef.current = (async (): Promise<string | null> => {
      try {
        let r = await pedirToken(!!opciones.force)
        // Otra pestaña puede haber dejado ya un permiso nuevo en la cookie; si
        // el que llega sigue a punto de caducar, se pide uno nuevo de verdad.
        if (r.tipo === 'ok' && !opciones.force && tocaRenovar(r.expiry)) r = await pedirToken(true)
        if (r.tipo === 'fuera') {
          cerrarLocal()
          return null
        }
        if (r.tipo === 'reintentar') {
          programarReintento()
          return null
        }
        intentosRef.current = 0
        cancelarReintento()
        const cambio = r.access_token !== tokenRef.current
        ponerToken(r.access_token, r.expiry)
        if (cambio || opciones.conSesion || !sessionCacheRef.current) {
          const s = await fetchUserSession(r.access_token, r.expiry ?? undefined)
          if (s === 'fuera') {
            cerrarLocal()
            return null
          }
          if (s) {
            setSession(s)
            setStatus('authenticated')
            statusRef.current = 'authenticated'
            sessionCacheRef.current = { data: s, timestamp: Date.now() }
          } else if (sessionCacheRef.current) {
            // Sin red para la sesión, pero con permiso nuevo: se queda la
            // sesión de antes con el permiso nuevo.
            const conToken: Session = {
              ...sessionCacheRef.current.data,
              tokens: { ...sessionCacheRef.current.data.tokens, access_token: r.access_token, expiry: r.expiry ?? undefined },
            }
            sessionCacheRef.current = { data: conToken, timestamp: sessionCacheRef.current.timestamp }
            setSession(conToken)
          } else {
            programarReintento()
          }
        }
        return r.access_token
      } finally {
        renovandoRef.current = null
      }
    })()
    return renovandoRef.current
  }

  // Set up BroadcastChannel for cross-tab communication
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannelRef.current = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)

      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data.type === 'LOGOUT') {
          // Another tab logged out, clear our state too
          cerrarLocal()
        } else if (event.data.type === 'LOGIN') {
          // Another tab logged in, refresh our session
          renovarRef.current({ conSesion: true })
        }
      }
    }

    return () => {
      broadcastChannelRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Main session refresh function. La copia guardada (10 min) solo se usa si
  // el permiso NO está a punto de caducar: antes se devolvía la copia aunque
  // el permiso ya hubiera caducado.
  const refreshSession = useCallback(async (force?: boolean) => {
    const now = Date.now()
    const cache = sessionCacheRef.current
    if (!force && cache && now - cache.timestamp < SESSION_CACHE_TTL && !tocaRenovar(expiryRef.current, now)) {
      setSession(cache.data)
      setStatus('authenticated')
      return
    }
    if (force) sessionCacheRef.current = null

    const token = tokenRef.current
    if (!token || tocaRenovar(expiryRef.current, now)) {
      await renovarRef.current({ conSesion: true })
      return
    }

    const s = await fetchUserSession(token, expiryRef.current ?? undefined)
    if (s === 'fuera') {
      // El permiso aún no había caducado y el servidor lo rechaza (contraseña
      // cambiada, sesión cerrada en otro sitio…): se pide uno nuevo y, si
      // tampoco vale, la sesión se cierra.
      await renovarRef.current({ force: true, conSesion: true })
      return
    }
    if (s) {
      setSession(s)
      setStatus('authenticated')
      sessionCacheRef.current = { data: s, timestamp: now }
    }
    // null (sin red): se queda como estaba.
  }, [fetchUserSession])
  const refreshSessionRef = useRef(refreshSession)
  refreshSessionRef.current = refreshSession

  // Initialize session on mount
  useEffect(() => {
    // Skip entirely if no session marker — no httpOnly refresh token exists
    if (!hasSessionMarker()) {
      setStatus('unauthenticated')
      return
    }
    setStatus('loading')
    renovarRef.current({ conSesion: true })
    return () => cancelarReintento()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Set up refetch interval
  useEffect(() => {
    if (refetchInterval && status === 'authenticated') {
      intervalRef.current = setInterval(() => {
        refreshSessionRef.current()
      }, refetchInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refetchInterval, status])

  // Volver a la pestaña, recuperar la red o despertar el portátil (16/11/2026).
  // El reloj de arriba no corre con el portátil dormido ni casi con la pestaña
  // escondida: al volver, se mira si al permiso le queda poco y se renueva.
  // También cada minuto (es una cuenta local: no pide nada si no toca).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const comprobar = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (statusRef.current === 'unauthenticated') return
      if (reintentoRef.current) {
        // Esperando a reintentar tras un fallo de red: ahora, ya.
        cancelarReintento()
        renovarRef.current({ conSesion: !sessionCacheRef.current })
        return
      }
      if (statusRef.current === 'authenticated' && tocaRenovar(expiryRef.current)) {
        renovarRef.current({})
      }
    }
    const reloj = setInterval(comprobar, 60_000)
    document.addEventListener('visibilitychange', comprobar)
    window.addEventListener('focus', comprobar)
    window.addEventListener('online', comprobar)
    window.addEventListener('pageshow', comprobar)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', comprobar)
      window.removeEventListener('focus', comprobar)
      window.removeEventListener('online', comprobar)
      window.removeEventListener('pageshow', comprobar)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // El vigilante de las peticiones a la API (16/11/2026). Sin tocar ningún
  // servicio:
  //  - Si una petición sale con un permiso caducado (o a 30 s de caducar),
  //    antes se renueva y sale con el nuevo. Importa porque la API trata un
  //    permiso caducado como un visitante anónimo y contesta 200 con solo lo
  //    público (la barra sin clases, el chat vacío), sin ningún error.
  //  - Si contesta 401, se renueva una vez (como mucho cada 30 s) y, si es una
  //    lectura (GET), se repite con el permiso nuevo. Un POST no se repite: un
  //    401 puede ser «contraseña actual incorrecta».
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
    const original = window.fetch
    fetchCrudoRef.current = original.bind(window)

    const tokenVigente = async (): Promise<string | null> => {
      if (tokenRef.current && !tocaRenovar(expiryRef.current, Date.now(), MARGEN_PETICION_MS)) return tokenRef.current
      return renovarRef.current({})
    }
    const trasRechazo = async (usado: string | null): Promise<string | null> => {
      const ahora = Date.now()
      const actual = tokenRef.current
      // Otro ya lo ha renovado mientras tanto.
      if (actual && actual !== usado && !tocaRenovar(expiryRef.current, ahora, MARGEN_PETICION_MS)) return actual
      if (ahora - ultimaForzadaRef.current < ESPERA_ENTRE_FORZADAS_MS) return null
      ultimaForzadaRef.current = ahora
      return renovarRef.current({ force: true })
    }
    const conToken = (init: RequestInit | undefined, token: string): RequestInit => {
      const headers = new Headers(init?.headers || undefined)
      headers.set('Authorization', `Bearer ${token}`)
      return { ...(init || {}), headers }
    }

    const vigilado = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let usado: string | null = null
      let opciones = init
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null
        if (url && statusRef.current === 'authenticated' && esDeLaApi(url, getAPIUrl(), window.location.origin)) {
          usado = tokenDeCabeceras(init?.headers)
        }
        if (usado && tocaRenovar(expiraDelJwt(usado), Date.now(), MARGEN_PETICION_MS)) {
          const nuevo = await tokenVigente()
          if (nuevo && nuevo !== usado) opciones = conToken(init, nuevo)
        }
      } catch {
        usado = null
        opciones = init
      }

      const res = await original.call(window, input, opciones)
      if (!usado || res.status !== 401) return res

      try {
        const enviado = tokenDeCabeceras(opciones?.headers) || usado
        const nuevo = await trasRechazo(enviado)
        const body: unknown = opciones?.body
        const repetible = !(typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
        if (!nuevo || nuevo === enviado || !repetible || !sePuedeRepetir(opciones?.method)) return res
        return await original.call(window, input, conToken(opciones, nuevo))
      } catch {
        return res
      }
    }

    window.fetch = vigilado as typeof fetch
    return () => {
      if (window.fetch === (vigilado as typeof fetch)) window.fetch = original
      fetchCrudoRef.current = null
    }
  }, [])

  // Con un permiso nuevo, todas las consultas se vuelven a pedir: las claves
  // de react-query no llevan el permiso, así que lo que llegó con el caducado
  // (como anónimo: sin clases, sin canales) se quedaba en pantalla.
  const tokenDeLaSesion = session?.tokens?.access_token
  const tokenAnteriorRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const antes = tokenAnteriorRef.current
    tokenAnteriorRef.current = tokenDeLaSesion
    if (antes && tokenDeLaSesion && antes !== tokenDeLaSesion) {
      queryClient?.invalidateQueries()
    }
  }, [tokenDeLaSesion, queryClient])

  // Sign in function
  const handleSignIn = useCallback(
    async (provider: string, options: SignInOptions = {}): Promise<SignInResult | void> => {
      const { redirect = true, callbackUrl = '/' } = options

      try {
        if (provider === 'credentials') {
          // Handle SSO login (tokens already obtained)
          if (options.sso === 'true' && options.sso_access_token) {
            const user = options.sso_user ? JSON.parse(options.sso_user) : null
            // Use server-provided expiry or default to 8 hours
            const expiry = options.sso_expiry || (Date.now() + 8 * 60 * 60 * 1000)

            const newSession: Session = {
              user,
              roles: [],
              tokens: {
                access_token: options.sso_access_token,
                refresh_token: options.sso_refresh_token,
                expiry,
              },
            }
            setSession(newSession)
            setAccessToken(options.sso_access_token)
            setTokenExpiry(expiry)
            setStatus('authenticated')
            sessionCacheRef.current = {
              data: newSession,
              timestamp: Date.now(),
            }

            // Notify other tabs
            broadcastChannelRef.current?.postMessage({ type: 'LOGIN' })

            if (redirect) {
              window.location.href = callbackUrl
            }

            return { ok: true, error: null, url: callbackUrl, status: 200 }
          }

          // Regular credentials login
          // Use Next.js API route to ensure cookies are set correctly
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              username: options.email || '',
              password: options.password || '',
            }),
            credentials: 'include',
          })

          const data = await response.json()

          if (!response.ok) {
            // Return error in same format as NextAuth
            const errorData = data.detail || data
            return {
              ok: false,
              error: JSON.stringify({
                code: errorData?.code || 'UNKNOWN_ERROR',
                message: errorData?.message || 'Login failed',
                email: errorData?.email,
                retry_after: errorData?.retry_after,
              }),
              url: null,
              status: response.status,
            }
          }

          // Validate response structure
          if (!data.tokens?.access_token) {
            return {
              ok: false,
              error: JSON.stringify({ code: 'INVALID_RESPONSE', message: 'Invalid server response' }),
              url: null,
              status: 500,
            }
          }

          // Login successful
          const newSession: Session = {
            user: data.user,
            roles: [],
            tokens: {
              access_token: data.tokens.access_token,
              refresh_token: data.tokens.refresh_token,
              expiry: data.tokens.expiry,
            },
          }

          setSession(newSession)
          setAccessToken(data.tokens.access_token)
          setTokenExpiry(data.tokens.expiry || null)
          setStatus('authenticated')
          sessionCacheRef.current = {
            data: newSession,
            timestamp: Date.now(),
          }

          // Fetch full session with roles
          const fullSession = await fetchUserSession(data.tokens.access_token, data.tokens.expiry)
          if (fullSession && fullSession !== 'fuera') {
            fullSession.tokens = newSession.tokens
            setSession(fullSession)
            sessionCacheRef.current = {
              data: fullSession,
              timestamp: Date.now(),
            }
          }

          // Notify other tabs
          broadcastChannelRef.current?.postMessage({ type: 'LOGIN' })

          if (redirect) {
            window.location.href = callbackUrl
          }

          return { ok: true, error: null, url: callbackUrl, status: 200 }
        }

        if (provider === 'google') {
          // Store org context in cookies before OAuth redirect
          const { secureAttr, domainAttr, sameSiteAttr } = getCookieAttributes()
          const baseAttributes = `; path=/${sameSiteAttr}${secureAttr}`

          if (options.orgSlug || options.orgId) {
            if (options.orgSlug) {
              document.cookie = `LH_oauth_orgslug=${options.orgSlug}${baseAttributes}${domainAttr}`
            }
            if (options.orgId) {
              document.cookie = `LH_oauth_org_id=${options.orgId}${baseAttributes}${domainAttr}`
            }
          }

          // Generate CSRF token for state parameter
          const csrfToken = generateSecureToken()
          const stateData: Record<string, any> = {
            callbackUrl,
            csrf: csrfToken,
            timestamp: Date.now(),
          }

          // For custom domains, embed returnOrigin so the main domain callback can bounce back
          if (isCustomDomain()) {
            stateData.returnOrigin = window.location.origin
          }

          const state = btoa(JSON.stringify(stateData))

          // Store CSRF token in cookie for validation on callback
          setOAuthStateCookie(csrfToken)

          // Always use main domain for redirect URI — only one URI registered with Google
          const redirectUri = `${window.location.protocol}//${getLEARNHOUSE_DOMAIN_VAL()}/auth/callback/google`

          // Get Google OAuth URL from server (client ID lives server-side only)
          const authResponse = await fetch('/api/auth/google/authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ redirect_uri: redirectUri, state, scope: 'openid email profile' }),
          })

          if (!authResponse.ok) {
            const errorData = await authResponse.json().catch(() => ({}))
            console.error('Google OAuth initiation failed:', errorData)
            return {
              ok: false,
              error: errorData.error || 'Google OAuth not configured',
              url: null,
              status: authResponse.status,
            }
          }

          const { url: googleAuthUrl } = await authResponse.json()
          window.location.href = googleAuthUrl
          return
        }

        // Unknown provider
        return {
          ok: false,
          error: `Unknown provider: ${provider}`,
          url: null,
          status: 400,
        }
      } catch (error: any) {
        console.error('Sign in error:', error)
        return {
          ok: false,
          error: error.message || 'Sign in failed',
          url: null,
          status: 500,
        }
      }
    },
    [fetchUserSession]
  )

  // Sign out function
  const handleSignOut = useCallback(async (options: SignOutOptions = {}) => {
    const { callbackUrl = '/', redirect = true } = options

    let logoutSuccess = false
    try {
      // Use Next.js API route to ensure cookies are cleared correctly
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      logoutSuccess = response.ok
    } catch (error) {
      console.error('Logout error:', error)
    }

    // Clear local state regardless of backend response
    cerrarLocal()

    // Clear refresh promise
    refreshPromiseRef.current = null
    renovandoRef.current = null

    // Clear any auth cookies on client side
    const { secureAttr, domainAttr, sameSiteAttr } = getCookieAttributes()
    const expireAttr = '; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = `LH_oauth_orgslug=; path=/${expireAttr}${secureAttr}${domainAttr}`
    document.cookie = `LH_oauth_org_id=; path=/${expireAttr}${secureAttr}${domainAttr}`

    // Clear OAuth state
    clearOAuthStateCookie()

    // Notify other tabs about logout
    broadcastChannelRef.current?.postMessage({ type: 'LOGOUT' })

    if (redirect) {
      window.location.href = callbackUrl
    }

    // If backend logout failed, log a warning (user is still logged out locally)
    if (!logoutSuccess) {
      console.warn('Backend logout may have failed. User logged out locally.')
    }
  }, [])

  const contextValue: AuthContextValue = {
    session,
    status,
    accessToken,
    refreshSession,
    signIn: handleSignIn,
    signOut: handleSignOut,
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}

// useSession hook - matches NextAuth's API exactly
export function useSession(): UseSessionReturn {
  const context = useContext(AuthContext)

  if (!context) {
    // Return unauthenticated state if used outside provider
    return {
      data: null,
      status: 'unauthenticated',
      update: async () => {},
    }
  }

  return {
    data: context.session,
    status: context.status,
    update: context.refreshSession,
  }
}

// Validate OAuth state parameter (call this on callback page)
export function validateOAuthState(state: string): { valid: boolean; callbackUrl: string } {
  const defaultResult = { valid: false, callbackUrl: '/redirect_from_auth' }

  try {
    const stateData = JSON.parse(atob(state))
    const stored = getOAuthStateCookie()

    if (!stored) {
      console.error('No stored OAuth state found')
      return defaultResult
    }

    // Validate CSRF token matches
    if (stateData.csrf !== stored.csrf) {
      console.error('OAuth CSRF token mismatch')
      return defaultResult
    }

    // Validate state is not too old (5 minutes max)
    const stateAge = Date.now() - stateData.timestamp
    if (stateAge > 5 * 60 * 1000) {
      console.error('OAuth state expired')
      return defaultResult
    }

    // Clear stored state after successful validation
    clearOAuthStateCookie()

    return {
      valid: true,
      callbackUrl: stateData.callbackUrl || '/redirect_from_auth',
    }
  } catch (error) {
    console.error('OAuth state validation error:', error)
    return defaultResult
  }
}

// signIn function - matches NextAuth's API
export async function signIn(
  provider: string,
  options?: SignInOptions
): Promise<SignInResult | void> {
  // This needs to be called from within a component that has access to the context
  // For now, we'll handle it differently for Google OAuth which needs redirect

  if (provider === 'google') {
    const { secureAttr, domainAttr, sameSiteAttr } = getCookieAttributes()
    const baseAttributes = `; path=/${sameSiteAttr}${secureAttr}`

    // Store org context from cookies if present (for compatibility)
    // The options should contain orgSlug and orgId if needed

    // Generate CSRF token for state parameter
    const csrfToken = generateSecureToken()
    const callbackUrl = options?.callbackUrl || '/'
    const stateData: Record<string, any> = {
      callbackUrl,
      csrf: csrfToken,
      timestamp: Date.now(),
    }

    // For custom domains, embed returnOrigin so the main domain callback can bounce back
    if (isCustomDomain()) {
      stateData.returnOrigin = window.location.origin
    }

    const state = btoa(JSON.stringify(stateData))

    // Store CSRF token in cookie for validation on callback
    setOAuthStateCookie(csrfToken)

    // Always use main domain for redirect URI — only one URI registered with Google
    const redirectUri = `${window.location.protocol}//${getLEARNHOUSE_DOMAIN_VAL()}/auth/callback/google`

    // Get Google OAuth URL from server (client ID lives server-side only)
    const authResponse = await fetch('/api/auth/google/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_uri: redirectUri, state, scope: 'openid email profile' }),
    })

    if (!authResponse.ok) {
      const errorData = await authResponse.json().catch(() => ({}))
      console.error('Google OAuth initiation failed:', errorData)
      return {
        ok: false,
        error: errorData.error || 'Google OAuth not configured',
        url: null,
        status: authResponse.status,
      }
    }

    const { url: googleAuthUrl } = await authResponse.json()
    window.location.href = googleAuthUrl
    return
  }

  // For credentials, we need context - this will be handled by the component
  console.warn('signIn should be called with useAuth() context for credentials provider')
  return {
    ok: false,
    error: 'Use useAuth().signIn() for credentials provider',
    url: null,
    status: 400,
  }
}

// signOut function - matches NextAuth's API
export async function signOut(options?: SignOutOptions): Promise<void> {
  const { callbackUrl = '/', redirect = true } = options || {}

  try {
    // Use Next.js API route to ensure cookies are cleared correctly
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch (error) {
    console.error('Logout error:', error)
  }

  // Clear cookies
  const { secureAttr, domainAttr, sameSiteAttr } = getCookieAttributes()
  const expireAttr = '; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = `LH_oauth_orgslug=; path=/${expireAttr}${secureAttr}${domainAttr}`
  document.cookie = `LH_oauth_org_id=; path=/${expireAttr}${secureAttr}${domainAttr}`

  // Clear OAuth state
  clearOAuthStateCookie()

  // Try to notify other tabs (if BroadcastChannel is available)
  try {
    const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
    bc.postMessage({ type: 'LOGOUT' })
    bc.close()
  } catch {
    // BroadcastChannel not available
  }

  if (redirect) {
    window.location.href = callbackUrl
  }
}

// Hook for components that need full auth control
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within a SessionProvider')
  }

  return {
    session: context.session,
    status: context.status,
    accessToken: context.accessToken,
    signIn: context.signIn,
    signOut: context.signOut,
    refreshSession: context.refreshSession,
    // Convenience method to get valid access token (refreshes if needed)
    getAccessToken: async (): Promise<string | null> => {
      if (context.accessToken) {
        const expiry = context.session?.tokens?.expiry
        if (expiry && Date.now() + TOKEN_REFRESH_THRESHOLD >= expiry) {
          await context.refreshSession()
        }
        return context.accessToken
      }
      return null
    },
  }
}

export default SessionProvider
