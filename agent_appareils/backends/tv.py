"""Pilotage des Smart TV par le réseau local (Wi-Fi / Ethernet).

Marques prises en charge :
  - samsung : TV Samsung Tizen (2016+)      — paquet `samsungtvws`
  - lg      : TV LG webOS                    — paquet `pywebostv`
  - roku    : TV Roku / TCL Roku / Hisense Roku — rien à installer
  - android : TV Android / Google TV (Sony, Philips, TCL, Xiaomi...) — voir android.py (ADB)

Pour allumer une TV éteinte, l'agent envoie un paquet « Wake-on-LAN » : renseignez
l'adresse MAC de la TV dans config.json et activez l'option dans la TV si elle existe
(Samsung : « Allumer avec mobile » ; LG : « Allumer via Wi-Fi / LAN »).
"""

from __future__ import annotations

import json
import re
import socket
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import httpx

from .base import Device, DeviceError, SingleDeviceBackend


def wake_on_lan(mac: str, broadcast: str = "255.255.255.255") -> None:
    hex_mac = re.sub(r"[^0-9a-fA-F]", "", mac)
    if len(hex_mac) != 12:
        raise DeviceError(f"Adresse MAC invalide : {mac}")
    packet = b"\xff" * 6 + bytes.fromhex(hex_mac) * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        for port in (9, 7):
            s.sendto(packet, (broadcast, port))


# Touches « logiques » communes à toutes les TV.
KEY_ACTIONS = [
    "eteindre", "volume_haut", "volume_bas", "couper_son", "chaine_suivante", "chaine_precedente",
    "changer_source", "accueil", "retour", "lecture", "pause", "haut", "bas", "gauche", "droite", "ok",
]
PARAMS_HELP = {
    "volume_haut": "fois: nombre d'appuis (défaut 1) — idem pour toutes les touches",
    "regler_volume": "volume: 0-100",
    "changer_chaine": "chaine: numéro de chaîne",
    "ouvrir_application": "application: nom de l'appli (ex. 'Netflix', 'YouTube')",
    "ouvrir_url": "url: lien http(s)",
    "changer_source": "source (facultatif): ex. 'HDMI1' ; sans paramètre, ouvre le menu des sources",
    "afficher_message": "message: texte à afficher à l'écran",
    "touche": "touche: code brut de la marque (ex. 'KEY_MENU' Samsung, 'Info' Roku)",
}


class TVBackend(SingleDeviceBackend):
    """Logique commune ; chaque marque implémente _press, _launch, etc."""

    extra_actions: list[str] = []

    def __init__(self, device_id: str, name: str, host: str, mac: str = ""):
        super().__init__(device_id, name)
        if not host:
            raise DeviceError(f"{name} : adresse IP manquante dans la configuration.")
        self.host = host
        self.mac = mac

    @property
    def actions(self) -> list[str]:
        return ["allumer", *KEY_ACTIONS, "changer_chaine", "ouvrir_application", "touche", *self.extra_actions]

    def list_devices(self) -> list[Device]:
        try:
            state = self._status()
        except Exception as e:  # TV éteinte ou injoignable : ce n'est pas une erreur bloquante
            state = {"joignable": False, "detail": str(e)[:200]}
        return [Device(self.device_id, self.name, "tv", state, self.actions, PARAMS_HELP)]

    def control(self, device_id: str, action: str, p: dict[str, Any]) -> str:
        if action not in self.actions:
            raise DeviceError(f"Action « {action} » impossible sur {self.name}. Actions : {', '.join(self.actions)}.")
        try:
            if action == "allumer":
                return self._power_on()
            if action == "changer_source" and p.get("source"):
                return self._set_source(str(p["source"]))
            if action in KEY_ACTIONS:
                for _ in range(max(1, min(int(p.get("fois", 1) or 1), 50))):
                    self._press(action)
                return f"{self.name} : {action} effectué."
            if action == "changer_chaine":
                digits = re.sub(r"\D", "", str(p.get("chaine", "")))
                if not digits:
                    raise DeviceError("Paramètre « chaine » manquant.")
                return self._set_channel(digits)
            if action == "ouvrir_application":
                if not p.get("application"):
                    raise DeviceError("Paramètre « application » manquant.")
                return self._launch(str(p["application"]))
            if action == "touche":
                self._raw_key(str(p.get("touche", "")))
                return f"{self.name} : touche {p.get('touche')} envoyée."
            return getattr(self, f"_{action}")(p)
        except DeviceError:
            raise
        except Exception as e:
            raise DeviceError(f"{self.name} injoignable ou commande refusée : {e}") from e

    # --- à surcharger ------------------------------------------------------

    def _status(self) -> dict[str, Any]:
        raise NotImplementedError

    def _press(self, action: str) -> None:
        raise NotImplementedError

    def _raw_key(self, key: str) -> None:
        raise NotImplementedError

    def _launch(self, app: str) -> str:
        raise NotImplementedError

    def _power_on(self) -> str:
        if not self.mac:
            raise DeviceError(f"Pour allumer {self.name}, ajoutez son adresse MAC (« mac ») dans config.json.")
        wake_on_lan(self.mac)
        return f"{self.name} : signal d'allumage envoyé."

    def _set_channel(self, digits: str) -> str:
        for d in digits:
            self._raw_key(self.digit_key(d))
        return f"{self.name} : chaîne {digits}."

    def _set_source(self, source: str) -> str:
        self._press("changer_source")
        return f"{self.name} : menu des sources ouvert (choix direct de « {source} » non supporté)."

    def digit_key(self, d: str) -> str:
        return d

    @staticmethod
    def _match(name: str, candidates: dict[str, str]) -> str:
        """Trouve l'id d'appli dont le nom ressemble le plus à `name`."""
        key = re.sub(r"[^a-z0-9]", "", name.lower())
        for title, app_id in candidates.items():
            if re.sub(r"[^a-z0-9]", "", title.lower()) == key:
                return app_id
        for title, app_id in candidates.items():
            if key and key in re.sub(r"[^a-z0-9]", "", title.lower()):
                return app_id
        raise DeviceError(f"Application « {name} » introuvable. Disponibles : {', '.join(list(candidates)[:30])}")


# ---------------------------------------------------------------------------
class SamsungTV(TVBackend):
    KEYS = {
        "eteindre": "KEY_POWER", "volume_haut": "KEY_VOLUP", "volume_bas": "KEY_VOLDOWN",
        "couper_son": "KEY_MUTE", "chaine_suivante": "KEY_CHUP", "chaine_precedente": "KEY_CHDOWN",
        "changer_source": "KEY_SOURCE", "accueil": "KEY_HOME", "retour": "KEY_RETURN",
        "lecture": "KEY_PLAY", "pause": "KEY_PAUSE", "haut": "KEY_UP", "bas": "KEY_DOWN",
        "gauche": "KEY_LEFT", "droite": "KEY_RIGHT", "ok": "KEY_ENTER",
    }
    extra_actions = ["ouvrir_url"]

    def __init__(self, device_id: str, name: str, host: str, mac: str = "", token_file: str = ""):
        super().__init__(device_id, name, host, mac)
        try:
            from samsungtvws import SamsungTVWS
        except ImportError:
            raise DeviceError("Installez le paquet pour les TV Samsung : pip install samsungtvws") from None
        token_file = token_file or f".token_{device_id}.txt"
        # La 1re fois, la TV affiche une demande d'autorisation : acceptez-la avec la télécommande.
        self.tv = SamsungTVWS(host=host, port=8002, token_file=token_file, timeout=8, name="Agent IA")

    def _status(self) -> dict[str, Any]:
        info = self.tv.rest_device_info().get("device", {})
        return {"joignable": True, "modele": info.get("modelName"), "alimentation": info.get("PowerState", "on")}

    def _press(self, action: str) -> None:
        self.tv.send_key(self.KEYS[action])

    def _raw_key(self, key: str) -> None:
        self.tv.send_key(key if key.startswith("KEY_") else f"KEY_{key.upper()}")

    def _set_channel(self, digits: str) -> str:
        super()._set_channel(digits)
        self.tv.send_key("KEY_ENTER")
        return f"{self.name} : chaîne {digits}."

    def _launch(self, app: str) -> str:
        apps = self.tv.app_list() or []
        app_id = self._match(app, {a["name"]: a["appId"] for a in apps})
        self.tv.rest_app_run(app_id)
        return f"{self.name} : {app} ouvert."

    def _ouvrir_url(self, p: dict[str, Any]) -> str:
        self.tv.open_browser(str(p.get("url", "")))
        return f"{self.name} : navigateur ouvert."


# ---------------------------------------------------------------------------
class LGTV(TVBackend):
    extra_actions = ["regler_volume", "ouvrir_url", "afficher_message"]

    def __init__(self, device_id: str, name: str, host: str, mac: str = "", key_file: str = "", secure: bool = True):
        super().__init__(device_id, name, host, mac)
        try:
            import pywebostv  # noqa: F401
        except ImportError:
            raise DeviceError("Installez le paquet pour les TV LG : pip install pywebostv") from None
        self.key_file = Path(key_file or f".cle_{device_id}.json")
        self.secure = secure
        self._client = None

    def _controls(self):
        from pywebostv.connection import WebOSClient
        from pywebostv.controls import ApplicationControl, InputControl, MediaControl, SourceControl, SystemControl, TvControl

        if self._client is None:
            port = 3001 if self.secure else 3000
            try:  # vérification rapide : évite d'attendre longtemps si la TV est éteinte
                socket.create_connection((self.host, port), timeout=4).close()
            except OSError:
                raise DeviceError(f"{self.name} injoignable (éteinte ou hors du Wi-Fi ?).") from None
            store = json.loads(self.key_file.read_text()) if self.key_file.exists() else {}
            client = WebOSClient(self.host, secure=self.secure)
            client.connect()
            for status in client.register(store):
                if status == WebOSClient.PROMPTED:
                    print(f"  📺 Acceptez la demande de connexion sur l'écran de {self.name}...")
            self.key_file.write_text(json.dumps(store))
            self._client = client
        c = self._client
        return {
            "media": MediaControl(c), "system": SystemControl(c), "app": ApplicationControl(c),
            "tv": TvControl(c), "source": SourceControl(c), "input": InputControl(c),
        }

    @staticmethod
    def _volume_info(payload: Any) -> tuple[Any, bool]:
        """Volume et sourdine ; le format change selon la version de webOS."""
        if not isinstance(payload, dict):
            return payload, False
        st = payload.get("volumeStatus", payload)
        return st.get("volume"), bool(st.get("muteStatus", st.get("muted", False)))

    def _status(self) -> dict[str, Any]:
        vol, muted = self._volume_info(self._controls()["media"].get_volume())
        return {"joignable": True, "volume": vol, "muet": muted}

    def _press(self, action: str) -> None:
        ctl = self._controls()
        simple = {
            "eteindre": ctl["system"].power_off, "volume_haut": ctl["media"].volume_up,
            "volume_bas": ctl["media"].volume_down, "chaine_suivante": ctl["tv"].channel_up,
            "chaine_precedente": ctl["tv"].channel_down, "lecture": ctl["media"].play, "pause": ctl["media"].pause,
        }
        if action in simple:
            simple[action]()
            if action == "eteindre":
                self._client = None  # la connexion sera rouverte au prochain ordre
            return
        if action == "couper_son":
            _, muted = self._volume_info(ctl["media"].get_volume())
            ctl["media"].mute(not muted)
            return
        pointer = {"accueil": "home", "retour": "back", "haut": "up", "bas": "down",
                   "gauche": "left", "droite": "right", "ok": "ok", "changer_source": "menu"}
        self._pointer(pointer[action])

    def _pointer(self, name: str) -> None:
        inp = self._controls()["input"]
        inp.connect_input()
        try:
            getattr(inp, name)()
        finally:
            inp.disconnect_input()

    def _raw_key(self, key: str) -> None:
        self._pointer(key.lower())

    def digit_key(self, d: str) -> str:
        return f"num_{d}"

    def _set_channel(self, digits: str) -> str:
        ctl = self._controls()
        channels = ctl["tv"].channel_list().get("channelList", [])
        ch = next((c for c in channels if str(c.get("channelNumber")) == digits), None)
        if ch is None:
            raise DeviceError(f"Chaîne {digits} introuvable.")
        ctl["tv"].set_channel_with_id(ch["channelId"])
        return f"{self.name} : chaîne {digits} ({ch.get('channelName', '')})."

    def _set_source(self, source: str) -> str:
        src = self._controls()["source"]
        sources = src.list_sources()
        key = re.sub(r"[^a-z0-9]", "", source.lower())
        match = next((s for s in sources if key in re.sub(r"[^a-z0-9]", "", s.label.lower())
                      or key in re.sub(r"[^a-z0-9]", "", s["id"].lower())), None)
        if match is None:
            raise DeviceError(f"Source « {source} » introuvable. Sources : {', '.join(s.label for s in sources)}")
        src.set_source(match)
        return f"{self.name} : source {match.label}."

    def _launch(self, app: str) -> str:
        app_ctl = self._controls()["app"]
        apps = app_ctl.list_apps()
        by_title = {a["title"]: a["id"] for a in apps}
        app_id = self._match(app, by_title)
        app_ctl.launch(next(a for a in apps if a["id"] == app_id))
        return f"{self.name} : {app} ouvert."

    def _regler_volume(self, p: dict[str, Any]) -> str:
        vol = max(0, min(100, int(p.get("volume", 0))))
        self._controls()["media"].set_volume(vol)
        return f"{self.name} : volume à {vol}."

    def _ouvrir_url(self, p: dict[str, Any]) -> str:
        app_ctl = self._controls()["app"]
        browser = next((a for a in app_ctl.list_apps() if a["id"] == "com.webos.app.browser"), None)
        if browser is None:
            raise DeviceError("Navigateur introuvable sur la TV.")
        app_ctl.launch(browser, params={"target": str(p.get("url", ""))})
        return f"{self.name} : page ouverte."

    def _afficher_message(self, p: dict[str, Any]) -> str:
        self._controls()["system"].notify(str(p.get("message", "")))
        return f"{self.name} : message affiché."


# ---------------------------------------------------------------------------
class RokuTV(TVBackend):
    KEYS = {
        "eteindre": "PowerOff", "volume_haut": "VolumeUp", "volume_bas": "VolumeDown",
        "couper_son": "VolumeMute", "chaine_suivante": "ChannelUp", "chaine_precedente": "ChannelDown",
        "changer_source": "InputHDMI1", "accueil": "Home", "retour": "Back", "lecture": "Play",
        "pause": "Play", "haut": "Up", "bas": "Down", "gauche": "Left", "droite": "Right", "ok": "Select",
    }

    def __init__(self, device_id: str, name: str, host: str, mac: str = ""):
        super().__init__(device_id, name, host, mac)
        self.http = httpx.Client(base_url=f"http://{host}:8060", timeout=5)

    def _post(self, path: str) -> None:
        r = self.http.post(path)
        if r.status_code >= 400:
            raise DeviceError(f"La TV a répondu {r.status_code}.")

    def _status(self) -> dict[str, Any]:
        root = ET.fromstring(self.http.get("/query/device-info").text)
        return {"joignable": True, "modele": root.findtext("model-name"), "alimentation": root.findtext("power-mode")}

    def _power_on(self) -> str:
        try:
            self._post("/keypress/PowerOn")
            return f"{self.name} : allumée."
        except Exception:
            return super()._power_on()

    def _press(self, action: str) -> None:
        self._post(f"/keypress/{self.KEYS[action]}")
        time.sleep(0.1)

    def _raw_key(self, key: str) -> None:
        self._post(f"/keypress/{key}")

    def digit_key(self, d: str) -> str:
        return f"Lit_{d}"

    def _set_source(self, source: str) -> str:
        m = re.search(r"(\d)", source)
        key = f"InputHDMI{m.group(1)}" if "hdmi" in source.lower() and m else "InputTuner" if "tv" in source.lower() else ""
        if not key:
            raise DeviceError("Sources possibles : HDMI1..4, TV.")
        self._post(f"/keypress/{key}")
        return f"{self.name} : source {source}."

    def _launch(self, app: str) -> str:
        root = ET.fromstring(self.http.get("/query/apps").text)
        app_id = self._match(app, {a.text or "": a.get("id", "") for a in root.findall("app")})
        self._post(f"/launch/{app_id}")
        return f"{self.name} : {app} ouvert."
