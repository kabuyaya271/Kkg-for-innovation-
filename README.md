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
| **Ordinateur** (Windows, macOS, Linux) | ouvrir un site ou une appli, volume, muet, verrouiller, veille, éteindre, redémarrer, commande shell |
| **Maison connectée** (facultatif, via Home Assistant) | lumières, prises, volets, chauffage, enceintes, serrures... |

Pour votre sécurité, **appeler, envoyer un SMS, éteindre/redémarrer le téléphone ou l'ordinateur et exécuter
une commande demandent toujours votre confirmation** (o/N).

> **iPhone :** Apple n'autorise pas un programme extérieur à piloter un iPhone ; seul Android est pris en charge.

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
| `"lg"` | `pip install pywebostv`. Au premier ordre, acceptez la demande sur la TV. Pour l'allumer : activez *Allumer via Wi-Fi*. |
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
python -m agent_appareils --voix                # parler au micro (pip install SpeechRecognition pyaudio)
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
