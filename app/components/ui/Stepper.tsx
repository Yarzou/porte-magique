import { Minus, Plus } from 'lucide-react'

interface StepperProps {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  /** Libellés des deux boutons pour le lecteur d'écran : « Un degré de moins »… */
  decreaseLabel: string
  increaseLabel: string
  /** Pas de chaque appui (1 par défaut) */
  step?: number
}

const BUTTON =
  "relative flex h-8 w-[46px] items-center justify-center text-ink disabled:opacity-40 before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']"

/**
 * − et + côte à côte, comme le UIStepper d'iOS. Les boutons font 32 px de haut,
 * mais leur zone de toucher en fait 44.
 */
export default function Stepper({ value, min, max, onChange, decreaseLabel, increaseLabel, step = 1 }: StepperProps) {
  return (
    <div className="flex h-8 shrink-0 items-center rounded-lg bg-fill-soft">
      <button
        type="button"
        aria-label={decreaseLabel}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className={BUTTON}
      >
        <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <span className="h-[18px] w-px bg-grabber" aria-hidden="true" />
      <button
        type="button"
        aria-label={increaseLabel}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className={BUTTON}
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  )
}
