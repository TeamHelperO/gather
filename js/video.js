/* Corte (editor de vídeo da sala de Edição): transforma um roteiro em um vídeo vertical ANIMADO (motion graphics).
   Tudo no navegador: ilustrações animadas por cena, texto cinético, legenda palavra a palavra, transições e trilha sonora
   gerada na hora (Web Audio). Grava com MediaRecorder (MP4 quando o navegador deixa, senão WebM).
   Uso: Video.gerar(roteiro, { aoProgredir(p), cancelado() }) → Promise<{ blob, ext, duracao }> */
window.Video = (function () {
  const W = 720, H = 1280, FPS = 30;
  const PALETAS = [["#2b1140", "#e04fa0", "#ffd166"], ["#0e2238", "#2fd4e8", "#ffd166"], ["#122a1a", "#3fbf5f", "#e8f56a"], ["#33190c", "#f2a33a", "#fff1c1"], ["#1c1338", "#8b6cff", "#2fd4e8"]];
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
  const back = t => { t = Math.max(0, Math.min(1, t)); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

  /* ---------- qual animação usar em cada cena ---------- */
  const TIPOS = ["chat", "grafico", "dashboard", "cadeado", "celular", "relogio", "dinheiro", "robo", "integracao", "pessoa", "numero", "alvo"];
  function escolherTipo(c, i) {
    if (c.animacao && TIPOS.includes(c.animacao)) return c.animacao;
    const t = `${c.visual} ${c.texto_tela} ${c.fala}`.toLowerCase();
    const regras = [["cadeado", /segur|compliance|lgpd|privac|cadeado|escudo|prote/], ["integracao", /integra|conect|api|crm.*whats|whats.*crm|sistema/],
      ["chat", /chat|conversa|mensag|whats|atendim|responde|dúvida|duvida|pergunt/], ["dashboard", /dashboard|crm|lead|qualific|painel|funil/],
      ["grafico", /gráfico|grafico|cresc|vendas|subida|aument|result|roi|métric|metric/], ["dinheiro", /custo|dinheiro|econom|preço|preco|lucro|r\$|fatur/],
      ["relogio", /24 ?h|hora|tempo|rápid|rapid|minuto|noite|sempre/], ["celular", /celular|app|notifica|tela de|smartphone|reels|tiktok/],
      ["robo", /\bia\b|robô|robo|agente|automa|intelig/], ["alvo", /alvo|meta|objetivo|públic|public|segment/], ["pessoa", /pessoa|profission|empreend|cliente|rosto|equipe/]];
    if (/\d+ ?%/.test(c.texto_tela || "")) return "numero";
    for (const [k, re] of regras) if (re.test(t)) return k;
    return ["robo", "grafico", "chat", "celular"][i % 4];
  }
  const segundos = d => {
    const s = String(d || ""), n = s.match(/(\d+(?:[.,]\d+)?)\s*s?\s*(?:-|a|–|até)\s*(\d+(?:[.,]\d+)?)/);
    if (n) return +n[2].replace(",", ".") - +n[1].replace(",", ".");
    const m = s.match(/(\d+(?:[.,]\d+)?)/); return m ? +m[1].replace(",", ".") : 4;
  };

  /* ---------- texto ---------- */
  function quebrar(g, txt, larg) {
    const out = []; let l = "";
    for (const p of String(txt || "").split(/\s+/).filter(Boolean)) { const t = l ? l + " " + p : p; if (g.measureText(t).width > larg && l) { out.push(l); l = p; } else l = t; }
    if (l) out.push(l); return out;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // título cinético: palavras entram uma a uma com pulo
  function titulo(g, txt, cx, y, larg, p, cor, fundo, tam = 58) {
    g.font = `900 ${tam}px system-ui,sans-serif`; g.textAlign = "left"; g.textBaseline = "middle";
    const linhas = quebrar(g, txt, larg).slice(0, 3); let k = 0; const total = linhas.reduce((a, l) => a + l.split(" ").length, 0);
    linhas.forEach((l, li) => {
      const pal = l.split(" "), lw = g.measureText(l).width, esp = g.measureText(" ").width; let x = cx - lw / 2;
      const yy = y + li * tam * 1.18;
      if (fundo) { const a = ease(seg(p, 0.05, 0.25)); g.fillStyle = fundo; g.globalAlpha = a; rr(g, cx - (lw / 2 + 18) * a, yy - tam * 0.62, (lw + 36) * a, tam * 1.2, 14); g.fill(); g.globalAlpha = 1; }
      for (const w of pal) {
        const a = seg(p, 0.08 + (k / Math.max(1, total)) * 0.3, 0.2 + (k / Math.max(1, total)) * 0.3), s = back(a), ww = g.measureText(w).width;
        g.save(); g.globalAlpha = clamp(a * 2, 0, 1); g.translate(x + ww / 2, yy + (1 - ease(a)) * 30); g.scale(s, s);
        g.fillStyle = cor; g.fillText(w, -ww / 2, 0); g.restore();
        x += ww + esp; k++;
      }
    });
    return linhas.length * tam * 1.18;
  }
  // legenda estilo Reels: as palavras acendem conforme a fala
  function legenda(g, txt, y, p, ac) {
    if (!txt) return;
    g.font = "800 34px system-ui,sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
    const todas = String(txt).split(/\s+/).filter(Boolean), n = todas.length, atual = Math.floor(seg(p, 0.05, 0.92) * n);
    // mostra um bloco de até ~7 palavras por vez
    const bloco = 7, ini = Math.floor(Math.min(atual, n - 1) / bloco) * bloco, pal = todas.slice(ini, ini + bloco);
    const linhas = quebrar(g, pal.join(" "), W - 120); let k = ini;
    const altura = linhas.length * 46 + 24;
    g.fillStyle = "rgba(0,0,0,.55)"; rr(g, 40, y - 12, W - 80, altura, 18); g.fill();
    linhas.forEach((l, li) => {
      const lw = g.measureText(l).width, esp = g.measureText(" ").width; let x = W / 2 - lw / 2;
      for (const w of l.split(" ")) {
        const dito = k <= atual, agora = k === atual;
        g.fillStyle = agora ? ac : dito ? "#fff" : "rgba(255,255,255,.45)";
        g.fillText(w, x, y + 22 + li * 46);
        if (agora) { g.fillRect(x, y + 44 + li * 46, g.measureText(w).width, 4); }
        x += g.measureText(w).width + esp; k++;
      }
    });
  }

  /* ---------- fundo animado ---------- */
  function fundo(g, pal, sec) {
    const [bg, ac, ac2] = pal;
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, bg); gr.addColorStop(1, "#07060c"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const x = W * (0.5 + 0.42 * Math.sin(sec * 0.35 + i * 1.7)), y = H * (0.5 + 0.4 * Math.cos(sec * 0.28 + i * 2.3)), r = 220 + 60 * Math.sin(sec + i);
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, (i % 2 ? ac : ac2) + "33"); rg.addColorStop(1, "transparent"); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
    g.fillStyle = "rgba(255,255,255,.06)";
    for (let i = 0; i < 40; i++) { const x = (i * 97 + sec * (12 + i % 5) * 6) % W, y = (i * 211 + sec * 20 * (1 + i % 3)) % H; g.fillRect(x, H - y, 3, 3); }
  }

  /* ---------- ilustrações animadas ---------- */
  function ilustrar(g, tipo, cx, cy, p, sec, pal, c) {
    const [, ac, ac2] = pal, S = 1;
    g.save(); g.translate(cx, cy); g.lineCap = "round"; g.lineJoin = "round";
    const entra = back(seg(p, 0, 0.18)); g.scale(entra, entra);
    const branco = "#ffffff", cinza = "rgba(255,255,255,.18)";
    switch (tipo) {
      case "chat": {
        g.fillStyle = "#11131a"; rr(g, -150, -230, 300, 460, 36); g.fill(); g.strokeStyle = cinza; g.lineWidth = 4; g.stroke();
        g.fillStyle = ac; rr(g, -150, -230, 300, 60, 36); g.fill(); g.fillStyle = branco; g.font = "700 22px system-ui"; g.textAlign = "center"; g.fillText("🤖 Atendente IA", 0, -192);
        const msgs = [[-1, 150], [1, 120], [-1, 170], [1, 90], [1, 140]];
        let y = -150;
        msgs.forEach(([lado, w], i) => {
          const a = back(seg(p, 0.12 + i * 0.13, 0.22 + i * 0.13)); if (a <= 0) return;
          g.save(); g.translate(lado < 0 ? -125 + w / 2 : 125 - w / 2, y + 22); g.scale(a, a);
          g.fillStyle = lado < 0 ? "#2b2f39" : ac; rr(g, -w / 2, -22, w, 44, 16); g.fill();
          g.fillStyle = "rgba(255,255,255,.75)"; for (let k = 0; k < 3; k++) g.fillRect(-w / 2 + 14, -10 + k * 9, (w - 28) * (k === 2 ? 0.5 : 1), 4);
          if (lado > 0 && seg(p, 0.2 + i * 0.13, 0.3 + i * 0.13) > 0.9) { g.fillStyle = ac2; g.font = "700 18px system-ui"; g.fillText("✓✓", w / 2 - 22, 16); }
          g.restore(); y += 62;
        });
        // digitando…
        g.fillStyle = "#2b2f39"; rr(g, -125, 175, 80, 36, 16); g.fill();
        for (let k = 0; k < 3; k++) { g.fillStyle = branco; g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(sec * 6 + k)); g.beginPath(); g.arc(-105 + k * 20, 193, 5, 0, 7); g.fill(); }
        g.globalAlpha = 1; break;
      }
      case "grafico": case "numero": {
        g.strokeStyle = cinza; g.lineWidth = 4; g.beginPath(); g.moveTo(-220, -160); g.lineTo(-220, 170); g.lineTo(230, 170); g.stroke();
        const barras = 6;
        for (let i = 0; i < barras; i++) { const hgt = 60 + i * 42, a = ease(seg(p, 0.1 + i * 0.06, 0.4 + i * 0.06)); g.fillStyle = i === barras - 1 ? ac2 : ac; g.globalAlpha = 0.85; rr(g, -195 + i * 72, 170 - hgt * a, 48, hgt * a, 8); g.fill(); }
        g.globalAlpha = 1;
        const pts = Array.from({ length: 7 }, (_, i) => [-210 + i * 72, 120 - i * 40 - Math.sin(i * 1.3) * 18]);
        const q = ease(seg(p, 0.2, 0.75)) * (pts.length - 1);
        g.strokeStyle = branco; g.lineWidth = 7; g.beginPath(); g.moveTo(...pts[0]);
        for (let i = 1; i <= Math.floor(q); i++) g.lineTo(...pts[i]);
        const f = q - Math.floor(q), a0 = pts[Math.floor(q)], a1 = pts[Math.min(pts.length - 1, Math.floor(q) + 1)];
        const px = a0[0] + (a1[0] - a0[0]) * f, py = a0[1] + (a1[1] - a0[1]) * f; g.lineTo(px, py); g.stroke();
        g.fillStyle = ac2; g.beginPath(); g.arc(px, py, 12 + 3 * Math.sin(sec * 8), 0, 7); g.fill();
        const num = (String(c.texto_tela || "").match(/(\d+)\s*%/) || [])[1];
        if (num || tipo === "numero") { const v = Math.round((+num || 100) * ease(seg(p, 0.15, 0.7))); g.fillStyle = branco; g.font = "900 96px system-ui"; g.textAlign = "center"; g.fillText((num ? v + "%" : "+" + v + "%"), 0, -190); }
        else { g.fillStyle = ac2; g.font = "900 80px system-ui"; g.textAlign = "center"; g.globalAlpha = ease(seg(p, 0.6, 0.8)); g.fillText("↗", 170, -150); g.globalAlpha = 1; }
        break;
      }
      case "dashboard": {
        g.fillStyle = "#11131a"; rr(g, -260, -210, 520, 420, 24); g.fill(); g.strokeStyle = cinza; g.lineWidth = 3; g.stroke();
        g.fillStyle = branco; g.font = "800 24px system-ui"; g.textAlign = "left"; g.fillText("CRM · Leads", -230, -170);
        for (let i = 0; i < 5; i++) {
          const y = -125 + i * 64, a = ease(seg(p, 0.08 + i * 0.08, 0.2 + i * 0.08));
          g.globalAlpha = a; g.fillStyle = "#1d2029"; rr(g, -235 + (1 - a) * 60, y, 470, 50, 12); g.fill();
          g.fillStyle = ac; g.beginPath(); g.arc(-205, y + 25, 15, 0, 7); g.fill();
          g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(-175, y + 15, 140, 8); g.fillRect(-175, y + 30, 90, 6);
          const ok = seg(p, 0.3 + i * 0.1, 0.38 + i * 0.1);
          if (ok > 0) { g.save(); g.translate(150, y + 25); g.scale(back(ok), back(ok)); g.fillStyle = "#3fbf5f"; rr(g, -70, -16, 140, 32, 16); g.fill(); g.fillStyle = branco; g.font = "800 17px system-ui"; g.textAlign = "center"; g.fillText("✓ Qualificado", 0, 6); g.restore(); }
          g.globalAlpha = 1;
        }
        break;
      }
      case "cadeado": {
        for (let k = 0; k < 3; k++) { const r = ((sec * 120 + k * 90) % 270) + 60; g.strokeStyle = ac; g.globalAlpha = 1 - r / 330; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
        g.globalAlpha = 1;
        g.fillStyle = ac; g.beginPath(); g.moveTo(0, -200); g.quadraticCurveTo(160, -170, 160, -120); g.quadraticCurveTo(160, 100, 0, 200); g.quadraticCurveTo(-160, 100, -160, -120); g.quadraticCurveTo(-160, -170, 0, -200); g.fill();
        const fecha = ease(seg(p, 0.35, 0.55));
        g.strokeStyle = branco; g.lineWidth = 18; g.beginPath(); g.arc(0, -35 - (1 - fecha) * 40, 48, Math.PI, 0); g.stroke();
        g.fillStyle = branco; rr(g, -75, -30, 150, 120, 18); g.fill();
        g.fillStyle = ac; g.beginPath(); g.arc(0, 20, 14, 0, 7); g.fill(); g.fillRect(-6, 20, 12, 36);
        if (fecha >= 1) { const a = back(seg(p, 0.55, 0.7)); g.save(); g.translate(110, 120); g.scale(a, a); g.fillStyle = "#3fbf5f"; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill(); g.strokeStyle = branco; g.lineWidth = 10; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-4, 15); g.lineTo(20, -14); g.stroke(); g.restore(); }
        break;
      }
      case "celular": {
        g.rotate(Math.sin(sec * 1.5) * 0.04);
        g.fillStyle = "#11131a"; rr(g, -140, -240, 280, 480, 40); g.fill(); g.strokeStyle = branco; g.lineWidth = 6; g.stroke();
        g.fillStyle = "#000"; rr(g, -40, -225, 80, 18, 9); g.fill();
        for (let i = 0; i < 4; i++) {
          const a = ease(seg(p, 0.1 + i * 0.15, 0.25 + i * 0.15)), y = -180 + i * 95;
          g.globalAlpha = a; g.fillStyle = i % 2 ? "#2b2f39" : ac; rr(g, -120, y + (1 - a) * -40, 240, 80, 16); g.fill();
          g.fillStyle = branco; g.beginPath(); g.arc(-88, y + 40, 18, 0, 7); g.fill();
          g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(-60, y + 26, 140, 8); g.fillRect(-60, y + 44, 100, 7); g.globalAlpha = 1;
        }
        const n = Math.round(ease(seg(p, 0.1, 0.8)) * 12); g.fillStyle = "#e5484d"; g.beginPath(); g.arc(130, -230, 34, 0, 7); g.fill();
        g.fillStyle = branco; g.font = "900 32px system-ui"; g.textAlign = "center"; g.fillText(String(n), 130, -219);
        break;
      }
      case "relogio": {
        g.strokeStyle = cinza; g.lineWidth = 22; g.beginPath(); g.arc(0, 0, 200, 0, 7); g.stroke();
        g.strokeStyle = ac; g.beginPath(); g.arc(0, 0, 200, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ease(seg(p, 0.05, 0.85))); g.stroke();
        g.fillStyle = "#11131a"; g.beginPath(); g.arc(0, 0, 170, 0, 7); g.fill();
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = branco; g.fillRect(Math.cos(a) * 145 - 4, Math.sin(a) * 145 - 4, 8, 8); }
        const h = sec * 2.2, m = sec * 14;
        g.strokeStyle = branco; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(h) * 80, Math.sin(h) * 80); g.stroke();
        g.strokeStyle = ac2; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(m) * 125, Math.sin(m) * 125); g.stroke();
        g.fillStyle = ac; g.font = "900 64px system-ui"; g.textAlign = "center"; g.fillText("24h", 0, -250);
        break;
      }
      case "dinheiro": {
        for (let i = 0; i < 9; i++) {
          const col = i % 3, lin = Math.floor(i / 3), alvo = 150 - lin * 34 - (col === 1 ? 0 : 0), a = ease(seg(p, 0.08 + i * 0.07, 0.25 + i * 0.07));
          const x = -110 + col * 110, y = -320 + (alvo + 320) * a;
          g.fillStyle = ac2; g.beginPath(); g.ellipse(x, y, 52, 18, 0, 0, 7); g.fill(); g.fillStyle = "#c99a1a"; g.fillRect(x - 52, y, 104, 14); g.beginPath(); g.ellipse(x, y + 14, 52, 18, 0, 0, Math.PI); g.fill();
        }
        g.fillStyle = branco; g.font = "900 110px system-ui"; g.textAlign = "center"; g.globalAlpha = ease(seg(p, 0.6, 0.8)); g.fillText("R$", 0, -150); g.globalAlpha = 1;
        const baixo = /custo|reduz|menos|econom/i.test(`${c.texto_tela} ${c.fala}`);
        if (baixo) { const a = ease(seg(p, 0.5, 0.75)); g.strokeStyle = "#3fbf5f"; g.lineWidth = 16; g.beginPath(); g.moveTo(190, -120); g.lineTo(190, -120 + 170 * a); g.stroke(); g.fillStyle = "#3fbf5f"; g.beginPath(); g.moveTo(160, -120 + 170 * a); g.lineTo(220, -120 + 170 * a); g.lineTo(190, -80 + 170 * a); g.fill(); }
        break;
      }
      case "robo": {
        const pulo = Math.sin(sec * 3) * 10; g.translate(0, pulo);
        g.strokeStyle = branco; g.lineWidth = 8; g.beginPath(); g.moveTo(0, -200); g.lineTo(0, -160); g.stroke();
        g.fillStyle = ac2; g.beginPath(); g.arc(0, -210, 16 + 4 * Math.sin(sec * 8), 0, 7); g.fill();
        g.fillStyle = "#e9ecf3"; rr(g, -150, -160, 300, 230, 50); g.fill();
        g.fillStyle = "#11131a"; rr(g, -115, -125, 230, 150, 34); g.fill();
        const pisca = (sec % 3) < 0.12 ? 0.15 : 1;
        g.fillStyle = ac; g.save(); g.translate(-50, -55); g.scale(1, pisca); g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.restore();
        g.save(); g.translate(50, -55); g.scale(1, pisca); g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.restore();
        g.strokeStyle = ac; g.lineWidth = 7; g.beginPath(); g.arc(0, -20, 34, 0.2, Math.PI - 0.2); g.stroke();
        g.fillStyle = "#e9ecf3"; rr(g, -110, 85, 220, 140, 30); g.fill(); g.fillStyle = ac; g.beginPath(); g.arc(0, 150, 24, 0, 7); g.fill();
        const braco = Math.sin(sec * 6) * 0.5; g.save(); g.translate(125, 110); g.rotate(-0.9 + braco); g.fillStyle = "#e9ecf3"; rr(g, -14, -110, 28, 110, 14); g.fill(); g.restore();
        const b = back(seg(p, 0.25, 0.4)); if (b > 0) { g.save(); g.translate(-180, -230); g.scale(b, b); g.fillStyle = branco; rr(g, -120, -40, 220, 80, 24); g.fill(); g.fillStyle = "#11131a"; g.font = "800 30px system-ui"; g.textAlign = "center"; g.fillText("Olá! 👋", -10, 10); g.restore(); }
        break;
      }
      case "integracao": {
        const nos = [[-180, -150, "#25d366", "💬"], [180, -150, ac, "📊"], [0, 170, ac2, "🤖"]];
        g.lineWidth = 6; g.setLineDash([14, 12]); g.lineDashOffset = -sec * 60;
        [[0, 1], [1, 2], [2, 0]].forEach(([a, b], i) => { const t = ease(seg(p, 0.15 + i * 0.12, 0.35 + i * 0.12)); g.strokeStyle = branco; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(nos[a][0], nos[a][1]); g.lineTo(nos[a][0] + (nos[b][0] - nos[a][0]) * t, nos[a][1] + (nos[b][1] - nos[a][1]) * t); g.stroke(); });
        g.setLineDash([]); g.globalAlpha = 1;
        // pacotes viajando
        [[0, 1], [1, 2], [2, 0]].forEach(([a, b], i) => { if (p < 0.5) return; const t = (sec * 0.8 + i / 3) % 1; g.fillStyle = ac2; g.beginPath(); g.arc(nos[a][0] + (nos[b][0] - nos[a][0]) * t, nos[a][1] + (nos[b][1] - nos[a][1]) * t, 11, 0, 7); g.fill(); });
        nos.forEach(([x, y, cor, ic], i) => { const s = back(seg(p, i * 0.1, 0.15 + i * 0.1)); g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = cor; g.beginPath(); g.arc(0, 0, 80, 0, 7); g.fill(); g.font = "72px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ic, 0, 4); g.restore(); });
        break;
      }
      case "alvo": {
        [200, 150, 100, 50].forEach((r, i) => { g.fillStyle = i % 2 ? branco : ac; g.beginPath(); g.arc(0, 0, r * ease(seg(p, i * 0.05, 0.2 + i * 0.05)), 0, 7); g.fill(); });
        const v = ease(seg(p, 0.35, 0.55)); g.save(); g.translate(260 * (1 - v), -260 * (1 - v)); g.rotate(-0.78);
        g.fillStyle = ac2; g.fillRect(-6, 0, 12, 200); g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.lineTo(0, -34); g.fill(); g.restore();
        break;
      }
      default: { // pessoa
        g.fillStyle = ac; g.beginPath(); g.arc(0, -120, 80, 0, 7); g.fill();
        g.beginPath(); g.moveTo(-160, 200); g.quadraticCurveTo(-150, -20, 0, -20); g.quadraticCurveTo(150, -20, 160, 200); g.fill();
        g.fillStyle = "#11131a"; rr(g, -120, 60, 240, 150, 14); g.fill(); g.fillStyle = ac2; g.globalAlpha = 0.5 + 0.5 * Math.sin(sec * 4); g.beginPath(); g.arc(0, 135, 22, 0, 7); g.fill(); g.globalAlpha = 1;
        for (let i = 0; i < 6; i++) { const a = sec * 1.5 + i; const r = 230 + 20 * Math.sin(sec * 3 + i); g.fillStyle = ac2; g.font = "36px system-ui"; g.textAlign = "center"; g.globalAlpha = 0.6 + 0.4 * Math.sin(sec * 4 + i); g.fillText("✦", Math.cos(a) * r, Math.sin(a) * r * 0.7 - 40); }
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }

  /* ---------- trilha sonora (Web Audio) ---------- */
  function trilha(ac, destino, cenas, total) {
    const mestre = ac.createGain(); mestre.gain.value = 0.55; mestre.connect(destino);
    const t0 = ac.currentTime + 0.05, bpm = 112, beat = 60 / bpm;
    const ruido = (() => { const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
    const nota = (freq, ini, dur, tipo = "sine", vol = 0.2, ataque = 0.01) => { const o = ac.createOscillator(), gg = ac.createGain(); o.type = tipo; o.frequency.value = freq; gg.gain.setValueAtTime(0, ini); gg.gain.linearRampToValueAtTime(vol, ini + ataque); gg.gain.exponentialRampToValueAtTime(0.001, ini + dur); o.connect(gg).connect(mestre); o.start(ini); o.stop(ini + dur + 0.05); };
    const chimbal = ini => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gg = ac.createGain(); s.buffer = ruido; f.type = "highpass"; f.frequency.value = 7000; gg.gain.setValueAtTime(0.08, ini); gg.gain.exponentialRampToValueAtTime(0.001, ini + 0.06); s.connect(f).connect(gg).connect(mestre); s.start(ini); s.stop(ini + 0.08); };
    const bumbo = ini => { const o = ac.createOscillator(), gg = ac.createGain(); o.frequency.setValueAtTime(140, ini); o.frequency.exponentialRampToValueAtTime(45, ini + 0.15); gg.gain.setValueAtTime(0.6, ini); gg.gain.exponentialRampToValueAtTime(0.001, ini + 0.25); o.connect(gg).connect(mestre); o.start(ini); o.stop(ini + 0.3); };
    const acordes = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]]; // Am F G E
    const nBeats = Math.ceil(total / beat);
    for (let b = 0; b < nBeats; b++) {
      const t = t0 + b * beat, fim = b > nBeats - 3;
      if (b >= 2 && !fim) bumbo(t);
      chimbal(t + beat / 2);
      if (b % 4 === 0) { const ac_ = acordes[(b / 4) % 4]; ac_.forEach(f => nota(f, t, beat * 4, "triangle", 0.05, 0.3)); nota(ac_[0] / 2, t, beat * 1.8, "sawtooth", 0.06); nota(ac_[0] / 2, t + beat * 2, beat * 1.8, "sawtooth", 0.06); }
      if (b % 2 === 1 && b > 4 && !fim) nota(acordes[Math.floor(b / 4) % 4][(b >> 1) % 3] * 2, t, beat * 0.5, "square", 0.025);
    }
    // efeitos em cada cena: "whoosh" na troca e "ding" quando o roteiro pede
    let acc = 0;
    for (const c of cenas) {
      const t = t0 + acc;
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gg = ac.createGain(); s.buffer = ruido; f.type = "bandpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4000, t + 0.35); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.18, t + 0.12); gg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      s.connect(f).connect(gg).connect(mestre); s.start(t); s.stop(t + 0.5);
      if (/ding|confirma|notifica|alerta|sino|plim/i.test(c.audio || "") || c.tipo === "dashboard" || c.tipo === "cadeado") { nota(1318.5, t + c.s * 0.45, 0.6, "sine", 0.12); nota(1975.5, t + c.s * 0.45 + 0.08, 0.6, "sine", 0.08); }
      acc += c.s;
    }
    mestre.gain.setValueAtTime(0.55, t0 + total - 1.2); mestre.gain.linearRampToValueAtTime(0, t0 + total);
  }

  /* ---------- montagem ---------- */
  async function gerar(r, o = {}) {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error("Este navegador não grava vídeo. Use o Chrome no computador.");
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H; const g = canvas.getContext("2d");
    const cta = (String(r.roteiro || "").match(/CTA:\s*(.+)$/m) || [])[1];
    const cenas = (r.cenas || []).map((c, i) => ({ ...c, tipo: escolherTipo(c, i), s: clamp(segundos(c.duracao) || 4, 2.5, 7) }));
    const lista = [{ capa: true, s: 3 }, ...cenas, ...(cta ? [{ fim: true, s: 3, fala: "" }] : [])];
    const total = lista.reduce((a, x) => a + x.s, 0);
    if (o.canvas) o.canvas(canvas);

    const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume().catch(() => {});
    const destino = ac.createMediaStreamDestination();
    const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...destino.stream.getAudioTracks()]);
    const tipo = ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1,opus", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(t => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo, videoBitsPerSecond: 5000000 } : {}), partes = [];
    rec.ondataavailable = e => e.data.size && partes.push(e.data);

    const quadro = sec => {
      let acc = 0, i = 0; for (; i < lista.length - 1; i++) { if (sec < acc + lista[i].s) break; acc += lista[i].s; }
      const x = lista[i], p = clamp((sec - acc) / x.s, 0, 1), pal = PALETAS[i % PALETAS.length];
      fundo(g, pal, sec);
      // transição: entra deslizando e sai com zoom
      const entrada = ease(seg(p, 0, 0.12)), saida = seg(p, 0.92, 1);
      g.save(); g.translate(W / 2, H / 2); g.scale(1 + saida * 0.08, 1 + saida * 0.08); g.translate(-W / 2 + (1 - entrada) * W * 0.35, -H / 2); g.globalAlpha = Math.min(1, entrada * 1.5) * (1 - saida * 0.9);
      if (x.capa) {
        g.fillStyle = pal[1]; g.font = "800 26px system-ui"; g.textAlign = "center"; g.globalAlpha *= ease(seg(p, 0, 0.2)); g.fillText("NEXT CO. APRESENTA", W / 2, 300); g.globalAlpha = Math.min(1, entrada * 1.5) * (1 - saida * 0.9);
        titulo(g, r.titulo, W / 2, 470, W - 110, p, "#fff", null, 72);
        g.font = "600 34px system-ui"; g.fillStyle = "rgba(255,255,255,.85)"; g.textAlign = "center";
        quebrar(g, r.gancho, W - 140).slice(0, 4).forEach((l, k) => { g.globalAlpha = ease(seg(p, 0.45 + k * 0.08, 0.6 + k * 0.08)); g.fillText(l, W / 2, 850 + k * 46); });
      } else if (x.fim) {
        titulo(g, cta, W / 2, 520, W - 110, p, "#fff", null, 60);
        const pulso = 1 + 0.05 * Math.sin(sec * 6); g.save(); g.translate(W / 2, 900); g.scale(pulso * back(seg(p, 0.3, 0.5)), pulso * back(seg(p, 0.3, 0.5)));
        g.fillStyle = pal[1]; rr(g, -200, -50, 400, 100, 50); g.fill(); g.fillStyle = "#fff"; g.font = "900 38px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Fale com a gente", 0, 2); g.restore();
      } else {
        g.fillStyle = pal[1]; g.font = "800 24px system-ui"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(`${x.n || i} / ${cenas.length}`, 48, 70);
        ilustrar(g, x.tipo, W / 2, 470, p, sec, pal, x);
        titulo(g, x.texto_tela || "", W / 2, 830, W - 100, p, "#fff", pal[1], 56);
        legenda(g, x.fala, 1010, p, pal[2]);
      }
      g.restore();
      // barra de progresso no topo
      g.fillStyle = "rgba(255,255,255,.15)"; g.fillRect(0, 0, W, 8); g.fillStyle = pal[1]; g.fillRect(0, 0, W * (sec / total), 8);
    };

    quadro(0);
    trilha(ac, destino, cenas, total);
    rec.start(500);
    const t0 = performance.now();
    await new Promise(res => {
      // timer em vez de requestAnimationFrame: continua gravando mesmo se a aba ficar em segundo plano
      const id = setInterval(() => {
        if (o.cancelado && o.cancelado()) { clearInterval(id); return res(); }
        const sec = (performance.now() - t0) / 1000;
        if (sec >= total) { clearInterval(id); return res(); }
        quadro(sec); if (o.aoProgredir) o.aoProgredir(sec / total);
      }, 1000 / FPS);
    });
    await new Promise(res => { rec.onstop = res; try { rec.stop(); } catch (e) { res(); } });
    ac.close().catch(() => {});
    if (o.cancelado && o.cancelado()) return null;
    return { blob: new Blob(partes, { type: tipo || "video/webm" }), ext: /mp4/.test(tipo) ? "mp4" : "webm", duracao: total };
  }
  return { gerar, escolherTipo, TIPOS };
})();
