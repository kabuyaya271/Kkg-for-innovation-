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

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "nom": self.name,
            "type": self.type,
            "etat": self.state,
            "actions_possibles": self.actions,
        }


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
