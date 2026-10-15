import { redirect } from 'next/navigation'

// Pas de page d'accueil publique : proxy.ts envoie vers la connexion sans
// session, sinon on ouvre directement le passage.
export default function Home() {
  redirect('/passage')
}
