import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE, getCookieOptions } from '@services/auth/cookies'

/** Vuelve a la cuenta del administrador después de «Ver como» (08/11/2026). */
const GUARDADA_ACCESS = 'LH_vercomo_access'
const GUARDADA_REFRESH = 'LH_vercomo_refresh'
const MARCA = 'LH_ver_como'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const access = cookieStore.get(GUARDADA_ACCESS)?.value
  const refresh = cookieStore.get(GUARDADA_REFRESH)?.value
  const opciones = getCookieOptions(request)
  const res = NextResponse.json({ ok: true, vuelve: Boolean(access || refresh) })
  for (const n of [GUARDADA_ACCESS, GUARDADA_REFRESH]) res.cookies.set(n, '', { ...opciones, maxAge: 0 })
  res.cookies.set(MARCA, '', { ...opciones, httpOnly: false, maxAge: 0 })
  if (access) res.cookies.set(ACCESS_TOKEN_COOKIE, access, { ...opciones, maxAge: ACCESS_TOKEN_MAX_AGE })
  else res.cookies.set(ACCESS_TOKEN_COOKIE, '', { ...opciones, maxAge: 0 })
  if (refresh) res.cookies.set(REFRESH_TOKEN_COOKIE, refresh, { ...opciones, maxAge: REFRESH_TOKEN_MAX_AGE })
  else res.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...opciones, maxAge: 0 })
  return res
}
