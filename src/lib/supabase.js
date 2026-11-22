import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// In the browser, go through the /sb proxy on our own domain (see next.config.js),
// so the app works on networks that block supabase.co. On the server, call
// Supabase directly.
const isBrowser = typeof window !== 'undefined'
const clientUrl = isBrowser ? `${window.location.origin}/sb` : supabaseUrl

// supabase-js names its session key after the URL's host. Keep the key the
// direct URL would give, so people who are already signed in stay signed in.
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

export const supabase = createClient(clientUrl, supabaseAnonKey, {
  auth: { storageKey: `sb-${projectRef}-auth-token` },
})
