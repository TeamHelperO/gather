from chars import *
from chars_extra import *
import random
def hair_l(st, c): return render(lay_hair, st, c, ol=shade(c, 0.45))
EX = [
 (0,"curto","castanho","camiseta","azul","calca","#3d5a8a","tenis","#f2f0ea",1,None,None,None),
 (2,"longo","preto","social","branco","calca","#2f2b2e","sapato","#2f2b2e",3,"quadrado",None,None),
 (4,"cacheado2","preto","moletom","amarelo","saia","#7d5bc4","tenis","#2f2b2e",5,None,None,None),
 (1,"coque","ruivo","vestido","verde","none",None,"sapato","#6e4526",3,"redondo",None,None),
 (5,"raspado","preto","next","#1d1d1f","short","#c8b48a","tenis","#d0463c",2,None,"cheia",None),
 (3,"rabo","loiro","camiseta","rosa","calca","#8d8f99","tenis","#3d6fd6",6,None,None,("bone","#d0463c")),
 (2,"trancas","castanho_escuro","moletom","roxo","calca","#2f2b2e","tenis","#f2f0ea",1,"escuro",None,None),
 (0,"cacheado1","grisalho","social","marinho","calca","#c8b48a","sapato","#2f2b2e",4,"redondo","bigode",("chapeu","#6e4526")),
]
def build(e, fone=False):
    sk,hs,hc,tm,tc,bm,bc,sm,sc,eye,gl,beard,hat = e
    tc = CLOTH.get(tc, tc)
    L=[body_sheet(SKINS[sk]), render(lay_eyes,eye,so=False), render(lay_brows,1,so=False)]
    if beard: L.append(render(lay_beard,beard,HAIR[hc],so=False))
    if bm!="none": L.append(render(lay_bottom,bm,bc))
    L.append(render(lay_shoes,sm,sc)); L.append(render(lay_top,tm,tc))
    L.append(hair_l(hs,HAIR[hc]) if hs!="raspado" else render(lay_hair,hs,HAIR[hc],so=False))
    if gl: L.append(render(lay_glasses,gl,so=False))
    if hat: L.append(render(lay_hat,hat[0],hat[1],ol=OUTLINE))
    if fone: L.append(render(lay_headphones,ol=OUTLINE))
    return compose(L)
chars=[build(e, fone=(i==1)) for i,e in enumerate(EX)]
if __name__=="__main__":
    # lineup: frame down idle of each, plus left/up
    bg=new(8*3*34+10, 60, (214,204,185,255))
    for i,c in enumerate(chars):
        for j,(r,col) in enumerate([(0,0),(1,1),(3,0)]):
            bg.alpha_composite(c.crop((col*32,r*48,col*32+32,r*48+48)), (5+i*102+j*33, 6))
    up(bg,3).save("/tmp/lineup.png")
    # animations demo P19-21 for 2 chars
    for k,ci in enumerate([0,2]):
        a=chars[ci].crop((0,4*48,192,7*48))
        save(a, f"personagens/P19_P20_P21_animacoes/exemplo_personagem{k+1}_sentar_acenar_dancar.png")
    for k,c in enumerate(chars):
        save(c, f"personagens/_exemplos_montados/personagem_exemplo_{k+1}.png")
