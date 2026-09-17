'use client'

/**
 * Qué ven los profes de la formación. Lo decide el administrador.
 *
 * Por qué existe, que es lo que no se debe perder si alguien lo toca:
 *
 * El profe da la clase en vivo compartiendo pantalla. Si a él se le abren los
 * módulos que todavía no le tocan al alumno, el alumno lo ve —abre la pestaña,
 * asoma lo que hay dentro— y la convocatoria por fases deja de sostenerse. Por
 * eso el defecto es que el profe vea lo mismo que ellos, con sus candados.
 *
 * Y lo decide UNA persona para toda la escuela, no cada profe por su cuenta:
 * si cada uno se lo abriera, el administrador no podría saber qué está viendo
 * su equipo en la clase del sábado, que es justo lo que quiere controlar.
 *
 * ⚠️ Esconder esta pantalla NO es la seguridad. El servidor exige permiso de
 * administrador al guardar (`rbac_check … "update"`, que deja fuera al profe a
 * propósito). Es la trampa en la que ya se cayó dos veces en esta escuela:
 * enseñar un botón mirando un permiso distinto del que exige el backend.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { updateOrgAccesoProfes } from '@services/settings/org'

interface Props {
  orgId: number | undefined
}

export default function AccesoProfesSettings({ orgId }: Props) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [venTodo, setVenTodo] = useState<boolean | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!orgId) return
    try {
      const r = await fetch(`${getAPIUrl()}orgs/${orgId}/config/acceso_profes`)
      const d = await r.json().catch(() => null)
      setVenTodo(!!d?.ven_todo)
    } catch {
      // Sin dato, se enseña el defecto: como un alumno.
      setVenTodo(false)
    }
  }, [orgId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const elegir = async (nuevo: boolean) => {
    if (!orgId || nuevo === venTodo) return
    setGuardando(true)
    try {
      const ok = await updateOrgAccesoProfes(orgId, nuevo, accessToken)
      if (!ok) throw new Error('El servidor no aceptó el cambio')
      setVenTodo(nuevo)
      toast.success(
        nuevo
          ? 'Los profes ven la formación entera, como tú.'
          : 'Los profes la ven como un alumno, con los candados.',
        { duration: 7000 }
      )
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar', { duration: 10000 })
    } finally {
      setGuardando(false)
    }
  }

  if (venTodo === null) {
    return <div className="h-28 rounded-2xl bg-white border border-[#DDE6F5] animate-pulse" />
  }

  const opciones = [
    {
      valor: false,
      icono: <EyeOff size={17} />,
      titulo: 'Como un alumno',
      texto:
        'Los módulos que aún no se han abierto salen con candado y el profe no puede entrar, igual que ellos. Es lo que hace creíble la clase en vivo: el alumno ve que al profe tampoco se le abre.',
    },
    {
      valor: true,
      icono: <Eye size={17} />,
      titulo: 'Todo, como tú',
      texto:
        'El profe ve la formación entera, incluidos los módulos que todavía no se han abierto. Útil para que prepare el suyo con antelación, pero si comparte pantalla los alumnos verán que a él sí se le abren.',
    },
  ]

  return (
    <div className="space-y-2.5">
      {opciones.map((o) => {
        const elegida = venTodo === o.valor
        return (
          <button
            key={String(o.valor)}
            onClick={() => elegir(o.valor)}
            disabled={guardando}
            className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-colors disabled:opacity-60 ${
              elegida
                ? 'border-[#4da3ff] bg-[#F7FAFF] ring-[3px] ring-[#4da3ff]/18'
                : 'border-[#DDE6F5] bg-white hover:bg-[#F8FAFF]'
            }`}
          >
            <p className="flex items-center gap-2 text-[14.5px] font-bold text-[#1D0084]">
              <span className={elegida ? 'text-[#025dc7]' : 'text-[#8A96AB]'}>{o.icono}</span>
              {o.titulo}
              {guardando && elegida && <Loader2 size={13} className="animate-spin text-[#8A96AB]" />}
              {elegida && !guardando && (
                <span className="ml-auto text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#025dc7]">
                  Activo
                </span>
              )}
            </p>
            <p className="mt-1 text-[13px] text-[#5A6480] leading-relaxed">{o.texto}</p>
          </button>
        )
      })}
      <p className="text-[12.5px] text-[#8A96AB] leading-relaxed pt-1">
        Vale para todos los profes y moderadores a la vez, y solo lo puedes cambiar tú. A ti
        no te afecta: como administrador sigues viendo la formación entera.
      </p>
    </div>
  )
}
