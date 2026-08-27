'use client'
import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  EmailTemplate,
  PlantillaEditable,
  getEmailTexts,
  listEmailTemplates,
  previewEmailTemplate,
  saveEmailTexts,
  sendEmailTemplateTest,
} from '@services/notifications/emailCatalog'
import toast from 'react-hot-toast'
import { Loader2, Mail, Send, Clock, Pencil, Check, RotateCcw, Lock } from 'lucide-react'

/**
 * Los correos que la escuela manda sola.
 *
 * Aquí no se dispara nada: cada uno sigue saliendo cuando toca (al pagar, al
 * pedir contraseña, al responder una consulta…). Esta pantalla es la ventana
 * para verlos tal cual llegan, con datos de ejemplo, y para mandárselos a uno
 * mismo si se quiere ver en la bandeja de verdad.
 *
 * La vista previa va dentro de un iframe a propósito: el correo trae sus
 * estilos en línea y así no se mezcla con los del panel.
 */
export default function EmailCatalog() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [rendered, setRendered] = useState<{ subject: string; html: string } | null>(null)
  const [rendering, setRendering] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  // Qué se puede reescribir y qué está reescrito.
  const [editables, setEditables] = useState<PlantillaEditable[]>([])
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let alive = true
    listEmailTemplates(accessToken).then((list) => {
      if (!alive) return
      setTemplates(list)
      setLoading(false)
      if (list.length) setSelected(list[0].id)
    })
    return () => {
      alive = false
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    let alive = true
    getEmailTexts(accessToken).then((res) => {
      if (!alive || !res) return
      setEditables(res.catalogo || [])
      setTextos(res.textos || {})
    })
    return () => {
      alive = false
    }
  }, [accessToken])

  useEffect(() => {
    if (!selected || !accessToken) return
    let alive = true
    setRendering(true)
    previewEmailTemplate(selected, accessToken).then((res) => {
      if (!alive) return
      setRendered(res)
      setRendering(false)
    })
    return () => {
      alive = false
    }
  }, [selected, accessToken])

  const sendToMe = async (id: string) => {
    setSendingId(id)
    const res = await sendEmailTemplateTest(id, accessToken)
    setSendingId(null)
    if (!res) {
      toast.error('No se pudo enviar el correo de prueba')
      return
    }
    toast.success(`Enviado a ${res.sent_to}. Míralo en tu bandeja.`)
  }

  const current = templates.find((t) => t.id === selected)
  const editable = editables.find((e) => e.plantilla === selected)

  const guardar = async () => {
    setGuardando(true)
    const ok = await saveEmailTexts(textos, accessToken)
    setGuardando(false)
    if (!ok) {
      toast.error('No se pudo guardar')
      return
    }
    toast.success('Guardado. La vista previa ya lo enseña.')
    setEditando(false)
    // Se vuelve a pedir la vista previa para verlo con el texto nuevo.
    if (selected) {
      setRendering(true)
      const res = await previewEmailTemplate(selected, accessToken)
      setRendered(res)
      setRendering(false)
    }
  }

  /** Devuelve un campo a como estaba escrito en el código. */
  const restaurar = (clave: string) => {
    setTextos((prev) => {
      const next = { ...prev }
      delete next[clave]
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-10">
        <Loader2 size={16} className="animate-spin" />
        Cargando los correos…
      </div>
    )
  }

  if (!templates.length) {
    return (
      <p className="text-sm text-gray-500 py-10">
        No se pudo leer la lista de correos. Recarga la página; si sigue igual,
        es que la sesión no tiene permisos de superadministrador.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
      {/* Lista de correos */}
      <div className="space-y-2">
        {templates.map((t) => {
          const active = t.id === selected
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                active
                  ? 'bg-white border-[#4da3ff]'
                  : 'bg-white border-[#DDE6F5] hover:border-[#4da3ff]/60'
              }`}
            >
              <span className="block text-[14px] font-bold text-[#0a1656] leading-snug">
                {t.name}
              </span>
              <span className="mt-1 flex items-start gap-1.5 text-[12.5px] text-gray-500 leading-relaxed">
                <Clock size={13} className="mt-0.5 shrink-0 text-[#4da3ff]" />
                {t.when}
              </span>
            </button>
          )
        })}
      </div>

      {/* Vista previa */}
      <div className="min-w-0">
        <div className="bg-white border border-[#DDE6F5] rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#EEF2FB] bg-[#FBFCFF]">
            <div className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-bold uppercase tracking-wider text-[#4da3ff]">
                Asunto
              </span>
              <span className="block text-[14px] font-semibold text-[#0a1656] truncate">
                {rendered?.subject || '—'}
              </span>
            </div>
            <button
              onClick={() => selected && sendToMe(selected)}
              disabled={!selected || sendingId === selected}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-[14px] bg-[#4da3ff] text-[#0a1656] hover:bg-[#6cb5ff] transition-colors ${
                sendingId === selected ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {sendingId === selected ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Enviármelo
            </button>
            {editable && (
              <button
                onClick={() => setEditando((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-[14px] text-[#025dc7] border border-[#DDE6F5] hover:bg-[#F0F5FF] transition-colors"
              >
                <Pencil size={15} />
                {editando ? 'Cerrar' : 'Editar el texto'}
              </button>
            )}
          </div>

          {/* Los correos del pago y de la contraseña NO salen aquí. No es que
              se escondan: el servidor no los da como editables, y aunque se
              mandaran sus claves las tiraría. Son la puerta de entrada de quien
              acaba de pagar y un texto mal guardado ahí no se ve en pruebas. */}
          {!editable && (
            <p className="flex items-start gap-2 px-4 py-3 text-[13px] text-[#5A6480] leading-relaxed bg-[#FBFCFF] border-b border-[#EEF2FB]">
              <Lock size={14} className="mt-0.5 shrink-0 text-[#8A96AB]" />
              Este correo no se puede reescribir desde aquí. Es de los que
              recibe alguien que acaba de pagar o que ha perdido su contraseña,
              y su texto vive en el código a propósito.
            </p>
          )}

          {editando && editable && (
            <div className="px-4 py-4 border-b border-[#EEF2FB] bg-[#FBFCFF] space-y-4">
              {editable.campos.map((c) => {
                const clave = `${editable.plantilla}.${c.campo}`
                const valor = textos[clave] ?? c.por_defecto
                const cambiado = textos[clave] !== undefined
                return (
                  <div key={clave}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-[13px] font-semibold text-[#0a1656]">
                        {c.etiqueta}
                      </label>
                      {cambiado && (
                        <button
                          onClick={() => restaurar(clave)}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#5A6480] hover:text-[#025dc7] transition-colors"
                        >
                          <RotateCcw size={12} />
                          Volver al original
                        </button>
                      )}
                    </div>
                    {c.largo ? (
                      <textarea
                        value={valor}
                        rows={3}
                        onChange={(e) =>
                          setTextos((prev) => ({ ...prev, [clave]: e.target.value }))
                        }
                        className="w-full bg-white rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] border border-[#DDE6F5] outline-none focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 transition-colors resize-y"
                      />
                    ) : (
                      <input
                        value={valor}
                        onChange={(e) =>
                          setTextos((prev) => ({ ...prev, [clave]: e.target.value }))
                        }
                        className="w-full bg-white rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] border border-[#DDE6F5] outline-none focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 transition-colors"
                      />
                    )}
                    {c.variables.length > 0 && (
                      <p className="mt-1 text-[12px] text-[#8A96AB] leading-relaxed">
                        Puedes usar:{' '}
                        {c.variables.map((v, i) => (
                          <span key={v}>
                            {i > 0 && ' · '}
                            <code className="bg-[#F0F5FF] text-[#025dc7] rounded px-1 py-0.5">
                              {'{' + v + '}'}
                            </code>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )
              })}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold text-[14px] transition-colors disabled:opacity-60"
                >
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2.5} />}
                  Guardar
                </button>
                <p className="text-[12.5px] text-[#8A96AB] leading-relaxed">
                  Una línea en blanco separa párrafos y <code className="bg-[#F0F5FF] text-[#025dc7] rounded px-1">*así*</code> pone en negrita.
                </p>
              </div>
            </div>
          )}

          {rendering ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm px-4 py-16 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Montando el correo…
            </div>
          ) : rendered?.html ? (
            <iframe
              title={current?.name || 'Correo'}
              srcDoc={rendered.html}
              sandbox=""
              className="w-full h-[70vh] min-h-[520px] bg-white border-0"
            />
          ) : (
            <p className="text-sm text-gray-500 px-4 py-16 text-center">
              No se pudo montar este correo.
            </p>
          )}
        </div>

        <p className="mt-3 flex items-start gap-2 text-[13px] text-gray-500 leading-relaxed">
          <Mail size={15} className="mt-0.5 shrink-0 text-[#4da3ff]" />
          Los datos que ves son de ejemplo (nombre, fechas, módulos). Cuando el
          correo sale de verdad, van los del alumno. Mirarlo aquí no envía nada.
        </p>
      </div>
    </div>
  )
}
