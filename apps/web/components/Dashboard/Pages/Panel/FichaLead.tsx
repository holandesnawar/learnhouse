'use client'

/**
 * La ficha de un LEAD (22/11/2026): alguien que aún no ha pagado. Todo gira
 * en torno a venderle: qué toca hacer ahora, las notas, en qué etapa está,
 * quién la lleva, de dónde vino y qué nos contó.
 *
 * La ven los administradores y, desde el 23/11/2026, los closers (ver
 * `Ficha.tsx`). Con `admin={false}` (closer) no salen borrar, quitar de los
 * números ni «Borrar su rastro»: sus rutas son solo de administradores. Lo
 * demás es igual; systeme.io y el total de una señal ya los decide el
 * servidor y `ReservaPlaza`. Hace lo mismo que la ficha de siempre
 * (`FichaCliente.tsx`), recolocado:
 * - Cabecera: WhatsApp, Agendar llamada, Enlace de pago (pago único o Klarna,
 *   plazos, otro importe y la señal) y «⋯» (llamar, correo, editar, mandar a
 *   Llamadas, borrar o quitar de los números).
 * - Resumen: el siguiente paso, las notas con «Volver a llamar», los intentos
 *   de contacto, la plaza con señal, las tareas y lo último que ha pasado.
 * - Actividad: todo lo que ha pasado, los correos de la escuela y systeme.io.
 * - Llamadas: sus llamadas de Calendly con sus tres WhatsApp.
 * - Respuestas: el proceso de admisión, Black Friday y el reto de 7 días.
 * - Lateral: Venta (etapa, closer, canal, si vio el precio), Contacto, De
 *   dónde viene y Lo que nos contó.
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { CalendarPlus, ChevronDown, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import { colorCloser } from '@lib/nawar/colorCloser'
import { avisoTrasBorrar, borrarContacto, cuandoLlamar, hoyISO, mandarATemplada, ponerRecordatorio, type Cita, type VolverALlamar } from '@services/stats/contactos'
import { CANALES, asignarCloser, euros, fechaCorta, haceCuanto, moverTarjeta, type Canal, type EtapaTablero, type FichaCliente as Ficha } from '@services/panel/panel'
import EditarDatos from './EditarDatos'
import EnlacePago from './EnlacePago'
import IntentosContacto from './IntentosContacto'
import NuevaLlamada from './NuevaLlamada'
import ReservaPlaza from './ReservaPlaza'
import SecuenciaWhatsApp from './SecuenciaWhatsApp'
import { BloqueBlackFriday, BloqueReto } from './FichaCliente'
import { aQuienRepartir, nombreCorto, useReparto } from './Reparto'
import { quitarPersona } from './quitarPersona'
import {
  Correos,
  Crm,
  Desplegable,
  Eleccion,
  EnlaceVideo,
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
  PropLarga,
  Props,
  PropsOrigen,
  Respuestas,
  Sec,
  TareasDe,
  VolverALlamarBoton,
  citaPorVenir,
  cuandoCita,
  tareasPendientes,
} from './FichaPiezas'
import { AMBAR, BOTON, BOTON_PRINCIPAL, BOTON_TEXTO, ENLACE, ROJO, VERDE } from './ui'

// Las columnas de las dos mesas, con el nombre que se lee en el tablero.
const ETAPAS: { id: EtapaTablero; nombre: string }[] = [
  { id: 'nuevo', nombre: 'Nuevo' },
  { id: 'llamar', nombre: 'Por llamar' },
  { id: 'no-contesta', nombre: 'No contesta' },
  { id: 'contactado', nombre: 'Contactado' },
  { id: 'agendado', nombre: 'Agendada' },
  { id: 'no-show', nombre: 'No show' },
  { id: 'seguimiento', nombre: 'Seguimiento' },
  { id: 'pendiente-pago', nombre: 'Por pagar' },
  { id: 'descartado', nombre: 'Descartado' },
]

const TEMPERATURA: Record<string, { nombre: string; color: string }> = {
  caliente: { nombre: 'caliente', color: ROJO },
  templado: { nombre: 'templado', color: AMBAR },
  frio: { nombre: 'frío', color: VERDE },
}

export interface PropsFicha {
  ficha: Ficha
  setFicha: (f: Ficha) => void
  cargar: () => void
  onClose: () => void
  onCambio?: () => void
  onCambioFecha?: (email: string, v: VolverALlamar | null) => void
  /** Solo si quien abre la ficha trae su propio «borrar» (Contactos). */
  onQuitar?: () => void
  quitarEtiqueta?: string
  /** `false` = la mira un closer: sin lo que es solo de administradores. */
  admin: boolean
}

export default function FichaLead({ ficha, setFicha, cargar, onClose, onCambio, onCambioFecha, onQuitar, quitarEtiqueta = 'Borrar', admin }: PropsFicha) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const reparto = useReparto()
  const [pestana, setPestana] = useState('resumen')
  const [agendar, setAgendar] = useState(false)
  const [cambiarCita, setCambiarCita] = useState<Cita | null>(null)
  const [editando, setEditando] = useState(false)
  const [menu, setMenu] = useState(false)

  const t = ficha.tablero
  const tel = numeroWhatsApp(ficha.telefono)

  async function mover(etapa: EtapaTablero, canal?: Canal) {
    const r = await moverTarjeta(org?.id, { email: ficha.email, etapa, canal, nombre: ficha.nombre, telefono: ficha.telefono }, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido mover')
    setFicha({ ...ficha, tablero: { ...t, etapa, canal: canal ?? t.canal } })
    onCambio?.()
    // Salir de Nuevo la marca como hecha en Llamadas: se relee para enseñarlo.
    cargar()
  }

  async function darCloser(id: number) {
    const m = reparto.equipo.find((x) => x.id === id)
    const mesa = t.mesa === 'ventas' ? 'ventas' : 'leads'
    const r = await asignarCloser(org?.id, ficha.email, id, token, mesa)
    if (!r.ok) return toast.error(r.error || 'No se ha podido asignar')
    if (!m) toast.success(mesa === 'leads' ? 'Sin closer' : 'Vuelve a «Por asignar»')
    else if (m.id === reparto.yo) toast.success('Para ti')
    else toast.success(r.datos?.avisado ? `Para ${nombreCorto(m.nombre)}: le ha llegado un correo` : `Para ${nombreCorto(m.nombre)}`)
    setFicha({ ...ficha, tablero: { ...t, closer_id: id, closer: m?.nombre ?? '' } })
    onCambio?.()
  }

  function fechaCambiada(v: VolverALlamar | null) {
    setFicha({ ...ficha, volver_a_llamar: v })
    onCambioFecha?.(ficha.email, v)
    onCambio?.()
  }

  async function quitarFecha() {
    const r = await ponerRecordatorio(org?.id, ficha.email, '', '', token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
    toast.success('Hecho: fecha quitada')
    fechaCambiada(null)
  }

  async function mandarALlamadas() {
    const r = await mandarATemplada(org?.id, { email: ficha.email, nombre: ficha.nombre, telefono: ficha.telefono }, token)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido mandar')
    toast.success('En Llamadas, pendiente: vuelve a Nuevo o Por llamar')
    onCambio?.()
    cargar()
  }

  async function quitar() {
    if (onQuitar) return onQuitar()
    const r = await quitarPersona(org?.id, token, { email: ficha.email, nombre: ficha.nombre, esAlumno: false, fuera: ficha.fuera_de_metricas })
    if (!r) return
    onCambio?.()
    if (r === 'borrado' || r === 'fuera') onClose()
    else setFicha({ ...ficha, fuera_de_metricas: false })
  }

  async function borrarRastro() {
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

  // ── El siguiente paso ────────────────────────────────────────────────────
  const proxima = [...(ficha.llamadas || [])].filter(citaPorVenir).sort((a, b) => a.inicio.localeCompare(b.inicio))[0]
  const sinApuntar = (ficha.llamadas || []).find((c) => c.estado !== 'cancelada' && !c.resultado && new Date(c.fin || c.inicio).getTime() < Date.now())
  const v = ficha.volver_a_llamar
  const hoy = hoyISO()
  let paso: React.ReactNode = null
  if (proxima) {
    paso = (
      <Paso
        color={proxima.confirmada ? VERDE : '#C28A1A'}
        titulo={`Llamada el ${cuandoCita(proxima.inicio)}`}
        detalle={
          <>
            {proxima.confirmada ? 'Confirmada' : 'Sin confirmar'}
            {proxima.closer ? ` · la lleva ${proxima.closer}` : ''}
            <span className="block mt-1">
              <EnlaceVideo c={proxima} />
            </span>
          </>
        }
        debajo={
          <SecuenciaWhatsApp
            conMeet={false}
            cita={{ ...proxima, nombre: ficha.nombre || proxima.nombre, telefono: proxima.telefono || ficha.telefono }}
            onCambio={(w) => setFicha({ ...ficha, llamadas: (ficha.llamadas || []).map((x) => (x.id === proxima.id ? { ...x, whatsapp: w } : x)) })}
          />
        }
      >
        <button onClick={() => setCambiarCita({ ...proxima, nombre: proxima.nombre || ficha.nombre, telefono: proxima.telefono || ficha.telefono })} className={BOTON}>
          Cambiar hora
        </button>
      </Paso>
    )
  } else if (sinApuntar) {
    paso = (
      <Paso color={ROJO} titulo="Falta apuntar qué pasó en su llamada" detalle={`La del ${cuandoCita(sinApuntar.inicio)}. Se apunta en Llamadas.`}>
        <a href="/dash/estadisticas?tab=llamadas" className={BOTON}>
          Abrir Llamadas
        </a>
      </Paso>
    )
  } else if (v) {
    const toca = v.fecha <= hoy
    paso = (
      <Paso
        color={toca ? ROJO : '#C5CAD6'}
        titulo={v.fecha < hoy ? `Había que llamarla ${cuandoLlamar(v.fecha)}` : `Volver a llamar ${cuandoLlamar(v.fecha)}`}
        detalle={
          <>
            {v.motivo ? `«${v.motivo}»` : 'Sin motivo apuntado'}
            {v.autor ? ` · lo apuntó ${nombreCorto(v.autor)}` : ''}
          </>
        }
      >
        <button onClick={quitarFecha} className={BOTON}>
          Hecho
        </button>
        <VolverALlamarBoton email={ficha.email} volver={v} onFecha={fechaCambiada} etiqueta="Cambiar fecha" clase={BOTON_TEXTO} />
      </Paso>
    )
  } else if (ficha.reserva?.estado === 'abierta') {
    paso = (
      <Paso
        color="#C28A1A"
        titulo={`Plaza reservada: le faltan ${euros(ficha.reserva.pendiente_cents)}`}
        detalle={`Ha pagado ${euros(ficha.reserva.pagado_cents)} de ${euros(ficha.reserva.total_cents)}. Entra en la escuela cuando lo complete.`}
      />
    )
  } else if (t.etapa === 'nuevo' || t.etapa === 'llamar' || t.etapa === 'no-contesta') {
    paso = (
      <Paso
        color={t.temperatura === 'caliente' ? ROJO : '#C28A1A'}
        titulo={t.etapa === 'no-contesta' ? 'Volver a intentarlo: no contestó' : 'Llamarla: aún no se ha hablado con ella'}
        detalle={ficha.templada?.estado === 'pendiente' ? 'Está pendiente en la lista de Llamadas.' : `Entró ${haceCuanto(t.llegada || t.desde)}.`}
      >
        {tel ? (
          <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className={BOTON}>
            Escribirle
          </a>
        ) : null}
        <button onClick={() => setAgendar(true)} className={BOTON}>
          Agendar llamada
        </button>
      </Paso>
    )
  } else if (t.etapa === 'descartado') {
    paso = <Paso color="#C5CAD6" titulo="Descartada" detalle={t.movido_por ? `La movió ${t.movido_por} ${haceCuanto(t.desde)}.` : `Desde ${haceCuanto(t.desde)}.`} />
  } else {
    paso = (
      <Paso color="#C5CAD6" titulo="Nada pendiente con fecha" detalle="Si has quedado en volver a hablar, ponle fecha: te saldrá en «Para llamar hoy».">
        <VolverALlamarBoton email={ficha.email} volver={null} onFecha={fechaCambiada} />
      </Paso>
    )
  }

  const temp = t.temperatura ? TEMPERATURA[t.temperatura] : null
  const estado = (
    <>
      Lead · entró {haceCuanto(t.llegada || ficha.primer_contacto?.when || t.desde)}
      {temp && (t.etapa === 'nuevo' || t.etapa === 'llamar' || t.etapa === 'no-contesta') ? (
        <>
          {' · '}
          <span style={{ color: temp.color }}>{temp.nombre}</span>
        </>
      ) : null}
      {ficha.fuera_de_metricas ? ' · fuera de los números' : ''}
    </>
  )

  const closers = aQuienRepartir(reparto.equipo, reparto.yo)
  const opcionesCloser = [
    { id: 0, nombre: 'Sin closer' },
    ...closers.map((m) => ({ id: m.id, nombre: m.id === reparto.yo ? `${nombreCorto(m.nombre)} (yo)` : nombreCorto(m.nombre) })),
    // Quien la lleva ya no está entre los closers de ahora: que se siga viendo.
    ...(t.closer_id && !closers.some((m) => m.id === t.closer_id) ? [{ id: t.closer_id, nombre: nombreCorto(t.closer || 'Otro') }] : []),
  ]
  const nPend = tareasPendientes(ficha)
  const conIntentos = ficha.intentos && (t.etapa === 'contactado' || ficha.intentos.nivel > 0)
  const atajos = ['Va a pagar', 'Lo piensa', 'No contesta']
  // Borrar y quitar de los números: administradores, o la pantalla de fuera
  // si trae su propio «quitar» (hoy solo se lo pasa a administradores). La
  // misma regla que la ficha de siempre.
  const puedeQuitar = admin || Boolean(onQuitar)
  // Con una señal ya cobrada, la plaza va a la vista en el Resumen (como en la
  // ficha de siempre) y no escondida en el desplegable.
  const conSenal = ficha.reserva?.estado === 'abierta'
  const plaza = (
    <ReservaPlaza
      email={ficha.email}
      nombre={ficha.nombre}
      telefono={ficha.telefono}
      reserva={ficha.reserva}
      esAlumno={false}
      onCambio={(r) => {
        setFicha({ ...ficha, reserva: r })
        onCambio?.()
      }}
    />
  )

  const acciones = (
    <>
      {tel ? (
        <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className={BOTON}>
          <MessageCircle size={14} /> WhatsApp
        </a>
      ) : null}
      <button onClick={() => setAgendar(true)} className={BOTON}>
        <CalendarPlus size={14} /> Agendar llamada
      </button>
      <Desplegable
        boton={
          <>
            Enlace de pago <ChevronDown size={13} />
          </>
        }
        clase={BOTON_PRINCIPAL}
        ancho={400}
        mantener
        titulo="Crear un enlace de pago"
        onAbierto={setMenu}
      >
        <div className="p-2.5 space-y-3">
          <EnlacePago email={ficha.email} nombre={ficha.nombre} telefono={ficha.telefono} />
          {conSenal ? (
            <p className="pt-3 border-t border-[#F0F1F5] text-[12.5px] text-[#8A93A3]">Ya tiene una plaza reservada con señal: el enlace por lo que falta está en el Resumen.</p>
          ) : (
            <div className="pt-3 border-t border-[#F0F1F5]">{plaza}</div>
          )}
        </div>
      </Desplegable>
      <MenuMas onAbierto={setMenu}>
        {(cerrar) => (
          <>
            {tel ? <Opcion href={`tel:+${tel}`}>Llamar por teléfono</Opcion> : null}
            <Opcion href={`mailto:${ficha.email}`}>Escribirle un correo</Opcion>
            <Opcion
              onClick={() => {
                cerrar()
                setEditando(true)
              }}
            >
              {ficha.telefono ? 'Corregir nombre o teléfono' : 'Añadir su teléfono'}
            </Opcion>
            {ficha.templada?.estado === 'pendiente' ? null : (
              <Opcion
                onClick={() => {
                  cerrar()
                  mandarALlamadas()
                }}
              >
                Mandar a Llamadas
              </Opcion>
            )}
            {puedeQuitar ? <div className="my-1 border-t border-[#F0F1F5]" /> : null}
            {!puedeQuitar ? null : ficha.fuera_de_metricas ? (
              <>
                <Opcion
                  onClick={() => {
                    cerrar()
                    quitar()
                  }}
                >
                  Volver a contar en los números
                </Opcion>
                <Opcion
                  peligro
                  onClick={() => {
                    cerrar()
                    borrarRastro()
                  }}
                >
                  Borrar su rastro
                </Opcion>
              </>
            ) : (
              <Opcion
                peligro
                onClick={() => {
                  cerrar()
                  quitar()
                }}
              >
                {onQuitar ? quitarEtiqueta : 'Borrar'}
              </Opcion>
            )}
          </>
        )}
      </MenuMas>
    </>
  )

  const lateral = (
    <>
      <LadoTitulo>Venta</LadoTitulo>
      <Props>
        <Prop t="Etapa">
          <Eleccion etiqueta="Etapa" fuerte valor={t.etapa} opciones={ETAPAS} onChange={(e) => mover(e)} />
        </Prop>
        <Prop t="Closer">
          <Eleccion
            etiqueta="Closer"
            valor={t.closer_id || 0}
            opciones={opcionesCloser}
            punto={t.closer_id ? colorCloser(t.closer_id, reparto.equipo, t.closer || '') : undefined}
            onChange={darCloser}
          />
        </Prop>
        <Prop t="Hablando por">
          <Eleccion etiqueta="Por dónde se le habla" valor={t.canal || ''} opciones={[{ id: '' as Canal, nombre: 'Sin apuntar' }, ...CANALES]} onChange={(c) => mover(t.etapa, c)} />
        </Prop>
        <Prop t="Vio el precio">
          {ficha.vio_precio ? 'Sí' : 'No'}
          {ficha.vio_precio && ficha.precio_por ? <span className="block text-[12.5px] text-[#8A93A3]">{ficha.precio_por}</span> : null}
        </Prop>
        <Prop t="Aquí desde">
          {haceCuanto(t.desde)}
          {t.movido_por ? <span className="block text-[12.5px] text-[#8A93A3]">la movió {nombreCorto(t.movido_por)}</span> : null}
        </Prop>
        {ficha.templada?.estado === 'pendiente' ? <Prop t="Llamadas">Pendiente en la lista</Prop> : null}
      </Props>

      <LadoTitulo
        extra={
          <button onClick={() => setEditando((x) => !x)} className={ENLACE}>
            {ficha.telefono ? 'Editar' : 'Añadir teléfono'}
          </button>
        }
      >
        Contacto
      </LadoTitulo>
      <Props>
        <Prop t="Correo">
          <a href={`mailto:${ficha.email}`} className="hover:underline">
            {ficha.email}
          </a>
        </Prop>
        <Prop t="WhatsApp">
          {tel ? (
            <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="tabular-nums hover:underline">
              {ficha.telefono}
            </a>
          ) : (
            <span className="text-[#8A93A3]">No lo tenemos</span>
          )}
        </Prop>
      </Props>

      <LadoTitulo>De dónde viene</LadoTitulo>
      <PropsOrigen ficha={ficha} />

      <LadoTitulo
        extra={
          ficha.admision?.respuestas.length ? (
            <button onClick={() => setPestana('respuestas')} className={ENLACE}>
              Ver todo
            </button>
          ) : null
        }
      >
        Lo que nos contó
      </LadoTitulo>
      {ficha.admision ? (
        <div className="space-y-2.5">
          <p className="text-[13.5px]">{ficha.admision.resumen}</p>
          {ficha.admision.respuestas.slice(0, 4).map((r, i) => (
            <PropLarga key={i} t={r.pregunta}>
              {r.respuesta}
            </PropLarga>
          ))}
        </div>
      ) : ficha.reto ? (
        <Props>
          <Prop t="Para qué">{ficha.reto.motivo}</Prop>
          <Prop t="Trabaja de">{ficha.reto.trabajo}</Prop>
          <Prop t="Nivel">{ficha.reto.nivel}</Prop>
        </Props>
      ) : (
        <p className="text-[13.5px] text-[#8A93A3]">No ha contestado las preguntas de admisión.</p>
      )}

      {ficha.black_friday ? (
        <>
          <LadoTitulo
            extra={
              <button onClick={() => setPestana('respuestas')} className={ENLACE}>
                Ver
              </button>
            }
          >
            Black Friday
          </LadoTitulo>
          <p className="text-[13.5px]">{ficha.black_friday.titulo}</p>
          {ficha.black_friday.campana ? <p className="text-[12.5px] text-[#8A93A3]">Correos de systeme.io: «{ficha.black_friday.campana}»</p> : null}
        </>
      ) : null}
      {ficha.reto && ficha.admision ? (
        <>
          <LadoTitulo
            extra={
              <button onClick={() => setPestana('respuestas')} className={ENLACE}>
                Ver
              </button>
            }
          >
            Reto de 7 días
          </LadoTitulo>
          <p className="text-[13.5px]">
            {ficha.reto.hechos} de {ficha.reto.de} días hechos{ficha.reto.pulso_llamada ? ' · pulsó el botón de la llamada' : ''}
          </p>
        </>
      ) : null}
    </>
  )

  return (
    <>
      <Marco
        nombre={ficha.nombre || ficha.email}
        estado={estado}
        acciones={acciones}
        bajoCabecera={
          editando ? (
            <EditarDatos
              email={ficha.email}
              nombre={ficha.nombre}
              telefono={ficha.telefono}
              onCancelar={() => setEditando(false)}
              onGuardado={() => {
                setEditando(false)
                cargar()
                onCambio?.()
              }}
            />
          ) : null
        }
        pestanas={[
          { id: 'resumen', nombre: 'Resumen' },
          { id: 'actividad', nombre: 'Actividad', n: ficha.linea.length },
          { id: 'llamadas', nombre: 'Llamadas', n: ficha.llamadas?.length || null },
          { id: 'respuestas', nombre: 'Respuestas' },
        ]}
        pestana={pestana}
        onPestana={setPestana}
        onClose={onClose}
        bloqueado={agendar || !!cambiarCita || menu}
        lateral={lateral}
      >
        {pestana === 'resumen' ? (
          <>
            {paso}
            <Sec titulo="Notas">
              <Notas
                email={ficha.email}
                notas={ficha.notas}
                volver={ficha.volver_a_llamar}
                atajos={atajos}
                onNotas={(n) => {
                  setFicha({ ...ficha, notas: n })
                  onCambio?.()
                }}
                onFecha={fechaCambiada}
              />
            </Sec>
            {conIntentos && ficha.intentos ? (
              <div className="mt-7">
                <IntentosContacto
                  orgId={org?.id}
                  token={token}
                  email={ficha.email}
                  datos={ficha.intentos}
                  onCambio={() => {
                    cargar()
                    onCambio?.()
                  }}
                  onDescartar={() => mover('descartado')}
                />
              </div>
            ) : null}
            {conSenal ? <Sec titulo="Plaza reservada con señal">{plaza}</Sec> : null}
            {ficha.pagos.length ? (
              <Sec titulo="Lo que ha pagado" extra={<span className="font-semibold tabular-nums">{euros(ficha.total_pagado_cents)}</span>}>
                <ul>
                  {ficha.pagos.map((p, i) => (
                    <li key={i} className="py-2 border-t border-[#F0F1F5] first:border-[#E6E8EE] flex items-baseline justify-between gap-3">
                      <span>
                        {p.producto === 'formacion-a0-a1' ? 'Formación A0-A1' : p.producto || 'Pago'}
                        <span className="text-[12.5px] text-[#8A93A3]"> · {fechaCorta(p.fecha)}</span>
                      </span>
                      <span className="tabular-nums font-medium">{euros(p.importe_cents)}</span>
                    </li>
                  ))}
                </ul>
              </Sec>
            ) : null}
            <Sec titulo={nPend ? `Tareas · ${nPend} ${nPend === 1 ? 'pendiente' : 'pendientes'}` : 'Tareas'}>
              <TareasDe
                ficha={ficha}
                onTareas={(tareas) => {
                  setFicha({ ...ficha, tareas })
                  onCambio?.()
                }}
              />
            </Sec>
            <Sec
              titulo="Lo último"
              extra={
                ficha.linea.length > 6 ? (
                  <button onClick={() => setPestana('actividad')} className={ENLACE}>
                    Ver toda la actividad
                  </button>
                ) : null
              }
            >
              <LineaTiempo items={ficha.linea} max={6} />
            </Sec>
          </>
        ) : pestana === 'actividad' ? (
          <>
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
        ) : pestana === 'llamadas' ? (
          <Sec
            titulo="Llamadas"
            extra={
              <button onClick={() => setAgendar(true)} className={ENLACE}>
                Agendar llamada
              </button>
            }
          >
            <ListaLlamadas
              ficha={ficha}
              onCambiarHora={setCambiarCita}
              onWhatsapp={(id, w) => setFicha({ ...ficha, llamadas: (ficha.llamadas || []).map((x) => (x.id === id ? { ...x, whatsapp: w } : x)) })}
            />
          </Sec>
        ) : (
          <>
            <Sec titulo={ficha.admision ? (ficha.admision.terminado ? 'Proceso de admisión · terminado' : 'Proceso de admisión · a medias') : 'Proceso de admisión'}>
              <Respuestas ficha={ficha} />
            </Sec>
            <Sec titulo="Las páginas que vio">
              <Paginas ficha={ficha} />
            </Sec>
            {ficha.black_friday || ficha.reto ? (
              <div className="mt-7 space-y-3">
                {ficha.black_friday ? <BloqueBlackFriday bf={ficha.black_friday} /> : null}
                {ficha.reto ? <BloqueReto reto={ficha.reto} /> : null}
              </div>
            ) : null}
          </>
        )}
      </Marco>
      {cambiarCita ? (
        <NuevaLlamada
          cambiar={cambiarCita}
          onClose={() => setCambiarCita(null)}
          onHecho={() => {
            cargar()
            onCambio?.()
          }}
        />
      ) : null}
      {agendar ? (
        <NuevaLlamada
          inicial={{ nombre: ficha.nombre, email: ficha.email, telefono: ficha.telefono }}
          onClose={() => setAgendar(false)}
          onHecho={() => {
            cargar()
            onCambio?.()
          }}
        />
      ) : null}
    </>
  )
}
