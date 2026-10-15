import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Keepalive Supabase (repris de Fridge).
 *
 * Un projet du plan gratuit est mis en pause après ~7 jours sans activité, et
 * ce sont les requêtes API entrantes qui comptent. Cette route fait donc une
 * vraie requête PostgREST : la RPC ping(), qui ne lit aucune donnée. Une fois
 * les passerelles branchées, leurs appels suffisent à garder le projet éveillé.
 *
 * Appelée chaque jour par le cron Vercel (vercel.json).
 */

// Jamais de cache : le but est précisément de toucher la base à chaque appel.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  // Durcissement optionnel : si CRON_SECRET est défini, on l'exige.
  // Le cron Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET`.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: 'Configuration Supabase manquante' }, { status: 500 })
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const startedAt = Date.now()
  const { data, error } = await supabase.rpc('ping')
  const durationMs = Date.now() - startedAt

  if (error) {
    console.error('[keepalive] Supabase error:', error.message)
    // 500 pour qu'un monitor externe alerte
    return NextResponse.json({ ok: false, error: error.message, durationMs }, { status: 500 })
  }

  return NextResponse.json({ ok: data === 'ok', durationMs, at: new Date().toISOString() })
}
