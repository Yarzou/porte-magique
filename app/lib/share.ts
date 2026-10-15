/**
 * Partage d'un lien (invitation) : la feuille de partage du téléphone si elle
 * existe, sinon le presse-papiers.
 */
export async function shareLink(url: string, title: string, text: string): Promise<'partage' | 'copie' | 'annule' | 'echec'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, title, text })
      return 'partage'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'annule'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copie'
  } catch {
    return 'echec'
  }
}
