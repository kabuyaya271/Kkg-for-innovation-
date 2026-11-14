# KKG Innovation — Boutique de plans de construction en 3D

Site web pour vendre des plans de construction : chaque projet se visite en **3D interactive**, possède une **fiche technique complète**, et peut être **acheté en ligne** (carte bancaire, Mobile Money, virement, WhatsApp).

Site 100 % statique (HTML / CSS / JavaScript + [Three.js](https://threejs.org)) : aucun serveur ni base de données à gérer, hébergement gratuit possible sur GitHub Pages ou Netlify.

## Pages

| Page | Rôle |
|---|---|
| `index.html` | Accueil : projet à la une en 3D, catalogue filtrable, licences, contact |
| `projet.html?id=…` | Fiche projet : visite 3D (rotation, nuit, vue éclatée par niveau, vue de dessus, filaire, plein écran, capture), prix par licence, caractéristiques, tableau des surfaces, contenu du dossier, FAQ |
| `panier.html` | Panier, coordonnées du client, choix du paiement, instructions de paiement |
| `admin.html` | **Espace concepteur** : ajouter / modifier / supprimer des projets avec aperçu 3D en direct, images, commandes, publication |

## Démarrer en local

Les navigateurs bloquent les modules JavaScript ouverts en `file://`, il faut donc un petit serveur :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mettre en ligne (GitHub Pages, gratuit)

1. Sur GitHub : **Settings → Pages → Source : Deploy from a branch**, choisir la branche et le dossier `/ (root)`.
2. Le site est disponible à `https://<votre-compte>.github.io/<nom-du-dépôt>/`.

## Personnaliser — `js/config.js`

- Nom, e-mail, téléphone, adresse
- Devise (`USD`, `EUR`, `CDF`, `XAF`…)
- **Licences** et leur multiplicateur de prix (Essentiel ×1, Pack complet ×1,6, Exclusivité ×4)
- **Paiements** :
  - `stripeLienGeneral` : un [lien de paiement Stripe](https://dashboard.stripe.com/payment-links). Chaque projet peut aussi avoir son propre lien (champ « Lien de paiement Stripe » dans l'espace concepteur) ;
  - `mobileMoney` : vos numéros M-Pesa / Orange Money / Airtel Money ;
  - `banque` : vos coordonnées de virement ;
  - `whatsapp` : votre numéro pour les commandes et questions.
  Laissez un champ vide pour désactiver la méthode.
- `formspree` : créez un formulaire gratuit sur [formspree.io](https://formspree.io) et collez son adresse pour **recevoir chaque commande et chaque demande de contact par e-mail**.
- `adminMotDePasse` : mot de passe de l'espace concepteur (à changer !).

## Ajouter un projet

1. Ouvrez `admin.html`, connectez-vous.
2. **+ Nouveau projet** : titre, prix, description, surfaces, pièces, contenu du dossier…
3. **Maquette 3D** — deux options :
   - réglez les paramètres (type, niveaux, dimensions, toiture, couleurs, piscine, garage…) : la maquette est générée automatiquement et l'aperçu se met à jour en direct ;
   - **ou** utilisez votre vrai modèle : exportez-le en **.glb** depuis SketchUp, Revit, ArchiCAD, Blender…, placez-le dans `modeles/` et indiquez son chemin (ex. `modeles/villa-horizon.glb`). Nommez les objets `niveau-0`, `niveau-1`… pour que la vue éclatée fonctionne.
4. Ajoutez photos, rendus et plans 2D (ou capturez la vue 3D avec 📷).
5. **Enregistrer**, puis onglet **Publier en ligne → Télécharger projets.json** et remplacez `data/projets.json` dans le dépôt.

> Les modifications faites dans l'espace concepteur sont d'abord enregistrées dans votre navigateur : elles ne sont visibles par les visiteurs qu'après avoir remplacé `data/projets.json`.

## Processus de vente

1. Le client choisit un projet et une licence, puis valide son panier avec ses coordonnées.
2. Une référence de commande est générée (ex. `KKG-20261114-A1B2`) ; vous la recevez par e-mail si Formspree est configuré.
3. Le client paie (redirection Stripe, ou instructions Mobile Money / virement / WhatsApp avec la référence).
4. Vous vérifiez le paiement et envoyez les fichiers par e-mail (lien Google Drive, WeTransfer…).

## Sécurité — à savoir

- Le mot de passe de l'espace concepteur est vérifié dans le navigateur : il évite les modifications accidentelles mais ne protège pas réellement. Il ne donne de toute façon accès à aucune donnée sensible : les vraies données publiées sont dans le dépôt GitHub.
- **Ne déposez jamais les fichiers de plans vendus (PDF, DWG) dans ce dépôt public** : envoyez-les uniquement après paiement.
- Pour une livraison 100 % automatique après paiement, il faudra ajouter un service côté serveur (Stripe Checkout + webhooks, ou une plateforme comme Gumroad / Lemon Squeezy) — le site est prêt pour cette évolution.

## Structure

```
index.html  projet.html  panier.html  admin.html
css/style.css
js/config.js      ← configuration
js/store.js       ← projets, panier, commandes
js/builder3d.js   ← générateur de maquettes 3D
js/viewer.js      ← visionneuse 3D (Three.js)
js/ui.js, accueil.js, projet.js, panier.js, admin.js
data/projets.json ← catalogue des projets
modeles/          ← vos fichiers .glb
images/           ← vos images
```
