import generated from '@/lib/montage.generated.json'

/**
 * Contenu de l'onglet Montage, produit par scripts/montage.mjs à partir de
 * docs/materiel.html, docs/notice.html et impression/*.stl. Les fichiers
 * eux-mêmes sont servis sous /fichiers/.
 */

export interface PurchaseItem {
  id: string
  ref: string
  article: string
  qty: string
  price: string
  check: string
  url: string | null
  shop: string | null
}

export interface NoticeStep {
  id: string
  num: string
  title: string
  part: string
  thumb: string | null
  /** HTML de l'étape, tiré de docs/notice.html (contenu du dépôt, pas de saisie) */
  html: string
}

interface MontageData {
  purchases: {
    intro: string[]
    groups: { name: string; items: PurchaseItem[] }[]
    totals: { label: string; price: string }[]
  }
  notice: { intro: { title: string; html: string } | null; steps: NoticeStep[] }
  prints: { file: string; bytes: number }[]
  pdf: { notice: boolean; materiel: boolean }
}

export const MONTAGE = generated as MontageData

export const PDF = {
  notice: '/fichiers/notice.pdf',
  materiel: '/fichiers/materiel.pdf',
}

export const stlUrl = (file: string) => `/fichiers/impression/${file}`

/** Une pièce à imprimer, avec ses variantes (gauche ou droite, longueur du doigt). */
export interface PrintPart {
  id: string
  title: string
  image: string | null
  settings: string
  variants: { file: string; label: string; bytes: number }[]
}

const PARTS: { id: string; title: string; pattern: RegExp; image: string; settings: string; label: (m: RegExpMatchArray) => string }[] = [
  {
    id: 'fond',
    title: 'Fond du boîtier',
    pattern: /^boitier-fond-(gauche|droite)\.stl$/,
    image: 'piece-fond.png',
    settings: 'Dos sur le plateau. Bordure (brim) de 5 mm si les coins décollent. Gauche : boîtier à gauche de la porte.',
    label: m => (m[1] === 'gauche' ? 'Gauche' : 'Droite'),
  },
  {
    id: 'facade',
    title: 'Façade',
    pattern: /^boitier-facade-(gauche|droite)\.stl$/,
    image: 'piece-facade.png',
    settings: 'Face avant sur le plateau. Le logement du roulement est serré exprès.',
    label: m => (m[1] === 'gauche' ? 'Gauche' : 'Droite'),
  },
  {
    id: 'taquet',
    title: 'Taquet',
    pattern: /^taquet-doigt-(\d+)\.stl$/,
    image: 'piece-taquet.png',
    settings: '6 parois et 50 % de remplissage : c’est lui qui encaisse les poussées. Longueur du doigt choisie avec la mesure « d » (notice, « Avant de commencer »).',
    label: m => `${m[1]} mm`,
  },
  {
    id: 'accouplement',
    title: 'Accouplement',
    pattern: /^accouplement\.stl$/,
    image: 'piece-accouplement.png',
    settings: 'Creux en croix sur le plateau, 100 % de remplissage.',
    label: () => 'Accouplement',
  },
  {
    id: 'bouchon',
    title: 'Bouchon de la prise USB',
    pattern: /^bouchon-usb\.stl$/,
    image: 'piece-bouchon.png',
    settings: 'Imprimez-en deux : il se perd.',
    label: () => 'Bouchon',
  },
  {
    id: 'passerelle',
    title: 'Boîtier de la passerelle',
    pattern: /^passerelle-(fond|couvercle)\.stl$/,
    image: 'piece-passerelle.png',
    settings: 'Il reste dans la maison : le PLA convient.',
    label: m => (m[1] === 'fond' ? 'Fond' : 'Couvercle'),
  },
]

/** Nom lisible d'un fichier inconnu : « support-batterie.stl » → « Support batterie ». */
function fallbackTitle(file: string): string {
  const base = file.replace(/\.stl$/, '').replace(/[-_]+/g, ' ')
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/** Pièces à imprimer, regroupées ; les fichiers inconnus forment chacun leur pièce. */
export function printParts(): PrintPart[] {
  const parts = new Map<string, PrintPart>()
  for (const { file, bytes } of MONTAGE.prints) {
    const known = PARTS.find(p => p.pattern.test(file))
    if (known) {
      const part = parts.get(known.id) ?? {
        id: known.id,
        title: known.title,
        image: `/fichiers/img/${known.image}`,
        settings: known.settings,
        variants: [],
      }
      part.variants.push({ file, bytes, label: known.label(file.match(known.pattern)!) })
      parts.set(known.id, part)
    } else {
      parts.set(file, { id: file, title: fallbackTitle(file), image: null, settings: '', variants: [{ file, bytes, label: fallbackTitle(file) }] })
    }
  }
  // Gauche (le boîtier de la porte de l'appli) avant droite, fond avant couvercle, doigts du plus court au plus long
  const rank = (file: string) => (/-gauche\.stl$|^passerelle-fond/.test(file) ? 0 : 1)
  for (const part of parts.values()) part.variants.sort((x, y) => rank(x.file) - rank(y.file) || x.file.localeCompare(y.file, 'fr', { numeric: true }))

  const order = PARTS.map(p => p.id)
  return [...parts.values()].sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.title.localeCompare(b.title)
  })
}

/** « 512 Ko », « 1,4 Mo » */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} Ko`
  return `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} Mo`
}
