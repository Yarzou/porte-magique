'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { InvitationPreview } from '@/lib/types'
import { reloadTo } from '@/lib/utils'
import AuthShell from '@/components/auth/AuthShell'
import Button, { buttonClass } from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'

export default function InvitationClient({
  id,
  preview,
  loggedIn,
}: {
  id: string
  preview: InvitationPreview | null
  loggedIn: boolean
}) {
  const [supabase] = useState(() => createClient())
  const [family, setFamily] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(!preview || !preview.is_valid)

  const back = `/invitation/${id}`
  const neighbour = !!preview?.is_neighbour

  const accept = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.rpc('accept_invitation', {
      p_invitation: id,
      p_family_name: neighbour ? family.trim() : null,
    })
    if (error) {
      console.error('[invitation] accept', error)
      // P0002 : invitation expirée ou supprimée · P0001 : les deux familles sont déjà là
      if (error.code === 'P0002' || error.code === 'P0001') setExpired(true)
      else setError('Impossible de rejoindre le passage. Réessayez dans un instant.')
      setLoading(false)
      return
    }
    // Navigation complète : le layout serveur relit la famille
    reloadTo('/passage')
  }

  if (expired || !preview) {
    return (
      <AuthShell title="Lien expiré" subtitle="Ce lien d’invitation n’est plus valable. Demandez-en un nouveau à la personne qui vous l’a envoyé.">
        <Link href="/" className={buttonClass('secondary')}>Ouvrir l’appli</Link>
      </AuthShell>
    )
  }

  const inviter = preview.invited_by ?? 'Vos voisins'
  const title = neighbour ? 'Relier vos deux portes' : `Rejoindre la famille ${preview.family_name}`
  const subtitle = neighbour
    ? `${inviter}${preview.inviter_family ? ` (côté ${preview.inviter_family})` : ''} vous invite sur « ${preview.passage_name} » : chaque famille ouvre sa porte, les enfants passent quand les deux sont ouvertes.`
    : `${inviter} vous invite à commander votre porte de « ${preview.passage_name} ».`

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {error && <Notice tone="danger">{error}</Notice>}

      {loggedIn ? (
        neighbour ? (
          <form onSubmit={accept} className="flex flex-col gap-4">
            <FieldGroup>
              <FieldRow
                label="Famille"
                required
                maxLength={40}
                value={family}
                onChange={e => setFamily(e.target.value)}
                placeholder="Martin"
              />
            </FieldGroup>
            <p className="mx-4 -mt-2 text-footnote text-ink-muted">Il s’affichera chez vos voisins : « Côté Martin ».</p>
            <Button type="submit" loading={loading} disabled={!family.trim()}>Relier notre porte</Button>
          </form>
        ) : (
          <Button onClick={() => accept()} loading={loading}>Rejoindre la famille</Button>
        )
      ) : (
        <>
          <Link href={`/auth/register?redirect=${encodeURIComponent(back)}`} className={buttonClass('primary')}>
            Créer un compte
          </Link>
          <Link href={`/auth/login?redirect=${encodeURIComponent(back)}`} className={buttonClass('secondary')}>
            J’ai déjà un compte
          </Link>
        </>
      )}
    </AuthShell>
  )
}
