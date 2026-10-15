// Pièces à imprimer. Chaque fonction renvoie la pièce dans le repère du boîtier
// (voir parametres.js) ; build.js les retourne ensuite dans le sens d'impression.

const { primitives, booleans, transforms, hulls } = require('@jscad/modeling')
const P = require('./parametres')

const { cuboid, cylinder, cylinderElliptic } = primitives
const { union, subtract } = booleans
const { translate, rotateX, mirror } = transforms
const { hull } = hulls

const SEG = 72

// Pavé donné par deux coins opposés
const boite = (x0, y0, z0, x1, y1, z1) =>
  cuboid({ size: [x1 - x0, y1 - y0, z1 - z0], center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] })

// Cylindre d'axe z
const cyl = (x, y, z0, z1, d, segments = SEG) =>
  cylinder({ radius: d / 2, height: z1 - z0, center: [x, y, (z0 + z1) / 2], segments })

// Cylindre d'axe y (trous percés dans la paroi du bas)
const cylY = (x, z, y0, y1, d) =>
  translate([x, (y0 + y1) / 2, z], rotateX(Math.PI / 2, cylinder({ radius: d / 2, height: y1 - y0, segments: SEG })))

// Logement hexagonal d'axe z, donné par sa cote sur plats
const hexa = (x, y, z0, z1, surPlats) =>
  cylinder({ radius: surPlats / Math.sqrt(3), height: z1 - z0, center: [x, y, (z0 + z1) / 2], segments: 6 })

// Symétrique d'une pièce du boîtier, pour la porte du voisin (boîtier à droite de sa porte)
const miroir = (g) => mirror({ origin: [P.L / 2, 0, 0], normal: [1, 0, 0] }, g)

// ---------------------------------------------------------------------------
// Fond du boîtier : vissé sur la clôture, il porte toute l'électronique.
// ---------------------------------------------------------------------------
function fond (cote = 'gauche') {
  const { L, H, paroi: e, fond: f, zRebord, zPlots, collerette: c } = P
  const [ax, ay] = P.axe
  const s = P.servo
  const b = P.berceau
  const carte = P.carte
  const plein = []
  const creux = []

  // Fond et oreilles de fixation
  plein.push(boite(0, 0, 0, L, H, f))
  for (const [ox, oy] of P.oreilles) {
    let attache
    if (oy < 0) attache = boite(ox - 7, 0, 0, ox + 7, 1, 5)
    else if (oy > H) attache = boite(ox - 7, H - 1, 0, ox + 7, H, 5)
    else attache = boite(L - 1, oy - 7, 0, L, oy + 7, 5)
    plein.push(hull(cyl(ox, oy, 0, 5, 14), attache))
    creux.push(cyl(ox, oy, -1, 6, P.oreilleVisD))
    creux.push(cylinderElliptic({ height: 2.6, startRadius: [P.oreilleVisD / 2, P.oreilleVisD / 2], endRadius: [4.6, 4.6], center: [ox, oy, 5 - 1.3 + 0.01], segments: SEG }))
  }

  // Parois
  plein.push(subtract(boite(0, 0, f - 0.01, L, H, zRebord), boite(e, e, f - 1, L - e, H - e, zRebord + 1)))

  // Collerette en biseau (imprimable sans support), qui porte le joint
  const zc = zRebord - 1
  const biseau = (plaque, arete) => hull(plaque, arete)
  plein.push(biseau(boite(e, e, zc, e + c, H - e, zRebord), boite(e, e, zc - c, e + 0.01, H - e, zc - c + 0.01)))
  plein.push(biseau(boite(L - e - c, e, zc, L - e, H - e, zRebord), boite(L - e - 0.01, e, zc - c, L - e, H - e, zc - c + 0.01)))
  plein.push(biseau(boite(e, e, zc, L - e, e + c, zRebord), boite(e, e, zc - c, L - e, e + 0.01, zc - c + 0.01)))
  plein.push(biseau(boite(e, H - e - c, zc, L - e, H - e, zRebord), boite(e, H - e - 0.01, zc - c, L - e, H - e, zc - c + 0.01)))

  // Plots des vis de la façade, avec leur insert M3
  for (const [px, py] of P.plots) {
    plein.push(cyl(px, py, f - 0.01, zPlots, P.plotD))
    creux.push(cyl(px, py, zPlots - P.insertProf, zPlots + 1, P.insertD))
  }

  // Appuis de la carte et butées latérales
  const bx0 = carte.x0
  const bx1 = carte.x0 + carte.l
  plein.push(boite(bx0 - 2, e - 0.01, f - 0.01, bx0 + 2, e + carte.L - 2, carte.z))
  plein.push(boite(bx1 - 2, e - 0.01, f - 0.01, bx1 + 2, e + carte.L - 2, carte.z))
  plein.push(boite(bx0 - 2, e - 0.01, carte.z - 0.01, bx0 - 0.3, e + 40, carte.z + 2))
  plein.push(boite(bx1 + 0.3, e - 0.01, carte.z - 0.01, bx1 + 2, e + 40, carte.z + 2))

  // Berceau de la batterie, ouvert en haut à gauche pour le fil
  plein.push(subtract(
    boite(b.x0 - b.ep, b.y0 - b.ep, f - 0.01, b.x0 + b.l + b.ep, b.y0 + b.L + b.ep, f + b.h),
    boite(b.x0, b.y0, f - 1, b.x0 + b.l, b.y0 + b.L, f + b.h + 1),
    boite(b.x0, b.y0 + b.L - 1, f - 1, b.x0 + 16, b.y0 + b.L + b.ep + 1, f + b.h + 1),
  ))

  // Fentes et gorge de la sangle velcro (la gorge passe derrière le fond)
  const g = P.sangle
  const fenteG = b.x0 - b.ep - 0.3 - g.ep
  const fenteD = b.x0 + b.l + b.ep + 0.3
  creux.push(boite(fenteG, g.y0, -1, fenteG + g.ep, g.y0 + g.l, f + 1))
  creux.push(boite(fenteD, g.y0, -1, fenteD + g.ep, g.y0 + g.l, f + 1))
  creux.push(boite(fenteG, g.y0, -1, fenteD + g.ep, g.y0 + g.l, g.creux))

  // Bac du module MOSFET
  const m = P.mosfet
  plein.push(subtract(
    boite(m.x0 - 1.2, m.y0 - 1.2, f - 0.01, m.x0 + m.l + 1.2, m.y0 + m.L + 1.2, f + 3),
    boite(m.x0, m.y0, f - 1, m.x0 + m.l, m.y0 + m.L, f + 4),
  ))

  // Bac des trois bornes WAGO
  const w = P.wago
  const wl = w.n * w.l + (w.n - 1) * 1.2
  const cases = []
  for (let i = 0; i < w.n; i++) {
    const x = w.x0 + i * (w.l + 1.2)
    cases.push(boite(x, w.y0, f - 1, x + w.l, w.y0 + w.L, f + 4))
  }
  plein.push(subtract(boite(w.x0 - 1.2, w.y0 - 1.2, f - 0.01, w.x0 + wl + 1.2, w.y0 + w.L + 1.2, f + 3), ...cases))

  // Berceau du servo : deux joues le long du corps et deux plots pour les vis des pattes
  const sx0 = ax - (s.L - s.axeBout)
  const sx1 = ax + s.axeBout
  const sc = (sx0 + sx1) / 2
  plein.push(boite(sx0, ay - s.l / 2 - 2.3, f - 0.01, sx1, ay - s.l / 2 - 0.3, f + 10))
  plein.push(boite(sx0, ay + s.l / 2 + 0.3, f - 0.01, sx1, ay + s.l / 2 + 2.3, f + 10))
  for (const px of [sc - s.entraxe / 2, sc + s.entraxe / 2]) {
    plein.push(boite(px - 2.2, ay - 3.5, f - 0.01, px + 2.2, ay + 3.5, f + s.hautPattes))
    creux.push(cyl(px, ay, f + s.hautPattes - 8, f + s.hautPattes + 1, 1.8, 24))
  }

  // Passages dans la paroi du bas : prise USB-C, presse-étoupe, purge
  const ux = carte.x0 + carte.l / 2
  creux.push(boite(ux - P.usb.l / 2, -1, P.usb.z - P.usb.h / 2, ux + P.usb.l / 2, e + 1, P.usb.z + P.usb.h / 2))
  creux.push(cylY(P.presseEtoupe.x, P.presseEtoupe.z, -1, e + 1, P.presseEtoupe.D))
  creux.push(cylY(P.purge.x, P.purge.z, -1, e + 1, P.purge.D))

  const piece = subtract(union(...plein), ...creux)
  return cote === 'droite' ? miroir(piece) : piece
}

// ---------------------------------------------------------------------------
// Façade : porte le roulement du taquet et le bouton des enfants.
// ---------------------------------------------------------------------------
function facade (cote = 'gauche') {
  const [ax, ay] = P.axe
  const z0 = P.zPlots
  const z1 = P.zFacade
  const plein = [boite(0, 0, z0, P.L, P.H, z1), cyl(ax, ay, P.bossageZ, z0 + 0.01, P.bossageD)]

  // Deux appuis en croix qui tiennent la batterie quand la façade est fermée
  for (const [x, y] of P.appuis) {
    plein.push(boite(x - 4, y - 1, P.appuiZ, x + 4, y + 1, z0 + 0.01))
    plein.push(boite(x - 1, y - 4, P.appuiZ, x + 1, y + 4, z0 + 0.01))
  }

  const creux = [
    cyl(ax, ay, P.bossageZ - 0.1, P.zRoulementAvant, P.roulementD),   // logement du roulement
    cyl(ax, ay, P.zRoulementAvant - 0.5, z1 + 1, P.levreD),           // lèvre avant
    cyl(P.bouton.x, P.bouton.y, z0 - 1, z1 + 1, P.bouton.D),
    ...P.plots.map(([x, y]) => cyl(x, y, z0 - 1, z1 + 1, P.visD, 32)),
  ]
  const piece = subtract(union(...plein), ...creux)
  return cote === 'droite' ? miroir(piece) : piece
}

// ---------------------------------------------------------------------------
// Taquet : moyeu, bras et doigt d'une seule pièce. Repère : l'axe est en (0, 0),
// le bras vise +x (porte fermée). Lf = longueur du doigt, à choisir sur place.
// ---------------------------------------------------------------------------
function taquet (Lf = 40) {
  const z0 = P.zMoyeu
  const z1 = P.zBras
  const d = P.doigt
  const plein = [
    hull(cyl(0, 0, z0, z1, P.moyeuD), cyl(P.R, 0, z0, z1, d)),
    boite(P.R - d / 2, -d / 2, z0 - Lf, P.R + d / 2, d / 2, z0 + 0.01),
    subtract(cyl(0, 0, z0 - 1, z0 + 0.01, 30), cyl(0, 0, z0 - 2, z0 + 1, 20)),   // couronne d'appui contre la façade
  ]
  const creux = [
    cyl(0, 0, z0 - 2, z1 + 1, P.trou8),
    hexa(0, 0, z1 - P.teteProf, z1 + 1, P.ecrouCote),   // tête de la vis M8
  ]
  return subtract(union(...plein), ...creux)
}

// ---------------------------------------------------------------------------
// Accouplement : reçoit le palonnier en croix du servo (dessous) et l'écrou
// Nylstop du taquet (dessus). L'écrou y coulisse : c'est ce qui permet d'ôter
// la façade sans rien démonter.
// ---------------------------------------------------------------------------
function accouplement () {
  const a = P.acc
  return subtract(
    cyl(0, 0, 0, a.ep, a.D),
    boite(-a.croixL / 2, -a.croixl / 2, -1, a.croixL / 2, a.croixl / 2, a.croixProf),
    boite(-a.croixl / 2, -a.croixL / 2, -1, a.croixl / 2, a.croixL / 2, a.croixProf),
    cyl(0, 0, -1, a.ep + 1, a.vis, 32),                                      // vis centrale du palonnier
    cyl(0, 0, a.croixProf + 0.8, a.ep + 1, 6.4, 32),                         // logement de sa tête
    hexa(0, 0, a.ep - a.pocheProf, a.ep + 1, P.ecrouCote),
  )
}

// ---------------------------------------------------------------------------
// Bouchon de la prise USB-C (on l'ôte pour recharger)
// ---------------------------------------------------------------------------
function bouchonUsb () {
  const { l, h } = P.usb
  return union(
    boite(-(l + 4) / 2, -(h + 4) / 2, 0, (l + 4) / 2, (h + 4) / 2, 1.6),
    boite(-(l - 0.4) / 2, -(h - 0.4) / 2, 1.59, (l - 0.4) / 2, (h - 0.4) / 2, 1.6 + 2.5),
    boite((l + 4) / 2 - 0.01, -3, 0, (l + 4) / 2 + 7, 3, 1.6),
  )
}

// ---------------------------------------------------------------------------
// Boîtier de la passerelle (à l'intérieur de la maison : le PLA convient)
// ---------------------------------------------------------------------------
function passerelleFond () {
  const { l, L, h, paroi: p, fond: f } = P.passerelle
  return subtract(
    union(
      subtract(boite(0, 0, 0, l + 2 * p, L + 2 * p, f + h), boite(p, p, f, l + p, L + p, f + h + 1)),
      // appuis de la carte le long des grands côtés
      boite(p - 0.01, p, f - 0.01, p + 2, L + p, f + 3),
      boite(l + p - 2, p, f - 0.01, l + p + 0.01, L + p, f + 3),
    ),
    // prise USB-C au bout
    boite(p + l / 2 - 6.5, -1, f + 1.5, p + l / 2 + 6.5, p + 1, f + 11),
    // aérations
    ...[0, 1, 2, 3].map((i) => boite(p + 4, p + 14 + i * 10, -1, p + l - 4, p + 16 + i * 10, f + 1)),
  )
}

function passerelleCouvercle () {
  const { l, L, paroi: p } = P.passerelle
  return union(
    boite(0, 0, 0, l + 2 * p, L + 2 * p, 1.6),
    subtract(boite(p + 0.25, p + 0.25, 1.59, l + p - 0.25, L + p - 0.25, 4.5), boite(p + 1.45, p + 1.45, 1, l + p - 1.45, L + p - 1.45, 6)),
  )
}

module.exports = { fond, facade, taquet, accouplement, bouchonUsb, passerelleFond, passerelleCouvercle, boite, cyl, cylY, hexa, miroir }
