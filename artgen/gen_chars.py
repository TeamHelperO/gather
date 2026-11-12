from chars import *
from chars_extra import *
D = "personagens"
def hair_l(st, c): return render(lay_hair, st, c, ol=shade(c, 0.45))
def s(img, name): save(img, f"{D}/{name}.png")
HK = list(HAIR.items()); CK = list(CLOTH.items())
# P01
for i, sk in enumerate(SKINS, 1): s(body_sheet(sk), f"P01_corpo_base/P01_corpo_tom{i}")
# P02
for st in range(1, 7): s(render(lay_eyes, st, so=False), f"P02_rosto/P02_olhos_estilo{st}")
for st in range(1, 4): s(render(lay_brows, st, so=False), f"P02_rosto/P02_sobrancelha_estilo{st}")
s(render(lay_eyes, 1, True, so=False), "P02_rosto/P02_olhos_piscando")
# P03-P07
for n, c in HK: s(hair_l("curto", c), f"P03_cabelo_curto/P03_curto_{n}")
for n, c in HK: s(hair_l("longo", c), f"P04_cabelo_longo/P04_longo_{n}")
for n, c in HK:
    s(hair_l("cacheado1", c), f"P05_cabelo_cacheado/P05_cacheado_volume1_{n}")
    s(hair_l("cacheado2", c), f"P05_cabelo_cacheado/P05_cacheado_volume2_{n}")
for n, c in HK[:4]: s(render(lay_hair, "raspado", c, so=False), f"P06_cabelo_raspado/P06_raspado_{n}")
s(new(FW*COLS, FH*ROWS), "P06_cabelo_raspado/P06_careca_vazio")
for st, lab in [("coque","coque"),("rabo","rabo_de_cavalo"),("trancas","trancas")]:
    for n, c in HK: s(hair_l(st, c), f"P07_coque_rabo_trancas/P07_{lab}_{n}")
# P08
for st in ["cheia","bigode","cavanhaque","rala"]:
    for n, c in HK: s(render(lay_beard, st, c, so=False), f"P08_barba_bigode/P08_{st}_{n}")
# P09-P13
for n, c in CK: s(render(lay_top, "camiseta", c), f"P09_camiseta/P09_camiseta_{n}")
for n, c in CK[:6]: s(render(lay_top, "social", c), f"P10_camisa_social/P10_social_{n}")
for n, c in CK[:8]: s(render(lay_top, "moletom", c), f"P11_moletom/P11_moletom_{n}")
for n, c in CK[:6]: s(render(lay_top, "vestido", c), f"P12_vestido/P12_vestido_{n}")
s(render(lay_top, "next", "#1d1d1f"), "P13_camiseta_next/P13_next_preta")
s(render(lay_top, "next", "#f2f0ea"), "P13_camiseta_next/P13_next_branca")
# P14-P15
BOT = list({"jeans":"#3d5a8a","preto":"#2f2b2e","cinza":"#8d8f99","bege":"#c8b48a","verde_oliva":"#6b7a45","vinho":"#7a2f3a"}.items())
for m, lab in [("calca","calca"),("short","short"),("saia","saia")]:
    for n, c in BOT: s(render(lay_bottom, m, c), f"P14_calca_short_saia/P14_{lab}_{n}")
SH = list({"branco":"#f2f0ea","preto":"#2f2b2e","vermelho":"#d0463c","azul":"#3d6fd6","marrom":"#6e4526","cinza":"#8d8f99"}.items())
for m in ["tenis","sapato"]:
    for n, c in SH: s(render(lay_shoes, m, c), f"P15_tenis_sapato/P15_{m}_{n}")
# P16-P18
for st in ["redondo","quadrado","escuro"]: s(render(lay_glasses, st, so=False), f"P16_oculos/P16_oculos_{st}")
for st in ["bone","chapeu","gorro"]:
    for n, c in CK[:6]: s(render(lay_hat, st, c, ol=OUTLINE), f"P17_bone_chapeu/P17_{st}_{n}")
s(render(lay_headphones, ol=OUTLINE), "P18_fone_de_ouvido/P18_fone")
# P22-P26
s(fx_fala(), "P22_indicador_de_fala/P22_fala_3frames_16x16")
s(fx_status(), "P23_icones_status/P23_status_disponivel_focado_reuniao_ausente1-3_16x16")
s(fx_mao(), "P24_mao_levantada/P24_mao_2frames_16x16")
s(fx_reacoes(), "P25_reacoes/P25_reacoes_joinha_coracao_risada_festa_palmas_8frames_16x24")
s(fx_confete(), "P26_confete/P26_confete_12frames_64x64")
# P27-P29
s(npc_mascote(), "P27_mascote_next/P27_coruja_nexo_parado_piscar_acenar4")
s(npc_robo(), "P28_robo_telao/P28_robo_parado2_alerta4")
s(npc_pet(), "P29_pet/P29_gato_andar4dir_dormir2")
# P30 convidado
s(render(lay_badge, so=False), "P30_convidado/P30_cracha_convidado_camada")
guest = compose([body_sheet(SKINS[1]), render(lay_eyes, 2, so=False), render(lay_bottom, "calca", "#8d8f99"),
                 render(lay_shoes, "tenis", "#8d8f99"), render(lay_top, "moletom", "#b9bcc4"), hair_l("curto", "#9a948a"), render(lay_badge, so=False)])
s(guest, "P30_convidado/P30_convidado_exemplo_completo")
print("ok")
