"""Builds the Next Co. reference office map (SA14) from the item and character art."""
from items import *
from chars_extra import npc_mascote, npc_robo, npc_pet
import prev_chars

MW, MH = 60, 40  # tiles


class Map:
    def __init__(self):
        self.floor = new(MW * T, MH * T, hx(P["grass"]))
        self.objs = []  # (sort_y, x, y, img)
        g = floor_grama()
        for ty in range(MH):
            for tx in range(MW):
                self.floor.alpha_composite(g, (tx * T, ty * T))

    def fill(self, tile, x0, y0, x1, y1):
        for ty in range(y0, y1 + 1):
            for tx in range(x0, x1 + 1):
                self.floor.alpha_composite(tile, (tx * T, ty * T))

    def put(self, img, tx, ty, dx=0, dy=0, sort=None):
        """Place img so its top-left is at tile (tx,ty) + pixel offset."""
        x, y = int(tx * T + dx), int(ty * T + dy)
        self.objs.append((sort if sort is not None else y + img.height, x, y, img))

    def hwall(self, x0, x1, ty, glass=False, doors=()):
        for tx in range(x0, x1 + 1):
            if tx in doors:
                continue
            self.put(wall_piece("frente", glass), tx, ty - 1, sort=(ty + 1) * T - 1)

    def vwall(self, tx, y0, y1):
        piece = wall_piece("vertical").crop((0, 0, 32, 32))
        for ty in range(y0, y1 + 1):
            self.put(piece, tx, ty, sort=ty * T + 31)

    def render(self):
        out = self.floor.copy()
        for _, x, y, img in sorted(self.objs, key=lambda o: o[0]):
            out.alpha_composite(img, (x, y))
        return out


def frame(sheet_img, col, row, w=32, h=48):
    return sheet_img.crop((col * w, row * h, col * w + w, row * h + h))


def build():
    m = Map()
    C = prev_chars.chars
    # ---- floors ----
    m.fill(floor_ceramica(), 2, 3, 15, 19)        # recepção
    m.fill(floor_madeira(), 16, 3, 41, 19)        # área de trabalho
    m.fill(floor_carpete(P["carpet_blue"]), 42, 3, 57, 19)  # área do telão
    m.fill(floor_carpete(P["carpet_green"]), 34, 13, 41, 19)  # área silenciosa
    m.fill(floor_carpete(P["carpet_gray"]), 2, 22, 23, 37)    # salas
    m.fill(floor_madeira(), 24, 22, 45, 37)       # auditório
    m.fill(floor_ceramica(), 46, 22, 57, 37)      # copa / lazer
    m.fill(floor_madeira(), 2, 20, 57, 21)        # corredor
    # ---- walls ----
    m.hwall(2, 57, 3)
    m.hwall(2, 23, 22, doors=(6, 13, 20)); m.hwall(24, 45, 22, doors=(34, 35)); m.hwall(46, 57, 22, doors=(51,))
    m.vwall(1, 2, 38); m.vwall(58, 2, 38)
    m.vwall(8, 22, 37); m.vwall(16, 22, 37); m.vwall(23, 22, 37); m.vwall(45, 22, 37)
    m.hwall(2, 57, 38)
    for tx in (6, 13, 20):
        m.put(porta(tx == 13), tx, 21, sort=22 * T)
    m.put(porta(), 34, 21, sort=22 * T); m.put(porta(), 35, 21, sort=22 * T); m.put(porta(), 51, 21, sort=22 * T)
    # entrada (abertura no topo da recepção)
    # ---- recepção ----
    m.put(logo_next(), 5, 1, dy=10, sort=4 * T)
    m.put(janela(), 11, 2, sort=4 * T - 1)
    m.put(relogio_ponto(), 3, 4)
    m.put(sino(), 8, 7); m.put(mesa_trabalho(), 7, 7, dy=8)
    m.put(frame(npc_mascote(), 0, 0), 8, 5, dy=8)
    m.put(sofa(), 3, 13); m.put(planta(True), 2, 11); m.put(planta(True), 14, 11)
    m.put(tapete(), 5, 9, dy=4, sort=0)
    m.put(quadro_avisos(), 12, 2, dy=26, sort=4 * T)
    # ---- área de trabalho ----
    for row, ty in enumerate((6, 10, 14)):
        for col, tx in enumerate((18, 22, 26, 30)):
            if row == 2 and col == 3:
                continue
            m.put(mesa_trabalho(), tx, ty)
            m.put(monitor(), tx, ty, dy=-12, sort=(ty + 1) * T - 2)
            m.put(monitor(), tx + 1, ty, dy=-12, sort=(ty + 1) * T - 2)
            m.put(cadeira("cima"), tx, ty + 1, dy=-6)
    m.put(estante(), 32, 2, dy=2, sort=4 * T); m.put(estante(), 39, 2, dy=2, sort=4 * T)
    m.put(planta(), 35, 4); m.put(planta(), 17, 4)
    m.put(relogio(), 25, 2, dy=6, sort=4 * T)
    # área silenciosa
    m.put(placa_sala("SILÊNCIO"), 36, 12, dy=-4); m.put(pufe(), 35, 15); m.put(pufe(), 38, 16); m.put(poltrona(), 40, 14)
    m.put(planta(True), 34, 17)
    # ---- telão ----
    m.put(telao(), 45, 1, dy=12, sort=4 * T + 2)
    m.put(frame(npc_robo(), 2, 0), 51, 4, dy=4)
    for k in range(5):
        m.put(cadeira("cima"), 44 + k * 2, 9)
    m.put(planta(True), 56, 4); m.put(planta(True), 42, 4)
    m.put(quadro_branco(), 43, 14); m.put(poltrona(), 54, 15); m.put(poltrona(), 52, 15)
    # ---- salas privadas ----
    for k, (x0, x1) in enumerate([(2, 7), (9, 15), (17, 22)]):
        cx = (x0 + x1) // 2
        m.put(placa_sala(f"SALA {k+1}"), x0 + 1 if k else x0, 22, dy=-30, sort=24 * T)
        m.put(tv_apresentacao(True), cx - 1, 23, dy=-8)
        m.put(mesa_reuniao(96), cx - 1, 27)
        for j in range(3):
            m.put(cadeira("baixo"), cx - 1 + j, 26, dy=6)
            m.put(cadeira("cima"), cx - 1 + j, 29, dy=-2)
        m.put(planta(), x0, 35)
    # ---- auditório ----
    m.put(palco(), 27, 23, sort=0)
    m.put(pulpito(), 34, 25); m.put(caixa_som(), 26, 23); m.put(caixa_som(), 43, 23)
    for r, ty in enumerate((29, 31, 33, 35)):
        m.put(fileira_cadeiras(), 28, ty); m.put(fileira_cadeiras(), 36, ty, dx=-16)
    m.put(megafone(), 44, 35)
    # ---- copa / lazer ----
    m.put(cafeteira(), 47, 23); m.put(cafeteira(), 48, 23); m.put(geladeira(), 49, 22, dy=8); m.put(bebedouro(), 50, 23)
    m.put(mesa_copa(), 47, 26); m.put(mesa_copa(), 52, 26)
    m.put(pingpong(), 47, 31); m.put(fliperama(), 56, 30); m.put(jukebox(), 56, 33)
    m.put(porta_retrato(), 53, 22, dy=-8, sort=24 * T)
    m.put(frame(npc_pet(), 0, 4, 32, 32), 53, 35)
    m.put(planta(True), 46, 34)
    # ---- personagens ----
    people = [  # (char idx, row, col, tx, ty, dx, dy)
        (0, 0, 0, 10, 10, 0, 0), (1, 3, 0, 19, 7, 0, 10), (2, 4, 2, 23, 7, 0, 6), (3, 4, 2, 27, 11, 0, 6),
        (4, 1, 1, 31, 8, 8, 4), (5, 0, 0, 47, 7, 0, 0), (6, 0, 2, 49, 8, 0, 0), (7, 0, 0, 53, 8, 0, 0),
        (2, 3, 0, 46, 10, 0, 0), (0, 3, 0, 50, 10, 8, 0), (1, 0, 0, 34, 24, 0, -8), (4, 3, 0, 30, 30, 8, 6),
        (6, 3, 0, 38, 32, 0, 6), (3, 0, 1, 11, 27, 0, 4), (5, 0, 0, 12, 30, 0, -6), (7, 2, 3, 49, 29, 0, 0),
        (0, 1, 2, 54, 25, 0, 0), (5, 2, 0, 39, 16, 0, -6),
    ]
    for ci, row, col, tx, ty, dx, dy in people:
        m.put(frame(C[ci], col, row), tx, ty, dx=dx, dy=dy - 16)
    return m


ROOMS = [("RECEPÇÃO", 2, 3, 15, 19), ("ÁREA DE TRABALHO", 16, 3, 41, 12), ("ÁREA SILENCIOSA", 34, 13, 41, 19),
         ("TELÃO DA EQUIPE", 42, 3, 57, 19), ("SALA 1", 2, 22, 7, 37), ("SALA 2", 9, 22, 15, 37),
         ("SALA 3", 17, 22, 22, 37), ("AUDITÓRIO", 24, 22, 44, 37), ("COPA E LAZER", 46, 22, 57, 37)]
