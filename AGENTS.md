# KKG for Innovation — guide pour les agents de code (OpenCode, Claude Code…)

Site web 3D de vente de plans de construction du bureau **KKG for Innovation** (Kinshasa, RD Congo).
Langue du site, des messages et des commits : **français**.

## Structure
- Site statique (GitHub Pages, branche `main`, racine) : `index.html`, `projet.html`, `panier.html`, `sur-mesure.html`, `conditions.html`, `admin.html`, `studio.html`.
- `js/` : modules ES sans étape de compilation. Three.js 0.160 chargé par importmap (CDN jsdelivr).
  - `config.js` : coordonnées, licences, paiements (source de vérité).
  - `viewer.js` (visionneuse 3D), `visite.js` (visite à pied en première personne), `builder3d.js`, `projet.js`, `panier.js`…
  - `studio/` : atelier de conception (éditeur 2D, 3D, métré, exports DXF/PDF/GLB).
- `data/projets.json` : catalogue. `modeles/*.glb` : maquettes. `images/` : rendus.
- `agent-ia/` : Cloudflare Worker (assistant IA, boîte aux requêtes, agents de l'atelier).
- `specs/` : spécifications Spec Kit (`001-module-dao-cao`, `002-visite-interieure`).

## Règles
- Ne jamais committer de secret (clés API, mots de passe) ni les livrables privés des plans (PDF/DXF cotés, détails réservés).
- Les maquettes visitables suivent les conventions de `specs/002-visite-interieure/plan.md` (`sol-…`, `porte-…`, `visite-…`).
- Garder le site fonctionnel sans serveur ; tester dans un navigateur (`python3 -m http.server`).
- Textes juridiques (`conditions.html`) : ne pas modifier sans demande explicite du propriétaire.
