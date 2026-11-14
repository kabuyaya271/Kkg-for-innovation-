"""Pilotage d'un téléphone Android ou d'une TV Android / Google TV via ADB.

ADB (Android Debug Bridge) est l'outil officiel de Google pour commander un appareil
Android depuis un ordinateur, par câble USB ou par le Wi-Fi.

Pré-requis (une seule fois) :
  1. Installer « platform-tools » (contient la commande adb) :
     https://developer.android.com/tools/releases/platform-tools
  2. Sur l'appareil : Paramètres > À propos > appuyer 7 fois sur « Numéro de build »
     pour activer les Options pour les développeurs, puis activer « Débogage USB »
     (et « Débogage sans fil » / « Débogage réseau » pour le Wi-Fi ; sur TV : « Débogage ADB »).
  3. À la première connexion, accepter l'autorisation qui s'affiche sur l'appareil.
"""

from __future__ import annotations

import re
import shlex
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Callable

from .base import Device, DeviceError, SingleDeviceBackend

# Codes de touches Android (KeyEvent).
KEYS = {
    "accueil": 3, "retour": 4, "raccrocher": 6, "volume_haut": 24, "volume_bas": 25,
    "alimentation": 26, "haut": 19, "bas": 20, "gauche": 21, "droite": 22, "ok": 23,
    "lecture_pause": 85, "suivant": 87, "precedent": 88, "lecture": 126, "pause": 127,
    "couper_son": 164, "chaine_suivante": 166, "chaine_precedente": 167,
    "changer_source": 178, "verrouiller": 223, "reveiller": 224, "applications_recentes": 187,
}

# Noms courants -> paquets Android (téléphone, puis variante TV).
APP_ALIASES = {
    "youtube": ["com.google.android.youtube", "com.google.android.youtube.tv"],
    "netflix": ["com.netflix.mediaclient", "com.netflix.ninja"],
    "whatsapp": ["com.whatsapp", "com.whatsapp.w4b"],
    "spotify": ["com.spotify.music", "com.spotify.tv.android"],
    "chrome": ["com.android.chrome"],
    "maps": ["com.google.android.apps.maps"], "google maps": ["com.google.android.apps.maps"],
    "gmail": ["com.google.android.gm"],
    "facebook": ["com.facebook.katana"], "messenger": ["com.facebook.orca"],
    "instagram": ["com.instagram.android"], "tiktok": ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill"],
    "telegram": ["org.telegram.messenger"], "snapchat": ["com.snapchat.android"],
    "prime video": ["com.amazon.avod.thirdpartyclient", "com.amazon.amazonvideo.livingroom"],
    "disney+": ["com.disney.disneyplus"], "canal+": ["com.canal.android.canal"],
    "appareil photo": ["com.android.camera", "com.google.android.GoogleCamera", "com.sec.android.app.camera"],
    "parametres": ["com.android.settings"], "réglages": ["com.android.settings"],
    "play store": ["com.android.vending"], "calculatrice": ["com.google.android.calculator", "com.sec.android.app.popupcalculator"],
}

PHONE_ACTIONS = [
    "ouvrir_application", "ouvrir_url", "regler_volume", "volume_haut", "volume_bas", "couper_son",
    "lecture_pause", "suivant", "precedent", "accueil", "retour", "verrouiller", "reveiller",
    "appeler", "raccrocher", "envoyer_sms", "prendre_photo", "capture_ecran", "regler_luminosite",
    "wifi", "bluetooth", "ne_pas_deranger", "saisir_texte", "batterie", "eteindre", "redemarrer", "commande_adb",
]
TV_ACTIONS = [
    "allumer", "eteindre", "ouvrir_application", "ouvrir_url", "regler_volume", "volume_haut", "volume_bas",
    "couper_son", "chaine_suivante", "chaine_precedente", "changer_chaine", "changer_source",
    "lecture", "pause", "lecture_pause", "suivant", "precedent", "accueil", "retour",
    "haut", "bas", "gauche", "droite", "ok", "saisir_texte", "capture_ecran", "commande_adb",
]
PARAMS_HELP = {
    "ouvrir_application": "application: nom (ex. 'YouTube', 'WhatsApp') ou nom de paquet",
    "ouvrir_url": "url: lien http(s)",
    "regler_volume": "volume: 0-100",
    "volume_haut": "fois: nombre d'appuis (défaut 1) — idem pour toutes les touches",
    "appeler": "numero: numéro de téléphone",
    "envoyer_sms": "numero, message (ouvre le SMS pré-rempli ; l'utilisateur appuie sur Envoyer)",
    "regler_luminosite": "luminosite: 0-100",
    "wifi": "active: true/false", "bluetooth": "active: true/false", "ne_pas_deranger": "active: true/false",
    "saisir_texte": "texte: texte à taper dans le champ actif (sans accents)",
    "changer_chaine": "chaine: numéro de chaîne",
    "commande_adb": "commande: commande 'adb shell' brute (avancé)",
}
SENSITIVE = {"appeler", "envoyer_sms", "eteindre", "redemarrer", "commande_adb"}


class AndroidBackend(SingleDeviceBackend):
    def __init__(
        self,
        device_id: str,
        name: str,
        address: str = "",
        kind: str = "telephone",
        confirm: Callable[[str], bool] = lambda q: False,
        mac: str = "",
        captures_dir: Path = Path("captures"),
    ):
        super().__init__(device_id, name)
        self.address = address.strip()
        self.kind = kind
        self.confirm = confirm
        self.mac = mac
        self.captures_dir = captures_dir
        self.actions = TV_ACTIONS if kind == "tv" else PHONE_ACTIONS

    # --- bas niveau ADB ----------------------------------------------------

    def _adb(self, *args: str, timeout: int = 20, binary: bool = False) -> Any:
        adb = shutil.which("adb")
        if not adb:
            raise DeviceError("La commande « adb » est introuvable : installez Android platform-tools.")
        if self.address and ":" in self.address:
            subprocess.run([adb, "connect", self.address], capture_output=True, timeout=10)
        cmd = [adb] + (["-s", self.address] if self.address else []) + list(args)
        try:
            p = subprocess.run(cmd, capture_output=True, timeout=timeout, text=not binary)
        except subprocess.TimeoutExpired:
            raise DeviceError(f"{self.name} ne répond pas (délai dépassé).") from None
        if p.returncode != 0:
            err = p.stderr if not binary else p.stderr.decode(errors="replace")
            if "unauthorized" in err:
                raise DeviceError(f"{self.name} : acceptez l'autorisation de débogage affichée sur l'appareil.")
            if "not found" in err or "offline" in err or "no devices" in err:
                raise DeviceError(f"{self.name} n'est pas connecté (vérifiez le Wi-Fi / câble et le débogage ADB).")
            raise DeviceError(f"{self.name} : erreur ADB : {err.strip()[:300]}")
        return p.stdout

    def _shell(self, command: str, timeout: int = 20) -> str:
        return self._adb("shell", command, timeout=timeout).strip()

    def _key(self, name: str, times: int = 1) -> None:
        code = KEYS[name]
        self._shell(" ; ".join([f"input keyevent {code}"] * max(1, min(times, 50))))

    # --- état --------------------------------------------------------------

    def list_devices(self) -> list[Device]:
        state: dict[str, Any] = {}
        try:
            batt = self._shell("dumpsys battery | grep -E 'level|AC powered|USB powered'", timeout=8)
            m = re.search(r"level:\s*(\d+)", batt)
            if m and self.kind != "tv":
                state["batterie"] = f"{m.group(1)}%"
                state["en_charge"] = "powered: true" in batt
            power = self._shell("dumpsys power | grep -m1 mWakefulness=", timeout=8)
            state["ecran_allume"] = "Awake" in power
            state["connecte"] = True
        except DeviceError as e:
            state = {"connecte": False, "probleme": str(e)}
        return [Device(self.device_id, self.name, f"android_{self.kind}", state, self.actions, PARAMS_HELP)]

    # --- actions -----------------------------------------------------------

    def control(self, device_id: str, action: str, p: dict[str, Any]) -> str:
        if action not in self.actions:
            raise DeviceError(f"Action « {action} » impossible sur {self.name}. Actions : {', '.join(self.actions)}.")
        if action in SENSITIVE and not (self.kind == "tv" and action == "eteindre"):
            detail = p.get("numero") or p.get("commande") or ""
            if not self.confirm(f"{self.name} : {action} {detail}".strip()):
                return "Action annulée par l'utilisateur."

        if action in KEYS:
            self._key(action, int(p.get("fois", 1) or 1))
            return f"{self.name} : {action} effectué."
        return getattr(self, f"_{action}")(p)

    def _allumer(self, p: dict[str, Any]) -> str:
        if self.mac:
            from .tv import wake_on_lan

            wake_on_lan(self.mac)
            time.sleep(1)
        try:
            self._key("reveiller")
        except DeviceError:
            if not self.mac:
                raise
        return f"{self.name} : allumage demandé."

    def _resolve_package(self, app: str) -> str:
        installed = set(re.findall(r"package:(\S+)", self._shell("pm list packages")))
        key = app.strip().lower()
        if key in installed:
            return key
        for pkg in APP_ALIASES.get(key, []):
            if pkg in installed:
                return pkg
        compact = re.sub(r"[^a-z0-9]", "", key)
        matches = sorted((p for p in installed if compact and compact in p.replace(".", "")), key=len)
        if not matches:
            raise DeviceError(f"Application « {app} » introuvable sur {self.name}.")
        return matches[0]

    def _ouvrir_application(self, p: dict[str, Any]) -> str:
        app = str(p.get("application", "")).strip()
        if not app:
            raise DeviceError("Paramètre « application » manquant.")
        pkg = self._resolve_package(app)
        categories = ["android.intent.category.LEANBACK_LAUNCHER"] if self.kind == "tv" else []
        categories.append("android.intent.category.LAUNCHER")
        for cat in categories:
            out = self._shell(f"monkey -p {shlex.quote(pkg)} -c {cat} 1")
            if "No activities found" not in out:
                return f"{self.name} : {app} ouvert ({pkg})."
        raise DeviceError(f"Impossible de lancer {pkg}.")

    def _ouvrir_url(self, p: dict[str, Any]) -> str:
        url = str(p.get("url", ""))
        if not url.startswith(("http://", "https://")):
            raise DeviceError("Paramètre « url » manquant ou invalide.")
        self._shell(f"am start -a android.intent.action.VIEW -d {shlex.quote(url)}")
        return f"{self.name} : {url} ouvert."

    def _regler_volume(self, p: dict[str, Any]) -> str:
        try:
            pct = max(0, min(100, int(p["volume"])))
        except (KeyError, TypeError, ValueError):
            raise DeviceError("Paramètre « volume » (0-100) manquant.") from None
        out = self._shell("cmd media_session volume --stream 3 --get")
        m = re.search(r"\[(\d+)\.\.(\d+)\]", out)
        if not m:
            raise DeviceError("Réglage précis du volume non supporté : utilisez volume_haut / volume_bas.")
        lo, hi = int(m.group(1)), int(m.group(2))
        level = lo + round((hi - lo) * pct / 100)
        self._shell(f"cmd media_session volume --stream 3 --set {level}")
        return f"{self.name} : volume à {pct}%."

    def _changer_chaine(self, p: dict[str, Any]) -> str:
        digits = re.sub(r"\D", "", str(p.get("chaine", "")))
        if not digits:
            raise DeviceError("Paramètre « chaine » manquant.")
        self._shell(" ; ".join(f"input keyevent {7 + int(d)}" for d in digits))
        return f"{self.name} : chaîne {digits}."

    def _appeler(self, p: dict[str, Any]) -> str:
        num = re.sub(r"[^\d+]", "", str(p.get("numero", "")))
        if not num:
            raise DeviceError("Paramètre « numero » manquant.")
        self._shell(f"am start -a android.intent.action.CALL -d tel:{num}")
        return f"{self.name} : appel vers {num} lancé."

    def _envoyer_sms(self, p: dict[str, Any]) -> str:
        num = re.sub(r"[^\d+]", "", str(p.get("numero", "")))
        msg = str(p.get("message", ""))
        if not num:
            raise DeviceError("Paramètre « numero » manquant.")
        self._shell(
            f"am start -a android.intent.action.SENDTO -d sms:{num} --es sms_body {shlex.quote(msg)}"
        )
        return f"{self.name} : SMS pour {num} prêt, il reste à appuyer sur Envoyer sur le téléphone."

    def _prendre_photo(self, p: dict[str, Any]) -> str:
        self._shell("am start -a android.media.action.STILL_IMAGE_CAMERA")
        time.sleep(2)
        self._shell("input keyevent 27")
        return f"{self.name} : photo prise (appareil photo ouvert)."

    def _capture_ecran(self, p: dict[str, Any]) -> str:
        png = self._adb("exec-out", "screencap", "-p", binary=True)
        self.captures_dir.mkdir(parents=True, exist_ok=True)
        path = self.captures_dir / f"{self.device_id}_{time.strftime('%Y%m%d_%H%M%S')}.png"
        path.write_bytes(png)
        return f"Capture d'écran enregistrée : {path.resolve()}"

    def _regler_luminosite(self, p: dict[str, Any]) -> str:
        try:
            pct = max(0, min(100, int(p["luminosite"])))
        except (KeyError, TypeError, ValueError):
            raise DeviceError("Paramètre « luminosite » (0-100) manquant.") from None
        self._shell(
            f"settings put system screen_brightness_mode 0 ; settings put system screen_brightness {round(pct * 2.55)}"
        )
        return f"{self.name} : luminosité à {pct}%."

    @staticmethod
    def _flag(p: dict[str, Any]) -> bool:
        v = p.get("active", True)
        return v if isinstance(v, bool) else str(v).lower() in {"true", "1", "oui", "on"}

    def _wifi(self, p: dict[str, Any]) -> str:
        on = self._flag(p)
        self._shell(f"svc wifi {'enable' if on else 'disable'}")
        return f"{self.name} : Wi-Fi {'activé' if on else 'désactivé'}."

    def _bluetooth(self, p: dict[str, Any]) -> str:
        on = self._flag(p)
        self._shell(f"cmd bluetooth_manager {'enable' if on else 'disable'}")
        return f"{self.name} : Bluetooth {'activé' if on else 'désactivé'}."

    def _ne_pas_deranger(self, p: dict[str, Any]) -> str:
        on = self._flag(p)
        self._shell(f"cmd notification set_dnd {'on' if on else 'off'}")
        return f"{self.name} : Ne pas déranger {'activé' if on else 'désactivé'}."

    def _saisir_texte(self, p: dict[str, Any]) -> str:
        text = str(p.get("texte", ""))
        if not text:
            raise DeviceError("Paramètre « texte » manquant.")
        self._shell(f"input text {shlex.quote(text.replace(' ', '%s'))}")
        return f"{self.name} : texte saisi."

    def _batterie(self, p: dict[str, Any]) -> str:
        return self._shell("dumpsys battery")[:800]

    def _eteindre(self, p: dict[str, Any]) -> str:
        if self.kind == "tv":
            self._key("verrouiller")  # mise en veille de la TV
            return f"{self.name} : mise en veille."
        self._adb("reboot", "-p")
        return f"{self.name} : extinction en cours."

    def _redemarrer(self, p: dict[str, Any]) -> str:
        self._adb("reboot")
        return f"{self.name} : redémarrage en cours."

    def _commande_adb(self, p: dict[str, Any]) -> str:
        cmd = str(p.get("commande", "")).strip()
        if not cmd:
            raise DeviceError("Paramètre « commande » manquant.")
        return self._shell(cmd, timeout=30)[:2000] or "(aucune sortie)"
