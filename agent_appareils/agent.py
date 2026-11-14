"""Cœur de l'agent : Claude + outils de pilotage des appareils."""

from __future__ import annotations

import json
import os
from typing import Any, Callable

import anthropic

from .backends import Backend, DeviceError

MODEL = os.environ.get("AGENT_MODEL", "claude-opus-5-5")
# Les commandes d'appareils sont simples : effort bas = réponses rapides.
# Mettre "medium" ou "high" pour des demandes plus complexes (scénarios, routines...).
EFFORT = os.environ.get("AGENT_EFFORT", "low")

SYSTEM_PROMPT = """Tu es l'assistant domotique personnel de l'utilisateur. Tu pilotes ses appareils \
(téléphone, Smart TV, ordinateur, et maison connectée : lumières, chauffage, volets...) à partir de ce qu'il te dit, \
en français, à l'écrit ou à la voix.

Façon de travailler :
- Si tu ne connais pas encore les appareils, ou si un identifiant ne correspond pas, appelle list_devices.
- Associe les mots de l'utilisateur au bon appareil (« la lumière du salon » -> l'appareil lumière du salon), \
puis appelle control_device avec une action de sa liste « actions_possibles ».
- Une demande peut viser plusieurs appareils (« éteins tout », « mode cinéma ») : fais tous les appels nécessaires.
- Si la demande est vraiment ambiguë (plusieurs appareils possibles et aucun indice), pose une courte question.
- N'invente jamais un appareil ni un résultat : appuie-toi sur ce que renvoient les outils. \
Si une action échoue, dis-le simplement.
- Réponds en une ou deux phrases courtes : ce qui a été fait, ou ce qui bloque.

Paramètres de control_device : regarde le champ « parametres » renvoyé par list_devices pour chaque appareil. \
Pour les touches répétables (volume_haut, volume_bas...), utilise le paramètre « fois » plutôt que plusieurs appels. \
Appareils "ha:..." (Home Assistant) : champs du service, ex. brightness_pct, temperature, volume_level (0.0-1.0).
Si un appareil n'est pas joignable (éteint, hors Wi-Fi), dis-le à l'utilisateur."""

TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_devices",
        "description": (
            "Liste tous les appareils disponibles avec leur identifiant, leur type, leur état actuel "
            "et les actions possibles. À appeler avant de piloter un appareil dont on ne connaît pas l'identifiant."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "control_device",
        "description": (
            "Exécute une action sur un appareil (allumer, éteindre, régler le volume, la température...). "
            "Renvoie le nouvel état ou un message d'erreur."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    "type": "string",
                    "description": "Identifiant complet de l'appareil tel que renvoyé par list_devices, ex. 'sim:lampe_salon'.",
                },
                "action": {
                    "type": "string",
                    "description": "Une des 'actions_possibles' de l'appareil.",
                },
                "parameters": {
                    "type": "object",
                    "description": "Paramètres de l'action, ex. {\"luminosite\": 40}. Objet vide si aucun.",
                },
            },
            "required": ["device_id", "action"],
        },
    },
]

# Actions toujours soumises à confirmation, quel que soit l'appareil.
SENSITIVE_ACTIONS = {"deverrouiller", "unlock"}


class DeviceAgent:
    def __init__(
        self,
        backends: list[Backend],
        confirm: Callable[[str], bool],
        on_tool: Callable[[str, dict[str, Any], str], None] | None = None,
        client: anthropic.Anthropic | None = None,
    ):
        self.backends = backends
        self.confirm = confirm
        self.on_tool = on_tool or (lambda name, args, result: None)
        self.client = client or anthropic.Anthropic()
        self.messages: list[dict[str, Any]] = []

    # --- outils ------------------------------------------------------------

    def _list_devices(self) -> str:
        devices, errors = [], []
        for b in self.backends:
            try:
                devices += [d.to_dict() for d in b.list_devices()]
            except DeviceError as e:
                errors.append(f"{b.prefix}: {e}")
        return json.dumps({"appareils": devices, "erreurs": errors}, ensure_ascii=False)

    def _control_device(self, device_id: str, action: str, parameters: dict[str, Any] | None = None) -> str:
        backend = next((b for b in self.backends if b.owns(device_id)), None)
        if backend is None:
            raise DeviceError(f"Appareil « {device_id} » inconnu. Appelle list_devices pour voir les identifiants.")
        if action in SENSITIVE_ACTIONS and not self.confirm(f"L'agent veut : {action} {device_id}"):
            return "Action annulée par l'utilisateur."
        return backend.control(backend.local_id(device_id), action, parameters or {})

    def _run_tool(self, name: str, args: dict[str, Any]) -> tuple[str, bool]:
        try:
            if name == "list_devices":
                result = self._list_devices()
            elif name == "control_device":
                params = args.get("parameters") or {}
                if not isinstance(params, dict):
                    raise DeviceError("« parameters » doit être un objet JSON.")
                result = self._control_device(str(args.get("device_id", "")), str(args.get("action", "")), params)
            else:
                raise DeviceError(f"Outil inconnu : {name}")
            ok = True
        except DeviceError as e:
            result, ok = f"Erreur : {e}", False
        self.on_tool(name, args, result)
        return result, ok

    # --- boucle agent ------------------------------------------------------

    def ask(self, user_text: str, max_turns: int = 15) -> str:
        """Envoie une demande de l'utilisateur et renvoie la réponse finale de l'agent."""
        self.messages.append({"role": "user", "content": user_text})

        for _ in range(max_turns):
            response = self.client.beta.messages.create(
                model=MODEL,
                max_tokens=16000,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=self.messages,
                output_config={"effort": EFFORT},
                # Si un filtre de sécurité refuse à tort, la requête est rejouée sur un autre modèle.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                cache_control={"type": "ephemeral"},
            )
            # On garde le contenu complet (y compris les blocs de réflexion) dans l'historique.
            self.messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "pause_turn":
                continue
            if response.stop_reason == "refusal":
                return "Désolé, je ne peux pas faire cela."

            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if response.stop_reason == "tool_use" and tool_uses:
                results = []
                for tu in tool_uses:
                    args = tu.input if isinstance(tu.input, dict) else {}
                    content, ok = self._run_tool(tu.name, args)
                    results.append(
                        {"type": "tool_result", "tool_use_id": tu.id, "content": content, "is_error": not ok}
                    )
                # Tous les résultats dans un seul message utilisateur.
                self.messages.append({"role": "user", "content": results})
                continue

            text = "".join(b.text for b in response.content if b.type == "text").strip()
            if response.stop_reason == "max_tokens":
                text += " (réponse tronquée)"
            return text or "C'est fait."

        return "Je me suis arrêté : trop d'étapes pour cette demande."

    def reset(self) -> None:
        self.messages.clear()
