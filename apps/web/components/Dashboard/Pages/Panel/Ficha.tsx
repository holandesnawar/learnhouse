'use client'

/**
 * La ficha de una persona, según quién la abre y quién es (22/11/2026).
 *
 * Usuario: «cuando entra lead es una ficha, pero cuando es alumno debe ser
 * otra; ahora está todo junto y es un lío».
 * - Un ADMINISTRADOR ve las fichas nuevas: `FichaLead` si aún no ha pagado y
 *   `FichaAlumno` si ya es alumno.
 * - Los CLOSERS (y el resto del equipo) siguen con las de siempre, sin tocar:
 *   `FichaCliente` y la ficha de alumno de Progreso. Es semana de Black
 *   Friday: se les cambia cuando el usuario lo diga.
 *
 * Dos puertas: `Ficha` por correo (Matrículas, Contactos, Llamadas, Tareas,
 * Clientes, el inicio…) y `FichaDeAlumno` por su cuenta (Progreso, Usuarios,
 * Seguimiento, Camino).
 */

import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getAlumnosProgreso, getCamino, getFichaCliente, type AlumnoCamino, type AlumnoProgreso, type FichaCliente as DatosFicha } from '@services/panel/panel'
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

export default function Ficha(props: PropsDeFicha) {
  const { isAdmin } = useAdminStatus()
  if (!isAdmin) return <FichaCliente {...props} />
  return <FichaNueva {...props} />
}

export function FichaDeAlumno({ userId, nombre, onClose }: { userId: number; nombre?: string; onClose: () => void }) {
  const { isAdmin } = useAdminStatus()
  if (!isAdmin) return <FichaAlumnoDeSiempre userId={userId} nombre={nombre} onClose={onClose} />
  return <FichaNueva email="" userId={userId} nombre={nombre} onClose={onClose} />
}

function FichaNueva({ email: emailInicial, userId, nombre, onClose, onCambio, onCambioFecha, onQuitar, quitarEtiqueta }: PropsDeFicha & { userId?: number; nombre?: string }) {
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
    [org?.id, token, userId]
  )

  const leerAlumnos = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getAlumnosProgreso(org.id, token)
    setAlumnos(r.ok && r.datos ? r.datos.alumnos : [])
    getCamino(org.id, token).then((c) => setCamino(c.ok && c.datos ? c.datos.alumnos : null))
  }, [org?.id, token])

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
        onQuitar={onQuitar}
        quitarEtiqueta={quitarEtiqueta}
      />
    )
  }
  if (!ficha) return null
  return (
    <FichaLead ficha={ficha} setFicha={setFicha} cargar={cargar} onClose={onClose} onCambio={onCambio} onCambioFecha={onCambioFecha} onQuitar={onQuitar} quitarEtiqueta={quitarEtiqueta} />
  )
}
