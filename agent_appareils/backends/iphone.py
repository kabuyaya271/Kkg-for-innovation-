"""iPhone : notifications et sonnerie via l'application gratuite « ntfy ».

Apple n'autorise aucun programme extérieur à piloter un iPhone (ouvrir une appli, régler le
volume, appeler...). Ce que l'agent peut faire, c'est lui ENVOYER des notifications :
messages, rappels, et une alerte urgente qui sonne même en mode silencieux
(si vous l'autorisez dans ntfy) — pratique pour retrouver le téléphone.

Pour piloter vos appareils DEPUIS l'iPhone (avec Siri), voir server.py et le README.

Configuration :
  1. Installez « ntfy » depuis l'App Store.
  2. Dans l'appli, abonnez-vous à un « sujet » (topic) au nom long et secret,
     ex. maison-kkg-7f3a9c2e (toute personne connaissant ce nom peut vous écrire).
  3. Mettez ce nom dans config.json : "sujet_ntfy": "maison-kkg-7f3a9c2e".
"""

from __future__ import annotations

from typing import Any

import httpx

from .base import Device, DeviceError, SingleDeviceBackend

ACTIONS = ["envoyer_notification", "faire_sonner"]
PARAMS_HELP = {
    "envoyer_notification": "message (obligatoire), titre (facultatif), urgent: true/false, lien: URL à ouvrir au toucher",
    "faire_sonner": "message (facultatif) — alerte urgente pour retrouver l'iPhone",
}


class IPhoneBackend(SingleDeviceBackend):
    def __init__(self, device_id: str, name: str, topic: str, server: str = "https://ntfy.sh"):
        super().__init__(device_id, name)
        if not topic or len(topic) < 8:
            raise DeviceError("« sujet_ntfy » manquant ou trop court (8 caractères minimum, gardez-le secret).")
        self.topic = topic
        self.http = httpx.Client(base_url=server.rstrip("/"), timeout=10)

    def list_devices(self) -> list[Device]:
        state = {"pilotable": "notifications uniquement (Apple interdit le contrôle à distance)"}
        return [Device(self.device_id, self.name, "iphone", state, ACTIONS, PARAMS_HELP)]

    def _send(self, message: str, title: str = "", priority: int = 3, tags: str = "", click: str = "") -> None:
        # Publication JSON : accepte accents et emojis (les en-têtes HTTP, eux, sont limités à l'ASCII).
        payload: dict[str, Any] = {"topic": self.topic, "message": message, "priority": priority}
        if title:
            payload["title"] = title
        if tags:
            payload["tags"] = [tags]
        if click:
            payload["click"] = click
        try:
            r = self.http.post("/", json=payload)
        except httpx.HTTPError as e:
            raise DeviceError(f"Envoi impossible vers l'iPhone : {e}") from e
        if r.status_code >= 400:
            raise DeviceError(f"Le service de notification a répondu {r.status_code} : {r.text[:200]}")

    def control(self, device_id: str, action: str, p: dict[str, Any]) -> str:
        if action == "envoyer_notification":
            message = str(p.get("message", "")).strip()
            if not message:
                raise DeviceError("Paramètre « message » manquant.")
            urgent = str(p.get("urgent", "")).lower() in {"true", "1", "oui"}
            self._send(message, str(p.get("titre", "")), 5 if urgent else 3, click=str(p.get("lien", "")))
            return f"Notification envoyée sur {self.name}."
        if action == "faire_sonner":
            message = str(p.get("message") or "Votre iPhone est ici !")
            self._send(message, "📍 Retrouver mon iPhone", 5, tags="rotating_light")
            return f"{self.name} : alerte urgente envoyée (il sonne si les alertes urgentes ntfy sont autorisées)."
        raise DeviceError(f"Action « {action} » impossible sur un iPhone. Actions : {', '.join(ACTIONS)}.")
