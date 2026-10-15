'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Membership } from '@/lib/types'

interface PassageContextValue {
  membership: Membership
  userId: string
}

const PassageContext = createContext<PassageContextValue | null>(null)

/**
 * Passage et famille de la personne, lus une fois par le layout serveur de
 * (app) et transmis aux pages clientes : elles n'ont pas à refaire la requête.
 */
export function PassageProvider({ value, children }: { value: PassageContextValue; children: ReactNode }) {
  return <PassageContext.Provider value={value}>{children}</PassageContext.Provider>
}

export function usePassage(): PassageContextValue {
  const value = useContext(PassageContext)
  if (!value) throw new Error('usePassage() hors de <PassageProvider> (pages du groupe (app) uniquement)')
  return value
}
