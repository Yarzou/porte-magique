// Dessins de la notice de montage : npm run rendus
// Les images vont dans ../docs/notice/img. Argument facultatif : un filtre sur le nom.

const fs = require('fs')
const path = require('path')
const { transforms } = require('@jscad/modeling')
const P = require('./parametres')
const pc = require('./pieces')
const A = require('./achats')
const { rendu } = require('./rendu')

const { translate, rotateZ, rotateX } = transforms
const [ax, ay] = P.axe
const SORTIE = path.join(__dirname, '..', 'docs', 'notice', 'img')
fs.mkdirSync(SORTIE, { recursive: true })

const filtre = process.argv[2]
const scenes = {}
const scene = (nom, f) => { scenes[nom] = f }

// Éléments placés dans le repère du boîtier
const enAxe = (g, dz = 0) => translate([ax, ay, dz], g)
const taquet = (Lf = 40, ouvert = false, dz = 0) => enAxe(ouvert ? rotateZ(Math.PI / 2, pc.taquet(Lf)) : pc.taquet(Lf), dz)
const accouplement = (dz = 0) => enAxe(pc.accouplement(), P.acc.z0 + dz)
const pileTaquet = (dz = 0, ouvert = false) => [
  { g: taquet(40, ouvert, dz), c: 'imprime' },
  { g: enAxe(A.visM8(P.zBras - P.teteProf, 30), dz), c: 'metal' },
]
const roulement = (dz = 0) => enAxe(A.roulement(P.zRoulementArriere + dz))
const rondellesAvant = (dz = 0) => [enAxe(A.rondelle(P.zRoulementAvant + dz)), enAxe(A.rondelle(P.zRoulementAvant + 1.6 + dz))]
const rondelleArriere = (dz = 0) => enAxe(A.rondelle(P.zRoulementArriere - 1.6 + dz))
const ecrou = (dz = 0) => enAxe(A.ecrou(P.zRoulementArriere - 1.6 - 8 + dz))
const interieur = () => [
  { g: A.servo(), c: 'achat' },
  { g: A.palonnier(), c: 'achat' },
  { g: accouplement(), c: 'imprime' },
  { g: A.carte(), c: 'achat' },
  { g: A.batterie(), c: 'achat' },
  { g: A.sangle(), c: 'sombre' },
  { g: A.moduleMosfet(), c: 'achat' },
  ...[0, 1, 2].map((i) => ({ g: A.wago(i), c: 'achat' })),
]
const facadeComplete = (dz = 0, led = 'vert', ouvert = false) => [
  { g: translate([0, 0, dz], pc.facade()), c: 'imprime' },
  { g: translate([0, 0, dz], A.bouton()), c: 'metal' },
  { g: translate([0, 0, dz], A.anneauBouton()), c: led, aretes: false },
  { g: translate([0, 0, dz], roulement()), c: 'metal' },
  ...rondellesAvant(dz).map((g) => ({ g, c: 'metal' })),
  { g: translate([0, 0, dz], rondelleArriere()), c: 'metal' },
  { g: translate([0, 0, dz], ecrou()), c: 'metal' },
  ...pileTaquet(dz, ouvert),
]
const decor = (largeDroite = 330) => [
  { g: A.cloture(-60, largeDroite), c: 'bois' },
  { g: A.tasseau(), c: 'tasseau' },
  { g: A.porte(128), c: 'porte' },
]

// ---------------------------------------------------------------------------
// Pièces à imprimer, une par image
// ---------------------------------------------------------------------------
scene('piece-fond', () => ({ objets: [{ g: pc.fond(), c: 'imprime' }], vue: [0.55, 0.75, 1.5], largeur: 640, hauteur: 520 }))
scene('piece-facade', () => ({ objets: [{ g: pc.facade(), c: 'imprime' }], vue: [-0.5, 0.6, -1.4], largeur: 640, hauteur: 520 }))
// Le taquet tel qu'il s'imprime : face avant sur le plateau, doigt vers le haut
scene('piece-taquet', () => ({
  objets: [20, 40, 60].map((Lf, i) => ({ g: translate([i * 55, 0, 0], rotateZ(Math.PI / 2, rotateX(Math.PI, pc.taquet(Lf)))), c: 'imprime' })),
  etiquettes: [20, 40, 60].map((Lf, i) => ({ t: 'doigt ' + Lf, p: [i * 55, P.R, -(P.zMoyeu - Lf)], dx: 0, dy: -40 })),
  vue: [0.35, -0.9, 0.75], largeur: 640, hauteur: 520,
}))
scene('piece-accouplement', () => ({
  objets: [{ g: pc.accouplement(), c: 'imprime' }, { g: translate([40, 0, 17], rotateX(Math.PI, pc.accouplement())), c: 'imprime' }],
  vue: [0.3, -0.9, 1.1], largeur: 640, hauteur: 400,
}))
scene('piece-bouchon', () => ({ objets: [{ g: pc.bouchonUsb(), c: 'imprime' }], vue: [0.4, -0.8, 1.2], largeur: 500, hauteur: 360 }))
scene('piece-passerelle', () => ({
  objets: [{ g: pc.passerelleFond(), c: 'imprime' }, { g: translate([40, 0, 0], pc.passerelleCouvercle()), c: 'imprime' }],
  vue: [0.4, -0.7, 1.2], largeur: 640, hauteur: 420,
}))

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------
scene('apercu', () => ({
  objets: [
    ...decor(),
    { g: pc.fond(), c: 'imprime' },
    ...facadeComplete(0, 'vert'),
    { g: A.contact(113, 30, 20), c: 'achat' },
    { g: A.contact(140, 30, 25), c: 'achat' },
  ],
  vue: [0.75, 0.45, 1.5], largeur: 1100, hauteur: 760,
}))

// ---------------------------------------------------------------------------
// Inventaire des pièces du commerce
// ---------------------------------------------------------------------------
// Une petite image par pièce du commerce (la notice les range en grille)
const inventaire = {
  A: [A.servo(), 'achat'],
  B: [A.carte(), 'achat'],
  C: [A.batterie(), 'achat'],
  D: [A.moduleMosfet(), 'achat'],
  E: [A.wago(0), 'achat'],
  F: [A.bouton(), 'metal'],
  G: [A.contact(0, 0, 0), 'achat'],
  H: [A.roulement(0), 'metal'],
  J: [A.visM8(0, 30), 'metal'],
  K: [A.ecrou(0), 'metal'],
  L: [A.rondelle(0), 'metal'],
  M: [A.presseEtoupe(), 'achat'],
  N: [A.insert(0, 0, 0), 'metal'],
  P: [A.vis(0, 0, 0, 12), 'metal'],
  Q: [A.visBois(0, 0, 0), 'metal'],
}
for (const [lettre, [g, c]] of Object.entries(inventaire)) {
  scene('inv-' + lettre, () => ({ objets: [{ g, c }], vue: [0.6, 0.7, 1.3], largeur: 260, hauteur: 200, marge: 0.12 }))
}

// ---------------------------------------------------------------------------
// Étapes de montage
// ---------------------------------------------------------------------------
const fondSeul = () => ({ g: pc.fond(), c: 'imprime' })

scene('e-inserts', () => {
  const [px, py] = P.plots[1]
  return {
    objets: [
      fondSeul(),
      ...P.plots.map(([x, y]) => ({ g: A.insert(x, y, P.zPlots + 12), c: 'neuf' })),
      { g: A.ferASouder(px, py, P.zPlots + 18.5), c: 'achat' },
    ],
    fleches: P.plots.map(([x, y]) => ({ de: [x, y, P.zPlots + 11], a: [x, y, P.zPlots + 1] })),
    etiquettes: [{ t: 'N', p: [P.plots[3][0], P.plots[3][1], P.zPlots + 18], dx: 50, dy: -30 }],
    vue: [0.55, 0.75, 1.4],
  }
})

scene('e-servo', () => {
  const s = P.servo
  const sc = ax - (s.L / 2 - s.axeBout)
  const haut = 30
  return {
    objets: [
      fondSeul(),
      { g: translate([0, 0, haut], A.servo()), c: 'neuf' },
      ...[sc - s.entraxe / 2, sc + s.entraxe / 2].map((x) => ({ g: A.vis(x, ay, P.fond + s.hautPattes + 2.5 + haut + 18, 8, 2), c: 'metal' })),
    ],
    fleches: [sc - s.entraxe / 2, sc + s.entraxe / 2].map((x) => ({ de: [x, ay, P.fond + s.hautPattes + haut + 14], a: [x, ay, P.fond + s.hautPattes + 4] })),
    etiquettes: [{ t: 'A', p: [ax - 10, ay, P.fond + 20 + haut], dx: -60, dy: -50 }],
    vue: [0.5, 0.7, 1.3],
    cadre: [35, 85, 0, 115, 168, 85],
  }
})

// Le servo est dessiné seul : dans le boîtier, la paroi le cacherait
scene('e-accouplement', () => ({
  objets: [
    { g: A.servo(), c: 'achat' },
    { g: translate([0, 0, 14], A.palonnier()), c: 'neuf' },
    { g: accouplement(30), c: 'neuf' },
    { g: A.vis(ax, ay, P.acc.z0 + P.acc.croixProf + 0.8 + 60, 6, 2), c: 'metal' },
  ],
  fleches: [{ de: [ax, ay, P.acc.z0 + 75], a: [ax, ay, P.acc.z0 + 3] }],
  etiquettes: [
    { t: 'A', p: [ax - 14, ay, 15], dx: -60, dy: 30 },
    { t: 'palonnier en croix', p: [ax + 11, ay, P.acc.z0 + 15], dx: 110, dy: 10 },
  ],
  vue: [1.1, 0.7, 1.0], largeur: 900, hauteur: 640,
}))

scene('e-carte', () => ({
  objets: [
    fondSeul(),
    { g: A.servo(), c: 'achat' },
    { g: A.palonnier(), c: 'achat' },
    { g: accouplement(), c: 'imprime' },
    { g: translate([0, 0, 35], A.carte()), c: 'neuf' },
    { g: translate([0, 0, 35], A.batterie()), c: 'neuf' },
    { g: A.sangle(), c: 'sombre' },
  ],
  fleches: [
    { de: [26, 30, 35 + 10], a: [26, 30, 16] },
    { de: [74, 58, 35 + 12], a: [74, 58, 16] },
  ],
  etiquettes: [
    { t: 'B', p: [20, 50, 50], dx: -60, dy: -40 },
    { t: 'C', p: [90, 30, 50], dx: 60, dy: 40 },
  ],
  vue: [0.5, 0.8, 1.4],
}))

scene('e-mosfet', () => ({
  objets: [
    fondSeul(),
    { g: A.servo(), c: 'achat' },
    { g: A.palonnier(), c: 'achat' },
    { g: accouplement(), c: 'imprime' },
    { g: A.carte(), c: 'achat' },
    { g: A.batterie(), c: 'achat' },
    { g: A.sangle(), c: 'sombre' },
    { g: translate([0, 0, 30], A.moduleMosfet()), c: 'neuf' },
    ...[0, 1, 2].map((i) => ({ g: translate([0, 0, 30], A.wago(i)), c: 'neuf' })),
  ],
  fleches: [
    { de: [31, 136, 40], a: [31, 136, 10] },
    { de: [36, 115, 40], a: [36, 115, 14] },
  ],
  etiquettes: [
    { t: 'D', p: [20, 140, 42], dx: -60, dy: -30 },
    { t: 'E', p: [52, 112, 40], dx: 70, dy: -40 },
  ],
  vue: [0.2, -0.25, 1.4],
  cadre: [0, 92, 0, 85, 160, 45],
}))

scene('e-presse-etoupe', () => ({
  objets: [
    fondSeul(),
    { g: translate([0, -25, 0], A.presseEtoupe()), c: 'neuf' },
    { g: translate([0, -30, 0], pc.cylY(P.presseEtoupe.x, P.presseEtoupe.z, -80, -14, 3.5)), c: 'sombre' },
  ],
  fleches: [{ de: [P.presseEtoupe.x, -45, P.presseEtoupe.z + 18], a: [P.presseEtoupe.x, -2, P.presseEtoupe.z + 18] }],
  etiquettes: [{ t: 'M', p: [P.presseEtoupe.x, -30, P.presseEtoupe.z], dx: 70, dy: 20 }],
  vue: [0.45, -0.75, 1.3],
}))

scene('e-roulement', () => ({
  objets: [
    { g: pc.facade(), c: 'imprime' },
    { g: roulement(-35), c: 'neuf' },
    { g: translate([0, 0, 0], A.bouton()), c: 'metal' },
  ],
  fleches: [{ de: [ax, ay, P.zRoulementArriere - 40], a: [ax, ay, P.zRoulementArriere - 2] }],
  etiquettes: [
    { t: 'H', p: [ax - 11, ay, P.zRoulementArriere - 32], dx: -60, dy: 40 },
    { t: 'F', p: [P.bouton.x, P.bouton.y, P.zPlots - 20], dx: -60, dy: 40 },
  ],
  vue: [-0.55, 0.55, -1.4],
}))

scene('e-taquet', () => {
  const ecart = 28
  return {
    objets: [
      { g: pc.facade(), c: 'imprime' },
      { g: roulement(), c: 'metal' },
      { g: A.bouton(), c: 'metal' },
      ...rondellesAvant(ecart * 0.6).map((g) => ({ g, c: 'neuf' })),
      { g: taquet(40, false, ecart * 1.5), c: 'neuf' },
      { g: enAxe(A.visM8(P.zBras - P.teteProf, 30), ecart * 3), c: 'neuf' },
      { g: rondelleArriere(-ecart * 0.6), c: 'neuf' },
      { g: ecrou(-ecart * 1.3), c: 'neuf' },
    ],
    fleches: [{ de: [ax, ay, P.zBras + ecart * 3 + 10], a: [ax, ay, P.zRoulementArriere - 8 - ecart * 1.3 - 5] }],
    etiquettes: [
      { t: 'J', p: [ax, ay + 7, P.zBras + ecart * 3 - 5], dx: -50, dy: -40 },
      { t: 'L ×2', p: [ax, ay + 8, P.zRoulementAvant + ecart * 0.6 + 1], dx: -70, dy: -30 },
      { t: 'L', p: [ax, ay + 8, P.zRoulementArriere - 1 - ecart * 0.6], dx: 50, dy: 40 },
      { t: 'K', p: [ax, ay + 7, P.zRoulementArriere - 6 - ecart * 1.3], dx: 60, dy: 40 },
    ],
    vue: [1.3, 0.55, 0.9], largeur: 1000, hauteur: 680,
  }
})

scene('e-pose', () => ({
  objets: [
    ...decor(),
    { g: pc.fond(), c: 'neuf' },
    ...P.oreilles.map(([x, y]) => ({ g: A.visBois(x, y, 5 + 25), c: 'metal' })),
  ],
  fleches: P.oreilles.map(([x, y]) => ({ de: [x, y, 5 + 22], a: [x, y, 6] })),
  etiquettes: [{ t: 'Q', p: [P.oreilles[2][0], P.oreilles[2][1], 32], dx: -50, dy: -30 }],
  vue: [0.7, 0.45, 1.5], largeur: 1000, hauteur: 680,
}))

scene('e-fermeture', () => {
  const ecart = 55
  return {
    objets: [
      fondSeul(),
      ...interieur(),
      { g: A.joint(), c: 'mousse' },
      ...facadeComplete(ecart, 'rouge').map((o) => (o.c === 'imprime' ? { ...o, c: 'neuf' } : o)),
      ...P.plots.map(([x, y]) => ({ g: A.vis(x, y, P.zFacade + ecart + 18, 12), c: 'metal' })),
    ],
    fleches: P.plots.map(([x, y]) => ({ de: [x, y, P.zFacade + ecart + 14], a: [x, y, P.zPlots + 1] })),
    etiquettes: [
      { t: 'P ×4', p: [P.plots[0][0], P.plots[0][1], P.zFacade + ecart + 20], dx: -60, dy: 30 },
      { t: 'joint', p: [P.L - 4, 40, P.zRebord + 2], dx: 70, dy: 30 },
    ],
    vue: [0.75, 0.6, 1.4], largeur: 1000, hauteur: 720,
  }
})

scene('e-porte', () => ({
  objets: [
    { g: A.cloture(-60, 640), c: 'bois' },
    { g: A.tasseau(), c: 'tasseau' },
    { g: pc.boite(600, -70, 0.01, 625, 230, 20), c: 'tasseau' },
    { g: pc.boite(128, -70, 20, 612, 230, 25), c: 'porte' },
    ...[-30, 80, 190].map((y, i) => ({ g: pc.boite(600, y, 25, 616, y + 30, 27), c: i === 1 ? 'neuf' : 'metal' })),
    { g: pc.fond(), c: 'imprime' },
    ...facadeComplete(0, 'rouge'),
    { g: A.contact(121, 30, 20), c: 'neuf' },
    { g: A.contact(142, 30, 25), c: 'neuf' },
    { g: pc.boite(120, 85, 20, 127, 105, 30), c: 'neuf' },
    { g: pc.boite(129, 88, 25, 137, 102, 28), c: 'neuf' },
  ],
  etiquettes: [
    { t: 'G', p: [140, 30, 33], dx: 80, dy: 40 },
    { t: 'R', p: [608, 95, 27], dx: 60, dy: -60 },
    { t: 'S', p: [133, 95, 28], dx: 80, dy: -50 },
  ],
  vue: [0.25, 0.25, 1.5], largeur: 1100, hauteur: 620, marge: 0.05,
}))

// Vue de côté pour régler le doigt : le décor est coupé à droite du doigt
scene('e-reglage', () => ({
  objets: [
    { g: A.cloture(-60, 160), c: 'bois' },
    { g: pc.boite(112, -70, 0.01, 134, 230, 20), c: 'tasseau' },
    { g: pc.boite(128, -70, 20, 160, 230, 25), c: 'porte' },
    { g: pc.fond(), c: 'imprime' },
    ...facadeComplete(0, 'rouge'),
  ],
  etiquettes: [{ t: '1 à 3 mm', p: [160, ay, 25.5], dx: 90, dy: -70 }],
  vue: [1, 0.02, 0.001], largeur: 900, hauteur: 620, marge: 0.04,
  cadre: [100, ay - 55, -20, 160, ay + 55, 90],
}))

scene('e-ferme', () => ({ objets: [...decor(), { g: pc.fond(), c: 'imprime' }, ...facadeComplete(0, 'rouge', false)], vue: [0.12, 0.08, 1], largeur: 700, hauteur: 560, marge: 0.03 }))
scene('e-ouvert', () => ({ objets: [...decor(), { g: pc.fond(), c: 'imprime' }, ...facadeComplete(0, 'vert', true)], vue: [0.12, 0.08, 1], largeur: 700, hauteur: 560, marge: 0.03 }))

scene('e-passerelle', () => {
  const { l, L, paroi: p, fond: fd } = P.passerelle
  return {
    objets: [
      { g: pc.passerelleFond(), c: 'imprime' },
      { g: translate([p + 0.8 - P.carte.x0, p - P.paroi, fd + 3 - P.carte.z + 25], A.carte(false)), c: 'neuf' },
      { g: translate([l + 2 * p + 15, 0, 0], pc.passerelleCouvercle()), c: 'imprime' },
    ],
    fleches: [{ de: [p + l / 2, p + L / 2, fd + 24], a: [p + l / 2, p + L / 2, fd + 6] }],
    vue: [0.45, 0.6, 1.2], largeur: 700, hauteur: 520,
  }
})


const lancer = Object.entries(scenes).filter(([nom]) => !filtre || nom.includes(filtre))
for (const [nom, f] of lancer) {
  const debut = Date.now()
  rendu(path.join(SORTIE, nom + '.png'), f())
  console.log(`${nom.padEnd(24)} ${((Date.now() - debut) / 1000).toFixed(1)} s`)
}
