'use client'

import { useState } from 'react'
import { Copy, KeyRound, Router, Wrench } from 'lucide-react'
import { usePassageData } from '@/components/passage/PassageData'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import Notice from '@/components/ui/Notice'
import Stepper from '@/components/ui/Stepper'
import Switch from '@/components/ui/Switch'
import { batteryPercent, isOnline } from '@/lib/door'
import { formatAgo } from '@/lib/schedules'

/**
 * Notre porte : la passerelle (associer, nouvelle clé), le réglage du taquet
 * (angles du servo) et le mode montage. La clé n'est montrée qu'une fois : la
 * base n'en garde que l'empreinte.
 */
export default function GatewaySettings() {
  const { myDoor, now, newGatewayKey, updateDoorSettings, showToast } = usePassageData()
  const [key, setKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!myDoor) return null

  const paired = !!myDoor.gateway_key_hash
  const online = isOnline(myDoor, now)
  const battery = batteryPercent(myDoor.battery_mv)
  let status = 'Pas encore associée'
  if (paired && !myDoor.last_seen_at) status = 'Associée, pas encore branchée'
  else if (paired && online) status = `En ligne${battery != null ? ` · batterie ${battery} %` : ''}`
  else if (paired && myDoor.last_seen_at) status = `Hors ligne, vue ${formatAgo(myDoor.last_seen_at, new Date(now))}`

  const createKey = async () => {
    if (paired && !confirm('Une nouvelle clé remplace l’ancienne : la passerelle actuelle ne pourra plus se connecter tant qu’elle n’aura pas la nouvelle. Continuer ?')) return
    setBusy(true)
    const value = await newGatewayKey()
    setBusy(false)
    if (value) setKey(value)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast({ text: 'Copié.' })
    } catch {
      showToast({ text: 'Copie impossible : sélectionnez le texte à la main.', tone: 'error' })
    }
  }

  const config = key ? `PORTE_ID=${myDoor.id}\nPORTE_CLE=${key}` : ''

  return (
    <div className="flex flex-col gap-2">
      <ListSection
        header="Votre porte"
        footer="La passerelle est la carte branchée dans la maison : elle relaie les ordres jusqu’à la porte. Le programme des cartes reçoit l’identifiant et la clé ci-dessus."
      >
        <ListRow
          leading={<IconTile className="bg-tile-teal"><Router size={18} aria-hidden="true" /></IconTile>}
          title="Passerelle"
          subtitle={status}
        />
        <ListRow
          leading={<IconTile className="bg-tile-slate"><KeyRound size={18} aria-hidden="true" /></IconTile>}
          title={busy ? 'Création…' : paired ? 'Nouvelle clé de passerelle' : 'Associer une passerelle'}
          tone="accent"
          onClick={createKey}
          disabled={busy}
        />
      </ListSection>

      {key && (
        <div className="flex flex-col gap-2 rounded-xl bg-card p-3.5">
          <Notice tone="warn">Notez-la maintenant : cette clé ne sera plus jamais affichée.</Notice>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-fill-soft p-3 font-mono text-footnote text-ink">{config}</pre>
          <button
            type="button"
            onClick={() => copy(config)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-soft text-subhead font-semibold text-accent"
          >
            <Copy size={16} aria-hidden="true" />
            Copier
          </button>
        </div>
      )}

      <ListSection
        header="Réglage du taquet"
        footer="Angles du servo, en degrés. Fermé : le taquet passe devant le bord de la porte. Ouvert : il est levé au-dessus du boîtier. Le mode montage garde la porte fermée, horaires compris, pour fermer le boîtier (étape 13 de la notice)."
      >
        <ListRow
          title="Position fermée"
          subtitle={`${myDoor.angle_closed}°`}
          trailing={
            <Stepper
              value={myDoor.angle_closed}
              min={0}
              max={180}
              step={5}
              onChange={v => void updateDoorSettings({ angle_closed: v })}
              decreaseLabel="Cinq degrés de moins"
              increaseLabel="Cinq degrés de plus"
            />
          }
        />
        <ListRow
          title="Position ouverte"
          subtitle={`${myDoor.angle_open}°`}
          trailing={
            <Stepper
              value={myDoor.angle_open}
              min={0}
              max={180}
              step={5}
              onChange={v => void updateDoorSettings({ angle_open: v })}
              decreaseLabel="Cinq degrés de moins"
              increaseLabel="Cinq degrés de plus"
            />
          }
        />
        <ListRow
          leading={<IconTile className="bg-tile-amber"><Wrench size={18} aria-hidden="true" /></IconTile>}
          title="Mode montage"
          trailing={<Switch label="Mode montage" checked={myDoor.assembly_mode} onChange={v => void updateDoorSettings({ assembly_mode: v })} />}
        />
      </ListSection>
    </div>
  )
}
