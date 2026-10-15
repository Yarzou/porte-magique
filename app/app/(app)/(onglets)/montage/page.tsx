import { Suspense } from 'react'
import MontageClient from './MontageClient'

export default function MontagePage() {
  return (
    <Suspense fallback={null}>
      <MontageClient />
    </Suspense>
  )
}
