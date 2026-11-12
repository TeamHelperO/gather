import io, base64, json
from items import *
from chars_extra import npc_mascote, npc_robo, npc_pet
import prev_chars
def u(img):
    b=io.BytesIO(); img.save(b,"PNG"); return "data:image/png;base64,"+base64.b64encode(b.getvalue()).decode()
A={}
def add(k,img,label,cat,pal=True): A[k]={"src":u(img),"w":img.width,"h":img.height,"label":label,"cat":cat,"pal":pal}
# floors
add("f_madeira",floor_madeira(),"Madeira","piso",False)
add("f_carpete_azul",floor_carpete(P["carpet_blue"]),"Carpete azul","piso",False)
add("f_carpete_verde",floor_carpete(P["carpet_green"]),"Carpete verde","piso",False)
add("f_carpete_cinza",floor_carpete(P["carpet_gray"]),"Carpete cinza","piso",False)
add("f_ceramica",floor_ceramica(),"Cerâmica","piso",False)
add("f_grama",floor_grama(),"Grama","piso",False)
add("f_palco",floor_palco(),"Palco","piso",False)
pal=palco(); add("palco_frente",pal.crop((0,104,32,128)),"Frente do palco","x",False)
add("parede",wall_piece(),"Parede","x",False)
add("parede_vidro",wall_piece("frente",True),"Parede de vidro","x",False)
add("porta",porta(),"Porta","x",False)
add("porta_privada",porta(False),"Porta da sala","x",False)
# palette items
I=[("tapete",tapete(),"Tapete","Decoração"),("mesa",mesa_trabalho(),"Mesa pequena","Móveis"),("mesa_pc",mesa_pc(),"Mesa de trabalho","Móveis"),
("cadeira_baixo",cadeira("baixo"),"Cadeira ↓","Móveis"),("cadeira_cima",cadeira("cima"),"Cadeira ↑","Móveis"),
("cadeira_esq",cadeira("esquerda"),"Cadeira ←","Móveis"),("cadeira_dir",cadeira("direita"),"Cadeira →","Móveis"),
("monitor",monitor(),"Monitor","Móveis"),("teclado",teclado(),"Teclado","Móveis"),("teclado_rgb",teclado(True),"Teclado gamer RGB","Móveis"),("mouse",mouse(),"Mouse","Móveis"),("notebook",notebook(),"Notebook","Móveis"),("gabinete",gabinete_gamer(),"Gabinete gamer","Móveis"),("mesa_reuniao6",mesa_reuniao(96),"Mesa reunião 6","Móveis"),
("mesa_reuniao10",mesa_reuniao(160),"Mesa reunião 10","Móveis"),("sofa",sofa(),"Sofá","Móveis"),("poltrona",poltrona(),"Poltrona","Móveis"),
("pufe",pufe(),"Pufe","Móveis"),("estante",estante(),"Estante","Móveis"),("arquivo",arquivo(),"Arquivo","Móveis"),
("planta",planta(),"Planta","Decoração"),("planta_grande",planta(True),"Planta grande","Decoração"),
("logo",logo_next(),"Logo Next Co.","Decoração"),("placa",placa_sala(""),"Placa da sala","Decoração"),
("relogio",relogio(),"Relógio","Decoração"),("quadro_avisos",quadro_avisos(),"Quadro de avisos","Decoração"),
("janela",janela(),"Janela","Decoração"),("porta_retrato",porta_retrato(),"Porta-retrato","Decoração"),
("cafeteira",cafeteira(),"Máquina de café","Copa"),("geladeira",geladeira(),"Geladeira","Copa"),("bebedouro",bebedouro(),"Bebedouro","Copa"),
("mesa_copa",mesa_copa(),"Mesa da copa","Copa"),("pingpong",pingpong(),"Pingue-pongue","Copa"),("fliperama",fliperama(),"Fliperama","Copa"),("jukebox",jukebox(),"Jukebox","Copa"),
("pulpito",pulpito(),"Púlpito","Auditório"),("cadeira_plateia",cadeira_plateia(),"Cadeira plateia","Auditório"),("caixa_som",caixa_som(),"Caixa de som","Auditório"),
("telao",telao(),"Telão de gestão","Interativos"),("relogio_ponto",relogio_ponto(),"Relógio de ponto","Interativos"),
("tv",tv_apresentacao(True),"TV ligada","Interativos"),("tv_off",tv_apresentacao(False),"TV desligada","Interativos"),
("quadro_branco",quadro_branco(),"Quadro branco","Interativos"),("megafone",megafone(),"Megafone","Interativos"),("sino",sino(),"Sino","Interativos")]
for k,img,l,c in I: add(k,img,l,c)
def fr(sh,c,r,w=32,h=48): return sh.crop((c*w,r*h,c*w+w,r*h+h))
add("npc_mascote",fr(npc_mascote(),0,0),"Mascote Nexo","Personagens")
add("npc_robo",fr(npc_robo(),0,0),"Robô do telão","Personagens")
add("pet",fr(npc_pet(),0,4,32,32),"Gato","Personagens")
for i,c in enumerate(prev_chars.chars): add(f"pessoa{i+1}",fr(c,0,0),f"Pessoa {i+1}","Personagens")
import base64 as _b, io as _io
from PIL import Image as _I
for k,v in A.items():
    raw=_b.b64decode(v["src"].split(",")[1]); im=_I.open(_io.BytesIO(raw)).convert("RGBA"); b=_io.BytesIO(); im.save(b,"PNG",optimize=True)
    if len(b.getvalue())<len(raw): v["src"]="data:image/png;base64,"+_b.b64encode(b.getvalue()).decode()
json.dump(A,open("/home/claude/editor/assets.json","w"),separators=(",",":"))
open("/home/claude/vercel-site/assets.js","w").write("window.ASSETS="+json.dumps(A,separators=(",",":"))+";\n")
print(len(A), sum(len(v["src"]) for v in A.values())/1e3,"KB")
