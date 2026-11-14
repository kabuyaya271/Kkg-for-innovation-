# 📱 Agent iPhone — piloter votre iPhone en lui parlant

Vous dites : **« Dis Siri, Agent »** → *« mets le son à 30, allume la lampe torche et envoie à Maman : j'arrive dans 10 minutes »*.
L'iPhone comprend grâce à Claude, **exécute les actions lui-même** et vous répond à voix haute.

Tout se passe **dans l'iPhone**, avec l'application **Raccourcis** (Shortcuts) d'Apple, déjà installée.
Pas besoin d'ordinateur ; ça marche en Wi-Fi comme en 4G/5G.

## Ce que l'agent peut faire sur l'iPhone

| Vous dites... | L'iPhone fait |
|---|---|
| « ouvre WhatsApp », « mets Aya Nakamura sur Spotify », « itinéraire vers la gare » | ouvre l'app / le lien / la navigation |
| « appelle Papa », « appelle le 06 12 34 56 78 » | appelle (après votre confirmation) |
| « écris à Sarah que je suis en retard » | prépare le message, vous appuyez sur Envoyer |
| « son à 30 », « luminosité au maximum » | règle le volume / la luminosité |
| « allume la lampe torche » | lampe torche |
| « coupe le Wi-Fi », « active le Bluetooth », « ne pas déranger » | réglages |
| « minuteur 10 minutes », « réveille-moi à 6 h 30 » | minuteur, alarme |
| « rappelle-moi d'acheter du pain » | rappel |
| « musique suivante », « pause » | contrôle de la musique |
| « prends une photo », « combien de batterie ? » | photo, niveau de batterie |

**Ce qui reste impossible** (Apple ne le permet à aucune app) : appuyer sur des boutons *à l'intérieur*
d'une autre application, lire vos messages ou notifications, déverrouiller le téléphone.

## Avant de commencer (5 minutes)

1. **Une clé API Claude** : sur https://console.anthropic.com → *API Keys* → *Create Key*. Copiez-la
   (elle commence par `sk-ant-`). L'utilisation est payante, à l'usage : chaque ordre coûte une fraction de centime.
   ⚠️ La clé sera enregistrée dans le raccourci : **ne partagez jamais ce raccourci**.
2. **Choisissez votre version** :
   - [`iphone/requete_essentielle.json`](iphone/requete_essentielle.json) : 7 actions (ouvrir, appeler, message,
     volume, luminosité, lampe, minuteur) — **recommandé pour commencer**, moins d'étapes.
   - [`iphone/requete_complete.json`](iphone/requete_complete.json) : les 15 actions.
3. Ouvrez ce fichier **sur l'iPhone** (dans Safari, sur GitHub, bouton *Raw*), et gardez-le sous la main
   pour le copier-coller.

Dans Raccourcis, on ajoute une action avec la barre **« Rechercher des actions »** en bas, en tapant son nom.
Pour insérer une *variable* (ex. « Texte dicté ») dans un champ, touchez le champ puis choisissez-la
dans la barre au-dessus du clavier, ou touchez **Sélectionner une variable**.

## Étape 1 — Écouter et demander à Claude

Ouvrez **Raccourcis** → **+** → nommez le raccourci **Agent**. Ajoutez, dans l'ordre :

1. **Dicter le texte** — Langue : *Français (France)*, Arrêter l'écoute : *Après une pause*.
   *(Pour écrire au lieu de parler : utilisez plutôt « Demander une entrée », type Texte.)*
2. **Remplacer le texte** — Remplacer `"` par `'` dans **Texte dicté**.
   *(Évite qu'un guillemet casse la requête.)*
3. **Texte** — collez **tout** le contenu du fichier `requete_….json`. Dans le texte collé, trouvez
   `TEXTE_DICTE`, effacez ce mot (en gardant les guillemets autour) et insérez à la place la variable
   **Texte modifié** (résultat de l'étape 2).
4. **Obtenir le contenu de l'URL**
   - URL : `https://api.anthropic.com/v1/messages`
   - Touchez **Afficher plus** :
     - Méthode : **POST**
     - En-têtes (4) :
       | Clé | Texte |
       |---|---|
       | `x-api-key` | votre clé `sk-ant-...` |
       | `anthropic-version` | `2026-10-21` |
       | `anthropic-beta` | `server-side-fallback-2026-07-01` |
       | `content-type` | `application/json` |
     - Corps de la requête : **Fichier** → Fichier : la variable **Texte** (étape 3).
5. **Obtenir la valeur du dictionnaire** — Obtenir **Valeur** pour `error` dans **Contenu de l'URL**.
6. **Si** — *Valeur du dictionnaire* **a une valeur** :
   - **Énoncer le texte** : `Erreur de l'agent : ` + *Valeur du dictionnaire*
   - **Arrêter ce raccourci**
   - **Fin du si** *(supprimez le « Sinon » s'il apparaît)*

## Étape 2 — Lire le plan renvoyé par Claude

7. **Obtenir la valeur du dictionnaire** — Valeur pour `content` dans **Contenu de l'URL**.
8. **Répéter avec chaque élément** dans *Valeur du dictionnaire* :
   - **Obtenir la valeur du dictionnaire** — Valeur pour `type` dans **Élément de répétition**
   - **Si** *Valeur du dictionnaire* **est** `text` :
     - **Obtenir la valeur du dictionnaire** — Valeur pour `text` dans **Élément de répétition**
     - **Définir une variable** — nom `Plan`, valeur : *Valeur du dictionnaire*
   - **Fin du si**
   - **Fin de la répétition**
9. **Obtenir le dictionnaire à partir de l'entrée** — Entrée : **Plan**.
10. **Définir une variable** — nom `Resultat`, valeur : *Dictionnaire*.

## Étape 3 — Exécuter les actions

11. **Obtenir la valeur du dictionnaire** — Valeur pour `actions` dans **Resultat**.
12. **Répéter avec chaque élément** dans *Valeur du dictionnaire*. **À l'intérieur** de la répétition :
    - 4 fois **Obtenir la valeur du dictionnaire** sur **Élément de répétition**, chacune suivie de
      **Définir une variable** :
      `type` → variable **Type** · `valeur` → **Valeur** · `destinataire` → **Destinataire** · `texte` → **Message**
    - Puis un bloc **Si … Fin du si** par action, les uns **après** les autres (pas imbriqués) :

| Si **Type** est… | Actions à mettre dans le bloc |
|---|---|
| `ouvrir` | **Ouvrir les URL** : *Valeur* |
| `appeler` | **Afficher l'alerte** « Appeler *Destinataire* ? » (avec bouton Annuler) → **Rechercher des contacts** (Nom *contient* *Destinataire*, Limite 1) → **Si** *Contacts* a une valeur : **Appeler** *Contacts* · **Sinon** : **Ouvrir les URL** `tel:`*Destinataire* · **Fin du si** |
| `message` | **Rechercher des contacts** (Nom *contient* *Destinataire*, Limite 1) → **Si** *Contacts* a une valeur : **Envoyer un message** *Message* à *Contacts* · **Sinon** : **Envoyer un message** *Message* à *Destinataire* · **Fin du si**. Laissez **Afficher lors de l'exécution** activé : vous relisez avant d'envoyer. |
| `volume` | **Calculer** *Valeur* ÷ 100 → **Régler le volume** à *Résultat du calcul* |
| `luminosite` | **Calculer** *Valeur* ÷ 100 → **Régler la luminosité** à *Résultat du calcul* |
| `lampe` | **Si** *Valeur* est `on` : **Régler la lampe de poche** sur *Activée* · **Sinon** : *Désactivée* · **Fin du si** |
| `minuteur` | **Lancer le minuteur** : *Valeur* minutes |
| `wifi` | même principe que `lampe`, avec **Régler le Wi-Fi** |
| `bluetooth` | même principe, avec **Régler le Bluetooth** |
| `concentration` | même principe, avec **Définir le mode de concentration** *Ne pas déranger* (Activer / Désactiver) |
| `alarme` | **Créer une alarme** (app Horloge) à l'heure *Valeur*, libellé *Message* |
| `rappel` | **Ajouter un nouveau rappel** : *Message* |
| `musique` | **Si** *Valeur* est `suivant` : **Passer au morceau suivant** · **Sinon si** `precedent` : **Revenir au morceau précédent** · **Sinon** : **Lire/Mettre en pause** |
| `photo` | **Prendre une photo** → **Enregistrer dans l'album photo** |
| `batterie` | **Obtenir le niveau de la batterie** → **Énoncer le texte** « Batterie à *Niveau de batterie* pour cent » |

Avec la version **essentielle**, seules les 7 premières lignes du tableau sont nécessaires.
Terminez par **Fin de la répétition** (après le dernier bloc Si).

## Étape 4 — La réponse

13. **Obtenir la valeur du dictionnaire** — Valeur pour `reponse` dans **Resultat**.
14. **Énoncer le texte** — *Valeur du dictionnaire*.

Touchez **▶︎** pour essayer. À la première utilisation, iOS demande des autorisations
(micro, contacts, connexion à api.anthropic.com...) : acceptez.

## Le lancer facilement

- **Siri** : « Dis Siri, **Agent** ».
- **Bouton Action** (iPhone 15 Pro et plus récents) : *Réglages → Bouton Action → Raccourci → Agent*.
- **Toucher le dos** : *Réglages → Accessibilité → Toucher → Toucher le dos → Toucher deux fois → Agent*.
- **Écran d'accueil** : dans Raccourcis, appui long sur *Agent* → *Partager → Sur l'écran d'accueil*.

## En cas de problème

| Symptôme | Solution |
|---|---|
| « Erreur de l'agent : … authentication » | La clé `x-api-key` est fausse ou mal copiée. |
| « … credit balance » | Ajoutez du crédit sur console.anthropic.com (*Billing*). |
| « … invalid JSON » / « invalid request » | Le texte de l'étape 3 a été abîmé : recollez-le et remettez la variable à la place de `TEXTE_DICTE`. |
| Le volume ou la luminosité va toujours au maximum | Vérifiez le **Calculer ÷ 100** juste avant. |
| Rien ne se passe pour une action | Vérifiez l'orthographe du mot dans le bloc **Si** (ex. `luminosite` sans accent). |

## Pour les curieux

La requête envoyée par l'iPhone est générée par [`agent_appareils/iphone_agent.py`](agent_appareils/iphone_agent.py).
Depuis un ordinateur, vous pouvez essayer le « cerveau » sans iPhone :

```bash
python -m agent_appareils.iphone_agent "mets le son à 30 et allume la lampe"
```

Pour ajouter une action : ajoutez-la dans `ACTIONS` de ce fichier, lancez
`python -m agent_appareils.iphone_agent --generer`, recopiez le nouveau fichier dans l'étape 3 du raccourci
et ajoutez le bloc **Si** correspondant.
