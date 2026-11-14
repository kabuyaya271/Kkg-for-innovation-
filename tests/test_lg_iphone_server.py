"""Tests de la TV LG (contrôles simulés), de l'iPhone (ntfy simulé) et du serveur Siri."""

import json
import sys
import threading
import types
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import httpx
import pytest

from agent_appareils.backends import DeviceError
from agent_appareils.backends.iphone import IPhoneBackend
from agent_appareils.server import make_handler

# pywebostv n'est pas forcément installé : un faux module suffit à construire LGTV.
sys.modules.setdefault("pywebostv", types.ModuleType("pywebostv"))
from agent_appareils.backends.tv import LGTV  # noqa: E402


class Recorder:
    def __init__(self, log, prefix, returns=None):
        self.log, self.prefix, self.returns = log, prefix, returns or {}

    def __getattr__(self, name):
        def call(*args, **kw):
            self.log.append((f"{self.prefix}.{name}", args, kw))
            return self.returns.get(name)

        return call


@pytest.fixture
def lg():
    log = []
    apps = [{"id": "netflix", "title": "Netflix"}, {"id": "youtube.leanback.v4", "title": "YouTube"},
            {"id": "com.webos.app.browser", "title": "Web Browser"}]
    ctl = {
        "media": Recorder(log, "media", {"get_volume": {"volumeStatus": {"volume": 12, "muteStatus": False}}}),
        "system": Recorder(log, "system"),
        "app": Recorder(log, "app", {"list_apps": apps}),
        "tv": Recorder(log, "tv", {"channel_list": {"channelList": [{"channelNumber": "5", "channelId": "c5", "channelName": "M6"}]}}),
        "source": Recorder(log, "source"),
        "input": Recorder(log, "input"),
    }
    tv = LGTV("tv", "TV LG", "192.168.1.30", mac="AA:BB:CC:DD:EE:FF")
    tv._controls = lambda: ctl
    return tv, log


def test_lg_volume_apps_channels(lg):
    tv, log = lg
    tv.control("tv", "regler_volume", {"volume": 25})
    assert ("media.set_volume", (25,), {}) in log
    tv.control("tv", "ouvrir_application", {"application": "netflix"})
    assert log[-1][0] == "app.launch" and log[-1][1][0]["id"] == "netflix"
    tv.control("tv", "changer_chaine", {"chaine": "5"})
    assert ("tv.set_channel_with_id", ("c5",), {}) in log
    tv.control("tv", "couper_son", {})
    assert ("media.mute", (True,), {}) in log  # lu au format webOS récent (volumeStatus)
    assert tv.list_devices()[0].state == {"joignable": True, "volume": 12, "muet": False}


def test_lg_power_on_uses_wake_on_lan(lg, monkeypatch):
    tv, _ = lg
    sent = []
    monkeypatch.setattr("agent_appareils.backends.tv.wake_on_lan", lambda mac: sent.append(mac))
    tv.control("tv", "allumer", {})
    assert sent == ["AA:BB:CC:DD:EE:FF"]


def test_iphone_notification_and_ring():
    reqs = []
    phone = IPhoneBackend("iphone", "Mon iPhone", "maison-secret-123")
    phone.http = httpx.Client(base_url="https://ntfy.test", transport=httpx.MockTransport(
        lambda r: reqs.append(r) or httpx.Response(200)))
    phone.control("iphone", "envoyer_notification", {"message": "Le linge est prêt", "titre": "Maison"})
    phone.control("iphone", "faire_sonner", {})
    first, ring = (json.loads(r.content) for r in reqs)
    assert first == {"topic": "maison-secret-123", "message": "Le linge est prêt", "priority": 3, "title": "Maison"}
    assert ring["priority"] == 5 and ring["title"].startswith("📍")
    with pytest.raises(DeviceError):
        phone.control("iphone", "ouvrir_application", {"application": "WhatsApp"})


def test_iphone_rejects_short_topic():
    with pytest.raises(DeviceError):
        IPhoneBackend("iphone", "Mon iPhone", "abc")


def test_server_requires_key_and_answers():
    asked = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(lambda t: asked.append(t) or "TV allumée.", lambda: None, "cle-secrete"))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/commande"

    def post(key):
        req = urllib.request.Request(url, data=json.dumps({"texte": "allume la télé"}).encode(),
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())

    try:
        with pytest.raises(urllib.error.HTTPError) as e:
            post("mauvaise")
        assert e.value.code == 401 and asked == []
        assert post("cle-secrete") == {"reponse": "TV allumée."}
        assert asked == ["allume la télé"]
    finally:
        server.shutdown()
