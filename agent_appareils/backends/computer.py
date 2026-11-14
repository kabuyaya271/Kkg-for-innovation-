"""Pilotage de l'ordinateur sur lequel tourne l'agent (Windows, macOS, Linux)."""

from __future__ import annotations

import platform
import shutil
import subprocess
import webbrowser
from typing import Any, Callable

from .base import Backend, Device, DeviceError

SYSTEM = platform.system()  # "Windows", "Darwin" (macOS) ou "Linux"


def _run(cmd: list[str] | str, shell: bool = False, timeout: int = 30) -> str:
    try:
        p = subprocess.run(cmd, shell=shell, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError as e:
        raise DeviceError(f"Commande introuvable : {e}") from e
    except subprocess.TimeoutExpired:
        raise DeviceError("La commande a dépassé le délai.") from None
    out = (p.stdout + p.stderr).strip()
    if p.returncode != 0:
        raise DeviceError(f"Échec (code {p.returncode}) : {out[:500]}")
    return out[:2000]


class ComputerBackend(Backend):
    """Expose l'ordinateur comme un appareil « pc:ordinateur »."""

    prefix = "pc"
    ACTIONS = [
        "ouvrir_url", "ouvrir_application", "regler_volume", "couper_son",
        "verrouiller_ecran", "mettre_en_veille", "eteindre", "redemarrer", "executer_commande",
    ]
    # Actions qui demandent toujours une confirmation à l'utilisateur.
    SENSITIVE = {"eteindre", "redemarrer", "executer_commande", "mettre_en_veille"}

    def __init__(self, confirm: Callable[[str], bool]):
        self.confirm = confirm

    def list_devices(self) -> list[Device]:
        return [
            Device(
                id="pc:ordinateur",
                name=f"Cet ordinateur ({SYSTEM})",
                type="ordinateur",
                state={"systeme": SYSTEM, "machine": platform.node()},
                actions=self.ACTIONS,
                params_help={
                    "ouvrir_url": "url: lien http(s)",
                    "ouvrir_application": "application: nom de l'application (ex. 'firefox', 'Spotify')",
                    "regler_volume": "volume: 0-100",
                    "executer_commande": "commande: commande shell",
                },
            )
        ]

    def control(self, device_id: str, action: str, parameters: dict[str, Any]) -> str:
        if device_id != "ordinateur":
            raise DeviceError(f"Appareil « {device_id} » introuvable.")
        if action not in self.ACTIONS:
            raise DeviceError(f"Action inconnue. Actions possibles : {', '.join(self.ACTIONS)}.")
        if action in self.SENSITIVE:
            detail = parameters.get("commande", "") if action == "executer_commande" else ""
            if not self.confirm(f"L'agent veut : {action} {detail}".strip()):
                return "Action annulée par l'utilisateur."
        return getattr(self, f"_{action}")(parameters)

    # --- actions -----------------------------------------------------------

    def _ouvrir_url(self, p: dict[str, Any]) -> str:
        url = str(p.get("url", ""))
        if not url.startswith(("http://", "https://")):
            raise DeviceError("Paramètre « url » manquant ou invalide (http/https).")
        webbrowser.open(url)
        return f"Page ouverte : {url}"

    def _ouvrir_application(self, p: dict[str, Any]) -> str:
        app = str(p.get("application", "")).strip()
        if not app:
            raise DeviceError("Paramètre « application » manquant.")
        if SYSTEM == "Darwin":
            _run(["open", "-a", app])
        elif SYSTEM == "Windows":
            _run(["cmd", "/c", "start", "", app])
        else:
            exe = shutil.which(app)
            if not exe:
                raise DeviceError(f"Application « {app} » introuvable.")
            subprocess.Popen([exe], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return f"Application lancée : {app}"

    def _regler_volume(self, p: dict[str, Any]) -> str:
        try:
            level = int(p["volume"])
        except (KeyError, TypeError, ValueError):
            raise DeviceError("Paramètre « volume » (0-100) manquant.") from None
        level = max(0, min(100, level))
        if SYSTEM == "Darwin":
            _run(["osascript", "-e", f"set volume output volume {level}"])
        elif SYSTEM == "Windows":
            # 0xAE/0xAF = touches volume -/+ ; 50 pressions = 0..100 par pas de 2.
            ps = (
                "$w=New-Object -ComObject WScript.Shell;"
                "1..50|%{$w.SendKeys([char]174)};"
                f"1..{level // 2}|%{{$w.SendKeys([char]175)}}"
            )
            _run(["powershell", "-NoProfile", "-Command", ps])
        else:
            _run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{level}%"])
        return f"Volume réglé à {level}%"

    def _couper_son(self, p: dict[str, Any]) -> str:
        if SYSTEM == "Darwin":
            _run(["osascript", "-e", "set volume with output muted"])
        elif SYSTEM == "Windows":
            _run(["powershell", "-NoProfile", "-Command",
                  "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"])
        else:
            _run(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle"])
        return "Son coupé/rétabli."

    def _verrouiller_ecran(self, p: dict[str, Any]) -> str:
        if SYSTEM == "Darwin":
            _run(["pmset", "displaysleepnow"])
        elif SYSTEM == "Windows":
            _run(["rundll32.exe", "user32.dll,LockWorkStation"])
        else:
            _run(["loginctl", "lock-session"])
        return "Écran verrouillé."

    def _mettre_en_veille(self, p: dict[str, Any]) -> str:
        if SYSTEM == "Darwin":
            _run(["pmset", "sleepnow"])
        elif SYSTEM == "Windows":
            _run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
        else:
            _run(["systemctl", "suspend"])
        return "Mise en veille."

    def _eteindre(self, p: dict[str, Any]) -> str:
        if SYSTEM == "Windows":
            _run(["shutdown", "/s", "/t", "60"])
        else:
            _run(["shutdown", "-h", "+1"])
        return "Extinction programmée dans 1 minute."

    def _redemarrer(self, p: dict[str, Any]) -> str:
        if SYSTEM == "Windows":
            _run(["shutdown", "/r", "/t", "60"])
        else:
            _run(["shutdown", "-r", "+1"])
        return "Redémarrage programmé dans 1 minute."

    def _executer_commande(self, p: dict[str, Any]) -> str:
        cmd = str(p.get("commande", "")).strip()
        if not cmd:
            raise DeviceError("Paramètre « commande » manquant.")
        return _run(cmd, shell=True) or "(commande exécutée, aucune sortie)"
