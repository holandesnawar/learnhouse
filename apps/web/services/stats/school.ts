'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/** Números de la escuela. Todo sale de nuestra base de datos. */

export interface SalesRow {
  key: string
  label: string
  sales: number
  revenue_cents: number
  avg_ticket_cents: number
  by_product: Record<string, { sales: number; revenue_cents: number }>
}

export interface ProductRow {
  product: string
  sales: number
  revenue_cents: number
}

export interface SalesBlock {
  total_sales: number
  total_revenue_cents: number
  avg_ticket_cents: number
  by_month: SalesRow[]
  by_quarter: SalesRow[]
  by_product: ProductRow[]
  undated: number
  last_30_days: { sales: number; revenue_cents: number }
  funnel: { started: number; paid: number; conversion_pct: number; abandoned: number }
  leads_by_month: Record<string, number>
}

export interface StudentsBlock {
  total: number
  active_7d: number
  active_30d: number
  active_30d_pct: number
  new_by_month: { key: string; label: string; count: number }[]
}

export interface CourseBlock {
  course_uuid: string
  name: string
  students_started: number
  modules: { name: string; total_activities: number; students_completed: number; pct: number }[]
  biggest_drop: { after: string; activity: string; reached: number; lost: number } | null
}

export interface CostRow {
  id: number
  period: string
  label: string
  cost_cents: number
  leads: number
  cost_per_lead_cents: number | null
  note: string
}

export interface AttendanceRow {
  id: number
  period: string
  label: string
  value: number
  note: string
}

export interface DeliveryRow {
  id: number
  period: string
  label: string
  cost_cents: number
  note: string
}

export interface MarginRow {
  key: string
  label: string
  revenue_cents: number
  marketing_cents: number
  delivery_cents: number
  margin_cents: number
  sales: number
  margin_per_student_cents: number | null
  breakeven_sales: number | null
}

export interface AtRiskRow {
  user_id: number
  name: string
  email: string
  days_since_join: number | null
  days_inactive: number | null
  activities_done: number
  reason: string
}

export interface Activation {
  window_days: number
  eligible: number
  activated: number
  pct: number
}

export interface Retention {
  weeks: (number | null)[]
  cohorts: { key: string; label: string; size: number; weeks: (number | null)[] }[]
  tracking_since: string | null
}

export interface Support {
  answered: number
  pending: number
  median_hours: number | null
  under_24h_pct: number
}

export interface Refunds {
  available: boolean
  refunds: number
  refunded_cents: number
  disputes: number
}

export interface SchoolStats {
  generated_at: string
  sales: SalesBlock | null
  students: StudentsBlock | null
  courses: CourseBlock[] | null
  manual: { costs: CostRow[]; delivery: DeliveryRow[]; attendance: AttendanceRow[] } | null
  margin: MarginRow[] | null
  at_risk: AtRiskRow[] | null
  activation: Activation | null
  retention: Retention | null
  support: Support | null
  refunds: Refunds | null
}

const base = () => `${getAPIUrl()}stats`

export async function getSchoolStats(
  orgId: number,
  accessToken: string | undefined
): Promise<SchoolStats | null> {
  if (!orgId || !accessToken) return null
  try {
    const r = await fetch(
      `${base()}/org/${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function saveManualEntry(
  orgId: number,
  entry: { kind: 'cost' | 'delivery' | 'attendance'; period: string; value: number; label?: string; note?: string },
  accessToken: string | undefined
): Promise<boolean> {
  if (!orgId || !accessToken) return false
  try {
    const r = await fetch(
      `${base()}/org/${orgId}/manual`,
      RequestBodyWithAuthHeader('PUT', entry, null, accessToken)
    )
    return r.ok
  } catch {
    return false
  }
}

export async function deleteManualEntry(
  orgId: number,
  entryId: number,
  accessToken: string | undefined
): Promise<boolean> {
  if (!orgId || !accessToken) return false
  try {
    const r = await fetch(
      `${base()}/org/${orgId}/manual/${entryId}`,
      RequestBodyWithAuthHeader('DELETE', null, null, accessToken)
    )
    return r.ok
  } catch {
    return false
  }
}

export interface UtmLink {
  name: string
  url: string
  source: string
  medium: string
  campaign: string
  content: string
}

/** Enlaces guardados para copiar y pegar. Viven en la config de la escuela. */
export async function saveUtmLinks(
  orgId: number,
  links: UtmLink[],
  accessToken: string | undefined
): Promise<boolean> {
  if (!orgId || !accessToken) return false
  try {
    const r = await fetch(
      `${getAPIUrl()}orgs/${orgId}/config/utm_links`,
      RequestBodyWithAuthHeader('PUT', { links }, null, accessToken)
    )
    return r.ok
  } catch {
    return false
  }
}

export function readUtmLinks(org: any): UtmLink[] {
  const raw = org?.config?.config?.utm_links?.links
  return Array.isArray(raw) ? raw : []
}

/** Monta el enlace con sus parámetros, sin duplicar los que ya lleve. */
export function buildUtmUrl(link: Omit<UtmLink, 'name'>): string {
  const base = (link.url || '').trim()
  if (!base) return ''
  const params: [string, string][] = [
    ['utm_source', link.source],
    ['utm_medium', link.medium],
    ['utm_campaign', link.campaign],
    ['utm_content', link.content],
  ]
  const clean = params
    .filter(([, v]) => (v || '').trim())
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim())}`)
  if (!clean.length) return base
  const [withoutHash, hash] = base.split('#')
  const joiner = withoutHash.includes('?') ? '&' : '?'
  return `${withoutHash}${joiner}${clean.join('&')}${hash ? `#${hash}` : ''}`
}

/** 1234 (céntimos) → "12,34 €" */
export function euros(cents: number | null | undefined): string {
  const value = (cents || 0) / 100
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: value % 1 === 0 ? 0 : 2 })
}
