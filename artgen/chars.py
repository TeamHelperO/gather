"""Layered character system. Every layer is a 192x336 sheet of 32x48 frames:
row 0 baixo (parado + 4 andar), row 1 esquerda, row 2 direita, row 3 cima,
row 4 sentar (frente f0 f1, costas f0 f1), row 5 acenar (4), row 6 dançar (6)."""
from common import *

FW, FH, COLS, ROWS = 32, 48, 6, 7

WALK = [  # bob, legL(dx,dy), legR, armL dy, armR dy   (front view)
    (0, (0, 0), (0, 0), 0, 0),
    (0, (0, 1), (0, -1), -1, 1),
    (-1, (0, 0), (0, 0), 0, 0),
    (0, (0, -1), (0, 1), 1, -1),
    (-1, (0, 0), (0, 0), 0, 0),
]
SIDE = [  # bob, back leg dx, front leg dx, arm dx
    (0, 0, 0, 0), (0, 2, -2, 2), (-1, 0, 0, 0), (0, -2, 2, -2), (-1, 0, 0, 0)]


def cells():
    """Yield (row, col, dir, pose) for every frame of the grid."""
    for col in range(5):
        for row, d in enumerate(["down", "left", "right", "up"]):
            yield row, col, d, {"kind": "walk", "i": col}
    for col, (d, i) in enumerate([("down", 0), ("down", 1), ("up", 0), ("up", 1)]):
        yield 4, col, d, {"kind": "sit", "i": i}
    for col in range(4):
        yield 5, col, "down", {"kind": "wave", "i": col}
    for col in range(6):
        yield 6, col, "down", {"kind": "dance", "i": col}


def skel(d, pose):
    k, i = pose["kind"], pose["i"]
    S = {"dir": d, "pose": pose}
    if d in ("left", "right"):
        bob, bdx, fdx, adx = SIDE[i]
        b = bob
        S["head"] = (10, 7 + b, 21, 20 + b)
        S["torso"] = (12, 21 + b, 19, 31 + b)
        S["arms"] = [(13 - adx, 21 + b, 15 - adx, 30 + b), (15 + adx, 21 + b, 17 + adx, 30 + b)]  # back, front
        S["legs"] = [(14 + bdx, 32 + b, 16 + bdx, 41), (14 + fdx, 32 + b, 16 + fdx, 41)]
        S["feet"] = [(l[0] - 2, 42, l[2], 44) for l in S["legs"]]
        return S
    tilt, b = 0, 0
    armL = armR = 0
    raiseL = raiseR = False
    legL = legR = (0, 0)
    if k == "walk":
        b, legL, legR, armL, armR = WALK[i]
    elif k == "sit":
        b = 3 - (1 if i == 1 else 0) + 1
    elif k == "wave":
        raiseR = True
    elif k == "dance":
        seq = [(0, -1, 1, 0), (-1, 0, 1, 1), (0, 1, 0, 1), (1, 0, -1, 1), (0, -1, 0, 0), (-1, 1, 1, 1)]
        tilt, b, la, ra = seq[i]
        raiseL, raiseR = la == 1, ra == 1
        if i in (1, 3):
            legL, legR = (0, -1), (0, 1)
    S["head"] = (9 + tilt, 7 + b, 22 + tilt, 20 + b)
    S["torso"] = (11 + tilt, 21 + b, 20 + tilt, 31 + b)
    wav = (i % 2) if k == "wave" else 0
    aL = (7 + tilt, 12 + b, 9 + tilt, 21 + b) if raiseL else (8 + tilt, 21 + b, 10 + tilt, 30 + b + armL)
    aR = (22 + tilt + wav, 12 + b, 24 + tilt + wav, 21 + b) if raiseR else (21 + tilt, 21 + b, 23 + tilt, 30 + b + armR)
    S["arms"] = [aL, aR]
    S["raised"] = [raiseL, raiseR]
    if k == "sit":
        S["legs"] = [(11, 32 + b, 14, 38), (17, 32 + b, 20, 38)]
        S["feet"] = [(11, 39, 14, 41), (17, 39, 20, 41)]
    else:
        S["legs"] = [(11, 32 + b, 14, 41 + legL[1]), (17, 32 + b, 20, 41 + legR[1])]
        S["feet"] = [(10, 42 + legL[1], 14, 44 + legL[1]), (17, 42 + legR[1], 21, 44 + legR[1])]
    return S


def render(layer_fn, *args, so=True, ol=None):
    """Build a full sheet for a layer function f(px, S, *args).
    so: inner self-outline; ol: colour of an outer outline."""
    out = new(FW * COLS, FH * ROWS)
    for row, col, d, pose in cells():
        fr = new(FW, FH)
        dd = "left" if d == "right" else d
        S = skel(dd, pose)
        layer_fn(Px(fr), S, *args)
        if ol is not None:
            fr = outline(fr, ol)
        elif so:
            fr = selout(fr, 0.72)
        if d == "right":
            fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
        out.alpha_composite(fr, (col * FW, row * FH))
    return out


def round_head(px, h, c):
    x0, y0, x1, y1 = h
    px.r(x0, y0, x1, y1, c)
    for (x, y) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1), (x0 + 1, y0), (x0, y0 + 1), (x1 - 1, y0), (x1, y0 + 1)]:
        px.img.putpixel((x + px.ox, y + px.oy), (0, 0, 0, 0))


# ---------------- P01 body ----------------
def lay_body(px, S, skin):
    d = S["dir"]
    sk, skd = hx(skin), shade(skin, 0.85)
    under, shorts = "#dcd6cc", "#8d8f99"
    if d == "left":
        px.rect(S["arms"][0], skd)
        for l in S["legs"]:
            px.rect(l, skd if l is S["legs"][0] else sk)
        for f in S["feet"]:
            px.rect(f, skd)
        px.rect(S["torso"], under)
        t = S["torso"]
        px.r(t[0], t[3] - 1, t[2], t[3] + 2, shorts)
        px.rect(S["arms"][1], sk)
        h = S["head"]
        round_head(px, h, sk)
        px.r(h[0] + 6, h[1] + 6, h[0] + 7, h[1] + 8, skd)  # ear
        return
    for l in S["legs"]:
        px.rect(l, sk)
    for f in S["feet"]:
        px.rect(f, skd)
    t = S["torso"]
    px.rect(t, under)
    px.r(t[0], t[3] - 1, t[2], t[3] + 3, shorts)
    for a in S["arms"]:
        px.rect(a, sk)
    h = S["head"]
    round_head(px, h, sk)
    ey = h[1] + 7
    px.r(h[0] - 1, ey, h[0] - 1, ey + 2, skd)
    px.r(h[2] + 1, ey, h[2] + 1, ey + 2, skd)


def body_sheet(skin):
    sh = new(FW * COLS, FH * ROWS)
    for row, col, d, pose in cells():
        sk = skel("left" if d == "right" else d, pose)
        y = 45 if pose["kind"] != "sit" else 42
        ImageDraw.Draw(sh).ellipse([col * FW + 8, row * FH + y - 1, col * FW + 23, row * FH + y + 2], fill=(20, 15, 30, 70))
    sh.alpha_composite(render(lay_body, skin, ol=OUTLINE))
    return sh


# ---------------- P02 face ----------------
EYE = "#2a2333"


def lay_eyes(px, S, style, closed=False):
    d, h = S["dir"], S["head"]
    if d == "up":
        return
    ey = h[1] + 8
    xs = [h[0] + 2] if d == "left" else [h[0] + 3, h[0] + 9]
    for x in xs:
        if closed:
            px.r(x, ey + 1, x + 1, ey + 1, EYE)
            continue
        if style == 1:
            px.r(x, ey, x + 1, ey + 1, EYE); px.p(x, ey, "#ffffff")
        elif style == 2:
            px.r(x, ey, x, ey + 1, EYE)
        elif style == 3:
            px.r(x, ey, x + 1, ey + 1, EYE); px.p(x + 1, ey, "#ffffff"); px.p(x - 1 if x < 16 else x + 2, ey - 1, EYE)
        elif style == 4:
            px.r(x, ey + 1, x + 1, ey + 1, EYE); px.p(x, ey, shade(EYE, 1.6))
        elif style == 5:
            px.r(x, ey - 1, x + 1, ey + 1, EYE); px.p(x, ey - 1, "#ffffff")
        elif style == 6:
            px.p(x, ey + 1, EYE); px.p(x + 1, ey, EYE); px.p(x + 2 if d == "left" else x + 2, ey + 1, EYE)
    my = h[1] + 11
    if d == "left":
        px.r(h[0] + 1, my, h[0] + 2, my, "#a0524c")
    else:
        px.r(h[0] + 6, my, h[0] + 7, my, "#a0524c")
        px.p(h[0] + 2, my - 1, (232, 120, 120, 90)); px.p(h[0] + 11, my - 1, (232, 120, 120, 90))


def lay_brows(px, S, style):
    d, h = S["dir"], S["head"]
    if d == "up":
        return
    y = h[1] + 6
    c = "#3b2a22"
    xs = [h[0] + 2] if d == "left" else [h[0] + 3, h[0] + 9]
    for j, x in enumerate(xs):
        if style == 1:
            px.r(x, y, x + 1, y, c)
        elif style == 2:  # angled
            inner = x + 1 if (d != "left" and j == 0) else x
            outer = x if inner == x + 1 else x + 1
            px.p(outer, y, c); px.p(inner, y + (1 if d != "left" else 0), c)
        elif style == 3:
            px.r(x - 1 if (j == 0 and d != "left") else x, y - 1, x + 1 if (j == 0 or d == "left") else x + 2, y, c)


# ---------------- hair ----------------
def lay_hair(px, S, style, c):
    d, (x0, y0, x1, y1) = S["dir"], S["head"]
    hc = hx(c)
    hd = shade(c, 0.8)
    if style == "raspado":
        stub = alpha(c, 200)
        for y in range(y0, y0 + 4):
            for x in range(x0 + 1, x1):
                if (x + y) % 2 == 0:
                    px.p(x, y, stub)
        if d != "left":
            for y in range(y0 + 4, y0 + 7):
                px.p(x0, y, stub); px.p(x1, y, stub)
        if d == "up":
            for y in range(y0 + 4, y1 - 2):
                for x in range(x0 + 1, x1):
                    if (x + y) % 2 == 0:
                        px.p(x, y, stub)
        return
    # base short cap used by most styles
    def cap(front_len=5, side_len=6):
        if d == "up":
            px.r(x0, y0 - 1, x1, y0 + 10, hc)
            px.r(x0 + 1, y0 - 2, x1 - 1, y0 - 2, hc)
            return
        px.r(x0 + 1, y0 - 2, x1 - 1, y0 + 2, hc)
        px.r(x0, y0 - 1, x1, y0 + 3, hc)
        if d == "left":
            px.r(x1 - 4, y0, x1, y0 + side_len + 3, hc)
            px.r(x0, y0 + 3, x0 + 2, y0 + front_len, hc)
        else:
            px.r(x0, y0 + 3, x0 + 1, y0 + side_len, hc)
            px.r(x1 - 1, y0 + 3, x1, y0 + side_len, hc)
            px.r(x0 + 2, y0 + 4, x0 + 6, y0 + 4, hc)  # fringe (side part)
            px.p(x0 + 2, y0 + 5, hc)
        px.r(x0 + 3, y0 - 1, x0 + 6, y0 - 1, shade(c, 1.25))  # shine

    if style == "curto":
        cap()
    elif style == "longo":
        cap(6, 8)
        if d == "up":
            px.r(x0 - 1, y0 + 2, x1 + 1, y1 + 8, hc)
            for sx in range(x0 + 1, x1 + 1, 3):
                px.r(sx, y1 - 2, sx, y1 + 7, hd)
        elif d == "left":
            px.r(x1 - 5, y0 + 2, x1 + 1, y1 + 7, hc)
        else:
            px.r(x0 - 1, y0 + 2, x0 + 1, y1 + 7, hc)
            px.r(x1 - 1, y0 + 2, x1 + 1, y1 + 7, hc)
    elif style.startswith("cacheado"):
        v = 3 if style.endswith("2") else 2
        top = y0 - v - 1
        bot = y0 + 9 if v == 2 else y1 + 2
        if d == "left":
            px.r(x0 - 1, top, x1 + v, y0 + 4, hc)
            px.r(x1 - 5, y0 + 2, x1 + v, bot, hc)
        elif d == "up":
            px.r(x0 - v, top, x1 + v, bot + 2, hc)
        else:
            px.r(x0 - v, top, x1 + v, y0 + 4, hc)
            px.r(x0 - v, y0 + 2, x0 + 1, bot, hc)
            px.r(x1 - 1, y0 + 2, x1 + v, bot, hc)
        # bumpy edge + curls texture
        L, R = x0 - v - 1, x1 + v + 1
        for (cx, cy) in [(L + 1, top), (L + 2, top), (L + 1, top + 1), (R - 1, top), (R - 2, top), (R - 1, top + 1)]:
            if 0 <= cx < 32 and 0 <= cy < 48:
                px.img.putpixel((cx, cy), (0, 0, 0, 0))
        for y in range(top, bot + 3):
            for x in range(L, R + 1):
                if (x * 3 + y * 5) % 7 == 0 and px.img.getpixel((x, y))[3] if 0 <= x < 32 and 0 <= y < 48 else False:
                    px.p(x, y, shade(c, 1.3) if hx(c)[0] < 90 else hd)
    elif style in ("coque", "rabo", "trancas"):
        cap()
        if style == "coque":
            px.ell(x0 + 3, y0 - 7, x1 - 3, y0 - 1, c)
            px.r(x0 + 5, y0 - 2, x1 - 5, y0 - 2, hd)
        elif style == "rabo":
            if d == "left":
                px.r(x1, y0 + 3, x1 + 3, y0 + 13, hc)
                px.p(x1 + 1, y0 + 3, hd)
            elif d == "up":
                px.r(x0 + 5, y0 + 9, x1 - 5, y1 + 7, hc)
                px.r(x0 + 5, y0 + 8, x1 - 5, y0 + 8, hd)
        else:  # tranças
            xs = [x1 - 2] if d == "left" else [x0 - 1, x1 - 1] if d == "down" else [x0 + 2, x1 - 4]
            for bx in xs:
                for k, y in enumerate(range(y0 + 6, y1 + 9)):
                    px.r(bx + (k % 2), y, bx + 1 + (k % 2), y, hc if k % 3 else hd)


def lay_beard(px, S, style, c):
    d, (x0, y0, x1, y1) = S["dir"], S["head"]
    if d == "up":
        return
    hc = hx(c)
    if d == "left":
        if style == "cheia":
            px.r(x0, y1 - 4, x0 + 7, y1 + 1, hc); px.r(x0 + 1, y1 - 2, x0 + 3, y1 - 2, (0, 0, 0, 0))
        elif style == "bigode":
            px.r(x0, y1 - 3, x0 + 3, y1 - 3, hc)
        elif style == "cavanhaque":
            px.r(x0, y1 - 1, x0 + 2, y1 + 1, hc)
        else:
            for y in range(y1 - 4, y1 + 1):
                for x in range(x0, x0 + 7):
                    if (x + y) % 2 == 0:
                        px.p(x, y, alpha(c, 170))
        return
    if style == "cheia":
        px.r(x0 + 1, y1 - 5, x1 - 1, y1 + 1, hc)
        px.r(x0 + 3, y1 + 2, x1 - 3, y1 + 2, hc)
        px.r(x0 + 6, y1 - 3, x0 + 7, y1 - 3, (0, 0, 0, 0))
        img = px.img
        img.putpixel((x0 + 6, y1 - 3), hx("#a0524c")); img.putpixel((x0 + 7, y1 - 3), hx("#a0524c"))
    elif style == "bigode":
        px.r(x0 + 4, y1 - 4, x0 + 9, y1 - 4, hc); px.p(x0 + 4, y1 - 3, hc); px.p(x0 + 9, y1 - 3, hc)
    elif style == "cavanhaque":
        px.r(x0 + 5, y1 - 1, x0 + 8, y1 + 1, hc); px.r(x0 + 5, y1 - 4, x0 + 8, y1 - 4, hc)
    else:
        for y in range(y1 - 5, y1 + 1):
            for x in range(x0 + 1, x1):
                if (x + y) % 2 == 0:
                    px.p(x, y, alpha(c, 170))


# ---------------- clothes ----------------
def sleeves(px, S, c, long):
    for j, a in enumerate(S["arms"]):
        x0, y0, x1, y1 = a
        raised = S.get("raised", [False, False])[j] if S["dir"] != "left" else False
        if raised:
            px.r(x0, y1 - (8 if long else 3), x1, y1, c)
        else:
            px.r(x0, y0, x1, y1 - 2 if long else y0 + 3, c)


def lay_top(px, S, model, c):
    d, t = S["dir"], S["torso"]
    side = d == "left"
    cd = shade(c, 0.8)
    if side:  # back arm first
        a = S["arms"][0]
        px.r(a[0], a[1], a[2], a[3] - 2 if model in ("social", "moletom") else a[1] + 3, cd)
    px.rect(t, c)
    if model == "vestido":
        bot = min(t[3] + 8, 38) if S["pose"]["kind"] != "sit" else t[3] + 4
        px.poly([(t[0], t[3] - 1), (t[2], t[3] - 1), (t[2] + 2, bot), (t[0] - 2, bot)], c)
        px.r(t[0] - 1, bot - 1, t[2] + 1, bot, cd)
    if side:
        a = S["arms"][1]
        long = model in ("social", "moletom")
        px.r(a[0], a[1], a[2], a[3] - 2 if long else a[1] + 3, c)
    else:
        sleeves(px, S, c, model in ("social", "moletom"))
    cx = (t[0] + t[2]) // 2
    if d == "down":
        if model in ("camiseta", "next", "vestido"):
            px.r(cx - 1, t[1], cx + 2, t[1], shade(c, 0.7))
        if model == "social":
            px.p(cx - 1, t[1], "#ffffff"); px.p(cx + 2, t[1], "#ffffff"); px.p(cx - 2, t[1], "#ffffff"); px.p(cx + 3, t[1], "#ffffff")
            for y in range(t[1] + 2, t[3], 3):
                px.p(cx, y, shade(c, 0.6))
            px.r(cx, t[1], cx + 1, t[1] + 1, shade(c, 0.7))
        if model == "moletom":
            px.r(t[0] + 1, t[1], t[2] - 1, t[1], cd)
            px.p(cx - 1, t[1] + 1, "#f4f1ea"); px.p(cx - 1, t[1] + 2, "#f4f1ea"); px.p(cx + 2, t[1] + 1, "#f4f1ea"); px.p(cx + 2, t[1] + 2, "#f4f1ea")
            px.r(t[0] + 2, t[3] - 4, t[2] - 2, t[3] - 2, cd)
    elif d == "up" and model == "moletom":
        px.r(t[0] + 1, t[1], t[2] - 1, t[1] + 4, cd)
    elif side and model == "moletom":
        px.r(t[2] - 3, t[1], t[2], t[1] + 3, cd)
    if model == "next":
        logo = "#ffffff" if hx(c)[0] < 100 else "#1d1d1f"
        if d == "down":
            x, y = cx - 1, t[1] + 3
            for k in range(5):
                px.p(x, y + k, logo); px.p(x + 3, y + k, logo)
            px.p(x + 1, y + 1, logo); px.p(x + 2, y + 3, logo); px.p(x + 1, y + 2, logo); px.p(x + 2, y + 2, logo)
            px.p(x + 4, y + 4, P["brand"])
        elif d == "up":
            px.r(t[0] + 2, t[1] + 2, t[2] - 2, t[1] + 2, P["brand"])
        else:
            px.r(t[0] + 1, t[1] + 3, t[0] + 2, t[1] + 4, logo)


def lay_bottom(px, S, model, c):
    t = S["torso"]
    cd = shade(c, 0.85)
    if model == "saia":
        bot = min(t[3] + 8, 38) if S["pose"]["kind"] != "sit" else t[3] + 4
        px.poly([(t[0], t[3] - 1), (t[2], t[3] - 1), (t[2] + 2, bot), (t[0] - 2, bot)], c)
        return
    px.r(t[0], t[3] - 1, t[2], t[3], c)
    legs = S["legs"]
    for j, l in enumerate(legs):
        col = cd if (S["dir"] == "left" and j == 0) else c
        if model == "calca":
            px.rect(l, col)
        else:  # short
            px.r(l[0], l[1], l[2], min(l[1] + 4, l[3]), col)
    if S["dir"] == "down" and model == "calca" and S["pose"]["kind"] != "sit":
        px.r(t[0] + 1, t[3] - 1, t[2] - 1, t[3] - 1, shade(c, 0.7))


def lay_shoes(px, S, model, c):
    for f in S["feet"]:
        px.rect(f, c)
        if model == "tenis":
            px.r(f[0], f[3], f[2], f[3], "#f4f1ea")
        else:
            px.p(f[0] + 1, f[1], shade(c, 1.4))


# ---------------- accessories ----------------
def lay_glasses(px, S, style):
    d, (x0, y0, x1, y1) = S["dir"], S["head"]
    if d == "up":
        return
    c = "#1d1d1f"
    ey = y0 + 7
    xs = [x0 + 1] if d == "left" else [x0 + 2, x0 + 8]
    for x in xs:
        if style == "redondo":
            px.r(x + 1, ey, x + 2, ey, c); px.r(x + 1, ey + 3, x + 2, ey + 3, c); px.r(x, ey + 1, x, ey + 2, c); px.r(x + 3, ey + 1, x + 3, ey + 2, c)
        elif style == "quadrado":
            px.r(x, ey, x + 3, ey, c); px.r(x, ey + 3, x + 3, ey + 3, c); px.r(x, ey, x, ey + 3, c); px.r(x + 3, ey, x + 3, ey + 3, c)
        else:
            px.r(x, ey, x + 3, ey + 2, c); px.p(x + 1, ey, "#5c606a")
    if d == "left":
        px.r(x0 + 5, ey + 1, x0 + 7, ey + 1, c)
    else:
        px.r(x0 + 6, ey + 1, x0 + 7, ey + 1, c)


def lay_hat(px, S, style, c):
    d, (x0, y0, x1, y1) = S["dir"], S["head"]
    cd = shade(c, 0.75)
    if style == "bone":
        px.r(x0, y0 - 2, x1, y0 + 3, c)
        px.r(x0 + 1, y0 - 3, x1 - 1, y0 - 3, c)
        if d == "down":
            px.r(x0 - 1, y0 + 3, x1 + 1, y0 + 4, cd)
        elif d == "left":
            px.r(x0 - 4, y0 + 3, x0 + 2, y0 + 4, cd)
        else:
            px.r(x0 + 4, y0 + 3, x1 - 4, y0 + 4, cd)
        px.p((x0 + x1) // 2, y0 - 3, shade(c, 1.4))
    elif style == "chapeu":
        px.r(x0 - 3, y0 + 2, x1 + 3, y0 + 3, cd)
        px.r(x0 + 1, y0 - 4, x1 - 1, y0 + 2, c)
        px.r(x0 + 1, y0, x1 - 1, y0, shade(c, 0.6))
    else:  # gorro
        px.r(x0, y0 - 2, x1, y0 + 4, c)
        px.r(x0 + 1, y0 - 3, x1 - 1, y0 - 3, c)
        px.r(x0, y0 + 3, x1, y0 + 4, shade(c, 1.3))
        px.r((x0 + x1) // 2, y0 - 5, (x0 + x1) // 2 + 1, y0 - 4, "#f4f1ea")


def lay_headphones(px, S):
    d, (x0, y0, x1, y1) = S["dir"], S["head"]
    c, acc = "#3a3a44", P["brand"]
    if d == "left":
        px.r(x0 + 3, y0 - 2, x0 + 8, y0 - 1, c)
        px.r(x0 + 5, y0 + 5, x0 + 8, y0 + 10, c); px.r(x0 + 6, y0 + 6, x0 + 7, y0 + 9, acc)
        return
    px.r(x0 + 1, y0 - 3, x1 - 1, y0 - 2, c)
    px.r(x0 - 1, y0 - 1, x0, y0 + 4, c); px.r(x1, y0 - 1, x1 + 1, y0 + 4, c)
    px.r(x0 - 2, y0 + 5, x0 + 1, y0 + 10, c); px.r(x1 - 1, y0 + 5, x1 + 2, y0 + 10, c)
    if d == "down":
        px.r(x0 - 1, y0 + 6, x0, y0 + 9, acc); px.r(x1, y0 + 6, x1 + 1, y0 + 9, acc)


def lay_badge(px, S):
    d, t = S["dir"], S["torso"]
    if d == "up":
        px.r(t[0] + 2, t[1], t[0] + 2, t[1] + 1, P["brand"]); px.r(t[2] - 2, t[1], t[2] - 2, t[1] + 1, P["brand"])
        return
    if d == "left":
        px.r(t[0], t[1] + 4, t[0] + 2, t[1] + 7, "#f4f1ea"); px.r(t[0], t[1] + 4, t[0] + 2, t[1] + 4, P["warn"])
        return
    cx = (t[0] + t[2]) // 2
    px.p(cx - 2, t[1], P["brand"]); px.p(cx + 3, t[1], P["brand"]); px.p(cx - 1, t[1] + 1, P["brand"]); px.p(cx + 2, t[1] + 1, P["brand"]); px.r(cx, t[1] + 2, cx + 1, t[1] + 2, P["brand"])
    px.r(cx - 1, t[1] + 3, cx + 2, t[1] + 7, "#f4f1ea")
    px.r(cx - 1, t[1] + 3, cx + 2, t[1] + 4, P["warn"])


# ---------------- compositing ----------------
def compose(layers):
    out = new(FW * COLS, FH * ROWS)
    for l in layers:
        out.alpha_composite(l)
    return out
