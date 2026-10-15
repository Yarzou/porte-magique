'use client'

import { useState } from 'react'
import { BatteryLow, BellRing, DoorClosed, DoorOpen, UserPlus } from 'lucide-react'
import { usePassage } from '@/components/passage/PassageProvider'
import { usePassageData } from '@/components/passage/PassageData'
import DoorTile from '@/components/passage/DoorTile'
import PushPrompt from '@/components/push/PushPrompt'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import { OPEN_DURATIONS, effectiveState, passageOpen } from '@/lib/door'
import { formatAgo, formatClock, formatWhen, nextScheduleChange } from '@/lib/schedules'
import { shareLink } from '@/lib/share'
import { cn } from '@/lib/utils'
import type { PassageEvent } from '@/lib/types'

/** Une demande des enfants est « récente » pendant 10 minutes. */
const RECENT_REQUEST_MS = 10 * 60_000

export default function PassageClient() {
  const { membership, userId } = usePassage()
  const {
    loading, error, passage, myFamily, otherFamily, myDoor, otherDoor, doors, schedules, events, members, now,
    commandDoor, createInvitation, showToast, refresh,
  } = usePassageData()
  const [busy, setBusy] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const title = passage?.name ?? membership.passageName
  const myName = myFamily?.name ?? membership.familyName
  const subtitle = otherFamily ? `${myName} · ${otherFamily.name}` : myName

  if (loading) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <div className="mt-5 h-[188px] animate-pulse rounded-[22px] bg-card" aria-label="Chargement" />
      </>
    )
  }

  if (error || !myDoor) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <div className="mt-5 flex flex-col gap-3">
          <Notice tone="danger">{error ?? 'Votre porte est introuvable.'}</Notice>
          <Button variant="secondary" onClick={() => void refresh()}>Réessayer</Button>
        </div>
      </>
    )
  }

  const open = passageOpen(doors, now)
  const myOpen = effectiveState(myDoor, now) === 'ouvert'
  const otherOpen = !!otherDoor && effectiveState(otherDoor, now) === 'ouvert'
  const target = myDoor.door_target

  let summary: string
  if (!otherDoor) summary = 'Invitez vos voisins pour relier vos deux portes.'
  else if (open) summary = 'Les deux portes sont ouvertes : les enfants peuvent passer.'
  else if (myOpen) summary = `Votre porte est ouverte. Il manque celle côté ${otherFamily?.name}.`
  else if (otherOpen) summary = `La porte côté ${otherFamily?.name} est ouverte. À vous d’ouvrir la vôtre.`
  else summary = 'Les deux portes sont fermées.'

  // Sous le bouton : jusqu'à quand, ou le prochain horaire
  const mySchedules = schedules.filter(s => s.door_id === myDoor.id)
  const next = nextScheduleChange(mySchedules, new Date(now))
  let statusLine: string | null = null
  if (myDoor.assembly_mode) statusLine = null
  else if (target === 'ouvert' && myDoor.open_until) statusLine = `Se refermera à ${formatClock(new Date(myDoor.open_until))}`
  else if (next && (next.kind === 'ouverture') !== (target === 'ouvert')) {
    statusLine = `${next.kind === 'ouverture' ? 'Ouverture' : 'Fermeture'} prévue ${formatWhen(next.at, new Date(now))}`
  }

  const recentRequest = events.find(e => e.kind === 'demande' && now - new Date(e.created_at).getTime() < RECENT_REQUEST_MS)

  const familyOfDoor = (doorId: string | null) => {
    const door = doors.find(d => d.id === doorId)
    if (!door) return ''
    return door.family_id === membership.familyId ? 'chez vous' : `côté ${otherFamily?.name ?? 'voisins'}`
  }
  const actorName = (id: string | null) => {
    if (!id) return 'Quelqu’un'
    if (id === userId) return 'Vous'
    return members.find(m => m.user_id === id)?.display_name || 'Quelqu’un'
  }

  const run = async (key: string, open: boolean, minutes?: number) => {
    setBusy(key)
    await commandDoor(open, minutes)
    setBusy(null)
  }

  const inviteNeighbours = async () => {
    setBusy('invite')
    const url = await createInvitation(true)
    setBusy(null)
    if (!url) return
    const result = await shareLink(url, 'Porte magique', 'Rejoignez notre porte magique : chaque famille ouvre la sienne, les enfants passent quand les deux sont ouvertes.')
    if (result === 'copie') showToast({ text: 'Lien copié. Envoyez-le à vos voisins.' })
    if (result === 'echec') showToast({ text: url })
  }

  const visibleEvents = showAll ? events : events.slice(0, 8)

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      {/* Le passage : état d'ensemble et les deux portes */}
      <section className="mt-5 rounded-[22px] bg-card p-4" aria-labelledby="etat-passage">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white',
              open ? 'bg-tile-green' : 'bg-tile-slate',
            )}
          >
            {open ? <DoorOpen size={26} strokeWidth={2} aria-hidden="true" /> : <DoorClosed size={26} strokeWidth={2} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <h2 id="etat-passage" className="text-title font-semibold">
              {open ? 'Le passage est ouvert' : 'Le passage est fermé'}
            </h2>
            <p className="text-subhead text-ink-muted">{summary}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <DoorTile title="Chez vous" door={myDoor} now={now} />
          {otherDoor && otherFamily ? (
            <DoorTile title={`Côté ${otherFamily.name}`} door={otherDoor} now={now} />
          ) : (
            <button
              type="button"
              onClick={inviteNeighbours}
              disabled={busy === 'invite'}
              className="flex min-w-0 flex-col items-start justify-center gap-1 rounded-2xl border border-dashed border-chip-edge px-3 py-2.5 text-left text-accent disabled:opacity-60"
            >
              <UserPlus size={20} aria-hidden="true" />
              <span className="text-subhead font-semibold">Inviter les voisins</span>
            </button>
          )}
        </div>
      </section>

      {/* Notre porte */}
      <section className="mt-4 flex flex-col gap-2" aria-label="Notre porte">
        {myDoor.assembly_mode && (
          <Notice tone="warn">Mode montage : votre porte reste fermée. Désactivez-le dans Réglages.</Notice>
        )}
        {target === 'ouvert' ? (
          <Button variant="secondary" loading={busy === 'fermer'} disabled={busy !== null} onClick={() => run('fermer', false)}>
            {busy !== 'fermer' && <DoorClosed size={20} aria-hidden="true" />}
            Fermer notre porte
          </Button>
        ) : (
          <>
            <Button loading={busy === 'ouvrir'} disabled={busy !== null || myDoor.assembly_mode} onClick={() => run('ouvrir', true)}>
              {busy !== 'ouvrir' && <DoorOpen size={20} aria-hidden="true" />}
              Ouvrir notre porte
            </Button>
            <div className="grid grid-cols-3 gap-2">
              {OPEN_DURATIONS.map(d => (
                <button
                  key={d.minutes}
                  type="button"
                  disabled={busy !== null || myDoor.assembly_mode}
                  onClick={() => run(`ouvrir-${d.minutes}`, true, d.minutes)}
                  className="h-11 rounded-xl bg-card text-subhead font-semibold text-accent disabled:opacity-50"
                >
                  {busy === `ouvrir-${d.minutes}` ? '…' : `Pour ${d.label}`}
                </button>
              ))}
            </div>
          </>
        )}
        {statusLine && <p className="text-center text-footnote text-ink-muted">{statusLine}</p>}
      </section>

      {/* Les voisins attendent, ou un enfant a sonné */}
      {otherOpen && !myOpen && target !== 'ouvert' && !myDoor.assembly_mode && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-accent-soft px-3.5 py-3 text-accent">
          <DoorOpen size={20} className="shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-subhead">La porte côté {otherFamily?.name} est ouverte.</p>
        </div>
      )}
      {recentRequest && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-warn-soft px-3.5 py-3 text-warn" role="status">
          <BellRing size={20} className="mt-px shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-subhead">
            Un enfant a sonné {familyOfDoor(recentRequest.door_id)}, {formatAgo(recentRequest.created_at, new Date(now))}.
          </p>
        </div>
      )}

      <PushPrompt />

      {/* Journal */}
      <ListSection header="Journal" className="mt-6">
        {events.length === 0 ? (
          <ListRow title="Rien pour l’instant" subtitle="Ouvertures, fermetures et demandes des enfants s’afficheront ici." />
        ) : (
          visibleEvents.map(e => (
            <ListRow
              key={e.id}
              leading={<EventIcon event={e} />}
              title={eventText(e, actorName, familyOfDoor)}
              subtitle={formatAgo(e.created_at, new Date(now))}
            />
          ))
        )}
        {events.length > 8 && (
          <ListRow title={showAll ? 'Afficher moins' : 'Tout afficher'} tone="accent" onClick={() => setShowAll(v => !v)} />
        )}
      </ListSection>
    </>
  )
}

function EventIcon({ event }: { event: PassageEvent }) {
  switch (event.kind) {
    case 'ouverture':
      return <IconTile className="bg-tile-green"><DoorOpen size={18} aria-hidden="true" /></IconTile>
    case 'fermeture':
      return <IconTile className="bg-tile-slate"><DoorClosed size={18} aria-hidden="true" /></IconTile>
    case 'demande':
      return <IconTile className="bg-tile-bell"><BellRing size={18} aria-hidden="true" /></IconTile>
    case 'batterie_faible':
      return <IconTile className="bg-tile-red"><BatteryLow size={18} aria-hidden="true" /></IconTile>
  }
}

function eventText(
  e: PassageEvent,
  actorName: (id: string | null) => string,
  familyOfDoor: (doorId: string | null) => string,
): string {
  const who = actorName(e.actor)
  const where = familyOfDoor(e.door_id)
  const you = who === 'Vous'
  switch (e.kind) {
    case 'ouverture': {
      const duration = e.detail?.minutes ? ` pour ${e.detail.minutes >= 60 ? `${e.detail.minutes / 60} h` : `${e.detail.minutes} min`}` : ''
      return `${who} ${you ? 'avez' : 'a'} ouvert la porte ${where}${duration}`
    }
    case 'fermeture':
      return `${who} ${you ? 'avez' : 'a'} fermé la porte ${where}`
    case 'demande':
      return `Un enfant a sonné ${where}`
    case 'batterie_faible':
      return `Batterie faible ${where}`
  }
}
