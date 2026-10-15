# Porte magique

Verrou connecté, sur batterie, pour la petite porte percée dans la clôture entre deux jardins voisins.
Chaque famille a sa porte, de son côté : le passage n'est ouvert que si les deux sont déverrouillées.

## Principe

- **Sur chaque porte** : un taquet tournant motorisé (servo), vissé sur la clôture du côté opposé aux charnières, une carte XIAO ESP32-C6 en veille profonde, un contact de porte, un bouton lumineux pour les enfants et une batterie LiPo.
- **Dans chaque maison** : une passerelle XIAO ESP32-C6 sur prise USB, reliée à la porte en ESP-NOW et au wifi de la maison.
- **Ensuite** : une appli web pour les deux familles (double accord, demandes des enfants, horaires, notifications).

## Contenu

- `docs/materiel.pdf` : matériel et liste d'achat (source : `docs/materiel.html`).
- À venir : `firmware/` (porte et passerelle), `cad/` (pièces à imprimer, OpenSCAD), `app/`.

## Régénérer le PDF

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="D:/GIT/porte-magique/docs/materiel.pdf" "file:///D:/GIT/porte-magique/docs/materiel.html"
```
