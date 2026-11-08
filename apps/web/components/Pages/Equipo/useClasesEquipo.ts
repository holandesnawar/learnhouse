'use client'
/**
 * Las clases en directo con todas sus semanas, para la sala de profes
 * (08/11/2026). Lee lo mismo que «Preparar clases» (`ClasesProfes`): las
 * clases, sus semanas, las grabaciones de antes sin semana, lo que hay por
 * corregir y los check-in. No guarda nada.
 */
import { useEffect, useRef, useState } from 'react'
import { getCheckins, getClasesEnDirecto, getPorCorregir, getSemanas, type Semana } from '@services/tareas/tareas'
import { ajustesDirecto, colorDeEtiqueta, CURSO_CLASE_SEMANAL_UUID } from '@/lib/nawar/cursos'
import type { SemanaEquipo } from '@/lib/nawar/salaProfes'

const PALETA = ['#0b2da0', '#7C3AED', '#0E9F8E', '#DB2777', '#4da3ff', '#1D0084']
const POR_ETIQUETA: Record<string, string> = { rojo: '#DC2626', azul: '#2563EB', verde: '#16A34A', amarillo: '#CA8A04', morado: '#7C3AED' }

export type ClaseEquipo = { uuid: string; nombre: string; color: string; etiqueta: string }

export function hoyNL(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export default function useClasesEquipo(org: any, token: string) {
  const configRef = useRef(org?.config?.config)
  configRef.current = org?.config?.config
  const [clases, setClases] = useState<ClaseEquipo[]>([])
  const [semanas, setSemanas] = useState<SemanaEquipo[] | null>(null)
  const [porCorregir, setPorCorregir] = useState(0)
  const [checkins, setCheckins] = useState(0)
  const [hoy, setHoy] = useState(hoyNL())
  const [error, setError] = useState('')
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    if (!org?.id || !token) return
    let vivo = true
    const config = configRef.current
    ;(async () => {
      try {
        const [{ clases: lista }, corregir, chk] = await Promise.all([
          getClasesEnDirecto(org.id, token),
          getPorCorregir(org.id, token).catch(() => ({ entregas: [] as any[] })),
          getCheckins(org.id, token).catch(() => ({ hitos: [], toca: [] as any[] })),
        ])
        const porSemana: Record<number, number> = {}
        for (const e of corregir.entregas || []) porSemana[e.tarea_id] = (porSemana[e.tarea_id] || 0) + 1
        const conColor: ClaseEquipo[] = lista.map((c, i) => {
          const et = ajustesDirecto(config, c.uuid).etiqueta || ''
          const tono = et ? POR_ETIQUETA[colorDeEtiqueta(et)] : ''
          return { uuid: c.uuid, nombre: c.nombre, color: tono || PALETA[i % PALETA.length], etiqueta: et }
        })
        const res = await Promise.allSettled(conColor.map((c) => getSemanas(c.uuid, token)))
        const todas: SemanaEquipo[] = []
        let dia = ''
        res.forEach((r, i) => {
          if (r.status !== 'fulfilled') return
          const c = conColor[i]
          dia = dia || r.value.hoy
          const ajustes = ajustesDirecto(config, c.uuid)
          const recuadro: any = ajustes.banner || (c.uuid === CURSO_CLASE_SEMANAL_UUID ? config?.weekly_class_banner : null) || {}
          // El nombre ya viene con la etiqueta («Clase semanal · Groep rood»).
          const curso = c.nombre
          for (const s of r.value.semanas as Semana[]) {
            const cl = s.clases || []
            todas.push({
              key: `${c.uuid}-${s.id}`,
              semanaId: s.id,
              courseUuid: c.uuid,
              curso,
              color: c.color,
              tema: s.tema || '',
              fecha: s.fecha || '',
              hora: String(recuadro.schedule || '').trim(),
              profe: String(recuadro.teacher || '').trim(),
              presentaciones: cl.filter((x) => x.tipo === 'presentacion'),
              grabaciones: cl.filter((x) => x.tipo === 'grabacion'),
              ejercicios: cl.filter((x) => x.tipo === 'ejercicios'),
              tieneTarea: !!s.tiene_tarea,
              enunciado: s.enunciado || '',
              lista: s.lista || null,
              porCorregir: porSemana[s.id] || 0,
            })
          }
          for (const a of r.value.archivo || []) {
            todas.push({
              key: `${c.uuid}-a-${a.activity_uuid}`,
              semanaId: 0,
              courseUuid: c.uuid,
              curso,
              color: c.color,
              tema: a.tema || a.nombre,
              fecha: a.fecha || '',
              hora: '',
              profe: a.profe || '',
              presentaciones: [],
              grabaciones: [{ activity_uuid: a.activity_uuid, nombre: a.nombre }],
              ejercicios: [],
              tieneTarea: false,
              enunciado: '',
              lista: null,
              porCorregir: 0,
              suelta: true,
            })
          }
        })
        if (!vivo) return
        if (dia) setHoy(dia)
        setClases(conColor)
        setSemanas(todas)
        setPorCorregir((corregir.entregas || []).length)
        setCheckins((chk.toca || []).length)
      } catch (e: any) {
        if (vivo) setError(e?.message || 'No se han podido cargar las clases.')
      }
    })()
    return () => {
      vivo = false
    }
  }, [org?.id, token, vuelta])

  return { clases, semanas, porCorregir, checkins, hoy, error, recargar: () => setVuelta((v) => v + 1) }
}
