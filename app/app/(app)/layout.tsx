import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/passage'
import { PassageProvider } from '@/components/passage/PassageProvider'
import { PassageDataProvider } from '@/components/passage/PassageData'
import PushSync from '@/components/push/PushSync'

/**
 * Coquille de tous les écrans du passage (reprise de Fridge). Garde serveur :
 * session (proxy.ts l'a déjà vérifiée sur cookie, getClaims la valide), puis
 * famille — sans famille, direction /bienvenue. Le passage lu ici est transmis
 * aux pages clientes par contexte, avec ses données (PassageDataProvider).
 *
 * getClaims plutôt que getUser : il vérifie la signature du jeton sur place,
 * sans aller-retour au serveur d'auth à chaque ouverture. Le verrou reste le RLS.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) redirect('/auth/login')

  const membership = await getMembership(supabase, userId)
  if (!membership) redirect('/bienvenue')

  return (
    <PassageProvider value={{ membership, userId }}>
      <PassageDataProvider>{children}</PassageDataProvider>
      <PushSync />
    </PassageProvider>
  )
}
