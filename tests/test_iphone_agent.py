"""Tests du cerveau de l'agent iPhone (requête envoyée par le raccourci, lecture du plan)."""

import json
from pathlib import Path
from types import SimpleNamespace as NS

from agent_appareils import iphone_agent as ia

IPHONE_DIR = Path(__file__).resolve().parent.parent / "iphone"


def test_templates_up_to_date_and_fillable(tmp_path):
    # Les fichiers du dépôt doivent correspondre au code (sinon : --generer).
    for fresh in ia.generate_templates(tmp_path):
        committed = IPHONE_DIR / fresh.name
        assert committed.read_text(encoding="utf-8") == fresh.read_text(encoding="utf-8"), f"régénérer {fresh.name}"
        raw = committed.read_text(encoding="utf-8")
        assert raw.count(ia.PLACEHOLDER) == 1
        # Ce que fait le raccourci : remplacer le repère par la phrase dictée (guillemets " remplacés par ').
        body = json.loads(raw.replace(ia.PLACEHOLDER, "dis à l'équipe « j'arrive » et mets le son à 30"))
        assert body["model"] == "claude-opus-5-5"
        assert body["messages"][0]["content"].startswith("dis à l'équipe")


def test_essential_is_subset_and_schema_matches_prompt():
    assert set(ia.ESSENTIAL) <= set(ia.ACTIONS)
    req = ia.build_request("x", ia.ESSENTIAL)
    enum = req["output_config"]["format"]["schema"]["properties"]["actions"]["items"]["properties"]["type"]["enum"]
    assert enum == ia.ESSENTIAL
    assert "- wifi" not in req["system"] and "- lampe" in req["system"]


def test_extract_plan_skips_thinking_and_fallback_blocks():
    content = [
        {"type": "thinking", "thinking": "", "signature": "x"},
        {"type": "fallback"},
        {"type": "text", "text": '{"actions": [{"type": "lampe", "valeur": "on", "destinataire": "", "texte": ""}], "reponse": "J\'allume la lampe."}'},
    ]
    assert ia.extract_plan(content)["actions"][0]["valeur"] == "on"


def test_plan_uses_fallback_beta_and_handles_refusal():
    calls = []

    def create(**kw):
        calls.append(kw)
        if len(calls) == 1:
            return NS(stop_reason="end_turn", content=[NS(type="text", text='{"actions": [], "reponse": "Il est midi."}')])
        return NS(stop_reason="refusal", content=[])

    client = NS(beta=NS(messages=NS(create=create)))
    assert ia.plan("quelle heure", client) == {"actions": [], "reponse": "Il est midi."}
    assert calls[0]["betas"] == [ia.FALLBACK_BETA] and calls[0]["fallbacks"] == "default"
    assert ia.plan("autre", client)["actions"] == []
