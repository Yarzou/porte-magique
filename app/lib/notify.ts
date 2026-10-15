import { createAdminClient } from '@/lib/supabase/admin'
import { pushConfigured, sendPush, type StoredSubscription } from '@/lib/push-server'
import type { PushPayload } from '@/lib/types'

/** Préférence de notification de la personne (colonnes de profiles). */
export type NotifyPreference = 'notify_requests' | 'notify_neighbour' | 'notify_battery'

interface Audience {
  passageId: string
  /** Seulement cette famille (par défaut : tout le passage) */
  familyId?: string
  /** Toutes les familles sauf celle-ci */
  exceptFamilyId?: string
  /** Pas la personne qui vient d'agir */
  exceptUserId?: string
  preference?: NotifyPreference
}

/**
 * Envoie une notification aux téléphones d'une partie du passage. Dégradable :
 * sans clés VAPID ou sans clé serveur, rien n'est envoyé et rien n'échoue.
 * Les abonnements que le service push déclare morts (404, 410) sont supprimés.
 */
export async function notify(audience: Audience, payload: PushPayload): Promise<number> {
  const admin = createAdminClient()
  if (!admin || !pushConfigured()) return 0

  let families = admin.from('families').select('id').eq('passage_id', audience.passageId)
  if (audience.familyId) families = families.eq('id', audience.familyId)
  if (audience.exceptFamilyId) families = families.neq('id', audience.exceptFamilyId)
  const { data: familyRows } = await families
  const familyIds = (familyRows ?? []).map(f => f.id as string)
  if (familyIds.length === 0) return 0

  const { data: members } = await admin.from('family_members').select('user_id').in('family_id', familyIds)
  let userIds = [...new Set((members ?? []).map(m => m.user_id as string))].filter(id => id !== audience.exceptUserId)
  if (userIds.length === 0) return 0

  if (audience.preference) {
    const { data: profiles } = await admin.from('profiles').select('id').in('id', userIds).eq(audience.preference, true)
    userIds = (profiles ?? []).map(p => p.id as string)
    if (userIds.length === 0) return 0
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  let sent = 0
  await Promise.all(
    ((subs ?? []) as StoredSubscription[]).map(async sub => {
      const result = await sendPush(sub, payload)
      if (result === 'ok') sent++
      if (result === 'gone') await admin.from('push_subscriptions').delete().eq('id', sub.id)
    }),
  )
  return sent
}
