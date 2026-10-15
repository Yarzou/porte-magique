// Pièces du commerce, simplifiées, et décor (clôture, porte) : elles ne servent
// qu'aux dessins de la notice. Toutes sont placées dans le repère du boîtier.

const { primitives, booleans, transforms } = require('@jscad/modeling')
const P = require('./parametres')
const { boite, cyl, cylY, hexa } = require('./pieces')

const { roundedCuboid, cylinder } = primitives
const { union, subtract } = booleans
const { translate, rotateX, rotateY, rotateZ } = transforms

const [ax, ay] = P.axe
const f = P.fond

// Servo MG90S, posé dans son berceau, axe en (ax, ay)
function servo () {
  const s = P.servo
  const x0 = ax - (s.L - s.axeBout)
  const x1 = ax + s.axeBout
  const zp = f + s.hautPattes
  return union(
    boite(x0, ay - s.l / 2, zp - 15.6, x1, ay + s.l / 2, zp + 7),
    subtract(boite(x0 - 4.9, ay - s.l / 2, zp, x1 + 4.9, ay + s.l / 2, zp + 2.5),
      cyl((x0 + x1) / 2 - s.entraxe / 2, ay, zp - 1, zp + 3, 2, 16), cyl((x0 + x1) / 2 + s.entraxe / 2, ay, zp - 1, zp + 3, 2, 16)),
    cyl(ax, ay, zp + 7, zp + 11, 11.8),
    cyl(ax - 6, ay, zp + 7, zp + 10, 6),
    cyl(ax, ay, zp + 11, zp + 14.5, 4.8, 24),
    // fil
    boite(x0 - 6, ay - 1.5, zp - 12, x0, ay + 1.5, zp - 10),
  )
}

// Palonnier en croix (sous l'accouplement)
function palonnier (z = P.acc.z0) {
  return union(
    boite(ax - 11.5, ay - 3, z, ax + 11.5, ay + 3, z + 2),
    boite(ax - 3, ay - 9, z, ax + 3, ay + 9, z + 2),
    cyl(ax, ay, z - 3.5, z, 7, 24),
  )
}

function roulement (z0) {
  return union(
    subtract(cyl(0, 0, z0, z0 + 7, 22), cyl(0, 0, z0 - 1, z0 + 8, 19)),
    subtract(cyl(0, 0, z0 + 0.4, z0 + 6.6, 19.1), cyl(0, 0, z0 - 1, z0 + 8, 11.9)),
    subtract(cyl(0, 0, z0, z0 + 7, 12), cyl(0, 0, z0 - 1, z0 + 8, 8)),
  )
}

const rondelle = (z0) => subtract(cyl(0, 0, z0, z0 + 1.6, 16), cyl(0, 0, z0 - 1, z0 + 3, 8.4))
const ecrou = (z0) => subtract(union(hexa(0, 0, z0, z0 + 6.5, 13), cyl(0, 0, z0 + 6.4, z0 + 8, 12)), cyl(0, 0, z0 - 1, z0 + 9, 8))

// Vis M8 : tête vers +z en ztete, tige vers -z sur L mm
const visM8 = (ztete, L) => union(hexa(0, 0, ztete, ztete + 5.3, 13), cyl(0, 0, ztete - L, ztete + 0.01, 8, 24))

// Petite vis (M3 ou vis de servo), tête vers +z
const vis = (x, y, ztete, L, d = 3) => union(cyl(x, y, ztete, ztete + d * 0.6, d * 1.8, 24), cyl(x, y, ztete - L, ztete + 0.01, d, 16))

// Vis à bois des oreilles
const visBois = (x, y, z) => translate([x, y, z], union(
  primitives.cylinderElliptic({ height: 2.5, startRadius: [2, 2], endRadius: [4, 4], center: [0, 0, 1.25], segments: 24 }),
  cyl(0, 0, -30, 0.01, 4, 16)))

const insert = (x, y, z0) => cyl(x, y, z0, z0 + 5.7, 4.6, 20)

// Carte FireBeetle 2 ESP32-C6, avec ses deux barrettes soudées
function carte (avecBarrettes = true) {
  const c = P.carte
  const x0 = c.x0
  const x1 = c.x0 + c.l
  const y0 = P.paroi
  const z = c.z
  const parts = [
    boite(x0, y0, z, x1, y0 + c.L, z + 1.6),
    boite(x0 + 6.7, y0 + 30, z + 1.6, x0 + 18.7, y0 + 48, z + 4),        // module
    boite(x0 + 8.2, y0 - 0.6, z + 1.6, x0 + 17.2, y0 + 7, z + 4.8),      // prise USB-C
    boite(x0 + 3, y0 + 10, z + 1.6, x0 + 9, y0 + 16, z + 7),             // prise batterie
  ]
  if (avecBarrettes) {
    for (const x of [x0 + 1.27, x1 - 1.27]) {
      parts.push(boite(x - 1.25, y0 + 9, z + 1.6, x + 1.25, y0 + 9 + 40.6, z + 4.1))
      for (let i = 0; i < 16; i++) {
        const y = y0 + 10.27 + i * 2.54
        parts.push(boite(x - 0.32, y - 0.32, z - 2.5, x + 0.32, y + 0.32, z + 10))
      }
    }
  }
  return union(...parts)
}

function batterie () {
  const b = P.berceau
  return roundedCuboid({ size: [50, 80, 10], center: [b.x0 + b.l / 2, b.y0 + b.L / 2, f + 5.2], roundRadius: 2, segments: 16 })
}

// Sangle velcro autour de la batterie (passe derrière le fond)
function sangle () {
  const g = P.sangle
  const b = P.berceau
  const xg = b.x0 - b.ep - 0.3 - g.ep
  const xd = b.x0 + b.l + b.ep + 0.3 + g.ep
  return union(
    boite(xg + 0.4, g.y0 + 1, f + 10.4, xd - 0.4, g.y0 + 21, f + 11.6),
    boite(xg + 0.4, g.y0 + 1, -0.2 + 0.3, xg + 1.6, g.y0 + 21, f + 11.6),
    boite(xd - 1.6, g.y0 + 1, -0.2 + 0.3, xd - 0.4, g.y0 + 21, f + 11.6),
  )
}

function moduleMosfet () {
  const m = P.mosfet
  const x0 = m.x0 + 0.5
  const y0 = m.y0 + 0.5
  return union(
    boite(x0, y0, f, x0 + 34, y0 + 17, f + 1.6),
    boite(x0 + 1, y0 + 1, f + 1.6, x0 + 9, y0 + 16, f + 11),
    boite(x0 + 25, y0 + 1, f + 1.6, x0 + 33, y0 + 16, f + 11),
    boite(x0 + 13, y0 + 5, f + 1.6, x0 + 20, y0 + 12, f + 4),
  )
}

function wago (i) {
  const w = P.wago
  const x = w.x0 + i * (w.l + 1.2) + 0.7
  const y = w.y0 + 0.2
  const parts = [boite(x, y, f, x + 13.1, y + 18.6, f + 8.2)]
  for (let k = 0; k < 3; k++) parts.push(boite(x + 1 + k * 4, y + 9, f + 8.2, x + 3.6 + k * 4, y + 18.6, f + 10))
  return union(...parts)
}

// Bouton 16 mm à anneau lumineux, monté dans la façade
function bouton () {
  const { x, y } = P.bouton
  const z = P.zFacade
  return union(
    cyl(x, y, z, z + 2, 19),
    cyl(x, y, z + 2, z + 3, 12),
    cyl(x, y, P.zPlots - 24, P.zPlots + 0.01, 15.8),
    hexa(x, y, P.zPlots - 3, P.zPlots, 20),
  )
}

const anneauBouton = () => subtract(cyl(P.bouton.x, P.bouton.y, P.zFacade + 1.95, P.zFacade + 2.2, 16.5), cyl(P.bouton.x, P.bouton.y, 0, 100, 13.5))

function presseEtoupe () {
  const { x, z } = P.presseEtoupe
  return union(
    translate([x, -4, z], rotateX(Math.PI / 2, hexa(0, 0, -2, 2, 17))),
    translate([x, -10, z], rotateX(Math.PI / 2, cylinder({ radius: 6.5, height: 8, segments: 24 }))),
    translate([x, 6, z], rotateX(Math.PI / 2, hexa(0, 0, -2.5, 2.5, 17))),
  )
}

// Contact magnétique (corps et aimant), posé à part
const contact = (x, y, z) => roundedCuboid({ size: [13, 27, 8], center: [x, y, z + 4], roundRadius: 2, segments: 12 })

// Joint mousse collé sur le rebord
function joint () {
  const { L, H, paroi: e, collerette: c, zRebord } = P
  return subtract(boite(e + 0.5, e + 0.5, zRebord, L - e - 0.5, H - e - 0.5, zRebord + 3), boite(e + c, e + c, zRebord - 1, L - e - c, H - e - c, zRebord + 4))
}

// Fer à souder stylisé, pointe vers le bas en (x, y, z)
const ferASouder = (x, y, z) => union(
  primitives.cylinderElliptic({ height: 12, startRadius: [0.6, 0.6], endRadius: [2.5, 2.5], center: [x, y, z + 6], segments: 16 }),
  cyl(x, y, z + 12, z + 40, 6, 24),
  cyl(x, y, z + 40, z + 90, 14, 24),
)

// Décor : planches de la clôture, tasseau du cadre et porte en contreplaqué
function cloture (x0 = -60, x1 = 330) {
  const planches = []
  for (let y = -70; y < 230; y += 46) planches.push(boite(x0, y, -18, x1, y + 44, 0))
  return union(...planches)
}
const tasseau = () => boite(112, -70, 0.01, 134, 230, 20)
const porte = (x0 = 128, ouverte = false) => ouverte
  ? translate([x0 + 300, 0, 25], rotateY(-Math.PI / 3, boite(-300, -70, -5, 0, 230, 0)))
  : boite(x0, -70, 20, 330, 230, 25)

module.exports = {
  servo, palonnier, roulement, rondelle, ecrou, visM8, vis, visBois, insert, carte, batterie, sangle, moduleMosfet,
  wago, bouton, anneauBouton, presseEtoupe, contact, joint, ferASouder, cloture, tasseau, porte,
}
