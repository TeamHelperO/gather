import os, base64, glob, html, json
R="/home/claude/artes"
def b64(p): return "data:image/%s;base64,%s" % ("gif" if p.endswith("gif") else "png", base64.b64encode(open(p,"rb").read()).decode())
def label(fn):
    n=os.path.splitext(os.path.basename(fn))[0]
    return n
sections=[("personagens","Personagens (P01–P30)"),("itens","Itens do mapa (M01–M51)"),("splash","Splash art (SA01–SA15)")]
from PIL import Image
parts=[]
for key,title in sections:
    groups={}
    for f in sorted(glob.glob(f"{R}/{key}/**/*.*", recursive=True)):
        if not f.endswith((".png",".gif")): continue
        rel=os.path.relpath(f,f"{R}/{key}"); g=os.path.dirname(rel) or ""
        groups.setdefault(g,[]).append(f)
    body=[]
    for g,fs in groups.items():
        cards=[]
        for f in fs:
            im=Image.open(f); w,h=im.size
            sc = 2 if w<=200 else (1 if w<=700 else 0.5)
            if key=="splash" and w>700: sc=None
            style = f"width:{int(w*sc)}px" if sc else "width:100%;max-width:640px"
            cards.append(f'<figure><div class="chk"><img src="{b64(f)}" style="{style}" alt=""></div><figcaption>{html.escape(label(f))}<span>{w}×{h}</span></figcaption></figure>')
        gt = g.replace("_"," ") if g else ""
        body.append((f'<h3>{html.escape(gt)}</h3>' if gt else '')+'<div class="grid">'+"".join(cards)+'</div>')
    parts.append(f'<section id="{key}"><h2>{title}</h2>{"".join(body)}</section>')
ex=[b64(p) for p in sorted(glob.glob(f"{R}/personagens/_exemplos_montados/*.png"))]
npc=[b64(f"{R}/personagens/P27_mascote_next/P27_coruja_nexo_parado_piscar_acenar4.png"), b64(f"{R}/personagens/P28_robo_telao/P28_robo_parado2_alerta4.png")]
mapa=b64(f"{R}/splash/SA14_mapa_completo_com_legendas_1920x1280.png")
page=f'''<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Artes – Escritório Virtual Next Co.</title><style>
:root{{--bg:#f6f4ef;--ink:#1d1d1f;--mut:#6b6760;--brand:#3d5afe;--card:#fff;--line:#e4dfd5}}
@media (prefers-color-scheme:dark){{:root{{--bg:#16151a;--ink:#f1efe9;--mut:#a29d95;--card:#211f26;--line:#34313b}}}}
*{{box-sizing:border-box}}body{{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--ink)}}
header{{padding:28px 20px 8px;max-width:1200px;margin:auto}}h1{{margin:0 0 4px;font-size:26px}}header p{{margin:0;color:var(--mut)}}
nav{{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 20px;display:flex;gap:8px;overflow-x:auto}}
nav a{{white-space:nowrap;padding:6px 12px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none;font-weight:600;font-size:14px}}
main{{max-width:1200px;margin:auto;padding:0 20px 60px}}h2{{margin:36px 0 4px;font-size:21px}}h3{{margin:22px 0 8px;font-size:14px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}}
.grid{{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}}figure{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px;max-width:100%}}
.chk{{background:repeating-conic-gradient(#d9d4ca 0 25%,#ece8e0 0 50%) 0 0/16px 16px;border-radius:6px;overflow:auto;max-width:100%}}
img{{display:block;image-rendering:pixelated;image-rendering:crisp-edges;max-width:none}}
figcaption{{font-size:12px;margin-top:6px;word-break:break-all;color:var(--ink)}}figcaption span{{display:block;color:var(--mut)}}
.demo{{background:#c9bfa9;border-radius:12px;padding:12px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center}}canvas{{image-rendering:pixelated}}
.note{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:14px;font-size:14px}}
.map img{{width:100%;max-width:1200px;border-radius:10px}}
</style></head><body>
<header><h1>Artes do Escritório Virtual Next Co.</h1><p>Pixel art própria para cada linha da planilha, com os mesmos IDs, tamanhos e variantes.</p></header>
<nav><a href="#demo">Ao vivo</a><a href="#mapa">Mapa</a><a href="#personagens">Personagens</a><a href="#itens">Itens</a><a href="#splash">Splash</a></nav>
<main>
<section id="demo"><h2>Personagens montados, em movimento</h2><div class="demo" id="stage"></div>
<div class="note">Cada personagem é a soma das camadas (corpo + rosto + roupa + cabelo + acessórios). Todas as camadas usam a mesma grade de 32×48: andar nas 4 direções, sentar, acenar e dançar. Toque em um personagem para trocar a animação.</div></section>
<section id="mapa" class="map"><h2>Mapa de referência (SA14)</h2><img src="{mapa}" alt="Mapa do escritório"></section>
{"".join(parts)}
</main>
<script>
const EX={json.dumps(ex)};const NPC={json.dumps(npc)};
const anims=[[0,5,"baixo"],[1,5,"esquerda"],[3,5,"cima"],[2,5,"direita"],[5,4,"acenar"],[6,6,"dançar"],[4,2,"sentar"]];
const stage=document.getElementById('stage');const S=3;const items=[];
function add(src,isNpc){{const c=document.createElement('canvas');c.width=32*S;c.height=48*S;stage.appendChild(c);
 const im=new Image();im.src=src;const it={{c,im,isNpc,a:0,f:0}};c.onclick=()=>{{it.a=(it.a+1)%anims.length;it.f=0}};items.push(it)}}
EX.forEach(s=>add(s,false));NPC.forEach(s=>add(s,true));
let t=0;setInterval(()=>{{t++;items.forEach((it,i)=>{{const x=it.c.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,it.c.width,it.c.height);
 if(!it.im.complete)return;let col,row;
 if(it.isNpc){{row=0;col=(t>>1)%6}}else{{const a=anims[(it.a+ (i%4))%anims.length];row=a[0];const n=a[1];col=(row<4)?1+((t+i)%4):((t+i)%n)}}
 x.drawImage(it.im,col*32,row*48,32,48,0,0,32*S,48*S)}})}},160);
</script></body></html>'''
open("/home/claude/galeria/index.html","w").write(page)
print(len(page)/1e6,"MB")
