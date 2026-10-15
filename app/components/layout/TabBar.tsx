'use client'

import { useEffect, useRef, useState, type PointerEvent, type Ref } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarClock, DoorOpen, Hammer, Settings, type LucideIcon } from 'lucide-react'
import GlassLens from '@/components/ui/GlassLens'
import { useLoupe, type Lens } from '@/components/ui/useLoupe'
import { cn } from '@/lib/utils'

interface Tab {
  href: string
  label: string
  icon: LucideIcon
  /** Autres préfixes d'URL qui allument l'onglet. */
  also?: string[]
}

const TABS: Tab[] = [
  { href: '/passage', label: 'Passage', icon: DoorOpen },
  { href: '/horaires', label: 'Horaires', icon: CalendarClock },
  { href: '/montage', label: 'Montage', icon: Hammer },
  { href: '/reglages', label: 'Réglages', icon: Settings },
]

/** Pages préchargées en entier : changer d'onglet part du cache. */
const PREFETCHED = TABS.map(tab => tab.href)

/** Marge intérieure de la barre (p-1), en px : la bulle ne la franchit pas. */
const INSET = 4
/** Marge de la bulle autour de l'icône et du libellé, de chaque côté. */
const PAD_X = 14
/** La loupe dépasse la bulle de 13 px de chaque côté, soit 8 px au-delà de la barre. */
const GROW = 13
interface Slot {
  /** Bord gauche du contenu (icône + libellé), depuis le bord intérieur de la barre */
  left: number
  width: number
}

interface Bar {
  /** Largeur et hauteur intérieures (sans la bordure) */
  width: number
  height: number
  /** Épaisseur de la bordure */
  border: number
  slots: Slot[]
}

/** Onglet sous un point de la barre (abscisse depuis son bord intérieur gauche). */
function tabAt(x: number, bar: Bar) {
  return Math.min(TABS.length - 1, Math.max(0, Math.floor(((x - INSET) / (bar.width - INSET * 2)) * TABS.length)))
}

/** Largeur de la bulle autour du contenu d'un onglet. */
function bubbleWidth(bar: Bar, i: number) {
  return Math.min(bar.slots[i].width + PAD_X * 2, bar.width - INSET * 2)
}

/** Bord gauche d'une bulle centrée sur `center`, sans sortir de la barre. */
function bubbleLeft(bar: Bar, center: number, width: number) {
  return Math.min(Math.max(center - width / 2, INSET), bar.width - INSET - width)
}

/** Icône et libellé d'un onglet : dans la barre, et agrandis dans la loupe. */
function TabContent({ tab, ref }: { tab: Tab; ref?: Ref<HTMLSpanElement> }) {
  const { label, icon: Icon } = tab
  return (
    <span ref={ref} className="relative flex flex-col items-center gap-0.5 text-caption font-semibold">
      <Icon size={24} strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  )
}

/**
 * Barre d'onglets flottante en verre, façon « Liquid Glass » d'iOS 26, reprise
 * de Fridge.
 *
 * Au repos, la barre est très transparente et peu floutée : on devine la liste
 * qui défile dessous. Elle devient presque opaque dès que le doigt s'y pose.
 *
 * L'onglet choisi est marqué par une bulle taillée sur mesure : elle entoure
 * l'icône et le libellé de l'onglet (plus large pour « Réglages » que pour
 * « Passage »), mesurés par un ResizeObserver.
 * - Doigt posé, la bulle se soulève en loupe de verre clair, plus grande que
 *   la barre (GlassLens) : elle rejoint le doigt, le suit d'un onglet à
 *   l'autre et agrandit les icônes et les libellés qu'elle couvre. Son bord
 *   floute et irise l'onglet voisin et la page qui passe dessous.
 * - Au lâcher, elle se pose sur l'onglet touché, ou sur le plus proche après
 *   un glissé, en s'étirant comme une goutte d'eau, sans attendre la page.
 * Avec « Réduire les animations », elle se déplace sans effet.
 */
export default function TabBar() {
  const pathname = usePathname()
  const router = useRouter()

  const barRef = useRef<HTMLDivElement>(null)
  const contentRefs = useRef<(HTMLSpanElement | null)[]>([])
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const swallowClick = useRef(false)
  // Onglet visé au toucher, oublié dès que l'URL change. Le garder tant que
  // l'URL restait celle du toucher ne suffisait pas : revenu sur cette URL par
  // un lien de la page, la bulle reprenait l'onglet
  // touché alors.
  const [pending, setPending] = useState<number | null>(null)
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setPending(null)
  }
  const { lens, grab, follow, drop } = useLoupe()
  // La goutte ne se déforme qu'après un premier geste, pas à l'ouverture de l'appli
  const [touched, setTouched] = useState(false)
  const [bar, setBar] = useState<Bar | null>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect()
      setBar({
        width: el.clientWidth,
        height: el.clientHeight,
        border: el.clientLeft,
        slots: contentRefs.current.map(content => {
          const r = content?.getBoundingClientRect()
          return r ? { left: r.left - box.left - el.clientLeft, width: r.width } : { left: 0, width: 0 }
        }),
      })
    })
    observer.observe(el)
    contentRefs.current.forEach(content => content && observer.observe(content))
    return () => observer.disconnect()
  }, [])

  // Les liens préchargent les onglets à l'ouverture (prefetch,
  // en production). Au retour au premier plan, le cache du routeur a pu
  // expirer pendant la veille : on le remplit de nouveau, pour que le
  // prochain toucher n'attende pas le serveur.
  useEffect(() => {
    const warm = () => {
      if (document.visibilityState === 'visible') PREFETCHED.forEach(href => router.prefetch(href))
    }
    document.addEventListener('visibilitychange', warm)
    return () => document.removeEventListener('visibilitychange', warm)
  }, [router])

  const activeIndex = TABS.findIndex(
    ({ href, also }) => pathname.startsWith(href) || (also ?? []).some(p => pathname.startsWith(p)),
  )
  const index = pending ?? activeIndex
  const lifted = lens !== null && bar !== null
  // Doigt posé : l'onglet sous la loupe prend la couleur de l'onglet choisi
  const highlighted = lifted ? tabAt(lens.center, bar) : index

  const localX = (clientX: number) => {
    const el = barRef.current!
    return clientX - el.getBoundingClientRect().left - el.clientLeft
  }

  /** La loupe vise le doigt, avec la largeur de l'onglet survolé. */
  const aim = (x: number): Lens => ({ center: x, width: bar ? bubbleWidth(bar, tabAt(x, bar)) : 0 })

  /** La bulle part tout de suite vers l'onglet, sans attendre la page. */
  const mark = (next: number) => {
    setTouched(true)
    setPending(next)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!bar) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
    setTouched(true)
    // La loupe part de la bulle de l'onglet choisi pour rejoindre le doigt.
    const x = localX(e.clientX)
    const start = index >= 0 ? index : tabAt(x, bar)
    const width = bubbleWidth(bar, start)
    grab({ center: bubbleLeft(bar, bar.slots[start].left + bar.slots[start].width / 2, width) + width / 2, width }, aim(x))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging && Math.abs(e.clientX - g.startX) >= 8) {
      g.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    follow(aim(localX(e.clientX)))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    drop()
    if (!g || !bar) return
    if (g.dragging) {
      swallowClick.current = true
      const next = tabAt(localX(e.clientX), bar)
      mark(next)
      if (next !== activeIndex) router.push(TABS[next].href)
      return
    }
    // Simple toucher : la bulle se pose sur l'onglet touché dès le lâcher, le
    // clic qui suit ouvre la page.
    const tab = e.type === 'pointerup' ? (e.target as Element).closest<HTMLElement>('[data-tab]') : null
    if (tab) mark(Number(tab.dataset.tab))
  }

  // Bulle : autour du contenu de l'onglet choisi, ou cachée sous la loupe, qu'elle
  // suit pour partir de là au lâcher.
  let bubble: { left: number; width: number } | null = null
  if (lifted) {
    bubble = { left: bubbleLeft(bar, lens.center, lens.width), width: lens.width }
  } else if (bar && index >= 0) {
    const width = bubbleWidth(bar, index)
    bubble = { left: bubbleLeft(bar, bar.slots[index].left + bar.slots[index].width / 2, width), width }
  }

  return (
    <nav aria-label="Navigation principale" className="bottom-tabbar fixed inset-x-0 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center gap-2.5">
        {/* La loupe est posée à côté de la barre, pas dedans : le flou de la barre
            limiterait le sien au contenu de la barre, et la page ne se verrait pas
            au travers de ce qui déborde. */}
        <div className="relative flex-1">
          <div
            ref={barRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onClickCapture={e => {
              // Fin d'un glissé : la navigation est déjà partie, pas de second clic.
              // Le clic du clavier (detail 0) n'est jamais celui d'un glissé.
              if (swallowClick.current && e.detail !== 0) {
                e.preventDefault()
                e.stopPropagation()
                swallowClick.current = false
              }
            }}
            className={cn(
              // Verre léger et peu flouté (components/ui/glass.ts), même arête que le reste du verre
              'relative grid h-[62px] touch-none select-none grid-cols-4 rounded-full border border-glass-rim p-1 shadow-sheen backdrop-blur-[10px] backdrop-saturate-[1.8] transition-colors duration-200',
              lifted ? 'bg-glass-pressed' : 'bg-glass-thin',
            )}
          >
            {bubble && (
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-y-1 left-0',
                  // Sous la loupe, elle la suit image par image, sans transition.
                  !lifted && 'transition-[transform,width] duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none',
                )}
                style={{ transform: `translateX(${bubble.left}px)`, width: bubble.width }}
              >
                <span
                  key={touched ? index : 'repos'}
                  className={cn(
                    'block h-full w-full rounded-full bg-bubble shadow-bubble',
                    lifted ? 'opacity-0' : touched && 'motion-safe:animate-bubble',
                  )}
                />
              </span>
            )}

            {TABS.map((tab, i) => (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch
                draggable={false}
                data-tab={i}
                onClick={() => mark(i)}
                aria-current={i === activeIndex ? 'page' : undefined}
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full transition-colors duration-300',
                  i === highlighted ? 'text-accent' : 'text-ink-muted',
                )}
              >
                <TabContent
                  tab={tab}
                  ref={el => {
                    contentRefs.current[i] = el
                  }}
                />
              </Link>
            ))}
          </div>
          {lifted && bubble && (
            <GlassLens
              rest={{
                left: bar.border + bubble.left,
                top: bar.border + INSET,
                width: bubble.width,
                height: bar.height - INSET * 2,
              }}
              grow={GROW}
              surface={{ left: bar.border, top: bar.border, width: bar.width, height: bar.height }}
              surfaceClassName="bg-loupe"
              content={{
                left: bar.border + INSET,
                top: bar.border + INSET,
                width: bar.width - INSET * 2,
                height: bar.height - INSET * 2,
              }}
              focus={bar.border + lens.center}
            >
              <span className="grid h-full grid-cols-4">
                {TABS.map((tab, i) => (
                  <span
                    key={tab.href}
                    className={cn('flex items-center justify-center', i === highlighted ? 'text-accent' : 'text-ink-muted')}
                  >
                    <TabContent tab={tab} />
                  </span>
                ))}
              </span>
            </GlassLens>
          )}
        </div>
      </div>
    </nav>
  )
}
