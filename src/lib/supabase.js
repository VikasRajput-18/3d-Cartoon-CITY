import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const key    = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase client needs only the bare origin — strip any /rest/v1 or other path suffix
function cleanSupabaseUrl(u) {
  try { return new URL(u).origin } catch { return u }
}

const url          = rawUrl ? cleanSupabaseUrl(rawUrl) : rawUrl
const isConfigured = url && key && !url.startsWith('your_')

export const supabase = isConfigured ? createClient(url, key) : null
