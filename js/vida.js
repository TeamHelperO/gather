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
    const trabalho = it.k === "cadeira_cima" && mesas.some(m => it.x + 0.5 >= m.x - 0.1 && it.x + 0.5 <= m.x + 2.1 && it.y - m.y > 0.3 && it.y - m.y < 1.3);
    d.pts.forEach(([px, py], i) => {
      const sx = it.x*T + px, sy = it.y*T + py, sala = roomAt(sx, sy);
      out.push({ id: `${it.id || it.k + "_" + it.x + "_" + it.y}_${i}`, k: it.k, sx, sy, face: d.face, r: d.r, trabalho,
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
  levantar(){ const s = this.assento; if (!s) return; s.ocupante = null; this.assento = null; this.saiuDe = s; if (this.volta){ this.x = this.volta.x; this.y = this.volta.y; } }
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
    if (this.conversa && this.falando) return desenhaBalao(g, bx - 10, by, "#ffffff", "#2a2333", t, "fala");
    if (this.assento && this.assento.trabalho) return desenhaBalao(g, bx - 10, by, "#e7f1fb", "#2438b8", t, "pc");
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

/* ---------- colegas de teste (bots) ---------- */
const NOMES_BOTS = ["Bruno", "Ana", "Carla", "Eva", "Diego", "Gabi", "Júlia", "Hugo"]; // na ordem de assets/npcs/npc1..8.png
function pontoLivreAleatorio(grid){
  for (let k = 0; k < 200; k++){
    const r = S.rooms[Math.floor(Math.random()*S.rooms.length)]; if (!r) break;
    const x = (r.x + 0.5 + Math.random()*(r.w - 1))*T, y = (r.y + 0.5 + Math.random()*(r.h - 1))*T;
    if (!grid.blocked(Math.floor(x/C16), Math.floor(y/C16))) return [x, y];
  }
  return null;
}
function irPara(a, grid, x, y){
  const p = findPath(grid, Math.floor(a.x/C16), Math.floor(a.y/C16), Math.floor(x/C16), Math.floor(y/C16));
  a.path = p && p.length ? p : null; return !!a.path;
}
function pensarBot(a, grid, assentos, jogador, bots, dt){
  // para quando você chega perto e fica parado
  if (jogador && !jogador.moving && Math.hypot(jogador.px - a.px, jogador.py - a.py) < DIST_CONVERSA - 4){
    if (!a.assento){ a.path = null; a.alvoAssento = null; } a.timer = Math.max(a.timer, 2); return; }
  // dois colegas que se cruzam às vezes param para conversar
  if (a.ficaConversa > 0){ a.ficaConversa -= dt; return; }
  if (a.path && !a.assento) for (const b of bots){
    if (b === a || b.assento || !b.path || b.ficaConversa > 0) continue;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 34 && Math.random() < 0.02){
      a.path = b.path = null; a.alvoAssento = b.alvoAssento = null; a.ficaConversa = b.ficaConversa = 4 + Math.random()*5; a.timer = b.timer = 0; return; }
  }
  a.timer -= dt;
  if (a.path || a.timer > 0) return;
  if (a.assento){ a.levantar(); a.timer = 1 + Math.random()*2; return; }
  if (a.alvoAssento){ const s = a.alvoAssento; a.alvoAssento = null;
    if (!s.ocupante && Math.hypot(s.sx - a.x, s.sy + 6 - a.y) < s.r + 20){ a.sentar(s); a.timer = s.trabalho ? 25 + Math.random()*35 : 10 + Math.random()*15; return; } }
  const r = Math.random(), livres = assentos.filter(s => !s.ocupante);
  let alvo = null;
  if (r < 0.6) alvo = livres.filter(s => s.trabalho); else if (r < 0.85) alvo = livres.filter(s => !s.trabalho);
  if (alvo && alvo.length){
    const s = alvo[Math.floor(Math.random()*alvo.length)];
    if (irPara(a, grid, s.sx, s.sy + 6)){ a.alvoAssento = s; return; }
  }
  const p = pontoLivreAleatorio(grid); if (p) irPara(a, grid, p[0], p[1]);
  a.timer = 2 + Math.random()*4;
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
