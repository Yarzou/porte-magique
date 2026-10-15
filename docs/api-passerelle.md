# Dialogue entre la passerelle et l'appli

La passerelle est la carte FireBeetle 2 ESP32-C6 branchée dans chaque maison. Elle parle à la porte en ESP-NOW et à l'appli par internet. Ce document décrit sa partie internet. Le simulateur `app/scripts/simulateur-passerelle.mjs` la joue déjà.

## Ce qu'il faut à la passerelle

| Valeur | D'où elle vient |
|---|---|
| `SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` du projet |
| `SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` du projet (clé publique) |
| `APP_URL` | l'adresse de l'appli, par exemple `https://porte-magique.vercel.app` |
| `PORTE_ID` et `PORTE_CLE` | l'appli : Réglages → Votre porte → Associer une passerelle |

La clé n'est affichée qu'une fois. La base n'en garde que l'empreinte SHA-256 : une nouvelle clé remplace l'ancienne.

## 1. Synchroniser, toutes les 3 à 5 secondes

```http
POST {SUPABASE_URL}/rest/v1/rpc/gateway_sync
apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {SUPABASE_ANON_KEY}
Content-Type: application/json

{
  "p_door": "{PORTE_ID}",
  "p_key": "{PORTE_CLE}",
  "p_lock": "ferme",          // état réel du taquet : "ouvert", "ferme" ou "bloque"
  "p_door_closed": true,      // contact de porte
  "p_battery_mv": 3950        // tension de la batterie de la porte, en mV
}
```

Les trois derniers champs sont facultatifs : ce qui n'est pas connu reste tel quel en base.

Réponse :

```json
{
  "target": "ouvert",          // ce que la porte doit faire maintenant
  "passage_open": false,       // les deux taquets sont ouverts : voyant vert
  "other_lock": "ferme",       // taquet de l'autre porte
  "angle_closed": 0,           // angles du servo, en degrés
  "angle_open": 90,
  "assembly_mode": false,      // mode montage : rester fermé
  "timezone": "Europe/Paris",
  "now": 1792094400,           // heure du serveur (secondes Unix), pour régler l'horloge
  "schedules": [               // horaires de la porte, pour continuer sans internet
    { "days": [3, 6, 7], "start": "14:00", "end": "18:00" }
  ]
}
```

- `target` tient déjà compte de tout : l'ordre donné dans l'appli, une ouverture « pour un moment » terminée, le début ou la fin d'un horaire, le mode montage. Le dernier événement l'emporte.
- Une clé inconnue renvoie une erreur 401 (`unknown_gateway`) : la passerelle doit s'arrêter et signaler qu'il faut une nouvelle clé.
- La base n'écrit l'état que s'il change, ou toutes les 30 s. L'appli juge la passerelle « hors ligne » au-delà de 90 s sans nouvelles.

### Sans internet

La passerelle garde la dernière réponse. Elle applique elle-même les `schedules` dans le fuseau `timezone`, avec la même règle : au début d'un horaire, ouvrir ; à la fin, fermer. Un ordre reçu plus tard l'emporte.

## 2. Signaler un événement

Seulement quand il se produit :

```http
POST {APP_URL}/api/passerelle
Content-Type: application/json

{ "door": "{PORTE_ID}", "key": "{PORTE_CLE}", "kind": "demande" }
```

| `kind` | Quand | Qui est prévenu |
|---|---|---|
| `demande` | un enfant appuie sur le bouton de la porte | les deux familles |
| `batterie_faible` | la batterie de la porte passe sous 3,5 V | la famille de la porte |

L'appli écarte les doublons : une seule demande par minute, une seule alerte de batterie toutes les 20 heures. Réponse : `{ "ok": true, "notified": 2 }`.

## 3. Côté porte (ESP-NOW)

La passerelle relaie à la porte, à chaque réveil de celle-ci :

- la position voulue du servo : `angle_open` si `target` vaut `ouvert` (et que le mode montage est coupé), sinon `angle_closed` ;
- la couleur du voyant : vert si `passage_open`, rouge sinon ;
- le rythme de réveil.

La porte lui renvoie l'état du taquet, le contact de porte, la tension de la batterie, et l'appui sur le bouton.
