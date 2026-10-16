'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Box, Check, ChevronRight, ExternalLink, FileText, ShoppingCart } from 'lucide-react'
import { usePassage } from '@/components/passage/PassageProvider'
import PdfViewer from '@/components/montage/PdfViewer'
import PieceViewer from '@/components/montage/PieceViewer'
import { usePurchases } from '@/components/montage/usePurchases'
import PageHeader from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import { MONTAGE, PDF, printParts, type PrintPart } from '@/lib/montage'
import { preloadFile } from '@/lib/share-file'
import { cn } from '@/lib/utils'

type View = 'achats' | 'impression' | 'notice'
const VIEWS: { value: View; label: string }[] = [
  { value: 'achats', label: 'Achats' },
  { value: 'impression', label: 'Impression' },
  { value: 'notice', label: 'Notice' },
]

/**
 * Tout pour monter la porte, dans l'ordre où on en a besoin : acheter,
 * imprimer, monter. Le contenu vient du dépôt (docs/ et impression/), recopié
 * à chaque construction par scripts/montage.mjs.
 */
export default function MontageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const param = searchParams.get('vue')
  const view: View = param === 'impression' || param === 'notice' ? param : 'achats'

  const setView = (next: View) => router.replace(next === 'achats' ? pathname : `${pathname}?vue=${next}`, { scroll: false })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Montage" subtitle="Acheter, imprimer, monter : tout pour poser la porte." />
      <Segmented label="Partie" value={view} onChange={setView} options={VIEWS} itemClassName="h-8 text-footnote" />
      {view === 'achats' && <Purchases />}
      {view === 'impression' && <Prints />}
      {view === 'notice' && <Notice />}
    </div>
  )
}

/**
 * Un PDF du dépôt, lu dans l'appli (PdfViewer), avec le bouton Partager de la
 * feuille de partage. Un lien vers le fichier l'ouvrait dans l'appli installée
 * sur iPhone, sans bouton pour en sortir. Téléchargé à l'avance : la lecture
 * démarre tout de suite, et Safari n'accepte le partage que dès le toucher.
 */
function PdfRow({ href, name, title, subtitle, icon }: { href: string; name: string; title: string; subtitle: string; icon: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => void preloadFile(href).catch(() => {}), 1500)
    return () => clearTimeout(timer)
  }, [href])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-stretch gap-3 pl-4 text-left active:bg-fill-soft">
        <span className="flex shrink-0 items-center">{icon}</span>
        <span className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 border-t border-separator py-2 pr-4 [*:first-child>&]:border-t-0">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body">{title}</span>
            <span className="text-footnote text-ink-muted">{subtitle}</span>
          </span>
          <ChevronRight size={18} strokeWidth={2.4} className="shrink-0 text-ink-faint" aria-hidden="true" />
        </span>
      </button>
      {open && <PdfViewer url={href} name={name} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}

// ─── Achats ─────────────────────────────────────────────────────────────────

function Purchases() {
  const { userId } = usePassage()
  const { checked, toggle, clear } = usePurchases(userId)
  const { intro, groups, totals } = MONTAGE.purchases
  const all = groups.flatMap(g => g.items)
  const done = all.filter(i => checked.has(i.id)).length

  if (all.length === 0) {
    return (
      <ListSection>
        <PdfRow href={PDF.materiel} name="liste-achat-porte-magique.pdf" title="Liste d’achat" subtitle="PDF : lire, imprimer ou partager" icon={<IconTile className="bg-tile-green"><ShoppingCart size={18} aria-hidden="true" /></IconTile>} />
      </ListSection>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-title font-semibold">
            {done} sur {all.length}
          </p>
          <p className="text-footnote text-ink-muted">articles achetés</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-fill-soft" aria-hidden="true">
          <div className="h-full rounded-full bg-tile-green transition-[width] duration-500" style={{ width: `${(done / all.length) * 100}%` }} />
        </div>
        {intro.map(p => (
          <p key={p} className="text-footnote text-ink-muted">{p}</p>
        ))}
      </div>

      {groups.map(group => (
        <ListSection key={group.name} header={group.name}>
          {group.items.map(item => {
            const on = checked.has(item.id)
            return (
              <div key={item.id} className="flex w-full items-stretch gap-3 pl-3">
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={on}
                  aria-label={`${on ? 'Décocher' : 'Cocher'} : ${item.article}`}
                  className="flex w-11 shrink-0 items-start justify-center pt-3.5"
                >
                  <span
                    className={cn(
                      'flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-colors',
                      on ? 'border-tile-green bg-tile-green text-white' : 'border-chip-edge',
                    )}
                  >
                    {on && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                  </span>
                </button>
                <div className="flex min-w-0 flex-1 items-start gap-2 border-t border-separator py-3 pr-4 [*:first-child>&]:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-body', on && 'text-ink-muted line-through decoration-1')}>
                      {item.ref && <span className="mr-1.5 font-semibold text-accent">{item.ref}</span>}
                      {item.article}
                    </p>
                    <p className="text-footnote font-semibold text-ink">
                      {item.qty !== '1' ? `× ${item.qty} · ` : ''}
                      {item.price}
                    </p>
                    {item.check && <p className="mt-0.5 text-footnote text-ink-muted">{item.check}</p>}
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-mr-1 flex h-11 shrink-0 items-center gap-1 rounded-full bg-accent-soft px-3 text-footnote font-semibold text-accent"
                    >
                      {item.shop === 'Amazon' ? 'Amazon' : 'Voir'}
                      <ExternalLink size={13} strokeWidth={2.4} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </ListSection>
      ))}

      {totals.length > 0 && (
        <ListSection header="Budget">
          {totals.map(t => (
            <ListRow key={t.label} title={t.label} trailing={<span className="text-body font-semibold">{t.price}</span>} />
          ))}
        </ListSection>
      )}

      <ListSection footer="Les coches restent sur ce téléphone.">
        {MONTAGE.pdf.materiel && (
          <PdfRow href={PDF.materiel} name="liste-achat-porte-magique.pdf" title="Liste d’achat en PDF" subtitle="Lire, imprimer ou partager" icon={<IconTile className="bg-tile-green"><FileText size={18} aria-hidden="true" /></IconTile>} />
        )}
        {done > 0 && (
          <ListRow
            leading={<span className="w-[30px]" />}
            title="Tout décocher"
            tone="danger"
            onClick={() => {
              if (confirm('Décocher tous les articles ?')) clear()
            }}
          />
        )}
      </ListSection>
    </>
  )
}

// ─── Impression ─────────────────────────────────────────────────────────────

function Prints() {
  const parts = printParts()
  const [open, setOpen] = useState<{ part: PrintPart; file: string } | null>(null)

  if (parts.length === 0) {
    return <p className="text-center text-subhead text-ink-muted">Aucun fichier à imprimer pour l’instant.</p>
  }

  return (
    <>
      <p className="mx-4 -mt-2 text-footnote text-ink-muted">
        PETG (jamais de PLA dehors), buse de 0,4 mm, couches de 0,2 mm, 4 parois, 30 % de gyroïde, sans support. Les fichiers sont déjà posés dans le bon sens.
      </p>
      <div className="grid gap-4">
        {parts.map(part => (
          <article key={part.id} className="overflow-hidden rounded-2xl bg-card">
            <button
              type="button"
              onClick={() => setOpen({ part, file: part.variants[0].file })}
              className="relative block w-full bg-white"
              aria-label={`Voir ${part.title} en 3D`}
            >
              {part.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- dessin statique, déjà à la bonne taille
                <img src={part.image} alt="" className="mx-auto h-44 w-full object-contain p-2" />
              ) : (
                <span className="flex h-32 items-center justify-center text-ink-faint">
                  <Box size={40} aria-hidden="true" />
                </span>
              )}
              <span className="absolute bottom-2.5 right-2.5 flex h-8 items-center gap-1.5 rounded-full bg-accent-fill px-3 text-footnote font-semibold text-white shadow-sheen">
                <Box size={15} strokeWidth={2.4} aria-hidden="true" />
                Voir en 3D
              </span>
            </button>
            <div className="flex flex-col gap-2 p-3.5">
              <h3 className="text-body font-semibold">{part.title}</h3>
              {part.settings && <p className="text-footnote text-ink-muted">{part.settings}</p>}
              {part.variants.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {part.variants.map(v => (
                    <button
                      key={v.file}
                      type="button"
                      onClick={() => setOpen({ part, file: v.file })}
                      className="h-8 rounded-full border border-chip-edge bg-card px-3 text-footnote font-semibold text-ink"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {open && <PieceViewer part={open.part} initialFile={open.file} onClose={() => setOpen(null)} />}
    </>
  )
}

// ─── Notice ─────────────────────────────────────────────────────────────────

function Notice() {
  const { intro, steps } = MONTAGE.notice
  const parts = [...new Set(steps.map(s => s.part))]

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- dessin statique, déjà à la bonne taille */}
      <img src="/fichiers/img/apercu.png" alt="Le boîtier posé sur la clôture, taquet fermé devant le bord de la porte" className="w-full rounded-2xl bg-white" />

      <ListSection>
        {intro && (
          <ListRow
            href="/montage/etape/avant"
            leading={<IconTile className="bg-tile-amber"><BookOpen size={18} aria-hidden="true" /></IconTile>}
            title={intro.title}
            subtitle="Le côté du boîtier, la mesure « d » et les outils"
          />
        )}
        {MONTAGE.pdf.notice && (
          <PdfRow href={PDF.notice} name="notice-porte-magique.pdf" title="Notice complète en PDF" subtitle="Lire, imprimer ou partager" icon={<IconTile className="bg-tile-blue"><FileText size={18} aria-hidden="true" /></IconTile>} />
        )}
      </ListSection>

      {parts.map(part => (
        <ListSection key={part} header={part}>
          {steps
            .filter(s => s.part === part)
            .map(step => (
              <Link
                key={step.id}
                href={`/montage/etape/${step.id}`}
                prefetch
                className="flex w-full items-stretch gap-3 pl-4 text-left active:bg-fill-soft"
              >
                <span className="my-2 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                  {step.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette d'un dessin statique
                    <img src={step.thumb} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-body font-bold text-ink-muted">{step.num}</span>
                  )}
                </span>
                <span className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 border-t border-separator py-2 pr-4 [*:first-child>&]:border-t-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-footnote font-semibold text-accent">{step.num === '!' ? 'Important' : `Étape ${step.num}`}</span>
                    <span className="text-body">{step.title}</span>
                  </span>
                </span>
              </Link>
            ))}
        </ListSection>
      ))}
    </>
  )
}
