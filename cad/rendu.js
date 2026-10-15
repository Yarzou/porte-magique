// Moteur de rendu des dessins de la notice : chaque scène devient une page
// three.js, photographiée par Chrome sans interface.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { pathToFileURL } = require('url')
const { geometries, modifiers } = require('@jscad/modeling')

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'porte-magique-'))
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }))
const THREE_URL = pathToFileURL(path.join(__dirname, 'node_modules', 'three')).href

const COULEURS = {
  imprime: '#f4f3ef',
  achat: '#c8cdd5',
  metal: '#b4b9c1',
  neuf: '#f5c15a',
  bois: '#dcc8a6',
  tasseau: '#e6d3b0',
  porte: '#c99b6b',
  sombre: '#5b6169',
  rouge: '#e0533f',
  vert: '#36b37e',
  mousse: '#4a4f57',
}

function triangles (g) {
  const sortie = []
  // Supprime les jonctions en T : sans cela, des arêtes parasites barrent les faces planes
  const propre = modifiers.generalize({ snap: true, triangulate: true }, g)
  for (const p of geometries.geom3.toPolygons(propre)) {
    const v = p.vertices
    for (let i = 1; i < v.length - 1; i++) sortie.push(...v[0], ...v[i], ...v[i + 1])
  }
  return Buffer.from(Float32Array.from(sortie).buffer).toString('base64')
}

// objets : [{ g, c }] ; c = clé de COULEURS
// fleches : [{ de: [x,y,z], a: [x,y,z] }] en pointillés
// etiquettes : [{ t: 'A', p: [x,y,z], dx, dy }] ; cotes : [{ de, a, t }]
function rendu (fichier, { objets, vue = [0.9, 0.7, 1.5], largeur = 1000, hauteur = 680, marge = 0.07, fleches = [], etiquettes = [], cotes = [], aretes = 28, cadre = null }) {
  const donnees = objets.map((o) => ({
    p: triangles(o.g),
    c: COULEURS[o.c] || o.c,
    a: o.aretes === false ? 0 : 1,
  }))
  const page = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff;overflow:hidden}svg{position:absolute;left:0;top:0}
text{font:700 17px "Segoe UI",system-ui,sans-serif}</style>
<script type="importmap">{"imports":{"three":"${THREE_URL}/build/three.module.js","three/addons/":"${THREE_URL}/examples/jsm/"}}</script></head>
<body><script type="module">
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
const W = ${largeur}, H = ${hauteur};
const objets = ${JSON.stringify(donnees)};
const fleches = ${JSON.stringify(fleches)};
const etiquettes = ${JSON.stringify(etiquettes)};
const cotes = ${JSON.stringify(cotes)};
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(W, H); renderer.setClearColor(0xffffff);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8dbe0, 1.9));
const soleil = new THREE.DirectionalLight(0xffffff, 1.1); soleil.position.set(0.5, 1, 0.8); scene.add(soleil);
const trait = new LineMaterial({ color: 0x2a2d31, linewidth: 1.5 }); trait.resolution.set(W, H);
const points = [];
for (const o of objets) {
  const bin = Uint8Array.from(atob(o.p), (ch) => ch.charCodeAt(0));
  const pos = new Float32Array(bin.buffer);
  for (let i = 0; i < pos.length; i += 3) points.push(new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: o.c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  if (o.a) {
    const lignes = new LineSegmentsGeometry().setPositions(new THREE.EdgesGeometry(geo, ${aretes}).attributes.position.array);
    scene.add(new LineSegments2(lignes, trait));
  }
}
const vue = new THREE.Vector3(${vue.join(',')}).normalize();
const boite = new THREE.Box3().setFromPoints(points); const centre = boite.getCenter(new THREE.Vector3());
for (const f of fleches) { boite.expandByPoint(new THREE.Vector3(...f.de)); boite.expandByPoint(new THREE.Vector3(...f.a)); }
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 10000);
cam.up.set(0, 1, 0); cam.position.copy(centre).addScaledVector(vue, 3000); cam.lookAt(centre); cam.updateMatrixWorld();
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
const inv = cam.matrixWorldInverse;
const cadre = ${JSON.stringify(cadre)};
const tous = cadre ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(cadre[i & 1 ? 3 : 0], cadre[i & 2 ? 4 : 1], cadre[i & 4 ? 5 : 2])) : points.concat(fleches.flatMap((f) => [new THREE.Vector3(...f.de), new THREE.Vector3(...f.a)]));
for (const p of tous) { const q = p.clone().applyMatrix4(inv); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
let w = x1 - x0, h = y1 - y0; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
if (w / h > W / H) h = w * H / W; else w = h * W / H;
w *= 1 + 2 * ${marge}; h *= 1 + 2 * ${marge};
cam.left = cx - w / 2; cam.right = cx + w / 2; cam.top = cy + h / 2; cam.bottom = cy - h / 2; cam.updateProjectionMatrix();
renderer.render(scene, cam);
const ecran = (p) => { const v = new THREE.Vector3(...p).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
let svg = '<svg width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg"><defs><marker id="m" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#2a2d31"/></marker></defs>';
for (const f of fleches) { const [a, b] = [ecran(f.de), ecran(f.a)]; svg += '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#2a2d31" stroke-width="1.6" stroke-dasharray="7 5" marker-end="url(#m)"/>'; }
for (const c of cotes) { const [a, b] = [ecran(c.de), ecran(c.a)]; svg += '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#c0392b" stroke-width="2" marker-end="url(#m)" marker-start="url(#m)"/><text x="'+((a[0]+b[0])/2 + (c.dx || 10))+'" y="'+((a[1]+b[1])/2 + (c.dy || 5))+'" fill="#c0392b">'+c.t+'</text>'; }
for (const e of etiquettes) { const [a0, a1] = ecran(e.p); const bx = a0 + (e.dx ?? 40), by = a1 + (e.dy ?? -40);
  svg += '<line x1="'+a0+'" y1="'+a1+'" x2="'+bx+'" y2="'+by+'" stroke="#2a2d31" stroke-width="1.3"/><circle cx="'+a0+'" cy="'+a1+'" r="2.6" fill="#2a2d31"/>';
  const lw = Math.max(30, 11 * e.t.length + 16);
  svg += '<rect x="'+(bx - lw/2)+'" y="'+(by-15)+'" width="'+lw+'" height="30" rx="15" fill="#fff" stroke="#2a2d31" stroke-width="1.8"/><text x="'+bx+'" y="'+(by+6)+'" text-anchor="middle" fill="#2a2d31">'+e.t+'</text>'; }
document.body.insertAdjacentHTML('beforeend', svg + '</svg>');
</script></body></html>`
  const html = path.join(TMP, path.basename(fichier, '.png') + '.html')
  fs.writeFileSync(html, page)
  execFileSync(CHROME, [
    '--headless=new', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${largeur},${hauteur}`,
    '--virtual-time-budget=10000', `--screenshot=${fichier}`, pathToFileURL(html).href,
  ], { stdio: 'ignore' })
}

module.exports = { rendu, COULEURS }
