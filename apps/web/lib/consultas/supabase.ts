import { createClient } from '@supabase/supabase-js'
import { getConfig } from '@services/config/config'

// Consultas (the Q&A board) live in their own Supabase project — the same one
// the previous external Consultas app used. The anon key is public by design
// (it ships in the browser and is protected by row-level security), so it's
// safe to keep as a fallback; override either value via env if the project
// ever changes:
//   NEXT_PUBLIC_CONSULTAS_SUPABASE_URL
//   NEXT_PUBLIC_CONSULTAS_SUPABASE_ANON_KEY
const URL_FALLBACK = 'https://alifjhqjmedstkafnrmp.supabase.co'
const ANON_FALLBACK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsaWZqaHFqbWVkc3RrYWZucm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTA4MTUsImV4cCI6MjA4Nzg2NjgxNX0.Gz0tMmEy1rcNdjaH7pYkoySMm3PBczmgCuaWobMdOtQ'

const url = getConfig('NEXT_PUBLIC_CONSULTAS_SUPABASE_URL', '') || URL_FALLBACK
const anon = getConfig('NEXT_PUBLIC_CONSULTAS_SUPABASE_ANON_KEY', '') || ANON_FALLBACK

// We only read + insert + call SECURITY DEFINER RPCs as the anon role; no auth
// session is needed, so we don't persist one.
export const consultasClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
