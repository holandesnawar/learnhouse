'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import { CalendarClock, ChevronDown } from 'lucide-react'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updateOrgDripConfig } from '@services/settings/org'
import toast from 'react-hot-toast'

// Admin-only panel (shown on the course overview) to configure "drip content":
// how many days after each student's enrollment a module/chapter unlocks.
// Saved to org config (config.drip_content) via PUT /orgs/{id}/config/drip_content.
export default function DripContentSettings({ course, defaultOpen = false }: { course: any; defaultOpen?: boolean }) {
  const { isAdmin } = useAdminStatus() as any
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const stored = org?.config?.config?.drip_content || {}
  const chapters: any[] = course?.chapters || []

  const [open, setOpen] = useState(defaultOpen)
  const [enabled, setEnabled] = useState<boolean>(!!stored.enabled)
  const [offsets, setOffsets] = useState<{ [k: string]: number }>(() => {
    const init: { [k: string]: number } = {}
    chapters.forEach((c) => {
      init[c.chapter_uuid] = Number(stored?.chapters?.[c.chapter_uuid] ?? 0)
    })
    return init
  })
  // Fecha fija por capítulo: `{chapter_uuid: "2026-09-15"}`. Cadena vacía = sin
  // fecha, o sea que manda el desfase en días.
  const [fechas, setFechas] = useState<{ [k: string]: string }>(() => {
    const init: { [k: string]: string } = {}
    chapters.forEach((c) => {
      init[c.chapter_uuid] = String(stored?.fechas?.[c.chapter_uuid] ?? '')
    })
    return init
  })
  // Apertura por avance (09/10/2026): quien entra desde `desde` abre la
  // formación según termina cada módulo, no por las fechas de abajo. Sin nada
  // guardado vale "activo desde el 10/10/2026" (lo decidió el usuario). La
  // regla: apps/api/src/services/courses/avance_modulos.py.
  const avanceGuardado = (): { activo: boolean; desde: string } => ({
    activo: stored?.avance ? stored.avance.activo !== false : true,
    desde: String(stored?.avance?.desde || '2026-10-10').slice(0, 10),
  })
  const [avance, setAvance] = useState(avanceGuardado)
  const [saving, setSaving] = useState(false)
  // Qué dijo el servidor al guardar, en una línea que se queda a la vista.
  // Antes solo había un aviso flotante que se iba en dos segundos, y si el
  // botón no hacía nada (sesión sin cargar) no salía NADA: "le doy a guardar y
  // no se guarda" (04/10/2026).
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const queryClient = useQueryClient()

  // ⚠️ El formulario se rellenaba UNA vez, al montarse. Si la escuela aún no
  // había cargado (o venía de la caché de hace 5 minutos), se quedaba con los
  // valores viejos para siempre y, al guardar, los volvía a escribir encima.
  // Ahora se vuelve a rellenar cada vez que cambia lo guardado, salvo que ya
  // hayas tocado algo.
  const tocado = useRef(false)
  const guardadoJSON = JSON.stringify(stored || {})
  useEffect(() => {
    if (tocado.current) return
    setEnabled(!!stored.enabled)
    const o: { [k: string]: number } = {}
    const f: { [k: string]: string } = {}
    chapters.forEach((c) => {
      o[c.chapter_uuid] = Number(stored?.chapters?.[c.chapter_uuid] ?? 0)
      f[c.chapter_uuid] = String(stored?.fechas?.[c.chapter_uuid] ?? '')
    })
    setOffsets(o)
    setFechas(f)
    setAvance(avanceGuardado())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardadoJSON, chapters.length])

  if (!isAdmin || chapters.length === 0) return null

  const setDay = (uuid: string, v: string) => {
    tocado.current = true
    const n = Math.max(0, parseInt(v || '0', 10) || 0)
    setOffsets((prev) => ({ ...prev, [uuid]: n }))
  }

  // Quick start: one module per week (0, 7, 14, …). Admin can then tweak each
  // value (e.g. leave the first two at 0, add a 2-week gap for a review week).
  const autofill = () => {
    tocado.current = true
    const next: { [k: string]: number } = {}
    chapters.forEach((c, i) => {
      next[c.chapter_uuid] = i * 7
    })
    setOffsets(next)
  }

  const save = async () => {
    if (!org?.id || !access_token) {
      setResultado({ ok: false, texto: 'La sesión aún no ha cargado. Espera un segundo y vuelve a darle; si sigue, recarga la página.' })
      return
    }
    setSaving(true)
    setResultado(null)
    try {
      // Solo se mandan las fechas puestas: una cadena vacía guardada haría que
      // el backend creyera que hay fecha y bloqueara el capítulo para siempre.
      const soloConFecha: { [k: string]: string } = {}
      Object.entries(fechas).forEach(([k, v]) => {
        if (v && v.trim()) soloConFecha[k] = v.trim()
      })
      const res: any = await updateOrgDripConfig(
        String(org.id),
        { enabled, chapters: offsets, fechas: soloConFecha, avance },
        access_token
      )
      const guardado = res?.drip_content || { enabled, chapters: offsets, fechas: soloConFecha, avance }

      // La escuela en memoria pasa a tener lo que se acaba de guardar, y se
      // pide de nuevo al servidor: así, al volver a esta pantalla o a la del
      // curso, se ve lo guardado y no lo de hace cinco minutos.
      if (org?.slug) {
        queryClient.setQueriesData({ queryKey: queryKeys.org.detail(org.slug) }, (viejo: any) => {
          if (!viejo?.config?.config) return viejo
          return { ...viejo, config: { ...viejo.config, config: { ...viejo.config.config, drip_content: guardado } } }
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(org.slug) })
      }
      tocado.current = false

      const n = Object.keys(guardado.fechas || {}).length
      const texto = `Guardado. ${n} ${n === 1 ? 'módulo con fecha' : 'módulos con fecha'}${guardado.enabled ? '' : ' · ⚠️ el goteo está DESACTIVADO, no se cierra nada'}.`
      setResultado({ ok: true, texto })
      toast.success('Calendario guardado')
    } catch (e: any) {
      const motivo = e?.message || 'sin respuesta del servidor'
      setResultado({ ok: false, texto: `No se ha guardado: ${motivo}${e?.status ? ` (error ${e.status})` : ''}` })
      toast.error('No se pudo guardar el calendario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[#DDE6F5] bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#F0F5FF]/50 transition-colors"
      >
        <CalendarClock size={18} className="text-[#4da3ff] shrink-0" />
        <span className="font-semibold text-[#1D0084] text-sm">
          Goteo de contenido <span className="text-gray-400 font-normal">(solo admins)</span>
        </span>
        <span
          className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {enabled ? 'Activado' : 'Desactivado'}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100">
          <label className="flex items-center gap-2 text-[13.5px] font-medium text-[#1D0084] cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                tocado.current = true
                setEnabled(e.target.checked)
              }}
              className="w-4 h-4 accent-[#4da3ff]"
            />
            Activar desbloqueo por fecha (días desde la matrícula de cada alumno)
          </label>

          <p className="text-[12px] text-gray-500 leading-relaxed">
            Pon <b>0</b> en los módulos que quieras abiertos desde el primer día. Cada número son los
            días que tardan en desbloquearse tras la matrícula. Ejemplo (12 semanas): 0, 0, 14, 21, 35,
            42, 49, 56, 63, 70.
          </p>

          <button
            onClick={autofill}
            className="text-[12px] font-semibold text-[#4da3ff] hover:text-[#1D0084] transition-colors"
          >
            Autorrellenar: 1 módulo por semana (0, 7, 14…)
          </button>

          <p className="text-[12.5px] text-[#5A6480] leading-relaxed">
            <strong>Fecha</strong>: el módulo abre ese día para todos a la vez —
            es lo que quieres en una convocatoria que empieza junta, para que la
            clase en vivo vaya sobre algo que todos ven.{' '}
            <strong>Días</strong>: abre a esos días del alta de cada alumno, así
            que cada uno lo ve en un día distinto. Si pones fecha, manda la fecha.
          </p>

          {/* Va encima de las fechas porque cambia a quién se le aplican. */}
          <div className="rounded-lg border border-[#DDE6F5] bg-[#F8FAFF] p-3.5 space-y-2.5">
            <label className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1D0084] cursor-pointer">
              <input
                type="checkbox"
                checked={avance.activo}
                onChange={(e) => {
                  tocado.current = true
                  setAvance((a) => ({ ...a, activo: e.target.checked }))
                }}
                className="w-4 h-4 accent-[#4da3ff]"
              />
              Formación: los alumnos nuevos abren los módulos por avance
            </label>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-gray-700">
              <span>Para quien entra desde el</span>
              <input
                type="date"
                value={avance.desde}
                disabled={!avance.activo}
                onChange={(e) => {
                  tocado.current = true
                  setAvance((a) => ({ ...a, desde: e.target.value }))
                }}
                aria-label="Fecha desde la que se abre por avance"
                className="bg-white rounded-lg px-2.5 py-1.5 text-[13px] text-[#1D0084] border border-[#DDE6F5] outline-none focus:border-[#4da3ff] disabled:opacity-40"
              />
            </div>
            <ul className="text-[12.5px] text-[#5A6480] leading-relaxed list-disc pl-4 space-y-0.5">
              <li>Introducción y módulos 1 y 2: abiertos desde el primer día.</li>
              <li>Módulo 3: a las 2 semanas de entrar, si ha terminado el 1 y el 2.</li>
              <li>Del 4 en adelante: al terminar el anterior y pasada 1 semana desde que se le abrió (2 semanas tras el 5 y el 7).</li>
              <li>Terminado = el 80 % de las clases del módulo. Lo que se abre no se vuelve a cerrar.</li>
              <li>Quien entró antes sigue con las fechas de abajo. A un alumno concreto se le puede abrir un módulo a mano en Alumnos → Progreso.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            {chapters.map((c, i) => {
              const conFecha = !!(fechas[c.chapter_uuid] || '').trim()
              return (
                <div key={c.chapter_uuid} className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-gray-700 flex-1 min-w-[140px] truncate">
                    <span className="text-gray-400 font-semibold mr-1">{i + 1}.</span>
                    {c.name}
                  </span>
                  {/* La fecha manda sobre los días, así que cuando hay fecha el
                      campo de días se apaga: dejar los dos activos invita a
                      rellenarlos y a creer que se suman. */}
                  <input
                    type="date"
                    value={fechas[c.chapter_uuid] || ''}
                    onChange={(e) => {
                      tocado.current = true
                      setFechas((prev) => ({ ...prev, [c.chapter_uuid]: e.target.value }))
                    }}
                    aria-label={`Fecha fija de apertura de ${c.name}`}
                    className="bg-[#F0F5FF] rounded-lg px-2.5 py-1.5 text-[13px] text-[#1D0084] border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] transition-colors"
                  />
                  <input
                    type="number"
                    min={0}
                    disabled={conFecha}
                    value={offsets[c.chapter_uuid] ?? 0}
                    onChange={(e) => setDay(c.chapter_uuid, e.target.value)}
                    className="w-16 bg-[#F0F5FF] rounded-lg px-2.5 py-1.5 text-[13px] text-[#1D0084] border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] transition-colors text-right disabled:opacity-40"
                  />
                  <span className={`text-[12px] w-8 ${conFecha ? 'text-gray-300' : 'text-gray-400'}`}>días</span>
                </div>
              )
            })}
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="bg-[#4da3ff] hover:bg-[#6cb5ff] disabled:opacity-60 text-[#0a1656] font-bold text-[14px] rounded-lg px-4 py-2.5 transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar calendario'}
          </button>
          {resultado ? (
            <p className={`text-[13px] leading-relaxed ${resultado.ok ? 'text-[#15803D]' : 'text-red-700'}`}>
              {resultado.texto}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
