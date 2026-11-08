import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getConfig } from '@services/config/config'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, getCookieOptions } from '@services/auth/cookies'

/**
 * «Ver como» un alumno (08/11/2026). Lo explica entero
 * apps/api/src/services/panel/ver_como.py.
 *
 * Pide a la escuela una sesión de SOLO LECTURA del alumno, guarda la del
 * administrador aparte (cookies del servidor, que el navegador no puede leer)
 * y pone la del alumno. `salir/` las devuelve.
 */
const BACKEND_URL = (getConfig('NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL') || 'http://localhost:1338').replace(/\/+$/, '')
const GUARDADA_ACCESS = 'LH_vercomo_access'
const GUARDADA_REFRESH = 'LH_vercomo_refresh'
const MARCA = 'LH_ver_como'
const OCHO_HORAS = 8 * 60 * 60

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const access = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
  const refresh = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
  if (!access) return NextResponse.json({ detail: 'Vuelve a entrar en la escuela.' }, { status: 401 })
  if (cookieStore.get(MARCA)?.value) {
    return NextResponse.json({ detail: 'Ya estás viendo la escuela como otra persona: vuelve primero a tu cuenta.' }, { status: 409 })
  }
  let body: any = {}
  try {
    body = await request.json()
  } catch {}
  const orgId = Number(body?.org_id)
  const userId = Number(body?.user_id)
  if (!orgId || !userId) return NextResponse.json({ detail: 'Falta el alumno.' }, { status: 400 })

  const r = await fetch(`${BACKEND_URL}/api/v1/panel/org/${orgId}/ver-como`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
    body: JSON.stringify({ user_id: userId }),
  })
  const datos = await r.json().catch(() => ({}))
  if (!r.ok || !datos?.access_token) {
    return NextResponse.json({ detail: datos?.detail || 'No se ha podido.' }, { status: r.ok ? 500 : r.status })
  }

  const opciones = getCookieOptions(request)
  const res = NextResponse.json({ ok: true, nombre: datos.nombre })
  // La sesión del administrador, guardada para volver.
  res.cookies.set(GUARDADA_ACCESS, access, { ...opciones, maxAge: OCHO_HORAS })
  if (refresh) res.cookies.set(GUARDADA_REFRESH, refresh, { ...opciones, maxAge: OCHO_HORAS })
  // La del alumno, sin refresco de verdad: caduca sola a las 2 horas.
  res.cookies.set(ACCESS_TOKEN_COOKIE, datos.access_token, { ...opciones, maxAge: datos.segundos || 7200 })
  res.cookies.set(REFRESH_TOKEN_COOKIE, 'ver-como', { ...opciones, maxAge: datos.segundos || 7200 })
  // La franja de arriba la lee el navegador: solo el nombre.
  res.cookies.set(MARCA, encodeURIComponent(String(datos.nombre || 'un alumno').slice(0, 80)), {
    ...opciones,
    httpOnly: false,
    maxAge: OCHO_HORAS,
  })
  return res
}
