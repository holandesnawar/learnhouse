'use client'

/**
 * Panel → Alumnos → Tandas y grupos (25/10/2026). Separa la beta (clase
 * semanal) del programa nuevo (masterclass y spreekuren):
 *  - quien paga desde el día elegido entra solo en «Programa nuevo» y en el
 *    grupo de su mes («Matrícula octubre 2026»). Sin correo al equipo;
 *  - quien venía de antes del cambio («Por pagar», señal o enlace de pago)
 *    queda «por decidir»: sale arriba con «Programa nuevo» / «Beta», y en la
 *    campana del administrador (26/10/2026);
 *  - «Alumnos nuevos»: los que han entrado desde el cambio, con su programa y
 *    un botón para pasarlos al otro;
 *  - un botón mete a los alumnos de antes del cambio en «Beta»;
 *  - «Quién ve qué» enseña cada curso y canal con su acceso, para comprobar
 *    que la separación está bien hecha.
 * El acceso de cada curso o canal se cambia en su pestaña «Acceso» del panel:
 * aquí solo se enlaza. Todo en apps/api/src/services/panel/tandas.py.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  decidirPrograma,
  getTandas,
  guardarTandas,
  meterEnBeta,
  type AccesoRecurso,
  type AlumnoNuevo,
  type Tandas,
} from '@services/panel/panel'
import { confirmar } from '@/lib/nawar/confirmar'
import { CURSO_CLASE_SEMANAL_UUID } from '@/lib/nawar/cursos'
import { Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, BOTON_PRINCIPAL, ENLACE, Estado, META, Seccion, TARJETA } from './ui'

const manana = () => {
  const d = new Date(Date.now() + 24 * 3600 * 1000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

const dia = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) : ''

const NOMBRE_PROGRAMA: Record<string, string> = { nuevo: 'Programa nuevo', beta: 'Beta', 'los dos': 'Los dos' }

function TablaAcceso({ filas, enlace }: { filas: AccesoRecurso[]; enlace: (f: AccesoRecurso) => string }) {
  if (!filas.length) return <p className={META}>No hay ninguno todavía.</p>
  return (
    <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
      {filas.map((f) => (
        <div key={f.uuid} className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-[13.5px] text-gray-900 min-w-0">{f.nombre}</span>
          <span className="flex items-baseline gap-3 shrink-0">
            <span className={`text-[13px] ${f.aviso ? 'text-[#B4413C] font-medium' : 'text-gray-700'}`}>{f.texto}</span>
            <Link href={enlace(f)} className={ENLACE}>
              Cambiar
            </Link>
          </span>
          {f.aviso ? <p className="w-full text-[12.5px] text-[#B4413C]">{f.aviso}</p> : null}
        </div>
      ))}
    </div>
  )
}

export default function TandasPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<Tandas | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [beta, setBeta] = useState(false)
  const [desde, setDesde] = useState('')
  const [tanda, setTanda] = useState('')
  const [ocupado, setOcupado] = useState(0)
  const [todos, setTodos] = useState(false)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getTandas(org.id, accessToken)
    if (r.ok && r.datos) {
      setDatos(r.datos)
      setDesde(r.datos.desde || manana())
      setTanda(r.datos.tanda || '')
      setError('')
    } else setError(r.error || 'No se ha podido leer')
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function guardar(cambios: { activo?: boolean; desde?: string; tanda?: string }) {
    setGuardando(true)
    const r = await guardarTandas(org.id, cambios, accessToken)
    setGuardando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    setDatos(r.datos)
    toast.success(r.datos.activo ? 'Guardado: los nuevos entrarán en sus grupos' : 'Guardado: los grupos automáticos están apagados')
  }

  async function laBeta() {
    const ok = await confirmar(
      'Se crea el grupo «Beta» (si no existe) y entran los alumnos de antes del cambio que no están en el programa nuevo. Los que han entrado desde el cambio no se tocan. No cambia lo que ven hasta que cierres la clase semanal a «Beta». ¿Seguimos?',
      { boton: 'Meterlos en Beta' }
    )
    if (!ok) return
    setBeta(true)
    const r = await meterEnBeta(org.id, accessToken)
    setBeta(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido hacer')
      return
    }
    toast.success(r.datos.entran ? `${r.datos.entran} alumnos entran en «Beta» (ahora son ${r.datos.total})` : `Ya estaban todos en «Beta» (${r.datos.total})`)
    cargar()
  }

  async function decidir(a: AlumnoNuevo, programa: 'nuevo' | 'beta') {
    // Desde la lista de ya decididos se pregunta: cambia lo que ve esa persona.
    if (a.programa) {
      const ok = await confirmar(
        programa === 'beta'
          ? `${a.nombre} pasa a la beta: verá la clase semanal y dejará de ver lo del programa nuevo. ¿Seguimos?`
          : `${a.nombre} pasa al programa nuevo: verá la masterclass y los spreekuren y dejará de ver la clase semanal. ¿Seguimos?`,
        { boton: programa === 'beta' ? 'Pasar a la beta' : 'Pasar al programa nuevo' }
      )
      if (!ok) return
    }
    setOcupado(a.id)
    const r = await decidirPrograma(org.id, a.id, programa, accessToken)
    setOcupado(0)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido cambiar')
      return
    }
    toast.success(programa === 'beta' ? `${a.nombre}, a la beta` : `${a.nombre}, al programa nuevo`)
    cargar()
  }

  if (!datos) {
    return error ? (
      <p className="text-[14px] text-red-700">{error}</p>
    ) : (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  const programa = datos.grupos.find((g) => g.es_programa)
  const pendientes = datos.nuevos.filter((a) => !a.programa)
  const decididos = datos.nuevos.filter((a) => a.programa)
  const betaG = datos.grupos.find((g) => g.es_beta)
  const semanal = datos.cursos.find((c) => c.uuid === CURSO_CLASE_SEMANAL_UUID)
  const semanalSoloBeta = !!semanal && !semanal.aviso && semanal.grupos.length > 0 && semanal.texto.startsWith('Solo')
  const canalesAbiertos = datos.canales.filter((c) => !c.texto.startsWith('Solo')).length
  const pasos: { hecho: boolean; texto: React.ReactNode }[] = [
    { hecho: datos.activo, texto: 'Encender «los nuevos entran en sus grupos» (abajo).' },
    {
      hecho: !!betaG && datos.alumnos_sin_grupo === 0,
      texto:
        'Meter a los alumnos de antes del cambio en «Beta» (botón de abajo). Siempre ANTES del paso siguiente, o la beta se queda sin su clase.',
    },
    {
      hecho: semanalSoloBeta,
      texto: (
        <>
          Cerrar la «Clase semanal» a «Beta»:{' '}
          <Link href={`/dash/courses/course/${CURSO_CLASE_SEMANAL_UUID}/access`} className={ENLACE}>
            su Acceso
          </Link>{' '}
          → «Solo usuarios» → en grupos de usuarios, añade «Beta».
        </>
      ),
    },
    {
      hecho: datos.cursos.some((c) => programa && c.grupos.includes(programa.nombre)),
      texto: (
        <>
          Crear el curso de la masterclass y los spreekuren y, en su Acceso, «Solo usuarios» con el grupo «{programa?.nombre || 'Programa nuevo'}».{' '}
          <Link href="/dash/courses" className={ENLACE}>
            Cursos
          </Link>
        </>
      ),
    },
    {
      hecho: datos.canales.length > 0 && canalesAbiertos === 0,
      texto: (
        <>
          Cerrar cada canal de la comunidad a su grupo (en «Quién ve qué», «Cambiar»).
          {canalesAbiertos ? ` Quedan ${canalesAbiertos} abiertos a todos.` : ''}
        </>
      ),
    },
    {
      hecho: false,
      texto:
        'Para verlo como un alumno nuevo: una cuenta de prueba tuya en «Programa nuevo» y en «Testers» (Usuarios → Grupos), y entra con ella en una ventana privada.',
    },
  ]

  return (
    <div className="space-y-7 max-w-3xl">
      <p className="text-[14px] text-gray-700 leading-relaxed">
        La beta sigue con su clase semanal y quien entra desde el día que elijas va al programa nuevo (masterclass y spreekuren). Cada uno
        ve solo lo suyo: lo decide el grupo en el que está.
      </p>

      {pendientes.length > 0 ? (
        <Seccion titulo={`Por decidir (${pendientes.length})`}>
          <p className={META}>
            Han pagado desde el cambio, pero venían de antes: se les vendió con la clase semanal. Elige a dónde va cada uno. Hasta entonces
            ven la formación, pero ni la clase semanal ni la masterclass.
          </p>
          <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
            {pendientes.map((a) => (
              <div key={a.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-gray-900">{a.nombre}</p>
                  <p className={META}>
                    {a.email} · pagó el {dia(a.entro)}
                  </p>
                  {a.motivo ? <p className="text-[12.5px] text-[#8A6A2A] mt-0.5">{a.motivo}</p> : null}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decidir(a, 'nuevo')} disabled={!!ocupado} className={`${BOTON_PRINCIPAL} disabled:opacity-50`}>
                    {ocupado === a.id ? <Loader2 size={13} className="animate-spin" /> : null} Programa nuevo
                  </button>
                  <button onClick={() => decidir(a, 'beta')} disabled={!!ocupado} className={`${BOTON} disabled:opacity-50`}>
                    Beta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      ) : null}

      <Seccion titulo="Para separarlo, en este orden">
        <ol className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
          {pasos.map((p, i) => (
            <li key={i} className="px-4 py-2.5 flex gap-3 text-[13.5px] text-gray-900">
              <span
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center text-[11px] font-semibold ${
                  p.hecho ? 'bg-[#16A34A] border-[#16A34A] text-white' : 'border-[#D1D5DB] text-[#6B7280]'
                }`}
              >
                {p.hecho ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className="leading-relaxed">{p.texto}</span>
            </li>
          ))}
        </ol>
      </Seccion>

      <Seccion titulo="Los nuevos entran en sus grupos">
        <div className={`${TARJETA} p-4 space-y-3`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={datos.activo}
              disabled={guardando}
              onChange={(e) => guardar({ activo: e.target.checked, desde, tanda })}
              className="mt-1 h-4 w-4 accent-[#025dc7]"
            />
            <span className="text-[13.5px] text-gray-900 leading-relaxed">
              Quien pague entra en «{programa?.nombre || 'Programa nuevo'}» y en el grupo de su tanda. Si venía de antes del cambio («Por
              pagar», señal o enlace de pago), queda por decidir: te sale aquí arriba y en la campana.
            </span>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[12.5px] text-[#6B7280]">
              Desde el día
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="mt-1 block h-9 rounded-md border border-[#D1D5DB] px-2 text-[13px] text-gray-900"
              />
            </label>
            <label className="text-[12.5px] text-[#6B7280] flex-1 min-w-[200px]">
              Nombre de la tanda (vacío = por el mes en que paga)
              <input
                value={tanda}
                onChange={(e) => setTanda(e.target.value)}
                placeholder={datos.tanda_de_hoy}
                className="mt-1 block w-full h-9 rounded-md border border-[#D1D5DB] px-2 text-[13px] text-gray-900"
              />
            </label>
            <button onClick={() => guardar({ desde, tanda })} disabled={guardando} className={`${BOTON} disabled:opacity-50`}>
              {guardando ? <Loader2 size={13} className="animate-spin" /> : null} Guardar
            </button>
          </div>
          <p className={META}>
            {datos.activo
              ? `Quien pague hoy entraría en «${programa?.nombre || 'Programa nuevo'}» y «${datos.tanda_de_hoy}»${
                  datos.desde ? ` (a partir del ${datos.desde.split('-').reverse().join('/')})` : ''
                }.`
              : 'Apagado: quien pague no entra en ningún grupo y ve lo mismo que hasta ahora.'}
          </p>
        </div>
      </Seccion>

      {datos.activo && decididos.length > 0 ? (
        <Seccion titulo={`Alumnos nuevos (${decididos.length})`}>
          <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
            {(todos ? decididos : decididos.slice(0, 8)).map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <span className="min-w-0 text-[13.5px] text-gray-900">
                  {a.nombre} <span className={META}>· pagó el {dia(a.entro)}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <Estado tono={a.programa === 'nuevo' ? 'azul' : a.programa === 'beta' ? 'gris' : 'ambar'}>{NOMBRE_PROGRAMA[a.programa]}</Estado>
                  <button
                    onClick={() => decidir(a, a.programa === 'nuevo' ? 'beta' : 'nuevo')}
                    disabled={!!ocupado}
                    className={`${ENLACE} disabled:opacity-50`}
                  >
                    {ocupado === a.id ? 'Cambiando…' : a.programa === 'nuevo' ? 'Pasar a la beta' : 'Pasar al programa nuevo'}
                  </button>
                </span>
              </div>
            ))}
          </div>
          {decididos.length > 8 ? (
            <button onClick={() => setTodos(!todos)} className={ENLACE}>
              {todos ? 'Ver menos' : `Ver los ${decididos.length}`}
            </button>
          ) : null}
        </Seccion>
      ) : null}

      <Seccion titulo="La beta">
        <div className={`${TARJETA} p-4 flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-[13.5px] text-gray-900">
            {betaG ? `«Beta»: ${betaG.alumnos} alumnos.` : 'Todavía no hay grupo «Beta».'}{' '}
            {datos.alumnos_sin_grupo ? (
              <span className="text-[#B4413C]">
                {datos.alumnos_sin_grupo} alumnos de antes del cambio no están ni en «Beta» ni en el programa nuevo.
              </span>
            ) : (
              <span className="text-[#6B7280]">Todos los alumnos tienen su grupo.</span>
            )}
          </p>
          <button onClick={laBeta} disabled={beta} className={`${BOTON_PRINCIPAL} disabled:opacity-50`}>
            {beta ? <Loader2 size={13} className="animate-spin" /> : null} Meter a los alumnos de antes del cambio en «Beta»
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Quién ve qué">
        <p className={META}>Cursos</p>
        <TablaAcceso filas={datos.cursos} enlace={(f) => `/dash/courses/course/${f.uuid}/access`} />
        <p className={`${META} pt-2`}>Canales de la comunidad</p>
        <TablaAcceso filas={datos.canales} enlace={(f) => `/dash/communities/${f.uuid.replace(/^community_/, '')}/access`} />
        <p className={META}>
          «Todos los que han entrado» incluye a la beta y al programa nuevo. Para que lo vea solo un grupo: Acceso → «Solo usuarios» → en
          grupos de usuarios, añade ese grupo. El equipo lo ve todo siempre.
        </p>
      </Seccion>

      <Seccion titulo="Grupos">
        <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
          {datos.grupos.map((g) => (
            <div key={g.id} className="px-4 py-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-gray-900 flex items-baseline gap-2 min-w-0">
                {g.nombre}
                {g.es_programa ? <Estado tono="azul">programa nuevo</Estado> : null}
                {g.es_beta ? <Estado tono="gris">beta</Estado> : null}
              </span>
              <span className="text-gray-700 tabular-nums shrink-0">
                {g.alumnos} alumnos{g.personas !== g.alumnos ? ` · ${g.personas - g.alumnos} del equipo` : ''}
              </span>
            </div>
          ))}
        </div>
        <p className={META}>
          Se gestionan en{' '}
          <Link href="/dash/users/settings/usergroups" className={ENLACE}>
            Usuarios → Grupos
          </Link>
          : para meter a alguien de la beta en el programa nuevo (a cambio de su vídeo), añádelo allí a «{programa?.nombre || 'Programa nuevo'}».
        </p>
      </Seccion>
    </div>
  )
}
