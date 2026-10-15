import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notify'
import { isUuid } from '@/lib/utils'

// Les notifications partent après la réponse (after) : laisser à Vercel le temps de finir
export const maxDuration = 20

interface CommandRow {
  passage_id: string
  family_id: string
  target: 'ouvert' | 'ferme'
}

/**
 * Ordre donné depuis l'appli : ouvrir ou fermer sa porte, éventuellement pour
 * un moment. command_door() vérifie que la porte est celle de la famille de la
 * personne (session), puis on prévient l'autre famille.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { doorId?: unknown; open?: unknown; minutes?: unknown } | null
  const doorId = typeof body?.doorId === 'string' && isUuid(body.doorId) ? body.doorId : null
  const open = typeof body?.open === 'boolean' ? body.open : null
  const minutes = typeof body?.minutes === 'number' && Number.isInteger(body.minutes) ? body.minutes : null
  if (!doorId || open === null) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 })

  const { data, error } = await supabase.rpc('command_door', { p_door: doorId, p_open: open, p_minutes: minutes })
  if (error) {
    const status = error.code === '42501' ? 403 : 400
    console.error('[porte] command_door :', error.code, error.message)
    return NextResponse.json({ error: 'Ordre refusé.' }, { status })
  }
  const row = (data as CommandRow[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Ordre refusé.' }, { status: 400 })

  // Lus pendant la requête : le client de session dépend des cookies, absents après la réponse
  const [{ data: family }, { data: profile }] = await Promise.all([
    supabase.from('families').select('name').eq('id', row.family_id).single(),
    supabase.from('profiles').select('display_name').eq('id', userId).single(),
  ])
  const side = family?.name ? `côté ${family.name}` : 'des voisins'
  const who = profile?.display_name ?? 'Vos voisins'
  const duration = open && minutes ? ` pour ${minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`}` : ''

  after(async () => {
    await notify(
      { passageId: row.passage_id, exceptFamilyId: row.family_id, preference: 'notify_neighbour' },
      open
        ? { title: `Porte ouverte ${side}`, body: `${who} a ouvert sa porte${duration}. Ouvrez la vôtre pour que les enfants passent.`, url: '/passage', tag: 'voisins' }
        : { title: `Porte fermée ${side}`, body: `${who} a fermé sa porte.`, url: '/passage', tag: 'voisins' },
    )
  })

  return NextResponse.json({ target: row.target })
}
