// Creates the connection to your Supabase project.
// The URL and key come from the .env.local file (see .env.example).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Missing Supabase settings. Copy .env.example to .env.local and fill it in.')
}

export const supabase = createClient(url, anonKey)
