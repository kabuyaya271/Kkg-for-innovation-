"""Tests du téléphone (ADB simulé) et des TV (réseau simulé)."""

import httpx
import pytest

from agent_appareils.backends import DeviceError
from agent_appareils.backends.android import AndroidBackend
from agent_appareils.backends.tv import RokuTV, wake_on_lan


class FakeAndroid(AndroidBackend):
    def __init__(self, **kw):
        super().__init__("telephone", "Mon téléphone", confirm=kw.pop("confirm", lambda q: True), **kw)
        self.sent: list[str] = []

    def _shell(self, command, timeout=20):
        self.sent.append(command)
        if command == "pm list packages":
            return "package:com.whatsapp\npackage:com.google.android.youtube\npackage:org.videolan.vlc"
        if "media_session volume --stream 3 --get" in command:
            return "volume is 3 in range [0..15]"
        return ""


def test_phone_open_app_by_alias_and_fuzzy():
    ph = FakeAndroid()
    ph.control("telephone", "ouvrir_application", {"application": "YouTube"})
    assert "monkey -p com.google.android.youtube" in ph.sent[-1]
    ph.control("telephone", "ouvrir_application", {"application": "VLC"})
    assert "org.videolan.vlc" in ph.sent[-1]
    with pytest.raises(DeviceError):
        ph.control("telephone", "ouvrir_application", {"application": "Inexistante"})


def test_phone_volume_scaled_to_device_range():
    ph = FakeAndroid()
    ph.control("telephone", "regler_volume", {"volume": 60})
    assert ph.sent[-1] == "cmd media_session volume --stream 3 --set 9"


def test_phone_key_repeated_and_call_needs_confirmation():
    ph = FakeAndroid(confirm=lambda q: False)
    ph.control("telephone", "volume_haut", {"fois": 3})
    assert ph.sent[-1].count("input keyevent 24") == 3
    assert ph.control("telephone", "appeler", {"numero": "0612345678"}) == "Action annulée par l'utilisateur."
    assert not any("CALL" in c for c in ph.sent)


def test_android_tv_has_tv_actions():
    tv = FakeAndroid(kind="tv")
    tv.control("telephone", "changer_chaine", {"chaine": "12"})
    assert tv.sent[-1] == "input keyevent 8 ; input keyevent 9"
    with pytest.raises(DeviceError):
        tv.control("telephone", "appeler", {"numero": "1"})


def test_roku_launch_and_keys():
    calls = []

    def handler(req: httpx.Request):
        calls.append((req.method, req.url.path))
        if req.url.path == "/query/apps":
            return httpx.Response(200, text='<apps><app id="12">Netflix</app><app id="837">YouTube</app></apps>')
        return httpx.Response(200)

    tv = RokuTV("tv", "TV Roku", "192.168.1.30")
    tv.http = httpx.Client(base_url="http://x:8060", transport=httpx.MockTransport(handler))
    tv.control("tv", "ouvrir_application", {"application": "netflix"})
    tv.control("tv", "volume_bas", {"fois": 2})
    assert ("POST", "/launch/12") in calls
    assert calls.count(("POST", "/keypress/VolumeDown")) == 2


def test_wake_on_lan_rejects_bad_mac():
    with pytest.raises(DeviceError):
        wake_on_lan("pas-une-mac")
