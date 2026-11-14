"""Lancement : python -m agent_appareils [--voix] [--sans-pc] [--sans-simulation]"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import anthropic

from .agent import DeviceAgent
from .backends import Backend
from .backends.computer import ComputerBackend
from .backends.simulated import SimulatedBackend


def confirm(question: str) -> bool:
    try:
        return input(f"  ⚠️  {question} — confirmer ? (o/N) ").strip().lower() in {"o", "oui", "y", "yes"}
    except EOFError:
        return False


def show_tool(name: str, args: dict, result: str) -> None:
    if name == "control_device":
        print(f"  → {args.get('device_id')} : {args.get('action')} {args.get('parameters') or ''}")
        if result.startswith("Erreur"):
            print(f"    {result}")


def listen_voice():
    """Renvoie une fonction qui écoute le micro et renvoie le texte reconnu (français)."""
    try:
        import speech_recognition as sr
    except ImportError:
        sys.exit("Mode voix : installez d'abord  pip install SpeechRecognition pyaudio")
    recognizer = sr.Recognizer()

    def listen() -> str:
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            print("🎤 Je vous écoute...")
            audio = recognizer.listen(source, phrase_time_limit=10)
        try:
            text = recognizer.recognize_google(audio, language="fr-FR")
        except sr.UnknownValueError:
            return ""
        print(f"Vous : {text}")
        return text

    return listen


def build_backends(args: argparse.Namespace) -> list[Backend]:
    backends: list[Backend] = []
    if os.environ.get("HA_URL") and os.environ.get("HA_TOKEN"):
        from .backends.home_assistant import HomeAssistantBackend

        backends.append(HomeAssistantBackend(os.environ["HA_URL"], os.environ["HA_TOKEN"]))
        print("✓ Home Assistant connecté :", os.environ["HA_URL"])
    if not args.sans_simulation:
        path = Path(os.environ.get("SIM_DEVICES_FILE", "devices.json"))
        backends.append(SimulatedBackend(path))
        print(f"✓ Appareils simulés : {path}")
    if not args.sans_pc:
        backends.append(ComputerBackend(confirm))
        print("✓ Contrôle de cet ordinateur activé")
    return backends


def main() -> None:
    parser = argparse.ArgumentParser(description="Agent IA qui pilote vos appareils.")
    parser.add_argument("--voix", action="store_true", help="parler au lieu d'écrire (micro)")
    parser.add_argument("--sans-pc", action="store_true", help="ne pas piloter cet ordinateur")
    parser.add_argument("--sans-simulation", action="store_true", help="désactiver les appareils simulés")
    parser.add_argument("commande", nargs="*", help="une commande unique, ex. « allume la lampe du salon »")
    args = parser.parse_args()

    backends = build_backends(args)
    if not backends:
        sys.exit("Aucun appareil configuré.")
    agent = DeviceAgent(backends, confirm=confirm, on_tool=show_tool)

    def run(text: str) -> None:
        try:
            print(f"🤖 {agent.ask(text)}\n")
        except anthropic.AuthenticationError:
            sys.exit("Clé API invalide : définissez ANTHROPIC_API_KEY.")
        except anthropic.APIConnectionError:
            print("🤖 Connexion à Claude impossible, réessayez.\n")
        except anthropic.APIStatusError as e:
            print(f"🤖 Erreur de l'API ({e.status_code}), réessayez.\n")

    if args.commande:
        run(" ".join(args.commande))
        return

    listen = listen_voice() if args.voix else None
    print("\nDites-moi quoi faire (« aide », « oublie » pour repartir de zéro, « quitter »).\n")
    while True:
        try:
            text = listen() if listen else input("Vous : ")
        except (EOFError, KeyboardInterrupt):
            print()
            break
        text = text.strip()
        if not text:
            continue
        if text.lower() in {"quitter", "exit", "quit", "au revoir"}:
            break
        if text.lower() == "oublie":
            agent.reset()
            print("🤖 Conversation effacée.\n")
            continue
        if text.lower() == "aide":
            text = "Liste mes appareils et dis-moi en bref ce que tu peux faire avec."
        run(text)


if __name__ == "__main__":
    main()
