'use client'
/**
 * Piezas de la clase en la sala de profes (09/11/2026): el paso con su check,
 * el mensaje del administrador y el material para darla. La ventana «Preparar
 * la clase» que vivía aquí es desde el 12/11/2026 la ficha de la clase
 * (`FichaClase.tsx`); lo que sigue cuenta el pedido de entonces.
 *
 * La tarjeta de cada clase en la sala de profes (09/11/2026).
 *
 * Pedido: "que yo pueda añadir la presentación completa (no es la misma que la
 * que se da con antelación antes de la clase)… poder yo como admin añadir y
 * cambiar cosas de la sala… como la siguiente clase… para que el profe ya sepa
 * dónde está todo para preparar la clase".
 *
 * - Arriba, la PRÓXIMA clase de verdad (`paraPreparar`: la primera de hoy en
 *   adelante, no la semana del calendario), con su tema y su día.
 * - «Para preparar la clase»: la presentación completa (archivos o enlaces que
 *   solo ve el equipo) y las notas para el profe. «Editar» cambia el tema, el
 *   día, las notas y el material (`services/tareas/material_profe.py`).
 * - Los pasos: la presentación para los alumnos (la de antes de la clase),
 *   dar la clase (con la sala el mismo día) y pasar lista.
 * - «Clase anterior»: lo que le falta (lista, grabación, corregir).
 * - «Después»: la que va detrás.
 */
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, FileText, Link2, MessageSquare } from 'lucide-react'
import { abrirArchivoProfe, mensajeLeido, type ArchivoProfe } from '@services/tareas/tareas'
import type { SemanaEquipo } from '@/lib/nawar/salaProfes'

const BOTON =
  'shrink-0 h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#DDE3EF] text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]'
const BOTON_AZUL = 'shrink-0 h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#0b2da0] text-white text-[13px] font-semibold'

export function Paso({ hecho, titulo, detalle, accion, apagado = false }: { hecho: boolean; titulo: string; detalle?: string; accion?: React.ReactNode; apagado?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={`shrink-0 w-[21px] h-[21px] rounded-full border-2 flex items-center justify-center ${
          hecho ? 'border-[#16A34A] text-[#16A34A]' : apagado ? 'border-dashed border-[#C9D4EC]' : 'border-[#AEB9D3]'
        }`}
      >
        {hecho ? <Check size={12} strokeWidth={3.4} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[14.5px] leading-snug ${apagado ? 'text-[#8A91AD]' : 'text-[#0B1033]'} ${hecho ? '' : 'font-semibold'}`}>{titulo}</p>
        {detalle ? <p className="text-[12.5px] text-[#6B7393]">{detalle}</p> : null}
      </div>
      {accion}
    </li>
  )
}

function fechaCorta(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
  } catch {
    return ''
  }
}

/** El mensaje del administrador para el profe de esa semana, con «Leído». */
export function MensajeDelAdmin({ semana, admin, token, onLeido }: { semana: SemanaEquipo; admin: boolean; token: string; onLeido: () => void }) {
  const msg = semana.material?.mensaje
  const [enviando, setEnviando] = useState(false)
  if (!msg?.texto) return null
  const leer = async () => {
    setEnviando(true)
    try {
      await mensajeLeido(semana.semanaId, token)
      onLeido()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido marcar')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="mt-3 rounded-xl border border-[#0b2da0]/25 bg-white px-4 py-3">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">
        <MessageSquare size={14} /> Mensaje de {msg.por || 'la dirección'}
        {msg.at ? <span className="normal-case tracking-normal font-medium text-[#6B7393]">· {fechaCorta(msg.at)}</span> : null}
      </p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#0B1033] whitespace-pre-wrap">{msg.texto}</p>
      <div className="mt-2 flex items-center gap-2 text-[12.5px]">
        {msg.leido_por ? (
          <span className="inline-flex items-center gap-1 text-[#3B4262]">
            <Check size={13} strokeWidth={3} className="text-[#16A34A]" /> Leído por {msg.leido_por}
            {msg.leido_at ? ` · ${fechaCorta(msg.leido_at)}` : ''}
          </span>
        ) : admin ? (
          <span className="text-[#8A6A2A]">Aún sin leer</span>
        ) : (
          <button onClick={leer} disabled={enviando} className={BOTON_AZUL}>
            <Check size={13} /> Leído
          </button>
        )}
      </div>
    </div>
  )
}

export function Material({ semana, token }: { semana: SemanaEquipo; token: string }) {
  const m = semana.material || { notas: '', archivos: [] }
  const abrir = (a: ArchivoProfe) =>
    abrirArchivoProfe(semana.semanaId, a, token).catch((e) => toast.error(e?.message || 'No se ha podido abrir'))
  return (
    <div className="mt-3 rounded-xl bg-[#F5F8FE] border border-[#E4EBF8] px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Para preparar la clase</p>
      {m.archivos.length ? (
        <ul className="mt-2 space-y-1.5">
          {m.archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5">
              {a.tipo === 'enlace' ? <Link2 size={16} className="text-[#0b2da0] shrink-0" /> : <FileText size={16} className="text-[#0b2da0] shrink-0" />}
              <button onClick={() => abrir(a)} className="min-w-0 flex-1 text-left text-[14px] font-semibold text-[#0B1033] hover:text-[#0b2da0] truncate">
                {a.nombre}
              </button>
              <button onClick={() => abrir(a)} className={BOTON}>
                Abrir
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13.5px] text-[#5B6382]">Aún no hay presentación completa para dar la clase.</p>
      )}
      {m.notas ? <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#2B3150] whitespace-pre-wrap">{m.notas}</p> : null}
      <Pizarra semana={semana} />
    </div>
  )
}

/**
 * La pizarra de clase (10/11/2026, components/Pages/Pizarra): abrir la
 * presentación dentro de la escuela, escribir encima mientras se comparte
 * pantalla y guardarla para los alumnos.
 */
function Pizarra({ semana }: { semana: SemanaEquipo }) {
  const p = semana.material?.pizarra
  const estado = p?.publicada_at
    ? `Los alumnos ya tienen la presentación con las notas de la clase (${p.paginas || 0} páginas).`
    : p?.guardada_at
      ? 'Tienes cosas escritas, aún sin guardar para los alumnos.'
      : 'Ábrela en clase mientras compartes pantalla, escribe encima y guárdala para los alumnos con un clic.'
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#E4EBF8] pt-3">
      <a href={`/pizarra/${semana.semanaId}`} className={BOTON_AZUL}>
        Abrir la pizarra de clase
      </a>
      <p className="min-w-0 flex-1 basis-[220px] text-[13px] leading-snug text-[#2B3150]">{estado}</p>
    </div>
  )
}
