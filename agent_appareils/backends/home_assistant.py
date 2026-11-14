"""Pilotage des vrais appareils via Home Assistant.

Home Assistant (https://www.home-assistant.io) sait déjà parler à la plupart des
appareils connectés : Philips Hue, Tuya/Smart Life, Xiaomi, Sonos, Chromecast,
TV Samsung/LG, thermostats, prises, volets, Zigbee, Z-Wave, Matter...
L'agent passe donc par son API REST plutôt que de réimplémenter chaque marque.

Configuration (variables d'environnement) :
    HA_URL    ex. http://homeassistant.local:8123
    HA_TOKEN  « jeton d'accès longue durée » (Profil > Sécurité dans Home Assistant)
"""

from __future__ import annotations

from typing import Any

import httpx

from .base import Backend, Device, DeviceError

# Domaines Home Assistant exposés à l'agent et services courants pour chacun.
DOMAINS: dict[str, list[str]] = {
    "light": ["turn_on", "turn_off", "toggle"],
    "switch": ["turn_on", "turn_off", "toggle"],
    "fan": ["turn_on", "turn_off", "toggle", "set_percentage"],
    "climate": ["set_temperature", "set_hvac_mode", "turn_on", "turn_off"],
    "cover": ["open_cover", "close_cover", "stop_cover", "set_cover_position"],
    "media_player": [
        "turn_on", "turn_off", "media_play", "media_pause", "media_stop",
        "volume_set", "volume_mute", "media_next_track", "media_previous_track", "select_source",
    ],
    "lock": ["lock", "unlock"],
    "vacuum": ["start", "pause", "return_to_base", "stop"],
    "scene": ["turn_on"],
    "script": ["turn_on"],
    "input_boolean": ["turn_on", "turn_off", "toggle"],
    "button": ["press"],
}

# Attributs utiles à montrer à l'agent (le reste est bruit).
USEFUL_ATTRS = {
    "brightness", "color_name", "rgb_color", "temperature", "current_temperature",
    "hvac_mode", "current_position", "volume_level", "is_volume_muted", "source",
    "source_list", "media_title", "percentage", "battery_level",
}


class HomeAssistantBackend(Backend):
    prefix = "ha"

    def __init__(self, url: str, token: str, timeout: float = 10.0):
        self.client = httpx.Client(
            base_url=url.rstrip("/"),
            headers={"Authorization": f"Bearer {token}"},
            timeout=timeout,
        )

    def _request(self, method: str, path: str, **kw: Any) -> Any:
        try:
            r = self.client.request(method, path, **kw)
        except httpx.HTTPError as e:
            raise DeviceError(f"Home Assistant injoignable : {e}") from e
        if r.status_code == 401:
            raise DeviceError("Home Assistant refuse le jeton (HA_TOKEN invalide).")
        if r.status_code >= 400:
            raise DeviceError(f"Home Assistant a répondu {r.status_code} : {r.text[:300]}")
        return r.json() if r.content else None

    def list_devices(self) -> list[Device]:
        devices = []
        for s in self._request("GET", "/api/states"):
            entity_id: str = s["entity_id"]
            domain = entity_id.split(".", 1)[0]
            if domain not in DOMAINS:
                continue
            attrs = s.get("attributes", {})
            state = {"etat": s.get("state")}
            state.update({k: v for k, v in attrs.items() if k in USEFUL_ATTRS})
            devices.append(
                Device(
                    id=f"{self.prefix}:{entity_id}",
                    name=attrs.get("friendly_name", entity_id),
                    type=domain,
                    state=state,
                    actions=DOMAINS[domain],
                )
            )
        return devices

    def control(self, device_id: str, action: str, parameters: dict[str, Any]) -> str:
        domain = device_id.split(".", 1)[0]
        if domain not in DOMAINS:
            raise DeviceError(f"Type d'appareil « {domain} » non pris en charge.")
        if action not in DOMAINS[domain]:
            raise DeviceError(
                f"Service « {action} » non autorisé pour {domain}. Services possibles : {', '.join(DOMAINS[domain])}."
            )
        payload = {"entity_id": device_id, **parameters}
        self._request("POST", f"/api/services/{domain}/{action}", json=payload)
        new = self._request("GET", f"/api/states/{device_id}")
        return f"{device_id} : {action} envoyé. État actuel : {new.get('state') if new else 'inconnu'}"
