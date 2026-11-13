/* Motor do mapa do Escritório Virtual Next Co.
   Compartilhado pelo editor de salas (editor.html) e pelo escritório (escritorio.html).
   Usa a variável global S (o mapa atual), declarada pela página. */
const ASSETS = window.ASSETS;
const T = 32;
const TYPES = {
  recepcao:{label:"Recepção",floor:"f_ceramica",d:"Logo, balcão, mascote, sofá"},
  trabalho:{label:"Área de trabalho",floor:"f_madeira",d:"Mesas com monitores e cadeiras"},
  reuniao:{label:"Sala de reunião",floor:"f_carpete_cinza",d:"Mesa, cadeiras e TV",glass:true},
  telao:{label:"Área do telão",floor:"f_carpete_azul",d:"Telão de gestão e cadeiras"},
  silenciosa:{label:"Área silenciosa",floor:"f_carpete_verde",d:"Pufes, poltronas, estante"},
  auditorio:{label:"Auditório",floor:"f_madeira",d:"Palco, púlpito e plateia"},
  ti:{label:"Sala de TI",floor:"f_ti",d:"Servidores, 5 computadores com agentes de IA e telão de tendências"},
  edicao:{label:"Sala de Edição",floor:"f_carpete_azul",d:"Roteirista, diretor de cenas e editor de vídeo (agentes de IA) e telão de roteiros",glass:true},
  copa:{label:"Copa e lazer",floor:"f_ceramica",d:"Café, mesas, jogos"},
  corredor:{label:"Corredor",floor:"f_madeira",d:"Passagem, sem paredes",noWalls:true},
  livre:{label:"Sala vazia",floor:"f_madeira",d:"Sem móveis, você monta"}
};
const FLOORS = ["f_madeira","f_carpete_azul","f_carpete_verde","f_carpete_cinza","f_ceramica","f_grama","f_palco"].concat(ASSETS.f_ti ? ["f_ti"] : []);
const SIDES = {baixo:"Embaixo",cima:"Em cima",esquerda:"Esquerda",direita:"Direita",nenhuma:"Sem porta"};

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- images ---------- */
const IMG = {};
let imgsLeft = 0;
for (const [k, a] of Object.entries(ASSETS)) { imgsLeft++; const im = new Image(); im.onload = () => { if (--imgsLeft === 0 && window.onAssetsReady) onAssetsReady(); }; im.src = a.src; IMG[k] = im; }
const PAT = {};

function blankMap(name){ return {v:1,name:name||"Novo escritório",w:40,h:28,rooms:[],items:[]}; }
function room(type,name,x,y,w,h,door){ return {id:uid(),type,name,x,y,w,h,floor:null,door:{side:door||"baixo",pos:.5},auto:true}; }
/* Escritório da Next Co. para 5 pessoas: tudo grande e perto. */
function templateNext(){
  const m = {v:1,name:"Escritório Next Co.",w:68,h:32,rooms:[],items:[]};
  // em cima (portas para o corredor)
  m.rooms.push(room("recepcao","Recepção",2,3,14,11));
  m.rooms.push(room("trabalho","Área de trabalho",16,3,17,11));
  m.rooms.push(room("ti","Pesquisa",33,3,14,11));
  m.rooms.push(room("edicao","Edição",47,3,10,11));
  m.rooms.push(room("copa","Copa e lazer",57,3,9,11));
  m.rooms.push(room("corredor","Corredor",2,14,64,3,"nenhuma"));
  // embaixo
  const r1 = room("reuniao","Reunião 1",2,19,10,9,"cima"); r1.door.pos = 0.12; m.rooms.push(r1);
  const r2 = room("reuniao","Reunião 2",12,19,10,9,"cima"); r2.door.pos = 0.12; m.rooms.push(r2);
  m.rooms.push(room("auditorio","Auditório",22,19,14,11,"cima"));
  m.rooms.push(room("silenciosa","Área silenciosa",36,19,12,9,"cima"));
  return m;
}

/* ---------- auto layouts (tile units) ---------- */
function aw(k){ return ASSETS[k].w / T; }
function ah(k){ return ASSETS[k].h / T; }
function layoutBase(r){
  const out = []; const {x,y,w,h} = r; const cx = x + w/2;
  const P = (k,tx,ty,o={}) => out.push(Object.assign({k,x:tx,y:ty,room:r.id,auto:true},o));
  const fits = (tx,ty,k) => tx >= x-0.05 && tx+aw(k) <= x+w+0.05 && ty+ah(k) <= y+h+0.15;
  switch (r.type) {
    case "recepcao": {
      const telaoRec = w >= 14 && h >= 7;
      if (w >= 4) P("logo", x+0.4, y-1.85, {z:"wall"});
      if (w >= 8) P("quadro_avisos", x+w-2.4, y-1.3, {z:"wall"});
      if (telaoRec) P("telao", cx-3, y-1.85);
      P("relogio_ponto", x+0.1, y-0.6);
      const dy = telaoRec ? 1.6 : 0;
      if (h >= 4 && w >= 3) { P("npc_mascote", cx-0.5, y+0.35+dy); P("mesa", cx-1, y+1.6+dy); P("sino", cx+0.15, y+1.05+dy); }
      if (h >= 7 && w >= 5) P("tapete", cx-1.5, y+h-3.9, {z:"floor"});
      if (h >= 6 && w >= 5) P("sofa", cx-1.5, y+h-1.3);
      if (w >= 6 && h >= 5) { P("planta_grande", x+0.1, y+h-2.1); P("planta_grande", x+w-1.1, y+h-2.1); }
      break;
    }
    case "trabalho": {
      const telaoTrab = w >= 10 && ASSETS.telao;
      if (telaoTrab) P("telao", cx-3, y-1.85);
      if (w >= 7) P("estante", x+w-2.3, y-1.4);
      if (w >= 4) P("relogio", telaoTrab ? x+1.4 : cx-0.5, y-1.6, {z:"wall"});
      P("planta", x+0.1, y-0.25);
      // estações grandes (mesa de 3 tiles com 2 telas + gabinete), 2 tiles de corredor entre elas
      const gap = w >= 15 ? 2 : 1, passo = 3 + gap, ry = h >= 10 ? 4.5 : 3.5;
      const n = Math.max(1, Math.floor((w + gap - 1) / passo)), m = Math.max(1, Math.floor((h - 3.1) / ry) + 1);
      const span = n*passo - gap, sx = x + (w - span)/2, y0 = y + (telaoTrab ? 1.9 : 0.9);
      let k = 0;
      for (let j=0;j<m;j++) for (let i=0;i<n;i++) {
        const tx = sx+i*passo, ty = y0+j*ry;
        if (tx+3 > x+w+0.01 || ty+2.3 > y+h+0.1) continue;
        P("mesa_pc", tx, ty);
        if (k % 3 === 2){ P("notebook", tx+0.4, ty-0.2); P("monitor", tx+1.35, ty-0.47); P("mouse", tx+2.05, ty+0.22); }
        else { P("monitor", tx+0.35, ty-0.47); P("monitor", tx+1.25, ty-0.47); P("gabinete", tx+2.15, ty-0.44); P(k % 2 ? "teclado" : "teclado_rgb", tx+0.8, ty+0.34); P("mouse", tx+1.8, ty+0.22); }
        P("cadeira_cima", tx+1, ty+1.3);
        k++;
      }
      if (h >= 9 && w >= 6) P("planta_grande", x+w-1.1, y+h-2.1);
      break;
    }
    case "reuniao": {
      // telão de tarefas na parede de cima, longe da porta
      let tvx = cx-3; const dtr = doorTile(r), portaCima = r.door && r.door.side === "cima";
      if (portaCima && dtr >= tvx-0.6 && dtr <= tvx+6.2) tvx = dtr < cx ? x+w-6.2 : x+0.2;
      const cabe = !portaCima || dtr < tvx-0.6 || dtr > tvx+6.2;
      if (w >= 8 && ASSETS.telao && cabe) P("telao", tvx, y-1.85); else if (w >= 3) P("tv", cx-1.5, y-1.25);
      if (w >= 8 && !ASSETS.telao) P("placa", x+0.2, y-1.7, {z:"wall", label:r.name});
      const tw = w >= 7 ? 5 : (w >= 4 ? 3 : 2);
      const tk = tw === 5 ? "mesa_reuniao10" : tw === 3 ? "mesa_reuniao6" : "mesa_copa";
      let ty = y + Math.max(1.6, (h-2.2)/2); ty = Math.min(ty, y+h-2.05);
      if (h >= 3) {
        P(tk, cx - aw(tk)/2, ty);
        if (tw >= 3) for (let j=0;j<tw;j++) {
          const tx = cx - tw/2 + j;
          if (ty-0.81 >= y+0.5) P("cadeira_baixo", tx, ty-0.81);
          if (ty+2.94 <= y+h+0.15) P("cadeira_cima", tx, ty+1.94);
        }
      }
      if (h >= 8 && w >= 3) { P("planta", x+0.1, y+h-1.1); P("planta", x+w-1.1, y+h-1.1); }
      if (h >= 10 && w >= 5) P("quadro_branco", cx-1.5, y+h-2.2);
      break;
    }
    case "telao": {
      if (w >= 6) P("telao", cx-3, y-1.85); else if (w >= 3) P("tv", cx-1.5, y-1.25);
      if (w >= 10) P("npc_robo", cx+3.3, y+0.1);
      if (w >= 8) { P("planta_grande", x+0.1, y-0.6); P("planta_grande", x+w-1.1, y-0.6); }
      const bottom = h >= 9 ? y+h-2.4 : y+h-0.1;
      for (let ty=y+2.6; ty+1<=bottom; ty+=2) for (let tx=x+1; tx+1<=x+w-0.5; tx+=2) P("cadeira_cima", tx, ty);
      if (h >= 9) { if (w>=4) P("quadro_branco", x+0.2, y+h-2.1); if (w >= 7) { P("poltrona", x+w-1.1, y+h-1.1); P("poltrona", x+w-2.2, y+h-1.1); } }
      break;
    }
    case "silenciosa": {
      if (w >= 3) P("placa", cx-1, y-1.7, {z:"wall", label:"SILÊNCIO"});
      if (w >= 5) P("estante", x+0.2, y-1.4);
      let row = 0;
      for (let ty=y+1.3; ty+1<=y+h-0.2; ty+=2.6, row++) for (let tx=x+0.6+(row%2)*1.4; tx+1<=x+w-0.3; tx+=2.8) P(((row+Math.round(tx))%3===0)?"poltrona":"pufe", tx, ty);
      if (h >= 6) { P("planta_grande", x+w-1.1, y-0.6); }
      break;
    }
    case "auditorio": {
      const sh = h >= 10 ? 3 : 2;
      const sx0 = w >= 5 ? x+1 : x, sx1 = w >= 5 ? x+w-2 : x+w-1;
      for (let ty=y; ty<y+sh; ty++) for (let tx=sx0; tx<=sx1; tx++) P("f_palco", tx, ty, {z:"floor"});
      for (let tx=sx0; tx<=sx1; tx++) P("palco_frente", tx, y+sh, {z:"floor"});
      if (w >= 8 && ASSETS.projecao) P("projecao", cx-3, y-1.9, {z:"wall"});
      P("pulpito", cx-0.5, y+sh-1.3);
      if (w >= 5) { P("caixa_som", x+0.05, y-0.6); P("caixa_som", x+w-1.05, y-0.6); }
      const aisle = w >= 7 ? Math.floor(cx) : null;
      let fil = 0;
      const fx0 = w >= 12 ? x+2 : x+1, fx1 = w >= 12 ? x+w-3 : x+w-2; // auditório pequeno: plateia compacta, 2 fileiras
      for (let ty=y+sh+1.6; ty+1<=y+h+0.05 && fil<2; ty+=1.8, fil++) for (let tx=fx0; tx<=fx1; tx++) { if (tx===aisle) continue; P("cadeira_plateia", tx, ty); }
      if (h > sh+2) P("megafone", x+0.05, y+sh+0.9);
      break;
    }
    case "ti": {
      // racks de servidor na parede de cima e telão de tendências
      const temTelao = w >= 10 && ASSETS.telao_tend;
      // canto de café dos agentes (máquina de café e bebedouro) no começo da parede
      const copinha = w >= 8 && ASSETS.maquina_cafe ? 2.2 : 0;
      if (copinha) { P("maquina_cafe", x+0.25, y-1.3); P("bebedouro", x+1.3, y-0.1); }
      const nr = Math.max(0, Math.min(8, Math.floor((w - copinha - (temTelao ? 7.5 : 0.6)) / 1.05)));
      for (let i=0;i<nr;i++) P("rack_servidor", x+copinha+0.25+i*1.05, y-1.3);
      if (temTelao) P("telao_tend", x+w-6.4, y-1.85);
      // 5 computadores, cada um com um agente de IA
      const n = Math.max(1, Math.min(5, Math.floor((w+1)/4))), span = n*4-1, sx = x + (w-span)/2;
      for (let k=0;k<5;k++){
        const i = k % n, j = Math.floor(k / n), tx = sx+i*4, ty = y+2.6+j*3.6;
        if (tx+3 > x+w+0.01 || ty+2.5 > y+h+0.1) continue;
        P("mesa_pc", tx, ty);
        P("monitor", tx+0.5, ty-0.47); P("monitor", tx+1.5, ty-0.47);
        P("teclado_rgb", tx+1, ty+0.34); P("mouse", tx+2.05, ty+0.22);
        if (ASSETS["agente_"+(k+1)]) P("agente_"+(k+1), tx+1, ty+1.05, {agente:"agente"+(k+1)});
      }
      // fileira de racks embaixo (os que tampam a porta saem sozinhos)
      if (h >= 11) { const nb = Math.min(16, Math.floor((w-0.5)/1.05)); for (let i=0;i<nb;i++) P("rack_servidor", x+0.25+i*1.05, y+h-2.05); }
      break;
    }
    case "edicao": {
      // telão de roteiros, claquete, 3 mesas com os agentes Pena, Claquete e Corte, ring light e câmera
      if (w >= 7 && ASSETS.telao_rot) P("telao_rot", cx-3, y-1.85);
      if (w >= 9 && ASSETS.claquete) P("claquete", x+0.3, y-1.4, {z:"wall"});
      if (w >= 9 && ASSETS.maquina_cafe) { P("maquina_cafe", x+w-1.25, y-1.3); P("bebedouro", x+w-2.3, y-0.1); }
      const n = Math.max(1, Math.min(3, Math.floor((w+1)/4))), span = n*4-1, sx = x + (w-span)/2;
      for (let k=0;k<3;k++){
        const i = k % n, j = Math.floor(k / n), tx = sx+i*4, ty = y+2.6+j*3.6;
        if (tx+3 > x+w+0.01 || ty+2.5 > y+h+0.1) continue;
        P("mesa_pc", tx, ty);
        P("monitor", tx+0.5, ty-0.47); P("monitor", tx+1.5, ty-0.47);
        P("teclado_rgb", tx+1, ty+0.34); P("mouse", tx+2.05, ty+0.22);
        if (ASSETS["agente_"+(k+6)]) P("agente_"+(k+6), tx+1, ty+1.05, {agente:"agente"+(k+6)});
      }
      if (h >= 9 && ASSETS.ring_light) P("ring_light", x+0.2, y+h-2.1);
      if (h >= 9 && ASSETS.camera_tripe) P("camera_tripe", x+w-1.2, y+h-2.1);
      if (h >= 9 && w >= 6 && ASSETS.planta) P("planta", x+w-2.4, y+h-1.2);
      break;
    }
    case "copa": {
      P("cafeteira", x, y-0.1); if (w >= 2) P("cafeteira", x+1, y-0.1);
      if (w >= 3) P("geladeira", x+2, y-1.05); if (w >= 5) P("bebedouro", x+3, y-0.1);
      if (w >= 6) P("jukebox", x+w-1.05, y-1.05); if (w >= 8) P("fliperama", x+w-2.1, y-1.05);
      const pp = w >= 6 && h >= 8;
      const limit = y + h - (pp ? 2.6 : 0.1);
      for (let ty=y+1.6; ty+2<=limit; ty+=3.4) for (let tx=x+0.6; tx+2<=x+w-0.3; tx+=3.6) P("mesa_copa", tx, ty);
      if (pp) P("pingpong", cx-1.5, y+h-2.2);
      if (h >= 5 && w >= 4) P("pet", pp ? x+0.2 : x+w-1.1, y+h-1.05);
      break;
    }
  }
  return out;
}

/* Tira da frente da porta os móveis que bloqueiam a passagem (desliza para o lado ou remove). */
function layout(r){
  const its = layoutBase(r);
  const portas = portasDe(r); if (!portas.length) return its;
  const {x, y, w, h} = r;
  const livres = portas.flatMap(({ side, tile: dt }) => side==="baixo" ? [[dt,y+h-1],[dt,y+h-2]] : side==="cima" ? [[dt,y],[dt,y+1]] : side==="esquerda" ? [[x,dt],[x+1,dt]] : [[x+w-1,dt],[x+w-2,dt]]);
  const SOLTO = /^(cadeira_|pessoa|npc_|pet$|tapete$|f_palco$|palco_frente$|placa$|logo$|relogio$|quadro_avisos$|janela$|porta_retrato$|monitor$|teclado|mouse$|notebook$|gabinete$|projecao$)/;
  const pe = (it, dx) => { const a = ASSETS[it.k]; const bx0 = (it.x+dx)*T+4, bx1 = (it.x+dx)*T+a.w-4, bb = it.y*T+a.h-2, bt = bb-Math.min(a.h*0.45,26); return [bx0,bt,bx1,bb]; };
  const bate = (it, dx) => { const [a0,b0,a1,b1] = pe(it, dx); return livres.some(([tx,ty]) => a1 > tx*T-6 && a0 < (tx+1)*T+6 && b1 > ty*T && b0 < (ty+1)*T); };
  const out = [];
  for (const it of its){
    if (it.z==="floor" || it.z==="wall" || SOLTO.test(it.k) || !bate(it, 0)) { out.push(it); continue; }
    let ok = false;
    for (const dx of [-1,1,-2,2,-3,3,-4,4]){
      const nx = it.x + dx; if (nx < x || nx + aw(it.k) > x + w) continue;
      if (!bate(it, dx)) { out.push(Object.assign({}, it, {x: nx})); ok = true; break; }
    }
  }
  return out;
}

/* ---------- geometry helpers ---------- */
const roomById = id => S.rooms.find(r => r.id === id);
const itemById = id => S.items.find(i => i.id === id);
function roomAt(wx, wy){ // world px → topmost room
  for (let i=S.rooms.length-1;i>=0;i--){ const r=S.rooms[i]; if (wx>=r.x*T && wx<(r.x+r.w)*T && wy>=r.y*T && wy<(r.y+r.h)*T) return r; }
  return null;
}
function roomAtTile(tx,ty){ for (let i=S.rooms.length-1;i>=0;i--){ const r=S.rooms[i]; if (tx>=r.x && tx<r.x+r.w && ty>=r.y && ty<r.y+r.h) return r; } return null; }
/* portas: a principal (r.door) e as extras (r.portas = [{side, pos}]), ex.: uma porta na parede entre duas salas vizinhas */
function portasDe(r){
  const l = [];
  if (r.door && r.door.side && r.door.side !== "nenhuma") l.push({ side: r.door.side, tile: doorTile(r) });
  for (const p of r.portas || []) if (p && p.side && p.side !== "nenhuma") l.push({ side: p.side, tile: doorTile({ x: r.x, y: r.y, w: r.w, h: r.h, door: p }) });
  return l;
}
const temPorta = (r, side, tile) => portasDe(r).some(p => p.side === side && p.tile === tile);
function doorTile(r){
  const d=r.door||{side:"baixo",pos:.5};
  if (d.side==="baixo"||d.side==="cima") return r.x + Math.max(0,Math.min(r.w-1, Math.round(d.pos*(r.w-1))));
  if (d.side==="esquerda"||d.side==="direita") return r.y + Math.max(0,Math.min(r.h-1, Math.round(d.pos*(r.h-1))));
  return null;
}
/* Giro/espelho: itens manuais guardam it.rot (0, 90, 180, 270) e it.flip; os automáticos de uma sala
   guardam o ajuste em r.ajustes["k@dx,dy"] (posição relativa à sala, que não muda enquanto a sala tiver o mesmo tamanho). */
const chaveAuto = (it, r) => it.k + "@" + (+(it.x - r.x).toFixed(2)) + "," + (+(it.y - r.y).toFixed(2));
function caixa(it){ // retângulo desenhado (px), já considerando o giro em volta do centro
  const a = ASSETS[it.k], rot = ((it.rot || 0) % 360 + 360) % 360, de = rot === 90 || rot === 270;
  const w = de ? a.h : a.w, h = de ? a.w : a.h, cx = it.x*T + a.w/2, cy = it.y*T + a.h/2;
  return { x: cx - w/2, y: cy - h/2, w, h, cx, cy, rot };
}
/* Para onde um sofá/poltrona olha (0 baixo, 1 esquerda, 2 direita, 3 cima). Sem giro do editor, encostado numa parede
   ele fica de costas para ela (sofá na parede de baixo olha para cima, para dentro da sala). */
function frenteDoEstofado(it){
  if (it.rot || it.flip) return null; // girado à mão: vale o giro
  const a = ASSETS[it.k], r = it.room ? S.rooms.find(q => q.id === it.room) : roomAt(it.x*T + a.w/2, it.y*T + a.h - 4);
  if (!a || !r) return 0;
  const x0 = it.x, x1 = it.x + a.w/T, y0 = it.y, y1 = it.y + a.h/T, perto = 1.3;
  const dBaixo = r.y + r.h - y1, dCima = y0 - r.y, dEsq = x0 - r.x, dDir = r.x + r.w - x1;
  const largo = a.w / T > 1.4;
  const op = [[dBaixo, 3], [dCima, 0], ...(largo ? [] : [[dEsq, 2], [dDir, 1]])].filter(([d]) => d < perto).sort((p, q) => p[0] - q[0]);
  return op.length ? op[0][1] : 0;
}
function desenharItem(c, it, im, px, py){
  if (!it.rot && !it.flip){ c.drawImage(im, px, py); return; }
  const a = ASSETS[it.k], b = caixa(it);
  c.save(); c.translate(Math.round(b.cx), Math.round(b.cy)); if (b.rot) c.rotate(b.rot * Math.PI / 180); if (it.flip) c.scale(-1, 1);
  c.drawImage(im, -a.w/2, -a.h/2); c.restore();
}
/* No escritório (window.CACHE_ITENS) a lista de móveis é calculada uma vez por mapa: antes era refeita várias vezes por quadro. */
let _itensCache = null, _itensDe = null;
function invalidarItens(){ _itensCache = null; }
function allItems(){
  if (window.CACHE_ITENS && _itensCache && _itensDe === S) return _itensCache;
  const out=[];
  for (const r of S.rooms) if (r.auto) for (const it of layout(r)){ const aj = r.ajustes && r.ajustes[chaveAuto(it, r)]; if (aj){ if (aj.rot) it.rot = aj.rot; if (aj.flip) it.flip = true; } out.push(it); }
  for (const it of S.items) if (!(window.OCULTAR_PESSOAS && /^pessoa/.test(it.k))) out.push(it);
  if (window.DECORACAO) for (const it of window.DECORACAO) if (ASSETS[it.k]) out.push(it); // decoração temática dos eventos (não fica salva no mapa)
  if (window.CACHE_ITENS){ _itensCache = out; _itensDe = S; }
  return out;
}
/* Itens de mesa (monitor, teclado, mouse, notebook, gabinete, cafeteira, porta-retrato)
   sempre ficam na camada de cima da mesa onde estão apoiados. */
const SOBRE_MESA = /^(monitor$|teclado|mouse$|notebook$|gabinete$|porta_retrato$|cafeteira$|tv$|tv_off$)/;
const E_MESA = /^(mesa|pulpito$)/;
let MESAS = [];
function apoiarNasMesas(items){
  MESAS = items.filter(i => E_MESA.test(i.k) && ASSETS[i.k]);
  for (const it of items) it._sobre = topoDaMesa(it);
}
function topoDaMesa(it){
  if (!SOBRE_MESA.test(it.k) || !ASSETS[it.k]) return null;
  if (!MESAS.length && typeof S !== "undefined" && S) MESAS = allItems().filter(i => E_MESA.test(i.k) && ASSETS[i.k]);
  const a = ASSETS[it.k], cx = it.x*T + a.w/2, by = it.y*T + a.h;
  let topo = null;
  for (const m of MESAS){
    const b = ASSETS[m.k], mx = m.x*T, my = m.y*T;
    if (cx > mx && cx < mx + b.w && by > my - 8 && by <= my + b.h + 6){
      const k = my + b.h; if (topo === null || k > topo) topo = k;
    }
  }
  const frente = /^(teclado|mouse$)/.test(it.k) ? 0.5 : 0; // teclado e mouse na frente dos monitores
  return topo === null ? null : topo + 1 + frente + by/1000;
}
function sortKey(it){
  if (it._sobre != null) return it._sobre;
  if (it._sobre === undefined && SOBRE_MESA.test(it.k)){ const v = topoDaMesa(it); if (v != null) return v; }
  if (it.sort!=null) return it.sort;
  if (it.z==="wall" || it.k==="projecao"){ const r=it.room && roomById(it.room); return (r? r.y*T : it.y*T) + 0.5; }
  if (it.rot){ const b = caixa(it); return b.y + b.h; }
  return it.y*T + ASSETS[it.k].h;
}

function buildPatterns(c){ for (const k of FLOORS) PAT[k] = c.createPattern(IMG[k], "repeat"); }

/* Desenha piso, móveis e paredes. extra = [{sort, draw(c)}] entra na ordem de profundidade (ex.: avatares). */
/* parte do mundo que aparece no canvas (px do mundo), com folga: o que está fora não é desenhado */
function areaVisivel(c, folga = 64){
  let m; try { m = c.getTransform().inverse(); } catch (e) { return null; }
  const W = c.canvas.width, H = c.canvas.height, xs = [], ys = [];
  for (const [sx, sy] of [[0,0],[W,0],[0,H],[W,H]]){ xs.push(m.a*sx + m.c*sy + m.e); ys.push(m.b*sx + m.d*sy + m.f); }
  return { x0: Math.min(...xs) - folga, y0: Math.min(...ys) - folga, x1: Math.max(...xs) + folga, y1: Math.max(...ys) + folga };
}
const naArea = (v, x, y, w, h) => !v || (x + w >= v.x0 && x <= v.x1 && y + h >= v.y0 && y <= v.y1);
function itemVisivel(v, it){ if (!v) return true; const a = ASSETS[it.k]; if (!a) return false; return naArea(v, it.x*T - 16, it.y*T - 16, Math.max(a.w, a.h) + 32, Math.max(a.w, a.h) + 32); }
function drawWorld(c, extra){
  const v = window.SEM_RECORTE ? null : areaVisivel(c);
  // ground
  c.fillStyle = PAT.f_grama; if (v) c.fillRect(Math.max(0, v.x0), Math.max(0, v.y0), Math.min(S.w*T, v.x1) - Math.max(0, v.x0), Math.min(S.h*T, v.y1) - Math.max(0, v.y0)); else c.fillRect(0,0,S.w*T,S.h*T);
  // floors
  for (const r of S.rooms){ if (!naArea(v, r.x*T, r.y*T, r.w*T, r.h*T)) continue; c.fillStyle = PAT[r.floor || TYPES[r.type].floor] || PAT.f_madeira; c.fillRect(r.x*T, r.y*T, r.w*T, r.h*T); }
  const items = allItems();
  const floorItems = items.filter(i=>i.z==="floor" && itemVisivel(v, i));
  for (const it of floorItems) desenharItem(c, it, IMG[it.k], Math.round(it.x*T), Math.round(it.y*T));
  luzAmbiente(c, items, v);
  // drawables
  const D = [];
  for (const r of S.rooms){
    if (TYPES[r.type].noWalls || !naArea(v, r.x*T, (r.y-2)*T, r.w*T, 2*T)) continue;
    const dt = doorTile(r), glass = TYPES[r.type].glass;
    for (let tx=r.x; tx<r.x+r.w; tx++){
      if (!naArea(v, tx*T, (r.y-2)*T, T, 2*T)) continue;
      let k = glass ? "parede_vidro" : "parede";
      if (temPorta(r, "cima", tx)) k = r.type==="reuniao" ? "porta_privada" : "porta";
      D.push({k, x:tx, y:r.y-2, sort:r.y*T-0.5, wallpiece:true});
    }
  }
  apoiarNasMesas(items);
  for (const it of items) if (it.z!=="floor" && itemVisivel(v, it)) D.push(it);
  if (extra) for (const e of extra) D.push(e);
  D.sort((a,b)=>sortKey(a)-sortKey(b));
  for (const it of D){
    if (it.draw){ it.draw(c); continue; }
    if (it.agente && window.AGENTES_FORA && AGENTES_FORA.has(it.agente)) continue; // agente levantou da cadeira
    const im = IMG[it.k]; if (!im) continue;
    const px = Math.round(it.x*T), py = Math.round(it.y*T);
    desenharItem(c, it, im, px, py);
    if (it.k==="placa" && it.label){
      c.save(); c.fillStyle="#fff"; c.font="bold 8px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle";
      c.fillText(String(it.label).toUpperCase().slice(0,12), px+35, py+17); c.restore();
    }
  }
  // side + bottom wall caps
  for (const r of S.rooms){ if (!TYPES[r.type].noWalls && naArea(v, r.x*T - 8, (r.y-2)*T, r.w*T + 16, (r.h+2)*T + 8)) drawCaps(c, r); }
}
/* Acabamento de luz: sombra de contato sob os móveis e sombra suave junto às paredes (desliga com window.SEM_SOMBRAS). */
function luzAmbiente(c, items, v){
  if (window.SEM_SOMBRAS) return;
  c.save();
  for (const r of S.rooms){
    if (TYPES[r.type].noWalls || !naArea(v, r.x*T, r.y*T, r.w*T, r.h*T)) continue;
    const x0 = r.x*T, y0 = r.y*T, x1 = (r.x+r.w)*T, y1 = (r.y+r.h)*T;
    let gr = c.createLinearGradient(0, y0, 0, y0 + 34); gr.addColorStop(0, "rgba(20,14,30,.26)"); gr.addColorStop(1, "rgba(20,14,30,0)");
    c.fillStyle = gr; c.fillRect(x0, y0, x1 - x0, 34);
    gr = c.createLinearGradient(x0, 0, x0 + 16, 0); gr.addColorStop(0, "rgba(20,14,30,.16)"); gr.addColorStop(1, "rgba(20,14,30,0)");
    c.fillStyle = gr; c.fillRect(x0, y0, 16, y1 - y0);
    gr = c.createLinearGradient(x1, 0, x1 - 16, 0); gr.addColorStop(0, "rgba(20,14,30,.16)"); gr.addColorStop(1, "rgba(20,14,30,0)");
    c.fillStyle = gr; c.fillRect(x1 - 16, y0, 16, y1 - y0);
  }
  c.fillStyle = "rgba(20,14,30,.16)";
  for (const it of items){
    if (it.z==="floor" || it.z==="wall" || SEM_COLISAO.test(it.k) || /^(rack_servidor|telao|tv|quadro|relogio|parede)/.test(it.k) || !itemVisivel(v, it)) continue;
    const a = ASSETS[it.k]; if (!a) continue;
    const b = caixa(it), cx = b.x + b.w/2, by = b.y + b.h - 3, rx = Math.max(8, b.w*0.46);
    c.beginPath(); c.ellipse(cx, by, rx, Math.min(9, 4 + rx*0.12), 0, 0, Math.PI*2); c.fill();
  }
  c.restore();
}
function drawCaps(c, r){
  const band = (x,y,w,h) => { if (w <= 0 || h <= 0) return; c.fillStyle="#2a2333"; c.fillRect(x,y,w,h); c.fillStyle="#efe9dc"; c.fillRect(x+1,y+1,w-2,h-2); };
  const x0=r.x*T, y0=r.y*T, x1=(r.x+r.w)*T, y1=(r.y+r.h)*T, portas = portasDe(r);
  // esquerda e direita: faixa com um vão em cada porta
  for (const [sd, X] of [["esquerda", x0-4], ["direita", x1-4]]){
    const vaos = portas.filter(p => p.side === sd).map(p => p.tile*T).sort((a,b) => a-b);
    let ini = y0-T*2+9;
    for (const gy of vaos){ band(X, ini, 8, gy-ini); c.fillStyle="rgba(120,90,60,.55)"; c.fillRect(X-6, gy+4, 20, T-8); ini = gy+T; }
    band(X, ini, 8, y1+4-ini);
  }
  const vaos = portas.filter(p => p.side === "baixo").map(p => p.tile*T).sort((a,b) => a-b);
  let ini = x0-4;
  for (const gx of vaos){ band(ini, y1-4, gx-ini, 8); c.fillStyle="rgba(120,90,60,.55)"; c.fillRect(gx+4, y1-6, T-8, 12); ini = gx+T; }
  band(ini, y1-4, x1+4-ini, 8);
}

/* ---------- colisão (grade de 16 px) ---------- */
const C16 = 16;
const SEM_COLISAO = /^(cadeira_|pessoa|npc_|pet$|tapete$|f_palco$|palco_frente$|placa$|logo$|relogio$|quadro_avisos$|janela$|porta_retrato$|monitor$|teclado|mouse$|notebook$|gabinete$|projecao$)/;
function buildBlocked(){
  const cols = S.w*2, rows = S.h*2, g = new Uint8Array(cols*rows);
  const set = (cx, cy) => { if (cx>=0 && cy>=0 && cx<cols && cy<rows) g[cy*cols+cx] = 1; };
  for (const r of S.rooms){
    if (TYPES[r.type].noWalls) continue;
    const x0 = r.x*2, x1 = (r.x+r.w)*2, y0 = r.y*2, y1 = (r.y+r.h)*2;
    for (let cx=x0; cx<x1; cx++){ // parede de cima (2 tiles de altura)
      const porta = temPorta(r, "cima", Math.floor(cx/2));
      for (let cy=y0-4; cy<y0; cy++) if (!porta) set(cx, cy);
    }
    for (let cy=y0-4; cy<=y1; cy++){
      const porta = (t) => cy<y1 && cy>=y0 && temPorta(r, t, Math.floor(cy/2));
      if (!porta("esquerda")) set(x0-1, cy);
      if (!porta("direita")) set(x1, cy);
    }
    for (let cx=x0-1; cx<=x1; cx++){ if (!(cx>=x0 && cx<x1 && temPorta(r, "baixo", Math.floor(cx/2)))) set(cx, y1); }
  }
  for (const it of allItems()){
    if (it.z==="floor" || it.z==="wall" || it.deco || SEM_COLISAO.test(it.k)) continue;
    const a = ASSETS[it.k]; if (!a) continue;
    const b = caixa(it), px0 = b.x + 4, px1 = b.x + b.w - 4, pb = b.y + b.h - 2, pt = pb - Math.min(b.h*0.45, 26);
    for (let cy=Math.floor(pt/C16); cy<=Math.floor(pb/C16); cy++) for (let cx=Math.floor(px0/C16); cx<=Math.floor(px1/C16); cx++) set(cx, cy);
  }
  return {cols, rows, g, blocked(cx, cy){ return cx<0 || cy<0 || cx>=cols || cy>=rows || g[cy*cols+cx]===1; }};
}
/* Caminho mais curto (BFS em 8 direções) entre duas células livres. */
function findPath(grid, sx, sy, tx, ty){
  if (grid.blocked(tx, ty)) { // procura a célula livre mais próxima do destino
    let best=null, bd=1e9;
    for (let r=1; r<6 && !best; r++) for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++){
      const x=tx+dx, y=ty+dy; if (!grid.blocked(x,y)){ const d=dx*dx+dy*dy; if (d<bd){bd=d; best=[x,y];} } }
    if (!best) return null; [tx, ty] = best;
  }
  const {cols, rows} = grid, prev = new Int32Array(cols*rows).fill(-1), start = sy*cols+sx, goal = ty*cols+tx;
  const q = [start]; prev[start] = start;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (let qi=0; qi<q.length; qi++){
    const cur = q[qi]; if (cur===goal) break;
    const cx = cur%cols, cy = (cur/cols)|0;
    for (const [dx,dy] of dirs){
      const nx=cx+dx, ny=cy+dy; if (grid.blocked(nx,ny)) continue;
      if (dx && dy && (grid.blocked(cx+dx,cy) || grid.blocked(cx,cy+dy))) continue;
      const n = ny*cols+nx; if (prev[n]!==-1) continue; prev[n]=cur; q.push(n);
    }
  }
  if (prev[goal]===-1) return null;
  const path=[]; for (let c=goal; c!==start; c=prev[c]) path.push([(c%cols)*C16+8, ((c/cols)|0)*C16+8]);
  return path.reverse();
}
