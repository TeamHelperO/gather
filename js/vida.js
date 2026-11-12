/* Vida no escritório: assentos, sentar sozinho, trabalhar no PC e conversar.
   Usado por escritorio.html. Depende de mapa-core.js (S, T, allItems, findPath, C16, roomAt). */

/* ---------- assentos ---------- */
const ASSENTOS_DEF = {
  cadeira_cima:    { pts: [[16, 20]], face: "costas", r: 20 },
  cadeira_baixo:   { pts: [[16, 22]], face: "frente", r: 20 },
  cadeira_esq:     { pts: [[16, 22]], face: "frente", r: 20 },
  cadeira_dir:     { pts: [[16, 22]], face: "frente", r: 20 },
  cadeira_plateia: { pts: [[16, 18]], face: "costas", r: 18 },
  sofa:            { pts: [[22, 22], [48, 22], [74, 22]], face: "frente", r: 30 },
  poltrona:        { pts: [[16, 22]], face: "frente", r: 30 },
  pufe:            { pts: [[16, 16]], face: "frente", r: 28 },
};
function construirAssentos(){
  const itens = allItems(), out = [];
  const mesas = itens.filter(i => i.k === "mesa");
  for (const it of itens){
    const d = ASSENTOS_DEF[it.k]; if (!d) continue;
    const a = ASSETS[it.k], base = it.y*T + a.h;
    const mesa = it.k === "cadeira_cima" ? mesas.find(m => it.x + 0.5 >= m.x - 0.1 && it.x + 0.5 <= m.x + 2.1 && it.y - m.y > 0.3 && it.y - m.y < 1.3) : null;
    const trabalho = !!mesa;
    const monitores = mesa ? itens.filter(o => (o.k === "monitor" || o.k === "notebook") && o.x >= mesa.x - 0.1 && o.x <= mesa.x + 1.6 && o.y >= mesa.y - 1 && o.y <= mesa.y + 0.2) : [];
    d.pts.forEach(([px, py], i) => {
      const sx = it.x*T + px, sy = it.y*T + py, sala = roomAt(sx, sy);
      out.push({ id: `${it.id || it.k + "_" + it.x + "_" + it.y}_${i}`, k: it.k, sx, sy, face: d.face, r: d.r, trabalho, monitores,
        sort: d.face === "costas" ? base - 1 : base + 1, sala: sala ? sala.name : null, ocupante: null });
    });
  }
  return out;
}
function assentoPerto(assentos, x, y){
  let best = null, bd = 1e9;
  for (const s of assentos){ if (s.ocupante) continue; const d = Math.hypot(s.sx - x, s.sy + 6 - y); if (d < s.r && d < bd){ bd = d; best = s; } }
  return best;
}

/* ---------- atores (você e os colegas) ---------- */
class Ator {
  constructor(o){ Object.assign(this, { dir: 0, frame: 0, anim: 0, path: null, moving: false, assento: null, emote: null, emoteT: 0,
    conversa: null, falaT: 0, parado: 0, saiuDe: null, bot: false }, o); }
  get px(){ return this.assento ? this.assento.sx : this.x; }
  get py(){ return this.assento ? this.assento.sy + 6 : this.y; }
  sentar(s){ if (s.ocupante && s.ocupante !== this) return false; this.levantar(); s.ocupante = this; this.assento = s; this.volta = {x: this.x, y: this.y};
    this.path = null; this.emote = null; this.dir = s.face === "costas" ? 3 : 0; return true; }
  levantar(){ const s = this.assento; if (!s) return; s.ocupante = null; this.assento = null; this.saiuDe = s; if (this.volta){ this.x = this.volta.x; this.y = this.volta.y; this.volta = null; } }
  olharPara(o){ if (this.assento) return; const dx = o.px - this.px, dy = o.py - this.py;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); }
  sort(){ return this.assento ? this.assento.sort : this.y + 0.5; }
  draw(g, t){
    const sh = this.sheet; if (!sh) return;
    let row = this.dir, col = this.frame, x = this.x - 16, y = this.y - 45;
    if (this.assento){
      const s = this.assento; row = 4;
      const fala = this.conversa && this.falando;
      if (s.face === "costas") col = 2 + ((this.assento.trabalho && !fala) ? Math.floor(t*5) % 2 : 0);
      else col = 0 + (fala ? Math.floor(t*3) % 2 : 0);
      x = s.sx - 16; y = s.sy - 40;
    } else {
      g.fillStyle = "rgba(20,15,30,.25)"; g.beginPath(); g.ellipse(this.x, this.y + 1, 8, 3, 0, 0, Math.PI*2); g.fill();
      if (this.emote != null && !this.moving){ row = this.emote; const n = row === 6 ? 6 : 4; col = Math.floor(this.emoteT*7) % n; }
      else if (this.conversa && this.falando && !this.moving){ row = this.dir; col = 0; y += (Math.floor(t*4) % 2) ? -1 : 0; }
    }
    g.drawImage(sh, col*32, row*48, 32, 48, Math.round(x), Math.round(y), 32, 48);
  }
  /* balões acima da cabeça (coordenadas do mundo) */
  balao(g, t){
    const bx = Math.round(this.px), by = Math.round((this.assento ? this.assento.sy - 40 : this.y - 45) - 14);
    if ((this.conversa || this.vozReal) && this.falando) return desenhaBalao(g, bx - 10, by, "#ffffff", "#2a2333", t, "fala");
  }
}
function desenhaBalao(g, x, y, fundo, tinta, t, tipo){
  const w = 20, h = 11;
  g.fillStyle = "#2a2333"; g.fillRect(x - 1, y - h - 1, w + 2, h + 2);
  g.fillStyle = fundo; g.fillRect(x, y - h, w, h);
  g.fillStyle = "#2a2333"; g.fillRect(x + 2, y + 1, 3, 2); g.fillStyle = fundo; g.fillRect(x + 3, y, 2, 2);
  if (tipo === "fala"){
    const n = 1 + Math.floor(t*3) % 3; g.fillStyle = tinta;
    for (let i = 0; i < n; i++) g.fillRect(x + 4 + i*5, y - 6, 3, 3);
  } else { // teclando: telinha + linhas de código
    g.fillStyle = tinta; g.fillRect(x + 3, y - 9, 8, 6); g.fillStyle = "#8fa0ff"; g.fillRect(x + 4, y - 8, 6, 4);
    const k = Math.floor(t*6) % 4; g.fillStyle = tinta;
    for (let i = 0; i < 3; i++) g.fillRect(x + 13, y - 8 + i*2, (i + k) % 3 + 2, 1);
  }
}

/* ---------- conversas ---------- */
const DIST_CONVERSA = 52;
function atualizarConversas(atores, dt, aoComecar){
  for (const a of atores){ a._perto = null; }
  for (let i = 0; i < atores.length; i++) for (let j = i + 1; j < atores.length; j++){
    const a = atores[i], b = atores[j];
    if (a.moving || b.moving) continue;
    if (!a.assento && a.emote != null || !b.assento && b.emote != null) continue;
    const d = Math.hypot(a.px - b.px, a.py - b.py);
    if (d > DIST_CONVERSA) continue;
    if (!a._perto || d < a._pertoD){ a._perto = b; a._pertoD = d; }
    if (!b._perto || d < b._pertoD){ b._perto = a; b._pertoD = d; }
  }
  for (const a of atores){
    const o = a._perto;
    if (o){
      if (a.conversa !== o){ a.conversa = o; a.falaT = 0; if (aoComecar) aoComecar(a, o); }
      a.olharPara(o); a.falaT += dt;
    } else { a.conversa = null; }
  }
  // quem fala: alternam a cada ~1,6 s (o de id menor começa)
  for (const a of atores){ if (!a.conversa) { a.falando = false; continue; }
    const turno = Math.floor((a.falaT + (a.id < a.conversa.id ? 0 : 1.6)) / 1.6) % 2; a.falando = turno === 0; }
}

function moverAtor(a, dt, vx, vy, livre, vel){
  const mag = Math.hypot(vx, vy);
  a.moving = mag > 0.01;
  if (a.moving){
    if (mag > 1){ vx /= mag; vy /= mag; }
    const sx = vx*vel*dt, sy = vy*vel*dt;
    if (!livre || livre(a.x + sx, a.y)) a.x += sx;
    if (!livre || livre(a.x, a.y + sy)) a.y += sy;
    a.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : (vy < 0 ? 3 : 0);
    a.anim += dt*8; a.frame = 1 + (Math.floor(a.anim) % 4); a.parado = 0;
  } else { a.frame = 0; a.parado += dt; }
}
function seguirCaminho(a){
  if (!a.path) return [0, 0];
  const [tx, ty] = a.path[0]; const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 3){ a.path.shift(); if (!a.path.length) a.path = null; return [0, 0]; }
  return [dx/d, dy/d];
}

/* ---------- telas dos monitores ----------
   Monitor (sprite 32x32): tela em x 5..26, y 6..20. Desligado = descanso escuro; com alguém trabalhando = código sendo digitado. */
const CORES_CODIGO = ["#8fa0ff", "#3fbf5f", "#ffffff", "#f2a33a", "#e07aa8", "#8fd0f0"];
const TELAS = { monitor: [5, 6, 22, 15], notebook: [8, 6, 16, 12] };
function desenharMonitor(g, it, ativo, t){
  const [ox, oy, w, h] = TELAS[it.k] || TELAS.monitor;
  const x = Math.round(it.x*T) + ox, y = Math.round(it.y*T) + oy;
  let semente = 0; for (const c of String(it.id || it.x + "," + it.y)) semente = (semente*31 + c.charCodeAt(0)) >>> 0;
  if (!ativo){
    g.fillStyle = "#141c2c"; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(143,160,255,.25)"; const bx = x + 3 + Math.floor((Math.sin(t*0.6 + semente) + 1)*7), by = y + 4 + Math.floor((Math.cos(t*0.5 + semente) + 1)*3);
    g.fillRect(bx, by, 3, 2); // descanso de tela
    return;
  }
  g.fillStyle = "#1f2f4a"; g.fillRect(x, y, w, h);
  const linhasVisiveis = Math.floor((h - 1)/2), vel = 7 + (semente % 4); // caracteres por segundo
  const total = Math.floor(t*vel + (semente % 50));
  const larg = i => 4 + ((semente >>> (i % 16)) + i*7) % 13;      // largura de cada linha
  const recuo = i => ((semente >>> ((i + 3) % 16)) + i) % 3 * 2;    // indentação
  // descobre em que linha está digitando
  let resto = total, linha = 0; while (resto >= larg(linha)){ resto -= larg(linha); linha++; }
  const primeira = Math.max(0, linha - linhasVisiveis + 1);
  for (let i = primeira; i <= linha; i++){
    const yy = y + 1 + (i - primeira)*2;
    const comp = i < linha ? larg(i) : resto, cor = CORES_CODIGO[((semente >>> (i % 12)) + i) % CORES_CODIGO.length];
    g.fillStyle = cor; g.fillRect(x + 1 + recuo(i), Math.round(yy), Math.min(comp, w - 2 - recuo(i)), 1);
    if (i === linha && Math.floor(t*2.5) % 2 === 0){ g.fillStyle = "#ffffff"; g.fillRect(x + 1 + recuo(i) + Math.min(comp, w - 3 - recuo(i)), Math.round(yy) - 1, 1, 2); }
  }
  g.fillStyle = "rgba(143,160,255,.12)"; g.fillRect(x, y, w, h); // brilho
  g.fillStyle = "#3fbf5f"; g.fillRect(x + Math.floor(w/2) - 1, y + h + 1, 1, 1);    // luz de ligado
}
