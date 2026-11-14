"""Lancement : python -m agent_appareils [--voix | --serveur] [--sans-pc] [--simulation] [--config config.json]"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import anthropic

from .agent import DeviceAgent
from .backends import Backend, DeviceError
from .backends.android import AndroidBackend
from .backends.computer import ComputerBackend
from .backends.iphone import IPhoneBackend
from .backends.simulated import SimulatedBackend
from .backends.tv import LGTV, RokuTV, SamsungTV


# En mode serveur (ordres venant de l'iPhone), personne n'est devant l'ordinateur pour confirmer.
REMOTE = {"actif": False, "autoriser_actions_sensibles": False}


def confirm(question: str) -> bool:
    if REMOTE["actif"]:
        allowed = REMOTE["autoriser_actions_sensibles"]
        print(f"  ⚠️  {question} — {'autorisé' if allowed else 'refusé'} (ordre à distance)")
        return allowed
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


def load_config(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"{path} n'est pas un JSON valide : {e}")


def backend_from_config(dev: dict) -> Backend:
    """Crée le backend d'un appareil déclaré dans config.json."""
    dev_id, name = dev["id"], dev.get("nom", dev["id"])
    kind, addr, mac = dev.get("type", ""), dev.get("adresse", ""), dev.get("mac", "")
    if kind in {"android", "telephone"}:
        return AndroidBackend(dev_id, name, addr, kind="telephone", confirm=confirm)
    if kind == "iphone":
        return IPhoneBackend(dev_id, name, dev.get("sujet_ntfy", ""), dev.get("serveur_ntfy", "https://ntfy.sh"))
    if kind == "tv":
        brand = dev.get("marque", "").lower()
        if brand in {"android", "google", "googletv", "androidtv"}:
            return AndroidBackend(dev_id, name, addr, kind="tv", confirm=confirm, mac=mac)
        if brand == "samsung":
            return SamsungTV(dev_id, name, addr, mac)
        if brand == "lg":
            return LGTV(dev_id, name, addr, mac, secure=dev.get("securise", True))
        if brand == "roku":
            return RokuTV(dev_id, name, addr, mac)
        raise DeviceError(f"marque de TV « {brand} » inconnue (samsung, lg, roku, android)")
    raise DeviceError(f"type « {kind} » inconnu (android, iphone, tv)")


def build_backends(args: argparse.Namespace, config: dict) -> list[Backend]:
    backends: list[Backend] = []

    for dev in config.get("appareils", []):
        try:
            backends.append(backend_from_config(dev))
            print(f"✓ {dev.get('nom', dev.get('id'))}")
        except (DeviceError, KeyError) as e:
            print(f"✗ {dev.get('nom', dev.get('id', '?'))} ignoré : {e}")

    ha = config.get("home_assistant", {})
    ha_url, ha_token = os.environ.get("HA_URL") or ha.get("url"), os.environ.get("HA_TOKEN") or ha.get("token")
    if ha_url and ha_token:
        from .backends.home_assistant import HomeAssistantBackend

        backends.append(HomeAssistantBackend(ha_url, ha_token))
        print("✓ Home Assistant :", ha_url)

    nothing_configured = not backends
    if not args.sans_pc:
        backends.append(ComputerBackend(confirm))
        print("✓ Cet ordinateur")

    # Appareils simulés : pour essayer, quand ni téléphone ni TV ne sont configurés.
    if args.simulation or nothing_configured:
        path = Path(os.environ.get("SIM_DEVICES_FILE", "devices.json"))
        backends.append(SimulatedBackend(path))
        print(f"✓ Appareils simulés (démo) : {path}")
    return backends


def main() -> None:
    parser = argparse.ArgumentParser(description="Agent IA qui pilote vos appareils.")
    parser.add_argument("--voix", action="store_true", help="parler au lieu d'écrire (micro)")
    parser.add_argument("--serveur", action="store_true", help="recevoir les ordres depuis l'iPhone / Siri")
    parser.add_argument("--sans-pc", action="store_true", help="ne pas piloter cet ordinateur")
    parser.add_argument("--simulation", action="store_true", help="ajouter les appareils simulés (démo)")
    parser.add_argument("--config", default=os.environ.get("AGENT_CONFIG", "config.json"), help="fichier de configuration")
    parser.add_argument("commande", nargs="*", help="une commande unique, ex. « allume la lampe du salon »")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    backends = build_backends(args, config)
    if not backends:
        sys.exit("Aucun appareil configuré.")
    agent = DeviceAgent(backends, confirm=confirm, on_tool=show_tool)

    def answer(text: str) -> str:
        try:
            return agent.ask(text)
        except anthropic.AuthenticationError:
            return "Clé API Claude invalide : vérifiez ANTHROPIC_API_KEY sur l'ordinateur."
        except anthropic.APIConnectionError:
            return "Connexion à Claude impossible, réessayez."
        except anthropic.APIStatusError as e:
            return f"Erreur de l'API Claude ({e.status_code}), réessayez."

    def run(text: str) -> None:
        print(f"🤖 {answer(text)}\n")

    if args.serveur:
        from .server import load_or_create_key, serve

        conf = config.get("serveur", {})
        REMOTE["actif"] = True
        REMOTE["autoriser_actions_sensibles"] = bool(conf.get("autoriser_actions_sensibles", False))
        key = os.environ.get("AGENT_CLE") or conf.get("cle") or load_or_create_key(Path(".cle_serveur"))
        serve(answer, agent.reset, key, int(conf.get("port", 8765)))
        return

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
