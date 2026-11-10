/**
 * Estado de la escuela (10/11/2026): lo que falla y lo que va lento.
 * La API está en apps/api/src/routers/estado.py y la explicación entera en
 * apps/api/src/services/estado/estado.py. Solo administradores.
 */
import { getAPIUrl } from '@services/config/config'

export interface Comprobacion {
  nombre: string
  ok: boolean
  ms: number
  detalle: string
}

export interface EnVivo {
  comprobaciones: Comprobacion[]
  disco: { total_mb?: number; usado_mb?: number; libre_mb?: number; pct?: number }
  /** Solo si cada clave está puesta. Nunca su valor. */
  claves: { nombre: string; puesta: boolean }[]
  version: string
  arrancado: string
  arrancado_hace_s: number
  apuntando: boolean
  sin_guardar: { cola: number; tiradas_por_tope: number }
  umbral_lenta_ms: number
}

interface Agrupado {
  veces: number
  hoy: number
  personas: number
  anonimas: number
  ultima: string
  navegadores: { nombre: string; veces: number }[]
  versiones: string[]
}

export interface ErrorApi extends Agrupado {
  metodo: string
  ruta: string
  status: number
  mensaje: string
  pagina: string
}

export interface Lenta extends Agrupado {
  metodo: string
  ruta: string
  peor_ms: number
}

export interface PantallaRota extends Agrupado {
  pagina: string
  mensaje: string
  traducida: number
  app: number
  trozo: number
}

export interface RutaTiempos {
  metodo: string
  ruta: string
  peticiones: number
  mediana_ms: number
  p95_ms: number
  media_ms: number
  peor_ms: number
  total_s: number
}

export interface ResumenEstado {
  dias: number
  errores: ErrorApi[]
  lentas: Lenta[]
  rutas: RutaTiempos[]
  pantallas: PantallaRota[]
  arranques: { cuando: string; version: string }[]
  hoy: { errores: number; rutas_con_error: number; pantallas: number; paginas_rotas: number; lentas: number; arranques: number }
  semana: { errores: number; pantallas: number; lentas: number }
}

export interface EstadoDatos {
  vivo: EnVivo
  resumen: ResumenEstado
  semaforo: { color: 'verde' | 'ambar' | 'rojo'; frase: string }
  /** Si no se pudo leer lo apuntado (p. ej. la tabla aún no existe). */
  aviso: string
}

export async function getEstado(orgId: number, token: string, dias = 7): Promise<EstadoDatos> {
  const res = await fetch(`${getAPIUrl()}estado/org/${orgId}?dias=${dias}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  return datos as EstadoDatos
}
