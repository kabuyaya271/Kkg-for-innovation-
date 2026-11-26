#!/bin/bash
# Thème développeur pour Linux avec le bureau GNOME (Ubuntu, Fedora, Debian...) — sans sudo.
#
#   Installer :  bash installer_linux.sh
#   Annuler   :  bash installer_linux.sh --restaurer
#
# Ce que ça change (pour votre compte uniquement) :
#   - mode sombre (applications et shell)
#   - horloge de la barre du haut : jour + date + heure 24 h avec secondes
#   - police à chasse fixe JetBrains Mono si elle est installée
#   - fond d'écran « code »
#   - horloge de bureau façon éditeur de code, lancée à chaque ouverture de session
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/theme-dev"
BACKUP="$DEST/sauvegarde.txt"
AUTOSTART="$HOME/.config/autostart/horloge-dev.desktop"

command -v gsettings >/dev/null || { echo "gsettings introuvable : ce script est prévu pour le bureau GNOME."; exit 1; }

KEYS=(
  "org.gnome.desktop.interface color-scheme"
  "org.gnome.desktop.interface gtk-theme"
  "org.gnome.desktop.interface clock-format"
  "org.gnome.desktop.interface clock-show-seconds"
  "org.gnome.desktop.interface clock-show-date"
  "org.gnome.desktop.interface clock-show-weekday"
  "org.gnome.desktop.interface monospace-font-name"
  "org.gnome.desktop.background picture-uri"
  "org.gnome.desktop.background picture-uri-dark"
  "org.gnome.desktop.background picture-options"
)

has_key() { gsettings list-keys "$1" 2>/dev/null | grep -qx "$2"; }

if [[ "${1:-}" == "--restaurer" ]]; then
  [[ -f "$BACKUP" ]] || { echo "Aucune sauvegarde trouvée : rien à restaurer."; exit 1; }
  while IFS=$'\t' read -r schema key value; do
    has_key "$schema" "$key" && gsettings set "$schema" "$key" "$value" || true
  done < "$BACKUP"
  rm -f "$AUTOSTART"
  pkill -f "theme-dev/horloge_dev.py" 2>/dev/null || true
  echo "✓ Anciens réglages restaurés."
  exit 0
fi

mkdir -p "$DEST" "$(dirname "$AUTOSTART")"

# 1. Sauvegarde (une seule fois)
if [[ ! -f "$BACKUP" ]]; then
  for entry in "${KEYS[@]}"; do
    read -r schema key <<< "$entry"
    has_key "$schema" "$key" && printf '%s\t%s\t%s\n' "$schema" "$key" "$(gsettings get "$schema" "$key")" || true
  done > "$BACKUP"
fi

set_if() { has_key "$1" "$2" && gsettings set "$1" "$2" "$3" || true; }

# 2. Mode sombre
set_if org.gnome.desktop.interface color-scheme "'prefer-dark'"
set_if org.gnome.desktop.interface gtk-theme "'Adwaita-dark'"
echo "✓ Mode sombre activé"

# 3. Horloge : « jeu. 26 nov. 14:32:07 »
set_if org.gnome.desktop.interface clock-format "'24h'"
set_if org.gnome.desktop.interface clock-show-seconds true
set_if org.gnome.desktop.interface clock-show-date true
set_if org.gnome.desktop.interface clock-show-weekday true
echo "✓ Horloge de la barre du haut : date + 24 h avec secondes"

# 4. Police de code
if fc-list 2>/dev/null | grep -qi "JetBrains Mono"; then
  set_if org.gnome.desktop.interface monospace-font-name "'JetBrains Mono 11'"
  echo "✓ Police de code : JetBrains Mono"
fi

# 5. Fond d'écran
cp "$HERE/fond_ecran_dev.png" "$DEST/"
set_if org.gnome.desktop.background picture-uri "'file://$DEST/fond_ecran_dev.png'"
set_if org.gnome.desktop.background picture-uri-dark "'file://$DEST/fond_ecran_dev.png'"
set_if org.gnome.desktop.background picture-options "'zoom'"
echo "✓ Fond d'écran installé"

# 6. Horloge de bureau (python3 + tkinter : sudo apt install python3-tk si besoin)
cp "$HERE/horloge_dev.py" "$DEST/"
if python3 -c "import tkinter" 2>/dev/null; then
  cat > "$AUTOSTART" <<EOF
[Desktop Entry]
Type=Application
Name=Horloge dev
Exec=python3 "$DEST/horloge_dev.py"
X-GNOME-Autostart-enabled=true
EOF
  pkill -f "theme-dev/horloge_dev.py" 2>/dev/null || true
  (nohup python3 "$DEST/horloge_dev.py" >/dev/null 2>&1 &)
  echo "✓ Horloge de bureau lancée (et à chaque ouverture de session). Clic droit dessus pour les options."
else
  echo "! tkinter manquant : installez-le (Ubuntu/Debian : sudo apt install python3-tk) puis relancez ce script."
fi

echo
echo "Terminé. Pour tout annuler :  bash \"$HERE/installer_linux.sh\" --restaurer"
