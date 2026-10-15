'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import Sheet from '@/components/layout/Sheet'
import Button from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { glassButton } from '@/components/ui/glass'
import { usePassageData } from '@/components/passage/PassageData'
import { WEEKDAYS } from '@/lib/schedules'
import { cn } from '@/lib/utils'
import type { Schedule } from '@/lib/types'

const PRESETS = [
  { label: 'Tous les jours', days: [1, 2, 3, 4, 5, 6, 7] },
  { label: 'En semaine', days: [1, 2, 3, 4, 5] },
  { label: 'Week-end', days: [6, 7] },
]

/** « 14:00:00 » → « 14:00 », la valeur d'un champ heure */
const hhmm = (value: string) => value.slice(0, 5)

/**
 * Ajouter ou modifier un horaire : les jours (pastilles L M M J V S D), l'heure
 * d'ouverture et l'heure de fermeture. Feuille plein écran, comme l'ajout d'un
 * produit dans Fridge.
 */
export default function ScheduleSheet({ initial, onClose }: { initial: Schedule | null; onClose: () => void }) {
  const { saveSchedule, deleteSchedule } = usePassageData()
  const [days, setDays] = useState<number[]>(initial?.weekdays ?? [3, 6, 7])
  const [start, setStart] = useState(initial ? hhmm(initial.starts_at) : '14:00')
  const [end, setEnd] = useState(initial ? hhmm(initial.ends_at) : '18:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (iso: number) => setDays(list => (list.includes(iso) ? list.filter(d => d !== iso) : [...list, iso].sort()))

  const save = async () => {
    if (days.length === 0) return setError('Choisissez au moins un jour.')
    if (!start || !end || end <= start) return setError('L’heure de fermeture doit venir après l’heure d’ouverture.')
    setError(null)
    setSaving(true)
    const ok = await saveSchedule({ id: initial?.id, weekdays: days, starts_at: start, ends_at: end })
    setSaving(false)
    if (ok) onClose()
  }

  const remove = async () => {
    if (!initial) return
    onClose()
    await deleteSchedule(initial.id)
  }

  return (
    <div className="relative z-50">
      <Sheet
        title={initial ? 'Modifier l’horaire' : 'Nouvel horaire'}
        cancel={
          <button type="button" onClick={onClose} aria-label="Annuler" className={glassButton('round')}>
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        }
        footer={
          <>
            <Button loading={saving} onClick={save}>Enregistrer</Button>
            {initial && (
              <Button variant="plain" className="text-danger" onClick={remove} disabled={saving}>
                Supprimer l’horaire
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="ml-4 text-footnote uppercase tracking-[0.3px] text-ink-muted">Jours</h2>
            <div className="flex justify-between gap-1 rounded-xl bg-card px-3 py-3" role="group" aria-label="Jours">
              {WEEKDAYS.map(d => {
                const on = days.includes(d.iso)
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => toggle(d.iso)}
                    aria-pressed={on}
                    aria-label={d.label}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-full text-body font-semibold transition-colors',
                      on ? 'bg-accent-fill text-white' : 'bg-fill-soft text-ink',
                    )}
                  >
                    {d.short}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDays(p.days)}
                  className="h-9 rounded-full border border-chip-edge bg-card px-3.5 text-subhead text-ink"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="ml-4 text-footnote uppercase tracking-[0.3px] text-ink-muted">Heures</h2>
            <div className="overflow-hidden rounded-xl bg-card">
              <label className="flex min-h-[52px] items-center justify-between gap-3 px-4">
                <span className="text-body">Ouverture</span>
                <input type="time" value={start} onChange={e => setStart(e.target.value)} className="h-[52px] bg-transparent text-right text-body text-accent outline-none" />
              </label>
              <label className="flex min-h-[52px] items-center justify-between gap-3 border-t border-separator px-4">
                <span className="text-body">Fermeture</span>
                <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="h-[52px] bg-transparent text-right text-body text-accent outline-none" />
              </label>
            </div>
            <p className="mx-4 text-footnote text-ink-muted">
              La porte s’ouvre à la première heure et se ferme à la seconde. Un ordre donné dans l’appli entre-temps l’emporte jusqu’au prochain changement.
            </p>
          </section>

          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Sheet>
    </div>
  )
}
