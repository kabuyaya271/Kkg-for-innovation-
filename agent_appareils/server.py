"""Mode serveur : l'agent écoute sur le Wi-Fi pour recevoir des ordres depuis l'iPhone (Siri).

L'iPhone envoie   POST http://<IP-de-l-ordinateur>:8765/commande
                  En-tête  Authorization: Bearer <clé>
                  Corps    {"texte": "allume la télé"}
et reçoit         {"reponse": "La TV du salon est allumée."}

La clé empêche une autre personne du Wi-Fi d'envoyer des ordres.
"""

from __future__ import annotations

import hmac
import json
import secrets
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable

# Après ce délai sans ordre, la conversation repart de zéro.
RESET_AFTER_S = 10 * 60
MAX_BODY = 10_000


def load_or_create_key(path: Path) -> str:
    if path.exists():
        key = path.read_text(encoding="utf-8").strip()
        if key:
            return key
    key = secrets.token_urlsafe(18)
    path.write_text(key, encoding="utf-8")
    return key


def local_ip() -> str:
    """Adresse IP de l'ordinateur sur le réseau local (aucune donnée n'est envoyée)."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def make_handler(ask: Callable[[str], str], reset: Callable[[], None], key: str):
    lock = threading.Lock()
    last = [0.0]

    class Handler(BaseHTTPRequestHandler):
        def _reply(self, code: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            self._reply(200, {"etat": "ok"})

        def do_POST(self) -> None:
            if self.path.rstrip("/") != "/commande":
                return self._reply(404, {"erreur": "adresse inconnue"})
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > MAX_BODY:
                return self._reply(400, {"erreur": "requête vide ou trop longue"})
            raw = self.rfile.read(length)
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = {"texte": raw.decode("utf-8", errors="replace")}
            given = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
            given = given or str(data.get("cle", ""))
            if not hmac.compare_digest(given.encode(), key.encode()):
                return self._reply(401, {"reponse": "Clé incorrecte."})
            text = str(data.get("texte", "")).strip()
            if not text:
                return self._reply(400, {"reponse": "Je n'ai rien entendu."})

            with lock:  # un ordre à la fois
                if time.monotonic() - last[0] > RESET_AFTER_S:
                    reset()
                last[0] = time.monotonic()
                print(f"📱 {text}")
                try:
                    answer = ask(text)
                except Exception as e:  # on répond toujours quelque chose à Siri
                    print(f"   erreur : {e!r}")
                    answer = "Désolé, une erreur est survenue."
                print(f"🤖 {answer}\n")
            self._reply(200, {"reponse": answer})

        def log_message(self, *args) -> None:  # pas de journal HTTP bruyant
            pass

    return Handler


def serve(ask: Callable[[str], str], reset: Callable[[], None], key: str, port: int = 8765) -> None:
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(ask, reset, key))
    print(f"\n🌐 Agent à l'écoute sur  http://{local_ip()}:{port}/commande")
    print(f"🔑 Clé (à mettre dans le raccourci Siri) : {key}")
    print("   Ctrl+C pour arrêter.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
