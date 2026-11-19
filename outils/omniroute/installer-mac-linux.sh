#!/bin/sh
# Installation d'OmniRoute (KKG for Innovation)
set -e
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installez la version LTS depuis https://nodejs.org puis relancez ce script."
  exit 1
fi
npm install -g omniroute@3.8.54 || sudo npm install -g omniroute@3.8.54
echo "Installation terminée. Tableau de bord : http://localhost:20128"
( sleep 4; (command -v open >/dev/null && open http://localhost:20128) || (command -v xdg-open >/dev/null && xdg-open http://localhost:20128) || true ) &
exec omniroute
