'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/**
 * Automatizaciones de la escuela: lo que hace sola y lo que añade el admin.
 * Solo administradores (el backend lo comprueba otra vez, esto es la fachada).
 */

export interface BuiltinStep {
  text: string
  /** Dónde vive en el código, para poder comprobarlo. */
  where: string
}

export interface BuiltinFlow {
  id: string
  title: string
  summary: string
  steps: BuiltinStep[]
}

export interface TriggerDef {
  id: string
  label: string
  description: string
}

export interface ActionField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'richtext' | 'usergroup'
  required?: boolean
}

export interface ActionDef {
  id: string
  label: string
  description: string
  fields: ActionField[]
}

export interface Automation {
  id: number
  name: string
  trigger: string
  action: string
  config: Record<string, any>
  enabled: boolean
  run_count: number
  last_run_at: string
  last_error: string
  created_at: string
}

export interface AutomationCatalog {
  builtin: BuiltinFlow[]
  triggers: TriggerDef[]
  actions: ActionDef[]
}

const base = () => `${getAPIUrl()}automations`

export async function getCatalog(
  orgId: number,
  accessToken: string | undefined
): Promise<AutomationCatalog | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${base()}/org/${orgId}/catalog`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function listAutomations(
  orgId: number,
  accessToken: string | undefined
): Promise<Automation[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(
      `${base()}/org/${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** El detalle del error del backend, para poder decir QUÉ ha fallado. */
async function detailOf(r: Response, fallback: string): Promise<string> {
  try {
    const data = await r.json()
    if (data?.detail) return String(data.detail)
  } catch {
    /* la respuesta no era JSON */
  }
  return fallback
}

export async function createAutomation(
  orgId: number,
  payload: Partial<Automation>,
  accessToken: string | undefined
): Promise<Automation> {
  const r = await fetch(
    `${base()}/org/${orgId}`,
    RequestBodyWithAuthHeader('POST', payload, null, accessToken)
  )
  if (!r.ok) throw new Error(await detailOf(r, 'No se pudo crear la automatización'))
  return r.json()
}

export async function updateAutomation(
  orgId: number,
  id: number,
  payload: Partial<Automation>,
  accessToken: string | undefined
): Promise<Automation> {
  const r = await fetch(
    `${base()}/org/${orgId}/${id}`,
    RequestBodyWithAuthHeader('PUT', payload, null, accessToken)
  )
  if (!r.ok) throw new Error(await detailOf(r, 'No se pudo guardar'))
  return r.json()
}

export async function deleteAutomation(
  orgId: number,
  id: number,
  accessToken: string | undefined
): Promise<void> {
  const r = await fetch(
    `${base()}/org/${orgId}/${id}`,
    RequestBodyWithAuthHeader('DELETE', {}, null, accessToken)
  )
  if (!r.ok) throw new Error(await detailOf(r, 'No se pudo borrar'))
}

/** La ejecuta contra tu propia cuenta: el correo te llega a ti. */
export async function testAutomation(
  orgId: number,
  id: number,
  accessToken: string | undefined
): Promise<{ ok: boolean; error: string }> {
  const r = await fetch(
    `${base()}/org/${orgId}/${id}/test`,
    RequestBodyWithAuthHeader('POST', {}, null, accessToken)
  )
  if (!r.ok) throw new Error(await detailOf(r, 'No se pudo probar'))
  return r.json()
}
