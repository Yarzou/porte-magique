'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Minus, Plus, Share, X } from 'lucide-react'
import { GLASS, glassButton } from '@/components/ui/glass'
import { preloadFile, shareFile } from '@/lib/share-file'
import { cn } from '@/lib/utils'

interface Page {
  src: string
  ratio: number
}

const ZOOMS = [1, 1.5, 2, 3]

/**
 * Lecteur de PDF dans l'appli : les pages défilent, se zooment, et le bouton
 * Partager ouvre la feuille de partage (Enregistrer, Imprimer, AirDrop). Dans
 * l'appli installée sur iPhone, ouvrir le fichier lui-même enfermait dans une
 * fenêtre sans bouton retour : ici, la croix ramène toujours à l'appli.
 *
 * pdf.js (le lecteur de Firefox) n'est chargé qu'à l'ouverture. Chaque page est
 * dessinée une fois, puis gardée en image : le téléphone n'a pas à conserver
 * quatorze grandes zones de dessin.
 */
export default function PdfViewer({ url, name, title, onClose }: { url: string; name: string; title: string; onClose: () => void }) {
  const [pages, setPages] = useState<Page[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []

    async function render() {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = '/fichiers/pdf.worker.min.mjs'
      const data = new Uint8Array(await (await preloadFile(url)).arrayBuffer())
      const task = pdfjs.getDocument({ data })
      const doc = await task.promise
      if (cancelled) {
        void task.destroy()
        return
      }
      setTotal(doc.numPages)
      // Dessinées 1,5 fois plus grandes que l'écran : nettes jusqu'au zoom ×1,5, correctes au-delà
      const width = (scrollRef.current?.clientWidth ?? 390) - 24
      const density = Math.min(window.devicePixelRatio || 1, 2) * 1.5
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (width * density) / base.width })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await page.render({ canvas, viewport }).promise
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
        canvas.width = 0
        canvas.height = 0
        page.cleanup()
        if (!blob || cancelled) continue
        const src = URL.createObjectURL(blob)
        urls.push(src)
        setPages(list => [...list, { src, ratio: base.width / base.height }])
      }
      void task.destroy()
    }

    render().catch(err => {
      console.error('[pdf]', err)
      if (!cancelled) setFailed(true)
    })
    return () => {
      cancelled = true
      urls.forEach(u => URL.revokeObjectURL(u))
    }
  }, [url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const share = async () => {
    setMessage(null)
    const result = await shareFile(url, name, 'application/pdf', title)
    if (result === 'reessayer') setMessage('Le fichier est prêt : touchez Partager encore une fois.')
    if (result === 'impossible') setMessage('Ce téléphone ne sait pas partager ce PDF.')
    if (result === 'echec') setMessage('Partage impossible. Vérifiez votre connexion.')
  }

  const ratio = pages[0]?.ratio ?? 210 / 297
  const scale = ZOOMS[zoom]

  return (
    <div className="pt-safe fixed inset-0 z-50 flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative flex h-12 shrink-0 items-center px-4">
        <button type="button" onClick={onClose} aria-label="Fermer" className={cn(glassButton('round'), 'relative z-10')}>
          <X size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <div className="pointer-events-none absolute inset-x-16 flex flex-col items-center">
          <h1 className="truncate text-body font-semibold">{title}</h1>
          {total && <p className="text-caption text-ink-muted">{total} pages</p>}
        </div>
        <button type="button" onClick={share} aria-label="Partager" className={cn(glassButton('round'), 'relative z-10 ml-auto')}>
          <Share size={19} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain px-3 pb-28 pt-2">
        {failed ? (
          <p className="mt-24 text-center text-subhead text-ink-muted">
            Impossible d’afficher le PDF. Vérifiez votre connexion, ou partagez-le pour l’ouvrir ailleurs.
          </p>
        ) : (
          <div className="mx-auto flex flex-col gap-3" style={{ width: `${scale * 100}%` }}>
            {Array.from({ length: total ?? 1 }, (_, i) => {
              const page = pages[i]
              return page ? (
                // eslint-disable-next-line @next/next/no-img-element -- page dessinée par pdf.js, en mémoire
                <img
                  key={page.src}
                  src={page.src}
                  alt={`Page ${i + 1}`}
                  className="block w-full rounded-md bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                  style={{ aspectRatio: page.ratio }}
                />
              ) : (
                <div key={i} className="flex w-full items-center justify-center rounded-md bg-card" style={{ aspectRatio: ratio }}>
                  <LoaderCircle size={24} className="animate-spin text-ink-faint" aria-hidden="true" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Zoom : boutons plutôt que pincement, qui agrandirait aussi la barre du haut */}
      <div className="pb-safe pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-3">
        {message && (
          <p className={cn('pointer-events-auto rounded-2xl px-4 py-2.5 text-center text-subhead text-ink', GLASS)}>{message}</p>
        )}
        <div className={cn('pointer-events-auto mb-2 flex h-11 items-center rounded-full', GLASS)}>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0, z - 1))}
            disabled={zoom === 0}
            aria-label="Réduire"
            className="flex h-11 w-12 items-center justify-center text-ink disabled:opacity-40"
          >
            <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <span className="w-14 text-center text-subhead font-semibold tabular-nums">{Math.round(scale * 100)} %</span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(ZOOMS.length - 1, z + 1))}
            disabled={zoom === ZOOMS.length - 1}
            aria-label="Agrandir"
            className="flex h-11 w-12 items-center justify-center text-ink disabled:opacity-40"
          >
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
