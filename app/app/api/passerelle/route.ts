import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createAnonClient } from '@/lib/supabase/admin'
import { notify } from '@/lib/notify'
import { isUuid } from '@/lib/utils'

export const maxDuration = 20

interface EventRow {
  passage_id: string
  family_id: string
  deliver: boolean
}

/**
 * Événement envoyé par la passerelle : un enfant a appuyé sur le bouton de la
 * porte (`demande`), ou la batterie faiblit (`batterie_faible`).
 *
 *   POST /api/passerelle
 *   { "door": "<id de la porte>", "key": "<clé de la passerelle>", "kind": "demande" }
 *
 * gateway_event() vérifie la clé et écarte les doublons (une demande par
 * minute, une alerte de batterie par 20 h), puis on prévient les téléphones.
 * Le reste du dialogue (état de la porte, ordres) passe directement par la RPC
 * gateway_sync() de Supabase : voir docs/api-passerelle.md.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { door?: unknown; key?: unknown; kind?: unknown } | null
  const door = typeof body?.door === 'string' && isUuid(body.door) ? body.door : null
  const key = typeof body?.key === 'string' && body.key.length <= 200 ? body.key : null
  const kind = body?.kind === 'demande' || body?.kind === 'batterie_faible' ? body.kind : null
  if (!door || !key || !kind) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const { data, error } = await createAnonClient().rpc('gateway_event', { p_door: door, p_key: key, p_kind: kind })
  if (error) {
    const status = error.code === '28000' ? 401 : 400
    return NextResponse.json({ error: status === 401 ? 'Clé inconnue.' : 'Événement refusé.' }, { status })
  }
  const row = (data as EventRow[] | null)?.[0]
  if (!row?.deliver) return NextResponse.json({ ok: true, notified: 0 })

  const admin = createAdminClient()
  const { data: family } = admin ? await admin.from('families').select('name').eq('id', row.family_id).single() : { data: null }
  const side = family?.name ? `côté ${family.name}` : ''

  const notified =
    kind === 'demande'
      ? await notify(
          { passageId: row.passage_id, preference: 'notify_requests' },
          { title: 'Quelqu’un voudrait passer', body: `Un enfant a sonné à la porte ${side}.`.replace(' .', '.'), url: '/passage', tag: 'demande' },
        )
      : await notify(
          { passageId: row.passage_id, familyId: row.family_id, preference: 'notify_battery' },
          { title: 'Batterie faible', body: 'Rechargez la porte : prise USB-C sous le boîtier, pendant une nuit.', url: '/reglages', tag: 'batterie' },
        )

  return NextResponse.json({ ok: true, notified })
}
