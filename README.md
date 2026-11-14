# Kkg-for-innovation — Agent IA qui pilote vos appareils

Vous lui dites (à l'écrit ou à la voix) ce que vous voulez, il comprend et agit sur **votre téléphone,
votre ordinateur et votre Smart TV** :

```
Vous : mets Netflix sur la télé et baisse un peu le son
  → tv : ouvrir_application {'application': 'Netflix'}
  → tv : volume_bas {'fois': 3}
🤖 Netflix est lancé sur la TV du salon et le volume a été baissé.

Vous : appelle le 06 12 34 56 78 depuis mon téléphone
  ⚠️  Mon téléphone : appeler 0612345678 — confirmer ? (o/N) o
  → telephone : appeler {'numero': '0612345678'}
🤖 Appel lancé.

Vous : ouvre YouTube sur l'ordi et mets le volume à 30
  → pc:ordinateur : ouvrir_url {'url': 'https://www.youtube.com'}
  → pc:ordinateur : regler_volume {'volume': 30}
🤖 YouTube est ouvert et le volume de l'ordinateur est à 30 %.
```

L'agent utilise Claude (Anthropic) pour comprendre la demande et choisir les actions. Il garde le fil
de la conversation (« et sur la télé aussi ? » fonctionne).

## Ce qu'il sait faire

| Appareil | Actions |
|---|---|
| **Téléphone Android** | ouvrir une appli (WhatsApp, YouTube...) ou un lien, volume, musique (lecture/pause/suivant), appeler / raccrocher, préparer un SMS, photo, capture d'écran, luminosité, Wi-Fi, Bluetooth, Ne pas déranger, verrouiller, batterie, éteindre/redémarrer |
| **Smart TV** Samsung, LG, Roku, Android TV / Google TV (Sony, Philips, TCL, Xiaomi, Hisense...) | allumer/éteindre, volume, muet, chaînes (+/−/numéro), source HDMI, ouvrir Netflix/YouTube/..., navigation (haut/bas/ok/retour/accueil), lecture/pause ; LG : volume précis et message à l'écran |
| **iPhone** | télécommande vocale via Siri ; recevoir une notification ; sonner pour le retrouver |
| **Ordinateur** (Windows, macOS, Linux) | ouvrir un site ou une appli, volume, muet, verrouiller, veille, éteindre, redémarrer, commande shell |
| **Maison connectée** (facultatif, via Home Assistant) | lumières, prises, volets, chauffage, enceintes, serrures... |

Pour votre sécurité, **appeler, envoyer un SMS, éteindre/redémarrer le téléphone ou l'ordinateur et exécuter
une commande demandent toujours votre confirmation** (o/N).

> ## 📱 Piloter votre iPhone lui-même
> Un agent tourne **directement dans l'iPhone** (app Raccourcis) : « Dis Siri, Agent » → *« son à 30, lampe
> torche et écris à Maman que j'arrive »*. Il ouvre des apps, appelle, prépare des messages, règle volume,
> luminosité, Wi-Fi, Bluetooth, minuteur, alarme, rappels, musique... **sans ordinateur.**
> 👉 **[Guide pas à pas : GUIDE_IPHONE.md](GUIDE_IPHONE.md)**
>
> L'iPhone peut aussi servir de **télécommande vocale pour la TV et l'ordinateur** et recevoir des
> notifications de l'agent : voir le guide rapide ci-dessous.

## 🚀 Guide rapide : iPhone + TV LG

Le principe : l'agent tourne sur votre **ordinateur** (allumé, sur le même Wi-Fi que la TV et l'iPhone).
Vous parlez à **Siri** sur l'iPhone, Siri transmet la phrase à l'agent, l'agent pilote la **TV LG** ou
l'ordinateur, et Siri vous lit la réponse.

### Étape 1 — Sur l'ordinateur

1. Installez Python 3.10 ou plus récent : https://www.python.org/downloads/ (sous Windows, cochez « Add Python to PATH »).
2. Téléchargez ce projet (bouton vert **Code → Download ZIP** sur GitHub), décompressez-le, ouvrez un terminal
   dans le dossier, puis :
   ```bash
   pip install -r requirements.txt
   ```
3. Créez une clé API Claude sur https://console.anthropic.com et enregistrez-la :
   - Windows : `setx ANTHROPIC_API_KEY "sk-ant-..."` (puis fermez et rouvrez le terminal)
   - Mac / Linux : `export ANTHROPIC_API_KEY="sk-ant-..."`
4. Copiez `config.example.json` en `config.json`.

### Étape 2 — La TV LG

1. Sur la TV : *Paramètres → Tous les paramètres → Réseau* → notez l'**adresse IP** (ex. `192.168.1.30`).
2. Dans *Réseau → Wi-Fi / Paramètres avancés*, notez l'**adresse MAC** (pour pouvoir allumer la TV à distance).
3. Activez *Général → Appareils → Paramètres TV → **Allumer via Wi-Fi*** (ou « Mobile TV On » / « Allumer via le réseau »).
4. Mettez l'IP et la MAC dans `config.json` (section `"tv"`).
5. Testez depuis l'ordinateur : `python -m agent_appareils "mets le volume de la télé à 15"`
   — **la première fois, la TV affiche une demande de connexion : acceptez-la avec la télécommande.**

### Étape 3 — Les notifications sur l'iPhone (facultatif)

1. Installez l'application gratuite **ntfy** depuis l'App Store.
2. Appuyez sur **+** et abonnez-vous à un sujet au nom long et secret, ex. `maison-kkg-7f3a9c2e`.
3. Mettez ce nom dans `config.json` (`"sujet_ntfy"`).

L'agent peut alors vous envoyer un message (« préviens-moi sur mon iPhone dans le résumé ») ou le faire
sonner (« fais sonner mon iPhone »). Pour qu'il sonne même en silencieux, autorisez les *alertes critiques*
de ntfy dans *Réglages → Notifications → ntfy*.

### Étape 4 — Parler à Siri

1. Sur l'ordinateur, lancez l'agent en mode serveur :
   ```bash
   python -m agent_appareils --serveur
   ```
   Il affiche son **adresse** (ex. `http://192.168.1.10:8765/commande`) et une **clé** : notez-les.
2. Sur l'iPhone, ouvrez l'app **Raccourcis** → **+** (nouveau raccourci) → ajoutez ces 4 actions dans l'ordre :
   1. **Dicter le texte** — Langue : Français.
   2. **Obtenir le contenu de l'URL** — URL : l'adresse notée. Touchez **Afficher plus** :
      - Méthode : **POST**
      - En-têtes : ajoutez `Authorization` = `Bearer VOTRE-CLÉ`
      - Corps de la requête : **JSON** → ajoutez un champ Texte nommé `texte` avec la valeur **Texte dicté**
   3. **Obtenir la valeur du dictionnaire** — Obtenir **Valeur** pour la clé `reponse` dans **Contenu de l'URL**.
   4. **Énoncer le texte** — **Valeur du dictionnaire**.
3. Nommez le raccourci **Maison**. À la première utilisation, autorisez l'accès au **réseau local**.
4. Dites : **« Dis Siri, Maison »**, puis votre demande : *« allume la télé et mets YouTube »*.

Vous pouvez aussi ajouter le raccourci sur l'écran d'accueil ou au bouton Action de l'iPhone.

**Sécurité en mode Siri :** personne n'est devant l'ordinateur pour confirmer, donc les actions sensibles
(éteindre l'ordinateur, commandes shell...) sont **refusées** à distance. Pour les autoriser quand même,
mettez `"autoriser_actions_sensibles": true` dans la section `"serveur"` de `config.json`.
L'iPhone doit être sur le **même Wi-Fi** que l'ordinateur.

## Installation

Sur l'ordinateur qui fera tourner l'agent (il doit être sur le **même Wi-Fi** que le téléphone et la TV) :

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."     # clé sur https://console.anthropic.com
cp config.example.json config.json        # puis modifiez config.json (voir ci-dessous)
```

### 1. Votre téléphone Android

1. Installez **Android platform-tools** sur l'ordinateur (contient la commande `adb`) :
   https://developer.android.com/tools/releases/platform-tools
2. Sur le téléphone : *Paramètres → À propos du téléphone →* appuyez **7 fois sur « Numéro de build »*,
   puis dans *Options pour les développeurs* activez **Débogage USB** et **Débogage sans fil**.
3. Branchez le téléphone en USB une première fois, acceptez l'autorisation, puis passez en Wi-Fi :
   ```bash
   adb tcpip 5555
   ```
   Trouvez l'adresse IP du téléphone (*Paramètres → À propos → État → Adresse IP*) et mettez-la dans
   `config.json` : `"adresse": "192.168.1.20:5555"`. (En USB uniquement, laissez `"adresse": ""`.)

### 2. Votre Smart TV

Trouvez l'adresse IP de la TV (*Paramètres → Réseau → État*) et, pour pouvoir l'**allumer**, son adresse MAC.

| Marque dans `config.json` | À faire |
|---|---|
| `"samsung"` | `pip install samsungtvws`. Au premier ordre, acceptez la demande sur l'écran de la TV. Pour l'allumer : activez *Général → Réseau → Allumer avec mobile*. |
| `"lg"` | Déjà inclus dans `requirements.txt`. Au premier ordre, acceptez la demande sur la TV. Pour l'allumer : activez *Allumer via Wi-Fi*. |
| `"roku"` | Rien à installer. Activez *Paramètres → Système → Paramètres système avancés → Contrôle par applications mobiles*. |
| `"android"` (Android TV / Google TV) | Même principe que le téléphone : activez *Débogage ADB* dans les options pour les développeurs de la TV, adresse `"IP:5555"`. |

### 3. Le fichier `config.json`

```json
{
  "appareils": [
    { "id": "telephone", "nom": "Mon téléphone", "type": "android", "adresse": "192.168.1.20:5555" },
    { "id": "tv", "nom": "TV du salon", "type": "tv", "marque": "samsung",
      "adresse": "192.168.1.30", "mac": "AA:BB:CC:DD:EE:FF" }
  ]
}
```

Vous pouvez déclarer plusieurs téléphones ou TV (ids différents). L'ordinateur est ajouté automatiquement.

Maison connectée (facultatif) : ajoutez `"home_assistant": {"url": "http://homeassistant.local:8123", "token": "..."}`
(jeton : *Profil → Sécurité → Jetons d'accès longue durée* dans Home Assistant).

## Utilisation

```bash
python -m agent_appareils                       # conversation au clavier
python -m agent_appareils --serveur             # recevoir les ordres de l'iPhone / Siri
python -m agent_appareils --voix                # parler au micro de l'ordinateur (pip install SpeechRecognition pyaudio)
python -m agent_appareils "éteins la télé"      # une seule commande (pratique pour un raccourci)
python -m agent_appareils --sans-pc             # ne pas piloter l'ordinateur
python -m agent_appareils --simulation          # ajouter des appareils fictifs pour essayer
```

Pendant la conversation : `aide` (liste vos appareils), `oublie` (efface la mémoire), `quitter`.
Sans `config.json`, l'agent démarre avec des appareils simulés pour que vous puissiez l'essayer.

Réglages facultatifs : `AGENT_MODEL` (défaut `claude-opus-5-5`), `AGENT_EFFORT` (défaut `low` pour des
réponses rapides ; `medium`/`high` pour des demandes complexes), `AGENT_CONFIG`.

## Ajouter un autre type d'appareil

Créez une classe dans `agent_appareils/backends/` qui hérite de `Backend` ou `SingleDeviceBackend`
(méthodes `list_devices` et `control`), puis ajoutez-la dans `backend_from_config()` de
`agent_appareils/__main__.py`. L'agent l'utilisera sans autre modification.

## Tests

```bash
pip install pytest && python -m pytest tests
```
