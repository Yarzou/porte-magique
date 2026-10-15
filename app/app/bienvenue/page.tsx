import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/passage'
import BienvenueClient from './BienvenueClient'

/** Premier passage d'un compte sans famille : créer son côté, ou attendre une invitation. */
export default async function BienvenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/bienvenue')

  if (await getMembership(supabase, user.id)) redirect('/passage')

  const displayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null
  return <BienvenueClient displayName={displayName} />
}
