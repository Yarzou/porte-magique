'use client'

import { useState } from 'react'
import { usePassage } from '@/components/passage/PassageProvider'
import { usePassageData } from '@/components/passage/PassageData'
import GatewaySettings from '@/components/reglages/GatewaySettings'
import NotificationSettings from '@/components/reglages/NotificationSettings'
import PasskeyRows from '@/components/reglages/PasskeyRows'
import { THEME_LABELS, useTheme, type ThemeChoice } from '@/components/theme/theme'
import PageHeader from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import { createClient } from '@/lib/supabase/client'
import { shareLink } from '@/lib/share'
import { initial, reloadTo } from '@/lib/utils'
import type { Member } from '@/lib/types'

const THEME_ORDER: ThemeChoice[] = ['system', 'light', 'dark']

/**
 * Réglages : la famille (membres, invitation), les voisins, les
 * notifications, la connexion par empreinte, la porte (passerelle, taquet),
 * l'apparence et le compte.
 */
export default function ReglagesClient() {
  const { membership, userId } = usePassage()
  const { myFamily, otherFamily, members, profile, renameFamily, updateProfile, createInvitation, removeMember, showToast } =
    usePassageData()
  const { theme, setTheme } = useTheme()
  const [supabase] = useState(() => createClient())
  const [busy, setBusy] = useState<string | null>(null)
  const [familyName, setFamilyName] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  const isAdmin = membership.role === 'admin'
  const mine = members.filter(m => m.family_id === membership.familyId)
  const theirs = otherFamily ? members.filter(m => m.family_id === otherFamily.id) : []

  const invite = async (neighbour: boolean) => {
    setBusy(neighbour ? 'voisins' : 'famille')
    const url = await createInvitation(neighbour)
    setBusy(null)
    if (!url) return
    const text = neighbour
      ? 'Rejoignez notre porte magique : chaque famille ouvre la sienne, les enfants passent quand les deux sont ouvertes.'
      : `Rejoignez la famille ${myFamily?.name ?? ''} sur Porte magique.`
    const result = await shareLink(url, 'Porte magique', text)
    if (result === 'copie') showToast({ text: 'Lien copié. Il est valable 7 jours.' })
    if (result === 'echec') showToast({ text: url })
  }

  const remove = async (member: Member) => {
    const self = member.user_id === userId
    const question = self
      ? 'Quitter la famille ? Vous ne verrez plus la porte magique, sauf nouvelle invitation.'
      : `Retirer ${member.display_name} de la famille ?`
    if (!confirm(question)) return
    await removeMember(member.user_id)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    reloadTo('/auth/login')
  }

  const saveFamilyName = async () => {
    if (familyName === null) return
    if (familyName.trim() && familyName.trim() !== myFamily?.name) await renameFamily(familyName)
    setFamilyName(null)
  }

  const saveDisplayName = async () => {
    if (displayName === null) return
    if (displayName.trim() && displayName.trim() !== profile?.display_name) await updateProfile({ display_name: displayName.trim() })
    setDisplayName(null)
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Réglages" />

      <ListSection header="Votre famille" footer="Un lien d’invitation est valable 7 jours, pour autant de personnes que vous voulez.">
        <label className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="w-[112px] shrink-0 text-body">Nom</span>
          <input
            value={familyName ?? myFamily?.name ?? ''}
            onChange={e => setFamilyName(e.target.value)}
            onBlur={saveFamilyName}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            disabled={!isAdmin}
            maxLength={40}
            className="h-[52px] min-w-0 flex-1 bg-transparent text-body text-ink outline-none disabled:text-ink-muted"
            aria-label="Nom de la famille"
          />
        </label>
        {mine.map(m => (
          <ListRow
            key={m.user_id}
            leading={<IconTile className="bg-tile-purple text-subhead font-semibold">{initial(m.display_name)}</IconTile>}
            title={m.user_id === userId ? `${m.display_name} (vous)` : m.display_name}
            subtitle={m.role === 'admin' ? 'Administrateur' : 'Membre'}
            trailing={
              m.user_id !== userId && isAdmin ? (
                <button type="button" onClick={() => remove(m)} className="flex h-11 items-center text-subhead text-danger">
                  Retirer
                </button>
              ) : undefined
            }
          />
        ))}
        {isAdmin && (
          <ListRow
            leading={<span className="w-[30px]" />}
            title={busy === 'famille' ? 'Création du lien…' : 'Inviter quelqu’un de la famille'}
            tone="accent"
            onClick={() => invite(false)}
            disabled={busy !== null}
          />
        )}
      </ListSection>

      <ListSection
        header={otherFamily ? `Côté ${otherFamily.name}` : 'Les voisins'}
        footer={otherFamily ? 'Ils commandent leur porte, vous la vôtre : chacun voit les deux.' : 'Le lien crée leur famille et leur porte. Il ne sert qu’une fois.'}
      >
        {otherFamily ? (
          theirs.map(m => (
            <ListRow
              key={m.user_id}
              leading={<IconTile className="bg-tile-slate text-subhead font-semibold">{initial(m.display_name)}</IconTile>}
              title={m.display_name}
              subtitle={m.role === 'admin' ? 'Administrateur' : 'Membre'}
            />
          ))
        ) : (
          <ListRow
            title={busy === 'voisins' ? 'Création du lien…' : 'Inviter les voisins'}
            tone="accent"
            onClick={() => invite(true)}
            disabled={busy !== null || !isAdmin}
          />
        )}
      </ListSection>

      <NotificationSettings />

      <PasskeyRows />

      <GatewaySettings />

      <section className="flex flex-col">
        <h2 className="mb-2 ml-4 text-footnote uppercase tracking-[0.3px] text-ink-muted">Apparence</h2>
        <Segmented
          label="Apparence"
          value={theme}
          onChange={setTheme}
          options={THEME_ORDER.map(choice => ({ value: choice, label: THEME_LABELS[choice] }))}
          itemClassName="h-8 text-footnote"
        />
      </section>

      <ListSection header="Compte">
        <label className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="w-[112px] shrink-0 text-body">Prénom</span>
          <input
            value={displayName ?? profile?.display_name ?? ''}
            onChange={e => setDisplayName(e.target.value)}
            onBlur={saveDisplayName}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            maxLength={40}
            className="h-[52px] min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
            aria-label="Prénom"
          />
        </label>
        <ListRow
          title="Quitter la famille"
          tone="danger"
          onClick={() => {
            const me = mine.find(m => m.user_id === userId)
            if (me) void remove(me)
          }}
        />
        <ListRow title="Se déconnecter" tone="danger" onClick={signOut} />
      </ListSection>
    </div>
  )
}
