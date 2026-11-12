from officemap import *
from chars_extra import npc_robo, npc_mascote
import prev_chars

D = "splash"
m = build()
MAP = m.render()
C = prev_chars.chars


def s(img, name):
    save(img, f"{D}/{name}.png")


def darken_band(img, y0, y1, a=150):
    ov = new(img.width, img.height)
    ImageDraw.Draw(ov).rectangle([0, y0, img.width, y1], fill=(20, 16, 32, a))
    img.alpha_composite(ov)


def title_block(img, cx, cy, big=24, sub=8):
    """NEXT CO. title + subtitle drawn at low-res."""
    text_shadow(img, (cx, cy), "NEXT CO.", big, "#ffffff", anchor="mm")
    text_shadow(img, (cx, cy + big // 2 + sub), "ESCRITÓRIO VIRTUAL", sub, P["brand_l"], anchor="mm")




def hi(img_low, k, texts):
    """Upscale pixel art by k, then draw crisp text at full resolution.
    texts: (x_low, y_low, string, size_low, color[, anchor])"""
    big = up(img_low, k)
    d = ImageDraw.Draw(big)
    d.fontmode = "1"
    for t in texts:
        x, y, st, sz, col = t[:5]
        anc = t[5] if len(t) > 5 else "mm"
        f = ImageFont.truetype(FONT_B, int(sz * k))
        d.text((x * k, y * k), st, font=f, fill=hx(col), anchor=anc, stroke_width=max(2, k), stroke_fill=hx(OUTLINE))
    return big

# SA14 mapa completo + versão com legendas
s(MAP, "SA14_mapa_completo_referencia_1920x1280")
lab = MAP.copy()
for n, x0, y0, x1, y1 in ROOMS:
    ov = new(lab.width, lab.height)
    ImageDraw.Draw(ov).rectangle([x0 * T, y0 * T, (x1 + 1) * T - 1, (y1 + 1) * T - 1], outline=(255, 255, 255, 200), width=2)
    lab.alpha_composite(ov)
    cx, cy = (x0 + x1 + 1) * T // 2, (y0 + y1 + 1) * T // 2
    bb = ImageDraw.Draw(lab).textbbox((cx, cy), n, font=ImageFont.truetype(FONT_B, 16), anchor="mm")
    ImageDraw.Draw(lab).rectangle([bb[0] - 6, bb[1] - 4, bb[2] + 6, bb[3] + 4], fill=(29, 29, 31, 220))
    text(lab, (cx, cy), n, 16, "#ffffff", anchor="mm")
s(lab, "SA14_mapa_completo_com_legendas_1920x1280")

# SA01 splash desktop 1920x1080 e mobile 1080x1920 (arte em 2x)
crop = MAP.crop((520, 40, 1480, 580)).copy()
darken_band(crop, 190, 350, 165)
s(hi(crop, 2, [(480, 255, "NEXT CO.", 44, "#ffffff"), (480, 310, "ESCRITÓRIO VIRTUAL", 14, P["brand_l"])]), "SA01_splash_abertura_desktop_1920x1080")
cm = MAP.crop((900, 40, 1440, 1000)).copy()
darken_band(cm, 400, 570, 165)
s(hi(cm, 2, [(270, 465, "NEXT CO.", 40, "#ffffff"), (270, 520, "ESCRITÓRIO VIRTUAL", 14, P["brand_l"])]), "SA01_splash_abertura_celular_1080x1920")

# SA13 compartilhamento 1200x630 (600x315 @2)
og = MAP.crop((560, 60, 1160, 375)).copy()
darken_band(og, 100, 220, 170)
s(hi(og, 2, [(300, 148, "NEXT CO.", 36, "#ffffff"), (300, 195, "ESCRITÓRIO VIRTUAL", 12, P["brand_l"])]), "SA13_imagem_compartilhamento_1200x630")

# SA02 carregamento: 8 frames 1920x1080 (480x270 @4) + gif
walker = C[0]
frames = []
tips = ["Dica: clique em alguém e use 'Ir até' para conversar.", "Dica: faça check-in no relógio de ponto.",
        "Dica: o telão mostra o % de cada processo.", "Dica: na área silenciosa ninguém te ouve."]
for i in range(8):
    f = new(480, 270, hx("#141226")); px = Px(f)
    for k in range(0, 480, 32):
        px.r(k, 196, k + 30, 197, "#2a2547")
    fr = frame(walker, 1 + (i % 4), 2)
    f.alpha_composite(up(fr, 3), (240 - 48 + (i - 4) * 4, 196 - 144 + 6))
    px.box(140, 222, 340, 232, "#2a2547")
    px.r(142, 224, 142 + int(196 * (i + 1) / 8), 230, P["brand"])
    big = hi(f, 4, [(240, 32, "NEXT CO.", 20, "#ffffff"), (240, 250, tips[i // 2], 7, "#b8b4d0"),
                    (240, 212, f"Carregando o escritório... {int((i + 1) / 8 * 100)}%", 7, "#ffffff")])
    frames.append(big)
    s(big, f"SA02_carregamento/SA02_carregamento_frame{i+1}_1920x1080")
small = [fr.resize((960, 540), Image.NEAREST).convert("P", palette=Image.ADAPTIVE) for fr in frames]
small[0].save(f"{OUT}/{D}/SA02_carregamento/SA02_carregamento_preview.gif", save_all=True, append_images=small[1:], duration=140, loop=0)

# SA03 fundo do lobby 1920x1080 (480x270 @4)
lb = new(480, 270)
lm = Map.__new__(Map)
fl = new(480, 270)
for y in range(0, 270, 32):
    for x in range(0, 480, 32):
        fl.alpha_composite(floor_ceramica(), (x, y))
lb.alpha_composite(fl)
for x in range(0, 480, 32):
    lb.alpha_composite(wall_piece(), (x, 0))
lb.alpha_composite(logo_next(), (40, 4))
# espelho / provador
px = Px(lb)
px.box(300, 8, 380, 150, P["wood_d"]); px.r(306, 14, 374, 144, "#cfe8f1")
for k in range(14):
    px.r(320 + k, 120 - k * 6, 322 + k, 120 - k * 6, alpha("#ffffff", 150))
lb.alpha_composite(up(frame(C[3], 0, 0), 2), (308, 50))
px.r(392, 30, 394, 160, P["metal_d"]); px.r(380, 30, 420, 33, P["metal"])
for k, c in enumerate([P["bad"], P["brand"], P["yellow"], P["ok"]]):
    px.poly([(384 + k * 9, 34), (392 + k * 9, 34), (394 + k * 9, 70), (382 + k * 9, 70)], c, OUTLINE)
lb.alpha_composite(sofa(), (60, 190)); lb.alpha_composite(planta(True), (20, 150)); lb.alpha_composite(planta(True), (430, 150))
lb.alpha_composite(tapete(), (190, 170)); lb.alpha_composite(frame(npc_mascote(), 0, 0), (170, 120))
lb.alpha_composite(mesa_trabalho(), (150, 150)); lb.alpha_composite(sino(), (165, 140))
ov = new(480, 270, (20, 16, 32, 70)); lb.alpha_composite(ov)
s(up(lb, 4), "SA03_fundo_lobby_1920x1080")


def window_scene(sky_cols, w=200, h=150):
    f = new(w, h, hx(P["wall"])); px = Px(f)
    px.r(0, 0, w, 8, P["wall_top"]); px.r(0, h - 34, w, h, P["wood_l"])
    for y in range(h - 34, h, 8):
        px.r(0, y + 7, w, y + 7, P["wood"])
    px.box(40, 16, 160, 92, "#f4f1ea")
    band = (92 - 20) // len(sky_cols)
    for i, c in enumerate(sky_cols):
        px.r(43, 19 + i * band, 157, 19 + (i + 1) * band, c)
    px.r(43, 19, 157, 89, (0, 0, 0, 0)) if False else None
    px.r(99, 16, 101, 92, "#f4f1ea")
    return f, px


# SA04 Bom dia 800x600
f, px = window_scene(["#7ec8f0", "#a9dcf3", "#ffd9a0", "#ffc07a", "#ffad66"])
px.ell(110, 58, 140, 88, "#fff1b0"); px.r(43, 80, 157, 89, P["leaf_d"])
px.r(99, 16, 101, 92, "#f4f1ea")
f.alpha_composite(mesa_trabalho(), (20, 100)); f.alpha_composite(monitor(), (40, 88))
av = up(frame(C[1], 1, 0), 2)
f.alpha_composite(av, (128, 54))
px.r(162, 98, 167, 104, "#ffffff"); px.r(167, 99, 168, 102, "#ffffff"); px.r(163, 99, 166, 100, P["wood_d"])
px.p(164, 95, alpha("#ffffff", 160)); px.p(165, 93, alpha("#ffffff", 160))
s(hi(f, 4, [(100, 126, "BOM DIA!", 14, "#ffffff"), (100, 141, "Check-in feito às 08:59", 6, P["yellow"])]), "SA04_checkin_bom_dia_800x600")

# SA05 Até amanhã 800x600
f, px = window_scene(["#3b2a6b", "#6a3b8a", "#c2507a", "#f08a4b", "#f7b267"])
px.ell(112, 70, 136, 94, "#ffcf6b"); px.r(43, 82, 157, 89, "#2a1f40")
px.r(99, 16, 101, 92, "#f4f1ea")
f.alpha_composite(mesa_trabalho(), (68, 96))
mon = monitor(); mp = Px(mon); mp.r(5, 6, 26, 20, "#14141a")
f.alpha_composite(mon, (84, 84)); f.alpha_composite(mon, (108, 84))
f.alpha_composite(up(frame(C[2], 1, 5), 2), (138, 52))
px.box(6, 98, 66, 146, "#1d1d1f")
for k in range(4):
    px.r(10, 116 + k * 7, 56 - k * 5, 118 + k * 7, "#2f2f3a")
s(hi(f, 4, [(36, 106, "RESUMO DO DIA", 5, "#ffffff"), (124, 136, "ATÉ AMANHÃ!", 12, "#ffffff")]), "SA05_checkout_ate_amanha_800x600")

# SA06 Telão vazio 600x400 (150x100 @4)
f = new(150, 100, hx("#121a2b")); px = Px(f)
f.alpha_composite(frame(npc_robo(), 0, 0), (20, 36))
px.box(66, 20, 136, 76, "#f4f1ea")
for k in range(4):
    y = 28 + k * 11
    px.box(72, y, 78, y + 6, P["ok"]); px.r(74, y + 3, 74, y + 4, "#ffffff"); px.r(75, y + 4, 76, y + 2, "#ffffff"); px.p(77, y + 1, "#ffffff")
    px.r(82, y + 2, 128 - k * 6, y + 3, P["lgray"])

for (x, y, c) in [(30, 20, P["yellow"]), (50, 14, P["pink"]), (140, 30, P["brand_l"]), (12, 60, P["ok"]), (142, 70, P["yellow"])]:
    px.r(x, y, x + 1, y + 1, c)
s(hi(f, 4, [(75, 89, "TUDO EM DIA!", 9, P["ok"])]), "SA06_telao_vazio_tudo_em_dia_600x400")

# SA07 Alerta 128x128, 4 frames (32x32 @4)
fr7 = []
for i in range(4):
    f = new(32, 32); px = Px(f)
    on = i % 2 == 0
    if on:
        for (a, b) in [((4, 6), (9, 11)), ((28, 6), (23, 11)), ((16, 1), (16, 5)), ((2, 18), (7, 18)), ((30, 18), (25, 18))]:
            px.line([a, b], P["yellow"], 1)
    px.r(7, 26, 24, 29, P["metal_d"]); px.r(6, 29, 25, 30, OUTLINE)
    px.ell(9, 9, 22, 26, OUTLINE); px.r(9, 18, 22, 26, OUTLINE)
    c = P["bad"] if on else "#8a2a2c"
    px.ell(10, 10, 21, 25, c); px.r(10, 18, 21, 25, c)
    px.r(15, 13, 16, 20, "#ffffff"); px.r(15, 22, 16, 23, "#ffffff")
    px.r(12, 12, 12, 16, alpha("#ffffff", 150))
    fr7.append(up(f, 4))
s(sheet(fr7, 4), "SA07_alerta_escalonamento_4frames_128x128")
for i, fr in enumerate(fr7):
    s(fr, f"SA07_alerta_frames/SA07_alerta_frame{i+1}_128x128")

# SA08 Reconectando 400x300 (100x75 @4)
f = new(100, 75, hx("#1d1b2e")); px = Px(f)
f.alpha_composite(frame(C[5], 0, 5), (34, 12))
px.line([(60, 28), (70, 34), (78, 30), (90, 40)], P["dgray"], 2)
px.r(56, 25, 60, 30, P["lgray"]); px.r(54, 26, 55, 26, P["yellow"]); px.r(54, 29, 55, 29, P["yellow"])
px.p(52, 22, P["yellow"]); px.p(50, 24, P["yellow"]); px.p(52, 31, P["yellow"])
s(hi(f, 4, [(50, 66, "RECONECTANDO...", 7, "#ffffff")]), "SA08_reconectando_400x300")

# SA09 Sala vazia 400x300 (100x75 @4)
f = new(100, 75)
for y in range(0, 75, 32):
    for x in range(0, 100, 32):
        f.alpha_composite(floor_carpete(P["carpet_gray"]), (x, y))
for x in range(0, 100, 32):
    f.alpha_composite(wall_piece(), (x, -30))
f.alpha_composite(mesa_reuniao(96).crop((0, 0, 96, 64)), (2, 18))
for j in range(3):
    f.alpha_composite(cadeira("baixo"), (18 + j * 24, 12))
f.alpha_composite(planta(), (68, 44))
s(hi(f, 4, [(50, 67, "SALA VAZIA", 7, "#ffffff")]), "SA09_sala_vazia_400x300")

# SA10 banner de evento 1200x400 (300x100 @4)
def banner(title=None, date=None):
    f = new(300, 100, hx("#1a1430")); px = Px(f)
    for k in range(3):
        x = 40 + k * 110
        px.poly([(x, 0), (x + 12, 0), (x + 40, 100), (x - 28, 100)], (255, 240, 180, 26))
    px.r(0, 0, 300, 10, "#5a1f2e")
    for x in range(0, 300, 10):
        px.ell(x, 4, x + 10, 14, "#7a2a3e")
    px.r(0, 0, 18, 100, "#7a2a3e"); px.r(282, 0, 300, 100, "#7a2a3e")
    for x in range(2, 18, 4):
        px.r(x, 0, x, 100, "#5a1f2e"); px.r(282 + x, 0, 282 + x, 100, "#5a1f2e")
    px.r(18, 78, 282, 100, P["wood2_d"]); px.r(18, 78, 282, 79, shade(P["wood2_d"], 1.4))
    for x in range(26, 280, 18):
        px.r(x, 86, x + 2, 88, P["yellow"])
    f.alpha_composite(pulpito(), (134, 50))
    ImageDraw.Draw(f).rectangle([60, 24, 240, 62], outline=alpha("#ffffff", 120))
    if title:
        return hi(f, 4, [(150, 37, title, 11, "#ffffff"), (150, 53, date, 6, P["yellow"])])
    return up(f, 4)


s(banner(), "SA10_banner_evento_modelo_vazio_1200x400")
s(banner("ALL HANDS DE NOVEMBRO", "SEXTA • 16H • AUDITÓRIO"), "SA10_banner_evento_exemplo_1200x400")


# SA11 ícone do app + SA12 favicon
def app_icon():
    f = new(64, 64); px = Px(f)
    px.r(4, 4, 59, 59, P["brand"]); px.r(4, 4, 59, 4, P["brand_l"])
    for (x, y) in [(4, 4), (59, 4), (4, 59), (59, 59)]:
        px.p(x, y, (0, 0, 0, 0))
    px.r(16, 20, 47, 59, P["brand_ink"]); px.r(18, 22, 45, 59, "#2a2a33")
    px.r(20, 24, 43, 59, "#f6d28a")
    f.alpha_composite(frame(C[0], 0, 0), (16, 14))
    px.r(14, 16, 49, 19, P["brand_ink"])
    px.r(26, 6, 27, 13, "#ffffff"); px.r(36, 6, 37, 13, "#ffffff")
    for k in range(8):
        px.p(28 + k, 6 + k, "#ffffff")
    px.r(39, 12, 40, 13, P["yellow"])
    return f


ic = app_icon()
s(ic.resize((512, 512), Image.NEAREST), "SA11_icone_app_512x512")
s(ic.resize((192, 192), Image.NEAREST), "SA11_icone_app_192x192")
fav = new(32, 32); px = Px(fav)
px.r(1, 1, 30, 30, P["brand"]); px.r(8, 6, 11, 25, "#ffffff"); px.r(20, 6, 23, 25, "#ffffff")
for k in range(9):
    px.r(11 + k, 6 + k * 2, 12 + k, 8 + k * 2, "#ffffff")
px.r(25, 22, 27, 25, P["yellow"])
s(fav, "SA12_favicon_32x32")

# SA15 paleta
items = list(P.items())
cols = 6
f = new(cols * 120, ((len(items) + cols - 1) // cols) * 40 + 70 + 40 * 4, hx("#f4f1ea"))
text(f, (10, 10), "PALETA – ESCRITÓRIO VIRTUAL NEXT CO.", 14, "#1d1d1f")
for i, (n, c) in enumerate(items):
    x, y = (i % cols) * 120 + 6, (i // cols) * 40 + 40
    ImageDraw.Draw(f).rectangle([x, y, x + 28, y + 28], fill=hx(c), outline=hx(OUTLINE))
    text(f, (x + 34, y + 4), n, 9, "#1d1d1f"); text(f, (x + 34, y + 16), c, 9, "#5d5852")
y0 = ((len(items) + cols - 1) // cols) * 40 + 50
for r, (lbl, cl) in enumerate([("PELES", SKINS), ("CABELOS", list(HAIR.values())), ("ROUPAS", list(CLOTH.values()))]):
    y = y0 + r * 40
    text(f, (10, y + 8), lbl, 10, "#1d1d1f")
    for k, c in enumerate(cl):
        ImageDraw.Draw(f).rectangle([90 + k * 36, y, 118 + k * 36, y + 28], fill=hx(c), outline=hx(OUTLINE))
s(f, "SA15_paleta_de_cores")
print("ok")
