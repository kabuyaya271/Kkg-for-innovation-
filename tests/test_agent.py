"""Tests sans clé API : le client Claude est remplacé par un faux client scripté."""

from types import SimpleNamespace as NS

import json

from agent_appareils.agent import DeviceAgent
from agent_appareils.backends.computer import ComputerBackend
from agent_appareils.backends.simulated import SimulatedBackend


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.calls.append(kw)
        return self.responses.pop(0)


def tool_use(id_, name, inp):
    return NS(type="tool_use", id=id_, name=name, input=inp)


def text(t):
    return NS(type="text", text=t)


def test_sim_backend_controls_and_persists(tmp_path):
    path = tmp_path / "d.json"
    b = SimulatedBackend(path)
    b.control("lampe_salon", "regler_luminosite", {"luminosite": 40})
    data = json.loads(path.read_text())
    lampe = next(d for d in data if d["id"] == "lampe_salon")
    assert lampe["etat"] == {"allume": True, "luminosite": 40}


def test_agent_loop_runs_tools_and_returns_text(tmp_path):
    sim = SimulatedBackend(tmp_path / "d.json")
    fake = FakeClient([
        NS(stop_reason="tool_use", content=[tool_use("t1", "list_devices", {})]),
        NS(stop_reason="tool_use", content=[
            tool_use("t2", "control_device", {"device_id": "sim:lampe_salon", "action": "allumer"}),
            tool_use("t3", "control_device", {"device_id": "sim:tv_salon", "action": "voler"}),
        ]),
        NS(stop_reason="end_turn", content=[text("Lampe allumée.")]),
    ])
    agent = DeviceAgent([sim], confirm=lambda q: True, client=fake)
    assert agent.ask("allume le salon") == "Lampe allumée."

    assert sim.devices[0]["etat"]["allume"] is True
    # Les deux résultats sont renvoyés dans un seul message, l'erreur marquée is_error.
    results = agent.messages[4]["content"]  # 2e message de résultats d'outils
    assert [r["is_error"] for r in results] == [False, True]
    assert fake.calls[0]["model"] == "claude-opus-5-5"


def test_sensitive_action_needs_confirmation(tmp_path):
    sim = SimulatedBackend(tmp_path / "d.json")
    fake = FakeClient([
        NS(stop_reason="tool_use", content=[
            tool_use("t1", "control_device", {"device_id": "sim:porte_entree", "action": "deverrouiller"})
        ]),
        NS(stop_reason="end_turn", content=[text("Annulé.")]),
    ])
    agent = DeviceAgent([sim], confirm=lambda q: False, client=fake)
    agent.ask("ouvre la porte")
    porte = next(d for d in sim.devices if d["id"] == "porte_entree")
    assert porte["etat"]["verrouille"] is True


def test_computer_shell_command_refused_without_confirmation():
    pc = ComputerBackend(confirm=lambda q: False)
    assert pc.control("ordinateur", "executer_commande", {"commande": "echo hi"}) == "Action annulée par l'utilisateur."
    pc_ok = ComputerBackend(confirm=lambda q: True)
    assert pc_ok.control("ordinateur", "executer_commande", {"commande": "echo hi"}) == "hi"
