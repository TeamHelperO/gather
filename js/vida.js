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
  const mesas = itens.filter(i => i.k === "mesa" || i.k === "mesa_pc");
  const lw = m => ASSETS[m.k].w / T, lh = m => ASSETS[m.k].h / T;
  for (const it of itens){
    const d = ASSENTOS_DEF[it.k]; if (!d) continue;
    const a = ASSETS[it.k], base = it.y*T + a.h;
    const mesa = it.k === "cadeira_cima" ? mesas.find(m => it.x + 0.5 >= m.x - 0.1 && it.x + 0.5 <= m.x + lw(m) + 0.1 && it.y - m.y > lh(m) - 0.7 && it.y - m.y < lh(m) + 0.3) : null;
    const trabalho = !!mesa;
    const monitores = mesa ? itens.filter(o => EQUIP.test(o.k) && o.x >= mesa.x - 0.1 && o.x <= mesa.x + lw(mesa) - 0.4 && o.y >= mesa.y - 1 && o.y <= mesa.y + 0.5) : [];
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
const EQUIP = /^(monitor|notebook|teclado|teclado_rgb|gabinete)$/; // o que "liga" quando alguém senta na mesa
const LIGOU = new Map();   // chave do aparelho -> instante em que ligou (animação de ligar)
const semente = it => { let s = 0; for (const c of String(it.x + "," + it.y)) s = (s*31 + c.charCodeAt(0)) >>> 0; return s; };
const hsl = (h, l = 60, a = 1) => `hsla(${((h % 360) + 360) % 360},90%,${l}%,${a})`;

/* Desenha a parte animada de um aparelho da mesa (tela, teclado, fans). ativo = tem alguém trabalhando. */
function desenharMonitor(g, it, ativo, t){
  if (it.k === "teclado" || it.k === "teclado_rgb") return desenharTeclado(g, it, ativo, t);
  if (it.k === "gabinete") return desenharGabinete(g, it, ativo, t);
  const [ox, oy, w, h] = TELAS[it.k] || TELAS.monitor;
  const x = Math.round(it.x*T) + ox, y = Math.round(it.y*T) + oy, sd = semente(it), chave = it.x + "," + it.y;
  if (!ativo){
    LIGOU.delete(chave);
    g.fillStyle = "#10141f"; g.fillRect(x, y, w, h);
    // descanso de tela: logo quicando e mudando de cor
    const lx = x + 1 + Math.abs(((t*5 + sd) % (2*(w - 5))) - (w - 5)), ly = y + 1 + Math.abs(((t*3.3 + sd/7) % (2*(h - 4))) - (h - 4));
    g.fillStyle = hsl(t*40 + sd, 62, .55); g.fillRect(Math.round(lx), Math.round(ly), 3, 2); g.fillRect(Math.round(lx) + 1, Math.round(ly) + 2, 1, 1);
    g.fillStyle = Math.floor(t + sd) % 3 === 0 ? "#f2a33a" : "#7a5418"; g.fillRect(x + Math.floor(w/2), y + h + 1, 1, 1); // luz de espera
    return;
  }
  if (!LIGOU.has(chave)) LIGOU.set(chave, t);
  const idade = t - LIGOU.get(chave);
  if (idade < 0.7){ // ligando: linha branca que abre em tela
    g.fillStyle = "#05070c"; g.fillRect(x, y, w, h);
    const k = Math.min(1, idade/0.35), hh = Math.max(1, Math.round(h*k));
    g.fillStyle = idade < 0.35 ? "#e8f0ff" : `rgba(143,160,255,${1 - (idade - 0.35)/0.35})`;
    g.fillRect(x, y + Math.floor((h - hh)/2), w, hh);
    return;
  }
  const mix = (sd ^ (sd >>> 7) ^ (sd >>> 13)) >>> 0, app = it.k === "notebook" ? [0, 2, 3, 1][mix % 4] : mix % 4;
  [appCodigo, appTerminal, appDashboard, appDesign][app](g, x, y, w, h, t, sd);
  // reflexo e brilho na mesa
  g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x, y, Math.floor(w/3), 1);
  const brilho = .09 + .03*Math.sin(t*3 + sd);
  g.fillStyle = `rgba(143,190,255,${brilho})`; g.fillRect(x - 2, y + h + 4, w + 4, 5);
  g.fillStyle = "#3fbf5f"; g.fillRect(x + Math.floor(w/2), y + h + 1, 1, 1);
}
function appCodigo(g, x, y, w, h, t, sd){
  g.fillStyle = "#1b2438"; g.fillRect(x, y, w, h);
  g.fillStyle = "#151c2c"; g.fillRect(x, y, 3, h); // números das linhas
  const cw = w - 5, nl = Math.floor((h - 1)/2), vel = 8 + sd % 5, total = Math.floor(t*vel + sd % 60);
  const larg = i => 3 + ((sd >>> (i % 16)) + i*7) % (cw - 4), recuo = i => (((sd >>> ((i + 3) % 16)) + i) % 3)*2;
  let resto = total, linha = 0; while (resto >= larg(linha)){ resto -= larg(linha); linha++; }
  const prim = Math.max(0, linha - nl + 1);
  for (let i = prim; i <= linha; i++){
    const yy = y + 1 + (i - prim)*2, r = recuo(i), comp = Math.min(i < linha ? larg(i) : resto, cw - r);
    g.fillStyle = "#3a4560"; g.fillRect(x + 1, yy, 1, 1);
    let px = x + 4 + r, falta = comp, n = 0;
    while (falta > 0){ const p = Math.min(falta, 2 + ((sd >>> ((i + n) % 13)) + n) % 5); g.fillStyle = CORES_CODIGO[(i*3 + n + sd) % CORES_CODIGO.length]; g.fillRect(px, yy, p, 1); px += p + 1; falta -= p + 1; n++; }
    if (i === linha){ g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(x + 3, yy - 1, w - 3, 2);
      if (Math.floor(t*2.5) % 2 === 0){ g.fillStyle = "#fff"; g.fillRect(Math.min(px, x + w - 1), yy - 1, 1, 2); } }
  }
}
function appTerminal(g, x, y, w, h, t, sd){
  g.fillStyle = "#07090d"; g.fillRect(x, y, w, h);
  const nl = Math.floor((h - 1)/2), passo = Math.floor(t*2.2 + sd % 30);
  for (let i = 0; i < nl; i++){
    const n = passo - (nl - 1 - i), comp = 3 + ((sd >>> (n % 14)) + n*5) % (w - 5), yy = y + 1 + i*2;
    const ok = (n + sd) % 7 === 0;
    g.fillStyle = i === nl - 1 ? "#3fbf5f" : ok ? "#f2a33a" : "rgba(63,191,95,.75)";
    if (i === nl - 1){ g.fillRect(x + 1, yy, 2, 1); const dig = Math.min(comp, Math.floor((t*9) % (comp + 8))); g.fillRect(x + 4, yy, dig, 1);
      if (Math.floor(t*3) % 2 === 0){ g.fillStyle = "#c8ffd6"; g.fillRect(x + 4 + dig, yy - 1, 1, 2); } }
    else g.fillRect(x + 1, yy, comp, 1);
  }
}
function appDashboard(g, x, y, w, h, t, sd){
  g.fillStyle = "#141a2a"; g.fillRect(x, y, w, h);
  g.fillStyle = "#222b44"; g.fillRect(x, y, w, 2); g.fillStyle = "#3fbf5f"; g.fillRect(x + 1, y, 3, 1);
  const top = y + 3, alt = h - 4, mid = top + Math.floor(alt*0.45);
  // linha do gráfico andando
  g.fillStyle = "#e07aa8";
  for (let i = 0; i < w - 2; i++){ const v = Math.sin((i + t*6 + sd)*0.45) + Math.sin((i*0.23 + t*1.7 + sd)); g.fillRect(x + 1 + i, mid - 1 - Math.round((v + 2)*(alt*0.45 - 2)/4), 1, 1); }
  // barras subindo e descendo
  const nb = Math.floor((w - 2)/3);
  for (let i = 0; i < nb; i++){
    const v = .35 + .6*Math.abs(Math.sin(t*0.9 + i*1.3 + sd)), bh = Math.max(1, Math.round(v*(alt*0.5)));
    g.fillStyle = i % 2 ? "#8fa0ff" : "#8fd0f0"; g.fillRect(x + 1 + i*3, y + h - 1 - bh, 2, bh);
  }
}
function appDesign(g, x, y, w, h, t, sd){
  g.fillStyle = "#e9ecf3"; g.fillRect(x, y, w, h);
  g.fillStyle = "#2a2f3c"; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
  const cw2 = Math.floor((w - 6)/2), cards = [[3, 3, cw2, 5, "#8fa0ff"], [4 + cw2, 3, cw2, 5, "#f2a33a"], [3, 9, w - 5, Math.min(3, h - 10), "#3fbf5f"]];
  const sel = Math.floor(t/1.4 + sd) % cards.length;
  cards.forEach(([cx, cy, cw, ch, c], i) => {
    if (cx + cw > w || cy + ch > h) return;
    const pulso = i === sel ? Math.round(Math.sin(t*4)*0.6) : 0;
    g.fillStyle = c; g.fillRect(x + cx - pulso, y + cy - pulso, cw + pulso*2, ch + pulso*2);
    if (i === sel){ g.strokeStyle = "#1f6fff"; g.lineWidth = 1; g.strokeRect(x + cx - 1.5, y + cy - 1.5, cw + 3, ch + 3); }
  });
  const [cx, cy, cw, ch] = cards[sel], f = (t/1.4 + sd) % 1, mx = x + cx + cw - 1 - Math.round((1 - Math.min(1, f*3))*6), my = y + cy + ch - 1;
  g.fillStyle = "#111"; g.fillRect(mx, my, 1, 3); g.fillRect(mx + 1, my + 1, 1, 1); // cursor
}
function desenharTeclado(g, it, ativo, t){
  const x = Math.round(it.x*T), y = Math.round(it.y*T), sd = semente(it), rgb = it.k === "teclado_rgb";
  [[7, 5], [9, 6]].forEach(([yy, x0]) => {
    for (let kx = x0; kx < 27; kx += 2){
      let cor = null;
      if (rgb) cor = hsl(kx*14 - t*140 + yy*20, ativo ? 62 : 48, ativo ? 1 : .8);
      if (ativo && ((Math.floor(t*14) * 7 + kx*3 + yy + sd) % 23) === 0) cor = "#ffffff"; // tecla apertada
      if (cor){ g.fillStyle = cor; g.fillRect(x + kx, y + yy, 1, 1); }
    }
  });
  if (rgb) for (let lx = 4; lx < 28; lx++){ g.fillStyle = hsl(lx*15 - t*140, 58, .9); g.fillRect(x + lx, y + 12, 1, 1); }
}
function desenharGabinete(g, it, ativo, t){
  const x = Math.round(it.x*T), y = Math.round(it.y*T), sd = semente(it), vel = ativo ? 9 : 4;
  [[11, 0], [19, 120]].forEach(([cy, h0]) => {
    const cor = hsl(h0 + t*60 + sd, 60);
    g.fillStyle = "#141420"; g.fillRect(x + 12, y + cy - 3, 7, 7);
    g.strokeStyle = cor; g.lineWidth = 1; g.beginPath(); g.arc(x + 15.5, y + cy + 0.5, 3, 0, Math.PI*2); g.stroke();
    for (let p = 0; p < 3; p++){ // pás girando
      const a = t*vel + p*Math.PI*2/3 + sd;
      g.fillStyle = hsl(h0 + t*60 + sd, 75, .85); g.fillRect(x + 15 + Math.round(Math.cos(a)*1.6), y + cy + Math.round(Math.sin(a)*1.6), 1, 1);
    }
    g.fillStyle = "#fff"; g.fillRect(x + 15, y + cy, 1, 1);
  });
  for (let ly = 8; ly <= 25; ly++){ g.fillStyle = hsl(ly*12 - t*90 + sd, 58, ativo ? .95 : .7); g.fillRect(x + 20, y + ly, 2, 1); }
  g.fillStyle = ativo && Math.floor(t*6 + sd) % 3 === 0 ? "#ff5a5a" : "#3fbf5f"; g.fillRect(x + 11, y + 25, 3, 1); // led de disco
  g.fillStyle = hsl(t*60 + sd, 60, .08); g.fillRect(x + 6, y + 30, 20, 3); // reflexo na mesa
}
