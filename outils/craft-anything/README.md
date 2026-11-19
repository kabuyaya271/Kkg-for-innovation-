# Craft Anything branché sur Claude Code

**Craft Anything** (storytold/craft-anything, licences Apache-2.0 / MIT) : comprendre comment fonctionne un logiciel ou un
site, puis construire **votre propre** version. 320 outils (sites web, applications, Electron/JavaScript, .NET, Android…),
exposés à Claude Code comme serveur MCP.

Le projet est déjà configuré : `.mcp.json` déclare le serveur `craft-anything` (commande `craft-anything-cli mcp`) et
`.claude/settings.json` l'active. Il suffit d'installer le programme sur votre ordinateur.

## 1. Installer (version vérifiée : 0.6.1)

Téléchargez depuis **github.com/storytold/craft-anything/releases** (dernière version) :

| Système | Fichier |
|---|---|
| Windows | `craft-anything-<version>-windows-x64.msi` (installeur signé) |
| macOS | `craft-anything-<version>-macos-universal.dmg` (application) et `craft-anything-cli-<version>-macos-universal.zip` (outil en ligne de commande) |
| Linux | `craft-anything-<version>-linux-x86_64.deb` ou `.tar.gz` |

Vérifiez l'empreinte avec le fichier `SHA256SUMS.txt` de la même page.
L'outil en ligne de commande `craft-anything-cli` doit être accessible dans le PATH.

Contrôle : `craft-anything-cli doctor` (vérifie l'installation, Claude Code et les moteurs).

## 2. Vérifier dans Claude Code

Ouvrez Claude Code dans ce dossier de projet, approuvez le serveur `craft-anything` si on vous le demande,
puis tapez `/mcp` : `craft-anything` doit apparaître comme connecté.

Branchement manuel (autre dossier) : `claude mcp add craft-anything -- craft-anything-cli mcp`

## 3. Utiliser

Exemples de demandes à Claude Code :
- « Avec craft-anything, étudie la page d'accueil de mon site et propose une version plus rapide. »
- « Avec craft-anything, regarde comment ce configurateur 3D en ligne présente les maisons, et construis une page équivalente pour mon catalogue. »

## Règles d'usage

- Mode **Salle blanche** (par défaut) : rien à l'intérieur du logiciel d'origine n'est lu, seulement ce qu'un visiteur voit.
  C'est le mode à garder pour s'inspirer de logiciels ou de sites de tiers.
- Mode **Approfondi** (lecture du code et des fichiers) : seulement pour vos propres logiciels ou ceux que vous êtes autorisé à analyser.
- Jamais pour contourner une licence, une protection ou un paiement (ex. AutoCAD) ni pour copier le code ou les éléments protégés d'un tiers.
