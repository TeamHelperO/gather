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
      out.push({ k, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, id: "nat_" + out.length, natureza: true });
      marca(x - 0.3, y + h * 0.4, x + w + 0.3, y + h + 0.3);
    }
    // flores e pedras no chão, nos espaços que sobraram (inclusive na faixa em volta das salas)
    for (let i = 0; i < W * H / 9; i++) {
      const k = rnd() < 0.78 ? "nat_flores" : "nat_pedras", a = ASSETS[k], x = rnd() * (W - 1), y = rnd() * (H - 1);
      if (S.rooms.some(r => x + a.w / T > r.x - 0.2 && x < r.x + r.w + 0.2 && y + a.h / T > r.y - 2.2 && y < r.y + r.h + 0.2)) continue;
      if (out.some(o => o.z === "floor" && Math.abs(o.x - x) < 1.2 && Math.abs(o.y - y) < 0.8)) continue;
      if (!livreEm(x, y, 0.5, 0.5) && rnd() < 0.6) continue;
      out.push({ k, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: "floor", id: "nat_" + out.length, natureza: true });
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
  window.Natureza = { itens() { if (typeof S === "undefined" || !S || !S.rooms) return []; if (de !== S) { de = S; cache = montar(); } return cache; } };
})();
