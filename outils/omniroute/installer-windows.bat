@echo off
chcp 65001 >nul
echo === Installation d'OmniRoute (KKG for Innovation) ===
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
  start https://nodejs.org
  pause
  exit /b 1
)
call npm install -g omniroute@3.8.54
if errorlevel 1 (
  echo L'installation a echoue. Relancez ce fichier en "Executer en tant qu'administrateur".
  pause
  exit /b 1
)
echo.
echo Installation terminee. Demarrage d'OmniRoute : le tableau de bord va s'ouvrir sur http://localhost:20128
start "" http://localhost:20128
call omniroute
pause
