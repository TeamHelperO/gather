/* Área externa arborizada: árvores, pinheiros, arbustos e canteiros de flores na grama em volta das salas.
   Calculado a partir do mapa (sempre igual para todo mundo, sem salvar nada): só onde não há sala,
   deixando 1 bloco livre em volta de cada sala e do corredor para dar para andar por fora.
   As árvores e arbustos têm colisão (ninguém atravessa); as flores ficam no chão. */
(function () {
  function tela(w, h, f) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); f((x, y, ww, hh, cor) => { g.fillStyle = cor; g.fillRect(x, y, ww, hh); }, g); return c; }
  const A = (k, w, h, f, label, extra) => { const c = tela(w, h, f); window.ASSETS[k] = { src: c.toDataURL(), w, h, label, cat: "Natureza", ...(extra || {}) }; return c; };
  // copa redonda em camadas de pixels (sombra embaixo, luz em cima à esquerda)
  const copa = (g, cx, cy, r, cores) => {
    const [esc, med, cla, luz] = cores;
    for (const [dx, dy, rr, c] of [[0, 2, r, esc], [-r * .45, -r * .1, r * .62, med], [r * .45, -r * .05, r * .6, med], [0, -r * .35, r * .7, med], [-r * .3, -r * .5, r * .42, cla], [r * .25, -r * .6, r * .32, cla], [-r * .45, -r * .62, r * .18, luz]]) {
      g.fillStyle = c; g.beginPath(); g.arc(Math.round(cx + dx), Math.round(cy + dy), Math.round(rr), 0, Math.PI * 2); g.fill();
    }
  };
  A("nat_arvore", 48, 64, (R, g) => {
    R(21, 40, 7, 22, "#6b3f22"); R(21, 40, 2, 22, "#8a5a32"); R(17, 60, 15, 3, "#4f2f19");
    copa(g, 24, 26, 19, ["#1f6b3a", "#2f8a47", "#45a85a", "#7cd27e"]);
  }, "Árvore");
  A("nat_arvore2", 48, 64, (R, g) => {
    R(20, 42, 8, 20, "#5a3420"); R(20, 42, 2, 20, "#7a4a2c"); R(16, 60, 16, 3, "#43281a");
    copa(g, 24, 28, 18, ["#2b5a2a", "#3d7a33", "#5a9a3c", "#9cc95a"]);
    for (const [x, y] of [[14, 22], [30, 18], [22, 34], [34, 32]]) R(x, y, 3, 3, "#e5484d"); // frutinhas
  }, "Árvore frutífera");
  A("nat_pinheiro", 32, 64, (R, g) => {
    R(14, 50, 5, 12, "#6b3f22"); R(10, 60, 13, 3, "#4f2f19");
    for (let i = 0; i < 4; i++) { const y = 6 + i * 11, w = 10 + i * 6; g.fillStyle = i % 2 ? "#1d5a36" : "#246b40"; g.beginPath(); g.moveTo(16, y - 6); g.lineTo(16 - w / 2 - 2, y + 12); g.lineTo(16 + w / 2 + 2, y + 12); g.closePath(); g.fill(); R(16 - w / 2, y + 10, w, 2, "#154a2c"); }
    R(15, 2, 2, 6, "#2f8a47");
  }, "Pinheiro");
  A("nat_arbusto", 32, 24, (R, g) => {
    for (const [x, y, r, c] of [[10, 15, 8, "#2a6e35"], [22, 15, 8, "#2a6e35"], [16, 11, 9, "#368a43"], [11, 10, 4, "#4fa85a"], [20, 8, 3, "#6cc070"]]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    R(4, 21, 24, 2, "rgba(0,0,0,.18)");
  }, "Arbusto");
  A("nat_flores", 32, 20, (R) => {
    const cores = ["#e5484d", "#f2c14e", "#ffffff", "#c86bff", "#ff8fb1"]; let s = 11;
    for (let i = 0; i < 14; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const x = 2 + s % 27; s = (s * 1103515245 + 12345) & 0x7fffffff; const y = 3 + s % 14;
      R(x + 1, y + 2, 1, 3, "#2f8a47"); const c = cores[i % cores.length]; R(x, y, 3, 1, c); R(x + 1, y - 1, 1, 3, c); R(x + 1, y, 1, 1, "#ffe08a"); }
  }, "Flores", { z: "floor" });
  A("nat_pedras", 32, 16, (R) => { R(4, 7, 10, 6, "#8a8f99"); R(5, 6, 8, 2, "#a9aeb8"); R(16, 9, 12, 5, "#7a7f89"); R(17, 8, 9, 2, "#9a9fa9"); R(12, 12, 5, 3, "#6a6f79"); }, "Pedras", { z: "floor" });

  /* ---------- versões de cada estação (trocam sozinhas com a data comemorativa ativa) ---------- */
  const neveCopa = (g, cx, cy, r) => { g.fillStyle = "#f4f8fc"; for (const [dx, dy, rr] of [[0, -r * .55, r * .62], [-r * .45, -r * .2, r * .4], [r * .45, -r * .15, r * .38]]) { g.beginPath(); g.arc(Math.round(cx + dx), Math.round(cy + dy), Math.round(rr), Math.PI, 0); g.fill(); } };
  A("nat_arvore_neve", 48, 64, (R, g) => { R(21, 40, 7, 22, "#6b3f22"); R(21, 40, 2, 22, "#8a5a32"); R(17, 60, 15, 3, "#e8eef5"); copa(g, 24, 26, 19, ["#2a5e44", "#3a7656", "#4f8c68", "#9cc7b0"]); neveCopa(g, 24, 26, 19); }, "Árvore com neve");
  A("nat_pinheiro_neve", 32, 64, (R, g) => {
    R(14, 50, 5, 12, "#6b3f22"); R(10, 60, 13, 3, "#e8eef5");
    for (let i = 0; i < 4; i++) { const y = 6 + i * 11, w = 10 + i * 6; g.fillStyle = i % 2 ? "#1d5a36" : "#246b40"; g.beginPath(); g.moveTo(16, y - 6); g.lineTo(16 - w / 2 - 2, y + 12); g.lineTo(16 + w / 2 + 2, y + 12); g.closePath(); g.fill();
      g.fillStyle = "#f4f8fc"; g.beginPath(); g.moveTo(16, y - 6); g.lineTo(16 - w / 4 - 1, y + 3); g.lineTo(16 + w / 4 + 1, y + 3); g.closePath(); g.fill(); R(16 - w / 2, y + 10, w, 2, "#e1e9f2"); }
  }, "Pinheiro com neve");
  A("nat_arbusto_neve", 32, 24, (R, g) => { for (const [x, y, r, c] of [[10, 15, 8, "#2a5e44"], [22, 15, 8, "#2a5e44"], [16, 11, 9, "#3a7656"]]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } g.fillStyle = "#f4f8fc"; for (const [x, y, r] of [[10, 10, 6], [16, 5, 6], [22, 10, 6]]) { g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.fill(); } }, "Arbusto com neve");
  A("nat_neve", 32, 20, (R) => { R(3, 8, 26, 8, "#f4f8fc"); R(6, 5, 18, 4, "#f4f8fc"); R(1, 11, 30, 4, "#e6eef6"); R(9, 6, 5, 1, "#ffffff"); }, "Monte de neve", { z: "floor" });
  A("nat_arvore_seca", 48, 64, (R, g) => {
    g.strokeStyle = "#3b2a22"; g.lineCap = "round";
    const galho = (x, y, a, l, w) => { if (l < 4) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); galho(x2, y2, a - 0.5, l * 0.68, Math.max(1, w - 1)); galho(x2, y2, a + 0.45, l * 0.62, Math.max(1, w - 1)); };
    galho(24, 62, -Math.PI / 2, 20, 5); R(16, 60, 16, 3, "#2a1d16");
    for (const [x, y] of [[12, 18], [34, 14], [20, 10], [38, 26]]) R(x, y, 3, 2, "#c4601a");
  }, "Árvore seca");
  A("nat_abobora", 32, 24, (R) => { R(15, 2, 3, 5, "#4a7a2a"); R(5, 7, 22, 15, "#e07a1f"); R(3, 10, 26, 10, "#e07a1f"); R(11, 7, 2, 15, "#c4601a"); R(19, 7, 2, 15, "#c4601a"); R(9, 11, 4, 3, "#ffd23e"); R(19, 11, 4, 3, "#ffd23e"); R(10, 16, 12, 2, "#ffd23e"); }, "Abóbora acesa");
  A("nat_folhas", 32, 16, (R) => { const c = ["#c4601a", "#e0a03a", "#8a3f1a", "#e07a1f"]; let s = 5; for (let i = 0; i < 12; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; R(2 + s % 27, 3 + (s >> 5) % 10, 3, 2, c[i % 4]); } }, "Folhas secas", { z: "floor" });
  A("nat_arvore_flor", 48, 64, (R, g) => { R(21, 40, 7, 22, "#6b3f22"); R(21, 40, 2, 22, "#8a5a32"); R(17, 60, 15, 3, "#4f2f19"); copa(g, 24, 26, 19, ["#c2577e", "#e07aa8", "#f2a6c6", "#ffe0ee"]); for (const [x, y] of [[12, 22], [30, 16], [22, 34], [36, 30], [18, 12]]) R(x, y, 2, 2, "#ffffff"); }, "Árvore florida");

  /* clima de cada data: troca de árvores, cor da grama e do céu e o que cai do céu */
  const CLIMA = {
    natal: { troca: { nat_arvore: "nat_arvore_neve", nat_arvore2: "nat_arvore_neve", nat_pinheiro: "nat_pinheiro_neve", nat_arbusto: "nat_arbusto_neve", nat_flores: "nat_neve", nat_pedras: "nat_neve" }, grama: "rgba(240,246,252,.78)", grama3d: ["#e9f0f6", "#dde6ef"], ceu: "#c9d6e3", cai: "neve" },
    ano_novo: { troca: { nat_arvore: "nat_arvore_neve", nat_arbusto: "nat_arbusto_neve" }, grama: "rgba(20,24,60,.35)", grama3d: ["#4f7a52", "#47704a"], ceu: "#1d2240", cai: "brilho" },
    halloween: { troca: { nat_arvore: "nat_arvore_seca", nat_arvore2: "nat_arvore_seca", nat_arbusto: "nat_abobora", nat_flores: "nat_folhas" }, grama: "rgba(60,40,70,.38)", grama3d: ["#56663a", "#4c5b33"], ceu: "#3b2a4f", cai: "folhas" },
    pascoa: { troca: { nat_arvore: "nat_arvore_flor", nat_arvore2: "nat_arvore_flor" }, grama: null, grama3d: null, ceu: "#bfe0ff", cai: "petalas" },
    carnaval: { troca: {}, grama: null, grama3d: null, ceu: "#a9cdf0", cai: "confete" },
    junina: { troca: {}, grama: "rgba(255,170,60,.12)", grama3d: null, ceu: "#f2b27a", cai: null },
  };
  const temaAtual = () => (window.Decoracao && Decoracao.clima) || null;
  const climaAtual = () => CLIMA[temaAtual()] || null;
  const chave = k => { const c = climaAtual(); return (c && c.troca[k]) || k; };

  /* ---------- onde plantar ---------- */
  let cache = null, de = null;
  function montar() {
    const W = S.w, H = S.h, oc = new Uint8Array(W * H);
    const marca = (x0, y0, x1, y1) => { for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) oc[y * W + x] = 1; };
    for (const r of S.rooms) marca(r.x - 1, r.y - 3, r.x + r.w + 1, r.y + r.h + 1); // sala + parede de cima + 1 bloco para passar
    for (const it of S.items) { const a = ASSETS[it.k]; if (a) marca(it.x - 1, it.y - 1, it.x + a.w / T + 1, it.y + a.h / T + 1); }
    const livreEm = (x, y, w, h) => { if (x < 0 || y < 0 || x + w > W || y + h > H) return false; for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy++) for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx++) if (oc[yy * W + xx]) return false; return true; };
    let s = (W * 7919 + H * 104729) >>> 0;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const out = [];
    // árvores numa grade com variação (parece natural e deixa caminhos entre elas)
    for (let gy = 0; gy < H; gy += 2.1) for (let gx = 0; gx < W; gx += 2.2) {
      const p = rnd(), k = p < .34 ? "nat_arvore" : p < .52 ? "nat_arvore2" : p < .72 ? "nat_pinheiro" : "nat_arbusto";
      const a = ASSETS[k], w = a.w / T, h = a.h / T, x = gx + rnd() * 0.9, y = gy + rnd() * 0.8;
      if (rnd() < 0.12 || !livreEm(x, y, w, h)) continue; // algumas clareiras
      out.push({ k: chave(k), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, id: "nat_" + out.length, natureza: true });
      marca(x - 0.3, y + h * 0.4, x + w + 0.3, y + h + 0.3);
    }
    // flores e pedras no chão, nos espaços que sobraram (inclusive na faixa em volta das salas)
    for (let i = 0; i < W * H / 9; i++) {
      const k = rnd() < 0.78 ? "nat_flores" : "nat_pedras", a = ASSETS[k], x = rnd() * (W - 1), y = rnd() * (H - 1);
      if (S.rooms.some(r => x + a.w / T > r.x - 0.2 && x < r.x + r.w + 0.2 && y + a.h / T > r.y - 2.2 && y < r.y + r.h + 0.2)) continue;
      if (out.some(o => o.z === "floor" && Math.abs(o.x - x) < 1.2 && Math.abs(o.y - y) < 0.8)) continue;
      if (!livreEm(x, y, 0.5, 0.5) && rnd() < 0.6) continue;
      out.push({ k: chave(k), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: "floor", id: "nat_" + out.length, natureza: true });
    }
    return out.concat(ambiente());
  }
  /* dentro das salas: quadros nos trechos livres da parede de cima e plantas nos cantos vazios (itens da biblioteca grátis) */
  function ambiente() {
    if (!ASSETS.bib_quadro_paisagem) return [];
    const base = [];
    for (const r of S.rooms) if (r.auto) base.push(...layout(r).map(it => Object.assign({ room: r.id }, it)));
    base.push(...S.items);
    const out = [], quadros = ["bib_quadro_paisagem", "bib_quadro_mar", "bib_quadro_sol"], plantas = ["bib_planta_vaso", "bib_planta_1", "bib_planta_2"];
    const cx0 = it => it.x, cx1 = it => it.x + (ASSETS[it.k] ? ASSETS[it.k].w / T : 1);
    S.rooms.forEach((r, ri) => {
      if (TYPES[r.type].noWalls || r.type === "corredor") return;
      const dentro = it => cx1(it) > r.x && cx0(it) < r.x + r.w;
      // parede de cima: o que já ocupa (itens de parede, telões, móveis altos encostados) e a porta
      const cheio = base.filter(it => dentro(it) && ASSETS[it.k] && it.y < r.y + 0.8 && it.y + ASSETS[it.k].h / T > r.y - 2.2 && (it.z === "wall" || ASSETS[it.k].h >= 48 || it.y < r.y + 0.2)).map(it => [cx0(it) - 0.3, cx1(it) + 0.3]);
      for (const pt of portasDe(r)) if (pt.side === "cima") cheio.push([pt.tile - 0.2, pt.tile + 1.2]);
      const livre = (x, w) => x >= r.x + 0.3 && x + w <= r.x + r.w - 0.3 && !cheio.some(([a, b]) => x < b && x + w > a);
      let n = 0;
      for (let x = r.x + 0.4; x < r.x + r.w - 1 && n < 2; x += 0.25) {
        const k = r.type === "trabalho" || r.type === "ti" || r.type === "edicao" ? (n === 0 ? "bib_mural" : quadros[(ri + n) % 3]) : quadros[(ri + n) % 3];
        const w = ASSETS[k].w / T; if (!livre(x, w)) continue;
        out.push({ k, x: Math.round(x * 100) / 100, y: Math.round((r.y - (k === "bib_mural" ? 1.9 : 1.45)) * 100) / 100, z: "wall", room: r.id, id: "amb_" + r.id + "_" + n, natureza: true });
        cheio.push([x - 0.8, x + w + 0.8]); n++; x += w;
      }
      // plantas nos cantos de cima (encostadas na parede), só se o canto estiver vazio e longe da porta
      const ocupado = (x, y) => base.some(it => { const a = ASSETS[it.k]; if (!a || it.z === "wall" || it.z === "floor") return false; return x < cx1(it) + 0.1 && x + 1 > cx0(it) - 0.1 && y < it.y + a.h / T + 0.1 && y + 1 > it.y - 0.1; })
        || portasDe(r).some(pt => (pt.side === "cima" && y < r.y + 1.5 || pt.side === "baixo" && y > r.y + r.h - 2.5) && x < pt.tile + 1.6 && x + 1 > pt.tile - 0.6);
      let p = 0;
      for (const [x, y] of [[r.x + 0.15, r.y + 0.1], [r.x + r.w - 1.15, r.y + 0.1], [r.x + 0.15, r.y + r.h - 1.15], [r.x + r.w - 1.15, r.y + r.h - 1.15]]) {
        if (p >= 2 || ocupado(x, y)) continue;
        out.push({ k: plantas[(ri + p) % 3], x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, room: r.id, id: "amb_p_" + r.id + "_" + p, natureza: true }); p++;
      }
    });
    return out;
  }
  let deTema;
  window.Natureza = {
    itens() { if (typeof S === "undefined" || !S || !S.rooms) return []; if (de !== S || deTema !== temaAtual()) { de = S; deTema = temaAtual(); cache = montar(); } return cache; },
    chave, get clima() { return climaAtual(); }, get tintaGrama() { const c = climaAtual(); return c && c.grama; },
    configurar(o) { opcoes = Object.assign(opcoes, o || {}); },
  };

  /* ---------- o que cai do céu (neve, folhas, pétalas, confete, brilhos): camada por cima do 2D e do 3D ---------- */
  let opcoes = { dentro: () => false }, ceu = null, ctx = null, gotas = [], tipo = null, ult = 0;
  const CORES = { folhas: ["#c4601a", "#e0a03a", "#8a3f1a", "#e07a1f"], petalas: ["#f2a6c6", "#ffd0e4", "#ffffff"], confete: ["#e5484d", "#f2c14e", "#3fbf5f", "#3d5afe", "#e07aa8"], brilho: ["#ffd23e", "#fff1b0", "#ffffff"] };
  function quadro(t) {
    requestAnimationFrame(quadro);
    const c = climaAtual(), quer = c && c.cai && !opcoes.dentro() ? c.cai : null;
    if (!quer) { if (ceu && ceu.style.display !== "none") { ceu.style.display = "none"; } tipo = null; ult = t; return; }
    if (!ceu) { ceu = document.createElement("canvas"); ceu.id = "climaCeu"; ceu.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:6"; document.body.appendChild(ceu); ctx = ceu.getContext("2d"); }
    if (ceu.width !== innerWidth || ceu.height !== innerHeight) { ceu.width = innerWidth; ceu.height = innerHeight; }
    ceu.style.display = "";
    if (tipo !== quer) { tipo = quer; gotas = []; const n = Math.round(innerWidth * innerHeight / (quer === "neve" ? 9000 : 22000)); for (let i = 0; i < n; i++) gotas.push(nova(true)); }
    const dt = Math.min(0.05, (t - ult) / 1000 || 0.016); ult = t;
    ctx.clearRect(0, 0, ceu.width, ceu.height);
    for (const p of gotas) {
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(t / 900 + p.f) * p.oscila) * dt; p.r += p.vr * dt;
      if (p.y > innerHeight + 10 || p.x < -20 || p.x > innerWidth + 20) Object.assign(p, nova(false));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = p.a; ctx.fillStyle = p.cor;
      if (tipo === "neve") { ctx.beginPath(); ctx.arc(0, 0, p.t, 0, Math.PI * 2); ctx.fill(); }
      else if (tipo === "brilho") { const b = 0.5 + 0.5 * Math.sin(t / 200 + p.f); ctx.globalAlpha = p.a * b; ctx.fillRect(-p.t, -0.6, p.t * 2, 1.2); ctx.fillRect(-0.6, -p.t, 1.2, p.t * 2); }
      else ctx.fillRect(-p.t, -p.t * 0.55, p.t * 2, p.t * 1.1);
      ctx.restore();
    }
  }
  function nova(espalha) {
    const r = Math.random, cores = CORES[tipo] || ["#ffffff"];
    const base = { x: r() * innerWidth, y: espalha ? r() * innerHeight : -10 - r() * 40, f: r() * 6.28, r: r() * 6.28, cor: cores[Math.floor(r() * cores.length)] };
    if (tipo === "neve") return Object.assign(base, { vy: 25 + r() * 45, vx: -8 + r() * 16, oscila: 14, vr: 0, t: 1 + r() * 2.2, a: 0.55 + r() * 0.4, cor: "#ffffff" });
    if (tipo === "brilho") return Object.assign(base, { vy: 6 + r() * 10, vx: 0, oscila: 4, vr: 0, t: 2 + r() * 3, a: 0.9 });
    return Object.assign(base, { vy: 30 + r() * 40, vx: -10 + r() * 20, oscila: 30, vr: -3 + r() * 6, t: tipo === "confete" ? 2 + r() * 1.5 : 2.5 + r() * 2, a: 0.85 });
  }
  requestAnimationFrame(quadro);
})();
