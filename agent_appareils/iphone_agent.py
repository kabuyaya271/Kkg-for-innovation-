"""Agent qui pilote l'iPhone LUI-MÊME, depuis l'app Raccourcis (Shortcuts) d'Apple.

Fonctionnement :
  1. Le raccourci « Agent » de l'iPhone écoute votre phrase (dictée ou tapée).
  2. Il envoie à l'API Claude la requête de iphone/requete_*.json (générée par ce fichier).
  3. Claude renvoie un plan JSON : {"actions": [...], "reponse": "..."}.
  4. Le raccourci exécute chaque action avec les actions natives de l'iPhone,
     puis lit la réponse à voix haute.

Ce module sert de source unique pour le prompt et le format, et permet d'essayer
le « cerveau » depuis un ordinateur :

    python -m agent_appareils.iphone_agent "allume la lampe torche et mets le son à 30"
    python -m agent_appareils.iphone_agent --generer      # régénère iphone/requete_*.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

MODEL = "claude-opus-5-5"
API_VERSION = "2026-10-21"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
PLACEHOLDER = "TEXTE_DICTE"

# Catalogue des actions que le raccourci sait exécuter.
# (type, champs utilisés, explication pour Claude)
ACTIONS: dict[str, tuple[str, str]] = {
    "ouvrir": ("valeur", "Ouvre une app, un site ou un lien. valeur = une URL : https://..., ou un schéma d'app "
               "(youtube://, whatsapp://send?phone=33612345678&text=Bonjour, spotify:search:Aya%20Nakamura, "
               "instagram://, maps://?daddr=Gare%20de%20Lyon, mailto:..., music://, photos-redirect://, "
               "prefs:root=General, https://www.google.com/search?q=...). Encode les espaces en %20."),
    "appeler": ("destinataire", "Appelle quelqu'un. destinataire = numéro de téléphone ou nom du contact tel que "
                "l'utilisateur l'a dit. Le téléphone demande confirmation avant d'appeler."),
    "message": ("destinataire, texte", "Prépare un SMS/iMessage. destinataire = numéro ou nom du contact ; "
                "texte = le message. L'utilisateur le relit et appuie sur Envoyer."),
    "volume": ("valeur", "Règle le volume. valeur = nombre de 0 à 100."),
    "luminosite": ("valeur", "Règle la luminosité de l'écran. valeur = nombre de 0 à 100."),
    "lampe": ("valeur", "Lampe torche. valeur = on ou off."),
    "wifi": ("valeur", "Wi-Fi. valeur = on ou off."),
    "bluetooth": ("valeur", "Bluetooth. valeur = on ou off."),
    "concentration": ("valeur", "Mode Ne pas déranger. valeur = on ou off."),
    "minuteur": ("valeur", "Lance un minuteur. valeur = durée en minutes (nombre)."),
    "alarme": ("valeur, texte", "Crée une alarme. valeur = heure au format HH:MM (24 h) ; texte = libellé."),
    "rappel": ("texte", "Ajoute un rappel dans l'app Rappels. texte = ce qu'il faut rappeler "
               "(inclure l'échéance dans le texte si l'utilisateur en donne une)."),
    "musique": ("valeur", "Contrôle la musique en cours. valeur = lecture_pause, suivant ou precedent."),
    "photo": ("", "Prend une photo avec l'appareil photo et l'enregistre."),
    "batterie": ("", "Annonce le niveau de batterie à voix haute."),
}

# Version « essentielle » : moins d'étapes à créer dans Raccourcis.
ESSENTIAL = ["ouvrir", "appeler", "message", "volume", "luminosite", "lampe", "minuteur"]


def system_prompt(types: list[str]) -> str:
    catalog = "\n".join(f"- {t} ({ACTIONS[t][0] or 'aucun champ'}) : {ACTIONS[t][1]}" for t in types)
    return f"""Tu es l'assistant qui pilote l'iPhone de l'utilisateur. Il te parle en français (souvent \
par dictée vocale, donc avec de possibles fautes de reconnaissance). Tu traduis sa demande en une liste \
d'actions que l'iPhone exécutera, dans l'ordre, puis une courte réponse qui sera lue à voix haute.

Actions possibles (n'utilise que celles-ci) :
{catalog}

Règles :
- Chaque action a les champs type, valeur, destinataire, texte : mets une chaîne vide pour les champs inutiles.
- Une demande peut donner plusieurs actions (« mode nuit » : luminosite 10, concentration on, volume 20).
- Si aucune action ne permet de faire la demande, renvoie une liste d'actions vide et explique-le \
simplement dans la réponse. N'invente jamais un numéro de téléphone.
- Si la demande est une simple question (heure, conseil, calcul...), réponds dans « reponse » sans action.
- « reponse » : une ou deux phrases courtes, naturelles à l'oral, sans emoji ni mise en forme, au présent \
(« J'allume la lampe et je règle le son à 30 %. »)."""


def output_schema(types: list[str]) -> dict[str, Any]:
    action = {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": types},
            "valeur": {"type": "string"},
            "destinataire": {"type": "string"},
            "texte": {"type": "string"},
        },
        "required": ["type", "valeur", "destinataire", "texte"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {"actions": {"type": "array", "items": action}, "reponse": {"type": "string"}},
        "required": ["actions", "reponse"],
        "additionalProperties": False,
    }


def build_request(text: str, types: list[str] | None = None) -> dict[str, Any]:
    """Corps de la requête POST https://api.anthropic.com/v1/messages envoyée par l'iPhone."""
    types = types or list(ACTIONS)
    return {
        "model": MODEL,
        "max_tokens": 4000,
        "system": system_prompt(types),
        "messages": [{"role": "user", "content": text}],
        # Effort bas : réponses rapides, suffisant pour des ordres de ce type.
        "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": output_schema(types)}},
        # Si un filtre de sécurité refuse à tort, l'API rejoue la demande sur un autre modèle.
        "fallbacks": "default",
    }


def generate_templates(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, types in (("complete", list(ACTIONS)), ("essentielle", ESSENTIAL)):
        path = out_dir / f"requete_{name}.json"
        path.write_text(json.dumps(build_request(PLACEHOLDER, types), ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8")
        paths.append(path)
    return paths


def extract_plan(content: list[Any]) -> dict[str, Any]:
    """Même logique que le raccourci : prendre le bloc de type « text » et le lire comme JSON."""
    for block in content:
        btype = block.get("type") if isinstance(block, dict) else getattr(block, "type", None)
        if btype == "text":
            text = block["text"] if isinstance(block, dict) else block.text
            return json.loads(text)
    raise ValueError("Aucun bloc texte dans la réponse.")


def plan(text: str, client: Any = None) -> dict[str, Any]:
    """Demande le plan à Claude (pour essayer depuis l'ordinateur)."""
    import anthropic

    client = client or anthropic.Anthropic()
    response = client.beta.messages.create(**build_request(text), betas=[FALLBACK_BETA])
    if response.stop_reason == "refusal":
        return {"actions": [], "reponse": "Je ne peux pas faire cela."}
    return extract_plan(response.content)


def main() -> None:
    parser = argparse.ArgumentParser(description="Cerveau de l'agent iPhone (Raccourcis).")
    parser.add_argument("--generer", action="store_true", help="régénérer iphone/requete_*.json")
    parser.add_argument("phrase", nargs="*", help="phrase à essayer, ex. « allume la lampe torche »")
    args = parser.parse_args()
    if args.generer:
        for p in generate_templates(Path(__file__).resolve().parent.parent / "iphone"):
            print(f"✓ {p}")
        return
    if not args.phrase:
        sys.exit("Donnez une phrase, ex. : python -m agent_appareils.iphone_agent \"mets le son à 30\"")
    print(json.dumps(plan(" ".join(args.phrase)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
