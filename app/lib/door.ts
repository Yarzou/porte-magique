import type { Door, DoorState } from '@/lib/types'

/** Au-delà, la passerelle est « hors ligne » (elle se présente toutes les 5 s, et écrit au moins toutes les 30 s). */
export const OFFLINE_AFTER_MS = 90_000

/** La passerelle s'est-elle présentée récemment ? */
export function isOnline(door: Door, now = Date.now()): boolean {
  return !!door.last_seen_at && now - new Date(door.last_seen_at).getTime() < OFFLINE_AFTER_MS
}

/**
 * Charge de la batterie LiPo, d'après sa tension (3,3 V vide, 4,15 V pleine).
 * Approximation linéaire : assez juste pour « il faudra recharger bientôt ».
 */
export function batteryPercent(mv: number | null): number | null {
  if (mv == null) return null
  return Math.round(Math.min(100, Math.max(0, ((mv - 3300) / (4150 - 3300)) * 100)))
}

export type DoorPhase =
  /** Pas encore de passerelle associée : seul l'ordre compte */
  | 'sans-passerelle'
  | 'hors-ligne'
  /** Ordre donné, le servo ne l'a pas encore exécuté */
  | 'en-cours'
  | 'ouverte'
  | 'fermee'
  /** Le servo n'a pas pu tourner (taquet coincé) */
  | 'bloquee'

/** Où en est une porte, pour l'affichage. */
export function doorPhase(door: Door, now = Date.now()): DoorPhase {
  if (!door.gateway_key_hash || !door.last_seen_at) return 'sans-passerelle'
  if (!isOnline(door, now)) return 'hors-ligne'
  if (door.lock_state === 'bloque') return 'bloquee'
  if (door.lock_state !== door.door_target) return 'en-cours'
  return door.lock_state === 'ouvert' ? 'ouverte' : 'fermee'
}

/** État d'une porte vu de l'appli : l'état réel s'il est connu, sinon l'ordre. */
export function effectiveState(door: Door, now = Date.now()): DoorState {
  const phase = doorPhase(door, now)
  if (phase === 'ouverte') return 'ouvert'
  if (phase === 'fermee' || phase === 'bloquee') return 'ferme'
  return door.door_target
}

/** Le passage est-il ouvert ? Les deux portes doivent l'être. */
export function passageOpen(doors: Door[], now = Date.now()): boolean {
  return doors.length === 2 && doors.every(d => effectiveState(d, now) === 'ouvert')
}

export const PHASE_LABEL: Record<DoorPhase, string> = {
  'sans-passerelle': '',
  'hors-ligne': 'Passerelle hors ligne',
  'en-cours': 'En cours…',
  ouverte: 'Ouverte',
  fermee: 'Fermée',
  bloquee: 'Taquet bloqué',
}

/** Durées proposées pour « ouvrir pour un moment », en minutes. */
export const OPEN_DURATIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
] as const
