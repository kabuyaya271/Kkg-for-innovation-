# Feature Specification: Visite intérieure 3D des projets

**Feature Branch**: `002-visite-interieure`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Permettre au client de consulter l'intérieur du bâtiment en passant par les portes, les fenêtres ou une autre entrée. C'est pour cette raison que j'ai voulu que mon site soit en 3D."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrer dans la maison par une porte ou une fenêtre (Priority: P1)

Sur la fiche d'un projet, le client clique sur « Visite intérieure ». Des pastilles lumineuses apparaissent sur la maquette aux entrées possibles (portail, porte du hall, baie du salon, fenêtre d'une chambre, terrasse…). Il en choisit une : la caméra s'avance et traverse l'ouverture pour le placer à hauteur d'homme dans la pièce.

**Why this priority**: c'est la demande centrale du concepteur ; elle différencie le site.

**Independent Test**: sur un projet équipé, cliquer sur « Baie du salon » et vérifier qu'on se retrouve debout dans le salon, regard vers l'intérieur.

**Acceptance Scenarios**:

1. **Given** la maquette affichée, **When** le client active la visite, **Then** chaque entrée prévue est signalée par une pastille nommée.
2. **Given** les pastilles visibles, **When** le client touche une pastille, **Then** la caméra rejoint l'entrée puis passe à l'intérieur en moins de 3 secondes, à 1,60 m du sol.

---

### User Story 2 - Se déplacer librement de pièce en pièce (Priority: P1)

À l'intérieur, le client regarde autour de lui en glissant le doigt ou la souris, avance avec le clavier, les boutons à l'écran ou en touchant le sol, monte l'escalier, et ne traverse pas les murs ni les meubles.

**Why this priority**: sans déplacement, la visite se limite à une image fixe.

**Independent Test**: entrer par le hall, monter l'escalier jusqu'au 1er étage et rejoindre le salon sans traverser de mur.

**Acceptance Scenarios**:

1. **Given** le visiteur dans une pièce, **When** il avance vers un mur, **Then** il s'arrête avant le mur.
2. **Given** le visiteur au pied de l'escalier, **When** il avance, **Then** il monte marche par marche et arrive à l'étage.
3. **Given** un téléphone, **When** le visiteur utilise les boutons à l'écran, **Then** il peut avancer, reculer et tourner sans clavier.

---

### User Story 3 - Aller directement à une pièce ou un étage (Priority: P2)

Un menu liste les pièces par étage (Parking, Hall, Salon, Cuisine, Suite parentale…). Le client en choisit une et y est transporté.

**Independent Test**: choisir « Suite parentale » dans le menu et vérifier la position.

**Acceptance Scenarios**:

1. **Given** la visite active, **When** le client choisit une pièce, **Then** il est placé au centre de la pièce, au bon étage.

---

### User Story 4 - Ressortir (Priority: P2)

Un bouton « Sortir » ramène à la vue extérieure de la maquette.

### Edge Cases

- Projet sans intérieur ni repères de visite : le bouton « Visite intérieure » n'est pas proposé.
- Appareil peu puissant : la visite reste utilisable (pas d'ombres lourdes en intérieur).
- Le visiteur tombe d'un balcon ou sort du bâtiment : il reste au sol du niveau le plus proche, jamais dans le vide.
- Entrée par une fenêtre fermée : le passage se fait par animation de caméra, pas par collision.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La fiche projet DOIT proposer « Visite intérieure » si la maquette contient des repères de visite.
- **FR-002**: Les entrées DOIVENT être affichées comme pastilles cliquables nommées, suivies par la caméra.
- **FR-003**: Le passage dehors → dedans DOIT être animé et placer le regard à 1,60 m au-dessus du sol.
- **FR-004**: Le visiteur DOIT pouvoir regarder autour de lui (glisser), avancer/reculer/pas de côté (clavier ZQSD/WASD/flèches, boutons tactiles) et avancer en touchant un point du sol.
- **FR-005**: Les murs, meubles et vitrages DOIVENT arrêter le visiteur ; les portes sont ouvertes.
- **FR-006**: Le visiteur DOIT suivre le sol et monter/descendre les escaliers (marches jusqu'à 0,40 m).
- **FR-007**: Un menu DOIT permettre d'aller à chaque pièce, classée par niveau.
- **FR-008**: Un bouton « Sortir » DOIT revenir à la vue extérieure.
- **FR-009**: L'éclairage intérieur DOIT rendre les pièces lisibles de jour comme de nuit.
- **FR-010**: La visite DOIT fonctionner sur ordinateur, tablette et téléphone.

### Key Entities

- **Entrée de visite** : libellé, point dehors, point dedans.
- **Pièce de visite** : libellé, niveau, point central.
- **Surface praticable** : sols, paliers, marches, balcons, cour.

## Success Criteria *(mandatory)*

- **SC-001**: Un client entre dans la maison en un seul clic depuis la vue extérieure.
- **SC-002**: 100 % des pièces habitables sont accessibles par le menu ou à pied.
- **SC-003**: Aucun passage à travers un mur lors d'un parcours test complet (RDC → 3e étage).
- **SC-004**: La visite reste fluide sur un téléphone de milieu de gamme.

## Assumptions

- Les maquettes visitables sont produites par KKG for Innovation avec les conventions de nommage du plan technique (sols `sol-…`, portes `porte-…`, repères `visite-…`).
- Les projets dont la maquette publique n'a pas d'intérieur gardent la visite extérieure seule.
