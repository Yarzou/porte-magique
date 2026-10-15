// Génère les fichiers STL de ../impression, posés dans le sens d'impression.
//   npm install
//   npm run stl

const fs = require('fs')
const path = require('path')
const { transforms, measurements, modifiers } = require('@jscad/modeling')
const stl = require('@jscad/stl-serializer')
const P = require('./parametres')
const pieces = require('./pieces')

const { translate, rotateX } = transforms
const sortie = path.join(__dirname, '..', 'impression')
fs.mkdirSync(sortie, { recursive: true })

// Pose la pièce sur le plateau (z min = 0), centrée en x et y
function surLePlateau (g) {
  const [[x0, y0, z0], [x1, y1]] = measurements.measureBoundingBox(g)
  return translate([-(x0 + x1) / 2, -(y0 + y1) / 2, -z0], g)
}

// Retourne une pièce face avant contre le plateau (une rotation, pas un miroir, qui inverserait la pièce)
const retourner = (g) => rotateX(Math.PI, g)

function ecrire (nom, g) {
  // Maillage étanche (sans jonction en T), que les trancheurs acceptent sans réparation
  const donnees = stl.serialize({ binary: true }, modifiers.generalize({ snap: true, triangulate: true }, surLePlateau(g)))
  const fichier = path.join(sortie, nom + '.stl')
  fs.writeFileSync(fichier, Buffer.concat(donnees.map((d) => Buffer.from(d))))
  const [[x0, y0, z0], [x1, y1, z1]] = measurements.measureBoundingBox(g)
  console.log(`${nom.padEnd(28)} ${(x1 - x0).toFixed(0)} × ${(y1 - y0).toFixed(0)} × ${(z1 - z0).toFixed(0)} mm`)
}

for (const cote of ['gauche', 'droite']) {
  ecrire(`boitier-fond-${cote}`, pieces.fond(cote))
  ecrire(`boitier-facade-${cote}`, retourner(pieces.facade(cote)))
}
for (const Lf of P.doigts) ecrire(`taquet-doigt-${Lf}`, retourner(pieces.taquet(Lf)))
ecrire('accouplement', pieces.accouplement())
ecrire('bouchon-usb', pieces.bouchonUsb())
ecrire('passerelle-fond', pieces.passerelleFond())
ecrire('passerelle-couvercle', pieces.passerelleCouvercle())
