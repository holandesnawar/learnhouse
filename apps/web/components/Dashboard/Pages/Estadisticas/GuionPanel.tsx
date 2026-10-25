'use client'

/**
 * Guion de llamada: lo que el closer tiene delante mientras habla. Lo pueden
 * cambiar el administrador y el closer desde aquí mismo (botón "Editar").
 * El texto de fábrica y el razonamiento están en
 * apps/api/src/services/contactos/guion.py.
 *
 * La misma pantalla pinta el «Enfoque» (`doc="enfoque"`, 25/10/2026): el
 * programa nuevo (masterclass y spreekuren) contado para el closer, con precio
 * y las preguntas que hace la gente.
 *
 * Formato sencillo a propósito: "## " es un título, "### " un subtítulo (una
 * pregunta) y "- " un punto. Así el administrador lo edita en una caja de
 * texto sin tener que aprender nada. Lo que va entre «[POR COMPLETAR: …]» se
 * resalta, para ver de un vistazo lo que falta por rellenar.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getEnfoque, getGuion, guardarEnfoque, guardarGuion } from '@services/stats/contactos'
import { Loader2, Pencil, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'

const CARD = 'rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-6'

const DOCS = {
  guion: {
    leer: getGuion,
    guardar: guardarGuion,
    intro:
      'Lo que hay que contar en cada llamada y cómo responder a las dudas de siempre. Así el precio, la garantía y lo que incluye la formación se dicen igual que en la web.',
    guardado: 'Guion guardado',
    nombre: 'el guion',
  },
  enfoque: {
    leer: getEnfoque,
    guardar: guardarEnfoque,
    intro:
      'Qué se vende desde el 26/10: el programa nuevo con masterclass y spreekuren, el precio y las preguntas que te va a hacer la gente.',
    guardado: 'Enfoque guardado',
    nombre: 'el enfoque',
  },
}

/** Resalta «[POR COMPLETAR: …]»: lo que aún hay que rellenar. */
function ConHuecos({ texto }: { texto: string }) {
  const trozos = texto.split(/(\[POR COMPLETAR[^\]]*\])/g)
  return (
    <>
      {trozos.map((t, i) =>
        t.startsWith('[POR COMPLETAR') ? (
          <span key={i} className="rounded px-1 bg-[#FFFBF2] text-[#8A6A2A] font-medium">
            {t}
          </span>
        ) : (
          <React.Fragment key={i}>{t}</React.Fragment>
        )
      )}
    </>
  )
}

/** Pinta el texto: "## " → título, "### " → subtítulo, "- " → punto, lo demás → párrafo. */
function Texto({ texto }: { texto: string }) {
  const bloques: React.ReactNode[] = []
  let puntos: string[] = []
  const cerrarLista = (clave: string) => {
    if (!puntos.length) return
    bloques.push(
      <ul key={clave} className="space-y-1.5 mb-4">
        {puntos.map((p, i) => (
          <li key={i} className="flex gap-2 text-[14px] text-gray-800 leading-relaxed">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#4da3ff] shrink-0" />
            <span>
              <ConHuecos texto={p} />
            </span>
          </li>
        ))}
      </ul>
    )
    puntos = []
  }
  texto.split('\n').forEach((linea, i) => {
    const l = linea.trim()
    if (l.startsWith('### ')) {
      cerrarLista(`l${i}`)
      bloques.push(
        <h4 key={i} className="text-[14px] font-semibold text-gray-900 mt-4 mb-1">
          {l.slice(4)}
        </h4>
      )
    } else if (l.startsWith('## ')) {
      cerrarLista(`l${i}`)
      bloques.push(
        <h3 key={i} className="text-[15.5px] font-bold text-[#1D0084] mt-5 mb-2 first:mt-0">
          {l.slice(3)}
        </h3>
      )
    } else if (l.startsWith('- ')) {
      puntos.push(l.slice(2))
    } else if (l) {
      cerrarLista(`l${i}`)
      bloques.push(
        <p key={i} className="text-[14px] text-gray-800 leading-relaxed mb-3">
          <ConHuecos texto={l} />
        </p>
      )
    }
  })
  cerrarLista('fin')
  return <div>{bloques}</div>
}

export default function GuionPanel({ doc = 'guion' }: { doc?: keyof typeof DOCS }) {
  const D = DOCS[doc]
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin, isCloser } = useAdminStatus()
  // Lo editan los dos: el administrador y el closer, que es quien lo usa.
  const puedeEditar = isAdmin || isCloser

  const [texto, setTexto] = useState('')
  const [deFabrica, setDeFabrica] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!org?.id || !accessToken) return
    D.leer(org.id, accessToken).then((r) => {
      setTexto(r.datos?.texto ?? '')
      setDeFabrica(r.datos?.de_fabrica ?? true)
      setCargando(false)
    })
  }, [org?.id, accessToken, D])

  async function guardar(nuevo: string) {
    setGuardando(true)
    const r = await D.guardar(org?.id, nuevo, accessToken)
    setGuardando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    setTexto(r.datos.texto)
    setDeFabrica(r.datos.de_fabrica)
    setEditando(false)
    toast.success(D.guardado)
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-[#6B7280] leading-relaxed">{D.intro}</p>
        {puedeEditar && !editando ? (
          <button
            onClick={() => {
              setBorrador(texto)
              setEditando(true)
            }}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-gray-800 text-[12.5px] font-bold"
          >
            <Pencil size={13} /> Editar
          </button>
        ) : null}
      </div>

      {editando ? (
        <div className={CARD}>
          <p className="text-[12px] text-gray-500 mb-2">
            Una línea que empieza por <code className="bg-[#F0F5FF] px-1 rounded">## </code> es un título; por{' '}
            <code className="bg-[#F0F5FF] px-1 rounded">### </code>, un subtítulo (una pregunta); por{' '}
            <code className="bg-[#F0F5FF] px-1 rounded">- </code>, un punto.
          </p>
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={28}
            className="w-full px-3 py-2.5 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] text-[13px] font-mono text-gray-800 outline-none focus:border-gray-900"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={async () => {
                if (await confirmar(`¿Volver a ${D.nombre} de fábrica? Se pierde lo que hayas cambiado.`, { boton: 'Sí, volver' })) guardar('')
              }}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              <RotateCcw size={13} /> Volver al de fábrica
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setEditando(false)}
                className="px-3 py-2 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => guardar(borrador)}
                disabled={guardando}
                className="px-4 py-2 rounded-lg bg-[#025dc7] hover:bg-[#014fa9] text-white text-[13px] font-bold disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={CARD}>
          <Texto texto={texto} />
          {puedeEditar && deFabrica ? (
            <p className="mt-4 text-[11.5px] text-[#9CA3AF]">
              Es {D.nombre} de fábrica. Cámbialo con "Editar" cuando quieras adaptarlo.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
