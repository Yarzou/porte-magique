'use client'

import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PGRST_FUNCTION_NOT_FOUND } from '@/lib/passage'
import { reloadTo } from '@/lib/utils'
import AuthShell from '@/components/auth/AuthShell'
import Button from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'

export default function BienvenueClient({ displayName }: { displayName: string | null }) {
  const [supabase] = useState(() => createClient())
  const [family, setFamily] = useState('')
  const [passage, setPassage] = useState('Porte magique')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.rpc('create_passage', {
      p_family_name: family.trim(),
      p_passage_name: passage.trim(),
    })
    if (error) {
      console.error('[bienvenue] create_passage', error)
      setError(
        error.code === PGRST_FUNCTION_NOT_FOUND
          ? 'La base de données n’est pas encore prête : la migration 001 n’a pas été appliquée.'
          : 'La création a échoué. Réessayez dans un instant.',
      )
      setLoading(false)
      return
    }
    // Navigation complète : le layout serveur relit la famille
    reloadTo('/passage')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    reloadTo('/auth/login')
  }

  return (
    <AuthShell
      title={displayName ? `Bienvenue, ${displayName}` : 'Bienvenue'}
      subtitle="Créez votre côté de la porte magique : vous inviterez ensuite votre famille et vos voisins."
    >
      {error && <Notice tone="danger">{error}</Notice>}

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Famille"
            required
            maxLength={40}
            value={family}
            onChange={e => setFamily(e.target.value)}
            placeholder="Lenoir"
          />
          <FieldRow
            label="Passage"
            required
            maxLength={40}
            value={passage}
            onChange={e => setPassage(e.target.value)}
            placeholder="Porte magique"
          />
        </FieldGroup>
        <p className="mx-4 -mt-2 text-footnote text-ink-muted">
          Le nom de la famille s’affiche chez les voisins (« Côté Lenoir »). Le passage, c’est le nom de votre porte commune.
        </p>
        <Button type="submit" loading={loading} disabled={!family.trim()}>Créer notre côté</Button>
      </form>

      <div className="mt-2 flex items-start gap-3 rounded-xl bg-card p-4">
        <Link2 size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-subhead">
          <strong>On vous a invité ?</strong>{' '}
          <span className="text-ink-muted">
            Ouvrez le lien reçu : il vous ajoute à votre famille, ou crée celle des voisins, sans rien remplir ici.
          </span>
        </p>
      </div>

      <button type="button" onClick={signOut} className="mt-1 h-11 text-subhead text-accent">
        Changer de compte
      </button>
    </AuthShell>
  )
}
