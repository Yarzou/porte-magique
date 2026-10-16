#!/usr/bin/env node
/**
 * Met dans l'appli ce que le dépôt contient pour monter la porte :
 * - public/fichiers/ : notice.pdf, materiel.pdf, les dessins de la notice
 *   (img/) et les pièces à imprimer (impression/*.stl) ;
 * - lib/montage.generated.json : la liste d'achat (lue dans
 *   docs/materiel.html), les étapes de la notice (docs/notice.html) et la
 *   liste des fichiers STL.
 *
 * Lancé avant `next dev` et `next build`, et après `npm install`. Les sources
 * restent dans docs/ et impression/ : rien n'est recopié à la main, et les
 * deux sorties sont ignorées par git.
 *
 * Hors du dépôt complet (dossiers docs/ ou impression/ absents), on garde ce
 * qui existe déjà, ou l'on écrit une liste vide : l'onglet Montage renvoie
 * alors vers les PDF.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = path.resolve(APP, '..')
const DOCS = path.join(REPO, 'docs')
const PRINTS = path.join(REPO, 'impression')
const OUT = path.join(APP, 'public', 'fichiers')
const JSON_OUT = path.join(APP, 'lib', 'montage.generated.json')

const EMPTY = { purchases: { intro: [], groups: [], totals: [] }, notice: { intro: null, steps: [] }, prints: [], pdf: { notice: false, materiel: false } }

if (!fs.existsSync(DOCS)) {
  console.warn('[montage] docs/ introuvable : on garde la dernière version de l’onglet Montage.')
  if (!fs.existsSync(JSON_OUT)) fs.writeFileSync(JSON_OUT, JSON.stringify(EMPTY, null, 2) + '\n')
  process.exit(0)
}

// ─── Utilitaires HTML ────────────────────────────────────────────────────────

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: '’', laquo: '«', raquo: '»', rsquo: '’', hellip: '…', mdash: '—', ndash: '–', times: '×' }

function decode (text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? m)
}

/** Texte brut d'un morceau de HTML, espaces resserrés. */
const text = html => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

const slug = value => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

// ─── Fichiers ────────────────────────────────────────────────────────────────

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'impression'), { recursive: true })

const pdf = { notice: false, materiel: false }
for (const name of ['notice', 'materiel']) {
  const source = path.join(DOCS, `${name}.pdf`)
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(OUT, `${name}.pdf`))
    pdf[name] = true
  }
}

const IMG = path.join(DOCS, 'notice', 'img')
if (fs.existsSync(IMG)) {
  for (const file of fs.readdirSync(IMG).filter(f => f.endsWith('.png'))) fs.copyFileSync(path.join(IMG, file), path.join(OUT, 'img', file))
}

// Moteur de pdf.js (lecteur de PDF de l'onglet Montage), servi par l'appli
const PDF_WORKER = path.join(APP, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs')
if (fs.existsSync(PDF_WORKER)) fs.copyFileSync(PDF_WORKER, path.join(OUT, 'pdf.worker.min.mjs'))
else console.warn('[montage] pdfjs-dist absent : le lecteur de PDF ne marchera pas (npm install).')

const prints = []
if (fs.existsSync(PRINTS)) {
  for (const file of fs.readdirSync(PRINTS).filter(f => f.endsWith('.stl')).sort()) {
    fs.copyFileSync(path.join(PRINTS, file), path.join(OUT, 'impression', file))
    prints.push({ file, bytes: fs.statSync(path.join(PRINTS, file)).size })
  }
}

// ─── Liste d'achat (docs/materiel.html) ─────────────────────────────────────

function parsePurchases (html) {
  const result = { intro: [], groups: [], totals: [] }
  const heading = html.indexOf('Liste d\'achat</h2>')
  if (heading < 0) return result
  const after = html.slice(heading)
  const tableStart = after.indexOf('<table>')
  for (const p of after.slice(0, tableStart).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) result.intro.push(text(p[1]))

  const body = after.slice(tableStart).match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!body) return result
  let group = null
  for (const row of body[1].match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    if (/class="group"/.test(row)) {
      group = { name: text(row), items: [] }
      result.groups.push(group)
      continue
    }
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1])
    if (cells.length < 7) continue
    const [, ref, article, qty, price, check, links] = cells
    const link = links.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!group) {
      group = { name: 'Articles', items: [] }
      result.groups.push(group)
    }
    group.items.push({
      id: text(ref) || slug(article),
      ref: text(ref),
      article: text(article),
      qty: text(qty),
      price: text(price),
      check: text(check),
      url: link ? decode(link[1]) : null,
      shop: link ? text(link[2]) : null,
    })
  }
  for (const row of after.matchAll(/<tr class="total">([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => text(m[1]))
    if (cells.length >= 2) result.totals.push({ label: cells[0], price: cells[1] })
  }
  return result
}

// ─── Notice (docs/notice.html) ──────────────────────────────────────────────

const WARNING_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2z" fill="#a24d17"/><rect x="11" y="8" width="2" height="7" fill="#fff"/><rect x="11" y="16.5" width="2" height="2" fill="#fff"/></svg>'

/** HTML d'une étape, prêt pour l'appli : chemins des images, icône d'avertissement. */
function clean (html) {
  return html
    .replace(/<svg class="ico">\s*<use href="#attention"\s*\/>\s*<\/svg>/g, WARNING_ICON)
    .replace(/src="notice\/img\//g, 'src="/fichiers/img/')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
}

function parseNotice (html) {
  const notice = { intro: null, steps: [] }

  const intro = html.match(/<h2[^>]*>Avant de commencer<\/h2>([\s\S]*?)<\/section>/)
  if (intro) notice.intro = { title: 'Avant de commencer', html: clean(intro[1]) }

  // Titres de partie (h2) et étapes, dans l'ordre du document
  const marks = []
  for (const m of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)) marks.push({ at: m.index, part: text(m[1]) })
  const starts = [...html.matchAll(/<div class="step"[^>]*>/g)].map(m => m.index)
  starts.forEach((start, i) => {
    let chunk = html.slice(start, starts[i + 1] ?? html.length)
    const cut = Math.min(...['<h2', '</section>'].map(t => chunk.indexOf(t)).filter(n => n > 0), chunk.length)
    chunk = chunk.slice(0, cut)
    const num = chunk.match(/<div class="num">([^<]*)<\/div>/)
    const title = chunk.match(/<h3>([\s\S]*?)<\/h3>/)
    if (!title) return
    let body = chunk.slice(chunk.indexOf('</h3>') + 5)
    // Ferme la colonne de texte et le bloc de l'étape
    for (let k = 0; k < 2; k++) {
      const last = body.lastIndexOf('</div>')
      if (last >= 0) body = body.slice(0, last) + body.slice(last + 6)
    }
    const part = marks.filter(m => m.at < start).at(-1)?.part ?? ''
    const thumb = chunk.match(/<img src="notice\/img\/([^"]+)"/)
    notice.steps.push({
      id: String(notice.steps.length + 1),
      num: num ? text(num[1]) : '',
      title: text(title[1]),
      part,
      thumb: thumb ? `/fichiers/img/${thumb[1]}` : null,
      html: clean(body),
    })
  })
  return notice
}

const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
const data = {
  purchases: parsePurchases(read(path.join(DOCS, 'materiel.html'))),
  notice: parseNotice(read(path.join(DOCS, 'notice.html'))),
  prints,
  pdf,
}
fs.writeFileSync(JSON_OUT, JSON.stringify(data, null, 2) + '\n')

const items = data.purchases.groups.reduce((n, g) => n + g.items.length, 0)
console.log(`[montage] ${items} articles, ${data.notice.steps.length} étapes, ${prints.length} pièces à imprimer`)
