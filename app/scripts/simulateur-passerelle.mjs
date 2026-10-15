#!/usr/bin/env node
/**
 * Simulateur de passerelle : fait vivre une porte sans aucun matériel, pour
 * essayer l'appli. Il parle exactement comme le fera la vraie passerelle
 * (docs/api-passerelle.md) :
 * - toutes les 3 s, gateway_sync() avec l'état de la porte, et récupère ce
 *   qu'elle doit faire ;
 * - le « servo » met 1,5 s à obéir ;
 * - au clavier : [b] un enfant sonne, [p] la porte s'ouvre ou se ferme
 *   (contact), [l] batterie faible, [x] taquet bloqué, [q] quitter.
 *
 *   npm run simulateur -- <id de la porte> <clé de la passerelle> [http://localhost:3000]
 *
 * L'identifiant et la clé s'obtiennent dans l'appli : Réglages → Votre porte
 * → Associer une passerelle. Lit NEXT_PUBLIC_SUPABASE_URL et
 * NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.
 */

import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.local'), quiet: true })

const [door, key, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'] = process.argv.slice(2)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!door || !key) {
  console.error('Usage : npm run simulateur -- <id de la porte> <clé de la passerelle> [url de l’appli]')
  process.exit(1)
}
if (!SUPABASE_URL || !ANON) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquent dans .env.local')
  process.exit(1)
}

const state = { lock: 'ferme', doorClosed: true, batteryMv: 4020, jammed: false }
let target = 'ferme'
let passageOpen = false
let moving = null

async function sync () {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/gateway_sync`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_door: door,
      p_key: key,
      p_lock: state.jammed ? 'bloque' : state.lock,
      p_door_closed: state.doorClosed,
      p_battery_mv: state.batteryMv,
    }),
  })
  if (!res.ok) {
    console.error(`✗ gateway_sync : ${res.status} ${await res.text()}`)
    return
  }
  const reply = await res.json()
  target = reply.target
  passageOpen = reply.passage_open
  // Le servo obéit, sauf porte entrouverte au moment de fermer, ou taquet bloqué
  if (!state.jammed && target !== state.lock && !moving) {
    if (target === 'ferme' && !state.doorClosed) return
    moving = setTimeout(() => {
      state.lock = target
      moving = null
      print()
      void sync()
    }, 1500)
  }
}

async function event (kind) {
  const res = await fetch(`${appUrl}/api/passerelle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ door, key, kind }),
  }).catch(err => ({ ok: false, status: 0, text: async () => err.message }))
  console.log(res.ok ? `→ ${kind} envoyé (${JSON.stringify(await res.json())})` : `✗ ${kind} : ${res.status} ${await res.text()}`)
}

function print () {
  const led = passageOpen ? '🟢 passage ouvert' : '🔴 passage fermé'
  console.log(
    `${new Date().toLocaleTimeString('fr-FR')}  taquet ${state.jammed ? 'BLOQUÉ' : state.lock.padEnd(6)}` +
      `  cible ${target.padEnd(6)}  porte ${state.doorClosed ? 'fermée' : 'ouverte'}  ${(state.batteryMv / 1000).toFixed(2)} V  ${led}`,
  )
}

readline.emitKeypressEvents(process.stdin)
if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.on('keypress', (_str, k) => {
  if (k.name === 'q' || (k.ctrl && k.name === 'c')) process.exit(0)
  if (k.name === 'b') void event('demande')
  if (k.name === 'l') {
    state.batteryMv = 3420
    void event('batterie_faible')
  }
  if (k.name === 'p') {
    state.doorClosed = !state.doorClosed
    void sync().then(print)
  }
  if (k.name === 'x') {
    state.jammed = !state.jammed
    void sync().then(print)
  }
})

console.log('Simulateur de passerelle — [b] sonner  [p] porte  [l] batterie faible  [x] taquet bloqué  [q] quitter')
await sync()
print()
setInterval(() => {
  void sync().then(print)
}, 3000)
