'use client'
/**
 * El regalo «Mijn eerste week», DENTRO de la escuela (10/11/2026).
 *
 * La primera versión era una página suelta y el usuario lo dijo claro: "no
 * está dentro de la escuela, no se ve nada con candado, es solo una web".
 * Ahora quien se apunta entra en el armazón de la escuela: la misma barra
 * azul, los mismos bloques (Formación, Mis clases, Comunidad, Ayuda) y arriba
 * su nombre. Su primera semana está abierta; lo de los alumnos se ve con
 * candado y, al tocarlo, enseña lo que hay dentro DE VERDAD (los módulos y
 * sus clases, la próxima clase en directo, los canales y cuánto se ha escrito
 * esta semana) y el botón de la llamada.
 *
 * Los datos salen de `GET /reto/escuela` (apps/api/src/services/reto/escuela.py):
 * solo nombres y cifras. No hay sesión: es un invitado y no puede abrir nada
 * de los alumnos, se escriba la dirección que se escriba.
 */
import React, { useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Lock, Menu, X } from 'lucide-react'
import { getAPIUrl } from '@services/config/config'
import { FONDO_MARCA } from '@/lib/nawar/marca'

export interface Escuela {
  formacion: { nombre: string; clases: number; modulos: { nombre: string; total: number; clases: string[] }[] }
  clases: { nombre: string; tipo: 'semanal' | 'masterclass' | 'conversacion'; proxima: { fecha: string; tema: string } | null }[]
  canales: { nombre: string; mensajes: number }[]
}

export type Seccion = 'semana' | 'formacion' | 'comunidad' | 'ayuda' | `clase:${number}`

export interface DiaDeLaBarra {
  n: number
  titulo: string
  abierto: boolean
  hecho: boolean
}

const LOGO_URL = 'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'
const POPPINS = { fontFamily: 'var(--font-poppins), Poppins, system-ui, sans-serif' } as const
const VACIA: Escuela = { formacion: { nombre: 'Formación A0-A1', clases: 0, modulos: [] }, clases: [], canales: [] }

export function useEscuela(): Escuela {
  const [escuela, setEscuela] = useState<Escuela>(VACIA)
  useEffect(() => {
    let vivo = true
    fetch(`${getAPIUrl()}reto/escuela`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d && setEscuela(d))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])
  return escuela
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function diaLargo(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return isNaN(d.getTime()) ? iso : `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** «MODULE 1 - Over jou» → ['Módulo 1', 'Over jou']. */
function moduloBonito(nombre: string): [string, string] {
  const m = nombre.match(/^\s*(?:module|m[oó]dulo)\s*(\d+)\s*[-–·:]\s*(.+)$/i)
  return m ? [`Módulo ${m[1]}`, m[2]] : ['', nombre]
}

const QUE_ES: Record<Escuela['clases'][number]['tipo'], { frase: string; dentro: string[] }> = {
  masterclass: {
    frase: 'Cada semana, un profe explica un tema concreto en directo para que lo pongas en práctica esa misma semana.',
    dentro: ['La presentación, antes de la clase', 'La sala en directo, dentro de la escuela', 'La presentación con las notas de la clase', 'La grabación, por si no pudiste venir'],
  },
  conversacion: {
    frase: 'Grupos pequeños para hablar, con gente que está en tu mismo punto. Aquí no se explica: se habla.',
    dentro: ['La sala en directo, dentro de la escuela', 'Mesas pequeñas con un monitor', 'El tema de cada sesión, para llegar preparado'],
  },
  semanal: {
    frase: 'Una clase en directo cada semana con tu grupo y tu profe, con su presentación, sus ejercicios y su tarea.',
    dentro: ['La presentación, antes de la clase', 'La sala en directo, dentro de la escuela', 'Los ejercicios de la semana', 'Tu tarea, corregida con nota de voz', 'La grabación, por si no pudiste venir'],
  },
}

export default function Armazon({
  nombre,
  escuela,
  seccion,
  onSeccion,
  dias,
  diaElegido,
  onDia,
  onLlamada,
  children,
}: {
  /** Vacío mientras no se ha apuntado. */
  nombre: string
  escuela: Escuela
  seccion: Seccion
  onSeccion: (s: Seccion) => void
  dias: DiaDeLaBarra[]
  diaElegido: number
  onDia: (n: number) => void
  /** Sin él (aún no se ha apuntado), los candados llevan a contestar las preguntas. */
  onLlamada?: () => void
  children: React.ReactNode
}) {
  const [abierta, setAbierta] = useState(false)
  const ir = (s: Seccion) => {
    onSeccion(s)
    setAbierta(false)
    window.scrollTo(0, 0)
  }
  const Fila = ({ s, children: texto, candado = true }: { s: Seccion; children: React.ReactNode; candado?: boolean }) => (
    <button
      onClick={() => ir(s)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14.5px] font-medium ${seccion === s ? 'bg-white/[0.16] text-white' : 'text-white/90 hover:text-white'}`}
    >
      <span className="min-w-0 flex-1 truncate">{texto}</span>
      {candado ? <Lock size={13} className="shrink-0 text-white/55" /> : null}
    </button>
  )
  const Bloque = ({ titulo, children: filas }: { titulo: string; children: React.ReactNode }) => (
    <div className="mt-5">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70">{titulo}</p>
      <div className="space-y-0.5">{filas}</div>
    </div>
  )

  const barra = (
    <div className="flex h-full flex-col overflow-y-auto px-3 pb-5 pt-5 text-white" style={FONDO_MARCA}>
      <div className="flex items-center justify-between px-2">
        <img src={LOGO_URL} alt="Holandés Nawar" className="h-8 w-auto" />
        <button onClick={() => setAbierta(false)} className="p-1 text-white/80 lg:hidden" aria-label="Cerrar el menú">
          <X size={20} />
        </button>
      </div>

      <Bloque titulo="Tu regalo">
        <Fila s="semana" candado={false}>
          Tu primera semana
        </Fila>
        {dias.length ? (
          <div className="ml-3 border-l border-white/20 pl-2">
            {dias.map((d) => (
              <button
                key={d.n}
                onClick={() => {
                  ir('semana')
                  onDia(d.n)
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] ${
                  seccion === 'semana' && diaElegido === d.n ? 'font-semibold text-white' : d.abierto ? 'text-white/85 hover:text-white' : 'text-white/50'
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {d.hecho ? <Check size={13} strokeWidth={3.2} className="text-[#7CE0A0]" /> : !d.abierto ? <Lock size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-[#4da3ff]" />}
                </span>
                <span className="truncate">
                  Día {d.n} · {d.titulo}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </Bloque>

      <Bloque titulo="Formación">
        <Fila s="formacion">{escuela.formacion.nombre}</Fila>
      </Bloque>

      <Bloque titulo="Mis clases">
        {(escuela.clases.length ? escuela.clases : [{ nombre: 'Masterclass semanal' }, { nombre: 'Spreekclub' }]).map((c, i) => (
          <Fila key={c.nombre} s={`clase:${i}`}>
            {c.nombre}
          </Fila>
        ))}
      </Bloque>

      <Bloque titulo="Comunidad">
        {(escuela.canales.length ? escuela.canales.slice(0, 5) : [{ nombre: 'Presentaciones' }, { nombre: 'Victorias' }, { nombre: 'Dudas de neerlandés' }]).map((c) => (
          <Fila key={c.nombre} s="comunidad">
            {c.nombre}
          </Fila>
        ))}
      </Bloque>

      <Bloque titulo="Ayuda">
        <Fila s="ayuda">Consultas a un profe</Fila>
        <Fila s="ayuda">Mensajes con el equipo</Fila>
      </Bloque>

      <div className="mt-auto pt-6">
        <div className="rounded-xl border border-white/20 bg-white/[0.08] px-3.5 py-3.5">
          <p className="text-[13.5px] font-semibold leading-snug">Lo que tiene candado es de los alumnos de la formación.</p>
          {onLlamada ? (
            <button onClick={onLlamada} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13.5px] font-semibold text-[#0b2da0]">
              Reservar mi llamada <ArrowRight size={14} strokeWidth={2.6} />
            </button>
          ) : (
            <p className="mt-1 text-[12.5px] leading-snug text-white/75">Empieza por tu primera semana: es gratis.</p>
          )}
        </div>
      </div>
    </div>
  )

  const Arriba = ({ s, children: texto, candado = true }: { s: Seccion; children: React.ReactNode; candado?: boolean }) => (
    <button onClick={() => ir(s)} className={`flex items-center gap-1.5 text-[14.5px] font-medium ${seccion === s || (s === 'clase:0' && seccion.startsWith('clase:')) ? 'text-[#0b2da0]' : 'text-[#0a1656] hover:text-[#0b2da0]'}`}>
      {texto}
      {candado ? <Lock size={12} className="text-[#8FA0C2]" /> : null}
    </button>
  )

  return (
    <div className="min-h-screen bg-[#F4F7FD] text-[#0a1656]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] lg:block">{barra}</aside>
      {abierta ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAbierta(false)} />
          <div className="absolute inset-y-0 left-0 w-[284px] max-w-[86vw]">{barra}</div>
        </div>
      ) : null}

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[#E2E8F4] bg-white px-4 sm:px-6">
          <button onClick={() => setAbierta(true)} className="-ml-1 p-1.5 text-[#0a1656] lg:hidden" aria-label="Abrir el menú">
            <Menu size={22} />
          </button>
          <nav className="hidden flex-1 items-center justify-center gap-7 md:flex">
            <Arriba s="semana" candado={false}>
              Inicio
            </Arriba>
            <Arriba s="formacion">Formación</Arriba>
            <Arriba s="clase:0">Clases</Arriba>
            <Arriba s="comunidad">Comunidad</Arriba>
          </nav>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            {onLlamada ? (
              <button onClick={onLlamada} className="rounded-lg bg-[#0b2da0] px-3.5 py-2 text-[13.5px] font-semibold text-white">
                Reservar mi llamada
              </button>
            ) : null}
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF0FE] text-[13px] font-semibold text-[#0b2da0]">{(nombre || 'T').slice(0, 1).toUpperCase()}</span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[13px] font-semibold text-[#0a1656]">{nombre || 'Tú'}</span>
                <span className="block text-[11.5px] text-[#5B6B8C]">Invitado</span>
              </span>
            </span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}

/* ── Lo de los alumnos, a la vista y con candado ─────────────────────────── */

function Aviso({ titulo, texto, onLlamada, onEmpezar }: { titulo: string; texto: string; onLlamada?: () => void; onEmpezar: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-[#DDE6F5] bg-white px-5 py-4">
      <Lock size={22} className="shrink-0 text-[#0b2da0]" />
      <div className="min-w-0 flex-1 basis-[260px]">
        <p className="text-[15.5px] font-semibold text-[#0a1656]">{titulo}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-[#171a2e]">{texto}</p>
      </div>
      {onLlamada ? (
        <button onClick={onLlamada} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0b2da0] px-4 py-2.5 text-[14px] font-semibold text-white">
          Reservar mi llamada <ArrowRight size={15} strokeWidth={2.6} />
        </button>
      ) : (
        <button onClick={onEmpezar} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0b2da0] px-4 py-2.5 text-[14px] font-semibold text-white">
          Empezar mi primera semana <ArrowRight size={15} strokeWidth={2.6} />
        </button>
      )}
    </div>
  )
}

const FilaCerrada = ({ children, detalle }: { children: React.ReactNode; detalle?: string }) => (
  <div className="flex items-center gap-3.5 px-5 py-3">
    <span className="h-[22px] w-[22px] shrink-0 rounded-full border-2 border-dashed border-[#C9CFDE]" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14.5px] font-medium text-[#0B1033]">{children}</span>
      {detalle ? <span className="block text-[12.5px] text-[#8A91AD]">{detalle}</span> : null}
    </span>
    <Lock size={14} className="shrink-0 text-[#8FA0C2]" />
  </div>
)

export function PaginaConCandado({
  seccion,
  escuela,
  onLlamada,
  onEmpezar,
}: {
  seccion: Exclude<Seccion, 'semana'>
  escuela: Escuela
  onLlamada?: () => void
  onEmpezar: () => void
}) {
  const [abierto, setAbierto] = useState(0)
  const cta = { onLlamada, onEmpezar }

  if (seccion === 'formacion') {
    const f = escuela.formacion
    return (
      <div className="mx-auto max-w-[920px] space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-[#0a1656] sm:text-[30px]" style={POPPINS}>
            {f.nombre}
          </h1>
          <p className="mt-1 text-[14.5px] text-[#171a2e]">
            De cero al nivel A1 en 16 semanas{f.modulos.length ? ` · ${f.modulos.length} módulos` : ''}
            {f.clases ? ` · ${f.clases} clases` : ''}
          </p>
        </div>
        <Aviso
          titulo="Esto es lo que hacen los alumnos"
          texto="Tu primera semana es una muestra de cómo se aprende aquí. Dentro, cada módulo se abre cuando terminas el anterior, con vídeo, flashcards, ejercicios, lectura y audio."
          {...cta}
        />
        <div className="overflow-hidden rounded-2xl border border-[#DDE6F5] bg-white">
          {f.modulos.map((m, i) => {
            const [num, titulo] = moduloBonito(m.nombre)
            return (
              <div key={m.nombre} className={i ? 'border-t border-[#EEF1F7]' : ''}>
                <button onClick={() => setAbierto(abierto === i ? -1 : i)} className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#C9D3EA] text-[12.5px] font-semibold text-[#0b2da0]">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold text-[#0B1033]">{titulo}</span>
                    <span className="block text-[12.5px] text-[#6B7393]">
                      {num ? `${num} · ` : ''}
                      {m.total} clases
                    </span>
                  </span>
                  <Lock size={14} className="shrink-0 text-[#8FA0C2]" />
                  <ChevronDown size={16} className={`shrink-0 text-[#8FA0C2] transition-transform ${abierto === i ? 'rotate-180' : ''}`} />
                </button>
                {abierto === i ? (
                  <div className="border-t border-[#EEF1F7] bg-[#FAFBFE] py-1.5">
                    {m.clases.map((c, k) => (
                      <FilaCerrada key={`${c}-${k}`}>{c}</FilaCerrada>
                    ))}
                    {m.total > m.clases.length ? <p className="px-5 pb-2 pt-1 text-[12.5px] text-[#6B7393]">y {m.total - m.clases.length} {m.total - m.clases.length === 1 ? 'clase' : 'clases'} más</p> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
          {!f.modulos.length ? <p className="px-5 py-4 text-[14px] text-[#5B6B8C]">10 módulos, de «Over jou» a «Dagelijks leven».</p> : null}
        </div>
      </div>
    )
  }

  if (seccion.startsWith('clase:')) {
    const c = escuela.clases[Number(seccion.split(':')[1])] || escuela.clases[0] || { nombre: 'Masterclass semanal', tipo: 'masterclass' as const, proxima: null }
    const q = QUE_ES[c.tipo]
    return (
      <div className="mx-auto max-w-[920px] space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">En directo, cada semana</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight text-[#0a1656] sm:text-[30px]" style={POPPINS}>
            {c.nombre}
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[14.5px] leading-relaxed text-[#171a2e]">{q.frase}</p>
        </div>
        {c.proxima ? (
          <div className="rounded-2xl border border-[#DDE6F5] bg-white px-5 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Próxima clase</p>
            <p className="mt-1 text-[22px] font-bold leading-tight text-[#0B1033] first-letter:uppercase" style={POPPINS}>
              {diaLargo(c.proxima.fecha)}
            </p>
            {c.proxima.tema ? <p className="mt-0.5 text-[15.5px] font-semibold text-[#0B1033]">{c.proxima.tema}</p> : null}
          </div>
        ) : null}
        <Aviso titulo="Las clases en directo son de los alumnos" texto="Con la formación entras a la sala desde aquí mismo, sin instalar nada, y todo lo de la clase se queda guardado en tu semana." {...cta} />
        <div className="divide-y divide-[#EEF1F7] overflow-hidden rounded-2xl border border-[#DDE6F5] bg-white">
          {q.dentro.map((d) => (
            <FilaCerrada key={d}>{d}</FilaCerrada>
          ))}
        </div>
      </div>
    )
  }

  if (seccion === 'comunidad') {
    const total = escuela.canales.reduce((n, c) => n + c.mensajes, 0)
    return (
      <div className="mx-auto max-w-[920px] space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-[#0a1656] sm:text-[30px]" style={POPPINS}>
            Comunidad
          </h1>
          <p className="mt-1 text-[14.5px] text-[#171a2e]">
            Donde los alumnos se presentan, preguntan y cuentan lo que van consiguiendo{total ? ` · ${total} mensajes esta semana` : ''}
          </p>
        </div>
        <Aviso titulo="La comunidad es de los alumnos" texto="Lo que más hace abandonar un idioma es estudiar solo. Dentro tienes compañeros en tu mismo punto y al equipo contestando." {...cta} />
        <div className="divide-y divide-[#EEF1F7] overflow-hidden rounded-2xl border border-[#DDE6F5] bg-white">
          {(escuela.canales.length ? escuela.canales : [{ nombre: 'Presentaciones', mensajes: 0 }, { nombre: 'Victorias', mensajes: 0 }, { nombre: 'Dudas de neerlandés', mensajes: 0 }]).map((c) => (
            <FilaCerrada key={c.nombre} detalle={c.mensajes ? `${c.mensajes} ${c.mensajes === 1 ? 'mensaje' : 'mensajes'} esta semana` : undefined}>
              {c.nombre}
            </FilaCerrada>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[920px] space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-[#0a1656] sm:text-[30px]" style={POPPINS}>
          Ayuda
        </h1>
        <p className="mt-1 text-[14.5px] text-[#171a2e]">Cuando te atascas, hay alguien al otro lado.</p>
      </div>
      <Aviso titulo="La ayuda de los profes es de los alumnos" texto="Durante tu primera semana puedes escribirnos a info@holandesnawar.com. Dentro de la formación, las dudas se resuelven aquí mismo." {...cta} />
      <div className="divide-y divide-[#EEF1F7] overflow-hidden rounded-2xl border border-[#DDE6F5] bg-white">
        <FilaCerrada detalle="Escribes tu duda de neerlandés y te responde un profe">Consultas a un profe</FilaCerrada>
        <FilaCerrada detalle="Por texto o con una nota de voz">Mensajes con el equipo</FilaCerrada>
        <FilaCerrada detalle="Texto y nota de voz, corregidos por un profe">Tu tarea de cada semana, corregida</FilaCerrada>
      </div>
    </div>
  )
}
