'use client'
/**
 * La cara de quien escribe (08/11/2026): su foto del perfil si la tiene y, si
 * no, sus iniciales en un círculo de color suave, como en Circle. Nunca la
 * silueta gris.
 */
import React, { useState } from 'react'

const TONOS = [
  ['#E3EBFA', '#0b2da0'],
  ['#E7F5EC', '#15803D'],
  ['#FBEFE3', '#9A5B12'],
  ['#F1E8FA', '#6D28D9'],
  ['#FCE8EE', '#BE185D'],
  ['#E6F4F7', '#0E7490'],
]

export function iniciales(nombre: string): string {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  const a = partes[0][0] || ''
  const b = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (a + b).toUpperCase()
}

function tonoDe(nombre: string) {
  let h = 0
  for (const c of String(nombre || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONOS[h % TONOS.length]
}

export default function AvatarPersona({ nombre, src, size = 36 }: { nombre: string; src?: string | null; size?: number }) {
  const [rota, setRota] = useState(false)
  if (src && !rota) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setRota(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const [fondo, letra] = tonoDe(nombre)
  return (
    <span
      className="rounded-full font-semibold flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size, background: fondo, color: letra, fontSize: Math.round(size * 0.38) }}
    >
      {iniciales(nombre)}
    </span>
  )
}
