"""Interface commune à tous les « backends » d'appareils."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Device:
    """Description d'un appareil telle que l'agent la voit."""

    id: str
    name: str
    type: str
    state: dict[str, Any] = field(default_factory=dict)
    actions: list[str] = field(default_factory=list)
    #: aide sur les paramètres, ex. {"regler_volume": "volume: 0-100"}
    params_help: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = {
            "id": self.id,
            "nom": self.name,
            "type": self.type,
            "etat": self.state,
            "actions_possibles": self.actions,
        }
        if self.params_help:
            d["parametres"] = self.params_help
        return d


class DeviceError(Exception):
    """Erreur lisible renvoyée à l'agent (appareil inconnu, action invalide...)."""


class Backend(ABC):
    """Un backend gère un groupe d'appareils (maison connectée, ordinateur...)."""

    #: préfixe unique ajouté aux identifiants, ex. "ha" -> "ha:light.salon"
    prefix: str = ""

    @abstractmethod
    def list_devices(self) -> list[Device]: ...

    @abstractmethod
    def control(self, device_id: str, action: str, parameters: dict[str, Any]) -> str:
        """Exécute l'action et renvoie une phrase décrivant le résultat."""

    def owns(self, full_id: str) -> bool:
        return full_id.startswith(self.prefix + ":")

    def local_id(self, full_id: str) -> str:
        return full_id.split(":", 1)[1]


class SingleDeviceBackend(Backend):
    """Backend qui représente un seul appareil (téléphone, TV...), identifié par son id de config."""

    def __init__(self, device_id: str, name: str):
        self.device_id = device_id
        self.name = name
        self.prefix = device_id

    def owns(self, full_id: str) -> bool:
        return full_id == self.device_id

    def local_id(self, full_id: str) -> str:
        return full_id
