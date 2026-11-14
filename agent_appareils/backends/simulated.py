"""Appareils simulés : pour tester l'agent sans matériel réel.

La liste des appareils est lue dans un fichier JSON (voir devices.example.json)
et l'état est sauvegardé dans ce même fichier après chaque action.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .base import Backend, Device, DeviceError

# Actions supportées par type d'appareil, avec l'effet sur l'état.
ACTIONS: dict[str, list[str]] = {
    "lumiere": ["allumer", "eteindre", "basculer", "regler_luminosite", "regler_couleur"],
    "prise": ["allumer", "eteindre", "basculer"],
    "tv": ["allumer", "eteindre", "regler_volume", "changer_chaine"],
    "thermostat": ["regler_temperature", "allumer", "eteindre"],
    "volet": ["ouvrir", "fermer", "regler_position"],
    "enceinte": ["allumer", "eteindre", "regler_volume", "jouer", "pause"],
    "serrure": ["verrouiller", "deverrouiller"],
}

DEFAULT_DEVICES = [
    {"id": "lampe_salon", "nom": "Lampe du salon", "type": "lumiere", "etat": {"allume": False, "luminosite": 100}},
    {"id": "lampe_chambre", "nom": "Lampe de la chambre", "type": "lumiere", "etat": {"allume": False, "luminosite": 100}},
    {"id": "tv_salon", "nom": "Télévision du salon", "type": "tv", "etat": {"allume": False, "volume": 20, "chaine": 1}},
    {"id": "chauffage", "nom": "Thermostat", "type": "thermostat", "etat": {"allume": True, "temperature": 20}},
    {"id": "volet_salon", "nom": "Volet du salon", "type": "volet", "etat": {"position": 100}},
    {"id": "porte_entree", "nom": "Porte d'entrée", "type": "serrure", "etat": {"verrouille": True}},
]


def _number(parameters: dict[str, Any], key: str, lo: float, hi: float) -> float:
    if key not in parameters:
        raise DeviceError(f"Paramètre « {key} » manquant.")
    try:
        value = float(parameters[key])
    except (TypeError, ValueError):
        raise DeviceError(f"Paramètre « {key} » doit être un nombre.") from None
    if not lo <= value <= hi:
        raise DeviceError(f"« {key} » doit être entre {lo:g} et {hi:g}.")
    return int(value) if value.is_integer() else value


class SimulatedBackend(Backend):
    prefix = "sim"

    def __init__(self, path: Path):
        self.path = path
        if path.exists():
            self.devices: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
        else:
            self.devices = json.loads(json.dumps(DEFAULT_DEVICES))
            self._save()

    def _save(self) -> None:
        self.path.write_text(json.dumps(self.devices, ensure_ascii=False, indent=2), encoding="utf-8")

    def list_devices(self) -> list[Device]:
        return [
            Device(
                id=f"{self.prefix}:{d['id']}",
                name=d["nom"],
                type=d["type"],
                state=d.get("etat", {}),
                actions=ACTIONS.get(d["type"], []),
            )
            for d in self.devices
        ]

    def control(self, device_id: str, action: str, parameters: dict[str, Any]) -> str:
        dev = next((d for d in self.devices if d["id"] == device_id), None)
        if dev is None:
            raise DeviceError(f"Appareil « {device_id} » introuvable.")
        allowed = ACTIONS.get(dev["type"], [])
        if action not in allowed:
            raise DeviceError(f"Action « {action} » impossible sur {dev['nom']}. Actions possibles : {', '.join(allowed)}.")

        st = dev.setdefault("etat", {})
        if action == "allumer":
            st["allume"] = True
        elif action == "eteindre":
            st["allume"] = False
        elif action == "basculer":
            st["allume"] = not st.get("allume", False)
        elif action == "regler_luminosite":
            st["luminosite"] = _number(parameters, "luminosite", 0, 100)
            st["allume"] = st["luminosite"] > 0
        elif action == "regler_couleur":
            if "couleur" not in parameters:
                raise DeviceError("Paramètre « couleur » manquant.")
            st["couleur"] = str(parameters["couleur"])
            st["allume"] = True
        elif action == "regler_volume":
            st["volume"] = _number(parameters, "volume", 0, 100)
        elif action == "changer_chaine":
            st["chaine"] = _number(parameters, "chaine", 1, 999)
        elif action == "regler_temperature":
            st["temperature"] = _number(parameters, "temperature", 5, 30)
        elif action == "ouvrir":
            st["position"] = 100
        elif action == "fermer":
            st["position"] = 0
        elif action == "regler_position":
            st["position"] = _number(parameters, "position", 0, 100)
        elif action == "jouer":
            st["lecture"] = True
            st["allume"] = True
        elif action == "pause":
            st["lecture"] = False
        elif action == "verrouiller":
            st["verrouille"] = True
        elif action == "deverrouiller":
            st["verrouille"] = False

        self._save()
        return f"{dev['nom']} : {action} effectué. Nouvel état : {json.dumps(st, ensure_ascii=False)}"
