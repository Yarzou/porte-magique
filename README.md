# Porte magique

Verrou connecté, sur batterie, pour la petite porte percée dans la clôture entre deux jardins voisins.
Chaque famille a sa porte, de son côté : le passage n'est ouvert que si les deux sont déverrouillées.

## Principe

- **Sur chaque porte** : un boîtier imprimé vissé sur la clôture, à côté du bord de la porte. Son taquet, entraîné par un servo, pivote devant le bord de la porte pour la bloquer. Dedans : une carte FireBeetle 2 ESP32-C6 en veille profonde, un module MOSFET qui coupe le servo au repos, un contact de porte, un bouton lumineux pour les enfants et une batterie LiPo rechargeable par USB-C.
- **Dans chaque maison** : une passerelle (une seconde carte FireBeetle) sur prise USB, reliée à la porte en ESP-NOW et au wifi de la maison.
- **Ensuite** : le programme des cartes, puis une appli web pour les deux familles (double accord, demandes des enfants, horaires, notifications).

## Contenu

| Dossier | Contenu |
|---|---|
| `docs/materiel.pdf` | Liste d'achat (source : `docs/materiel.html`) |
| `docs/notice.pdf` | Notice de montage, étape par étape (source : `docs/notice.html`, dessins dans `docs/notice/img/`) |
| `impression/` | Fichiers STL à imprimer, déjà orientés pour l'impression |
| `cad/` | Sources des pièces (JSCAD, en JavaScript) et des dessins de la notice |

## Modifier les pièces

Toutes les cotes sont dans `cad/parametres.js` (par exemple la liste des longueurs de doigt du taquet).

```bash
cd cad
npm install
npm run stl       # régénère impression/*.stl
npm run rendus    # régénère les dessins de la notice (Chrome est nécessaire)
```

## Régénérer les PDF

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless --no-pdf-header-footer --print-to-pdf="D:/GIT/porte-magique/docs/materiel.pdf" "file:///D:/GIT/porte-magique/docs/materiel.html"
"$CHROME" --headless --no-pdf-header-footer --print-to-pdf="D:/GIT/porte-magique/docs/notice.pdf" "file:///D:/GIT/porte-magique/docs/notice.html"
```
