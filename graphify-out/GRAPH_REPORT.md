# Graph Report - Kkg-for-innovation-  (2026-11-22)

## Corpus Check
- 81 files · ~114,528 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .glb 3, .css 2)

## Summary
- 878 nodes · 1597 edges · 52 communities (46 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92196468`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- esc
- app.js
- admin.js
- index.js
- Native, managed, and packaged artifacts
- common.sh
- steps
- Editeur
- Visite
- Tasks: [FEATURE NAME]
- speckit-analyze/SKILL.md
- opencode
- KKG Innovation — Boutique de plans de construction en 3D
- User Scenarios & Testing *(mandatory)*
- Implementation Plan: Visite intérieure 3D
- Execution Steps
- Desktop app environments from a request
- Feature Specification: [FEATURE NAME]
- speckit-plan/SKILL.md
- speckit-specify/SKILL.md
- speckit-tasks/SKILL.md
- Core Principles
- Core Principles
- reverse-engineer-anything/SKILL.md
- Agent environments from a live application
- Connection and task recovery
- Monter vos vidéos avec l'IA, gratuitement (OpenCode)
- Implementation Plan: [FEATURE]
- speckit-checklist/SKILL.md
- Visionneuse
- Textes pour accompagner la vidéo
- REA
- speckit-clarify/SKILL.md
- speckit-implement/SKILL.md
- KKG for Innovation — guide pour les agents de code (OpenCode, Claude Code…)
- JavaScript and Electron application artifacts
- Runtime observation
- speckit-constitution/SKILL.md
- Méthode de montage — KKG for Innovation
- [CHECKLIST TYPE] Checklist: [FEATURE NAME]
- rea
- Vidéo « Du plan à l'intérieur » — texte de la voix off
- tasks.md
- historique.js
- panier.js
- store.js
- OmniRoute — ne plus dépendre d'une seule IA
- Craft Anything branché sur Claude Code
- opencode.json
- installer-mac-linux.sh
- accueil.js
- viewer.js

## God Nodes (most connected - your core abstractions)
1. `Native, managed, and packaged artifacts` - 43 edges
2. `esc()` - 34 edges
3. `Editeur` - 31 edges
4. `Visite` - 29 edges
5. `Visionneuse` - 25 edges
6. `demarrer()` - 24 edges
7. `exporter()` - 17 edges
8. `formatPrix()` - 17 edges
9. `fmt()` - 17 edges
10. `fetch()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Structure` --references--> `Visite`  [INFERRED]
  specs/002-visite-interieure/plan.md → js/visite.js
- `Personnaliser l'assistant` --references--> `instructions()`  [INFERRED]
  agent-ia/README.md → agent-ia/src/index.js
- `etatIntegrite()` --indirect_call--> `esc()`  [INFERRED]
  js/historique.js → js/ui.js
- `empreinteMdp()` --calls--> `sha256()`  [EXTRACTED]
  js/admin.js → js/journal.js
- `rendre()` --indirect_call--> `formatPrix()`  [INFERRED]
  js/accueil.js → js/store.js

## Import Cycles
- None detected.

## Communities (52 total, 6 thin omitted)

### Community 0 - "esc"
Cohesion: 0.19
Nodes (18): montrerCode(), formater(), historique, initialiserAssistant(), envoyer(), lireHistorique(), sauver(), confirmer() (+10 more)

### Community 1 - "app.js"
Cohesion: 0.09
Nodes (68): afficherAgent(), afficherMetre(), afficherProprietes(), AGENTS, annuler(), API, api(), brouillon() (+60 more)

### Community 2 - "admin.js"
Cohesion: 0.08
Nodes (28): afficherRequetes(), apiPostes(), CHAMPS_PRIVES_ANCIENS, chargerRequetes(), connexion, empreinteMdp(), form, LIBELLE_TYPE (+20 more)

### Community 3 - "index.js"
Cohesion: 0.07
Nodes (51): dependencies, @anthropic-ai/sdk@^1.8.0, description, devDependencies, wrangler@^4.0.0, name, private, scripts (+43 more)

### Community 4 - "Native, managed, and packaged artifacts"
Cohesion: 0.04
Nodes (45): Apple app resources, Apple IPS crash reports, Binary hardening, Bridge request ceiling, Bun standalone executables, Continue editable Ghidra analysis across processes, CPython pyc files, Deno compile executables (+37 more)

### Community 5 - "common.sh"
Cohesion: 0.11
Nodes (30): check-prerequisites.sh script, check_dir(), check_file(), find_specify_root(), format_speckit_command(), get_current_branch(), get_feature_paths(), get_invoke_separator() (+22 more)

### Community 6 - "steps"
Cohesion: 0.05
Nodes (37): args, inputs, integration, spec, speckit_review_plan_verdict, speckit_review_spec_verdict, default, prompt (+29 more)

### Community 7 - "Editeur"
Cohesion: 0.18
Nodes (5): e(), Editeur, n2(), arrondi(), projeterSurSegment()

### Community 9 - "Tasks: [FEATURE NAME]"
Cohesion: 0.07
Nodes (26): Dependencies & Execution Order, Format: `[ID] [P?] [Story] Description`, Implementation for User Story 1, Implementation for User Story 2, Implementation for User Story 3, Implementation Strategy, Incremental Delivery, MVP First (User Story 1 Only) (+18 more)

### Community 10 - "speckit-analyze/SKILL.md"
Cohesion: 0.08
Nodes (25): 1. Initialize Analysis Context, 2. Load Artifacts (Progressive Disclosure), 3. Build Semantic Models, 4. Detection Passes (Token-Efficient Analysis), 5. Severity Assignment, 6. Produce Compact Analysis Report, 7. Provide Next Actions, 8. Offer Remediation (+17 more)

### Community 11 - "opencode"
Cohesion: 0.08
Nodes (25): GITHUB_TOKEN, types, jobs, opencode, name, on, issue_comment, pull_request_review_comment (+17 more)

### Community 12 - "KKG Innovation — Boutique de plans de construction en 3D"
Cohesion: 0.08
Nodes (22): Agent IA et boîte aux requêtes — KKG for Innovation, Ce qu'il vous faut, Mise en ligne en ligne de commande (≈ 15 minutes), Mise en ligne la plus simple : le bouton (sans ordinateur), Personnaliser l'assistant, Sécurité, Tester en local, Ajouter un projet (+14 more)

### Community 13 - "User Scenarios & Testing *(mandatory)*"
Cohesion: 0.10
Nodes (19): Content Quality, Feature Readiness, Notes, Requirement Completeness, Specification Quality Checklist: Module de DAO/CAO de l'atelier, Assumptions, Edge Cases, Feature Specification: Module de DAO/CAO de l'atelier (+11 more)

### Community 14 - "Implementation Plan: Visite intérieure 3D"
Cohesion: 0.10
Nodes (18): Approche, Conventions de la maquette (contrat), Implementation Plan: Visite intérieure 3D, Structure, Summary, Technical Context, Assumptions, Edge Cases (+10 more)

### Community 15 - "Execution Steps"
Cohesion: 0.12
Nodes (15): 1. Initialize Convergence Context, 2. Load Artifacts (Progressive Disclosure), 3. Build the Intent Inventory, 4. Assess the Codebase and Classify Findings, 5. Assign Severity, 6. Present the In-Session Findings Summary, 7. Append Convergence Tasks (or report converged), 8. Provide Next Actions (Handoff) (+7 more)

### Community 16 - "Desktop app environments from a request"
Cohesion: 0.13
Nodes (15): Ask once, upfront, Build the seed and the edit, Choose the install, Close and report, Desktop app environments from a request, Drive the app, Export, Harder tasks (+7 more)

### Community 17 - "Feature Specification: [FEATURE NAME]"
Cohesion: 0.15
Nodes (12): Assumptions, Edge Cases, Feature Specification: [FEATURE NAME], Functional Requirements, Key Entities *(include if feature involves data)*, Measurable Outcomes, Requirements *(mandatory)*, Success Criteria *(mandatory)* (+4 more)

### Community 18 - "speckit-plan/SKILL.md"
Cohesion: 0.18
Nodes (10): Completion Report, Done When, Key rules, Mandatory Post-Execution Hooks, Outline, Phase 0: Outline & Research, Phase 1: Design & Contracts, Phases (+2 more)

### Community 19 - "speckit-specify/SKILL.md"
Cohesion: 0.18
Nodes (10): Completion Report, Done When, For AI Generation, Mandatory Post-Execution Hooks, Outline, Pre-Execution Checks, Quick Guidelines, Section Requirements (+2 more)

### Community 20 - "speckit-tasks/SKILL.md"
Cohesion: 0.18
Nodes (10): Checklist Format (REQUIRED), Completion Report, Done When, Mandatory Post-Execution Hooks, Outline, Phase Structure, Pre-Execution Checks, Task Generation Rules (+2 more)

### Community 21 - "Core Principles"
Cohesion: 0.18
Nodes (10): Core Principles, Governance, [PRINCIPLE_1_NAME], [PRINCIPLE_2_NAME], [PRINCIPLE_3_NAME], [PRINCIPLE_4_NAME], [PRINCIPLE_5_NAME], [PROJECT_NAME] Constitution (+2 more)

### Community 22 - "Core Principles"
Cohesion: 0.18
Nodes (10): Core Principles, Governance, [PRINCIPLE_1_NAME], [PRINCIPLE_2_NAME], [PRINCIPLE_3_NAME], [PRINCIPLE_4_NAME], [PRINCIPLE_5_NAME], [PROJECT_NAME] Constitution (+2 more)

### Community 24 - "Agent environments from a live application"
Cohesion: 0.20
Nodes (10): Agent environments from a live application, Before recording, Check coverage, Describe the change, Export and hand off, Export the task, Pick the checks, Record a session an environment can learn writes from (+2 more)

### Community 25 - "Connection and task recovery"
Cohesion: 0.22
Nodes (9): Choose the remedy from the observed failure, Codex tool approval is separate from REA readiness, Connection and task recovery, Continue through an installed CLI, Distinguish client and server deadlines, REA installed as a client plugin, Recovery ladder, Repair an editable REA limit (+1 more)

### Community 26 - "Monter vos vidéos avec l'IA, gratuitement (OpenCode)"
Cohesion: 0.22
Nodes (8): Depuis GitHub (sans ordinateur), Monter vos vidéos avec l'IA, gratuitement (OpenCode), Étape 1 — Installer OpenCode (gratuit), Étape 2 — Choisir un modèle gratuit (sans compte ni abonnement), Étape 3 — Installer les outils de montage, Étape 4 — Préparer le dossier, Étape 5 — Expliquer votre contenu, Étape 6 — Monter

### Community 27 - "Implementation Plan: [FEATURE]"
Cohesion: 0.22
Nodes (8): Complexity Tracking, Constitution Check, Documentation (this feature), Implementation Plan: [FEATURE], Project Structure, Source Code (repository root), Summary, Technical Context

### Community 28 - "speckit-checklist/SKILL.md"
Cohesion: 0.25
Nodes (7): Anti-Examples: What NOT To Do, Checklist Purpose: "Unit Tests for English", Example Checklist Types & Sample Items, Execution Steps, Post-Execution Checks, Pre-Execution Checks, User Input

### Community 29 - "Visionneuse"
Cohesion: 0.25
Nodes (3): demarrer(), demarrer(), Visionneuse

### Community 30 - "Textes pour accompagner la vidéo"
Cohesion: 0.22
Nodes (8): Conseils de publication, Diaspora (Facebook, groupes de la diaspora congolaise), Facebook / Instagram (publication ou Reel), Résidence Rwenzori — texte de publication, Statut WhatsApp, Textes pour accompagner la vidéo, TikTok (court), Villa Royale — texte de publication

### Community 31 - "REA"
Cohesion: 0.29
Nodes (7): Connect only when needed, Finish the task, Plan broader investigations, REA, Read only the relevant guide, Route the target first, Work summary-first

### Community 32 - "speckit-clarify/SKILL.md"
Cohesion: 0.29
Nodes (6): Completion Report, Done When, Mandatory Post-Execution Hooks, Outline, Pre-Execution Checks, User Input

### Community 33 - "speckit-implement/SKILL.md"
Cohesion: 0.29
Nodes (6): Completion Report, Done When, Mandatory Post-Execution Hooks, Outline, Pre-Execution Checks, User Input

### Community 34 - "KKG for Innovation — guide pour les agents de code (OpenCode, Claude Code…)"
Cohesion: 0.40
Nodes (4): graphify, KKG for Innovation — guide pour les agents de code (OpenCode, Claude Code…), Règles, Structure

### Community 35 - "JavaScript and Electron application artifacts"
Cohesion: 0.33
Nodes (6): Inventory route candidates without returning the application graph, JavaScript and Electron application artifacts, Read a module without repeating analysis, Recover an oversized display, Reusing application Evidence, Trace only the remaining question

### Community 36 - "Runtime observation"
Cohesion: 0.33
Nodes (5): Browser and Electron, Fiddler Everywhere traffic debugging, Native runtime questions, Runtime observation, Who performs the action

### Community 37 - "speckit-constitution/SKILL.md"
Cohesion: 0.33
Nodes (5): Outline, Post-Execution Checks, Pre-Execution Checks, Scope Guard, User Input

### Community 38 - "Méthode de montage — KKG for Innovation"
Cohesion: 0.33
Nodes (5): 1. Stratégie, 2. Méthode (structure d'une vidéo de 30 à 60 s), 3. Styles, Itérations, Méthode de montage — KKG for Innovation

### Community 39 - "[CHECKLIST TYPE] Checklist: [FEATURE NAME]"
Cohesion: 0.40
Nodes (4): [Category 1], [Category 2], [CHECKLIST TYPE] Checklist: [FEATURE NAME], Notes

### Community 40 - "rea"
Cohesion: 0.40
Nodes (4): craft-anything-cli, npx, craft-anything, rea

### Community 43 - "historique.js"
Cohesion: 0.22
Nodes (25): afficher(), charger(), complet, dateFr(), documentHtml(), etatIntegrite(), exporter(), filtrer() (+17 more)

### Community 44 - "panier.js"
Cohesion: 0.29
Nodes (12): bonDeCommande(), confirmer(), detail, lieuTexte(), lireClient(), messageWhatsApp(), methodesDisponibles(), rendre() (+4 more)

### Community 45 - "store.js"
Cohesion: 0.18
Nodes (23): aDesModificationsLocales(), ajouterAuPanier(), aplatir(), changerLicence(), chargerProjetsFichier(), detailPanier(), ecrire(), enregistrerCommande() (+15 more)

### Community 46 - "OmniRoute — ne plus dépendre d'une seule IA"
Cohesion: 0.29
Nodes (6): 1. Installer (une seule fois), 2. Brancher des IA gratuites (avec VOS comptes officiels), 3. Utiliser vos outils à travers OmniRoute, 4. Démarrage automatique (facultatif), OmniRoute — ne plus dépendre d'une seule IA, Règles de prudence

### Community 47 - "Craft Anything branché sur Claude Code"
Cohesion: 0.33
Nodes (5): 1. Installer (version vérifiée : 0.6.1), 2. Vérifier dans Claude Code, 3. Utiliser, Craft Anything branché sur Claude Code, Règles d'usage

### Community 50 - "accueil.js"
Cohesion: 0.23
Nodes (15): etat, imageDe(), rendre(), vignettes, valeurs, CONFIG, id, blocConfidentialite() (+7 more)

### Community 51 - "viewer.js"
Cohesion: 0.18
Nodes (13): arbre(), box(), construireProjet(), fenetres(), liberer(), MODELE_DEFAUT, rng(), std() (+5 more)

## Knowledge Gaps
- **2 isolated node(s):** `craft-anything-cli`, `npx`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 423 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Visite` connect `Visite` to `accueil.js`, `viewer.js`, `Visionneuse`, `Implementation Plan: Visite intérieure 3D`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `craft-anything-cli`, `npx` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08540540540540541 - nodes in this community are weakly interconnected._
- **Why does `Editeur` connect `Editeur` to `app.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `admin.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08403361344537816 - nodes in this community are weakly interconnected._
- **Why does `Visionneuse` connect `Visionneuse` to `app.js`, `accueil.js`, `admin.js`, `viewer.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06578947368421052 - nodes in this community are weakly interconnected._