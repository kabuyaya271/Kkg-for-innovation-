# Kkg-for-innovation — Agent IA qui pilote vos appareils

Vous lui dites (à l'écrit ou à la voix) ce que vous voulez, il comprend et agit sur vos appareils :

```
Vous : allume la lampe du salon à 40% et baisse le chauffage à 19
  → sim:lampe_salon : regler_luminosite {'luminosite': 40}
  → sim:chauffage : regler_temperature {'temperature': 19}
🤖 C'est fait : lampe du salon à 40 % et thermostat réglé sur 19 °C.

Vous : mode cinéma
  → sim:volet_salon : fermer
  → sim:lampe_salon : regler_luminosite {'luminosite': 10}
  → sim:tv_salon : allumer
🤖 Volets fermés, lumière tamisée et TV allumée. Bon film !
```

L'agent utilise Claude (Anthropic) pour comprendre la demande et choisir les actions. Il garde le fil
de la conversation (« et dans la chambre aussi ? » fonctionne).

## Ce qu'il peut piloter

| Groupe | Identifiants | Comment |
|---|---|---|
| **Maison connectée réelle** | `ha:light.salon`, `ha:climate.salon`... | Via [Home Assistant](https://www.home-assistant.io), qui gère déjà Philips Hue, Tuya/Smart Life, Xiaomi, Sonos, Chromecast, TV Samsung/LG, Zigbee, Matter, etc. |
| **Cet ordinateur** | `pc:ordinateur` | Ouvrir un site ou une application, régler/couper le volume, verrouiller, veille, éteindre, commande shell (Windows, macOS, Linux). |
| **Appareils simulés** | `sim:lampe_salon`... | Pour essayer sans matériel. Liste et état dans `devices.json` (créé au premier lancement, modifiable). |

Pour des raisons de sécurité, **éteindre/redémarrer/mettre en veille l'ordinateur, exécuter une commande et
déverrouiller une porte demandent toujours votre confirmation** (o/N).

## Installation

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."     # clé sur https://console.anthropic.com
```

### Brancher vos vrais appareils (Home Assistant)

1. Installez Home Assistant et ajoutez-y vos appareils (intégrations).
2. Dans Home Assistant : *Profil → Sécurité → Jetons d'accès longue durée → Créer*.
3. ```bash
   export HA_URL="http://homeassistant.local:8123"
   export HA_TOKEN="le-jeton-copié"
   ```

L'agent découvre alors automatiquement vos lumières, prises, volets, thermostats, lecteurs multimédia,
serrures, aspirateurs, scènes et scripts.

## Utilisation

```bash
python -m agent_appareils                       # conversation au clavier
python -m agent_appareils --voix                # parler au micro (pip install SpeechRecognition pyaudio)
python -m agent_appareils "éteins tout"         # une seule commande (pratique pour un raccourci)
python -m agent_appareils --sans-simulation     # seulement les vrais appareils
python -m agent_appareils --sans-pc             # ne pas piloter l'ordinateur
```

Pendant la conversation : `aide`, `oublie` (efface la mémoire), `quitter`.

Réglages facultatifs : `AGENT_MODEL` (défaut `claude-opus-5-5`), `AGENT_EFFORT` (défaut `low` pour des
réponses rapides ; `medium`/`high` pour des demandes complexes), `SIM_DEVICES_FILE`.

## Ajouter un autre type d'appareil

Créez une classe dans `agent_appareils/backends/` qui hérite de `Backend` (méthodes `list_devices` et
`control`), puis ajoutez-la dans `build_backends()` de `agent_appareils/__main__.py`. L'agent l'utilisera
sans autre modification.

## Tests

```bash
pip install pytest && python -m pytest tests
```
