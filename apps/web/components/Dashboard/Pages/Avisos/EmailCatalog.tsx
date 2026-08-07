'use client'
import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  EmailTemplate,
  listEmailTemplates,
  previewEmailTemplate,
  sendEmailTemplateTest,
} from '@services/notifications/emailCatalog'
import toast from 'react-hot-toast'
import { Loader2, Mail, Send, Clock } from 'lucide-react'

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
          </div>

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
