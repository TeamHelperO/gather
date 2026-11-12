/* Corte (editor de vídeo da sala de Edição) — vídeo vertical 1080×1920, 30 fps, gerado no navegador.
   Direção de motion (referência de ritmo: cases de UI do Oto Criativo):
   – abre com o benefício e coloca a "interface" em ação cedo; fundo escuro da marca com luz localizada;
   – em cada cena de interface: estado inicial → cursor vai ao controle → toque no mesmo quadro do clique → resposta real
     (mensagem enviada, lead qualificado, filtro aplicado, proteção ligada…) → câmera aproxima do detalhe → tempo de leitura;
   – cenas ligadas por máscara circular a partir do ponto de foco; texto entra por máscara, palavra a palavra;
   – textos dentro da área segura dos Reels (topo 170 px, base 380 px em 1920); legenda acompanha a narração;
   – SFX no frame do clique e da mudança de estado; música abaixa durante a voz.
   Ativos: fonte Inter (OFL, assets/fonts) e ícones Lucide (ISC, js/icones-lucide.js).
   Uso: Video.gerar(roteiro, { voz, aoStatus(txt), aoProgredir(p), cancelado(), canvas(el) }) → Promise<{ blob, ext, duracao, comVoz, aviso }>
   Tudo é derivado do tempo (segundos) da composição: cada quadro é desenhado a partir de "sec". */
window.Video = (function () {
  /* ---------- composição (edite aqui) ---------- */
  const SAIDA = { w: 1080, h: 1920, fps: 30, bitrate: 8000000 };
  const W = 720, H = 1280, K = SAIDA.w / W;               // desenho em 720×1280, gravado em 1080×1920
  const SEGURA = { topo: 115, base: 1025 };                // área segura (Reels/TikTok) no espaço de 720×1280
  const COR = { fundo: "#16141f", fundo2: "#221e33", acento: "#3d5afe", acentoClaro: "#8a9bff", ok: "#3fbf5f", alerta: "#f2a33a",
    card: "#201c2e", card2: "#2a2540", linha: "rgba(255,255,255,.10)", texto: "#ffffff", suave: "rgba(255,255,255,.62)" };
  const FONTE = "Inter, system-ui, sans-serif";
  const TEMPO = { entrada: 0.45, clique: 1.05, resposta: 0.7, mascara: 0.42 }; // segundos

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => (t = clamp(t, 0, 1), 1 - Math.pow(1 - t, 3));
  const easeIO = t => (t = clamp(t, 0, 1), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const back = t => { t = clamp(t, 0, 1); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const seg = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- fonte e ícones ---------- */
  let fontesProntas = null;
  function carregarFontes() {
    if (fontesProntas) return fontesProntas;
    const base = new URL("assets/fonts/", location.href).href;
    fontesProntas = Promise.all([600, 800, 900].map(p => new FontFace("Inter", `url(${base}inter-latin-${p}-normal.woff2) format("woff2")`, { weight: String(p) })
      .load().then(f => document.fonts.add(f)).catch(() => {})));
    return fontesProntas;
  }
  const PATHS = {};
  function icone(g, nome, x, y, tam, cor, esp = 2.2) {
    const d = (window.ICONES_LUCIDE || {})[nome]; if (!d) return;
    const p = PATHS[nome] || (PATHS[nome] = new Path2D(d));
    g.save(); g.translate(x - tam / 2, y - tam / 2); g.scale(tam / 24, tam / 24);
    g.strokeStyle = cor; g.lineWidth = esp; g.lineCap = "round"; g.lineJoin = "round"; g.stroke(p); g.restore();
  }
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function cartao(g, x, y, w, h, r = 22, cor = COR.card) {
    g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 30; g.shadowOffsetY = 14; g.fillStyle = cor; rr(g, x, y, w, h, r); g.fill(); g.restore();
    g.strokeStyle = COR.linha; g.lineWidth = 2; rr(g, x, y, w, h, r); g.stroke();
  }
  const barra = (g, x, y, w, h = 8, cor = "rgba(255,255,255,.28)") => { if (w <= 0) return; g.fillStyle = cor; rr(g, x, y, w, h, h / 2); g.fill(); };
  const fonte = (peso, tam) => `${peso} ${tam}px ${FONTE}`;

  /* ---------- qual cena usar ---------- */
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
  // título: cada linha sobe de dentro de uma máscara, palavra a palavra
  function titulo(g, txt, cx, y, larg, loc, tam = 60, cor = COR.texto, atraso = 0.1) {
    g.font = fonte(900, tam); g.textBaseline = "alphabetic"; g.textAlign = "left";
    const linhas = quebrar(g, txt, larg).slice(0, 3), lh = tam * 1.12; let k = 0;
    linhas.forEach((l, li) => {
      const pal = l.split(" "), lw = g.measureText(l).width, esp = g.measureText(" ").width; let x = cx - lw / 2;
      const base = y + li * lh;
      g.save(); g.beginPath(); g.rect(0, base - tam * 1.05, W, tam * 1.35); g.clip();
      for (const w of pal) {
        const t = ease((loc - atraso - k * 0.06) / 0.38), ww = g.measureText(w).width;
        g.fillStyle = cor; g.fillText(w, x, base + (1 - t) * tam * 1.1);
        x += ww + esp; k++;
      }
      g.restore();
    });
    return linhas.length * lh;
  }
  // legenda: bloco de até 2 linhas; a palavra falada ganha uma pílula da cor da marca
  function legenda(g, txt, y, fracao) {
    if (!txt) return;
    g.font = fonte(800, 31); g.textAlign = "left"; g.textBaseline = "middle";
    const todas = String(txt).split(/\s+/).filter(Boolean), n = todas.length, atual = Math.min(n - 1, Math.floor(clamp(fracao, 0, 1) * n));
    const blocos = []; let i = 0;
    while (i < n) { let j = i + 1; while (j < n && quebrar(g, todas.slice(i, j + 1).join(" "), W - 140).length <= 2) j++; blocos.push([i, j]); i = j; }
    const [ini, fim] = blocos.find(([a, b]) => atual >= a && atual < b) || blocos[blocos.length - 1];
    const linhas = quebrar(g, todas.slice(ini, fim).join(" "), W - 140); let k = ini;
    linhas.forEach((l, li) => {
      const lw = g.measureText(l).width, esp = g.measureText(" ").width; let x = W / 2 - lw / 2; const yy = y + li * 46;
      for (const w of l.split(" ")) {
        const ww = g.measureText(w).width;
        if (k === atual) { g.fillStyle = COR.acento; rr(g, x - 7, yy - 21, ww + 14, 42, 10); g.fill(); }
        g.fillStyle = k <= atual ? "#fff" : "rgba(255,255,255,.5)";
        g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 8; g.fillText(w, x, yy + 1); g.restore();
        x += ww + esp; k++;
      }
    });
  }

  /* ---------- fundo: escuro da marca com luz localizada no foco ---------- */
  function fundo(g, sec, fx = W / 2, fy = 440) {
    g.fillStyle = COR.fundo; g.fillRect(0, 0, W, H);
    const lx = fx + Math.sin(sec * 0.5) * 30, ly = fy + Math.cos(sec * 0.4) * 24;
    let rg = g.createRadialGradient(lx, ly, 0, lx, ly, 520); rg.addColorStop(0, "rgba(61,90,254,.38)"); rg.addColorStop(.55, "rgba(61,90,254,.08)"); rg.addColorStop(1, "rgba(61,90,254,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    rg = g.createRadialGradient(W * .85, H * .92, 0, W * .85, H * .92, 420); rg.addColorStop(0, "rgba(138,155,255,.14)"); rg.addColorStop(1, "rgba(138,155,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.05)";
    for (let y = 40; y < H; y += 40) for (let x = 20 + ((y / 40) % 2) * 20; x < W; x += 40) g.fillRect(x, y, 2, 2);
  }

  /* ---------- cursor (vetor), anel do clique, botões ---------- */
  function cursor(g, x, y, aperto, alpha = 1) {
    if (alpha <= 0) return;
    g.save(); g.globalAlpha = alpha; g.translate(x, y); const s = 1 - 0.14 * aperto; g.scale(s, s);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 34); g.lineTo(9, 26); g.lineTo(15.5, 40); g.lineTo(21.5, 37.5); g.lineTo(15, 23.5); g.lineTo(27, 23.5); g.closePath();
    g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.fillStyle = "#fff"; g.fill(); g.shadowColor = "transparent"; g.strokeStyle = "#11131a"; g.lineWidth = 2.4; g.lineJoin = "round"; g.stroke();
    g.restore();
  }
  function anel(g, x, y, t, cor = COR.acentoClaro) {
    if (t <= 0 || t >= 1) return;
    g.save(); g.strokeStyle = cor; g.globalAlpha = 1 - t; g.lineWidth = 4 * (1 - t) + 1;
    g.beginPath(); g.arc(x, y, 12 + 46 * ease(t), 0, 7); g.stroke();
    g.globalAlpha = (1 - t) * 0.5; g.beginPath(); g.arc(x, y, 6 + 26 * ease(t), 0, 7); g.stroke(); g.restore();
  }
  function botao(g, x, y, w, h, txt, ativo, ic) {
    g.fillStyle = ativo ? COR.ok : COR.acento; rr(g, x, y, w, h, h / 2); g.fill();
    g.fillStyle = "#fff"; g.font = fonte(800, 20); g.textAlign = "center"; g.textBaseline = "middle";
    if (ic) { icone(g, ic, x + 30, y + h / 2, 22, "#fff", 2.6); g.fillText(txt, x + w / 2 + 12, y + h / 2 + 1); } else g.fillText(txt, x + w / 2, y + h / 2 + 1);
  }
  function chave(g, x, y, ligado) {
    g.fillStyle = ligado > 0.5 ? COR.ok : "rgba(255,255,255,.2)"; rr(g, x, y, 76, 42, 21); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(x + 21 + 34 * easeIO(ligado), y + 21, 16, 0, 7); g.fill();
  }

  /* ---------- cenas ----------
     Cada cena: alvo = ponto do controle (relativo ao centro) ou null; desenhar(g, e, a, sec, c), com origem no centro.
     e = entrada (0→1); a = resposta depois do clique (0→1), ou -1 antes do clique. */
  const CENAS = {
    chat: { alvo: [148, 197], meia: 205, alt: 272, desenhar(g, e, a) {
      cartao(g, -200, -270, 400, 520, 34);
      g.save(); rr(g, -200, -270, 400, 520, 34); g.clip(); g.fillStyle = COR.acento; g.fillRect(-200, -270, 400, 74); g.restore();
      icone(g, "bot", -160, -233, 30, "#fff"); g.fillStyle = "#fff"; g.font = fonte(800, 21); g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("Atendente IA", -134, -242);
      g.fillStyle = "rgba(255,255,255,.75)"; g.font = fonte(600, 15); g.fillText("online agora", -134, -219);
      const m0 = back(seg(e, 0.2, 0.8)); g.save(); g.translate(-50, -150); g.scale(m0, m0); g.fillStyle = COR.card2; rr(g, -125, -28, 250, 56, 18); g.fill(); barra(g, -105, -12, 200); barra(g, -105, 6, 120); g.restore();
      g.fillStyle = COR.card2; rr(g, -178, 172, 290, 50, 25); g.fill(); barra(g, -156, 192, a < 0 ? 170 * ease(seg(e, 0.5, 1)) : 0, 10, "rgba(255,255,255,.35)");
      g.fillStyle = a >= 0 ? COR.ok : COR.acento; g.beginPath(); g.arc(148, 197, 26, 0, 7); g.fill(); icone(g, a >= 0 ? "check-check" : "zap", 148, 197, 24, "#fff", 2.6);
      if (a < 0) return;
      const r1 = back(seg(a, 0, 0.3)); g.save(); g.translate(60, -60); g.scale(r1, r1); g.fillStyle = COR.acento; rr(g, -125, -30, 250, 60, 18); g.fill(); barra(g, -105, -14, 200, 8, "rgba(255,255,255,.85)"); barra(g, -105, 4, 140, 8, "rgba(255,255,255,.85)"); g.restore();
      const r2 = back(seg(a, 0.35, 0.65)); if (r2 > 0) { g.save(); g.translate(30, 40); g.scale(r2, r2); g.fillStyle = COR.acento; rr(g, -155, -40, 310, 80, 18); g.fill(); barra(g, -135, -22, 260, 8, "rgba(255,255,255,.85)"); barra(g, -135, -4, 220, 8, "rgba(255,255,255,.85)"); barra(g, -135, 14, 130, 8, "rgba(255,255,255,.85)"); g.restore(); }
      if (a > 0.7) { g.globalAlpha = seg(a, 0.7, 0.9); icone(g, "check-check", 165, 95, 22, COR.ok, 2.6); g.globalAlpha = 1; }
    }},
    dashboard: { alvo: [160, -205], meia: 285, alt: 252, desenhar(g, e, a) {
      cartao(g, -280, -250, 560, 470, 28);
      g.fillStyle = "#fff"; g.font = fonte(800, 24); g.textAlign = "left"; g.textBaseline = "middle"; icone(g, "layout-dashboard", -244, -205, 26, COR.acentoClaro); g.fillText("Leads de hoje", -222, -204);
      botao(g, 80, -230, 170, 50, a >= 0 ? "Feito" : "Qualificar", a >= 0, a >= 0 ? "badge-check" : "sparkles");
      for (let i = 0; i < 5; i++) {
        const y = -150 + i * 70, en = ease(seg(e, 0.15 + i * 0.1, 0.6 + i * 0.1));
        g.globalAlpha = en; g.fillStyle = COR.card2; rr(g, -250 + (1 - en) * 40, y, 500, 56, 14); g.fill();
        g.fillStyle = [COR.acento, COR.alerta, COR.acentoClaro, COR.ok, COR.acento][i]; g.beginPath(); g.arc(-218, y + 28, 15, 0, 7); g.fill();
        barra(g, -190, y + 16, 150, 9, "rgba(255,255,255,.7)"); barra(g, -190, y + 33, 90, 7);
        const ok = a < 0 ? 0 : back(seg(a, i * 0.12, i * 0.12 + 0.3));
        if (ok > 0) { g.save(); g.translate(160, y + 28); g.scale(ok, ok); g.fillStyle = COR.ok; rr(g, -72, -17, 144, 34, 17); g.fill(); icone(g, "badge-check", -50, 0, 18, "#fff", 2.6); g.fillStyle = "#fff"; g.font = fonte(800, 15); g.textAlign = "center"; g.fillText("Qualificado", 12, 1); g.restore(); }
        g.globalAlpha = 1;
      }
    }},
    celular: { alvo: [0, -110], meia: 175, alt: 292, desenhar(g, e, a) {
      g.save(); g.rotate(lerp(-0.08, 0, ease(e)));
      g.fillStyle = "#0d0c14"; rr(g, -170, -290, 340, 580, 48); g.fill(); g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 5; rr(g, -170, -290, 340, 580, 48); g.stroke();
      g.fillStyle = "#000"; rr(g, -50, -274, 100, 24, 12); g.fill();
      g.fillStyle = "#fff"; g.font = fonte(900, 54); g.textAlign = "center"; g.textBaseline = "middle"; g.globalAlpha = a < 0 ? 1 : 1 - seg(a, 0, 0.3); g.fillText("09:41", 0, -195); g.globalAlpha = 1;
      const aberto = a < 0 ? 0 : easeIO(seg(a, 0, 0.45));
      for (let i = 2; i >= 0; i--) {
        const en = ease(seg(e, 0.15 + i * 0.15, 0.55 + i * 0.15)), y = -150 + i * 92 + (1 - en) * -30;
        if (i === 0) {
          const h = lerp(80, 300, aberto), yy = lerp(y, -230, aberto);
          g.globalAlpha = en; g.fillStyle = "rgba(255,255,255,.97)"; rr(g, -150, yy, 300, h, 20); g.fill();
          g.fillStyle = COR.acento; g.beginPath(); g.arc(-112, yy + 40, 20, 0, 7); g.fill(); icone(g, "bell", -112, yy + 40, 22, "#fff", 2.6);
          barra(g, -80, yy + 26, 160, 9, "rgba(20,20,30,.75)"); barra(g, -80, yy + 44, 110, 8, "rgba(20,20,30,.4)");
          if (aberto > 0.6) { g.globalAlpha = seg(aberto, 0.6, 1); for (let k = 0; k < 4; k++) barra(g, -126, yy + 96 + k * 30, [240, 210, 230, 150][k], 10, "rgba(20,20,30,.3)"); botao(g, -126, yy + h - 64, 252, 46, "Responder", a > 0.8, "message-circle"); }
          g.globalAlpha = 1;
        } else {
          g.globalAlpha = en * (1 - aberto); g.fillStyle = "rgba(255,255,255,.85)"; rr(g, -150, y, 300, 80, 20); g.fill();
          g.fillStyle = i === 1 ? COR.ok : COR.alerta; g.beginPath(); g.arc(-112, y + 40, 20, 0, 7); g.fill();
          barra(g, -80, y + 28, 150, 9, "rgba(20,20,30,.6)"); barra(g, -80, y + 46, 90, 8, "rgba(20,20,30,.35)"); g.globalAlpha = 1;
        }
      }
      g.restore();
    }},
    integracao: { alvo: [0, 200], meia: 255, alt: 235, desenhar(g, e, a, sec) {
      const nos = [[-180, -150, "#25d366", "message-circle", "WhatsApp"], [180, -150, COR.acento, "layout-dashboard", "CRM"], [0, 40, COR.acentoClaro, "bot", "IA"]];
      const ligado = a < 0 ? 0 : ease(seg(a, 0, 0.5));
      g.lineWidth = 6; g.setLineDash([12, 12]); g.lineDashOffset = -sec * 50;
      [[0, 2], [1, 2], [0, 1]].forEach(([p, q], i) => { const t = ease(seg(ligado, i * 0.2, 0.5 + i * 0.2)); if (t <= 0) return; g.strokeStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.moveTo(nos[p][0], nos[p][1]); g.lineTo(lerp(nos[p][0], nos[q][0], t), lerp(nos[p][1], nos[q][1], t)); g.stroke(); });
      g.setLineDash([]);
      if (ligado >= 1) [[0, 2], [2, 1], [1, 0]].forEach(([p, q], i) => { const t = (sec * 0.9 + i / 3) % 1; g.fillStyle = COR.ok; g.beginPath(); g.arc(lerp(nos[p][0], nos[q][0], t), lerp(nos[p][1], nos[q][1], t), 9, 0, 7); g.fill(); });
      nos.forEach(([x, y, cor, ic, nome], i) => {
        const s = back(seg(e, i * 0.12, 0.45 + i * 0.12)); g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = cor; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill(); icone(g, ic, 0, -2, 56, "#fff", 2.2);
        g.fillStyle = "#fff"; g.font = fonte(800, 20); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(nome, 0, 98);
        if (ligado > 0.6 + i * 0.1) { const k = back(seg(ligado, 0.6 + i * 0.1, 0.9 + i * 0.1)); g.save(); g.translate(52, -52); g.scale(k, k); g.fillStyle = COR.ok; g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill(); icone(g, "check-check", 0, 0, 22, "#fff", 2.8); g.restore(); }
        g.restore();
      });
      botao(g, -110, 172, 220, 56, ligado > 0.3 ? "Conectado" : "Conectar", ligado > 0.3, ligado > 0.3 ? "check-check" : "link");
    }},
    cadeado: { alvo: [130, 207], meia: 215, alt: 250, desenhar(g, e, a, sec) {
      const lig = a < 0 ? 0 : seg(a, 0, 0.35), fecha = ease(seg(a, 0.2, 0.55));
      if (lig > 0) for (let k = 0; k < 3; k++) { const r = ((sec * 110 + k * 80) % 240) + 120; g.strokeStyle = COR.ok; g.globalAlpha = Math.max(0, 1 - r / 360) * lig; g.lineWidth = 4; g.beginPath(); g.arc(0, -40, r, 0, 7); g.stroke(); }
      g.globalAlpha = 1;
      const s = back(seg(e, 0, 0.6)); g.save(); g.translate(0, -40); g.scale(s, s);
      g.fillStyle = lig > 0.5 ? COR.ok : COR.acento; g.beginPath(); g.moveTo(0, -170); g.quadraticCurveTo(140, -145, 140, -100); g.quadraticCurveTo(140, 80, 0, 170); g.quadraticCurveTo(-140, 80, -140, -100); g.quadraticCurveTo(-140, -145, 0, -170); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 16; g.lineCap = "round"; g.beginPath(); g.arc(0, -25 - (1 - fecha) * 34, 42, Math.PI, 0); g.stroke();
      g.fillStyle = "#fff"; rr(g, -64, -22, 128, 100, 16); g.fill(); g.fillStyle = lig > 0.5 ? COR.ok : COR.acento; g.beginPath(); g.arc(0, 20, 12, 0, 7); g.fill(); g.fillRect(-5, 20, 10, 30);
      g.restore();
      cartao(g, -210, 175, 420, 64, 32); g.fillStyle = "#fff"; g.font = fonte(800, 21); g.textAlign = "left"; g.textBaseline = "middle"; icone(g, "shield-check", -178, 207, 26, lig > 0.5 ? COR.ok : COR.suave); g.fillText("Proteção de dados", -152, 208);
      chave(g, 92, 186, lig);
    }},
    grafico: { alvo: [168, -231], meia: 285, alt: 272, desenhar(g, e, a, sec, c) {
      cartao(g, -280, -270, 560, 500, 28);
      g.fillStyle = "#fff"; g.font = fonte(800, 22); g.textAlign = "left"; g.textBaseline = "middle"; icone(g, "trending-up", -244, -228, 26, COR.acentoClaro); g.fillText("Resultados", -222, -227);
      const on = a >= 0; g.fillStyle = on ? COR.acento : COR.card2; rr(g, 96, -254, 144, 46, 23); g.fill(); g.fillStyle = "#fff"; g.font = fonte(800, 17); g.textAlign = "center"; g.fillText(on ? "✓ Com IA" : "Com IA", 168, -230);
      const cresc = on ? easeIO(seg(a, 0, 0.7)) : 0;
      const base = [0.35, 0.42, 0.38, 0.48, 0.45, 0.5], alvo = [0.4, 0.52, 0.6, 0.72, 0.84, 0.98];
      for (let i = 0; i < 6; i++) { const v = lerp(base[i], alvo[i], cresc) * ease(seg(e, 0.1 + i * 0.05, 0.6 + i * 0.05)), h = 300 * v; g.fillStyle = i === 5 && on ? COR.ok : COR.acento; g.globalAlpha = i === 5 ? 1 : 0.8; rr(g, -236 + i * 80, 190 - h, 52, h, 10); g.fill(); g.globalAlpha = 1; }
      g.strokeStyle = COR.linha; g.lineWidth = 2; g.beginPath(); g.moveTo(-250, 192); g.lineTo(250, 192); g.stroke();
      const num = (String(c.texto_tela || "").match(/(\d+)\s*%/) || [])[1];
      g.textAlign = "left";
      if (num) { g.fillStyle = "#fff"; g.font = fonte(900, 64); g.fillText(Math.round(+num * cresc) + "%", -244, -150); }
      else if (on) { g.globalAlpha = seg(a, 0.5, 0.8); g.fillStyle = COR.ok; rr(g, -250, -180, 150, 48, 24); g.fill(); icone(g, "trending-up", -220, -156, 24, "#fff", 2.8); g.fillStyle = "#fff"; g.font = fonte(800, 20); g.fillText("Subindo", -196, -155); g.globalAlpha = 1; }
    }},
    relogio: { alvo: null, desenhar(g, e, a, sec) {
      const s = back(seg(e, 0, 0.6)); g.scale(s, s);
      g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 20; g.beginPath(); g.arc(0, -10, 210, 0, 7); g.stroke();
      g.strokeStyle = COR.acento; g.beginPath(); g.arc(0, -10, 210, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * easeIO(seg(e, 0.2, 1) * 0.6 + (a < 0 ? 0 : seg(a, 0, 0.8) * 0.4))); g.stroke();
      cartao(g, -180, -190, 360, 360, 180, COR.card);
      for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; g.fillStyle = i % 3 ? "rgba(255,255,255,.4)" : "#fff"; g.beginPath(); g.arc(Math.cos(an) * 150, -10 + Math.sin(an) * 150, i % 3 ? 4 : 7, 0, 7); g.fill(); }
      const h = sec * 1.6 - 1, m = sec * 9;
      g.strokeStyle = "#fff"; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -10); g.lineTo(Math.cos(h) * 80, -10 + Math.sin(h) * 80); g.stroke();
      g.strokeStyle = COR.acentoClaro; g.lineWidth = 7; g.beginPath(); g.moveTo(0, -10); g.lineTo(Math.cos(m) * 120, -10 + Math.sin(m) * 120); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(0, -10, 10, 0, 7); g.fill();
      g.fillStyle = COR.acento; rr(g, -70, 228, 140, 54, 27); g.fill(); g.fillStyle = "#fff"; g.font = fonte(900, 30); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("24 h", 0, 256);
    }},
    dinheiro: { alvo: null, desenhar(g, e, a, sec, c) {
      cartao(g, -250, -250, 500, 470, 28);
      const baixo = /custo|reduz|menos|econom|corta/i.test(`${c.texto_tela} ${c.fala}`);
      g.fillStyle = "#fff"; g.font = fonte(800, 22); g.textAlign = "left"; g.textBaseline = "middle"; icone(g, baixo ? "piggy-bank" : "wallet", -214, -206, 26, COR.acentoClaro); g.fillText(baixo ? "Custo da operação" : "Faturamento", -192, -205);
      const t = easeIO(seg(e, 0.2, 1)), pts = Array.from({ length: 8 }, (_, i) => [-210 + i * 60, baixo ? -120 + i * 34 * t + Math.sin(i * 1.7) * 14 : 120 - i * 34 * t + Math.sin(i * 1.7) * 14]);
      g.strokeStyle = baixo ? COR.ok : COR.acentoClaro; g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      const [ux, uy] = pts[pts.length - 1]; g.fillStyle = baixo ? COR.ok : COR.acentoClaro; g.beginPath(); g.arc(ux, uy, 12 + 3 * Math.sin(sec * 7), 0, 7); g.fill();
      const k = back(seg(e, 0.65, 0.9)); if (k > 0) { g.save(); g.translate(0, 170); g.scale(k, k); g.fillStyle = baixo ? COR.ok : COR.acento; rr(g, -110, -27, 220, 54, 27); g.fill(); icone(g, baixo ? "trending-down" : "trending-up", -76, 0, 24, "#fff", 2.8); g.fillStyle = "#fff"; g.font = fonte(800, 20); g.textAlign = "center"; g.fillText(baixo ? "Custo menor" : "Mais vendas", 14, 1); g.restore(); }
    }},
    robo: { alvo: null, desenhar(g, e, a, sec) {
      const s = back(seg(e, 0, 0.6)); g.scale(s, s); g.translate(0, Math.sin(sec * 2.6) * 8);
      g.strokeStyle = "#fff"; g.lineWidth = 7; g.beginPath(); g.moveTo(0, -205); g.lineTo(0, -165); g.stroke();
      g.fillStyle = COR.acentoClaro; g.beginPath(); g.arc(0, -214, 14 + 3 * Math.sin(sec * 8), 0, 7); g.fill();
      g.fillStyle = "#eef0ff"; rr(g, -150, -165, 300, 220, 56); g.fill();
      g.fillStyle = "#11131a"; rr(g, -116, -130, 232, 140, 38); g.fill();
      const pisca = (sec % 2.8) < 0.12 ? 0.15 : 1;
      for (const ex of [-50, 50]) { g.save(); g.translate(ex, -66); g.scale(1, pisca); g.fillStyle = COR.acentoClaro; g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill(); g.restore(); }
      g.strokeStyle = COR.acentoClaro; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.arc(0, -32, 28, 0.25, Math.PI - 0.25); g.stroke();
      g.fillStyle = "#eef0ff"; rr(g, -105, 70, 210, 130, 30); g.fill(); g.fillStyle = COR.acento; g.beginPath(); g.arc(0, 135, 22, 0, 7); g.fill(); icone(g, "zap", 0, 135, 24, "#fff", 2.8);
      const b = back(seg(e, 0.4, 0.7)); if (b > 0) { g.save(); g.translate(60, -250); g.scale(b, b); cartao(g, -100, -34, 200, 68, 24, "#fff"); g.fillStyle = "#11131a"; g.font = fonte(800, 23); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Posso ajudar?", 0, 1); g.restore(); }
    }},
    alvo: { alvo: null, desenhar(g, e) {
      [210, 160, 110, 60].forEach((r, i) => { g.fillStyle = i % 2 ? "rgba(255,255,255,.92)" : COR.acento; g.beginPath(); g.arc(0, -10, r * ease(seg(e, i * 0.07, 0.4 + i * 0.07)), 0, 7); g.fill(); });
      const v = easeIO(seg(e, 0.45, 0.75)); g.save(); g.translate(lerp(260, 0, v), lerp(-270, -10, v)); g.rotate(-0.78);
      g.fillStyle = COR.alerta; g.fillRect(-5, 0, 10, 190); g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.lineTo(0, -32); g.fill(); g.restore();
      if (v >= 1) anel(g, 0, -10, seg(e, 0.75, 1), COR.alerta);
    }},
    pessoa: { alvo: null, desenhar(g, e) {
      cartao(g, -230, -240, 460, 460, 32);
      g.globalAlpha = ease(seg(e, 0, 0.5));
      g.fillStyle = COR.acento; g.beginPath(); g.arc(0, -110, 70, 0, 7); g.fill(); icone(g, "user", 0, -110, 76, "#fff", 2);
      g.fillStyle = "#fff"; g.font = fonte(900, 30); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Seu cliente", 0, -10);
      [["star", COR.alerta], ["heart", "#e5484d"], ["badge-check", COR.ok]].forEach(([ic, cor], i) => { const k = back(seg(e, 0.3 + i * 0.12, 0.6 + i * 0.12)); g.save(); g.translate(-120 + i * 120, 100); g.scale(k, k); g.fillStyle = COR.card2; rr(g, -48, -48, 96, 96, 24); g.fill(); icone(g, ic, 0, 0, 44, cor, 2.4); g.restore(); });
      g.globalAlpha = 1;
    }},
  };
  CENAS.numero = CENAS.grafico;
  const ICONES_EM_VOLTA = { chat: ["message-circle", "check-check", "zap"], grafico: ["trending-up", "rocket", "chart-no-axes-column"], numero: ["trending-up", "target", "sparkles"],
    dashboard: ["layout-dashboard", "badge-check", "flame"], cadeado: ["lock", "shield-check", "badge-check"], celular: ["smartphone", "bell", "heart"],
    relogio: ["clock", "moon", "zap"], dinheiro: ["wallet", "trending-down", "piggy-bank"], robo: ["bot", "sparkles", "cog"], integracao: ["link", "cog", "refresh-cw"],
    pessoa: ["user", "lightbulb", "star"], alvo: ["target", "map-pin", "sparkles"] };
  function iconesEmVolta(g, tipo, loc, sec, meia = 210) {
    (ICONES_EM_VOLTA[tipo] || ["sparkles", "star", "zap"]).forEach((ic, i) => {
      const k = back(seg(loc, 0.35 + i * 0.12, 0.7 + i * 0.12)); if (k <= 0) return;
      const d = meia + 58, pos = [[-d, -250], [d, -30], [-d, 230]][i];
      g.save(); g.translate(pos[0], pos[1] + Math.sin(sec * 2 + i * 1.7) * 9); g.scale(k, k);
      g.fillStyle = "rgba(61,90,254,.22)"; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
      g.strokeStyle = "rgba(138,155,255,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.stroke();
      icone(g, ic, 0, 0, 30, "#fff", 2.2); g.restore();
    });
  }

  /* ---------- narração (voz pt-BR gerada no navegador, Piper/VITS) ---------- */
  const VOZ = "pt_BR-faber-medium";
  let tts = null;
  async function narrar(ac, lista, o) {
    tts = tts || await import(new URL("js/vendor/vits/vits-web.js", location.href).href);
    const salvas = await tts.stored().catch(() => []);
    if (!salvas.includes(VOZ)) {
      if (o.aoStatus) o.aoStatus("Baixando a voz em português (só na primeira vez, ~60 MB)…");
      await tts.download(VOZ, pr => { if (o.aoStatus && pr.total) o.aoStatus(`Baixando a voz em português (só na primeira vez)… ${Math.round(pr.loaded * 100 / pr.total)}%`); });
    }
    const falas = lista.filter(x => x.texto);
    for (let i = 0; i < falas.length; i++) {
      if (o.cancelado && o.cancelado()) return;
      if (o.aoStatus) o.aoStatus(`🎙️ Gravando a narração ${i + 1} de ${falas.length}…`);
      const wav = await tts.predict({ text: falas[i].texto, voiceId: VOZ });
      falas[i].vozBuf = await ac.decodeAudioData(await wav.arrayBuffer());
    }
  }
  const limparFala = t => String(t || "").replace(/[*_#>`~|]/g, " ").replace(/\s+/g, " ").trim();

  /* ---------- trilha, SFX no frame da ação e narração ---------- */
  function trilha(ac, destino, lista, total) {
    const mestre = ac.createGain(); mestre.gain.value = 1; mestre.connect(destino);
    const musica = ac.createGain(); musica.connect(mestre);
    const t0 = ac.currentTime + 0.1, beat = 60 / 112;
    const temVoz = lista.some(x => x.vozBuf), base = temVoz ? 0.28 : 0.5;
    musica.gain.setValueAtTime(base, t0);
    const ruido = (() => { const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
    const nota = (freq, ini, dur, tipo = "sine", vol = 0.2, ataque = 0.01, saida = musica) => { const o = ac.createOscillator(), gg = ac.createGain(); o.type = tipo; o.frequency.value = freq; gg.gain.setValueAtTime(0, ini); gg.gain.linearRampToValueAtTime(vol, ini + ataque); gg.gain.exponentialRampToValueAtTime(0.001, ini + dur); o.connect(gg).connect(saida); o.start(ini); o.stop(ini + dur + 0.05); };
    const ruidoCurto = (ini, freq, dur, vol, saida = mestre) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gg = ac.createGain(); s.buffer = ruido; f.type = "highpass"; f.frequency.value = freq; gg.gain.setValueAtTime(vol, ini); gg.gain.exponentialRampToValueAtTime(0.001, ini + dur); s.connect(f).connect(gg).connect(saida); s.start(ini); s.stop(ini + dur + 0.02); };
    const bumbo = ini => { const o = ac.createOscillator(), gg = ac.createGain(); o.frequency.setValueAtTime(140, ini); o.frequency.exponentialRampToValueAtTime(45, ini + 0.15); gg.gain.setValueAtTime(0.55, ini); gg.gain.exponentialRampToValueAtTime(0.001, ini + 0.25); o.connect(gg).connect(musica); o.start(ini); o.stop(ini + 0.3); };
    const acordes = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];
    const nBeats = Math.ceil(total / beat);
    for (let b = 0; b < nBeats; b++) {
      const t = t0 + b * beat, fim = b > nBeats - 3;
      if (b >= 2 && !fim) bumbo(t);
      ruidoCurto(t + beat / 2, 7000, 0.06, 0.07, musica);
      if (b % 4 === 0) { const c = acordes[(b / 4) % 4]; c.forEach(f => nota(f, t, beat * 4, "triangle", 0.05, 0.3)); nota(c[0] / 2, t, beat * 1.8, "sawtooth", 0.05); nota(c[0] / 2, t + beat * 2, beat * 1.8, "sawtooth", 0.05); }
    }
    let acc = 0;
    for (const c of lista) {
      const t = t0 + acc;
      if (acc > 0) { // whoosh da máscara
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gg = ac.createGain(); s.buffer = ruido; f.type = "bandpass"; f.Q.value = 1.2;
        f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(4200, t + TEMPO.mascara); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.13, t + 0.12); gg.gain.exponentialRampToValueAtTime(0.001, t + TEMPO.mascara + 0.08);
        s.connect(f).connect(gg).connect(mestre); s.start(t); s.stop(t + 0.6);
      }
      if (c.tClique != null) { // clique no mesmo quadro do toque + "pop" da resposta
        const tc = t + c.tClique; ruidoCurto(tc, 2500, 0.035, 0.22); nota(1800, tc, 0.05, "square", 0.04, 0.002, mestre);
        nota(880, tc + 0.06, 0.18, "sine", 0.09, 0.005, mestre); nota(1320, tc + 0.12, 0.25, "sine", 0.07, 0.005, mestre);
      }
      if (c.vozBuf) {
        const ini = t + c.vozIni, fimVoz = ini + c.vozBuf.duration;
        const v = ac.createBufferSource(), vg = ac.createGain(); v.buffer = c.vozBuf; vg.gain.value = 1.15; v.connect(vg).connect(mestre); v.start(ini);
        musica.gain.setTargetAtTime(base * 0.45, ini - 0.15, 0.08); musica.gain.setTargetAtTime(base, fimVoz + 0.05, 0.25);
      }
      acc += c.s;
    }
    mestre.gain.setValueAtTime(1, t0 + total - 1.0); mestre.gain.linearRampToValueAtTime(0, t0 + total);
    return t0;
  }

  /* ---------- cada parte do vídeo (capa, cenas, final) ---------- */
  const CENTRO = [W / 2, 448]; // a ilustração vive entre y 160 e 736 (acima do título)
  function desenharParte(g, x, loc, sec, nCenas, r) {
    if (x.capa) {
      fundo(g, sec, W / 2, 560);
      const sel = back(seg(loc, 0, 0.4)); g.save(); g.translate(W / 2, 330); g.scale(sel, sel);
      g.fillStyle = "rgba(61,90,254,.25)"; rr(g, -150, -26, 300, 52, 26); g.fill(); g.strokeStyle = "rgba(138,155,255,.6)"; g.lineWidth = 2; rr(g, -150, -26, 300, 52, 26); g.stroke();
      icone(g, "sparkles", -112, 0, 24, COR.acentoClaro); g.fillStyle = "#fff"; g.font = fonte(800, 20); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Tendência agora", 14, 1); g.restore();
      const h = titulo(g, r.titulo, W / 2, 470, W - 120, loc, 70, "#fff", 0.15);
      g.font = fonte(600, 30); g.fillStyle = COR.suave; g.textAlign = "center"; g.textBaseline = "alphabetic";
      quebrar(g, r.gancho, W - 150).slice(0, 3).forEach((l, k) => { g.globalAlpha = ease((loc - 0.6 - k * 0.1) / 0.4); g.fillText(l, W / 2, 470 + h + 40 + k * 42); });
      g.globalAlpha = 1; return { foco: CENTRO };
    }
    if (x.fim) {
      fundo(g, sec, W / 2, 620);
      titulo(g, x.cta, W / 2, 470, W - 120, loc, 62, "#fff", 0.1);
      const bx = W / 2, by = 720, tc = x.tClique, pres = loc >= tc;
      const k = back(seg(loc, 0.35, 0.75)), pulso = pres ? 1 : 1 + 0.03 * Math.sin(sec * 7), ap = pres && loc < tc + 0.12 ? 0.95 : 1;
      g.save(); g.translate(bx, by); g.scale(k * pulso * ap, k * pulso * ap);
      botao(g, -170, -38, 340, 76, pres ? "Pronto!" : "Fale com a gente", pres, pres ? "check-check" : "message-circle"); g.restore();
      anel(g, bx + 40, by, (loc - tc) / 0.6, COR.ok);
      const tt = easeIO(seg(loc, 0.45, tc)), sai = seg(loc, tc + 0.6, tc + 1);
      cursor(g, lerp(W - 80, bx + 40, tt) + sai * 100, lerp(1000, by, tt) + sai * 140, pres && loc < tc + 0.12 ? 1 : 0, seg(loc, 0.4, 0.55) * (1 - sai));
      return { foco: [bx, by] };
    }
    const cena = CENAS[x.tipo] || CENAS.robo, e = clamp(loc / TEMPO.entrada, 0, 1), tc = x.tClique;
    const ref = tc == null ? TEMPO.clique : tc, a = loc < ref ? -1 : seg(loc, ref, ref + TEMPO.resposta);
    const alvo = cena.alvo ? [CENTRO[0] + cena.alvo[0], CENTRO[1] + cena.alvo[1]] : null;
    fundo(g, sec, alvo ? lerp(CENTRO[0], alvo[0], 0.5) : CENTRO[0], alvo ? lerp(CENTRO[1], alvo[1], 0.5) : CENTRO[1]);
    g.fillStyle = COR.suave; g.font = fonte(800, 20); g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(`${String(x.n).padStart(2, "0")} / ${String(nCenas).padStart(2, "0")}`, 56, SEGURA.topo + 18);
    // câmera: aproximação leve; depois do clique, aproxima do controle e estabiliza para leitura
    // o cartão inteiro continua no quadro: limita o zoom e o deslocamento pela largura da cena
    const meia = cena.meia || 260, alt = cena.alt || 260, margem = W / 2 - 18, margemV = 288;
    const zoomIn = alvo && a >= 0 ? easeIO(seg(a, 0, 0.8)) : 0;
    const z = Math.max(0.9, Math.min(1 + 0.02 * ease(loc / x.s) + 0.1 * zoomIn, margem / meia, margemV / alt));
    let fx = alvo ? lerp(CENTRO[0], alvo[0], 0.35 * zoomIn) : CENTRO[0], fy = alvo ? lerp(CENTRO[1], alvo[1], 0.35 * zoomIn) : CENTRO[1];
    fx = clamp(fx, Math.min(CENTRO[0], CENTRO[0] + meia - margem / z), Math.max(CENTRO[0], CENTRO[0] - meia + margem / z));
    fy = clamp(fy, Math.min(CENTRO[1], CENTRO[1] + alt - margemV / z), Math.max(CENTRO[1], CENTRO[1] - alt + margemV / z));
    const sobe = (1 - ease(e)) * 40;
    g.save(); g.translate(CENTRO[0], CENTRO[1] + sobe); g.scale(z, z); g.translate(-fx, -fy); g.translate(CENTRO[0], CENTRO[1]);
    if (meia < 260) iconesEmVolta(g, x.tipo, loc, sec, meia); // cartões largos ficam sem ícones em volta (respiro)
    cena.desenhar(g, e, a, sec, x);
    g.restore();
    // cursor: entra pelo canto, toca o controle no frame do clique, sai depois do tempo de leitura
    if (alvo && tc != null) {
      const ax = CENTRO[0] + (alvo[0] - fx) * z, ay = CENTRO[1] + sobe + (alvo[1] - fy) * z;
      const t = easeIO(seg(loc, TEMPO.entrada * 0.6, tc));
      const px = lerp(W - 70, ax, t), py = lerp(1020, ay, t), aperto = loc >= tc && loc < tc + 0.12 ? 1 : 0;
      const saida = seg(loc, tc + TEMPO.resposta + 0.4, tc + TEMPO.resposta + 0.8);
      anel(g, ax, ay, (loc - tc) / 0.55);
      cursor(g, px + saida * 120, py + saida * 160, aperto, seg(loc, 0.15, 0.4) * (1 - saida));
    }
    titulo(g, x.texto_tela || "", W / 2, 800, W - 110, loc - 0.15, 54, "#fff", 0.1);
    const fala = x.vozBuf ? clamp((loc - x.vozIni) / x.vozBuf.duration, 0, 1) : seg(loc / x.s, 0.05, 0.92);
    legenda(g, x.fala, 910, fala);
    return { foco: alvo || CENTRO };
  }

  /* ---------- montagem ---------- */
  function montarLista(r) {
    const cta = (String(r.roteiro || "").match(/CTA:\s*(.+)$/m) || [])[1];
    const cenas = (r.cenas || []).map((c, i) => ({ ...c, n: i + 1, tipo: escolherTipo(c, i), s: clamp(segundos(c.duracao) || 4, 2.6, 7) }));
    const reserva = ["robo", "celular", "grafico", "chat", "alvo", "pessoa", "integracao", "relogio"];
    cenas.forEach((c, i) => { if (i && c.tipo === cenas[i - 1].tipo && !c.animacao) c.tipo = reserva.find(t => t !== c.tipo && t !== (cenas[i + 1] || {}).tipo && t !== cenas[i - 1].tipo); });
    const lista = [{ capa: true, s: 2.6, texto: limparFala([r.titulo, r.gancho].filter(Boolean).join(". ")) },
      ...cenas.map(c => ({ ...c, texto: limparFala(c.fala || c.texto_tela) })),
      ...(cta ? [{ fim: true, s: 3, cta, fala: "", texto: limparFala(cta) }] : [])];
    return { lista, nCenas: cenas.length };
  }
  function cronometrar(lista) {
    for (const x of lista) {
      const ui = !x.capa && !x.fim && (CENAS[x.tipo] || {}).alvo;
      const minimo = ui ? TEMPO.clique + TEMPO.resposta + 0.7 : 0;
      if (x.vozBuf) { x.vozIni = x.capa ? 0.3 : 0.15; x.s = Math.max(x.capa ? 2.2 : x.fim ? 2.6 : 2, minimo, x.vozIni + x.vozBuf.duration + 0.3); }
      else x.s = Math.max(x.s, minimo);
      if (x.fim) x.tClique = Math.min(x.s - 0.9, 1.3);
      else if (ui) x.tClique = Math.min(TEMPO.clique, x.s * 0.4);
    }
    return lista.reduce((a, x) => a + x.s, 0);
  }
  function quadroEm(g, lista, nCenas, r, sec, total) {
    let acc = 0, i = 0; for (; i < lista.length - 1; i++) { if (sec < acc + lista[i].s) break; acc += lista[i].s; }
    const x = lista[i], loc = sec - acc;
    g.setTransform(K, 0, 0, K, 0, 0);
    if (i > 0 && loc < TEMPO.mascara) { // máscara circular a partir do foco da cena anterior
      const ant = lista[i - 1], f = desenharParte(g, ant, ant.s, sec, nCenas, r).foco, t = easeIO(loc / TEMPO.mascara);
      g.save(); g.beginPath(); g.arc(f[0], f[1], 10 + t * 1500, 0, 7); g.clip(); desenharParte(g, x, loc, sec, nCenas, r); g.restore();
      g.strokeStyle = COR.acentoClaro; g.globalAlpha = 1 - t; g.lineWidth = 6; g.beginPath(); g.arc(f[0], f[1], 10 + t * 1500, 0, 7); g.stroke(); g.globalAlpha = 1;
    } else desenharParte(g, x, loc, sec, nCenas, r);
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(0, 0, W, 6); g.fillStyle = COR.acento; g.fillRect(0, 0, W * clamp(sec / total, 0, 1), 6);
  }

  async function gerar(r, o = {}) {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error("Este navegador não grava vídeo. Use o Chrome no computador.");
    await carregarFontes();
    const canvas = document.createElement("canvas"); canvas.width = SAIDA.w; canvas.height = SAIDA.h; const g = canvas.getContext("2d");
    const { lista, nCenas } = montarLista(r);
    if (o.canvas) o.canvas(canvas);

    const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume().catch(() => {});
    let semVoz = null;
    if (o.voz !== false) {
      try { await narrar(ac, lista, o); }
      catch (e) { console.warn("narração:", e); semVoz = "Não consegui gerar a voz (" + (e.message || e) + "). O vídeo saiu só com música."; lista.forEach(x => delete x.vozBuf); }
    }
    const total = cronometrar(lista);
    if (o.aoStatus) o.aoStatus("");

    const destino = ac.createMediaStreamDestination();
    const stream = new MediaStream([...canvas.captureStream(SAIDA.fps).getVideoTracks(), ...destino.stream.getAudioTracks()]);
    const tipo = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1,opus",
      "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(t => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo, videoBitsPerSecond: SAIDA.bitrate } : {}), partes = [];
    rec.ondataavailable = e => e.data.size && partes.push(e.data);

    quadroEm(g, lista, nCenas, r, 0, total);
    const t0 = trilha(ac, destino, lista, total);
    rec.start(500);
    await new Promise(res => {
      // timer (não requestAnimationFrame): continua mesmo com a aba em segundo plano; o relógio é o do áudio
      const id = setInterval(() => {
        if (o.cancelado && o.cancelado()) { clearInterval(id); return res(); }
        const sec = Math.max(0, ac.currentTime - t0);
        if (sec >= total) { clearInterval(id); return res(); }
        quadroEm(g, lista, nCenas, r, sec, total); if (o.aoProgredir) o.aoProgredir(sec / total);
      }, 1000 / SAIDA.fps);
    });
    await new Promise(res => { rec.onstop = res; try { rec.stop(); } catch (e) { res(); } });
    ac.close().catch(() => {});
    if (o.cancelado && o.cancelado()) return null;
    return { blob: new Blob(partes, { type: tipo || "video/webm" }), ext: /mp4/.test(tipo) ? "mp4" : "webm", duracao: total, aviso: semVoz, comVoz: lista.some(x => x.vozBuf) };
  }

  // quadro avulso, sem gravar (para conferir composição, área segura e contato do cursor)
  async function previa(r, segundo, canvas) {
    await carregarFontes();
    canvas.width = SAIDA.w; canvas.height = SAIDA.h;
    const { lista, nCenas } = montarLista(r), total = cronometrar(lista);
    quadroEm(canvas.getContext("2d"), lista, nCenas, r, segundo, total);
    return { total, partes: lista.map(x => ({ tipo: x.capa ? "capa" : x.fim ? "fim" : x.tipo, s: x.s, clique: x.tClique })) };
  }
  return { gerar, previa, escolherTipo, TIPOS, carregarFontes, CENAS, COR, SAIDA, TEMPO, SEGURA };
})();
