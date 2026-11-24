'use client'

/**
 * La ficha de un ALUMNO (22/11/2026): alguien que ya ha pagado. Aquí lo que
 * importa es si entra, por dónde va y si está al día con los pagos; cómo
 * llegó (lo del lead) queda en su pestaña, sin estorbar.
 *
 * La ven los administradores y, desde el 23/11/2026, los closers en «modo
 * closer» (`admin={false}`, ver `Ficha.tsx`). Un closer ve de un alumno lo que
 * ya veía en la ficha de siempre (sus pagos uno a uno y el total pagado, su
 * plan de plazos, su señal, llamadas, notas, tareas, cómo llegó) y además
 * cómo va: formación, clases en directo, su objetivo. NO ve: vendido / por
 * cobrar ni la comisión (el servidor no se los manda), el bloque «Acceso»
 * (contraseña, cambiar correo, ver como), «Mandar recordatorio», «Abrir ya»
 * un módulo, ni borrar o quitar de los números: todo eso son rutas solo de
 * administradores.
 *
 * Junta lo que antes
 * estaba en dos sitios: la ficha de siempre (`FichaCliente.tsx`: pagos,
 * llamadas, notas) y la ficha de Progreso (`FichaAlumno` de
 * `ProgresoPanel.tsx`: avance, módulos, recordatorio, contraseña).
 *
 * - Cabecera: WhatsApp, «Mandar recordatorio» y «⋯» (correo, corregir datos,
 *   quitar de los números).
 * - Resumen: cuatro datos (última vez, formación, clases en directo, pagos),
 *   el aviso si lleva dos semanas sin avanzar o le ha fallado un cobro, los
 *   módulos, su objetivo y las notas del equipo.
 * - Formación: todo el detalle y «Abrir ya» un módulo.
 * - Clases en directo: su camino de 16 semanas y a cuáles ha venido.
 * - Pagos: lo vendido, lo cobrado, sus plazos, cada pago y la comisión.
 * - Cómo llegó: de dónde vino, lo que contestó, sus llamadas y todo lo que pasó.
 * - Lateral: su cuenta, la compra, lo que nos contó al empezar y el acceso.
 *
 * `ficha` puede faltar (una cuenta de alumno sin rastro de venta con ese
 * correo) y `alumno` también (pagó pero no sale en Progreso: sin cuenta, en
 * Testers o fuera de los números): cada parte dice lo que no tiene.
 */

import { textoBienvenida } from '@/lib/nawar/bienvenida'
import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { Bell, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import { colorCloser } from '@lib/nawar/colorCloser'
import { mensajeAtascado, resumenAtasco } from '@/lib/nawar/atascados'
import { aCaja, comisionCents, leerEuros, pctQueCuadra, textoPct } from '@lib/nawar/comision'
import ComisionPct from './ComisionPct'
import { CURSO_FORMACION_UUID, RUTA_FORMACION } from '@/lib/nawar/cursos'
import { getSchoolUrl } from '@services/config/config'
import { avisoTrasBorrar, borrarContacto, type Cita, type VolverALlamar } from '@services/stats/contactos'
import {
  apuntarWhatsappAlumno,
  euros,
  fechaCorta,
  marcarComision,
  quitarComision,
  type AlumnoCamino,
  type AlumnoProgreso,
  type ComisionVenta,
  type FichaCliente as Ficha,
} from '@services/panel/panel'
import { BotonVerComo } from '@components/Objects/VerComo/VerComo'
import { CambiarCorreo, EnlaceContrasena, ModulosPorAvance, abrirAMano, cuando, deshacerAMano, haceDias, modulo } from './AlumnoPiezas'
import EditarDatos from './EditarDatos'
import NuevaLlamada from './NuevaLlamada'
import PlanPagosFicha from './PlanPagosFicha'
import RecordatorioModal from './RecordatorioModal'
import ReservaPlaza from './ReservaPlaza'
import { BloqueBlackFriday, BloqueReto } from './FichaCliente'
import { nombreCorto, useReparto } from './Reparto'
import { quitarPersona } from './quitarPersona'
import {
  Correos,
  Crm,
  LadoTitulo,
  LineaTiempo,
  ListaLlamadas,
  Marco,
  MenuMas,
  Notas,
  Opcion,
  Paginas,
  Paso,
  Prop,
  Props,
  PropsOrigen,
  Respuestas,
  Sec,
  TareasDe,
  Vacio,
  tareasPendientes,
} from './FichaPiezas'
import { BOTON, BOTON_PRINCIPAL, BOTON_TEXTO, Cifra, ENLACE, Estado, MARCA, ROJO, Tira, VERDE, filtro } from './ui'

/** «3 nov» o «3 nov 2025» si no es de este año. */
function dia(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) })
}

/** Una barra de módulo, sin candados (para quien no va por avance, o sin cuenta en Progreso). */
function BarraModulo({ nombre, hechas, total }: { nombre: string; hechas: number; total: number }) {
  const pct = total ? Math.round((hechas * 100) / total) : 0
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(60px,1.4fr)_56px] items-center gap-3 py-[7px] text-[13.5px]">
      <span className="truncate">{modulo(nombre)}</span>
      <span className="block h-1.5 rounded-full bg-[#EDEFF4] overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: total > 0 && hechas >= total ? VERDE : MARCA }} />
      </span>
      <span className="text-right text-[13px] text-[#4B5565] tabular-nums">
        {hechas} de {total}
      </span>
    </li>
  )
}

/** La comisión del closer de esta venta: verla, marcarla pagada (eligiendo el % o el importe) o quitar la marca. */
function Comision({ email, com, pcts, onCambio }: { email: string; com: ComisionVenta; pcts: number[]; onCambio: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [abierta, setAbierta] = useState(false)
  const [verPct, setVerPct] = useState(false)
  const [importe, setImporte] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const lista = pcts.length ? pcts : [10, 15, 18]
  const cents = leerEuros(importe)
  const pctCaja = cents === null ? null : pctQueCuadra(com.base_cents, cents, lista)

  function abrir() {
    setImporte(aCaja(com.pagada?.importe_cents || com.estimada_cents || 0))
    setAbierta(true)
  }
  async function guardar() {
    if (cents === null) return toast.error('Escribe el importe en euros')
    setOcupado(true)
    const r = await marcarComision(org.id, email, cents, token, pctCaja)
    setOcupado(false)
    if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
    toast.success('Comisión apuntada como pagada')
    setAbierta(false)
    onCambio()
  }
  async function quitar() {
    if (!(await confirmar('¿Quitar la marca de pagada? La comisión vuelve a salir como pendiente.', { boton: 'Quitar la marca', peligro: false }))) return
    setOcupado(true)
    const r = await quitarComision(org.id, email, token)
    setOcupado(false)
    if (!r.ok) return toast.error(r.error || 'No se ha podido quitar')
    setAbierta(false)
    onCambio()
  }

  const pctPagada = com.pagada ? pctQueCuadra(com.base_cents, com.pagada.importe_cents, lista) : null
  return (
    <div>
      {com.pagada ? (
        <Estado tono="verde" className="!text-[#0B1020]">
          Pagada · {euros(com.pagada.importe_cents)}
          {pctPagada ? ` (${textoPct(pctPagada)})` : ''}
        </Estado>
      ) : com.con_llamada ? (
        <Estado tono="ambar" className="!text-[#0B1020]">
          Pendiente · ≈ {euros(com.estimada_cents)}
        </Estado>
      ) : (
        <span className="text-[#4B5565]">Sin llamada: sin comisión</span>
      )}
      <span className="block text-[12.5px] text-[#8A93A3]">
        {com.pagada
          ? `${dia(com.pagada.cuando)}${com.pagada.por ? ` · la apuntó ${nombreCorto(com.pagada.por)}` : ''}`
          : `${textoPct(com.pct)} de ${euros(com.base_cents)}${com.pct_elegido ? ' · puesto a mano' : ''}`}
      </span>
      {/* El % de esta venta (24/11/2026): 18 % si el closer la seteó. */}
      {!com.pagada && verPct ? (
        <div className="mt-2">
          <ComisionPct
            email={email}
            com={com}
            pcts={lista}
            compacto
            onCambio={() => {
              setVerPct(false)
              onCambio()
            }}
          />
        </div>
      ) : null}
      {abierta ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {lista.map((p) => (
              <button key={p} onClick={() => setImporte(aCaja(comisionCents(com.base_cents, p)))} className={`${filtro(pctCaja === p)} tabular-nums !h-7 !px-2`}>
                {textoPct(p)}
              </button>
            ))}
            <label className="inline-flex items-center gap-1 h-7 rounded-lg border border-[#E6E8EE] bg-white px-2">
              <input value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" aria-label="Lo que se le pagó, en euros" className="w-14 text-[13px] tabular-nums outline-none bg-transparent" />
              <span className="text-[12.5px] text-[#8A93A3]">€</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={guardar} disabled={ocupado} className={`${BOTON_PRINCIPAL} !h-7`}>
              Marcar pagada
            </button>
            {com.pagada ? (
              <button onClick={quitar} disabled={ocupado} className={`${BOTON} !h-7`}>
                Quitar la marca
              </button>
            ) : null}
            <button onClick={() => setAbierta(false)} className={`${BOTON_TEXTO} !h-7`}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 mt-0.5">
          <button onClick={abrir} className={ENLACE}>
            {com.pagada ? 'Cambiar' : 'Marcar como pagada'}
          </button>
          {!com.pagada && !verPct ? (
            <button onClick={() => setVerPct(true)} className={ENLACE}>
              Cambiar el %
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function FichaAlumno({
  ficha,
  setFicha,
  cargar,
  alumno,
  camino,
  nombre,
  email,
  onClose,
  onCambio,
  onCambioFecha,
  onQuitar,
  quitarEtiqueta,
  admin,
}: {
  /** `false` = la mira un closer: sin lo que es solo de administradores. */
  admin: boolean
  ficha: Ficha | null
  setFicha: (f: Ficha) => void
  /** Vuelve a leer la ficha, Progreso y el camino. */
  cargar: () => void
  alumno: AlumnoProgreso | null
  /** `undefined` mientras se lee; `null` si no sale en el camino. */
  camino: AlumnoCamino | null | undefined
  nombre: string
  email: string
  onClose: () => void
  onCambio?: () => void
  onCambioFecha?: (email: string, v: VolverALlamar | null) => void
  onQuitar?: () => void
  quitarEtiqueta?: string
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const yo = session?.data?.user?.first_name || ''
  const reparto = useReparto()
  const [pestana, setPestana] = useState('resumen')
  const [recordar, setRecordar] = useState(false)
  const [editando, setEditando] = useState(false)
  const [cambiarCita, setCambiarCita] = useState<Cita | null>(null)
  const [menu, setMenu] = useState(false)
  const [preguntarWa, setPreguntarWa] = useState(false)

  const telefono = ficha?.telefono || alumno?.telefono || ''
  const tel = numeroWhatsApp(telefono)
  const plan = ficha?.plan_pagos || null
  const venta = ficha?.venta || null
  const av = alumno || ficha?.avance || null
  const fuera = !!ficha?.fuera_de_metricas
  // Quitar de los números y borrar: administradores, o la pantalla de fuera
  // si trae su propio «quitar» (hoy solo se lo pasa a administradores).
  const puedeQuitar = admin || Boolean(onQuitar)
  // Lo pagado con este correo: lo que un closer ya veía en la ficha de siempre.
  const pagado = ficha?.total_pagado_cents ?? 0

  function refrescar() {
    cargar()
    onCambio?.()
  }

  async function quitar() {
    if (!ficha) return
    if (onQuitar) return onQuitar()
    const r = await quitarPersona(org?.id, token, { email: ficha.email, nombre: ficha.nombre, esAlumno: true, fuera })
    if (!r) return
    onCambio?.()
    if (r === 'fuera') onClose()
    else setFicha({ ...ficha, fuera_de_metricas: false })
  }

  async function borrarRastro() {
    if (!ficha) return
    if (
      !(await confirmar(
        `¿Borrar el rastro de ${ficha.nombre || ficha.email}? Se borran sus notas, llamadas, tareas, solicitudes y matrículas sin pagar, y deja de salir en el panel. Si pagó, el pago y la factura se quedan, y su cuenta también.`,
        { boton: 'Borrar su rastro', peligro: true }
      ))
    )
      return
    const r = await borrarContacto(org?.id, ficha.email, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    toast.success(avisoTrasBorrar(r.quedan) === 'Borrado' ? 'Borrado' : 'Borrado su rastro. Sigue fuera de los números.')
    onCambio?.()
    onClose()
  }

  // ── Los cuatro datos ─────────────────────────────────────────────────────
  const diasSin = alumno?.estado.dias ?? null
  const ultima = alumno
    ? {
        valor: alumno.ultima_entrada ? (diasSin === 0 ? 'hoy' : diasSin === 1 ? 'ayer' : diasSin !== null ? `hace ${diasSin} días` : cuando(alumno.ultima_entrada)) : 'nunca',
        nota: alumno.ultima_entrada ? cuando(alumno.ultima_entrada).split(' · ')[0] : `Entró en la escuela el ${dia(alumno.alta)}`,
        color: !alumno.ultima_entrada || (diasSin !== null && diasSin > 7) ? ROJO : undefined,
      }
    : { valor: '—', nota: 'No sale en Progreso', color: undefined }
  const cobrado = venta?.cobrado_cents ?? ficha?.total_pagado_cents ?? 0
  const vendido = venta?.vendido_cents ?? cobrado
  const notaPagos = plan
    ? plan.estado === 'fallido'
      ? 'cobro fallido'
      : plan.estado === 'cancelado'
        ? 'plan cancelado'
        : plan.cuotas_pagadas >= plan.cuotas
          ? `${plan.cuotas} pagos · completado`
          : `pago ${plan.cuotas_pagadas} de ${plan.cuotas}${plan.proximo_cobro ? ` · próximo ${dia(plan.proximo_cobro)}` : ''}`
    : ficha?.pagos.length
      ? ficha.pagos.length === 1
        ? `un pago · ${dia(ficha.pagos[0].fecha)}`
        : `${ficha.pagos.length} pagos`
      : 'sin pagos apuntados'

  // ── El aviso ─────────────────────────────────────────────────────────────
  const atasco = alumno?.sin_avanzar
  const enlaceSeguir = alumno
    ? getSchoolUrl(alumno.seguir_uuid ? `/course/${CURSO_FORMACION_UUID}/activity/${alumno.seguir_uuid.replace('activity_', '')}` : RUTA_FORMACION)
    : ''
  const textoWa = alumno
    ? encodeURIComponent(mensajeAtascado({ nombre: alumno.nombre, yo, clase: alumno.siguiente?.clase || '', enlace: enlaceSeguir, sinEmpezar: !!atasco?.sin_empezar }))
    : ''
  let aviso: React.ReactNode = null
  if (plan?.estado === 'fallido') {
    aviso = (
      <Paso color={ROJO} titulo="Le ha fallado un cobro" detalle={plan.fallo || 'Stripe no ha podido cobrar su plazo. Su acceso sigue igual: lo decide el equipo.'}>
        <button onClick={() => setPestana('pagos')} className={BOTON}>
          Ver sus pagos
        </button>
      </Paso>
    )
  } else if (alumno && atasco?.atascado) {
    aviso = (
      <Paso
        color={ROJO}
        titulo={resumenAtasco(atasco.dias, atasco.sin_empezar) || 'Lleva tiempo sin avanzar'}
        detalle={
          <>
            {alumno.donde ? `Se quedó en «${alumno.donde.clase}».` : 'Todavía no ha abierto ninguna clase.'}{' '}
            {atasco.escrito_hace_poco
              ? 'Ya se le escribió esta semana.'
              : alumno.ultimo_recordatorio
                ? `Último recordatorio ${haceDias(alumno.ultimo_recordatorio.sent_at)}.`
                : 'No se le ha escrito todavía.'}
          </>
        }
        debajo={
          admin && preguntarWa ? (
            <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
              ¿Le has mandado el mensaje?
              <button
                onClick={async () => {
                  const r = await apuntarWhatsappAlumno(org.id, alumno.user_id, token)
                  setPreguntarWa(false)
                  if (r.ok) {
                    toast.success('Apuntado')
                    refrescar()
                  } else toast.error(r.error || 'No se ha podido apuntar')
                }}
                className={BOTON_PRINCIPAL}
              >
                Sí, enviado
              </button>
              <button onClick={() => setPreguntarWa(false)} className={BOTON}>
                No lo envié
              </button>
            </div>
          ) : undefined
        }
      >
        {tel ? (
          <a href={`https://wa.me/${tel}?text=${textoWa}`} target="_blank" rel="noreferrer" onClick={admin ? () => setPreguntarWa(true) : undefined} className={BOTON}>
            Escribirle por WhatsApp
          </a>
        ) : admin ? (
          <button onClick={() => setRecordar(true)} className={BOTON}>
            Mandarle un correo
          </button>
        ) : null}
      </Paso>
    )
  } else if (ficha?.reserva?.estado === 'abierta') {
    aviso = <Paso color="#C28A1A" titulo={`Le faltan ${euros(ficha.reserva.pendiente_cents)} de su plaza`} detalle={`Ha pagado ${euros(ficha.reserva.pagado_cents)} de ${euros(ficha.reserva.total_cents)}.`} />
  }

  const modulos =
    alumno?.por_avance && alumno.aperturas.length ? (
      <ModulosPorAvance
        a={alumno}
        onAbrir={admin ? async (m) => (await abrirAMano(org.id, token, alumno, m)) && cargar() : undefined}
        onDeshacer={admin ? async (m) => (await deshacerAMano(org.id, token, alumno, m)) && cargar() : undefined}
      />
    ) : av?.modulos?.length ? (
      <ul>
        {av.modulos.map((m) => (
          <BarraModulo key={m.nombre} {...m} />
        ))}
      </ul>
    ) : (
      <Vacio>{av ? 'El curso no tiene clases publicadas.' : 'No tiene cuenta en la escuela con este correo, así que no se ve su avance.'}</Vacio>
    )

  const grupos = camino?.grupos?.length ? camino.grupos.join(' · ') : ''
  const estado = (
    <>
      {alumno?.alta || camino?.entro ? `En la escuela desde el ${dia(alumno?.alta || camino?.entro || '')}` : 'Ya ha pagado'}
      {camino?.semana ? ` · semana ${Math.min(camino.semana, 16)} de 16` : ''}
      {grupos ? ` · ${grupos}` : ''}
      {fuera ? ' · fuera de los números' : ''}
    </>
  )

  const acciones = (
    <>
      {tel ? (
        <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className={BOTON}>
          <MessageCircle size={14} /> WhatsApp
        </a>
      ) : null}
      {alumno && admin ? (
        <button onClick={() => setRecordar(true)} className={BOTON_PRINCIPAL}>
          <Bell size={14} /> Mandar recordatorio
        </button>
      ) : null}
      <MenuMas onAbierto={setMenu}>
        {(cerrar) => (
          <>
            {tel ? <Opcion href={`tel:+${tel}`}>Llamar por teléfono</Opcion> : null}
            <Opcion href={`mailto:${alumno?.email || email}`}>Escribirle un correo</Opcion>
            {ficha ? (
              <Opcion
                onClick={() => {
                  cerrar()
                  setEditando(true)
                }}
              >
                {telefono ? 'Corregir nombre o teléfono' : 'Añadir su teléfono'}
              </Opcion>
            ) : null}
            {ficha && puedeQuitar ? (
              <>
                <div className="my-1 border-t border-[#F0F1F5]" />
                <Opcion
                  onClick={() => {
                    cerrar()
                    quitar()
                  }}
                >
                  {fuera ? 'Volver a contar en los números' : onQuitar && quitarEtiqueta ? quitarEtiqueta : 'Quitar de los números (era una prueba)'}
                </Opcion>
                {fuera ? (
                  <Opcion
                    peligro
                    onClick={() => {
                      cerrar()
                      borrarRastro()
                    }}
                  >
                    Borrar su rastro
                  </Opcion>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </MenuMas>
    </>
  )

  const conocerte = alumno?.plan?.conocerte
  const closerId = ficha?.tablero.closer_id || 0
  const lateral = (
    <>
      <LadoTitulo
        extra={
          ficha ? (
            <button onClick={() => setEditando((x) => !x)} className={ENLACE}>
              Editar
            </button>
          ) : null
        }
      >
        Su cuenta
      </LadoTitulo>
      <Props>
        <Prop t="Entra con">{alumno?.email || (ficha?.user_id ? email : <span className="text-[#8A93A3]">Sin cuenta con este correo</span>)}</Prop>
        {ficha && alumno && alumno.email !== ficha.email ? <Prop t="Pagó con">{ficha.email}</Prop> : null}
        <Prop t="WhatsApp">
          {tel ? (
            <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="tabular-nums hover:underline">
              {telefono}
            </a>
          ) : (
            <span className="text-[#8A93A3]">No lo tenemos</span>
          )}
        </Prop>
        <Prop t="Grupos">{grupos || (camino === undefined ? '…' : <span className="text-[#8A93A3]">En ninguno</span>)}</Prop>
        {camino?.termina ? (
          <Prop t="Termina">
            {dia(camino.termina)}
            <span className="text-[#8A93A3]"> (semana 16)</span>
          </Prop>
        ) : null}
      </Props>

      {ficha ? (
        <>
          <LadoTitulo>Compra</LadoTitulo>
          <Props>
            {admin ? (
              <>
                <Prop t="Vendido">
                  <b className="font-semibold tabular-nums">{euros(vendido)}</b>
                  {plan ? ` · ${plan.cuotas} plazos` : ''}
                </Prop>
                <Prop t="Cobrado">
                  <span className="tabular-nums">{euros(cobrado)}</span>
                  {vendido > cobrado ? <span className="text-[#8A93A3]"> · faltan {euros(vendido - cobrado)}</span> : null}
                </Prop>
              </>
            ) : (
              // Modo closer: lo que ya veía en la ficha de siempre, el total pagado. Sin «vendido» ni «por cobrar».
              <Prop t="Ha pagado">
                <b className="font-semibold tabular-nums">{euros(pagado)}</b>
                <span className="text-[#8A93A3]"> · {notaPagos}</span>
              </Prop>
            )}
            {plan?.proximo_cobro && plan.cuotas_pagadas < plan.cuotas && plan.estado !== 'cancelado' ? (
              <Prop t="Próximo">
                {dia(plan.proximo_cobro)} · {euros(plan.cuota_cents)}
              </Prop>
            ) : null}
            <Prop t="Closer">
              {closerId ? (
                <Estado color={colorCloser(closerId, reparto.equipo, ficha.tablero.closer || '')} className="!text-[#0B1020]">
                  {nombreCorto(ficha.tablero.closer || '')}
                </Estado>
              ) : (
                <span className="text-[#8A93A3]">Sin closer</span>
              )}
            </Prop>
            {admin && ficha.comision ? (
              <Prop t="Comisión">
                <Comision email={ficha.email} com={ficha.comision} pcts={ficha.porcentajes_comision || []} onCambio={refrescar} />
              </Prop>
            ) : null}
          </Props>
        </>
      ) : null}

      {conocerte && Object.keys(conocerte).length ? (
        <>
          <LadoTitulo>Al empezar nos contó</LadoTitulo>
          <Props>
            <Prop t="De dónde">{[conocerte.de_donde, conocerte.vive_en && `vive en ${conocerte.vive_en}`].filter(Boolean).join(' · ')}</Prop>
            <Prop t="Le cuesta">{conocerte.problema}</Prop>
            <Prop t="En 4 meses">{conocerte.en_4_meses}</Prop>
          </Props>
        </>
      ) : null}

      {alumno && admin ? (
        <>
          <LadoTitulo>Acceso</LadoTitulo>
          <div className="space-y-2 [&_button]:text-left [&_button]:items-start [&_svg]:mt-[3px] [&_svg]:shrink-0">
            <EnlaceContrasena a={alumno} />
            <CambiarCorreo a={alumno} />
            <BotonVerComo orgId={org?.id} userId={alumno.user_id} nombre={alumno.nombre} />
          </div>
        </>
      ) : null}
    </>
  )

  const nPend = ficha ? tareasPendientes(ficha) : 0
  const sinFicha = <Vacio>No hay rastro de venta con el correo {email}: ni pagos, ni llamadas, ni formularios. Puede que pagara con otro correo.</Vacio>

  return (
    <>
      <Marco
        nombre={ficha?.nombre || alumno?.nombre || nombre || email}
        colorAvatar={['#E7F5EE', VERDE]}
        estado={estado}
        acciones={acciones}
        bajoCabecera={
          editando && ficha ? (
            <EditarDatos
              email={ficha.email}
              nombre={ficha.nombre}
              telefono={ficha.telefono}
              onCancelar={() => setEditando(false)}
              onGuardado={() => {
                setEditando(false)
                refrescar()
              }}
            />
          ) : null
        }
        pestanas={[
          { id: 'resumen', nombre: 'Resumen' },
          { id: 'formacion', nombre: 'Formación' },
          { id: 'directo', nombre: 'Clases en directo', n: camino?.clases_directo || null },
          { id: 'pagos', nombre: 'Pagos', n: ficha?.pagos.length || null },
          { id: 'llego', nombre: 'Cómo llegó' },
        ]}
        pestana={pestana}
        onPestana={setPestana}
        onClose={onClose}
        bloqueado={recordar || !!cambiarCita || menu}
        lateral={lateral}
      >
        {pestana === 'resumen' ? (
          <>
            <Tira>
              <Cifra pequena rotulo="Última vez" valor={ultima.valor} color={ultima.color} nota={ultima.nota} />
              <Cifra
                pequena
                rotulo="Formación"
                valor={av ? `${av.pct} %` : '—'}
                nota={av ? `${av.hechas} de ${av.total} clases${alumno?.donde ? ` · ${modulo(alumno.donde.modulo).split(' · ')[0].toLowerCase()}` : ''}` : 'sin cuenta con este correo'}
              />
              <Cifra
                pequena
                rotulo="Clases en directo"
                valor={camino ? camino.clases_directo : camino === undefined ? '…' : '—'}
                nota={camino ? (camino.semana ? `en ${Math.min(camino.semana, 16)} ${camino.semana === 1 ? 'semana' : 'semanas'}` : 'aún no ha empezado') : camino === undefined ? '' : 'no sale en el camino'}
              />
              <Cifra
                pequena
                rotulo="Pagos"
                valor={ficha ? euros(admin ? cobrado : pagado) : '—'}
                nota={ficha ? `${admin && vendido > cobrado ? `de ${euros(vendido)} · ` : ''}${notaPagos}` : 'sin rastro de venta'}
              />
            </Tira>

            {aviso ? <div className="mt-6">{aviso}</div> : null}

            <Sec
              titulo="Formación"
              extra={
                <button onClick={() => setPestana('formacion')} className={ENLACE}>
                  Ver el detalle
                </button>
              }
            >
              {modulos}
            </Sec>

            {alumno ? (
              <Sec titulo="Vídeo de bienvenida">
                <p>{textoBienvenida(alumno.bienvenida)}</p>
              </Sec>
            ) : null}

            {alumno ? (
              <Sec titulo="Su objetivo">
                {alumno.plan ? (
                  <>
                    <p>
                      {alumno.plan.texto ? `«${alumno.plan.texto}»` : alumno.plan.objetivo}
                      {alumno.plan.texto && alumno.plan.objetivo && alumno.plan.texto !== alumno.plan.objetivo ? <span className="text-[#8A93A3]"> · {alumno.plan.objetivo}</span> : null}
                    </p>
                    {alumno.plan.dias ? (
                      <p className="text-[13px] text-[#8A93A3] mt-1">
                        Se propuso estudiar {alumno.plan.dias} a las {alumno.plan.hora}, {alumno.plan.minutos} minutos · ha entrado {alumno.entradas_7d}{' '}
                        {alumno.entradas_7d === 1 ? 'día' : 'días'} en los últimos 7
                      </p>
                    ) : null}
                  </>
                ) : (
                  <Vacio>Aún no ha dicho para qué quiere el neerlandés ni qué días va a estudiar.</Vacio>
                )}
              </Sec>
            ) : null}

            {ficha ? (
              <Sec titulo="Notas del equipo">
                <Notas
                  email={ficha.email}
                  notas={ficha.notas}
                  volver={ficha.volver_a_llamar}
                  // «Volver a llamar» con un alumno: los closers lo tenían en la
                  // ficha de siempre, así que lo conservan; al administrador solo
                  // le sale si ya había una fecha puesta.
                  conFecha={!admin || !!ficha.volver_a_llamar}
                  marcador="Añadir una nota…"
                  onNotas={(n) => {
                    setFicha({ ...ficha, notas: n })
                    onCambio?.()
                  }}
                  onFecha={(v) => {
                    setFicha({ ...ficha, volver_a_llamar: v })
                    onCambioFecha?.(ficha.email, v)
                    onCambio?.()
                  }}
                />
              </Sec>
            ) : null}

            {ficha ? (
              <Sec titulo={nPend ? `Tareas · ${nPend} ${nPend === 1 ? 'pendiente' : 'pendientes'}` : 'Tareas'}>
                <TareasDe
                  ficha={ficha}
                  onTareas={(tareas) => {
                    setFicha({ ...ficha, tareas })
                    onCambio?.()
                  }}
                />
              </Sec>
            ) : null}
          </>
        ) : pestana === 'formacion' ? (
          alumno ? (
            <>
              <Props>
                <Prop t="Estado">{alumno.estado.texto}</Prop>
                <Prop t="Última vez">{alumno.ultima_entrada ? cuando(alumno.ultima_entrada) : 'Nunca'}</Prop>
                <Prop t="Se quedó en">{alumno.donde ? `${alumno.donde.clase} · ${modulo(alumno.donde.modulo)}` : 'Todavía no ha abierto ninguna clase'}</Prop>
                <Prop t="Le falta">{alumno.siguiente ? `${modulo(alumno.siguiente.modulo)} · ${alumno.siguiente.clase}` : alumno.total ? 'Nada: ha terminado la formación' : '—'}</Prop>
                <Prop t="Avance">
                  {alumno.hechas} de {alumno.total} clases · {alumno.pct} %
                </Prop>
                <Prop t="Constancia">
                  Ha entrado {alumno.dias_que_entro} {alumno.dias_que_entro === 1 ? 'día' : 'días'} en total
                  {alumno.racha > 1 ? ` · racha de ${alumno.racha} días` : ''}
                </Prop>
                <Prop t="Recordatorio">
                  {alumno.ultimo_recordatorio
                    ? `${haceDias(alumno.ultimo_recordatorio.sent_at)}${alumno.ultimo_recordatorio.por ? `, por ${alumno.ultimo_recordatorio.por}` : ''}`
                    : 'Ninguno todavía'}
                </Prop>
                <Prop t="Resumen semanal">
                  {alumno.resumen?.baja
                    ? 'Se dio de baja: no lo recibe'
                    : alumno.resumen?.ultimo
                      ? `El último, ${haceDias(alumno.resumen.ultimo)}`
                      : 'Aún no ha recibido ninguno'}
                </Prop>
              </Props>
              <Sec titulo="Por módulo" extra={<span className="text-[#8A93A3]">{alumno.por_avance ? 'Se abren por avance: 80 % del anterior' : 'Por las fechas de la primera convocatoria'}</span>}>
                {modulos}
              </Sec>
              <Sec titulo="Lecturas de la semana">
                {alumno.lecturas?.length ? (
                  <ul>
                    {alumno.lecturas.slice(0, 8).map((l) => (
                      <li key={l.id} className="py-2 border-t border-[#F0F1F5] first:border-[#E6E8EE] flex items-baseline justify-between gap-3">
                        <span lang="nl" className="min-w-0 truncate">
                          {l.titulo}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          <b className="font-semibold" style={l.aciertos === l.total ? { color: VERDE } : undefined}>
                            {l.aciertos} de {l.total}
                          </b>
                          {l.veces && l.veces > 1 ? <span className="text-[12.5px] text-[#8A93A3]"> · {l.veces} veces, la mejor {l.mejor}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vacio>Aún no ha hecho los ejercicios de ninguna lectura.</Vacio>
                )}
              </Sec>
            </>
          ) : (
            <>
              <Vacio>
                No sale en el progreso de los alumnos: no tiene cuenta con este correo, no tiene el rol de alumno, está en el grupo Testers o está fuera de los números.
              </Vacio>
              {ficha?.avance ? <Sec titulo="Por módulo">{modulos}</Sec> : null}
            </>
          )
        ) : pestana === 'directo' ? (
          camino ? (
            <>
              <Props>
                <Prop t="Su camino">
                  Semana {Math.min(camino.semana || 0, 16)} de 16
                  {camino.estado === 'terminado' ? ' · terminado' : camino.estado === 'ultimas' ? ' · últimas semanas' : ''}
                </Prop>
                <Prop t="Entró">{dia(camino.entro)}</Prop>
                <Prop t="Termina">
                  {dia(camino.termina)}
                  {camino.dias_quedan !== null && camino.dias_quedan >= 0 ? <span className="text-[#8A93A3]"> · quedan {camino.dias_quedan} días</span> : null}
                </Prop>
                <Prop t="Grupos">{grupos || 'En ninguno'}</Prop>
              </Props>
              <Sec titulo="Clases a las que ha venido" extra={<span className="font-semibold tabular-nums">{camino.clases_directo}</span>}>
                {camino.clases_por_curso.length ? (
                  <ul>
                    {camino.clases_por_curso.map((c) => (
                      <li key={c.curso} className="py-2 border-t border-[#F0F1F5] first:border-[#E6E8EE] flex items-baseline justify-between gap-3">
                        <span>{c.curso}</span>
                        <span className="tabular-nums font-medium">{c.n}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vacio>Todavía no ha venido a ninguna clase en directo.</Vacio>
                )}
                <p className="text-[12.5px] text-[#8A93A3] mt-2">
                  Cuenta un día de clase si estuvo 10 minutos o más en la sala de la escuela, o si el profe la marcó al pasar lista.
                  {admin ? (
                    <>
                      {' '}
                      Semana a semana, en{' '}
                      <a href="/dash/estadisticas?tab=seguimiento" className={ENLACE}>
                        Seguimiento
                      </a>
                      .
                    </>
                  ) : null}
                </p>
              </Sec>
            </>
          ) : (
            <Vacio>{camino === undefined ? 'Cargando…' : 'No sale en el camino de 16 semanas (sin cuenta de alumno, en Testers o fuera de los números).'}</Vacio>
          )
        ) : pestana === 'pagos' ? (
          ficha ? (
            <>
              {admin ? (
                <Tira>
                  <Cifra pequena rotulo="Vendido" valor={euros(vendido)} nota={plan ? `en ${plan.cuotas} plazos` : 'un pago'} />
                  <Cifra pequena rotulo="Cobrado" valor={euros(cobrado)} nota="lo que ya ha entrado" />
                  <Cifra pequena rotulo="Por cobrar" valor={euros(Math.max(0, vendido - cobrado))} nota={vendido > cobrado ? 'plazos que faltan' : 'nada pendiente'} />
                </Tira>
              ) : null}
              {plan ? (
                <Sec titulo="Su plan de pagos">
                  <PlanPagosFicha key={plan.id} plan={plan} />
                </Sec>
              ) : null}
              {ficha.reserva?.estado === 'abierta' ? (
                <Sec titulo="Plaza con señal">
                  <ReservaPlaza email={ficha.email} nombre={ficha.nombre} telefono={ficha.telefono} reserva={ficha.reserva} esAlumno onCambio={(r) => setFicha({ ...ficha, reserva: r })} />
                </Sec>
              ) : null}
              <Sec titulo="Cada pago" extra={admin || !ficha.pagos.length ? undefined : <span className="font-semibold tabular-nums">Total pagado: {euros(pagado)}</span>}>
                {ficha.pagos.length ? (
                  <ul>
                    {ficha.pagos.map((p, i) => (
                      <li key={i} className="py-2 border-t border-[#F0F1F5] first:border-[#E6E8EE] flex items-baseline justify-between gap-3">
                        <span>
                          {p.producto === 'formacion-a0-a1' ? 'Formación A0-A1' : p.producto || 'Pago'}
                          <span className="text-[12.5px] text-[#8A93A3]"> · {dia(p.fecha)}</span>
                        </span>
                        <span className="tabular-nums font-medium">{euros(p.importe_cents)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vacio>No hay pagos apuntados con este correo.</Vacio>
                )}
                {admin ? (
                  <p className="text-[12.5px] text-[#8A93A3] mt-2">
                    Las facturas, en{' '}
                    <a href="/dash/estadisticas?tab=facturas" className={ENLACE}>
                      Facturas
                    </a>
                    .
                  </p>
                ) : null}
              </Sec>
            </>
          ) : (
            sinFicha
          )
        ) : ficha ? (
          <>
            <Sec titulo="De dónde vino">
              <PropsOrigen ficha={ficha} conPaginas={false} />
              <div className="mt-4">
                <Paginas ficha={ficha} />
              </div>
            </Sec>
            <Sec titulo={ficha.admision ? 'Lo que contestó antes de comprar' : 'Proceso de admisión'}>
              <Respuestas ficha={ficha} />
            </Sec>
            {ficha.black_friday || ficha.reto ? (
              <div className="mt-7 space-y-3">
                {ficha.black_friday ? <BloqueBlackFriday bf={ficha.black_friday} /> : null}
                {ficha.reto ? <BloqueReto reto={ficha.reto} /> : null}
              </div>
            ) : null}
            <Sec titulo="Llamadas">
              <ListaLlamadas
                ficha={ficha}
                onCambiarHora={setCambiarCita}
                onWhatsapp={(id, w) => setFicha({ ...ficha, llamadas: (ficha.llamadas || []).map((x) => (x.id === id ? { ...x, whatsapp: w } : x)) })}
              />
            </Sec>
            <Sec titulo="Todo lo que ha pasado">
              <LineaTiempo items={ficha.linea} />
            </Sec>
            <Sec titulo="Correos de la escuela">
              <Correos ficha={ficha} />
            </Sec>
            {ficha.systeme ? (
              <Sec titulo="En systeme.io">
                <Crm ficha={ficha} />
              </Sec>
            ) : null}
          </>
        ) : (
          sinFicha
        )}
      </Marco>
      {recordar && alumno && admin ? <RecordatorioModal alumno={alumno} onClose={() => setRecordar(false)} onEnviado={cargar} /> : null}
      {cambiarCita ? <NuevaLlamada cambiar={cambiarCita} onClose={() => setCambiarCita(null)} onHecho={refrescar} /> : null}
    </>
  )
}
