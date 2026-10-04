'use client'

/**
 * Mandar un recordatorio a un alumno que lleva días sin entrar (Panel →
 * Alumnos → Progreso). Siempre a mano: aquí nada sale solo.
 *
 * Dos textos, "unos días" y "esta semana"; se propone el que toca según los
 * días sin entrar pero se puede cambiar. Lo escrito se puede guardar como
 * plantilla para la próxima vez. El correo lleva tres botones: seguir donde lo
 * dejó, compartir una victoria y hacer una consulta.
 *
 * Servidor: apps/api/src/services/panel/recordatorio.py.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  enviarRecordatorio,
  getPlantillasRecordatorio,
  guardarPlantillasRecordatorio,
  vistaRecordatorio,
  type AlumnoProgreso,
  type PlantillasRecordatorio,
  type TipoRecordatorio,
} from '@services/panel/panel'
import { confirmar } from '@lib/nawar/confirmar'
import toast from 'react-hot-toast'
import { Eye, Loader2, Send, X } from 'lucide-react'
import { BOTON, BOTON_PRINCIPAL, META, filtro } from './ui'

const CAMPO =
  'w-full bg-white rounded-md px-3 border border-[#E5E7EB] text-[13.5px] text-gray-900 placeholder:text-[#9CA3AF] outline-none focus:border-[#025dc7] transition-colors'

/** El mismo criterio que el servidor (`tipo_para`): una semana o más → "semana". */
function tipoQueToca(dias: number | null): TipoRecordatorio {
  return dias === null || dias >= 7 ? 'semana' : 'tres_dias'
}

function haceDias(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = Math.floor((Date.now() - t) / 86400000)
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
}

export default function RecordatorioModal({
  alumno,
  onClose,
  onEnviado,
}: {
  alumno: AlumnoProgreso
  onClose: () => void
  onEnviado: () => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token

  const [plantillas, setPlantillas] = useState<PlantillasRecordatorio | null>(null)
  const [fabrica, setFabrica] = useState<PlantillasRecordatorio | null>(null)
  const [tipo, setTipo] = useState<TipoRecordatorio>(tipoQueToca(alumno.estado.dias))
  const [asunto, setAsunto] = useState('')
  const [texto, setTexto] = useState('')
  const [botones, setBotones] = useState<PlantillasRecordatorio['botones'] | null>(null)
  const [verBotones, setVerBotones] = useState(false)
  const [vista, setVista] = useState<{ asunto: string; html: string } | null>(null)
  const [ocupado, setOcupado] = useState<'' | 'vista' | 'guardar' | 'prueba' | 'enviar'>('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!org?.id || !token) return
    getPlantillasRecordatorio(org.id, token).then((r) => {
      if (!r.ok || !r.datos) return setError(r.error || 'No se han podido cargar los textos')
      setPlantillas(r.datos.plantillas)
      setFabrica(r.datos.de_fabrica)
      setBotones(r.datos.plantillas.botones)
    })
  }, [org?.id, token])

  // Al cambiar de plantilla (o al cargar), el texto de esa plantilla.
  useEffect(() => {
    if (!plantillas) return
    setAsunto(plantillas[tipo].asunto)
    setTexto(plantillas[tipo].texto)
    setVista(null)
  }, [tipo, plantillas])

  // Cerrar con Escape.
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  const nombre = alumno.nombre.split(' ')[0] || alumno.nombre
  const cambiado = !!plantillas && (asunto !== plantillas[tipo].asunto || texto !== plantillas[tipo].texto || JSON.stringify(botones) !== JSON.stringify(plantillas.botones))

  // Los textos de los botones se guardan en la plantilla, así que para que la
  // vista previa y el envío los usen hay que guardarlos antes.
  const guardarBotonesSiHace = async () => {
    if (!plantillas || !botones || JSON.stringify(botones) === JSON.stringify(plantillas.botones)) return true
    const r = await guardarPlantillasRecordatorio(org.id, { ...plantillas, botones }, token)
    if (!r.ok || !r.datos) {
      setError(r.error || 'No se han podido guardar los botones')
      return false
    }
    setPlantillas(r.datos.plantillas)
    return true
  }

  const verVista = async () => {
    setOcupado('vista')
    setError('')
    if (await guardarBotonesSiHace()) {
      const r = await vistaRecordatorio(org.id, alumno.user_id, { tipo, asunto, texto }, token)
      if (r.ok && r.datos) setVista({ asunto: r.datos.asunto, html: r.datos.html })
      else setError(r.error || 'No se ha podido preparar la vista previa')
    }
    setOcupado('')
  }

  const guardar = async () => {
    if (!plantillas || !botones) return
    setOcupado('guardar')
    setError('')
    const r = await guardarPlantillasRecordatorio(org.id, { ...plantillas, botones, [tipo]: { asunto, texto } }, token)
    setOcupado('')
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido guardar')
    setPlantillas(r.datos.plantillas)
    toast.success(tipo === 'semana' ? 'Guardado el texto de «esta semana»' : 'Guardado el texto de «unos días»')
  }

  const deFabrica = () => {
    if (!fabrica) return
    setAsunto(fabrica[tipo].asunto)
    setTexto(fabrica[tipo].texto)
    setBotones(fabrica.botones)
    setVista(null)
  }

  const mandar = async (aMi: boolean) => {
    if (!aMi) {
      const previo = alumno.ultimo_recordatorio
      const aviso = previo ? ` Ya le mandaste uno ${haceDias(previo.sent_at)}.` : ''
      if (!(await confirmar(`¿Mandar el recordatorio a ${alumno.nombre} (${alumno.email})?${aviso}`, { boton: 'Enviar' }))) return
    }
    setOcupado(aMi ? 'prueba' : 'enviar')
    setError('')
    if (!(await guardarBotonesSiHace())) return setOcupado('')
    const r = await enviarRecordatorio(org.id, alumno.user_id, { tipo, asunto, texto, a_mi: aMi }, token)
    setOcupado('')
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido enviar')
    if (aMi) {
      toast.success(`Prueba enviada a ${r.datos.para}`)
      return
    }
    toast.success(`Recordatorio enviado a ${alumno.nombre}`)
    onEnviado()
    onClose()
  }

  const dias = alumno.estado.dias
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/25" />
      <div className="relative h-full w-full sm:max-w-[620px] bg-[#F9FAFB] border-l border-[#E5E7EB] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-gray-900 truncate">Recordatorio para {alumno.nombre}</p>
            <p className={`${META} truncate`}>
              {alumno.email}
              {dias === null ? ' · no ha entrado nunca' : dias === 0 ? ' · entró hoy' : ` · ${dias} ${dias === 1 ? 'día' : 'días'} sin entrar`}
            </p>
            {alumno.ultimo_recordatorio ? (
              <p className="text-[12.5px] text-[#B45309] mt-0.5">
                Ya le mandaste uno {haceDias(alumno.ultimo_recordatorio.sent_at)}
                {alumno.ultimo_recordatorio.por ? ` (${alumno.ultimo_recordatorio.por})` : ''}.
              </p>
            ) : null}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-md text-gray-500 hover:bg-[#F3F4F6]">
            <X size={18} />
          </button>
        </div>

        {!plantillas ? (
          <div className="flex justify-center py-16">
            {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={22} />}
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-[0.08em] mb-2">Qué texto</p>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setTipo('tres_dias')} className={filtro(tipo === 'tres_dias')}>
                  Lleva unos días sin entrar
                </button>
                <button onClick={() => setTipo('semana')} className={filtro(tipo === 'semana')}>
                  Esta semana no ha entrado
                </button>
              </div>
              {tipo !== tipoQueToca(dias) ? (
                <p className="text-[12px] text-[#6B7280] mt-1.5">
                  Por los días que lleva, le tocaría «{tipoQueToca(dias) === 'semana' ? 'Esta semana no ha entrado' : 'Lleva unos días sin entrar'}».
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-800">Asunto</label>
              <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={`${CAMPO} h-9`} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-800">Texto</label>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={11} className={`${CAMPO} py-2.5 leading-relaxed resize-y`} />
              <p className={META}>
                Los botones salen donde pongas <code>[seguir]</code>, <code>[victoria]</code> y <code>[consulta]</code>, cada uno en su
                propia línea. Huecos: <code>{'{nombre}'}</code>, <code>{'{dias}'}</code> y <code>{'{clase}'}</code> (la clase a la que
                lleva el botón). Una línea en blanco separa párrafos; <code>*así*</code> va en negrita.
              </p>
            </div>

            <div className="rounded-lg border border-[#E5E7EB] bg-white">
              <button onClick={() => setVerBotones((v) => !v)} className="w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-gray-800 flex justify-between">
                <span className="shrink-0 whitespace-nowrap">Botones del correo</span>
                <span className="text-[#6B7280] font-normal truncate pl-3">
                  {botones ? `${botones.seguir} · ${botones.victoria} · ${botones.consulta}` : ''}
                </span>
              </button>
              {verBotones && botones ? (
                <div className="px-3.5 pb-3.5 space-y-2.5">
                  {(
                    [
                      ['seguir', 'Lleva a la clase donde lo dejó'],
                      ['victoria', 'Lleva a la comunidad'],
                      ['consulta', 'Lleva a Consultas'],
                    ] as const
                  ).map(([k, nota]) => (
                    <div key={k}>
                      <input value={botones[k]} onChange={(e) => setBotones({ ...botones, [k]: e.target.value })} className={`${CAMPO} h-9`} />
                      <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">{nota}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button onClick={verVista} disabled={!!ocupado} className={BOTON}>
                {ocupado === 'vista' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Ver cómo le llega
              </button>
              <button onClick={guardar} disabled={!!ocupado || !cambiado} className={BOTON}>
                {ocupado === 'guardar' ? <Loader2 size={14} className="animate-spin" /> : null} Guardar como plantilla
              </button>
              <button onClick={deFabrica} disabled={!!ocupado} className="text-[12.5px] text-[#6B7280] hover:text-gray-900 px-1">
                Volver al texto de fábrica
              </button>
            </div>

            {vista ? (
              <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
                <p className="px-3.5 py-2 border-b border-[#E5E7EB] text-[12.5px] text-[#6B7280] truncate">
                  Asunto: <span className="text-gray-900">{vista.asunto}</span>
                </p>
                <iframe title="Vista previa" srcDoc={vista.html} className="w-full h-[620px] bg-white" sandbox="" />
              </div>
            ) : null}

            <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 bg-white border-t border-[#E5E7EB] flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => mandar(true)} disabled={!!ocupado} className={BOTON}>
                {ocupado === 'prueba' ? <Loader2 size={14} className="animate-spin" /> : null} Mandármelo a mí
              </button>
              <button onClick={() => mandar(false)} disabled={!!ocupado} className={BOTON_PRINCIPAL}>
                {ocupado === 'enviar' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar a {nombre}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
