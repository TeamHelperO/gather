"""Map items M01-M51. Grid 32px, 3/4 top-down view."""
from common import *

T = 32


def blk(px, x0, y0, x1, y1, top_h, top, front, line=OUTLINE):
    """3/4 block: lighter top face + darker front face, outlined."""
    px.r(x0, y0, x1, y1, line)
    px.r(x0 + 1, y0 + 1, x1 - 1, y0 + top_h, top)
    px.r(x0 + 1, y0 + top_h + 1, x1 - 1, y1 - 1, front)
    px.r(x0 + 1, y0 + top_h + 1, x1 - 1, y0 + top_h + 1, shade(front, 0.8))
    px.r(x0 + 1, y0 + 1, x1 - 1, y0 + 1, shade(top, 1.15))


def shadow(img, x0, y0, x1, y1, a=60):
    ImageDraw.Draw(img).ellipse([x0, y0, x1, y1], fill=(20, 15, 30, a))


# ---------------- floors ----------------
def floor_madeira():
    f = new(T, T); px = Px(f)
    for row in range(4):
        y = row * 8
        off = (row % 2) * 16
        c = P["wood_l"] if row % 2 == 0 else shade(P["wood_l"], 0.95)
        px.r(0, y, 31, y + 7, c)
        px.r(0, y + 7, 31, y + 7, P["wood"])
        px.r((off + 15) % 32, y, (off + 15) % 32, y + 6, P["wood"])
        for gx in (4, 21):
            px.r((gx + off) % 32, y + 3, (gx + off) % 32 + 2, y + 3, shade(P["wood_l"], 0.9))
    return f


def floor_carpete(c):
    f = new(T, T, hx(c)); px = Px(f)
    for y in range(T):
        for x in range(T):
            if (x * 7 + y * 13) % 11 == 0:
                px.p(x, y, shade(c, 0.9))
            elif (x * 5 + y * 3) % 17 == 0:
                px.p(x, y, shade(c, 1.08))
    return f


def floor_ceramica():
    f = new(T, T, hx(P["tile_l"])); px = Px(f)
    for k in (0, 16):
        px.r(0, k, 31, k, P["tile_d"]); px.r(k, 0, k, 31, P["tile_d"])
    for (x, y) in [(3, 3), (19, 3), (3, 19), (19, 19)]:
        px.r(x, y, x + 2, y, "#ffffff")
    return f


def floor_grama():
    r = rng(3)
    f = new(T, T, hx(P["grass"])); px = Px(f)
    for _ in range(26):
        x, y = r.integers(0, 31), r.integers(1, 31)
        c = P["grass_d"] if r.random() < 0.6 else P["grass_l"]
        px.p(x, y, c); px.p(x, y - 1, c) if r.random() < 0.5 else None
    for _ in range(2):
        x, y = r.integers(2, 29), r.integers(2, 29)
        px.p(x, y, P["yellow"]); px.p(x + 1, y, "#ffffff")
    return f


def floor_palco():
    f = new(T, T); px = Px(f)
    for col in range(4):
        x = col * 8
        c = P["wood2_l"] if col % 2 == 0 else shade(P["wood2_l"], 0.93)
        px.r(x, 0, x + 7, 31, c); px.r(x + 7, 0, x + 7, 31, P["wood2"])
        cut = (col * 11) % 32
        px.r(x, cut, x + 6, cut, P["wood2"])
    return f


def tapete():
    f = new(96, 64); px = Px(f)
    px.box(2, 4, 93, 59, "#8e3b46")
    px.r(6, 8, 89, 55, "#c9a15a"); px.r(8, 10, 87, 53, "#8e3b46")
    px.ell(30, 18, 65, 45, "#c9a15a"); px.ell(36, 23, 59, 40, "#2f4470"); px.ell(43, 28, 52, 35, "#c9a15a")
    for x in range(10, 86, 6):
        px.r(x, 12, x + 2, 13, "#c9a15a"); px.r(x, 50, x + 2, 51, "#c9a15a")
    for y in range(6, 58, 3):
        px.p(0, y, "#e8dcc0"); px.p(1, y, "#e8dcc0"); px.p(94, y, "#e8dcc0"); px.p(95, y, "#e8dcc0")
    return f


# ---------------- walls ----------------
def wall_piece(kind="frente", glass=False):
    f = new(T, 64); px = Px(f)
    if kind == "vertical":
        px.r(11, 0, 20, 63, OUTLINE); px.r(12, 0, 19, 63, P["wall_top"])
        px.r(19, 0, 19, 63, shade(P["wall_top"], 0.9))
        return f
    px.r(0, 0, 31, 9, OUTLINE); px.r(0, 1, 31, 8, P["wall_top"])
    if glass:
        px.r(0, 9, 31, 63, alpha(P["glass"], 150))
        px.r(0, 9, 31, 10, P["metal"]); px.r(0, 60, 31, 63, P["metal_d"])
        px.r(0, 9, 0, 63, P["metal"]); px.r(31, 9, 31, 63, P["metal"])
        for k in range(10):
            px.p(6 + k, 40 - k * 2, alpha("#ffffff", 170)); px.p(7 + k, 40 - k * 2, alpha("#ffffff", 120))
        px.r(6, 50, 14, 50, alpha("#ffffff", 120))
    else:
        px.r(0, 9, 31, 59, P["wall"])
        px.r(0, 9, 31, 10, shade(P["wall"], 0.88))
        px.r(0, 56, 31, 63, P["base"]); px.r(0, 56, 31, 56, shade(P["base"], 1.2))
        px.r(0, 63, 31, 63, OUTLINE)
    if kind == "ponta_esq":
        px.r(0, 0, 0, 63, OUTLINE)
    if kind == "ponta_dir":
        px.r(31, 0, 31, 63, OUTLINE)
    return f


def wall_tileset(glass=False):
    s = new(T * 4, 64)
    for i, k in enumerate(["frente", "ponta_esq", "ponta_dir", "vertical"]):
        s.alpha_composite(wall_piece(k, glass), (i * T, 0))
    return s


def porta(locked=None):
    f = wall_piece()
    px = Px(f)
    px.r(4, 14, 27, 63, OUTLINE)
    px.r(5, 15, 26, 63, P["wood"] if locked is None else P["wood2"])
    px.r(7, 18, 24, 34, shade(P["wood"] if locked is None else P["wood2"], 1.12))
    px.r(7, 38, 24, 58, shade(P["wood"] if locked is None else P["wood2"], 1.12))
    px.r(22, 37, 23, 39, P["yellow"])
    if locked is not None:
        c = P["bad"] if locked else P["ok"]
        px.r(13, 11, 18, 13, OUTLINE); px.r(14, 12, 17, 12, c)
        if locked:
            px.r(12, 22, 19, 29, P["yellow"]); px.r(13, 18, 18, 22, OUTLINE); px.r(14, 19, 17, 22, (0, 0, 0, 0))
            px.r(14, 19, 17, 21, P["wood2"]) ; px.p(15, 25, OUTLINE); px.p(16, 25, OUTLINE); px.p(15, 26, OUTLINE)
    return f


def janela():
    f = new(64, 64)
    f.alpha_composite(wall_piece(), (0, 0)); f.alpha_composite(wall_piece(), (32, 0))
    px = Px(f)
    px.r(6, 16, 57, 48, "#f4f1ea"); px.r(6, 16, 57, 16, OUTLINE)
    px.r(9, 19, 30, 45, P["sky"]); px.r(33, 19, 54, 45, P["sky"])
    px.r(9, 38, 30, 45, P["leaf"]); px.r(33, 40, 54, 45, P["leaf"])
    px.ell(12, 23, 20, 27, "#ffffff"); px.ell(40, 21, 50, 26, "#ffffff")
    px.r(10, 20, 14, 20, alpha("#ffffff", 180))
    px.r(4, 48, 59, 51, P["wall_top"]); px.r(4, 51, 59, 51, OUTLINE)
    return f


# ---------------- furniture ----------------
def mesa_trabalho():
    f = new(64, 32); px = Px(f)
    shadow(f, 2, 24, 61, 31)
    px.r(4, 20, 6, 30, P["metal_d"]); px.r(57, 20, 59, 30, P["metal_d"])
    blk(px, 1, 3, 62, 22, 13, P["wood_l"], P["wood"])
    px.r(40, 16, 58, 20, shade(P["wood"], 0.85)); px.r(48, 18, 50, 18, P["metal_l"])
    return f


def cadeira(d):
    f = new(T, T); px = Px(f)
    shadow(f, 7, 24, 24, 31)
    px.r(15, 22, 16, 27, P["metal_d"])
    px.r(9, 27, 22, 28, P["metal_d"]); px.p(9, 29, OUTLINE); px.p(22, 29, OUTLINE); px.p(15, 29, OUTLINE)
    seat, back = "#3a3a44", "#4a4a58"
    if d == "baixo":  # facing down: backrest behind (top)
        blk(px, 8, 3, 23, 15, 2, shade(back, 1.2), back)
        blk(px, 7, 13, 24, 23, 6, shade(seat, 1.3), seat)
    elif d == "cima":  # backrest in front (bottom)
        blk(px, 7, 10, 24, 20, 6, shade(seat, 1.3), seat)
        blk(px, 8, 13, 23, 25, 2, shade(back, 1.2), back)
    elif d == "esquerda":
        blk(px, 7, 12, 22, 22, 6, shade(seat, 1.3), seat)
        blk(px, 20, 4, 25, 22, 2, shade(back, 1.2), back)
    else:
        blk(px, 9, 12, 24, 22, 6, shade(seat, 1.3), seat)
        blk(px, 6, 4, 11, 22, 2, shade(back, 1.2), back)
    return f


def monitor():
    f = new(T, T); px = Px(f)
    px.r(13, 21, 18, 26, P["metal_d"]); px.r(9, 26, 22, 28, P["metal"]); px.r(9, 28, 22, 28, OUTLINE)
    px.box(3, 4, 28, 22, "#2a2a33")
    px.r(5, 6, 26, 20, P["screen"])
    for i, (w, c) in enumerate([(12, P["brand_l"]), (8, P["ok"]), (15, "#ffffff"), (6, P["warn"]), (10, P["brand_l"])]):
        px.r(7 + (i % 2) * 2, 8 + i * 2 + i // 2, 7 + (i % 2) * 2 + w, 8 + i * 2 + i // 2, alpha(c, 220))
    px.p(15, 21, P["ok"])
    return f


def mesa_reuniao(w):
    f = new(w, 64); px = Px(f)
    shadow(f, 4, 50, w - 5, 63)
    px.r(10, 44, 13, 58, P["wood_d"]); px.r(w - 14, 44, w - 11, 58, P["wood_d"])
    blk(px, 2, 10, w - 3, 48, 30, P["wood_l"], P["wood"])
    px.r(8, 16, w - 9, 34, shade(P["wood_l"], 1.07))
    for x in range(14, w - 14, 28):
        px.r(x, 22, x + 8, 27, "#f4f1ea"); px.r(x + 1, 23, x + 6, 23, P["lgray"]); px.r(x + 1, 25, x + 5, 25, P["lgray"])
    return f


def sofa(w=96):
    f = new(w, T); px = Px(f)
    c = P["brand"]
    shadow(f, 2, 24, w - 3, 31)
    blk(px, 3, 2, w - 4, 16, 3, shade(c, 1.2), c)
    blk(px, 3, 13, w - 4, 27, 7, shade(c, 1.35), shade(c, 0.9))
    n = (w - 16) // 26
    for k in range(n + 1):
        x = 8 + k * ((w - 16) // max(n, 1))
        px.r(x, 15, x, 20, shade(c, 1.1))
    blk(px, 0, 8, 7, 28, 3, shade(c, 1.2), shade(c, 0.85)); blk(px, w - 8, 8, w - 1, 28, 3, shade(c, 1.2), shade(c, 0.85))
    return f


def poltrona():
    f = new(T, T); px = Px(f)
    c = P["orange"]
    shadow(f, 3, 24, 28, 31)
    blk(px, 5, 2, 26, 16, 3, shade(c, 1.2), c)
    blk(px, 5, 13, 26, 27, 7, shade(c, 1.35), shade(c, 0.9))
    blk(px, 2, 8, 8, 28, 3, shade(c, 1.2), shade(c, 0.85)); blk(px, 23, 8, 29, 28, 3, shade(c, 1.2), shade(c, 0.85))
    return f


def pufe():
    f = new(T, T); px = Px(f)
    shadow(f, 5, 23, 26, 31)
    c = P["yellow"]
    px.ell(5, 12, 26, 29, OUTLINE); px.ell(6, 13, 25, 28, shade(c, 0.85))
    px.ell(5, 6, 26, 21, OUTLINE); px.ell(6, 7, 25, 20, c); px.p(15, 13, shade(c, 0.7)); px.r(10, 9, 13, 9, shade(c, 1.3))
    return f


def estante():
    f = new(64, 64); px = Px(f)
    blk(px, 2, 4, 61, 62, 4, P["wood_l"], P["wood"])
    r = rng(5)
    cols = [P["red"], P["brand"], P["yellow"], P["ok"], P["purple"], "#f4f1ea", P["orange"], P["dgray"]]
    for sy in (12, 28, 44):
        px.r(4, sy + 13, 59, sy + 14, P["wood_d"])
        x = 5
        while x < 56:
            w = int(r.integers(2, 5)); h = int(r.integers(9, 13))
            if r.random() < 0.15:
                x += 3; continue
            c = cols[int(r.integers(0, len(cols)))]
            px.r(x, sy + 13 - h, x + w - 1, sy + 12, c); px.r(x, sy + 13 - h, x + w - 1, sy + 13 - h, shade(c, 1.3))
            x += w + 1
    return f


def arquivo():
    f = new(T, T); px = Px(f)
    shadow(f, 4, 25, 27, 31)
    blk(px, 5, 2, 26, 28, 4, P["metal_l"], P["metal"])
    for y in (9, 15, 21):
        px.r(7, y, 24, y + 4, shade(P["metal"], 1.1)); px.r(13, y + 2, 18, y + 2, OUTLINE); px.r(7, y + 5, 24, y + 5, P["metal_d"])
    return f


def planta(big=False):
    h = 64 if big else T
    f = new(T, h); px = Px(f)
    shadow(f, 8, h - 7, 23, h - 1)
    px.poly([(10, h - 12), (21, h - 12), (20, h - 2), (11, h - 2)], P["pot"], OUTLINE)
    px.r(10, h - 12, 21, h - 11, P["pot_d"])
    if big:
        px.r(15, 22, 16, 52, P["wood_d"])
        for (cx, cy, rr) in [(16, 14, 9), (9, 22, 7), (23, 22, 7), (12, 32, 6), (21, 33, 6), (16, 26, 7)]:
            px.ell(cx - rr, cy - rr, cx + rr, cy + rr, P["leaf"], OUTLINE)
        for (cx, cy) in [(14, 10), (8, 20), (21, 19), (11, 30), (18, 24)]:
            px.r(cx, cy, cx + 2, cy, P["leaf_l"])
    else:
        for (pts) in [[(15, 21), (6, 9), (10, 7)], [(16, 21), (16, 3), (19, 6)], [(16, 21), (26, 8), (24, 13)], [(15, 21), (8, 15), (5, 17)], [(16, 21), (25, 16), (27, 19)]]:
            px.poly(pts, P["leaf"], P["leaf_d"])
        px.r(14, 8, 15, 12, P["leaf_l"]); px.p(9, 10, P["leaf_l"]); px.p(23, 11, P["leaf_l"])
    return f


def logo_next():
    f = new(96, 64); px = Px(f)
    px.box(4, 8, 91, 55, P["brand_ink"])
    px.r(6, 10, 89, 11, shade(P["brand_ink"], 1.6))
    # N mark
    px.r(14, 20, 17, 43, "#ffffff"); px.r(28, 20, 31, 43, "#ffffff")
    for k in range(12):
        px.r(17 + k, 20 + k * 2, 18 + k, 21 + k * 2, "#ffffff")
    px.r(33, 40, 36, 43, P["brand"])
    text(f, (40, 21), "NEXT", 11, "#ffffff")
    text(f, (40, 34), "CO.", 11, P["brand_l"])
    return f


def placa_sala(label="SALA 1"):
    f = new(64, T); px = Px(f)
    px.box(4, 8, 59, 25, P["brand_ink"])
    px.r(6, 10, 7, 23, P["brand"])
    if label:
        text(f, (34, 17), label, 8, "#ffffff", anchor="mm")
    return f


def relogio():
    f = new(T, T); px = Px(f)
    px.ell(5, 5, 26, 26, OUTLINE); px.ell(6, 6, 25, 25, "#f4f1ea")
    for (x, y) in [(15, 7), (15, 23), (7, 15), (23, 15)]:
        px.r(x, y, x + 1, y + 1, OUTLINE)
    px.line([(16, 16), (16, 10)], OUTLINE); px.line([(16, 16), (20, 18)], P["bad"])
    return f


def quadro_avisos():
    f = new(64, T); px = Px(f)
    px.box(3, 3, 60, 28, P["cork"])
    px.r(4, 4, 59, 4, P["wood_d"])
    for (x, y, c) in [(7, 8, P["yellow"]), (20, 6, "#f4f1ea"), (33, 9, P["pink"]), (46, 6, P["sky"]), (12, 17, P["leaf_l"]), (40, 17, P["yellow"])]:
        px.r(x, y, x + 9, y + 8, c); px.p(x + 4, y, P["bad"])
        px.r(x + 2, y + 3, x + 7, y + 3, shade(c, 0.7)); px.r(x + 2, y + 5, x + 6, y + 5, shade(c, 0.7))
    return f


def cafeteira():
    f = new(T, T); px = Px(f)
    blk(px, 1, 14, 30, 31, 5, P["wood_l"], P["wood"])
    px.box(7, 1, 24, 20, P["metal_d"])
    px.r(9, 3, 22, 7, P["black"]); px.r(10, 4, 12, 5, P["ok"]); px.r(18, 4, 20, 5, P["bad"])
    px.r(13, 9, 18, 11, P["black"])
    px.r(12, 14, 19, 19, "#f4f1ea"); px.r(13, 15, 18, 15, P["wood_d"])
    px.p(14, 12, alpha("#ffffff", 140)); px.p(16, 11, alpha("#ffffff", 140))
    return f


def geladeira():
    f = new(T, 64); px = Px(f)
    shadow(f, 3, 56, 28, 63)
    blk(px, 3, 2, 28, 60, 4, "#ffffff", "#e3e1dc")
    px.r(4, 24, 27, 24, P["lgray"])
    px.r(23, 12, 24, 20, P["metal"]); px.r(23, 28, 24, 40, P["metal"])
    px.r(7, 30, 11, 34, P["yellow"]); px.r(13, 32, 16, 35, P["pink"])
    return f


def bebedouro():
    f = new(T, T); px = Px(f)
    shadow(f, 8, 25, 23, 31)
    blk(px, 9, 14, 22, 29, 3, "#f4f1ea", P["lgray"])
    px.ell(9, 1, 22, 14, OUTLINE); px.ell(10, 2, 21, 13, alpha(P["sky"], 230))
    px.r(12, 4, 13, 9, alpha("#ffffff", 200))
    px.r(11, 19, 12, 20, P["brand"]); px.r(18, 19, 19, 20, P["bad"])
    return f


def mesa_copa():
    f = new(64, 64); px = Px(f)
    shadow(f, 8, 50, 55, 62)
    for x in (12, 49):
        px.r(x, 36, x + 2, 56, P["metal_d"])
    px.ell(4, 10, 59, 44, OUTLINE); px.ell(5, 11, 58, 40, "#f4f1ea"); px.r(6, 37, 57, 41, P["lgray"])
    px.ell(16, 18, 26, 26, "#ffffff", P["lgray"]); px.ell(37, 20, 47, 28, "#ffffff", P["lgray"])
    px.r(19, 20, 23, 23, P["orange"]); px.ell(30, 14, 35, 19, P["red"])
    return f


def pingpong():
    f = new(96, 64); px = Px(f)
    shadow(f, 4, 50, 91, 63)
    px.r(10, 40, 12, 58, P["metal_d"]); px.r(83, 40, 85, 58, P["metal_d"])
    blk(px, 2, 8, 93, 46, 30, "#2f7d5a", "#24604a")
    px.r(3, 9, 92, 9, "#ffffff"); px.r(3, 38, 92, 38, "#ffffff"); px.r(3, 9, 3, 38, "#ffffff"); px.r(92, 9, 92, 38, "#ffffff")
    px.r(4, 23, 91, 23, alpha("#ffffff", 140))
    px.r(47, 4, 48, 40, "#f4f1ea"); px.r(46, 4, 49, 5, OUTLINE)
    px.ell(25, 14, 28, 17, "#ffffff")
    return f


def fliperama():
    f = new(T, 64); px = Px(f)
    shadow(f, 3, 56, 28, 63)
    px.poly([(4, 4), (27, 4), (27, 61), (4, 61)], P["purple"], OUTLINE)
    px.r(5, 5, 26, 12, P["brand_ink"]); text(f, (16, 9), "GAME", 6, P["yellow"], anchor="mm")
    px.r(6, 15, 25, 33, OUTLINE); px.r(7, 16, 24, 32, P["screen"])
    px.r(10, 26, 13, 28, P["ok"]); px.r(17, 20, 19, 22, P["bad"]); px.r(8, 30, 23, 30, P["brand_l"])
    px.r(4, 35, 27, 41, shade(P["purple"], 1.25)); px.r(8, 37, 9, 39, OUTLINE); px.ell(15, 37, 17, 39, P["bad"]); px.ell(20, 37, 22, 39, P["yellow"])
    px.r(10, 47, 21, 50, OUTLINE); px.r(14, 48, 17, 48, P["yellow"])
    return f


def palco():
    f = new(256, 128); px = Px(f)
    px.r(0, 8, 255, 127, OUTLINE)
    tile = floor_palco()
    for y in range(9, 104, 32):
        for x in range(1, 255, 32):
            f.alpha_composite(tile.crop((0, 0, min(32, 255 - x), min(32, 104 - y))), (x, y))
    px.r(1, 104, 254, 126, P["wood2_d"]); px.r(1, 104, 254, 105, shade(P["wood2_d"], 1.4))
    for x in range(12, 250, 24):
        px.r(x, 112, x + 3, 115, P["yellow"]); px.r(x + 1, 113, x + 2, 114, "#fff6c8")
    return f


def pulpito():
    f = new(T, T); px = Px(f)
    shadow(f, 5, 25, 26, 31)
    blk(px, 5, 2, 26, 29, 5, P["wood_l"], P["wood"])
    px.r(10, 13, 21, 22, P["brand_ink"]); px.r(13, 15, 13, 20, "#ffffff"); px.r(18, 15, 18, 20, "#ffffff"); px.line([(13, 15), (18, 20)], "#ffffff")
    px.r(19, 0, 19, 4, OUTLINE); px.r(18, 0, 20, 1, P["metal_d"])
    return f


def fileira_cadeiras():
    f = new(192, T); px = Px(f)
    for k in range(6):
        c = cadeira_plateia()
        f.alpha_composite(c, (k * 32, 0))
    return f


def cadeira_plateia():
    f = new(T, T); px = Px(f)
    shadow(f, 6, 24, 25, 31)
    c = "#8e3b46"
    blk(px, 6, 8, 25, 20, 6, shade(c, 1.3), c)
    blk(px, 6, 15, 25, 28, 2, shade(c, 1.2), shade(c, 0.85))
    px.r(7, 26, 8, 30, P["metal_d"]); px.r(23, 26, 24, 30, P["metal_d"])
    return f


def caixa_som():
    f = new(T, 64); px = Px(f)
    shadow(f, 4, 56, 27, 63)
    blk(px, 4, 4, 27, 60, 4, "#4a4a55", "#2f2f38")
    for (cy, r) in [(20, 5), (42, 9)]:
        px.ell(16 - r, cy - r, 15 + r, cy + r, OUTLINE); px.ell(17 - r, cy - r + 1, 14 + r, cy + r - 1, "#555562"); px.ell(13, cy - 2, 18, cy + 2, "#7a7a88")
    return f


def telao():
    f = new(192, 96); px = Px(f)
    px.r(90, 84, 101, 94, P["metal_d"]); px.r(78, 92, 113, 95, P["metal"])
    px.box(2, 2, 189, 86, "#24242c")
    px.r(6, 6, 185, 82, "#121a2b")
    px.r(6, 6, 185, 14, P["brand"]); text(f, (10, 7), "TELÃO DA EQUIPE", 7, "#ffffff")
    text(f, (150, 7), "68%", 7, "#ffffff")
    rows = [("Site institucional", 0.9, P["ok"]), ("Campanha Black", 0.6, P["warn"]), ("Landing page", 0.35, P["bad"]), ("Relatório mensal", 1.0, P["ok"]), ("Onboarding", 0.15, P["brand_l"])]
    for i, (n, pc, c) in enumerate(rows):
        y = 19 + i * 12
        text(f, (10, y), n, 6, "#cfd6e6")
        px.r(78, y + 1, 168, y + 6, "#2a3550")
        px.r(78, y + 1, 78 + int(90 * pc), y + 6, c)
        text(f, (172, y), f"{int(pc*100)}", 6, "#ffffff")
    px.r(10, 79, 14, 80, P["bad"]); text(f, (17, 75), "1 ESCALONADO", 5, P["bad"])
    return f


def relogio_ponto():
    f = new(T, 64); px = Px(f)
    shadow(f, 7, 56, 24, 63)
    px.r(14, 34, 17, 58, P["metal_d"]); px.r(9, 57, 22, 59, P["metal"])
    px.box(5, 4, 26, 36, P["brand_ink"])
    px.r(8, 7, 23, 17, "#0e2a1a"); text(f, (16, 12), "08:59", 6, P["ok"], anchor="mm")
    px.ell(10, 21, 21, 32, OUTLINE); px.ell(11, 22, 20, 31, P["ok"]); px.r(14, 25, 17, 28, "#ffffff")
    return f


def tv_apresentacao(on=True):
    f = new(96, 64); px = Px(f)
    shadow(f, 20, 54, 75, 63)
    px.r(44, 48, 51, 58, P["metal_d"]); px.r(30, 57, 65, 60, P["metal"])
    px.box(3, 3, 92, 50, "#24242c")
    if on:
        px.r(6, 6, 89, 47, "#f4f1ea"); px.r(6, 6, 89, 12, P["brand"])
        px.r(12, 18, 50, 20, P["dgray"]); px.r(12, 24, 44, 25, P["lgray"]); px.r(12, 29, 46, 30, P["lgray"])
        for k, h in enumerate([10, 16, 12, 22]):
            px.r(58 + k * 7, 42 - h, 62 + k * 7, 42, [P["brand"], P["ok"], P["warn"], P["brand_d"]][k])
    else:
        px.r(6, 6, 89, 47, "#1b1b22")
        for k in range(6):
            px.r(10 + k * 12, 10 + k * 5, 18 + k * 12, 10 + k * 5, alpha("#ffffff", 30))
        text(f, (48, 27), "SEM SINAL", 7, "#5c606a", anchor="mm")
    return f


def quadro_branco():
    f = new(96, 64); px = Px(f)
    shadow(f, 10, 56, 85, 63)
    px.r(10, 44, 12, 60, P["metal_d"]); px.r(83, 44, 85, 60, P["metal_d"])
    px.box(3, 3, 92, 48, "#ffffff")
    px.r(4, 4, 91, 5, P["metal_l"])
    px.line([(10, 14), (30, 14)], P["brand"], 1); px.line([(10, 20), (36, 20)], P["dgray"]); px.line([(10, 26), (28, 26)], P["dgray"])
    px.ell(50, 12, 66, 26, None if False else "#ffffff", P["bad"]); px.line([(66, 19), (80, 30)], P["bad"]); px.poly([(78, 31), (82, 31), (81, 27)], P["bad"])
    px.box(70, 30, 86, 40, "#ffffff"); px.line([(12, 38), (20, 32), (28, 36), (40, 30)], P["ok"])
    px.r(20, 46, 28, 47, P["bad"]); px.r(31, 46, 38, 47, P["brand"])
    return f


def megafone():
    f = new(T, T); px = Px(f)
    blk(px, 8, 18, 23, 31, 4, P["metal_l"], P["metal"])
    px.poly([(7, 11), (19, 5), (19, 19), (7, 15)], P["bad"], OUTLINE)
    px.r(3, 11, 7, 15, P["dgray"]); px.r(10, 15, 12, 18, P["dgray"])
    px.ell(17, 5, 22, 19, P["red"], OUTLINE); px.ell(18, 8, 21, 16, "#7a1f22")
    px.p(25, 9, P["yellow"]); px.p(26, 12, P["yellow"]); px.p(25, 15, P["yellow"])
    return f


def sino():
    f = new(T, T); px = Px(f)
    blk(px, 4, 16, 27, 31, 5, P["wood_l"], P["wood"])
    px.ell(9, 7, 22, 21, OUTLINE); px.r(9, 14, 22, 21, (0, 0, 0, 0))
    px.ell(10, 8, 21, 22, P["yellow"]); px.r(8, 18, 23, 20, OUTLINE); px.r(9, 18, 22, 19, shade(P["yellow"], 0.8))
    px.r(15, 4, 16, 7, OUTLINE); px.r(12, 10, 13, 13, "#fff6c8")
    return f


def porta_retrato():
    f = new(T, T); px = Px(f)
    px.box(5, 5, 26, 26, P["wood"])
    px.r(8, 8, 23, 23, P["sky"]); px.poly([(8, 23), (14, 14), (19, 20), (21, 17), (23, 23)], P["leaf"]); px.ell(18, 9, 22, 13, P["yellow"])
    return f


def jukebox():
    f = new(T, 64); px = Px(f)
    shadow(f, 3, 56, 28, 63)
    px.r(3, 14, 28, 61, OUTLINE); px.ell(3, 3, 28, 28, OUTLINE)
    px.ell(4, 4, 27, 27, "#c0392b"); px.r(4, 15, 27, 60, "#c0392b")
    px.ell(7, 7, 24, 24, P["yellow"]); px.ell(9, 9, 22, 22, "#2a1f30")
    for k, c in enumerate([P["pink"], P["sky"], P["leaf_l"], P["yellow"]]):
        px.r(7 + k * 5, 28, 9 + k * 5, 42, c)
    px.r(6, 45, 25, 55, "#8a2a20"); px.r(9, 48, 22, 48, P["yellow"]); px.r(9, 51, 22, 51, P["yellow"])
    px.p(26, 6, "#ffffff"); px.r(29, 4, 30, 6, P["yellow"])
    return f


# ---------------- editor zones ----------------
def zona(color, icon):
    f = new(T, T); px = Px(f)
    px.r(0, 0, 31, 31, alpha(color, 90))
    for k in range(0, 32, 4):
        px.r(k, 0, k + 1, 0, alpha(color, 230)); px.r(k, 31, k + 1, 31, alpha(color, 230))
        px.r(0, k, 0, k + 1, alpha(color, 230)); px.r(31, k, 31, k + 1, alpha(color, 230))
    w = "#ffffff"
    if icon == "spawn":
        px.poly([(16, 6), (19, 13), (26, 13), (20, 18), (22, 25), (16, 21), (10, 25), (12, 18), (6, 13), (13, 13)], w)
    elif icon == "pessoa":
        px.ell(12, 6, 19, 13, w); px.ell(9, 15, 22, 28, w); px.r(9, 23, 22, 28, alpha(color, 90))
    elif icon == "cadeado":
        px.r(10, 15, 21, 25, w); px.r(12, 8, 19, 15, w); px.r(14, 10, 17, 15, alpha(color, 90)); px.r(15, 18, 16, 21, color)
    elif icon == "mic":
        px.ell(12, 5, 19, 18, w); px.r(9, 13, 9, 17, w); px.r(22, 13, 22, 17, w); px.r(10, 18, 21, 19, w); px.r(15, 20, 16, 24, w); px.r(11, 25, 20, 26, w)
    elif icon == "mudo":
        px.poly([(7, 13), (11, 13), (16, 8), (16, 24), (11, 19), (7, 19)], w); px.line([(19, 12), (25, 20)], w, 2); px.line([(25, 12), (19, 20)], w, 2)
    elif icon == "x":
        px.line([(8, 8), (23, 23)], w, 3); px.line([(23, 8), (8, 23)], w, 3)
    return f


ZONES = {"M46": ("ponto_de_entrada", P["ok"], "spawn"), "M47": ("mesa_pessoal", P["brand"], "pessoa"),
         "M48": ("sala_privada", P["meet"], "cadeado"), "M49": ("palco", P["orange"], "mic"),
         "M50": ("area_silenciosa", P["gray"], "mudo"), "M51": ("colisao", P["bad"], "x")}
