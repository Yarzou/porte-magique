/**
 * Partager un fichier de l'appli (PDF, STL) avec la feuille de partage du
 * téléphone : enregistrer dans Fichiers, imprimer, envoyer.
 *
 * Pourquoi pas un simple lien : dans l'appli installée sur iPhone, un fichier
 * du même site s'ouvre dans la fenêtre de l'appli, qui n'a ni barre d'adresse
 * ni bouton retour. On ne pouvait plus en sortir. La feuille de partage, elle,
 * se ferme toujours. Sans partage de fichiers (ordinateur), le fichier s'ouvre
 * dans un nouvel onglet, où le navigateur offre de quoi revenir.
 */

const cache = new Map<string, Promise<Blob>>()

/**
 * Télécharge le fichier à l'avance. Safari n'accepte le partage que tout de
 * suite après le toucher : le fichier doit déjà être là à ce moment.
 */
export function preloadFile(url: string): Promise<Blob> {
  let pending = cache.get(url)
  if (!pending) {
    pending = fetch(url).then(res => {
      if (!res.ok) throw new Error(String(res.status))
      return res.blob()
    })
    pending.catch(() => cache.delete(url))
    cache.set(url, pending)
  }
  return pending
}

/** Le navigateur sait-il partager un fichier de ce type ? */
export function canShareFile(name: string, type: string): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], name, { type })] })
  } catch {
    return false
  }
}

export type ShareResult = 'partage' | 'ouvert' | 'annule' | 'reessayer' | 'impossible' | 'echec'

/** Appli installée sur iPhone ou iPad (Safari est seul à définir navigator.standalone). */
function iosApp(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export async function shareFile(url: string, name: string, type: string, title: string): Promise<ShareResult> {
  // Sur un ordinateur, dans un onglet : le nouvel onglet suffit (Windows et macOS savent aussi
  // partager, mais on veut voir le fichier)
  const app = iosApp() || matchMedia('(display-mode: standalone)').matches
  if (!app && !matchMedia('(pointer: coarse)').matches) {
    window.open(url, '_blank', 'noopener')
    return 'ouvert'
  }
  // Un type que Safari refuse de partager passe souvent comme fichier générique
  if (!canShareFile(name, type) && canShareFile(name, 'application/octet-stream')) type = 'application/octet-stream'
  if (!canShareFile(name, type)) {
    // Dans l'appli installée sur iPhone, ouvrir le fichier y enfermerait : on s'abstient
    if (iosApp()) return 'impossible'
    window.open(url, '_blank', 'noopener')
    return 'ouvert'
  }
  try {
    const blob = await preloadFile(url)
    await navigator.share({ files: [new File([blob], name, { type })], title })
    return 'partage'
  } catch (err) {
    const reason = (err as Error).name
    if (reason === 'AbortError') return 'annule'
    // Le téléchargement a pris trop de temps : le toucher ne compte plus. Il est en cache pour le suivant.
    if (reason === 'NotAllowedError') return 'reessayer'
    return 'echec'
  }
}
