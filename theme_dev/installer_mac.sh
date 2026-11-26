#!/bin/bash
# Thème développeur pour macOS (Ventura, Sonoma, Sequoia et suivants) — sans mot de passe administrateur.
#
#   Installer :  bash installer_mac.sh
#   Annuler   :  bash installer_mac.sh --restaurer
#
# Ce que ça change (pour votre compte uniquement) :
#   - mode sombre
#   - horloge de la barre des menus : jour + date + heure 24 h avec secondes
#   - fond d'écran « code »
#   - horloge de bureau façon éditeur de code, lancée à chaque ouverture de session
# Au premier lancement, macOS peut demander d'autoriser le Terminal à contrôler « System Events » : acceptez.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/ThemeDev"
BACKUP="$DEST/sauvegarde.sh"
AGENT="$HOME/Library/LaunchAgents/fr.kkg.horloge-dev.plist"
CLOCK_KEYS=(ShowSeconds Show24Hour ShowDate ShowDayOfWeek)

restart_menubar() { killall ControlCenter 2>/dev/null || killall SystemUIServer 2>/dev/null || true; }

if [[ "${1:-}" == "--restaurer" ]]; then
  [[ -f "$BACKUP" ]] || { echo "Aucune sauvegarde trouvée : rien à restaurer."; exit 1; }
  # shellcheck disable=SC1090
  source "$BACKUP"
  launchctl unload "$AGENT" 2>/dev/null || true
  rm -f "$AGENT"
  restart_menubar
  echo "✓ Anciens réglages restaurés."
  exit 0
fi

mkdir -p "$DEST" "$HOME/Library/LaunchAgents"

# 1. Sauvegarde des réglages actuels (une seule fois)
if [[ ! -f "$BACKUP" ]]; then
  {
    dark=$(osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode')
    echo "osascript -e 'tell application \"System Events\" to tell appearance preferences to set dark mode to $dark'"
    for k in "${CLOCK_KEYS[@]}"; do
      if v=$(defaults read com.apple.menuextra.clock "$k" 2>/dev/null); then
        echo "defaults write com.apple.menuextra.clock $k -bool $([[ $v == 1 ]] && echo true || echo false)"
      else
        echo "defaults delete com.apple.menuextra.clock $k 2>/dev/null || true"
      fi
    done
    if old=$(osascript -e 'tell application "System Events" to get picture of current desktop' 2>/dev/null); then
      printf "osascript -e 'tell application \"System Events\" to tell every desktop to set picture to POSIX file \"%s\"'\n" "$old"
    fi
  } > "$BACKUP"
fi

# 2. Mode sombre
osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'
echo "✓ Mode sombre activé"

# 3. Horloge de la barre des menus : « jeu. 26 nov. 14:32:07 »
for k in "${CLOCK_KEYS[@]}"; do defaults write com.apple.menuextra.clock "$k" -bool true; done
defaults write com.apple.menuextra.clock IsAnalog -bool false
restart_menubar
echo "✓ Horloge de la barre des menus : date + 24 h avec secondes"

# 4. Fond d'écran (sur tous les écrans)
cp "$HERE/fond_ecran_dev.png" "$DEST/"
osascript -e "tell application \"System Events\" to tell every desktop to set picture to POSIX file \"$DEST/fond_ecran_dev.png\""
echo "✓ Fond d'écran installé"

# 5. Horloge de bureau (Python 3 avec tkinter ; le plus simple : python.org/downloads)
cp "$HERE/horloge_dev.py" "$DEST/"
PY="$(command -v python3 || true)"
if [[ -n "$PY" ]] && "$PY" -c "import tkinter" 2>/dev/null; then
  cat > "$AGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>fr.kkg.horloge-dev</string>
  <key>ProgramArguments</key><array><string>$PY</string><string>$DEST/horloge_dev.py</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
EOF
  launchctl unload "$AGENT" 2>/dev/null || true
  launchctl load "$AGENT"
  echo "✓ Horloge de bureau lancée (et à chaque ouverture de session). Clic droit dessus pour les options."
else
  echo "! Python 3 (avec tkinter) introuvable : installez-le depuis https://www.python.org/downloads/ puis relancez ce script."
fi

echo
echo "Terminé. Pour tout annuler :  bash \"$HERE/installer_mac.sh\" --restaurer"
