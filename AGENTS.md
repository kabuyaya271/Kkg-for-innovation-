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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
