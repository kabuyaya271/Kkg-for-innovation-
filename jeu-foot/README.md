# Foot Profils — jeu de football 11 contre 11 en 3D (prototype)

Chaque joueur humain crée **un seul footballeur** en répartissant **100 points** entre ses qualités (de 3 à 30 par qualité), puis le contrôle pendant un match en 3D. Les autres postes sont tenus par des robots.

Page publiée par GitHub Pages : `https://kabuyaya271.github.io/Kkg-for-innovation-/jeu-foot/`

## Ce qui existe

- **Création du joueur** : poste (attaquant, milieu, défenseur, gardien), archétypes, répartition des 100 points, validation stricte.
- **Match 11 contre 11** en 4-4-2 sur un terrain de 100 × 64 m : touches, corners, sorties de but, ballon au-dessus de la barre, jeu de tête.
- **Rendu 3D (Three.js 0.160)** : stade avec tribunes et public, panneaux, buts avec filets, joueurs articulés et animés, ombres, caméra TV qui suit le ballon, vue tactique.
- **Commandes selon la situation** : passe, tir à puissance dosée, passe en profondeur ; pressing, tacle, appel d'un coéquipier ; **auto-pressing** (joystick lâché : le joueur presse ou se replace seul).
- **Replay** exact du match (moteur déterministe).

Pas encore : fautes, hors-jeu, multijoueur en ligne.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `js/moteur.js` | Règles, physique, IA des robots. Aucun affichage, fonctionne dans le navigateur **et** dans Node. |
| `js/rendu3d.js` | Dessin 3D de l'état du moteur (aucune règle du jeu). |
| `js/app.js` | Écrans, commandes tactiles et clavier, sons, boucle de match. |
| `tests/simulation.js` | Tests du moteur (profils, déterminisme, remises en jeu). |

Le moteur ne reçoit, pour chaque humain, que des **entrées compactes** `[mx, my, drapeaux, puissance]`. Pour le multijoueur, ce même `moteur.js` tournera sur un serveur (par exemple un Durable Object du Worker Cloudflare `agent-ia/`) : chaque téléphone envoie ses entrées, le serveur calcule le match et renvoie l'état. Les clients ne peuvent donc pas tricher sur les points ou les résultats.

## Tester

```bash
# depuis la racine du dépôt
python3 -m http.server 8000      # puis ouvrir http://localhost:8000/jeu-foot/
cd jeu-foot && node tests/simulation.js
```

Commandes clavier : flèches ou ZQSD/WASD, Maj (sprint), J ou Espace (passe / pressing), K (tir maintenu / tacle), L (profondeur / aide), O (auto-pressing), P (pause).

## Ressources graphiques (toutes CC0 : usage commercial libre, sans attribution obligatoire)

| Fichier | Source |
|---|---|
| `assets/ciel.hdr` | Poly Haven — *Kloofendal 48d Partly Cloudy (Pure Sky)*, 1K : ciel et éclairage d'ambiance |
| `assets/pelouse.jpg`, `assets/pelouse_n.jpg` | ambientCG — *Grass004* (couleur et relief), réduits en 512 px |

Ces fichiers sont chargés après le démarrage : sans eux (réseau lent), le match s'affiche avec la pelouse et le ciel dessinés.
