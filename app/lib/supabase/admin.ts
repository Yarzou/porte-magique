import { createClient } from '@supabase/supabase-js'

/**
 * Client « service role » : routes serveur uniquement, pour lire les
 * abonnements Web Push des autres membres (le RLS ne les montre qu'à leur
 * propriétaire). Null sans SUPABASE_SERVICE_ROLE_KEY : les notifications
 * deviennent un no-op.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Client sans session (clé anon), pour les RPC appelées par la passerelle. */
export function createAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
