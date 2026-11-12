"""Effects (P22-P26) and NPCs (P27-P29)."""
import math
from common import *


def icon_frame(w=16, h=16):
    return new(w, h)


# P22 indicador de fala: 3 frames 16x16
def fx_fala():
    frames = []
    for i in range(3):
        f = icon_frame(); px = Px(f)
        g = P["ok"]
        px.r(6, 6, 9, 9, g); px.r(7, 5, 8, 10, g); px.r(5, 7, 10, 8, g)
        for k in range(i + 1):
            r = 3 + k * 2
            for a in range(-40, 41, 10):
                t = math.radians(a)
                for side in (-1, 1):
                    x = int(round(7.5 + side * r * math.cos(t)))
                    y = int(round(7.5 + r * math.sin(t)))
                    px.p(x, y, alpha(g, 255 - k * 60))
        frames.append(f)
    return sheet(frames, 3)


def circle_icon(col):
    f = icon_frame(); px = Px(f)
    px.ell(1, 1, 14, 14, col, OUTLINE)
    return f, px


def fx_status():
    out = []
    f, px = circle_icon(P["ok"])  # disponível: check
    for (x, y) in [(4, 8), (5, 9), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5)]:
        px.r(x, y, x, y + 1, "#ffffff")
    out.append(f)
    f, px = circle_icon(P["meet"])  # focado: fone
    px.r(5, 4, 10, 4, "#ffffff"); px.r(4, 5, 4, 7, "#ffffff"); px.r(11, 5, 11, 7, "#ffffff")
    px.r(3, 8, 5, 11, "#ffffff"); px.r(10, 8, 12, 11, "#ffffff")
    out.append(f)
    f, px = circle_icon(P["bad"])  # em reunião: câmera
    px.r(3, 5, 9, 10, "#ffffff"); px.poly([(10, 7), (12, 5), (12, 10), (10, 8)], "#ffffff")
    out.append(f)
    for i in range(3):  # ausente zzz animado
        f, px = circle_icon(P["away"])
        for k in range(i + 1):
            s = 4 - k
            x, y = 3 + k * 3, 9 - k * 3
            px.r(x, y, x + s, y, "#ffffff"); px.line([(x + s, y), (x, y + s)], "#ffffff"); px.r(x, y + s, x + s, y + s, "#ffffff")
        out.append(f)
    return sheet(out, 6)


def hand(px, x, y):
    sk = "#f2c79c"
    px.r(x + 1, y + 4, x + 7, y + 10, sk)
    for k in range(4):
        px.r(x + 1 + k * 2, y + (1 if k in (1, 2) else 2), x + 1 + k * 2, y + 5, sk)
    px.r(x - 1, y + 5, x, y + 7, sk)
    px.r(x + 2, y + 11, x + 6, y + 12, P["brand"])


def fx_mao():
    frames = []
    for i in range(2):
        f = icon_frame(); px = Px(f)
        px.ell(0, 0, 15, 15, P["yellow"], OUTLINE)
        hand(px, 4 + i, 1)
        frames.append(selout(f, 0.8) if False else f)
    return sheet(frames, 2)


def draw_reaction(px, kind):
    if kind == "joinha":
        px.r(4, 7, 11, 13, "#f2c79c"); px.r(6, 2, 8, 7, "#f2c79c"); px.r(2, 8, 3, 13, P["brand"])
        px.r(5, 9, 11, 9, "#c99a74"); px.r(5, 11, 11, 11, "#c99a74")
    elif kind == "coracao":
        px.ell(2, 3, 8, 9, P["bad"]); px.ell(7, 3, 13, 9, P["bad"]); px.poly([(2, 7), (13, 7), (7, 14)], P["bad"])
        px.p(4, 5, "#ffffff")
    elif kind == "risada":
        px.ell(1, 1, 14, 14, P["yellow"], OUTLINE)
        px.r(4, 5, 6, 5, OUTLINE); px.r(9, 5, 11, 5, OUTLINE)
        px.r(4, 8, 11, 11, "#7a2a2a"); px.r(5, 8, 10, 8, "#ffffff")
        px.p(2, 7, P["sky"]); px.p(13, 7, P["sky"])
    elif kind == "festa":
        px.poly([(2, 14), (6, 4), (12, 10)], P["orange"], OUTLINE)
        for (x, y, c) in [(9, 2, P["pink"]), (12, 4, P["ok"]), (13, 1, P["brand"]), (8, 5, P["yellow"]), (14, 7, P["pink"])]:
            px.r(x, y, x + 1, y, c)
    elif kind == "palmas":
        px.poly([(3, 13), (5, 3), (8, 2), (9, 12)], "#f2c79c", OUTLINE)
        px.poly([(7, 13), (9, 3), (12, 3), (12, 12)], "#e8b48a", OUTLINE)
        px.p(2, 2, P["yellow"]); px.p(13, 1, P["yellow"]); px.p(1, 5, P["yellow"])


def fx_reacoes():
    kinds = ["joinha", "coracao", "risada", "festa", "palmas"]
    frames = []
    for k in kinds:
        base = icon_frame(); draw_reaction(Px(base), k)
        for i in range(8):
            f = new(16, 24)
            a = 255 if i < 5 else int(255 * (8 - i) / 4)
            ic = base.copy()
            arr = np.array(ic); arr[:, :, 3] = (arr[:, :, 3].astype(int) * a // 255).astype(np.uint8)
            f.alpha_composite(Image.fromarray(arr), (0, 8 - i))
            frames.append(f)
    return sheet(frames, 8)


def fx_confete():
    r = rng(7)
    cols = [P["brand"], P["yellow"], P["pink"], P["ok"], P["orange"], "#ffffff"]
    parts = [(r.uniform(0, 2 * math.pi), r.uniform(1.5, 3.6), cols[i % len(cols)], r.integers(1, 3)) for i in range(40)]
    frames = []
    for i in range(12):
        f = new(64, 64); px = Px(f)
        for ang, sp, c, sz in parts:
            t = i + 1
            x = 32 + math.cos(ang) * sp * t * 0.9
            y = 40 + math.sin(ang) * sp * t * 0.9 - 6 * t + 0.55 * t * t
            if 0 <= x < 63 and 0 <= y < 63:
                a = 255 if i < 9 else int(255 * (12 - i) / 3)
                px.r(int(x), int(y), int(x) + sz - 1, int(y) + (1 if (i + sz) % 2 else 0), alpha(c, a))
        frames.append(f)
    return sheet(frames, 6)


# ---------------- NPCs ----------------
def npc_mascote():
    """Coruja 'Nexo' - recepcionista Next Co. 32x48. idle, piscar, acenar x4."""
    frames = []
    for i in range(6):
        f = new(32, 48); px = Px(f)
        ImageDraw.Draw(f).ellipse([7, 43, 24, 47], fill=(20, 15, 30, 70))
        body, belly = P["brand"], P["brand_l"]
        px.ell(7, 14, 24, 44, body)
        px.ell(10, 24, 21, 42, belly)
        for y in range(27, 41, 3):
            px.r(13, y, 13, y, shade(belly, 0.85)); px.r(17, y + 1, 17, y + 1, shade(belly, 0.85))
        px.poly([(8, 16), (10, 9), (13, 15)], body); px.poly([(23, 16), (21, 9), (18, 15)], body)
        blink = i == 1
        for ex in (9, 17):
            px.ell(ex, 16, ex + 6, 22, "#ffffff", OUTLINE)
            if blink:
                px.r(ex + 1, 19, ex + 5, 19, OUTLINE)
            else:
                px.r(ex + 2, 18, ex + 4, 20, OUTLINE); px.p(ex + 2, 18, "#ffffff")
        px.poly([(15, 22), (17, 22), (16, 25)], P["orange"])
        px.r(12, 44, 14, 45, P["orange"]); px.r(18, 44, 20, 45, P["orange"])
        # gravata / crachá
        px.r(15, 26, 16, 27, P["brand_ink"]); px.poly([(15, 28), (16, 28), (17, 32), (14, 32)], P["brand_ink"])
        # asas
        px.ell(5, 26, 9, 38, P["brand_d"])
        if i >= 2:
            k = i - 2
            px.poly([(23, 28), (26, 16 + (k % 2) * 2), (29, 18 + (k % 2) * 2), (25, 30)], P["brand_d"])
        else:
            px.ell(22, 26, 26, 38, P["brand_d"])
        frames.append(outline(f))
    return sheet(frames, 6)


def npc_robo():
    """Robô do Telão 32x48: parado x2 (antena pisca) + alerta x4."""
    frames = []
    for i in range(6):
        f = new(32, 48); px = Px(f)
        ImageDraw.Draw(f).ellipse([8, 43, 23, 47], fill=(20, 15, 30, 70))
        alert = i >= 2
        on = (i % 2 == 0)
        bob = -1 if (alert and i % 2) else 0
        px.r(15, 3 + bob, 16, 7 + bob, P["metal_d"])
        light = (P["bad"] if alert else P["ok"]) if on else P["metal_d"]
        px.r(14, 1 + bob, 17, 3 + bob, light)
        px.box(7, 8 + bob, 24, 22 + bob, P["metal_l"])
        scr = "#3b0f14" if alert else P["screen"]
        px.r(9, 10 + bob, 22, 20 + bob, scr)
        if alert:
            if on:
                px.r(15, 11 + bob, 16, 16 + bob, P["bad"]); px.r(15, 18 + bob, 16, 19 + bob, P["bad"])
        else:
            px.r(11, 13, 13, 15, P["ok"]); px.r(18, 13, 20, 15, P["ok"]); px.r(13, 18, 18, 18, P["ok"])
        px.r(13, 23 + bob, 18, 24 + bob, P["metal_d"])
        px.box(9, 25 + bob, 22, 37 + bob, P["metal"])
        px.r(11, 27 + bob, 20, 30 + bob, P["brand"])
        px.r(12, 32 + bob, 13, 33 + bob, P["warn"]); px.r(15, 32 + bob, 16, 33 + bob, P["ok"]); px.r(18, 32 + bob, 19, 33 + bob, P["bad"])
        ay = 22 if (alert and on) else 27
        px.box(5, ay + bob, 8, ay + 9 + bob, P["metal_l"]); px.box(23, ay + bob, 26, ay + 9 + bob, P["metal_l"])
        px.box(10, 38, 21, 41, P["metal_d"])
        px.ell(9, 40, 14, 45, OUTLINE); px.ell(17, 40, 22, 45, OUTLINE)
        px.p(11, 42, P["metal"]); px.p(19, 42, P["metal"])
        frames.append(f)
    return sheet(frames, 6)


def npc_pet():
    """Gato do escritório 32x32: andar 4 direções x4 + dormir x2."""
    fur, furd, belly = "#e08a3c", "#b0632a", "#f6d9b5"
    frames = []
    for row, d in enumerate(["down", "left", "right", "up"]):
        for i in range(4):
            f = new(32, 32); px = Px(f)
            ImageDraw.Draw(f).ellipse([8, 26, 23, 30], fill=(20, 15, 30, 60))
            step = [0, 1, 0, -1][i]
            dd = "left" if d == "right" else d
            if dd == "left":
                px.ell(9, 15, 26, 25, fur)
                px.r(10 + step, 23, 11 + step, 28, furd); px.r(14 - step, 23, 15 - step, 28, fur)
                px.r(20 + step, 23, 21 + step, 28, furd); px.r(23 - step, 23, 24 - step, 28, fur)
                px.line([(26, 18), (28, 14), (29, 10 + step)], fur, 2)
                px.ell(3, 9, 14, 19, fur)
                px.poly([(4, 11), (5, 6), (8, 10)], fur); px.poly([(9, 10), (11, 6), (13, 10)], fur)
                px.p(6, 13, OUTLINE); px.p(3, 15, "#d06060"); px.r(4, 16, 8, 18, belly)
                for x in (16, 20):
                    px.r(x, 16, x, 18, furd)
            elif dd == "down":
                px.ell(9, 15, 22, 27, fur)
                px.r(11, 24 + max(step, 0), 13, 28 + max(step, 0), fur); px.r(18, 24 + max(-step, 0), 20, 28 + max(-step, 0), fur)
                px.r(12, 19, 19, 26, belly)
                px.ell(8, 6, 23, 18, fur)
                px.poly([(9, 9), (10, 3), (14, 7)], fur); px.poly([(17, 7), (21, 3), (22, 9)], fur)
                px.p(11, 6, "#f08ab0"); px.p(20, 6, "#f08ab0")
                px.r(12, 11, 12, 12, OUTLINE); px.r(19, 11, 19, 12, OUTLINE); px.p(15, 14, "#d06060"); px.p(16, 14, "#d06060")
                px.r(13, 15, 18, 16, belly)
                px.line([(22, 22), (25, 18 + step)], fur, 2)
            else:  # up
                px.ell(9, 13, 22, 27, fur)
                px.r(11, 24 + max(step, 0), 13, 28 + max(step, 0), fur); px.r(18, 24 + max(-step, 0), 20, 28 + max(-step, 0), fur)
                for y in (17, 20, 23):
                    px.r(13, y, 18, y, furd)
                px.line([(15, 26), (15 + step, 30)], fur, 2)
                px.ell(8, 5, 23, 17, fur)
                px.poly([(9, 8), (10, 2), (14, 6)], fur); px.poly([(17, 6), (21, 2), (22, 8)], fur)
            f = outline(f)
            if d == "right":
                f = f.transpose(Image.FLIP_LEFT_RIGHT)
            frames.append(f)
    for i in range(2):
        f = new(32, 32); px = Px(f)
        ImageDraw.Draw(f).ellipse([5, 24, 26, 29], fill=(20, 15, 30, 60))
        px.ell(6, 14 - i, 25, 27, fur)
        px.ell(5, 16, 14, 25, fur); px.poly([(6, 18), (7, 13), (10, 17)], fur)
        px.r(7, 20, 9, 20, OUTLINE)
        px.line([(24, 22), (20, 26), (12, 26)], furd, 2)
        f = outline(f); px = Px(f)
        zx = 18 + i
        px.r(zx, 6 - i * 2, zx + 3, 6 - i * 2, "#ffffff"); px.line([(zx + 3, 6 - i * 2), (zx, 9 - i * 2)], "#ffffff"); px.r(zx, 9 - i * 2, zx + 3, 9 - i * 2, "#ffffff")
        frames.append(f)
    return sheet(frames, 4)
