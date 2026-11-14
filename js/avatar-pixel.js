/* Gerador de personagens em pixel art (estilo "chibi" com contorno, cabelo volumoso com brilho e rosto expressivo).
   Desenha a folha completa do avatar no MESMO formato das camadas antigas (192×624, quadros de 32×48):
     linha 0 frente · 1 perfil esquerdo · 2 perfil direito · 3 costas (col. 0 parado, 1–4 andando)
     linha 4 sentado (col. 0–1 de frente, 2–3 de costas digitando) · 5 acenando (sorriso) · 6 dançando (gargalhada)
     linhas 7–12 danças com juntas: passinho, pulinho, robô, requebra, moonwalk (perfil), giro
   Assim o 2D, o 3D e o editor de avatar usam tudo sem mudança. AvatarPixel.folha(av, cores) → canvas;
   AvatarPixel.retrato(av, expressao) → canvas 32×32 do rosto (neutra | sorriso | gargalhada). */
(function () {
  const FW = 32, FH = 48;
  /* ---------- cores ---------- */
  const hex = c => { c = c.replace("#", ""); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const mix = (c, alvo, t) => { const a = hex(c), b = hex(alvo); return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const escuro = (c, t = 0.25) => mix(c, "#1a0f14", t), claro = (c, t = 0.25) => mix(c, "#ffffff", t);
  const tons = c => ({ b: c, s: escuro(c, 0.22), ss: escuro(c, 0.42), h: claro(c, 0.28), o: escuro(c, 0.72) });
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

  /* ---------- quadro: pixels com "parte" para o contorno ---------- */
  function Quadro() { this.c = new Array(FW * FH).fill(null); this.p = new Array(FW * FH).fill(null); }
  Quadro.prototype.px = function (x, y, cor, parte) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= FW || y >= FH || !cor) return; const i = y * FW + x; this.c[i] = cor; this.p[i] = parte; };
  Quadro.prototype.ret = function (x, y, w, h, cor, parte) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, cor, parte); };
  Quadro.prototype.tem = function (x, y) { return x >= 0 && y >= 0 && x < FW && y < FH && this.c[y * FW + x] != null; };
  Quadro.prototype.parte = function (x, y) { return x >= 0 && y >= 0 && x < FW && y < FH ? this.p[y * FW + x] : null; };
  Quadro.prototype.oval = function (cx, cy, rx, ry, corFn, parte) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (d <= 1) this.px(x, y, typeof corFn === "function" ? corFn(x, y, d) : corFn, parte);
    }
  };
  // contorno escuro em volta do personagem + linha mais escura onde uma peça encontra outra
  Quadro.prototype.contornar = function (contornos) {
    const c2 = this.c.slice(), p = this.p;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x;
      if (this.c[i] == null) {
        let viz = null; for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const j = (y + dy) * FW + (x + dx); if (x + dx >= 0 && x + dx < FW && y + dy >= 0 && y + dy < FH && this.c[j] != null) { viz = p[j]; break; } }
        if (viz) c2[i] = contornos[viz] || "#2a1a1f";
      } else if (contornos[p[i]] && p[i] !== "pele" && p[i] !== "olho" && p[i] !== "boca") {
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const q = this.parte(x + dx, y + dy); if (q && q !== p[i] && QUEBRA[p[i]] && QUEBRA[p[i]].includes(q)) { c2[i] = contornos[p[i]]; break; } }
      }
    }
    this.c = c2;
  };
  const QUEBRA = { cabelo: ["pele", "roupa", "olho"], roupa: ["pele", "baixo", "cabelo"], baixo: ["pele", "pe", "roupa"], pe: ["pele", "baixo"], chapeu: ["cabelo", "pele"], acess: [] };
  Quadro.prototype.para = function (g, ox, oy, espelhar) {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const cor = this.c[y * FW + x]; if (!cor) continue; g.fillStyle = cor; g.fillRect(ox + (espelhar ? FW - 1 - x : x), oy + y, 1, 1); }
  };

  /* ---------- cabelo ---------- */
  // cachos: um "campo" de bolinhas de 4×4 px, cada uma com brilho em cima à esquerda e sombra embaixo à direita
  function cacho(x, y) {
    const lin = Math.floor(y / 4), off = (lin % 2) * 2, col = Math.floor((x + off) / 4);
    const cx = col * 4 - off + 2, cy = lin * 4 + 2, dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    return { dx, dy, d: Math.hypot(dx, dy) };
  }
  function texturaCabelo(t, cacheado) {
    if (cacheado) return (x, y) => {
      const { dx, dy, d } = cacho(x, y);
      if (d > 1.9) return t.ss;                      // vão entre os cachos
      if (dx + dy < -1.2) return t.h;                // brilho
      if (dx + dy > 1.3) return t.s;                 // sombra
      return t.b;
    };
    return (x, y) => {                                // liso: mechas verticais e um reflexo em arco
      if ((y === 6 && x >= 12 && x <= 17) || (y === 7 && x >= 17 && x <= 19)) return t.h;
      if (y > 9 && x % 3 === 0) return t.s;
      return t.b;
    };
  }
  // camadas de cabelo: "atras" (antes do corpo) e "frente" (sobre o rosto)
  function cabelo(q, est, t, vista, camada, dy) {
    const cach = est === "cacheado1" || est === "cacheado2", tx = texturaCabelo(t, cach), y0 = dy;
    const F = vista === "f", B = vista === "b", L = vista === "l";
    if (est === "careca" || !est) return;
    if (camada === "atras") {
      if (est === "longo") { if (F) { q.ret(7, 12 + y0, 4, 18, null); for (let y = 11; y < 30; y++) { q.px(8, y + y0, tx(8, y), "cabelo"); q.px(9, y + y0, tx(9, y), "cabelo"); q.px(22, y + y0, tx(22, y), "cabelo"); q.px(23, y + y0, tx(23, y), "cabelo"); } }
        else if (B) for (let y = 8; y < 31; y++) for (let x = 9; x < 24; x++) q.px(x, y + y0, y > 28 && (x + y) % 2 ? null : tx(x, y), "cabelo");
        else for (let y = 9; y < 30; y++) for (let x = 15; x < 22; x++) q.px(x, y + y0, tx(x, y), "cabelo"); }
      const borda = (cx, cy, rx, ry) => (x, y, d) => (d > 0.78 && cacho(x, y).d > 1.6) ? null : tx(x, y);
      if (est === "cacheado1") { const cx = L ? 17.5 : 16, rx = L ? 10 : 12; q.oval(cx, 16 + y0, rx, 14, borda(cx, 16, rx, 14), "cabelo"); }
      if (est === "cacheado2") { const cx = L ? 17 : 16; q.oval(cx, 10 + y0, L ? 11 : 12, 10.5, borda(cx, 10, 12, 10.5), "cabelo"); }
      if (est === "rabo") { if (B) for (let y = 12; y < 27; y++) q.ret(14 + (y > 22 ? 1 : 0), y + y0, 4 - (y > 22 ? 2 : 0), 1, tx(15, y), "cabelo"); if (L) for (let y = 9; y < 24; y++) q.ret(20 + Math.min(3, (y - 9) >> 2), y + y0, 3, 1, tx(21, y), "cabelo"); }
      if (est === "trancas" && B) for (const bx of [11, 19]) for (let y = 12; y < 31; y++) q.ret(bx, y + y0, 3, 1, (y % 3 === 0) ? t.s : tx(bx, y), "cabelo");
      return;
    }
    // frente: topo da cabeça + franja
    const topo = (x0, x1, yTop, yFim) => { for (let y = yTop; y <= yFim; y++) for (let x = x0; x <= x1; x++) q.px(x, y + y0, tx(x, y), "cabelo"); };
    if (est === "raspado") { const cor = t.s; for (let x = 10; x <= 22; x++) for (let y = 6; y <= 8; y++) if ((x + y) % 2 === 0 || y === 7) q.px(x, y + y0, cor, "cabelo"); if (B) q.ret(10, 6 + y0, 13, 6, cor, "cabelo"); return; }
    if (B) { // costas: cabeça toda coberta
      topo(9, 23, 5, 19); if (est === "coque") q.oval(16, 4 + y0, 3.5, 3, (x, y) => tx(x, y), "cabelo");
      if (est === "cacheado1" || est === "cacheado2") topo(8, 24, 4, 20);
      return;
    }
    if (L) { // perfil (olhando para a esquerda)
      topo(10, 21, 5, 9); topo(17, 21, 10, 17); q.px(10, 10 + y0, tx(10, 10), "cabelo"); q.px(11, 10 + y0, tx(11, 10), "cabelo");
      if (est === "longo" || est === "trancas") topo(18, 21, 18, 19);
      if (est === "coque") q.oval(19, 4 + y0, 3, 2.8, (x, y) => tx(x, y), "cabelo");
      if (est === "cacheado1" || est === "cacheado2") { topo(9, 23, 3, 9); topo(18, 24, 10, est === "cacheado1" ? 22 : 16); }
      if (est === "curto") topo(18, 21, 12, 14);
      return;
    }
    // frente
    topo(10, 22, 5, 8); topo(9, 10, 8, 13); topo(22, 23, 8, 13);
    // franja com risca de lado
    for (let x = 11; x <= 21; x++) { const desce = x < 15 ? 11 : x < 18 ? 10 : 9; for (let y = 9; y <= desce; y++) q.px(x, y + y0, tx(x, y), "cabelo"); }
    if (est === "longo") { topo(8, 9, 12, 26); topo(23, 24, 12, 26); }
    if (est === "cacheado1") { topo(8, 24, 4, 8); topo(8, 9, 8, 20); topo(23, 24, 8, 20); }
    if (est === "cacheado2") { topo(7, 25, 2, 8); topo(6, 8, 5, 14); topo(24, 26, 5, 14); }
    if (est === "coque") q.oval(16, 3.5 + y0, 3.5, 3, (x, y) => tx(x, y), "cabelo");
    if (est === "trancas") for (const bx of [8, 23]) for (let y = 12; y < 31; y++) q.ret(bx, y + y0, 2, 1, y % 3 === 0 ? t.s : tx(bx, y), "cabelo");
    if (est === "rabo") { /* de frente o rabo não aparece */ }
  }

  /* ---------- rosto ---------- */
  function rosto(q, av, pele, vista, expr, dy, piscar) {
    if (vista === "b") return;
    const P = pele, L = vista === "l", y0 = dy;
    const olho = "#2a1a22", brilho = "#ffffff", boca = escuro(P.b, 0.5), labio = mix(P.b, "#c4505a", 0.45);
    const est = String(av.olhos || "1");
    const desenharOlho = (x, y) => {
      if (piscar || est === "4") { q.ret(x, y + 1 + y0, 2, 1, olho, "olho"); if (est === "4") q.ret(x, y + y0, 2, 1, P.s, "pele"); return; }
      if (expr === "gargalhada" || est === "6") { q.px(x, y + 1 + y0, olho, "olho"); q.px(x + 1, y + y0, olho, "olho"); q.px(x + 2 - (L ? 1 : 0), y + 1 + y0, L ? null : olho, "olho"); return; }
      if (est === "2") { q.ret(x, y + y0, 1, 2, olho, "olho"); return; }
      if (est === "5") { q.ret(x - (L ? 0 : 0), y - 1 + y0, 2, 3, olho, "olho"); q.px(x, y - 1 + y0, brilho, "olho"); return; }
      q.ret(x, y + y0, 2, 2, olho, "olho"); q.px(x, y + y0, brilho, "olho");
      if (est === "3") { q.px(x - (L ? 0 : 1), y - 1 + y0, olho, "olho"); }
    };
    const sob = String(av.sobrancelha || "1"), corSob = escuro(P.b, 0.55);
    const sobr = (x, y, dir) => { if (sob === "3") q.ret(x, y + y0, 3, 1, corSob, "olho"); else if (sob === "2") { q.px(x, y + 1 + y0, corSob, "olho"); q.px(x + 1, y + y0, corSob, "olho"); q.px(x + 2, y + 1 + y0, corSob, "olho"); } else q.ret(x, y + y0, 2 + (dir ? 0 : 0), 1, corSob, "olho"); };
    if (L) {
      desenharOlho(11, 13); sobr(11, 11);
      q.px(9, 15 + y0, P.b, "pele"); q.px(9, 16 + y0, P.s, "pele"); // nariz
      if (expr === "gargalhada") { q.ret(10, 17 + y0, 2, 2, boca, "boca"); q.px(11, 17 + y0, brilho, "boca"); }
      else if (expr === "sorriso") { q.px(10, 17 + y0, boca, "boca"); q.px(11, 18 + y0, boca, "boca"); }
      else q.px(10, 18 + y0, labio, "boca");
      q.px(13, 16 + y0, mix(P.b, "#ff8a8a", 0.25), "pele");
      return;
    }
    desenharOlho(12, 13); desenharOlho(18, 13); sobr(12, 11); sobr(18, 11);
    q.px(16, 15 + y0, P.s, "pele"); q.px(16, 16 + y0, P.s, "pele"); // nariz (sombra)
    q.px(11, 16 + y0, mix(P.b, "#ff8a8a", 0.3), "pele"); q.px(21, 16 + y0, mix(P.b, "#ff8a8a", 0.3), "pele"); // bochechas
    if (expr === "gargalhada") { q.ret(14, 17 + y0, 5, 2, boca, "boca"); q.ret(15, 17 + y0, 3, 1, brilho, "boca"); q.px(16, 19 + y0, mix(boca, "#e0606a", 0.5), "boca"); }
    else if (expr === "sorriso") { q.px(14, 17 + y0, boca, "boca"); q.ret(15, 18 + y0, 3, 1, boca, "boca"); q.px(18, 17 + y0, boca, "boca"); }
    else q.ret(15, 18 + y0, 3, 1, labio, "boca");
  }

  /* ---------- corpo e roupas ---------- */
  /* membro articulado: segmento que sai da junta (x0,y0) no ângulo ang (graus; 0 = para baixo, positivo = para fora/à frente)
     dir = -1 (para a esquerda da tela) ou 1; cor(t, lado) escolhe a cor ao longo do comprimento t e do lado (-1..1). Devolve a ponta. */
  function seg(q, x0, y0, ang, comp, larg, dir, cor, parte) {
    const a = ang * Math.PI / 180, vx = Math.sin(a) * dir, vy = Math.cos(a), px = -vy, py = vx, m = comp + larg;
    for (let y = Math.floor(y0 - m); y <= Math.ceil(y0 + m); y++) for (let x = Math.floor(x0 - m); x <= Math.ceil(x0 + m); x++) {
      const dx = x + 0.5 - x0, dy = y + 0.5 - y0, t = dx * vx + dy * vy, l = dx * px + dy * py;
      if (t < -0.4 || t > comp + 0.2 || Math.abs(l) > larg / 2) continue;
      const c = cor(t, l / (larg / 2)); if (!c) continue; const [cc, pp] = Array.isArray(c) ? c : [c, parte]; q.px(x, y, cc, pp);
    }
    return [x0 + vx * comp, y0 + vy * comp];
  }

  function figura(av, cores, pose) {
    const q = new Quadro();
    const P = tons(cores.pele), H = tons(cores.cabelo || "#4a3022"), R = tons(cores.roupa), Bx = tons(cores.baixo || "#3d5a8a"), S = tons(cores.calcado || "#f2f0ea");
    const vista = pose.vista, F = vista === "f", B = vista === "b", L = vista === "l";
    const est = av.cima && av.cima.estilo || "camiseta", baixo = av.baixo && av.baixo.estilo || "calca", pe = av.calcado && av.calcado.estilo || "tenis";
    const cab = av.cabelo && av.cabelo.estilo || "curto";
    const fase = pose.andar || 0, bob = pose.bob || 0, sent = pose.sentado;
    const dy = bob; // sobe/desce o corpo todo
    // perna esquerda/direita: deslocamentos do passo
    const passo = [0, 1, 0, -1, 0][fase] || 0;

    cabelo(q, cab, H, vista, "atras", dy);
    /* pernas e pés */
    const pernaFim = sent ? 38 : 42, peY = sent ? 39 : 43;
    const desenharPerna = (x, w, levanta, frente) => {
      const yF = pernaFim - levanta;
      for (let y = 32 + dy; y <= yF + dy; y++) for (let i = 0; i < w; i++) {
        const curto = baixo === "short" ? y > 36 + dy : baixo === "saia" || baixo === "nenhuma" || est === "vestido" ? y > 37 + dy : false;
        q.px(x + i, y, curto ? (i === w - 1 ? P.s : P.b) : (i === w - 1 ? Bx.s : i === 0 && frente ? Bx.h : Bx.b), curto ? "pele" : "baixo");
      }
      const sy = peY - levanta + dy, cor = S;
      if (pe === "sapato") { q.ret(x - (L ? 1 : 0), sy, w + 1, 2, cor.b, "pe"); q.px(x + (L ? 0 : 1), sy, cor.h, "pe"); q.ret(x - (L ? 1 : 0), sy + 2, w + 1, 1, cor.s, "pe"); }
      else { q.ret(x - (L ? 1 : 0), sy, w + 1, 2, cor.b, "pe"); q.px(x + 1, sy, cor.h, "pe"); q.ret(x - (L ? 1 : 0), sy + 2, w + 1, 1, "#f4f1ea", "pe"); }
    };
    const art = pose.art; // pose com juntas: { bE:[ombro, cotovelo], bD:[…], pE:[quadril, joelho], pD:[…], quadril:dx }
    const pernaArt = (x0, y0, ang, joelho, dir, frente) => {
      const curtoAte = baixo === "short" ? 4 : baixo === "saia" || baixo === "nenhuma" || est === "vestido" ? 5 : 99;
      const corPerna = (t, l) => { const pele = t > curtoAte; const lado = l > 0.45 ? 1 : l < -0.45 && frente ? -1 : 0;
        return pele ? [lado > 0 ? P.s : P.b, "pele"] : [lado > 0 ? Bx.s : lado < 0 ? Bx.h : Bx.b, "baixo"]; };
      const [jx, jy] = seg(q, x0, y0 + dy, ang, 5.5, 4, dir, corPerna, "baixo");
      const [px2, py2] = seg(q, jx, jy, ang + joelho, 5, 4, dir, (t, l) => corPerna(t + 5.5, l), "baixo");
      // pé (aponta para a frente no perfil; no de frente/costas fica embaixo)
      const fx = Math.round(px2 - 2 - (L ? 1 : 0)), fy = Math.round(py2);
      q.ret(fx, fy, 5, 2, S.b, "pe"); q.px(fx + 1, fy, S.h, "pe"); q.ret(fx, fy + 2, 5, 1, pe === "sapato" ? S.s : "#f4f1ea", "pe");
    };
    if (art && !sent && (F || B)) { const qx = art.quadril || 0; pernaArt(13.5 + qx, 32, (art.pE || [0, 0])[0], (art.pE || [0, 0])[1], -1, true); pernaArt(18.5 + qx, 32, (art.pD || [0, 0])[0], (art.pD || [0, 0])[1], 1, true); }
    else if (art && !sent && L) { // perfil: perna de trás primeiro (mais escura não precisa: o contorno separa)
      pernaArt(15.5, 32, (art.pD || [0, 0])[0], (art.pD || [0, 0])[1], -1, false); pernaArt(15.5, 32, (art.pE || [0, 0])[0], (art.pE || [0, 0])[1], -1, true); }
    else if (sent && B) { /* sentado de costas: as pernas ficam escondidas pela cadeira */ }
    else if (F || B) {
      if (sent && F) { desenharPerna(12, 4, 0, true); desenharPerna(17, 4, 0, true); }
      else { desenharPerna(12, 4, Math.max(0, passo), true); desenharPerna(17, 4, Math.max(0, -passo), true); }
    } else { // perfil: passada
      const ab = [0, 2, 0, -2, 0][fase] || 0;
      if (sent) { for (let x = 10; x <= 17; x++) q.ret(x, 33 + dy, 1, 4, x < 12 ? Bx.s : Bx.b, "baixo"); desenharPerna(10, 3, 0, true); }
      else { desenharPerna(14 + ab, 4, 0, false); desenharPerna(14 - ab, 4, 0, true); }
    }
    /* tronco */
    const cx0 = L ? 12 : 11, cw = L ? 9 : 11;
    const longa = est === "social" || est === "moletom", vest = est === "vestido";
    for (let y = 20; y <= 32; y++) for (let x = cx0; x < cx0 + cw; x++) {
      if (y === 20 && (x === cx0 || x === cx0 + cw - 1)) continue;
      let cor = R.b; if (x === cx0 + cw - 1 || (y > 29 && x > cx0 + cw - 3)) cor = R.s; if (x === cx0 + 1 && y < 26) cor = R.h;
      q.px(x, y + dy, cor, "roupa");
    }
    if (vest) for (let y = 32; y <= 38; y++) { const ab = (y - 32) >> 1; for (let x = cx0 - ab; x < cx0 + cw + ab; x++) q.px(x, y + dy, x >= cx0 + cw - 1 + ab - 1 ? R.s : y % 3 === 0 && x % 3 === 0 ? R.h : R.b, "roupa"); }
    if (!vest && (baixo === "calca" || baixo === "short" || baixo === "saia")) { q.ret(cx0, 31 + dy, cw, 2, Bx.b, "baixo"); q.ret(cx0, 31 + dy, cw, 1, Bx.s, "baixo"); }
    if (!vest && baixo === "saia") for (let y = 33; y <= 37; y++) { const ab = (y - 33) >> 1; for (let x = cx0 - ab; x < cx0 + cw + ab; x++) q.px(x, y + dy, x >= cx0 + cw - 1 ? Bx.s : Bx.b, "baixo"); }
    if (!vest && baixo === "nenhuma") q.ret(cx0, 31 + dy, cw, 4, "#2f2b2e", "baixo");
    // detalhes de cada roupa
    if (F) {
      if (est === "camiseta" || est === "next" || vest) { q.px(15, 20 + dy, P.b, "pele"); q.px(16, 20 + dy, P.b, "pele"); q.px(17, 20 + dy, P.b, "pele"); q.px(16, 21 + dy, P.b, "pele"); }
      if (est === "social") { q.px(15, 20 + dy, "#f4f1ea", "roupa"); q.px(17, 20 + dy, "#f4f1ea", "roupa"); q.px(16, 21 + dy, R.s, "roupa"); for (let y = 23; y < 31; y += 2) q.px(16, y + dy, R.h, "roupa"); }
      if (est === "moletom") { q.px(15, 22 + dy, "#f4f1ea", "roupa"); q.px(15, 23 + dy, "#f4f1ea", "roupa"); q.px(17, 22 + dy, "#f4f1ea", "roupa"); q.px(17, 23 + dy, "#f4f1ea", "roupa"); q.ret(13, 27 + dy, 7, 3, R.s, "roupa"); q.ret(14, 27 + dy, 5, 1, R.ss, "roupa"); }
      if (est === "next") { const c = cores.roupa === "#f2f0ea" ? "#1d1d1f" : "#ffffff"; for (const [x, y] of [[14, 23], [14, 24], [14, 25], [14, 26], [15, 24], [16, 25], [17, 23], [17, 24], [17, 25], [17, 26]]) q.px(x, y + dy, c, "roupa"); }
    }
    if (B && (est === "moletom")) q.ret(13, 20 + dy, 7, 3, R.s, "roupa");
    /* braços */
    const braco = (x, y0, comp, mangaAte, onda) => {
      for (let y = 0; y < comp; y++) { const yy = y0 + y + dy; const pele = y >= mangaAte; q.px(x, yy, pele ? P.b : R.h, pele ? "pele" : "roupa"); q.px(x + 1, yy, pele ? P.b : R.b, pele ? "pele" : "roupa"); q.px(x + 2, yy, pele ? P.s : R.s, pele ? "pele" : "roupa"); }
      void onda;
    };
    const manga = longa || vest && false ? 9 : 4;
    const bracoArt = (x0, y0, ang, cot, dir) => {
      const cor = (t, l) => { const pele = t >= manga; return pele ? [l > 0.3 ? P.s : P.b, "pele"] : [l > 0.3 ? R.s : l < -0.3 ? R.h : R.b, "roupa"]; };
      const [ex, ey] = seg(q, x0, y0 + dy, ang, 5.5, 3, dir, cor, "roupa");
      const [hx, hy] = seg(q, ex, ey, ang + cot, 5, 3, dir, (t, l) => cor(t + 5.5, l), "roupa");
      q.ret(Math.round(hx - 1), Math.round(hy - 1), 3, 3, P.b, "pele"); // mão
    };
    if (art && (F || B)) { const b1 = art.bE || [0, 0], b2 = art.bD || [0, 0]; bracoArt(9.5, 21, b1[0], b1[1], -1); bracoArt(22.5, 21, b2[0], b2[1], 1); }
    else if (art && L) { const b1 = art.bE || [0, 0]; bracoArt(16, 21, b1[0], b1[1], -1); }
    else if (F || B) {
      const bE = pose.bracoE || 0, bD = pose.bracoD || 0;
      if (pose.acenar) { // braço direito (da tela) levantado
        for (let y = 9; y < 21; y++) { const yy = y + dy, xx = 23 + (pose.acenar % 2); const pele = y < 15; q.px(xx, yy, pele ? P.b : R.b, pele ? "pele" : "roupa"); q.px(xx + 1, yy, pele ? P.s : R.s, pele ? "pele" : "roupa"); }
        q.ret(23 + (pose.acenar % 2), 7 + dy, 3, 3, P.b, "pele"); braco(8, 21 + bE, 11, manga);
      } else if (pose.digitar) { braco(8, 21, 8, manga); braco(21, 21, 8, manga); q.ret(9, 28 + dy - (pose.digitar % 2), 3, 2, P.b, "pele"); q.ret(21, 28 + dy - ((pose.digitar + 1) % 2), 3, 2, P.b, "pele"); }
      else if (pose.dancar) { const up = pose.dancar % 2; if (up) { for (let y = 9; y < 21; y++) { q.ret(7, y + dy, 2, 1, y < 14 ? P.b : R.b, y < 14 ? "pele" : "roupa"); } braco(22, 21, 11, manga); } else { braco(8, 21, 11, manga); for (let y = 9; y < 21; y++) q.ret(23, y + dy, 2, 1, y < 14 ? P.b : R.b, y < 14 ? "pele" : "roupa"); } }
      else { braco(8, 21 + bE, 11, manga); braco(21, 21 + bD, 11, manga); }
    } else { // perfil: um braço na frente, balançando
      const ab = [0, 2, 0, -2, 0][fase] || 0;
      for (let y = 0; y < 11; y++) { const yy = 21 + y + dy, xx = 15 - Math.round(ab * y / 10); const pele = y >= manga; q.px(xx, yy, pele ? P.b : R.b, pele ? "pele" : "roupa"); q.px(xx + 1, yy, pele ? P.s : R.s, pele ? "pele" : "roupa"); q.px(xx + 2, yy, pele ? P.s : R.ss, pele ? "pele" : "roupa"); }
    }
    /* pescoço e cabeça */
    q.ret(L ? 14 : 15, 18 + dy, 3, 3, P.s, "pele");
    const cabeca = (x0, x1) => {
      for (let y = 7; y <= 19; y++) for (let x = x0; x <= x1; x++) {
        const canto = (y === 7 || y === 19) && (x === x0 || x === x1) || (y === 19 && (x === x0 + 1 || x === x1 - 1));
        if (canto) continue;
        q.px(x, y + dy, x === x1 || y === 19 ? P.s : x === x0 + 1 && y < 12 ? P.h : P.b, "pele");
      }
    };
    if (L) { cabeca(10, 21); q.ret(9, 14 + dy, 1, 2, P.b, "pele"); q.ret(18, 13 + dy, 2, 3, P.s, "pele"); }
    else { cabeca(10, 22); if (F) { q.ret(9, 13 + dy, 1, 3, P.b, "pele"); q.ret(23, 13 + dy, 1, 3, P.s, "pele"); } }
    // barba
    const barba = av.barba && av.barba.estilo;
    if (barba && barba !== "nenhuma" && !B) {
      const c = H.s, xs = L ? [10, 14] : [11, 21];
      if (barba === "cheia") for (let y = 16; y <= 19; y++) for (let x = xs[0]; x <= xs[1]; x++) if (!(y === 18 && x >= 15 && x <= 17 && !L)) q.px(x, y + dy, (x + y) % 3 ? c : H.b, "cabelo");
      if (barba === "bigode") q.ret(L ? 10 : 14, 17 + dy, L ? 2 : 5, 1, c, "cabelo");
      if (barba === "cavanhaque") { q.ret(L ? 10 : 14, 17 + dy, L ? 2 : 5, 1, c, "cabelo"); q.ret(L ? 10 : 15, 19 + dy, L ? 2 : 3, 2, c, "cabelo"); }
      if (barba === "rala") for (let y = 16; y <= 19; y++) for (let x = xs[0]; x <= xs[1]; x++) if ((x + y * 2) % 3 === 0) q.px(x, y + dy, mix(P.b, c, 0.5), "pele");
    }
    rosto(q, av, P, vista, pose.expr || "neutra", dy, pose.piscar);
    cabelo(q, cab, H, vista, "frente", dy);
    /* acessórios */
    const oc = av.oculos && av.oculos.estilo;
    if (oc && oc !== "nenhum" && !B) {
      const fr = "#1d1d22", lente = oc === "escuro" ? "#22232b" : null;
      const aro = (x) => { if (oc === "redondo") { q.px(x, 12 + dy, fr, "acess"); q.px(x + 1, 12 + dy, fr, "acess"); q.px(x - 1, 13 + dy, fr, "acess"); q.px(x + 2, 13 + dy, fr, "acess"); q.px(x - 1, 14 + dy, fr, "acess"); q.px(x + 2, 14 + dy, fr, "acess"); q.px(x, 15 + dy, fr, "acess"); q.px(x + 1, 15 + dy, fr, "acess"); }
        else { q.ret(x - 1, 12 + dy, 4, 1, fr, "acess"); q.ret(x - 1, 15 + dy, 4, 1, fr, "acess"); q.ret(x - 1, 13 + dy, 1, 2, fr, "acess"); q.ret(x + 2, 13 + dy, 1, 2, fr, "acess"); }
        if (lente) { q.ret(x, 13 + dy, 2, 2, lente, "acess"); q.px(x, 13 + dy, "#5a5d70", "acess"); } };
      if (L) { aro(11); q.ret(13, 13 + dy, 5, 1, fr, "acess"); } else { aro(12); aro(18); q.ret(14, 13 + dy, 4, 1, fr, "acess"); }
    }
    const ch = av.chapeu && av.chapeu.estilo, C = tons(cores.chapeu || "#2f2b2e");
    if (ch && ch !== "nenhum") {
      if (ch === "bone") { for (let y = 3; y <= 9; y++) for (let x = 10; x <= 22; x++) if (!(y === 3 && (x < 12 || x > 20))) q.px(x, y + dy, y < 5 ? C.h : x > 20 ? C.s : C.b, "chapeu"); if (F) q.ret(9, 9 + dy, 15, 2, C.s, "chapeu"); if (L) q.ret(5, 9 + dy, 7, 2, C.s, "chapeu"); q.px(16, 3 + dy, C.ss, "chapeu"); }
      if (ch === "chapeu") { q.ret(11, 1 + dy, 11, 7, C.b, "chapeu"); q.ret(11, 1 + dy, 11, 1, C.h, "chapeu"); q.ret(11, 6 + dy, 11, 1, C.ss, "chapeu"); q.ret(6, 8 + dy, 21, 2, C.s, "chapeu"); }
      if (ch === "gorro") { q.oval(16, 7 + dy, 7.5, 5, (x, y) => (x + y) % 2 ? C.b : C.h, "chapeu"); q.ret(9, 8 + dy, 15, 3, C.s, "chapeu"); q.oval(16, 1.5 + dy, 2, 1.8, "#f4f1ea", "chapeu"); }
    }
    if (av.fone && av.fone.estilo === "sim") { const f = "#2a2b33"; for (let x = 10; x <= 22; x++) q.px(x, 4 + dy + (x < 12 || x > 20 ? 1 : 0), f, "acess"); if (!L) { q.ret(8, 12 + dy, 2, 4, f, "acess"); q.ret(23, 12 + dy, 2, 4, f, "acess"); q.px(8, 13 + dy, "#3d5afe", "acess"); } else q.ret(17, 12 + dy, 3, 4, f, "acess"); }
    const joia = av.joia && av.joia.estilo, ouro = "#f0c24a", ouroS = "#b8862a";
    if (joia && joia !== "nenhum") {
      if ((joia === "brincos" || joia === "brincos_colar") && !B) { if (F) { q.ret(8, 16 + dy, 2, 2, ouro, "acess"); q.px(8, 17 + dy, ouroS, "acess"); q.ret(23, 16 + dy, 2, 2, ouro, "acess"); q.px(24, 17 + dy, ouroS, "acess"); } else q.ret(18, 16 + dy, 2, 2, ouro, "acess"); }
      if ((joia === "colar" || joia === "brincos_colar") && F) { for (const [x, y] of [[13, 20], [14, 21], [15, 22], [16, 22], [17, 22], [18, 21], [19, 20]]) q.px(x, y + dy, ouro, "acess"); q.px(16, 23 + dy, ouroS, "acess"); }
      if (joia === "bolsa") { const bc = tons("#c87a4a"); if (F) { for (let i = 0; i < 9; i++) q.px(12 + i, 21 + i + dy, bc.s, "acess"); q.ret(19, 29 + dy, 5, 4, bc.b, "acess"); q.ret(19, 29 + dy, 5, 1, bc.h, "acess"); } else if (L) { q.ret(17, 27 + dy, 4, 4, bc.b, "acess"); for (let y = 20; y < 27; y++) q.px(16, y + dy, bc.s, "acess"); } else { for (let i = 0; i < 9; i++) q.px(20 - i, 21 + i + dy, bc.s, "acess"); } }
    }
    q.contornar({ pele: escuro(cores.pele, 0.68), cabelo: H.o, roupa: R.o, baixo: Bx.o, pe: S.o, chapeu: C.o, acess: "#1d1d22", olho: "#2a1a22", boca: "#2a1a22" });
    return q;
  }

  /* ---------- cores a partir do catálogo do avatar ---------- */
  function coresDe(av) {
    const C = window.Avatar ? Avatar.CAT : null;
    const pega = (parte, padrao) => { const sel = av[parte]; if (!sel || !C) return padrao; const e = C[parte].estilos[sel.estilo]; if (!e || !e.cores) return padrao; return e.cores[sel.cor] || Object.values(e.cores)[0] || padrao; };
    return { pele: (C && C.pele.cores[av.pele]) || "#d09a6a", cabelo: pega("cabelo", "#4a3022"), roupa: pega("cima", "#3d6fd6"), baixo: pega("baixo", "#3d5a8a"),
      calcado: pega("calcado", "#f2f0ea"), chapeu: pega("chapeu", "#2f2b2e") };
  }

  /* ---------- folha completa ---------- */
  function folha(av, coresFixas) {
    av = Object.assign({}, window.Avatar ? Avatar.PADRAO : {}, av || {});
    const cores = coresFixas || coresDe(av), c = document.createElement("canvas"); c.width = 6 * FW; c.height = 13 * FH;
    const g = c.getContext("2d");
    const q = (pose, col, row, esp) => figura(av, cores, pose).para(g, col * FW, row * FH, esp);
    // andar com juntas: quadril, joelho, ombro e cotovelo em cada passo (col. 0 parado, 1–4 o ciclo)
    const ANDAR_PERFIL = [ // [pE (frente), pD (trás), braço da frente]
      { pE: [0, 0], pD: [0, 0], bE: [0, 6] },
      { pE: [28, -6], pD: [-22, 30], bE: [-26, 22] },
      { pE: [6, 2], pD: [-4, 18], bE: [-4, 12] },
      { pE: [-22, 30], pD: [28, -6], bE: [26, 18] },
      { pE: [-4, 18], pD: [6, 2], bE: [4, 12] },
    ];
    const ANDAR_FRENTE = [
      { pE: [0, 0], pD: [0, 0], bE: [6, 0], bD: [6, 0] },
      { pE: [-4, 22], pD: [3, 0], bE: [16, 14], bD: [2, 4] },
      { pE: [0, 6], pD: [0, 0], bE: [8, 4], bD: [8, 4] },
      { pE: [3, 0], pD: [-4, 22], bE: [2, 4], bD: [16, 14] },
      { pE: [0, 0], pD: [0, 6], bE: [8, 4], bD: [8, 4] },
    ];
    for (let f = 0; f < 5; f++) {
      const bob = f === 2 || f === 4 ? -1 : 0;
      q({ vista: "f", andar: f, bob, expr: "neutra", art: ANDAR_FRENTE[f], piscar: false }, f, 0);
      q({ vista: "l", andar: f, bob, expr: "neutra", art: ANDAR_PERFIL[f] }, f, 1);
      q({ vista: "l", andar: f, bob, expr: "neutra", art: ANDAR_PERFIL[f] }, f, 2, true);
      q({ vista: "b", andar: f, bob, art: ANDAR_FRENTE[f] }, f, 3);
    }
    // danças com juntas (linhas 7–12, 6 quadros cada): passinho, pulinho, robô, requebra, moonwalk, giro
    const DANCAS = [
      // 7 passinho: chute de um pé e do outro, braços dobrados acompanhando
      [{ pE: [-30, 40], pD: [4, 0], bE: [30, 90], bD: [20, 70], bob: -1 }, { pE: [6, 0], pD: [6, 0], bE: [20, 60], bD: [20, 60] }, { pE: [4, 0], pD: [-30, 40], bE: [20, 70], bD: [30, 90], bob: -1 },
       { pE: [6, 0], pD: [6, 0], bE: [20, 60], bD: [20, 60] }, { pE: [-36, 70], pD: [8, 0], bE: [50, 80], bD: [10, 40], bob: -2 }, { pE: [8, 0], pD: [-36, 70], bE: [10, 40], bD: [50, 80], bob: -2 }],
      // 8 pulinho: agacha, estica com os braços para cima
      [{ pE: [10, 30], pD: [10, 30], bE: [30, 20], bD: [30, 20], bob: 2 }, { pE: [4, 0], pD: [4, 0], bE: [150, 10], bD: [150, 10], bob: -3 }, { pE: [12, 10], pD: [12, 10], bE: [170, 0], bD: [170, 0], bob: -4 },
       { pE: [4, 0], pD: [4, 0], bE: [150, 10], bD: [150, 10], bob: -3 }, { pE: [10, 30], pD: [10, 30], bE: [30, 20], bD: [30, 20], bob: 2 }, { pE: [6, 10], pD: [6, 10], bE: [60, 40], bD: [60, 40], bob: 0 }],
      // 9 robô: braços em 90°, travados, um sobe e o outro desce
      [{ pE: [4, 0], pD: [4, 0], bE: [90, -90], bD: [90, 0] }, { pE: [4, 0], pD: [4, 0], bE: [90, 0], bD: [90, -90] }, { pE: [10, 0], pD: [0, 0], bE: [90, -90], bD: [90, -90] },
       { pE: [0, 0], pD: [10, 0], bE: [0, 90], bD: [0, 90] }, { pE: [4, 0], pD: [4, 0], bE: [90, 90], bD: [90, -90] }, { pE: [4, 0], pD: [4, 0], bE: [90, -90], bD: [90, 90] }],
      // 10 requebra: quadril para um lado, braços para o outro
      [{ pE: [12, -6], pD: [-6, 12], quadril: -2, bE: [40, 60], bD: [120, 30] }, { pE: [6, 0], pD: [6, 0], quadril: 0, bE: [70, 40], bD: [70, 40] }, { pE: [-6, 12], pD: [12, -6], quadril: 2, bE: [120, 30], bD: [40, 60] },
       { pE: [6, 0], pD: [6, 0], quadril: 0, bE: [70, 40], bD: [70, 40] }, { pE: [14, -8], pD: [-8, 14], quadril: -2, bE: [30, 90], bD: [140, 20] }, { pE: [-8, 14], pD: [14, -8], quadril: 2, bE: [140, 20], bD: [30, 90] }],
    ];
    DANCAS.forEach((quadros, i) => quadros.forEach((art, f) => q({ vista: "f", bob: art.bob || 0, expr: f % 3 === 2 ? "gargalhada" : "sorriso", art }, f, 7 + i)));
    // 11 moonwalk (perfil): o pé da frente desliza para trás, um de cada vez
    [[{ pE: [-4, 30], pD: [-18, 0] }, { pE: [-10, 20], pD: [-6, 10] }, { pE: [-18, 0], pD: [-4, 30] }, { pE: [-6, 10], pD: [-10, 20] }, { pE: [-4, 30], pD: [-18, 0] }, { pE: [-10, 20], pD: [-6, 10] }]]
      .forEach(qs => qs.forEach((p, f) => q({ vista: "l", expr: "sorriso", art: { ...p, bE: [-10, 20] } }, f, 11)));
    // 12 giro com braços abertos (frente, lado, costas, lado)
    [["f", 0], ["l", 0], ["b", 0], ["l", 1], ["f", 0], ["l", 0]].forEach(([v, esp], f) => q({ vista: v, expr: "gargalhada", bob: f % 2 ? -2 : 0, art: v === "l" ? { pE: [8, 0], pD: [-8, 0], bE: [80, 10] } : { pE: [8, 0], pD: [8, 0], bE: [90, 10], bD: [90, 10] } }, f, 12, !!esp));
    q({ vista: "f", sentado: true, expr: "neutra" }, 0, 4); q({ vista: "f", sentado: true, expr: "sorriso" }, 1, 4);
    q({ vista: "b", sentado: true, digitar: 1 }, 2, 4); q({ vista: "b", sentado: true, digitar: 2 }, 3, 4);
    q({ vista: "l", sentado: true }, 4, 4); q({ vista: "l", sentado: true }, 5, 4, true); // sentado de lado (esquerda, direita)
    for (let f = 0; f < 4; f++) q({ vista: "f", acenar: f + 1, expr: "sorriso" }, f, 5);
    for (let f = 0; f < 6; f++) q({ vista: "f", dancar: f + 1, bob: f % 2 ? -1 : 0, expr: f % 3 === 2 ? "sorriso" : "gargalhada", andar: [1, 0, 3, 0, 1, 3][f] }, f, 6);
    return c;
  }
  function retrato(av, expr = "neutra") {
    av = Object.assign({}, window.Avatar ? Avatar.PADRAO : {}, av || {});
    const c = document.createElement("canvas"); c.width = 32; c.height = 28; const g = c.getContext("2d");
    figura(av, coresDe(av), { vista: "f", expr }).para(g, 0, 0); return c;
  }
  // agente de IA sentado de costas no computador (sala de Pesquisa/Edição), no mesmo estilo
  function agente(corCapuz, corCabelo, w = 32, h = 40) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    g.fillStyle = "#2b2f39"; g.fillRect(9, 30, 14, 3); g.fillRect(15, 33, 2, 4); g.fillRect(10, 37, 12, 2);
    figura(AGENTE_AV, { pele: "#d09a6a", cabelo: corCabelo, roupa: corCapuz, baixo: "#2b2f39", calcado: "#2b2f39" }, { vista: "b", sentado: true, digitar: 1 }).para(g, 0, -6);
    // encosto da cadeira na frente das costas
    g.fillStyle = "#1d2028"; g.fillRect(10, 25, 12, 7); g.fillStyle = "#2b2f39"; g.fillRect(10, 25, 12, 1); g.fillRect(11, 26, 1, 5);
    return c;
  }
  // cores de cada agente (capuz, cabelo): agente_1…agente_8
  const AGENTE_CORES = [["#2f6fd8", "#2b2626"], ["#7b4fd8", "#4a3022"], ["#1f9e6e", "#7a4b2a"], ["#d8682f", "#e0b860"], ["#c23a5a", "#d9772e"],
    ["#e0b030", "#2b2626"], ["#3a3f4a", "#8e2f2a"], ["#e04fa0", "#d96aa7"]];
  const AGENTE_AV = { pele: "3", cabelo: { estilo: "curto", cor: "preto" }, cima: { estilo: "moletom" }, baixo: { estilo: "calca" }, calcado: { estilo: "tenis" },
    fone: { estilo: "sim" }, chapeu: { estilo: "nenhum" }, joia: { estilo: "nenhum" }, oculos: { estilo: "nenhum" } };
  // folha completa (andar, virar…) do agente n, com o mesmo capuz, cabelo e fone do sprite sentado
  function agenteFolha(n) {
    const [capuz, cabelo] = AGENTE_CORES[(n - 1 + AGENTE_CORES.length) % AGENTE_CORES.length];
    return folha(AGENTE_AV, { pele: "#d09a6a", cabelo, roupa: capuz, baixo: "#2b2f39", calcado: "#2b2f39", chapeu: "#2f2b2e" });
  }
  window.AvatarPixel = { folha, retrato, figura, coresDe, agente, agenteFolha, AGENTE_CORES, FW, FH };
})();
