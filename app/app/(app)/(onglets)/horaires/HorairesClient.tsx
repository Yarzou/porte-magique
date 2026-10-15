'use client'

import { useState } from 'react'
import { CalendarClock, Plus } from 'lucide-react'
import { usePassageData } from '@/components/passage/PassageData'
import ScheduleSheet from '@/components/horaires/ScheduleSheet'
import PageHeader from '@/components/ui/PageHeader'
import { glassButton } from '@/components/ui/glass'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import { formatDays, formatSlot, formatWhen, nextScheduleChange } from '@/lib/schedules'
import type { Schedule } from '@/lib/types'

/**
 * Horaires d'ouverture de notre porte (modifiables) et de celle des voisins
 * (en lecture) : le passage n'est ouvert que si les deux le sont, on voit
 * donc d'un coup d'œil quand les créneaux se recouvrent.
 */
export default function HorairesClient() {
  const { loading, myDoor, otherDoor, otherFamily, schedules, now } = usePassageData()
  const [editing, setEditing] = useState<Schedule | 'nouveau' | null>(null)

  const mine = myDoor ? schedules.filter(s => s.door_id === myDoor.id) : []
  const theirs = otherDoor ? schedules.filter(s => s.door_id === otherDoor.id) : []
  const next = nextScheduleChange(mine, new Date(now))

  return (
    <>
      <PageHeader
        title="Horaires"
        subtitle="Votre porte s’ouvre et se ferme toute seule."
        trailing={
          <button type="button" onClick={() => setEditing('nouveau')} aria-label="Ajouter un horaire" className={glassButton('round')} disabled={!myDoor}>
            <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        }
      />

      <div className="mt-5 flex flex-col gap-6">
        <ListSection
          header="Votre porte"
          footer={
            next
              ? `Prochaine ${next.kind === 'ouverture' ? 'ouverture' : 'fermeture'} ${formatWhen(next.at, new Date(now))}.`
              : 'Par exemple le mercredi après-midi et le week-end. La porte reste commandable à tout moment depuis l’onglet Passage.'
          }
        >
          {loading ? (
            <ListRow title="Chargement…" />
          ) : (
            <>
              {mine.map(s => (
                <ListRow
                  key={s.id}
                  leading={<IconTile className="bg-tile-blue"><CalendarClock size={18} aria-hidden="true" /></IconTile>}
                  title={formatSlot(s)}
                  subtitle={formatDays(s.weekdays)}
                  onClick={() => setEditing(s)}
                />
              ))}
              <ListRow
                leading={<span className="w-[30px]" />}
                title="Ajouter un horaire"
                tone="accent"
                onClick={() => setEditing('nouveau')}
                disabled={!myDoor}
              />
            </>
          )}
        </ListSection>

        {otherFamily && (
          <ListSection
            header={`Côté ${otherFamily.name}`}
            footer={theirs.length ? 'Leurs horaires, pour accorder les vôtres. Seuls eux peuvent les modifier.' : undefined}
          >
            {theirs.length === 0 ? (
              <ListRow title="Pas d’horaire" subtitle="Leur porte s’ouvre seulement à la main." />
            ) : (
              theirs.map(s => (
                <ListRow
                  key={s.id}
                  leading={<IconTile className="bg-tile-slate"><CalendarClock size={18} aria-hidden="true" /></IconTile>}
                  title={formatSlot(s)}
                  subtitle={formatDays(s.weekdays)}
                />
              ))
            )}
          </ListSection>
        )}
      </div>

      {editing && <ScheduleSheet initial={editing === 'nouveau' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
