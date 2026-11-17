# Feature Specification: Module de DAO/CAO de l'atelier

**Feature Branch**: `001-module-dao-cao`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Module de DAO/CAO professionnel pour l'atelier (studio.html) du site KKG for Innovation (bureau de conception de plans à Kinshasa, RD Congo), utilisé par le concepteur et ses collègues ingénieurs/architectes pour dessiner des bâtiments de tous genres, gratuitement et sans logiciel payant. Fonctions attendues : (1) calques nommés avec visibilité, verrouillage et couleur ; (2) outils de dessin précis avec accroches, saisie de longueurs et d'angles, orthogonal ; (3) cotation automatique et manuelle ; (4) bibliothèque de blocs paramétriques ; (5) génération automatique des façades et des coupes ; (6) import et export DXF, export DWG si possible via une brique libre, export IFC, export PDF à l'échelle avec cartouche, export SVG/PNG ; (7) annuler/rétablir illimité, sauvegarde automatique locale, travail hors ligne ; (8) dans le navigateur (ordinateur et tablette), en français, sans installation, uniquement avec des briques libres compatibles avec un usage commercial ; (9) les agents IA spécialisés de l'atelier restent disponibles. Contraintes : aucun contournement de licence de logiciels payants ; interopérabilité avec AutoCAD par des formats ouverts ou documentés."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dessiner un plan précis avec calques et accroches (Priority: P1)

Un concepteur ouvre l'atelier dans son navigateur et dessine le plan d'un niveau : il trace des murs, des lignes, polylignes, arcs, cercles et rectangles en tapant les longueurs et les angles exacts, en s'accrochant aux extrémités, milieux, intersections et perpendiculaires, en mode orthogonal si besoin. Il range chaque élément dans un calque (murs, structure, mobilier, cotes, textes, réseaux…) qu'il peut masquer, verrouiller ou recolorer. Il annule et rétablit autant de fois que nécessaire.

**Why this priority**: c'est le cœur d'un logiciel de DAO ; sans dessin précis, aucune autre fonction n'a de valeur.

**Independent Test**: dessiner un rectangle de 12,00 × 9,50 m par saisie numérique, une diagonale accrochée aux deux coins opposés et un cercle centré sur le milieu d'un côté ; vérifier les dimensions affichées et le comportement des calques masqués/verrouillés.

**Acceptance Scenarios**:

1. **Given** l'outil ligne actif, **When** l'utilisateur clique un point puis tape « 5,40 » et un angle de 90°, **Then** une ligne de 5,40 m exactement est créée dans cette direction.
2. **Given** deux lignes qui se croisent, **When** le curseur approche de leur croisement, **Then** un repère d'accroche « intersection » s'affiche et le point saisi est exactement sur l'intersection.
3. **Given** un calque verrouillé, **When** l'utilisateur tente de sélectionner ou modifier un élément de ce calque, **Then** l'élément reste inchangé.
4. **Given** un calque masqué, **When** l'utilisateur affiche, imprime ou exporte le plan, **Then** ses éléments n'apparaissent pas.
5. **Given** 50 actions successives, **When** l'utilisateur annule 50 fois puis rétablit 50 fois, **Then** le dessin revient exactement à chaque état intermédiaire.

---

### User Story 2 - Échanger les plans avec AutoCAD et les autres logiciels (Priority: P1)

Un collègue envoie un plan réalisé dans AutoCAD ; le concepteur l'importe, le complète, puis le renvoie. Il remet aussi au client ou à un bureau d'études des fichiers ouvrables dans leurs logiciels (DXF/DWG pour la DAO, IFC pour le BIM) et des planches PDF à l'échelle avec cartouche.

**Why this priority**: sans échange de fichiers, l'atelier reste isolé des collègues et des partenaires qui utilisent d'autres logiciels ; c'est aussi ce qui permet de livrer les plans vendus.

**Independent Test**: importer un fichier DXF de référence contenant calques, lignes, arcs, textes et cotes ; le réexporter ; le rouvrir dans un logiciel de DAO libre et vérifier calques, géométrie et textes.

**Acceptance Scenarios**:

1. **Given** un fichier DXF venant d'AutoCAD, **When** l'utilisateur l'importe, **Then** ses calques, lignes, polylignes, arcs, cercles, textes et blocs apparaissent avec leurs noms et couleurs.
2. **Given** un plan de l'atelier, **When** l'utilisateur l'exporte en DXF, **Then** le fichier s'ouvre dans les logiciels de DAO courants avec les mêmes calques, cotes et textes (accents compris).
3. **Given** un plan à plusieurs niveaux avec murs, ouvertures et pièces, **When** l'utilisateur l'exporte en IFC, **Then** un logiciel BIM libre affiche les niveaux, murs, portes, fenêtres et espaces.
4. **Given** un plan, **When** l'utilisateur choisit « PDF au 1/100 en A3 », **Then** une cote de 10,00 m mesure 10 cm sur la feuille imprimée et la planche comporte un cartouche.
5. **Given** un plan, **When** l'utilisateur demande un export DWG, **Then** il obtient un fichier DWG si l'atelier dispose d'un convertisseur libre compatible ; sinon un message lui propose le DXF, que les logiciels compatibles DWG ouvrent directement.

---

### User Story 3 - Insérer des blocs paramétriques et coter automatiquement (Priority: P2)

Le concepteur insère depuis une bibliothèque des portes, fenêtres, escaliers, sanitaires, éléments de cuisine, meubles, arbres et véhicules dont il règle les dimensions (largeur, sens d'ouverture, nombre de marches…). Il lance la cotation automatique des murs et des ouvertures, puis ajoute des cotes manuelles.

**Why this priority**: accélère fortement la production et donne aux plans un rendu professionnel, mais le dessin et l'échange de fichiers restent prioritaires.

**Independent Test**: insérer une porte de 0,90 m dans un mur, la passer à 1,00 m, inverser son sens, puis lancer la cotation automatique et vérifier les chaînes de cotes.

**Acceptance Scenarios**:

1. **Given** un mur, **When** l'utilisateur dépose une porte de la bibliothèque dessus, **Then** la porte s'insère dans le mur, qui s'ouvre à sa largeur.
2. **Given** une porte insérée, **When** l'utilisateur change sa largeur ou son sens d'ouverture, **Then** le symbole et l'ouverture du mur se mettent à jour.
3. **Given** un niveau dessiné, **When** l'utilisateur lance la cotation automatique, **Then** des chaînes de cotes extérieures (totales, axes des murs, ouvertures) sont créées sur un calque de cotes, sans chevauchement.
4. **Given** un escalier paramétrique, **When** l'utilisateur fixe la hauteur à franchir, **Then** le nombre et la hauteur des marches sont calculés et affichés.

---

### User Story 4 - Obtenir automatiquement façades et coupes (Priority: P2)

À partir des plans de niveaux et de leurs hauteurs, le concepteur génère les quatre façades et une coupe dont il place la ligne sur le plan. Il complète ces vues puis les met en page avec les plans.

**Why this priority**: les façades et coupes sont exigées dans un dossier de plans complet ; les générer automatiquement fait gagner des heures, mais elles dépendent des plans (P1).

**Independent Test**: sur une maison R+1 dessinée, générer la façade principale et une coupe ; vérifier que les hauteurs d'étage, les ouvertures et la toiture apparaissent aux bonnes cotes.

**Acceptance Scenarios**:

1. **Given** un projet à plusieurs niveaux, **When** l'utilisateur demande les façades, **Then** quatre vues sont créées, avec ouvertures, niveaux et toiture aux bonnes hauteurs.
2. **Given** une ligne de coupe tracée sur le plan, **When** l'utilisateur génère la coupe, **Then** la vue montre les murs coupés, les dalles, les ouvertures et les cotes de niveau.
3. **Given** un plan modifié après génération, **When** l'utilisateur actualise les vues, **Then** façades et coupes reflètent la modification.

---

### User Story 5 - Travailler sans connexion et sans perdre son travail (Priority: P3)

Le concepteur travaille sur un chantier ou pendant une coupure d'Internet : l'atelier déjà ouvert continue de fonctionner, sauvegarde automatiquement et restaure le travail après une fermeture accidentelle du navigateur.

**Why this priority**: important dans le contexte local (connexion instable), mais le module reste utile en ligne sans cette fonction.

**Independent Test**: ouvrir l'atelier, couper la connexion, dessiner, fermer brutalement l'onglet, le rouvrir : le dessin est restauré.

**Acceptance Scenarios**:

1. **Given** l'atelier déjà ouvert une fois, **When** la connexion est coupée, **Then** l'atelier se recharge et toutes les fonctions de dessin et d'export de fichiers restent disponibles.
2. **Given** un dessin en cours, **When** le navigateur se ferme sans enregistrement manuel, **Then** à la réouverture l'atelier propose de restaurer le travail, avec au plus 30 secondes de travail perdu.

---

### Edge Cases

- Un fichier importé est très volumineux (plus de 50 000 éléments) : l'atelier affiche une progression et reste utilisable, ou explique clairement la limite.
- Un fichier importé contient des éléments non pris en charge (solides 3D, objets propriétaires) : ils sont ignorés et un rapport liste ce qui n'a pas été importé.
- Un fichier corrompu ou d'un autre format est importé : un message clair, sans perte du dessin en cours.
- Les unités du fichier importé diffèrent (millimètres, centimètres, pieds) : l'atelier détecte ou demande l'unité et met à l'échelle.
- Deux accroches sont possibles au même endroit : la plus prioritaire s'affiche et l'utilisateur peut basculer vers l'autre.
- Le stockage local du navigateur est plein ou désactivé : l'utilisateur est averti et invité à exporter son projet.
- Utilisation sur tablette tactile, sans clavier ni clic droit : toutes les fonctions restent accessibles au doigt.
- Un bloc paramétrique reçoit une valeur impossible (porte plus large que le mur) : la valeur est refusée avec une explication.

## Requirements *(mandatory)*

### Functional Requirements

**Calques**

- **FR-001**: Les utilisateurs DOIVENT pouvoir créer, renommer, supprimer et réordonner des calques nommés.
- **FR-002**: Chaque calque DOIT avoir une couleur, un type et une épaisseur de trait, ainsi que des états visible/masqué et verrouillé/déverrouillé.
- **FR-003**: L'atelier DOIT proposer par défaut les calques : Murs, Structure, Ouvertures, Mobilier, Sanitaires, Réseaux, Cotes, Textes, Hachures, Aménagements extérieurs.
- **FR-004**: Les éléments d'un calque verrouillé NE DOIVENT PAS pouvoir être sélectionnés ni modifiés ; ceux d'un calque masqué NE DOIVENT PAS apparaître à l'écran, à l'impression ni à l'export.

**Dessin et précision**

- **FR-005**: L'atelier DOIT offrir les outils : ligne, polyligne, arc, cercle, rectangle, hachure, texte, en plus des murs, ouvertures et pièces déjà existants.
- **FR-006**: L'atelier DOIT offrir les accroches extrémité, milieu, intersection, perpendiculaire, centre et proche, activables séparément, avec un repère visuel distinct pour chacune.
- **FR-007**: L'utilisateur DOIT pouvoir taper la longueur, l'angle ou les coordonnées d'un point pendant le dessin, au centimètre près.
- **FR-008**: L'atelier DOIT offrir un mode orthogonal et une grille magnétique réglable.
- **FR-009**: L'atelier DOIT offrir les modifications courantes : déplacer, copier, rotation, symétrie, échelle, décaler, ajuster, prolonger, raccorder, réseau, effacer.
- **FR-010**: L'historique annuler/rétablir DOIT couvrir toutes les actions de la séance, sans limite pratique de nombre d'étapes.

**Cotation**

- **FR-011**: L'utilisateur DOIT pouvoir créer des cotes linéaires, alignées, angulaires et de rayon, ainsi que des cotes de niveau.
- **FR-012**: La cotation automatique DOIT générer les chaînes extérieures (totales, axes des murs, ouvertures) d'un niveau sur le calque Cotes.
- **FR-013**: Les cotes DOIVENT rester associées aux éléments cotés et se mettre à jour lorsqu'ils sont modifiés.

**Bibliothèque de blocs**

- **FR-014**: L'atelier DOIT proposer une bibliothèque classée : portes, fenêtres, escaliers, sanitaires, cuisine, mobilier, arbres et végétation, véhicules.
- **FR-015**: Les portes, fenêtres et escaliers DOIVENT être paramétriques (dimensions, sens, nombre de vantaux, nombre et hauteur des marches) et modifiables après insertion.
- **FR-016**: L'utilisateur DOIT pouvoir enregistrer sa propre sélection comme bloc réutilisable.

**Façades et coupes**

- **FR-017**: L'atelier DOIT générer les quatre façades d'un projet à partir des plans de niveaux, des hauteurs et du type de toiture.
- **FR-018**: L'atelier DOIT générer une coupe à partir d'une ligne de coupe tracée sur un plan.
- **FR-019**: Façades et coupes DOIVENT pouvoir être actualisées après une modification des plans.

**Échanges de fichiers**

- **FR-020**: L'atelier DOIT importer les fichiers DXF (calques, lignes, polylignes, arcs, cercles, textes, cotes, blocs) et fournir un rapport des éléments non importés.
- **FR-021**: L'atelier DOIT exporter en DXF en conservant calques, couleurs, cotes, textes accentués et blocs.
- **FR-022**: L'atelier DOIT exporter en IFC un modèle contenant au minimum niveaux, murs, portes, fenêtres, dalles et espaces.
- **FR-023**: L'atelier DOIT exporter en PDF à une échelle choisie (1/50, 1/100, 1/200, 1/500) et sur un format choisi (A4 à A0), avec un cartouche au nom de KKG for Innovation.
- **FR-024**: L'atelier DOIT exporter en SVG et PNG.
- **FR-025**: L'atelier DOIT proposer l'export DWG uniquement au moyen d'une brique libre dont la licence permet l'usage commercial ; à défaut, il DOIT expliquer que le DXF s'ouvre dans les logiciels compatibles DWG.

**Fonctionnement**

- **FR-026**: L'atelier DOIT fonctionner dans un navigateur récent, sur ordinateur et sur tablette tactile, sans installation.
- **FR-027**: L'atelier DOIT sauvegarder automatiquement le projet sur l'appareil au moins toutes les 30 secondes et proposer sa restauration après une fermeture inattendue.
- **FR-028**: Une fois chargé une première fois, l'atelier DOIT fonctionner hors connexion pour le dessin, la sauvegarde locale et les exports.
- **FR-029**: L'interface, les messages et la documentation DOIVENT être en français.
- **FR-030**: Les agents IA spécialisés existants de l'atelier DOIVENT rester disponibles lorsque la connexion le permet, et pouvoir lire le dessin en cours.
- **FR-031**: Le module NE DOIT s'appuyer que sur des briques logicielles libres dont la licence est compatible avec un usage commercial, et NE DOIT contourner aucune licence ou protection de logiciel payant.
- **FR-032**: Les projets existants de l'atelier DOIVENT s'ouvrir dans le nouveau module sans perte.

### Key Entities

- **Projet (étude)** : ensemble des niveaux, vues, calques, blocs et réglages d'un bâtiment ; nom, client, lieu, type, toiture, date et version.
- **Niveau** : étage du bâtiment avec sa hauteur et son altitude ; contient murs, ouvertures, pièces, entités de dessin, cotes et textes.
- **Calque** : nom, couleur, type et épaisseur de trait, visibilité, verrouillage ; chaque entité appartient à un calque.
- **Entité de dessin** : ligne, polyligne, arc, cercle, rectangle, hachure, texte ou cote, avec sa géométrie et son calque.
- **Bloc** : définition réutilisable (géométrie et paramètres) ; une **insertion de bloc** en est une occurrence placée, orientée et paramétrée.
- **Vue générée** : façade ou coupe calculée à partir des niveaux, liée à son orientation ou à sa ligne de coupe.
- **Planche** : mise en page d'une ou plusieurs vues à une échelle, sur un format, avec cartouche.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un concepteur habitué à un logiciel de DAO dessine le plan coté d'une maison de 4 pièces en moins de 30 minutes lors de sa première utilisation.
- **SC-002**: 100 % des longueurs saisies au clavier sont exactes au millimètre dans le dessin et dans les fichiers exportés.
- **SC-003**: Un fichier DXF exporté puis réimporté, ou ouvert dans un autre logiciel de DAO, conserve 100 % des calques, textes et cotes pris en charge.
- **SC-004**: Les dimensions mesurées sur une planche PDF imprimée à l'échelle s'écartent de moins de 0,5 % des cotes du plan.
- **SC-005**: Les quatre façades et une coupe d'une maison R+1 sont produites en moins de 2 minutes.
- **SC-006**: Le dessin reste fluide (pas de saccade perceptible au déplacement et au zoom) jusqu'à 20 000 entités sur un ordinateur portable courant.
- **SC-007**: Après une fermeture accidentelle, au plus 30 secondes de travail sont perdues.
- **SC-008**: Le coût logiciel pour le bureau et ses collègues reste nul : aucune licence payante n'est nécessaire.
- **SC-009**: 9 utilisateurs sur 10 d'un groupe de test de collègues jugent les planches produites présentables à un client ou à une administration.

## Assumptions

- Les utilisateurs sont le concepteur et ses collègues ingénieurs et architectes ; l'accès à l'atelier reste protégé par le code de poste existant.
- Le module enrichit l'atelier existant (plan 2D, 3D, métré, exports, agents IA) au lieu de le remplacer ; les études déjà créées restent compatibles.
- Le travail est mono-utilisateur par appareil ; la collaboration en temps réel n'est pas incluse dans cette version.
- L'interopérabilité avec AutoCAD repose sur le DXF (format documenté par son éditeur) ; le DWG n'est proposé que si une brique libre compatible avec un usage commercial le permet.
- L'IFC exporté vise l'échange BIM de base (géométrie et types d'éléments), pas un modèle d'exécution complet (armatures, réseaux détaillés).
- La modélisation 3D libre de formes complexes et le rendu photoréaliste ne font pas partie de ce module : la 3D reste générée à partir des plans, et les rendus continuent d'être produits à part.
- Les navigateurs visés sont les versions récentes de Chrome, Edge, Firefox et Safari, sur ordinateur et tablette.
- Les blocs de la bibliothèque sont dessinés pour le projet ou proviennent de sources dont la licence permet l'usage commercial.
