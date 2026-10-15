import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { glassButton } from '@/components/ui/glass'
import { buttonClass } from '@/components/ui/Button'
import { MONTAGE } from '@/lib/montage'

/**
 * Une étape de la notice, telle qu'elle est écrite dans docs/notice.html
 * (dessins, consignes, mises en garde), avec l'étape précédente et la
 * suivante. « avant » : la partie « Avant de commencer ».
 */
export default async function EtapePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { intro, steps } = MONTAGE.notice

  const ids = [...(intro ? ['avant'] : []), ...steps.map(s => s.id)]
  const index = ids.indexOf(id)
  if (index < 0) notFound()

  const step = id === 'avant' ? null : steps.find(s => s.id === id)!
  const title = step ? step.title : intro!.title
  const html = step ? step.html : intro!.html
  const label = step ? (step.num === '!' ? 'Important' : `Étape ${step.num} sur ${steps.length}`) : 'Avant le montage'
  const prev = index > 0 ? ids[index - 1] : null
  const next = index < ids.length - 1 ? ids[index + 1] : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        badge={<span className="text-footnote font-semibold text-accent">{label}</span>}
        leading={
          <Link href="/montage?vue=notice" aria-label="Retour à la notice" className={glassButton('round')}>
            <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        }
      />

      {/* Contenu du dépôt (docs/notice.html), recopié par scripts/montage.mjs : pas de saisie */}
      <div className="notice-etape" dangerouslySetInnerHTML={{ __html: html }} />

      <div className="mt-2 grid grid-cols-2 gap-2">
        {prev ? (
          <Link href={`/montage/etape/${prev}`} prefetch className={buttonClass('secondary')}>
            <ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" />
            Précédente
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/montage/etape/${next}`} prefetch className={buttonClass('primary')}>
            Suivante
            <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        ) : (
          <Link href="/montage?vue=notice" className={buttonClass('primary')}>
            Terminé
          </Link>
        )}
      </div>
    </div>
  )
}
