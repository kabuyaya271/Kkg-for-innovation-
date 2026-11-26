<#
  Thème développeur pour Windows 10 / 11 — sans droits administrateur.

  Installer :   clic droit sur ce fichier > « Exécuter avec PowerShell »
                ou :  powershell -ExecutionPolicy Bypass -File installer_windows.ps1
  Annuler   :   powershell -ExecutionPolicy Bypass -File installer_windows.ps1 -Restaurer

  Ce que ça change (pour votre compte uniquement) :
    - mode sombre pour Windows et les applications
    - horloge de la barre des tâches : format 24 h et secondes affichées
    - fond d'écran « code »
    - horloge de bureau façon éditeur de code, lancée à chaque démarrage
  Vos anciens réglages sont sauvegardés dans %APPDATA%\ThemeDev\sauvegarde.json.
#>
param([switch]$Restaurer)
$ErrorActionPreference = "Stop"

$Here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dest      = Join-Path $env:APPDATA "ThemeDev"
$Backup    = Join-Path $Dest "sauvegarde.json"
$Startup   = Join-Path ([Environment]::GetFolderPath("Startup")) "HorlogeDev.vbs"
$Personal  = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
$Advanced  = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
$Intl      = "HKCU:\Control Panel\International"
$Desktop   = "HKCU:\Control Panel\Desktop"

$Settings = @(
  @{Path=$Personal; Name="AppsUseLightTheme";        Value=0;          Type="DWord"},
  @{Path=$Personal; Name="SystemUsesLightTheme";     Value=0;          Type="DWord"},
  @{Path=$Advanced; Name="ShowSecondsInSystemClock"; Value=1;          Type="DWord"},
  @{Path=$Intl;     Name="sShortTime";               Value="HH:mm";    Type="String"},
  @{Path=$Intl;     Name="sTimeFormat";              Value="HH:mm:ss"; Type="String"}
)

Add-Type @"
using System.Runtime.InteropServices;
public class Wallpaper {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int SystemParametersInfo(int action, int param, string file, int flags);
}
"@
function Set-Wallpaper($file) { [Wallpaper]::SystemParametersInfo(20, 0, $file, 3) | Out-Null }

function Restart-Explorer {
  Write-Host "Redémarrage de l'Explorateur pour appliquer l'horloge (la barre des tâches clignote)..."
  Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
}

if ($Restaurer) {
  if (-not (Test-Path $Backup)) { Write-Host "Aucune sauvegarde trouvée : rien à restaurer."; exit 1 }
  $old = Get-Content $Backup -Raw | ConvertFrom-Json
  foreach ($s in $old.reglages) {
    if ($null -eq $s.Value) { Remove-ItemProperty -Path $s.Path -Name $s.Name -ErrorAction SilentlyContinue }
    else { Set-ItemProperty -Path $s.Path -Name $s.Name -Value $s.Value }
  }
  if ($old.fond) { Set-Wallpaper $old.fond }
  Remove-Item $Startup -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name like 'pythonw%'" |
    Where-Object { $_.CommandLine -like "*horloge_dev.py*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Restart-Explorer
  Write-Host "✓ Anciens réglages restaurés."
  exit 0
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

# 1. Sauvegarde (une seule fois : on ne l'écrase pas lors d'une réinstallation)
if (-not (Test-Path $Backup)) {
  $saved = foreach ($s in $Settings) {
    $cur = (Get-ItemProperty -Path $s.Path -Name $s.Name -ErrorAction SilentlyContinue).($s.Name)
    @{Path=$s.Path; Name=$s.Name; Value=$cur}
  }
  $fond = (Get-ItemProperty -Path $Desktop -Name Wallpaper -ErrorAction SilentlyContinue).Wallpaper
  @{reglages=$saved; fond=$fond} | ConvertTo-Json -Depth 4 | Set-Content -Path $Backup -Encoding UTF8
}

# 2. Mode sombre + horloge 24 h avec secondes
foreach ($s in $Settings) {
  if (-not (Test-Path $s.Path)) { New-Item -Path $s.Path -Force | Out-Null }
  New-ItemProperty -Path $s.Path -Name $s.Name -Value $s.Value -PropertyType $s.Type -Force | Out-Null
}
Write-Host "✓ Mode sombre activé"
Write-Host "✓ Horloge de la barre des tâches : 24 h avec secondes"

# 3. Fond d'écran
Copy-Item (Join-Path $Here "fond_ecran_dev.png") $Dest -Force
Set-Wallpaper (Join-Path $Dest "fond_ecran_dev.png")
Write-Host "✓ Fond d'écran installé"

# 4. Horloge de bureau (nécessite Python : https://www.python.org/downloads/)
Copy-Item (Join-Path $Here "horloge_dev.py") $Dest -Force
$pythonw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $pythonw) {
  $py = (Get-Command py.exe -ErrorAction SilentlyContinue).Source
  if ($py) { $pythonw = (& $py -c "import sys,os;print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))").Trim() }
}
if ($pythonw -and (Test-Path $pythonw)) {
  $clock = Join-Path $Dest "horloge_dev.py"
  # Petit script VBS : lance l'horloge au démarrage sans fenêtre de console.
  $vbs = 'CreateObject("WScript.Shell").Run """{0}"" ""{1}""", 0' -f $pythonw, $clock
  Set-Content -Path $Startup -Value $vbs -Encoding Unicode
  Start-Process $pythonw -ArgumentList "`"$clock`""
  Write-Host "✓ Horloge de bureau lancée (et à chaque démarrage). Clic droit dessus pour les options."
} else {
  Write-Host "! Python introuvable : installez-le depuis python.org puis relancez ce script pour l'horloge de bureau."
}

Restart-Explorer
Write-Host "`nTerminé. Pour tout annuler :  powershell -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`" -Restaurer"
