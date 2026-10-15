// Cotes de la porte magique, en millimètres.
//
// Repère du boîtier, vu depuis son propre jardin :
//   x vers la droite (vers la porte, pour la version « gauche »),
//   y vers le haut,
//   z vers l'avant : le fond est contre la clôture en z = 0, la façade est devant.

const P = {
  // Boîtier
  L: 110,               // largeur extérieure (x)
  H: 150,               // hauteur extérieure (y)
  paroi: 3,             // parois latérales
  fond: 4,              // fond, contre la clôture
  zRebord: 59,          // avant des parois : on y colle le joint mousse de 3 mm
  zPlots: 61,           // haut des plots de vis : le joint est écrasé à 2 mm
  facadeEp: 3,          // la façade va de z 61 à z 64
  collerette: 4,        // rebord intérieur qui porte le joint
  plotD: 8.5,
  plots: [[8, 8], [102, 8], [8, 142], [102, 142]],
  insertD: 4.0,         // trou pour un insert M3 × 5,7 (Ø extérieur 4,6)
  insertProf: 6.5,
  visD: 3.4,            // passage des vis M3 dans la façade
  oreilles: [[45, -8], [100, -8], [20, 158], [95, 158]],
  oreilleVisD: 4.5,     // vis à bois Ø4

  // Axe du taquet
  axe: [88, 126],

  // Roulement 608 2RS (Ø22 × Ø8 × 7) et visserie M8
  roulementD: 22.15,    // logement serré : le roulement s'enfonce à la presse
  roulementEp: 7,
  levre: 1.2,           // lèvre devant le roulement, qui le retient
  levreD: 18,
  bossageD: 28,
  bossageZ: 55.5,       // arrière du bossage du roulement
  rondelleEp: 1.6,
  ecrouCote: 13.3,      // logement d'écrou M8 (13 sur plats)
  ecrouH: 8,            // écrou Nylstop M8
  trou8: 8.4,
  teteProf: 8,          // logement de la tête de vis M8 dans le moyeu

  // Servo MG90S, posé à plat sur le fond, axe vers l'avant
  servo: {
    L: 22.8, l: 12.2,   // corps
    axeBout: 5.9,       // l'axe est à 5,9 mm d'un bout du corps
    entraxe: 27.8,      // entre les trous des pattes
    hautPattes: 17,     // du dessous du servo au dessous des pattes (le servo pend à ses pattes)
  },

  // Accouplement : palonnier en croix du servo d'un côté, écrou M8 de l'autre
  acc: { D: 30, ep: 17, z0: 35.5, croixL: 25, croixl: 6.8, croixProf: 2.6, pocheProf: 12, vis: 3.6 },

  // Taquet
  moyeuD: 32,
  moyeuEp: 16,
  R: 55,                // de l'axe au milieu du doigt
  doigt: 16,            // section du doigt (carré)
  doigts: [20, 30, 40, 50, 60],

  // Carte FireBeetle 2 ESP32-C6 (25,4 × 60), à plat, prise USB-C vers le bas
  carte: { x0: 13.5, l: 25.4, L: 60, z: 12 },
  usb: { l: 13, h: 11, z: 14.5 },     // trou de la prise USB-C dans la paroi du bas

  // Batterie LiPo 5 000 mAh (jusqu'à 11 × 56 × 86)
  berceau: { x0: 46, y0: 15, l: 56, L: 86, h: 8, ep: 2 },
  sangle: { l: 22, ep: 2.6, y0: 47, creux: 1.5 },   // sangle velcro de 20 mm

  // Bacs du module MOSFET et des bornes WAGO
  mosfet: { x0: 14, y0: 127, l: 35, L: 18 },
  wago: { x0: 14, y0: 105.2, l: 14.5, L: 19, n: 3 },

  // Passages dans la paroi du bas
  presseEtoupe: { x: 80, z: 28, D: 12.5 },
  purge: { x: 60, z: 7.5, D: 4 },

  // Bouton et appuis de la batterie, sur la façade
  bouton: { x: 55, y: 65, D: 16.4 },
  appuis: [[80, 35], [80, 80]],
  appuiZ: 18,

  // Passerelle (dans la maison)
  passerelle: { l: 27, L: 63, h: 14, paroi: 1.8, fond: 1.6 },
}

// Positions en z qui découlent des cotes ci-dessus
P.zFacade = P.zPlots + P.facadeEp                       // 64 : face avant de la façade
P.zRoulementAvant = P.zFacade - P.levre                  // 62,8
P.zRoulementArriere = P.zRoulementAvant - P.roulementEp  // 55,8
P.zMoyeu = P.zRoulementAvant + 2 * P.rondelleEp          // 66 : dos du moyeu (deux rondelles devant le roulement)
P.zBras = P.zMoyeu + P.moyeuEp                           // 82 : face avant du taquet

module.exports = P
