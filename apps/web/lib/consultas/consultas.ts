import { consultasClient } from './supabase'

export interface ConsultaCategory {
  id: string
  name: string
  short: string
  color: string // tailwind-ish hue name from the original app
}

// Fixed category set (mirrors the original Consultas app).
export const CONSULTA_CATEGORIES: ConsultaCategory[] = [
  { id: 'acceso',    name: 'Acceso y cuenta',    short: 'Acceso',    color: 'blue' },
  { id: 'gramatica', name: 'Gramática',          short: 'Gramática', color: 'green' },
  { id: 'comunidad', name: 'Comunidad',          short: 'Comunidad', color: 'purple' },
  { id: 'recursos',  name: 'Recursos',           short: 'Recursos',  color: 'yellow' },
  { id: 'tecnico',   name: 'Problemas técnicos', short: 'Técnico',   color: 'red' },
  { id: 'metodo',    name: 'Método y Estudio',   short: 'Método',    color: 'orange' },
]

export const CATEGORY_BY_ID: Record<string, ConsultaCategory> = Object.fromEntries(
  CONSULTA_CATEGORIES.map((c) => [c.id, c])
)

export interface Consulta {
  id: string
  title: string
  content: string
  category: string
  author_name: string | null
  created_at: string
  resolved: boolean
  respuesta_nawar: string | null
}

export type StatusFilter = 'all' | 'pending' | 'resolved'

const FEED_COLUMNS =
  'id,title,content,category,author_name,created_at,resolved,respuesta_nawar'

export async function listConsultas(opts: {
  category?: string
  status?: StatusFilter
} = {}): Promise<Consulta[]> {
  let query = consultasClient
    .from('consultas')
    .select(FEED_COLUMNS)
    .order('created_at', { ascending: false })

  if (opts.category) query = query.eq('category', opts.category)
  if (opts.status === 'resolved') query = query.eq('resolved', true)
  if (opts.status === 'pending') query = query.eq('resolved', false)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Consulta[]
}

// Fetch a single consulta by id (used by the lesson deep-link "?id=..." so the
// detail modal opens reliably, independent of whatever the feed currently has
// loaded or filtered). Compares loosely on the DB side, so it works whether the
// id column is text/uuid or numeric. Never throws — returns null on any miss.
export async function getConsulta(id: string): Promise<Consulta | null> {
  if (!id) return null
  try {
    const { data, error } = await consultasClient
      .from('consultas')
      .select(FEED_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) return null
    return (data as Consulta) ?? null
  } catch {
    return null
  }
}

export async function createConsulta(input: {
  title: string
  content: string
  category: string
  author_name: string
  author_email: string
}): Promise<void> {
  const { data, error } = await consultasClient
    .from('consultas')
    .insert([
      {
        title: input.title,
        content: input.content,
        category: input.category,
        author_name: input.author_name,
        author_email: input.author_email,
      },
    ])
    .select('id, edit_token')
    .single()
  if (error) throw error
  const row = data as { id?: string; edit_token?: string } | null
  if (row?.id && row?.edit_token) setMyToken(row.id, row.edit_token)
}

export async function updateMyConsulta(
  id: string,
  input: { title: string; content: string; category: string }
): Promise<void> {
  const token = getMyTokens()[id]
  if (!token) throw new Error('No tienes permiso para editar esta consulta.')
  const { error } = await consultasClient.rpc('update_my_consulta', {
    consulta_id: id,
    consulta_token: token,
    new_title: input.title,
    new_content: input.content,
    new_category: input.category,
  })
  if (error) throw error
}

export async function deleteMyConsulta(id: string): Promise<void> {
  const token = getMyTokens()[id]
  if (!token) throw new Error('No tienes permiso para borrar esta consulta.')
  const { error } = await consultasClient.rpc('delete_my_consulta', {
    consulta_id: id,
    consulta_token: token,
  })
  if (error) throw error
  removeMyToken(id)
}

/* ── Ownership: a student "owns" a consulta if we hold its edit_token locally.
   Mirrors the original app's token pattern (no full auth needed to edit/delete
   your own consulta). ── */

const TOKENS_KEY = 'nawar_consulta_tokens'

function getMyTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}')
  } catch {
    return {}
  }
}

function setMyToken(id: string, token: string): void {
  if (typeof window === 'undefined') return
  const tokens = getMyTokens()
  tokens[id] = token
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

function removeMyToken(id: string): void {
  if (typeof window === 'undefined') return
  const tokens = getMyTokens()
  delete tokens[id]
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

export function isMyConsulta(id: string): boolean {
  return Boolean(getMyTokens()[id])
}

// Rich-text answers/content from the old app may contain HTML. We never inject
// it as HTML (XSS); instead convert to plain text with line breaks preserved.
export function htmlToText(html: string | null | undefined): string {
  return (html || '')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
