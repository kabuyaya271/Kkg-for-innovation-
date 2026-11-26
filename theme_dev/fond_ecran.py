"""Génère le fond d'écran « développeur » (fond_ecran_dev.png, 3840x2160).

    pip install pillow
    python fond_ecran.py              # ou : python fond_ecran.py 2560 1440
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BG_TOP, BG_BOTTOM = (11, 13, 19), (20, 24, 38)
C = dict(kw="#c792ea", fn="#7fb4ff", str="#a5d68a", cmt="#5c6a80", num="#f5a970",
         fg="#d7dae0", dim="#4a5263", op="#89ddff")

# Extrait du vrai agent de ce dépôt, découpé en (texte, couleur).
CODE = [
    [("# maison.py — l'agent qui écoute et agit", "cmt")],
    [],
    [("from ", "kw"), ("agent_appareils ", "fg"), ("import ", "kw"), ("DeviceAgent", "fn")],
    [],
    [("agent ", "fg"), ("= ", "op"), ("DeviceAgent", "fn"), ("(appareils, confirm", "fg"), ("=", "op"), ("demander", "fg"), (")", "fg")],
    [],
    [("while ", "kw"), ("True", "num"), (":", "fg")],
    [("    ordre ", "fg"), ("= ", "op"), ("ecouter", "fn"), ("()", "fg"), ("            # « allume la télé »", "cmt")],
    [("    if ", "kw"), ("ordre ", "fg"), ("== ", "op"), ('"quitter"', "str"), (":", "fg")],
    [("        break", "kw")],
    [("    print", "fn"), ("(", "fg"), ("agent", "fg"), (".", "op"), ("ask", "fn"), ("(ordre))", "fg"), ("    # → TV allumée.", "cmt")],
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    names = (["JetBrainsMono-Bold.ttf", "DejaVuSansMono-Bold.ttf", "consolab.ttf", "Menlo.ttc"] if bold else
             ["JetBrainsMono-Regular.ttf", "DejaVuSansMono.ttf", "consola.ttf", "Menlo.ttc"])
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    for folder in ("/usr/share/fonts", str(Path.home() / ".fonts"), "C:/Windows/Fonts", "/System/Library/Fonts"):
        for p in Path(folder).rglob("*Mono*.ttf") if Path(folder).exists() else []:
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size)


def render(w: int = 3840, h: int = 2160) -> Image.Image:
    s = w / 3840  # échelle
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):  # dégradé vertical
        t = y / (h - 1)
        row = tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM))
        for x in range(w):
            px[x, y] = row
    d = ImageDraw.Draw(img)

    step = round(64 * s)  # grille de points discrète
    for y in range(step, h, step):
        for x in range(step, w, step):
            d.point((x, y), fill=(34, 39, 54))

    f_code, f_small = font(round(40 * s)), font(round(30 * s))
    line_h = round(64 * s)
    win_x, win_y = round(300 * s), round(620 * s)
    win_w, win_h = round(1900 * s), round(150 * s + line_h * len(CODE) + 60 * s)

    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))  # ombre douce sous la fenêtre
    ImageDraw.Draw(shadow).rounded_rectangle(
        (win_x + 20 * s, win_y + 40 * s, win_x + win_w + 20 * s, win_y + win_h + 40 * s), round(28 * s), fill=(0, 0, 0, 150))
    img.paste(shadow.filter(ImageFilter.GaussianBlur(40 * s)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(40 * s)))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle((win_x, win_y, win_x + win_w, win_y + win_h), round(28 * s), fill="#11131a", outline="#2a2f3d", width=max(1, round(2 * s)))
    for i, col in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        cx, cy, r = win_x + round((50 + i * 44) * s), win_y + round(50 * s), round(12 * s)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)
    d.text((win_x + round(210 * s), win_y + round(32 * s)), "~/kkg-for-innovation/maison.py", font=f_small, fill=C["dim"])
    d.line((win_x, win_y + round(100 * s), win_x + win_w, win_y + round(100 * s)), fill="#2a2f3d", width=max(1, round(2 * s)))

    y = win_y + round(140 * s)
    for n, line in enumerate(CODE, 1):
        d.text((win_x + round(50 * s), y), f"{n:>2}", font=f_code, fill=C["dim"])
        x = win_x + round(150 * s)
        for text, color in line:
            d.text((x, y), text, font=f_code, fill=C[color])
            x += d.textlength(text, font=f_code)
        y += line_h
    # curseur sur la dernière ligne
    d.rectangle((win_x + round(150 * s), y + round(6 * s), win_x + round(172 * s), y + round(52 * s)), fill=C["fn"])

    sign = "kkg · for innovation"
    f_sign = font(round(34 * s), bold=True)
    tw = d.textlength(sign, font=f_sign)
    d.text((w - tw - round(120 * s), h - round(140 * s)), sign, font=f_sign, fill=(64, 72, 94))
    return img


if __name__ == "__main__":
    size = tuple(int(v) for v in sys.argv[1:3]) if len(sys.argv) >= 3 else (3840, 2160)
    out = Path(__file__).with_name("fond_ecran_dev.png")
    render(*size).save(out, optimize=True)
    print(f"✓ {out}")
