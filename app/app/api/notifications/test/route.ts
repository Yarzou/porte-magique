import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushConfigured, sendPush, type StoredSubscription } from '@/lib/push-server'

/** Notification de test, envoyée aux seuls appareils de la personne connectée. */
export async function POST() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 })
  if (!pushConfigured()) return NextResponse.json({ sent: 0 })

  // Ses propres abonnements : le RLS suffit
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  const admin = createAdminClient()
  let sent = 0
  for (const sub of (subs ?? []) as StoredSubscription[]) {
    const result = await sendPush(sub, {
      title: 'Porte magique',
      body: 'Les notifications arrivent bien sur ce téléphone.',
      url: '/reglages',
      tag: 'test',
    })
    if (result === 'ok') sent++
    if (result === 'gone') await (admin ?? supabase).from('push_subscriptions').delete().eq('id', sub.id)
  }
  return NextResponse.json({ sent })
}
