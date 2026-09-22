import { createClient } from '@supabase/supabase-js'

// These are public client settings for this logbook's Supabase project.
// Pinning them prevents a stale Vercel environment value from sending sign-ins
// to a different project. Never put a secret or service-role key here.
const supabaseUrl = 'https://nlwhvlolfqmalhbwuvek.supabase.co'
const supabasePublishableKey = 'sb_publishable_J9WbbRlBNNtErSz11ctqbA_fu5NHYbo'

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export const isSupabaseConfigured = Boolean(supabase)
