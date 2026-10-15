'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * Articles cochés de la liste d'achat, sur ce téléphone seulement
 * (localStorage). Lu par useSyncExternalStore : vide au rendu serveur, puis la
 * vraie valeur à l'hydratation, sans setState dans un effet.
 */
const EVENT = 'achats-coches'
const key = (userId: string) => `montage-achats:${userId}`

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

function read(userId: string): string {
  try {
    return localStorage.getItem(key(userId)) ?? ''
  } catch {
    return ''
  }
}

export function usePurchases(userId: string) {
  const raw = useSyncExternalStore(subscribe, () => read(userId), () => '')
  const checked = useMemo(() => new Set(raw ? raw.split(',') : []), [raw])

  const write = useCallback(
    (next: Set<string>) => {
      try {
        localStorage.setItem(key(userId), [...next].join(','))
      } catch {}
      window.dispatchEvent(new Event(EVENT))
    },
    [userId],
  )

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(checked)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      write(next)
    },
    [checked, write],
  )

  const clear = useCallback(() => write(new Set()), [write])

  return { checked, toggle, clear }
}
