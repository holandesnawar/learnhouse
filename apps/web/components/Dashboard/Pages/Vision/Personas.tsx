'use client'

/**
 * Los encargados de una tarjeta de Visión, como etiquetas: se escribe el
 * nombre y Intro (o coma). Propone los nombres ya usados y los del equipo del
 * panel, pero vale cualquiera: no hace falta que la persona tenga cuenta.
 * Se guardan en `responsable` separados por comas (ver `semanasTrabajo.ts`).
 */

import React, { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { colorPersona, iniciales, juntarPersonas, personasDe } from '@lib/nawar/semanasTrabajo'

/** El circulito con las iniciales. */
export function Avatar({ nombre, tam = 20 }: { nombre: string; tam?: number }) {
  return (
    <span
      title={nombre}
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 ring-2 ring-white"
      style={{ width: tam, height: tam, background: colorPersona(nombre), fontSize: Math.round(tam * 0.42) }}
    >
      {iniciales(nombre)}
    </span>
  )
}

/** Varios encargados en poco sitio: hasta 3 circulitos y «+N». */
export function Avatares({ personas, tam = 20 }: { personas: string[]; tam?: number }) {
  if (!personas.length) return null
  const vistas = personas.slice(0, 3)
  return (
    <span className="inline-flex items-center -space-x-1.5" title={personas.join(', ')}>
      {vistas.map((p) => (
        <Avatar key={p} nombre={p} tam={tam} />
      ))}
      {personas.length > 3 ? (
        <span
          className="inline-flex items-center justify-center rounded-full bg-[#E5E7EB] text-[#4B5563] font-semibold ring-2 ring-white"
          style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.42) }}
        >
          +{personas.length - 3}
        </span>
      ) : null}
    </span>
  )
}

export default function Personas({
  valor,
  onCambio,
  sugerencias = [],
  placeholder = 'Escribe un nombre y pulsa Intro',
}: {
  /** "Rida, Laura". */
  valor: string
  onCambio: (texto: string) => void
  sugerencias?: string[]
  placeholder?: string
}) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [marcada, setMarcada] = useState(0)
  const entrada = useRef<HTMLInputElement>(null)
  const elegidas = useMemo(() => personasDe(valor), [valor])

  const opciones = useMemo(() => {
    const ya = new Set(elegidas.map((p) => p.toLowerCase()))
    const t = texto.trim().toLowerCase()
    return sugerencias.filter((s) => !ya.has(s.toLowerCase()) && (!t || s.toLowerCase().includes(t))).slice(0, 8)
  }, [sugerencias, elegidas, texto])

  function poner(lista: string[]) {
    onCambio(juntarPersonas(personasDe(lista.join(','))))
  }

  function anadir(nombre: string) {
    const limpio = nombre.trim()
    if (limpio) poner([...elegidas, limpio])
    setTexto('')
    setMarcada(0)
  }

  return (
    <div className="relative">
      <div
        className="min-h-8 w-full rounded-md border border-[#E5E7EB] bg-white px-1.5 py-1 flex flex-wrap items-center gap-1 focus-within:border-gray-900 cursor-text"
        onClick={() => entrada.current?.focus()}
      >
        {elegidas.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 h-6 pl-0.5 pr-1 rounded-full bg-[#F3F4F6] text-[12.5px] text-gray-800">
            <Avatar nombre={p} tam={20} />
            {p}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                poner(elegidas.filter((x) => x !== p))
              }}
              className="p-0.5 rounded-full text-[#9CA3AF] hover:text-gray-900"
              aria-label={`Quitar a ${p}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          ref={entrada}
          value={texto}
          onChange={(e) => {
            const v = e.target.value
            // Una coma cierra el nombre, como en las etiquetas de cualquier programa.
            if (v.includes(',')) {
              anadir(v.replace(/,/g, ''))
              return
            }
            setTexto(v)
            setAbierto(true)
            setMarcada(0)
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => {
            // Lo que se quedó escrito cuenta (después del clic en una propuesta).
            setTimeout(() => {
              setAbierto(false)
              if (entrada.current && entrada.current.value.trim()) anadir(entrada.current.value)
            }, 150)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (abierto && opciones[marcada] && (!texto.trim() || opciones[marcada].toLowerCase().startsWith(texto.trim().toLowerCase()))) anadir(opciones[marcada])
              else anadir(texto)
            } else if (e.key === 'Backspace' && !texto && elegidas.length) {
              poner(elegidas.slice(0, -1))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setMarcada((m) => Math.min(m + 1, Math.max(0, opciones.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setMarcada((m) => Math.max(m - 1, 0))
            } else if (e.key === 'Escape') {
              setAbierto(false)
            }
          }}
          placeholder={elegidas.length ? '' : placeholder}
          className="flex-1 min-w-[90px] h-6 px-1 text-[13px] text-gray-900 outline-none bg-transparent placeholder:text-[#9CA3AF]"
        />
      </div>
      {abierto && opciones.length ? (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-md border border-[#E5E7EB] bg-white py-1 max-h-56 overflow-y-auto">
          {opciones.map((o, i) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => anadir(o)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[13px] ${i === marcada ? 'bg-[#F3F4F6]' : 'hover:bg-[#F9FAFB]'}`}
            >
              <Avatar nombre={o} tam={20} />
              {o}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
