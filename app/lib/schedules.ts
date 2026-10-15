import type { Schedule } from '@/lib/types'

/**
 * Horaires d'ouverture. Les heures s'entendent dans le fuseau du passage
 * (Europe/Paris) : l'affichage suppose que le téléphone est dans le même.
 */

export const WEEKDAYS = [
  { iso: 1, short: 'L', label: 'lundi' },
  { iso: 2, short: 'M', label: 'mardi' },
  { iso: 3, short: 'M', label: 'mercredi' },
  { iso: 4, short: 'J', label: 'jeudi' },
  { iso: 5, short: 'V', label: 'vendredi' },
  { iso: 6, short: 'S', label: 'samedi' },
  { iso: 7, short: 'D', label: 'dimanche' },
] as const

/** Jour ISO d'une date (1 = lundi … 7 = dimanche). */
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1
}

/** « Tous les jours », « En semaine », « Le week-end », ou « mercredi, samedi et dimanche ». */
export function formatDays(weekdays: number[]): string {
  const days = [...new Set(weekdays)].sort((a, b) => a - b)
  const key = days.join('')
  if (key === '1234567') return 'Tous les jours'
  if (key === '12345') return 'En semaine'
  if (key === '67') return 'Le week-end'
  const labels = days.map(d => WEEKDAYS[d - 1].label)
  const text = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}` : labels[0]
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** « 14:00:00 » ou « 14:30 » → « 14 h » ou « 14 h 30 ». */
export function formatTime(value: string): string {
  const [h, m] = value.split(':')
  return m && m !== '00' ? `${Number(h)} h ${m}` : `${Number(h)} h`
}

/** Heure d'une date : « 17 h 30 ». */
export function formatClock(date: Date): string {
  const m = date.getMinutes()
  return m ? `${date.getHours()} h ${String(m).padStart(2, '0')}` : `${date.getHours()} h`
}

/** « 14 h – 18 h » */
export function formatSlot(schedule: Pick<Schedule, 'starts_at' | 'ends_at'>): string {
  return `${formatTime(schedule.starts_at)} – ${formatTime(schedule.ends_at)}`
}

function at(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const date = new Date(day)
  date.setHours(h, m, 0, 0)
  return date
}

export interface NextChange {
  kind: 'ouverture' | 'fermeture'
  at: Date
}

/** Prochain début ou prochaine fin d'horaire, dans les 8 jours. */
export function nextScheduleChange(schedules: Schedule[], now = new Date()): NextChange | null {
  let best: NextChange | null = null
  for (let k = 0; k < 8; k++) {
    const day = new Date(now)
    day.setDate(day.getDate() + k)
    const weekday = isoWeekday(day)
    for (const s of schedules) {
      if (!s.weekdays.includes(weekday)) continue
      for (const [kind, time] of [['ouverture', s.starts_at], ['fermeture', s.ends_at]] as const) {
        const when = at(day, time)
        if (when > now && (!best || when < best.at)) best = { kind, at: when }
      }
    }
  }
  return best
}

/** « aujourd'hui à 18 h », « demain à 10 h », « samedi à 10 h ». */
export function formatWhen(date: Date, now = new Date()): string {
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000)
  const prefix = days === 0 ? 'aujourd’hui' : days === 1 ? 'demain' : WEEKDAYS[isoWeekday(date) - 1].label
  return `${prefix} à ${formatClock(date)}`
}

/** « à l'instant », « il y a 3 min », « il y a 2 h », « hier à 18 h », « 12 oct. à 18 h ». */
export function formatAgo(value: string | Date, now = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return `il y a ${Math.floor(minutes / 60)} h`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `hier à ${formatClock(date)}`
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${formatClock(date)}`
}
