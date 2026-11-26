"""Horloge de bureau façon « éditeur de code » pour développeur.

    python horloge_dev.py            (Windows : pythonw horloge_dev.py pour cacher la console)

- Glisser avec la souris pour la déplacer (la position est retenue).
- Clic droit : thème, format 12/24 h, secondes, toujours au premier plan, quitter.
- Double-clic : passer au thème suivant.

Uniquement la bibliothèque standard de Python (tkinter) : rien à installer.
"""

from __future__ import annotations

import json
import time
import tkinter as tk
import tkinter.font as tkfont
from datetime import datetime
from pathlib import Path

SETTINGS = Path.home() / ".horloge_dev.json"

# Palettes : fond, cadre, texte, discret, heure, mot-clé, chaîne, commentaire, nombre
THEMES = {
    "Minuit": dict(bg="#11131a", border="#2a2f3d", fg="#d7dae0", dim="#5c6370", time="#7fb4ff",
                   kw="#c792ea", str="#a5d68a", cmt="#5c6a80", num="#f5a970"),
    "Terminal": dict(bg="#050805", border="#143314", fg="#b6f2b6", dim="#3c6e3c", time="#39ff6a",
                     kw="#39ff6a", str="#d0ffb0", cmt="#2f6b2f", num="#8cff9e"),
    "Ambre": dict(bg="#140e05", border="#3a2810", fg="#ffd9a0", dim="#7a5a2e", time="#ffb000",
                  kw="#ff9a3c", str="#ffe08a", cmt="#7a5a2e", num="#ffc766"),
    "Néon": dict(bg="#0d0717", border="#3b1d5e", fg="#e9ddff", dim="#6b5a8a", time="#ff4fd8",
                 kw="#4fe3ff", str="#b8ff6b", cmt="#6b5a8a", num="#ffd84f"),
    "Papier": dict(bg="#fbf8f1", border="#d9d2c3", fg="#2b2b2b", dim="#9a9387", time="#2f5fd0",
                   kw="#a23dad", str="#3d8a2a", cmt="#9a9387", num="#c25d12"),
}
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]
PREFERRED_FONTS = ["JetBrains Mono", "Cascadia Code", "Cascadia Mono", "Fira Code", "SF Mono",
                   "Menlo", "Consolas", "DejaVu Sans Mono", "Liberation Mono", "Courier New"]


def load_settings() -> dict:
    defaults = {"theme": "Minuit", "h24": True, "secondes": True, "dessus": True, "x": None, "y": None}
    try:
        defaults.update(json.loads(SETTINGS.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        pass
    if defaults["theme"] not in THEMES:
        defaults["theme"] = "Minuit"
    return defaults


def date_line(now: datetime) -> str:
    return f"{JOURS[now.weekday()]} {now.day} {MOIS[now.month - 1]} {now.year}"


def time_text(now: datetime, h24: bool, seconds: bool) -> str:
    fmt = ("%H" if h24 else "%I") + ":%M" + (":%S" if seconds else "")
    text = now.strftime(fmt)
    return text if h24 else f"{text} {'AM' if now.hour < 12 else 'PM'}"


class DevClock:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.s = load_settings()
        self.start = time.monotonic()
        root.overrideredirect(True)  # pas de barre de titre
        root.attributes("-topmost", self.s["dessus"])
        family = next((f for f in PREFERRED_FONTS if f in set(tkfont.families())), "TkFixedFont")
        self.f_small = tkfont.Font(family=family, size=10)
        self.f_code = tkfont.Font(family=family, size=11)
        self.f_time = tkfont.Font(family=family, size=40, weight="bold")

        self.frame = tk.Frame(root, highlightthickness=1)
        self.frame.pack(fill="both", expand=True)
        self.title = tk.Text(self.frame, height=1, width=50, wrap="none", bd=0, font=self.f_small, padx=12, pady=8)
        self.clock = tk.Label(self.frame, font=self.f_time, anchor="w", padx=14)
        self.code = tk.Text(self.frame, height=2, width=50, wrap="none", bd=0, font=self.f_code, padx=14, pady=8)
        for w in (self.title, self.clock, self.code):
            w.pack(fill="x")
            w.bind("<ButtonPress-1>", self._drag_start)
            w.bind("<B1-Motion>", self._drag)
            w.bind("<ButtonRelease-1>", lambda e: self._save())
            w.bind("<Button-3>", self._menu)
            w.bind("<Button-2>", self._menu)  # clic droit sur macOS
            w.bind("<Double-Button-1>", lambda e: self._next_theme())
        for t in (self.title, self.code):
            t.configure(cursor="arrow", highlightthickness=0)

        self.apply_theme()
        root.update_idletasks()
        if self.s["x"] is None:
            self.s["x"] = root.winfo_screenwidth() - root.winfo_reqwidth() - 40
            self.s["y"] = 60
        root.geometry(f"+{self.s['x']}+{self.s['y']}")
        self.tick()

    # --- dessin ------------------------------------------------------------

    def apply_theme(self) -> None:
        c = THEMES[self.s["theme"]]
        self.root.configure(bg=c["border"])
        self.frame.configure(bg=c["bg"], highlightbackground=c["border"], highlightcolor=c["border"])
        self.clock.configure(bg=c["bg"], fg=c["time"])
        for t in (self.title, self.code):
            t.configure(bg=c["bg"], fg=c["fg"], selectbackground=c["bg"], inactiveselectbackground=c["bg"])
            for tag in ("kw", "str", "cmt", "num", "dim"):
                t.tag_configure(tag, foreground=c[tag])
            t.tag_configure("red", foreground="#ff5f57")
            t.tag_configure("yellow", foreground="#febc2e")
            t.tag_configure("green", foreground="#28c840")

    def _write(self, widget: tk.Text, parts: list[tuple[str, str]]) -> None:
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        for text, tag in parts:
            widget.insert("end", text, tag)
        widget.configure(state="disabled")

    def tick(self) -> None:
        now = datetime.now()
        blink = "▌" if now.second % 2 == 0 else " "
        self.clock.configure(text=time_text(now, self.s["h24"], self.s["secondes"]) + blink)

        up = int(time.monotonic() - self.start) // 60
        week = now.isocalendar()[1]
        day_of_year = now.timetuple().tm_yday
        self._write(self.title, [("● ", "red"), ("● ", "yellow"), ("● ", "green"), ("  ~/bureau/horloge.py", "dim")])
        self._write(self.code, [
            ("const ", "kw"), ("aujourdhui", ""), (" = ", "dim"), (f'"{date_line(now)}"', "str"), (";\n", "dim"),
            (f"// semaine {week} · jour {day_of_year} · ouvert depuis {up // 60}h{up % 60:02d}", "cmt"),
        ])
        # se recaler sur le début de la seconde suivante
        self.root.after(1000 - now.microsecond // 1000, self.tick)

    # --- interactions ------------------------------------------------------

    def _drag_start(self, e: tk.Event) -> None:
        self._dx, self._dy = e.x_root - self.root.winfo_x(), e.y_root - self.root.winfo_y()

    def _drag(self, e: tk.Event) -> None:
        self.s["x"], self.s["y"] = e.x_root - self._dx, e.y_root - self._dy
        self.root.geometry(f"+{self.s['x']}+{self.s['y']}")

    def _save(self) -> None:
        try:
            SETTINGS.write_text(json.dumps(self.s, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    def _set(self, key: str, value) -> None:
        self.s[key] = value
        if key == "dessus":
            self.root.attributes("-topmost", value)
        self.apply_theme()
        self._save()

    def _next_theme(self) -> None:
        names = list(THEMES)
        self._set("theme", names[(names.index(self.s["theme"]) + 1) % len(names)])

    def _menu(self, e: tk.Event) -> None:
        m = tk.Menu(self.root, tearoff=0)
        themes = tk.Menu(m, tearoff=0)
        for name in THEMES:
            themes.add_radiobutton(label=name, value=name, variable=tk.StringVar(value=self.s["theme"]),
                                   command=lambda n=name: self._set("theme", n))
        m.add_cascade(label="Thème", menu=themes)
        m.add_checkbutton(label="Format 24 h", onvalue=True, offvalue=False,
                          variable=tk.BooleanVar(value=self.s["h24"]), command=lambda: self._set("h24", not self.s["h24"]))
        m.add_checkbutton(label="Afficher les secondes", variable=tk.BooleanVar(value=self.s["secondes"]),
                          command=lambda: self._set("secondes", not self.s["secondes"]))
        m.add_checkbutton(label="Toujours au premier plan", variable=tk.BooleanVar(value=self.s["dessus"]),
                          command=lambda: self._set("dessus", not self.s["dessus"]))
        m.add_separator()
        m.add_command(label="Quitter", command=self.root.destroy)
        m.tk_popup(e.x_root, e.y_root)


def main() -> None:
    root = tk.Tk()
    root.title("Horloge dev")
    DevClock(root)
    root.mainloop()


if __name__ == "__main__":
    main()
