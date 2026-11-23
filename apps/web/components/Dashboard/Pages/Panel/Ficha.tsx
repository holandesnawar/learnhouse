'use client'

/**
 * La ficha de una persona, según quién la abre y quién es (22/11/2026).
 *
 * Usuario: «cuando entra lead es una ficha, pero cuando es alumno debe ser
 * otra; ahora está todo junto y es un lío».
 * - Un ADMINISTRADOR ve las fichas nuevas: `FichaLead` si aún no ha pagado y
 *   `FichaAlumno` si ya es alumno.
 * - Los CLOSERS, desde el 23/11/2026, también («fichas también»), en «modo
 *   closer» (`admin={false}`): la misma ficha sin lo que es solo de
 *   administradores. Del lead: sin borrar ni quitar de los números (salvo que
 *   la pantalla de fuera traiga su propio «quitar») y sin systeme.io (el
 *   servidor no se lo manda). Del alumno: sin vendido / por cobrar ni
 *   comisión (el servidor tampoco se los manda), sin «Acceso» (contraseña,
 *   correo, ver como), sin «Mandar recordatorio» y sin abrir módulos a mano.
 *   Su fila de Progreso y su camino los pide por `getAlumnoDeFicha`, UNA
 *   persona y sin dinero: `getAlumnosProgreso` y `getCamino` son solo de
 *   administradores y a un closer le dan 403.
 * - El resto del equipo (profes: no tienen panel) sigue con las de siempre.
 *
 * Dos puertas: `Ficha` por correo (Matrículas, Contactos, Llamadas, Tareas,
 * Clientes, el inicio…) y `FichaDeAlumno` por su cuenta (Progreso, Usuarios,
 * Seguimiento, Camino). `FichaDeAlumno` solo cambia para administradores: las
 * pantallas que la abren son de administradores o de profes.
 */

import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getAlumnoDeFicha, getAlumnosProgreso, getCamino, getFichaCliente, type AlumnoCamino, type AlumnoProgreso, type FichaCliente as DatosFicha } from '@services/panel/panel'
import type { VolverALlamar } from '@services/stats/contactos'
import FichaCliente from './FichaCliente'
import FichaLead from './FichaLead'
import FichaAlumno from './FichaAlumno'
import { Marco } from './FichaPiezas'

// La ficha de alumno de siempre vive en ProgresoPanel, que a su vez abre esta
// ficha: se carga aparte para no hacer un círculo entre los dos archivos.
const FichaAlumnoDeSiempre = dynamic(() => import('./ProgresoPanel').then((m) => m.FichaAlumno), { ssr: false })

export interface PropsDeFicha {
  email: string
  onClose: () => void
  /** Para que la lista de fuera se refresque (tablero, contactos). */
  onCambio?: () => void
  onCambioFecha?: (email: string, v: VolverALlamar | null) => void
  /** Solo si quien la abre trae su propio «borrar» (Contactos). */
  onQuitar?: () => void
  quitarEtiqueta?: string
}

/**
 * VUELTA ATRÁS. Con `false`, los closers vuelven a la ficha de siempre
 * (`FichaCliente`), tal cual estaba antes del 23/11/2026, sin tocar nada más.
 * Los administradores no cambian con esto.
 */
export const FICHAS_NUEVAS_PARA_CLOSERS = true

export default function Ficha(props: PropsDeFicha) {
  const { isAdmin, isCloser } = useAdminStatus()
  if (isAdmin) return <FichaNueva {...props} admin />
  if (isCloser && FICHAS_NUEVAS_PARA_CLOSERS) return <FichaNueva {...props} admin={false} />
  return <FichaCliente {...props} />
}

export function FichaDeAlumno({ userId, nombre, onClose }: { userId: number; nombre?: string; onClose: () => void }) {
  const { isAdmin } = useAdminStatus()
  if (!isAdmin) return <FichaAlumnoDeSiempre userId={userId} nombre={nombre} onClose={onClose} />
  return <FichaNueva email="" userId={userId} nombre={nombre} onClose={onClose} admin />
}

function FichaNueva({
  email: emailInicial,
  userId,
  nombre,
  onClose,
  onCambio,
  onCambioFecha,
  onQuitar,
  quitarEtiqueta,
  admin,
}: PropsDeFicha & { userId?: number; nombre?: string; admin: boolean }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [email, setEmail] = useState((emailInicial || '').trim().toLowerCase())
  const [ficha, setFicha] = useState<DatosFicha | null>(null)
  // 'sin' = no hay rastro de venta con ese correo (una cuenta de alumno dada a mano).
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'sin' | 'error'>('cargando')
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [alumnos, setAlumnos] = useState<AlumnoProgreso[] | null>(null)
  const [camino, setCamino] = useState<AlumnoCamino[] | null | undefined>(undefined)
  // La cuenta encontrada por su correo cuando no hay rastro de venta.
  const [cuenta, setCuenta] = useState(0)

  const leerFicha = useCallback(
    async (correo: string) => {
      if (!org?.id || !token || !correo) return
      const r = await getFichaCliente(org.id, correo, token)
      if (r.ok && r.datos) {
        setFicha(r.datos)
        setEstado('ok')
      } else if (userId) {
        // Abierta por su cuenta: sin rastro de venta, la ficha del alumno sale igual.
        setEstado('sin')
      } else if (!admin) {
        // Modo closer. Sin rastro de venta, pero puede ser un alumno al que se
        // le dio la cuenta a mano: se pregunta por ESA persona (la lista entera
        // es solo de administradores). Si el closer no la ve, el servidor da
        // 403 y sale el motivo de la ficha.
        const uno = await getAlumnoDeFicha(org.id, correo, token)
        if (uno.ok && uno.datos?.alumno) {
          setAlumnos([uno.datos.alumno])
          setCamino(uno.datos.camino ? [uno.datos.camino] : null)
          setCuenta(uno.datos.alumno.user_id)
          setEstado('sin')
        } else {
          setError(r.error || 'No se ha podido cargar')
          setEstado('error')
        }
      } else {
        // Sin rastro de venta con ese correo, pero puede ser un alumno (una
        // cuenta dada a mano, o que entra con otro correo): se busca en Progreso.
        const lista = await getAlumnosProgreso(org.id, token)
        const a = lista.ok && lista.datos ? lista.datos.alumnos.find((x) => x.email.trim().toLowerCase() === correo) : null
        if (a && lista.datos) {
          setAlumnos(lista.datos.alumnos)
          setCuenta(a.user_id)
          setEstado('sin')
          getCamino(org.id, token).then((c) => setCamino(c.ok && c.datos ? c.datos.alumnos : null))
        } else {
          setError(r.error || 'No se ha podido cargar')
          setEstado('error')
        }
      }
    },
    [org?.id, token, userId, admin]
  )

  const leerAlumnos = useCallback(async () => {
    if (!org?.id || !token) return
    if (!admin) {
      // Modo closer: solo esta persona, y sin dinero. Si falla, la ficha sale
      // igual con lo que trae `/cliente` (su avance por módulos y sus pagos).
      if (!email) return
      const uno = await getAlumnoDeFicha(org.id, email, token)
      setAlumnos(uno.ok && uno.datos?.alumno ? [uno.datos.alumno] : [])
      setCamino(uno.ok && uno.datos?.camino ? [uno.datos.camino] : null)
      return
    }
    const r = await getAlumnosProgreso(org.id, token)
    setAlumnos(r.ok && r.datos ? r.datos.alumnos : [])
    getCamino(org.id, token).then((c) => setCamino(c.ok && c.datos ? c.datos.alumnos : null))
  }, [org?.id, token, admin, email])

  // Por correo: la ficha. Por su cuenta: primero quién es, y de ahí su correo.
  useEffect(() => {
    setFicha(null)
    setEstado('cargando')
    setError('')
    if (email) leerFicha(email)
  }, [email, leerFicha])
  useEffect(() => {
    if (userId) leerAlumnos()
  }, [userId, leerAlumnos])
  useEffect(() => {
    if (!userId || !alumnos || email) return
    const a = alumnos.find((x) => x.user_id === userId)
    if (a) setEmail(a.email.trim().toLowerCase())
    else {
      // No es un fallo: es alguien que no es alumno. Se dice en gris.
      setAviso(
        'No sale en el progreso de los alumnos: no tiene el rol de alumno, está en el grupo Testers o está fuera de los números. Por eso no se le puede abrir la ficha de alumno.'
      )
      setEstado('error')
    }
  }, [userId, alumnos, email])

  const idCuenta = userId || cuenta
  const esAlumno = Boolean(idCuenta) || ficha?.tablero.etapa === 'alumno'
  // Ya es alumno y se abrió por correo: hace falta su fila de Progreso.
  useEffect(() => {
    if (esAlumno && !idCuenta && alumnos === null) leerAlumnos()
  }, [esAlumno, idCuenta, alumnos, leerAlumnos])

  const cargar = useCallback(() => {
    if (email) leerFicha(email)
    if (esAlumno) leerAlumnos()
  }, [email, esAlumno, leerFicha, leerAlumnos])

  const esperando = estado === 'cargando' || (esAlumno && alumnos === null)
  if (estado === 'error' || esperando) {
    return (
      <Marco
        nombre={ficha?.nombre || nombre || email || 'Ficha'}
        pestanas={[{ id: 'resumen', nombre: 'Resumen' }]}
        pestana="resumen"
        onPestana={() => {}}
        onClose={onClose}
        cargando={estado !== 'error'}
        error={estado === 'error' ? error : ''}
        aviso={estado === 'error' ? aviso : ''}
      />
    )
  }

  if (esAlumno) {
    const alumno =
      (alumnos || []).find((a) => (idCuenta ? a.user_id === idCuenta : ficha?.user_id ? a.user_id === ficha.user_id : a.email.trim().toLowerCase() === email)) || null
    const suCamino = camino === undefined ? undefined : alumno ? (camino || []).find((c) => c.user_id === alumno.user_id) || null : null
    return (
      <FichaAlumno
        ficha={ficha}
        setFicha={setFicha}
        cargar={cargar}
        alumno={alumno}
        camino={suCamino}
        nombre={nombre || ''}
        email={email}
        onClose={onClose}
        onCambio={onCambio}
        onCambioFecha={onCambioFecha}
        onQuitar={onQuitar}
        quitarEtiqueta={quitarEtiqueta}
        admin={admin}
      />
    )
  }
  if (!ficha) return null
  return (
    <FichaLead
      ficha={ficha}
      setFicha={setFicha}
      cargar={cargar}
      onClose={onClose}
      onCambio={onCambio}
      onCambioFecha={onCambioFecha}
      onQuitar={onQuitar}
      quitarEtiqueta={quitarEtiqueta}
      admin={admin}
    />
  )
}
