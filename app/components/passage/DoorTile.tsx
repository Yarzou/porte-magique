import { BatteryLow, CircleAlert, DoorClosed, DoorOpen, LoaderCircle, WifiOff } from 'lucide-react'
import { batteryPercent, doorPhase, effectiveState } from '@/lib/door'
import { cn } from '@/lib/utils'
import type { Door } from '@/lib/types'

/**
 * Une porte dans la carte du passage : de qui elle est, son état (texte et
 * icône, jamais la couleur seule), et un détail utile (batterie, porte
 * entrouverte, passerelle hors ligne).
 */
export default function DoorTile({ title, door, now }: { title: string; door: Door; now: number }) {
  const phase = doorPhase(door, now)
  const state = effectiveState(door, now)
  const open = state === 'ouvert'
  const battery = batteryPercent(door.battery_mv)

  let label = open ? 'Ouverte' : 'Fermée'
  let Icon = open ? DoorOpen : DoorClosed
  let tone = open ? 'text-tile-green' : 'text-ink-muted'
  if (phase === 'en-cours') {
    label = door.door_target === 'ouvert' ? 'Ouverture…' : 'Fermeture…'
    Icon = LoaderCircle
    tone = 'text-accent'
  } else if (phase === 'bloquee') {
    label = 'Bloquée'
    Icon = CircleAlert
    tone = 'text-danger'
  }

  let detail: React.ReactNode = null
  if (phase === 'sans-passerelle') {
    detail = 'Pas encore de passerelle'
  } else if (phase === 'hors-ligne') {
    detail = (
      <span className="inline-flex items-center gap-1 text-warn">
        <WifiOff size={12} strokeWidth={2.4} aria-hidden="true" />
        Hors ligne
      </span>
    )
  } else if (door.door_closed === false) {
    detail = <span className="text-warn">Porte entrouverte</span>
  } else if (battery != null && battery <= 15) {
    detail = (
      <span className="inline-flex items-center gap-1 text-danger">
        <BatteryLow size={13} strokeWidth={2.4} aria-hidden="true" />
        Batterie {battery} %
      </span>
    )
  } else if (battery != null) {
    detail = `Batterie ${battery} %`
  }

  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-fill-soft px-3 py-2.5">
      <p className="truncate text-footnote text-ink-muted">{title}</p>
      <p className={cn('mt-0.5 flex items-center gap-1.5 text-body font-semibold', tone)}>
        <Icon size={20} strokeWidth={2.2} className={cn('shrink-0', phase === 'en-cours' && 'animate-spin')} aria-hidden="true" />
        <span className={phase === 'bloquee' ? 'text-danger' : 'text-ink'}>{label}</span>
      </p>
      <p className="mt-0.5 min-h-[18px] truncate text-caption text-ink-muted">{detail}</p>
    </div>
  )
}
