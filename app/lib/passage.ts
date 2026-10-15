import type { SupabaseClient } from '@supabase/supabase-js'
import type { FamilyRole, Membership } from '@/lib/types'

interface MembershipRow {
  role: FamilyRole
  families: { id: string; name: string; passages: { id: string; name: string } | null } | null
}

/**
 * Passage et famille d'un compte : la famille la plus récemment rejointe.
 * Accepter une invitation fait donc basculer sur le nouveau passage.
 *
 * Renvoie null sans famille, et aussi si la base n'a pas encore la migration
 * 001 : l'appelant envoie alors vers /bienvenue, qui affiche l'erreur.
 */
export async function getMembership(supabase: SupabaseClient, userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select('role, families ( id, name, passages ( id, name ) )')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[passage] lecture de la famille impossible :', error.code, error.message)
    return null
  }
  const row = data as unknown as MembershipRow | null
  const family = row?.families
  if (!row || !family?.passages) return null
  return {
    passageId: family.passages.id,
    passageName: family.passages.name,
    familyId: family.id,
    familyName: family.name,
    role: row.role,
  }
}

/** Code PostgREST d'une fonction RPC absente du cache de schéma (migration non passée). */
export const PGRST_FUNCTION_NOT_FOUND = 'PGRST202'
