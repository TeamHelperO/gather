"""Shared helpers and palette for the Next Co. virtual office pixel art."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = "/home/claude/artes"

# ---------- palette ----------
OUTLINE = "#2a2333"
P = {
    # neutrals
    "white": "#f4f1ea", "lgray": "#cfcac0", "gray": "#9a948a", "dgray": "#5d5852", "black": "#2f2b2e",
    "ink": "#1d1d1f",
    # wood
    "wood_l": "#d39c62", "wood": "#a8713f", "wood_d": "#6e4526",
    "wood2_l": "#9b4f3f", "wood2": "#7a3a33", "wood2_d": "#4f2426",
    # floors
    "carpet_blue": "#5b7fb5", "carpet_green": "#6f9e6a", "carpet_gray": "#8d8f99",
    "tile_l": "#ebe5d8", "tile_d": "#cfc7b6",
    "grass": "#7fb35a", "grass_d": "#5f9440", "grass_l": "#9ccb6d",
    # walls
    "wall_top": "#efe9dc", "wall": "#d6ccb9", "wall_d": "#a99d88", "base": "#7d6f5c",
    "glass": "#a9d8e8", "glass_d": "#76b6cf", "glass_l": "#e3f5fb",
    # plants
    "leaf_l": "#7cc36a", "leaf": "#4f9a4f", "leaf_d": "#2f6e3c", "pot": "#c0643c", "pot_d": "#8e4429",
    # metal / tech
    "metal_l": "#c9ccd3", "metal": "#8f949e", "metal_d": "#5c606a", "screen": "#1f2f4a", "screen_l": "#3a5f8f",
    # brand Next Co. (troque aqui para as cores oficiais)
    "brand": "#3d5afe", "brand_d": "#2438b8", "brand_l": "#8fa0ff", "brand_ink": "#1d1d1f",
    # status
    "ok": "#3fbf5f", "warn": "#f2a33a", "bad": "#e5484d", "meet": "#8b5cf6", "away": "#9a948a",
    # misc
    "red": "#d0463c", "yellow": "#e8b83a", "orange": "#e57a2e", "purple": "#7d5bc4", "pink": "#e07aa8",
    "sky": "#8fd0f0", "cork": "#c99a5e", "cork_d": "#a37744",
}

SKINS = ["#f6d3b3", "#eab88f", "#d09a6a", "#a8724a", "#7d5235", "#553522"]
HAIR = {"preto": "#2b2626", "castanho_escuro": "#4a3022", "castanho": "#7a4b2a", "loiro": "#e0b860",
        "ruivo": "#d9772e", "grisalho": "#b4afab", "acaju": "#8e2f2a", "rosa": "#d96aa7"}
CLOTH = {"branco": "#f2f0ea", "preto": "#2f2b2e", "cinza": "#8d8f99", "marinho": "#2f4470", "azul": "#3d6fd6",
         "vermelho": "#d0463c", "verde": "#4e9a5a", "amarelo": "#e8b83a", "roxo": "#7d5bc4", "rosa": "#e07aa8"}


def hx(c):
    if isinstance(c, tuple):
        return c
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(c, f):
    r, g, b, a = hx(c)
    if f < 1:
        return (int(r * f), int(g * f), int(b * f), a)
    return (int(r + (255 - r) * (f - 1)), int(g + (255 - g) * (f - 1)), int(b + (255 - b) * (f - 1)), a)


def alpha(c, a):
    r, g, b, _ = hx(c)
    return (r, g, b, a)


def new(w, h, bg=(0, 0, 0, 0)):
    return Image.new("RGBA", (w, h), bg)


class Px:
    """Tiny pixel painter over a PIL image with an origin offset."""

    def __init__(self, img, ox=0, oy=0):
        self.img, self.ox, self.oy = img, ox, oy
        self.d = ImageDraw.Draw(img)

    def p(self, x, y, c):
        x, y = x + self.ox, y + self.oy
        if 0 <= x < self.img.width and 0 <= y < self.img.height:
            self.img.putpixel((x, y), hx(c))

    def r(self, x0, y0, x1, y1, c):
        if x1 < x0 or y1 < y0:
            return
        self.d.rectangle([x0 + self.ox, y0 + self.oy, x1 + self.ox, y1 + self.oy], fill=hx(c))

    def rect(self, rr, c):
        self.r(*rr, c)

    def box(self, x0, y0, x1, y1, fill, line=OUTLINE):
        self.r(x0, y0, x1, y1, line)
        self.r(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)

    def hline(self, x0, x1, y, c):
        self.r(x0, y, x1, y, c)

    def vline(self, x, y0, y1, c):
        self.r(x, y0, x, y1, c)

    def ell(self, x0, y0, x1, y1, c, outline=None):
        self.d.ellipse([x0 + self.ox, y0 + self.oy, x1 + self.ox, y1 + self.oy], fill=hx(c),
                       outline=hx(outline) if outline else None)

    def poly(self, pts, c, outline=None):
        self.d.polygon([(x + self.ox, y + self.oy) for x, y in pts], fill=hx(c),
                       outline=hx(outline) if outline else None)

    def line(self, pts, c, w=1):
        self.d.line([(x + self.ox, y + self.oy) for x, y in pts], fill=hx(c), width=w)


def selout(img, factor=0.62):
    """Darken edge pixels of each opaque region (self-outline)."""
    a = np.array(img).astype(np.int32)
    op = a[:, :, 3] > 0
    pad = np.pad(op, 1, constant_values=False)
    nb = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    edge = op & ~nb
    a[edge, :3] = (a[edge, :3] * factor).astype(np.int32)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def outline(img, color=OUTLINE):
    """Add a 1px outer outline around opaque pixels."""
    a = np.array(img)
    op = a[:, :, 3] > 0
    pad = np.pad(op, 1, constant_values=False)
    nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    ring = nb & ~op
    out = a.copy()
    out[ring] = hx(color)
    return Image.fromarray(out, "RGBA")


def up(img, s):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


def save(img, rel):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return path


FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def text(img, xy, s, size=8, color="#ffffff", anchor="la", font=FONT_B):
    d = ImageDraw.Draw(img)
    d.fontmode = "1"
    f = ImageFont.truetype(font, size)
    d.text(xy, s, fill=hx(color), font=f, anchor=anchor)
    return d.textbbox(xy, s, font=f, anchor=anchor)


def text_shadow(img, xy, s, size=8, color="#ffffff", shadow=OUTLINE, anchor="la"):
    x, y = xy
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (1, 1)]:
        text(img, (x + dx, y + dy), s, size, shadow, anchor)
    return text(img, xy, s, size, color, anchor)


def sheet(frames, cols):
    w, h = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    s = new(w * cols, h * rows)
    for i, f in enumerate(frames):
        s.alpha_composite(f, ((i % cols) * w, (i // cols) * h))
    return s


def rng(seed):
    return np.random.default_rng(seed)
