# OmniRoute — ne plus dépendre d'une seule IA

OmniRoute est un « aiguillage » gratuit (licence MIT) qui tourne sur **votre ordinateur**.
Vos outils (Claude Code, OpenCode, Cursor…) parlent à une seule adresse, `http://localhost:20128/v1`,
et OmniRoute choisit l'IA disponible : si l'une est en panne ou à sa limite, il passe à la suivante.

Version vérifiée : **omniroute 3.8.54** (npm).

## 1. Installer (une seule fois)

1. Installez **Node.js LTS** depuis nodejs.org (bouton « LTS »), puis redémarrez l'ordinateur.
2. Lancez le script :
   - **Windows** : double-cliquez sur `installer-windows.bat`.
   - **Mac / Linux** : ouvrez un terminal dans ce dossier et tapez `sh installer-mac-linux.sh`.
3. Le tableau de bord s'ouvre dans le navigateur : **http://localhost:20128**. Choisissez un mot de passe administrateur.

Sans script : `npm install -g omniroute@3.8.54` puis `omniroute`.

## 2. Brancher des IA gratuites (avec VOS comptes officiels)

Dans le tableau de bord → **Providers**, ajoutez les clés gratuites que vous créez vous-même :

| Fournisseur | Où obtenir la clé gratuite | Remarque |
|---|---|---|
| Google Gemini | aistudio.google.com → « Get API key » | Quota gratuit quotidien généreux |
| Groq | console.groq.com → API Keys | Très rapide, modèles ouverts |
| OpenRouter | openrouter.ai → Keys | Choisir les modèles marqués `:free` |
| Cerebras | cloud.cerebras.ai → API Keys | Gratuit avec limites |
| Mistral | console.mistral.ai → API Keys | Offre « Experiment » gratuite |

Ajoutez aussi, si vous voulez, une clé payante (Anthropic, OpenAI…) en **dernier recours**.
Puis créez une **API Key OmniRoute** (menu API Keys) et un **Combo** avec l'ordre de secours souhaité
(ex. Gemini → Groq → OpenRouter free → Claude).

## 3. Utiliser vos outils à travers OmniRoute

- **Claude Code** : `omniroute launch` (lance Claude Code relié à OmniRoute).
- **OpenCode** : `omniroute setup-opencode` (ajoute OmniRoute comme fournisseur dans OpenCode).
- **Tout autre outil compatible OpenAI** : adresse `http://localhost:20128/v1`, clé = votre API Key OmniRoute, modèle `auto`.
- **Tester** : `omniroute chat "Bonjour, qui es-tu ?"` · **Diagnostiquer** : `omniroute doctor`.

## 4. Démarrage automatique (facultatif)

`omniroute autostart` (Linux) ou laissez l'icône de la barre des tâches active (`omniroute tray`).

## Règles de prudence

- Utilisez uniquement des **clés API officielles** et des **offres gratuites officielles** des fournisseurs.
  N'utilisez pas les options qui réutilisent des abonnements d'autres applications (connexions « OAuth » à des
  outils de code tiers, modes « stealth ») : c'est souvent interdit par leurs conditions d'utilisation et peut
  entraîner la fermeture de vos comptes.
- Vos clés restent sur votre ordinateur (dossier de données d'OmniRoute). Ne les collez jamais dans une conversation,
  un e-mail ou ce dépôt GitHub.
- Les offres gratuites ont des limites et peuvent changer : OmniRoute passe simplement à la suivante.
