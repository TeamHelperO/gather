/* Decoração temática automática dos eventos da agenda + logo próprio do espaço.
   – Na agenda, o admin/dono escolhe um tema para o evento (aniversário, Natal, Halloween, festa junina, comemoração).
     De 30 min antes até 15 min depois do evento, a sala do evento ganha os itens do tema sozinha (2D e 3D),
     sem mexer no mapa salvo e sem bloquear a passagem. Ao acabar, tudo some.
   – Logo: o dono sobe um PNG em Configurações → Sala e ele aparece em todos os itens "Logo" do espaço.
   Os desenhos são feitos aqui mesmo, em pixel art, no estilo dos outros itens. */
(function () {
  function tela(w, h, f) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); f((x, y, ww, hh, cor) => { g.fillStyle = cor; g.fillRect(x, y, ww, hh); }, g); return c; }
  const A = (k, w, h, f, label, extra) => { const c = tela(w, h, f); window.ASSETS[k] = { src: c.toDataURL(), w, h, label, cat: "Festa", ...(extra || {}) }; return c; };

  // balões (3 cores por tema)
  const balao = cores => (R, g) => {
    const b = (x, y, c) => { R(x + 1, y, 8, 11, c); R(x, y + 1, 10, 9, c); R(x + 2, y + 2, 2, 3, "rgba(255,255,255,.55)"); R(x + 4, y + 11, 2, 2, c); };
    g.strokeStyle = "#6b6760"; g.lineWidth = 1; g.beginPath(); for (const [x, y] of [[8, 13], [16, 9], [24, 14]]) { g.moveTo(x + .5, y); g.quadraticCurveTo(x + 3, 30, 16.5, 44); } g.stroke();
    b(3, 1, cores[0]); b(11, -3 + 4, cores[1]); b(19, 2, cores[2]); R(13, 43, 7, 3, "#6b6760");
  };
  A("deco_baloes", 32, 48, balao(["#e5484d", "#3d5afe", "#f2c14e"]), "Balões");
  A("deco_baloes_ouro", 32, 48, balao(["#e8b83a", "#d9dce3", "#e8b83a"]), "Balões dourados");
  A("deco_bolo", 32, 32, R => {
    R(4, 26, 24, 3, "#c9ccd6"); R(6, 16, 20, 10, "#f2c1d1"); R(6, 16, 20, 3, "#fff4f7"); R(8, 19, 2, 2, "#e5484d"); R(15, 20, 2, 2, "#3fbf5f"); R(22, 19, 2, 2, "#3d5afe");
    R(9, 10, 14, 6, "#8a5a32"); R(9, 10, 14, 2, "#fff4f7"); R(15, 4, 2, 6, "#f2efe8"); R(15, 1, 2, 3, "#ffb020"); R(15.5, 0, 1, 1, "#ffe08a");
  }, "Bolo de aniversário");
  A("deco_presentes", 32, 24, R => {
    R(1, 8, 14, 14, "#e5484d"); R(7, 8, 2, 14, "#f2c14e"); R(1, 13, 14, 2, "#f2c14e"); R(5, 4, 3, 4, "#f2c14e"); R(9, 4, 3, 4, "#f2c14e");
    R(16, 12, 14, 10, "#3fbf5f"); R(22, 12, 2, 10, "#fff4f7"); R(16, 16, 14, 2, "#fff4f7"); R(20, 9, 3, 3, "#fff4f7"); R(24, 9, 3, 3, "#fff4f7");
  }, "Presentes");
  A("deco_arvore", 48, 72, R => {
    R(20, 62, 8, 8, "#6b3f22"); R(14, 68, 20, 3, "#8a5a32");
    for (let i = 0; i < 4; i++) { const y = 10 + i * 13, w = 14 + i * 8; R(24 - w / 2, y, w, 15, i % 2 ? "#1f7a46" : "#25904f"); R(24 - w / 2 + 2, y + 12, w - 4, 3, "#17633a"); }
    R(21, 2, 6, 6, "#f2c14e"); R(23, 0, 2, 10, "#f2c14e"); R(19, 4, 10, 2, "#f2c14e");
    for (const [x, y, c] of [[16, 20, "#e5484d"], [30, 24, "#3d5afe"], [12, 36, "#f2c14e"], [26, 34, "#e5484d"], [36, 46, "#3d5afe"], [18, 48, "#f2c14e"], [8, 58, "#e5484d"], [30, 56, "#f2c14e"]]) R(x, y, 3, 3, c);
  }, "Árvore de Natal");
  const luzes = W => (R, g) => {
    g.strokeStyle = "#2b2f39"; g.lineWidth = 1; g.beginPath(); for (let x = 0; x < W; x += 24) { g.moveTo(x, 2); g.quadraticCurveTo(x + 12, 12, x + 24, 2); } g.stroke();
    const cores = ["#e5484d", "#3fbf5f", "#f2c14e", "#3d5afe"]; for (let i = 0; i < W / 8; i++) { const x = 4 + i * 8, y = 4 + Math.round(4 * Math.sin((i % 3) * 1.4)); R(x, y, 3, 4, cores[i % 4]); R(x, y, 1, 1, "#ffffff"); }
  };
  A("deco_luzes", 96, 16, luzes(96), "Luzinhas", { z: "wall" }); A("deco_luzes_p", 64, 16, luzes(64), "Luzinhas (curta)", { z: "wall" });
  A("deco_abobora", 32, 32, R => {
    R(15, 3, 3, 6, "#4a7a2a"); R(4, 9, 24, 20, "#e07a1f"); R(2, 12, 28, 14, "#e07a1f"); R(10, 9, 2, 20, "#c4601a"); R(20, 9, 2, 20, "#c4601a");
    R(8, 14, 5, 4, "#2a1a08"); R(19, 14, 5, 4, "#2a1a08"); R(9, 21, 14, 3, "#2a1a08"); R(12, 21, 2, 2, "#e07a1f"); R(18, 21, 2, 2, "#e07a1f"); R(9, 15, 2, 1, "#ffb020"); R(20, 15, 2, 1, "#ffb020");
  }, "Abóbora");
  A("deco_teia", 48, 32, (R, g) => {
    g.strokeStyle = "rgba(240,240,240,.85)"; g.lineWidth = 1; g.beginPath();
    for (const a of [0, .4, .8, 1.2, 1.57]) { g.moveTo(0, 0); g.lineTo(Math.cos(a) * 46, Math.sin(a) * 30); }
    for (const r of [10, 20, 30, 40]) { g.moveTo(r, 0); for (const a of [.4, .8, 1.2, 1.57]) g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.66); }
    g.stroke(); R(24, 14, 5, 4, "#1b1b1f"); R(22, 13, 9, 1, "#1b1b1f"); R(22, 18, 9, 1, "#1b1b1f");
  }, "Teia", { z: "wall" });
  const bandeiras = W => (R, g) => {
    g.strokeStyle = "#6b6760"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(W / 2, 10, W, 2); g.stroke();
    const cores = ["#e5484d", "#f2c14e", "#3fbf5f", "#3d5afe", "#e07aa8", "#ff8a3d"], n = Math.floor(W / 10.5);
    for (let i = 0; i < n; i++) { const x = 3 + i * 10.5, y = 3 + Math.round(5 * Math.sin(Math.PI * (i + .5) / n)); g.fillStyle = cores[i % cores.length]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y); g.lineTo(x + 4, y + 12); g.closePath(); g.fill(); }
  };
  A("deco_bandeirinhas", 96, 24, bandeiras(96), "Bandeirinhas", { z: "wall" }); A("deco_bandeirinhas_p", 64, 24, bandeiras(64), "Bandeirinhas (curta)", { z: "wall" });
  A("deco_fogueira", 32, 32, R => {
    R(4, 24, 24, 4, "#6b3f22"); R(8, 20, 16, 4, "#8a5a32"); R(10, 10, 12, 12, "#ff8a3d"); R(12, 5, 8, 10, "#ffb020"); R(14, 2, 4, 6, "#ffe08a"); R(7, 14, 4, 6, "#ff8a3d"); R(21, 14, 4, 6, "#ff8a3d");
    for (const [x, y] of [[4, 28], [10, 28], [18, 28], [24, 28]]) R(x, y, 5, 3, "#5a5f6b");
  }, "Fogueira");
  A("deco_confete", 32, 32, R => {
    const cores = ["#e5484d", "#f2c14e", "#3fbf5f", "#3d5afe", "#e07aa8"]; let s = 7;
    for (let i = 0; i < 26; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const x = s % 30; s = (s * 1103515245 + 12345) & 0x7fffffff; const y = s % 30; R(x, y, 2, i % 3 ? 1 : 2, cores[i % cores.length]); }
  }, "Confete", { z: "floor" });

  A("deco_ovos", 32, 24, R => {
    R(2, 14, 28, 9, "#c9962a"); R(2, 14, 28, 2, "#e8b83a"); for (let x = 4; x < 28; x += 4) R(x, 16, 2, 7, "#8a5a32");
    for (const [x, c, d] of [[4, "#e07aa8", "#ffffff"], [11, "#8fd0f0", "#3d5afe"], [18, "#f2c14e", "#e5484d"], [24, "#3fbf5f", "#ffffff"]]) { R(x, 6, 6, 9, c); R(x + 1, 5, 4, 1, c); R(x, 9, 6, 1, d); R(x, 12, 6, 1, d); }
  }, "Ovos de Páscoa");
  A("deco_mascara", 32, 24, R => {
    R(3, 6, 26, 10, "#7b4fd8"); R(1, 8, 4, 6, "#7b4fd8"); R(27, 8, 4, 6, "#7b4fd8"); R(7, 9, 6, 4, "#1b1b1f"); R(19, 9, 6, 4, "#1b1b1f");
    R(14, 12, 4, 4, "#f2c14e"); R(4, 2, 3, 6, "#e5484d"); R(8, 0, 3, 7, "#3fbf5f"); R(25, 2, 3, 6, "#f2c14e"); R(12, 16, 8, 2, "#e07aa8"); for (let x = 5; x < 28; x += 4) R(x, 6, 2, 1, "#f2c14e");
  }, "Máscara de carnaval");
  A("deco_fogos", 64, 32, R => {
    const fogo = (cx, cy, c) => { for (let a = 0; a < 12; a++) { const ang = a * Math.PI / 6; for (let r = 3; r < 11; r += 2) R(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.9), 1, 1, c); } R(cx - 1, cy - 1, 2, 2, "#ffffff"); };
    fogo(14, 14, "#f2c14e"); fogo(36, 12, "#e07aa8"); fogo(54, 17, "#8fd0f0");
  }, "Fogos de artifício", { z: "wall" });

  /* faixa com texto: um desenho por texto (criado na hora) */
  function faixa(texto, cor) {
    const k = "deco_faixa_" + (texto + cor).replace(/[^a-z0-9]/gi, "").slice(0, 40);
    if (window.ASSETS[k]) return k;
    const w = 160, h = 28;
    const c = A(k, w, h, (R, g) => {
      R(4, 5, w - 8, 18, cor); R(4, 5, w - 8, 2, "rgba(255,255,255,.3)"); R(0, 8, 6, 12, cor); R(w - 6, 8, 6, 12, cor); R(0, 0, 2, 8, "#6b6760"); R(w - 2, 0, 2, 8, "#6b6760");
      g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; let fs = 13; g.font = `bold ${fs}px system-ui, sans-serif`;
      while (g.measureText(texto).width > w - 18 && fs > 7) { fs--; g.font = `bold ${fs}px system-ui, sans-serif`; }
      g.fillText(texto, w / 2, 14.5);
    }, "Faixa", { z: "wall" });
    if (typeof IMG !== "undefined") IMG[k] = c; // o próprio desenho (já pronto para o 2D e o 3D)
    return k;
  }

  const TEMAS = {
    aniversario: { nome: "🎂 Aniversário", faixa: t => "FELIZ ANIVERSÁRIO!", cor: "#e5484d", cantos: ["deco_baloes", "deco_baloes", "deco_baloes", "deco_baloes"], centro: ["deco_bolo"], parede: "deco_bandeirinhas", chao: "deco_confete" },
    natal: { nome: "🎄 Natal", faixa: t => "FELIZ NATAL!", cor: "#1f7a46", cantos: ["deco_arvore", "deco_presentes", "deco_presentes"], centro: [], parede: "deco_luzes" },
    halloween: { nome: "🎃 Halloween", faixa: t => "HALLOWEEN", cor: "#e07a1f", cantos: ["deco_abobora", "deco_abobora", "deco_abobora", "deco_abobora"], centro: [], parede: "deco_teia" },
    junina: { nome: "🌽 Festa junina", faixa: t => "ARRAIÁ!", cor: "#c4601a", cantos: ["deco_fogueira"], centro: [], parede: "deco_bandeirinhas", parede2: "deco_bandeirinhas" },
    ano_novo: { nome: "🥂 Ano novo", faixa: t => "FELIZ ANO NOVO!", cor: "#1d2040", cantos: ["deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro"], centro: [], parede: "deco_fogos", chao: "deco_confete" },
    carnaval: { nome: "🎭 Carnaval", faixa: t => "CARNAVAL!", cor: "#7b4fd8", cantos: ["deco_mascara", "deco_baloes", "deco_mascara", "deco_baloes"], centro: [], parede: "deco_bandeirinhas", chao: "deco_confete" },
    pascoa: { nome: "🐣 Páscoa", faixa: t => "FELIZ PÁSCOA!", cor: "#e07aa8", cantos: ["deco_ovos", "deco_ovos", "deco_ovos"], centro: [], parede: "deco_bandeirinhas" },
    comemoracao: { nome: "🎊 Comemoração", faixa: t => (t || "PARABÉNS, EQUIPE!").toUpperCase().slice(0, 26), cor: "#3d5afe", cantos: ["deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro"], centro: [], parede: "deco_bandeirinhas", chao: "deco_confete" },
  };

  /* datas comemorativas do ano (o admin liga e escolhe as salas em Configurações → Administração) */
  function pascoaDe(ano) { // algoritmo de Meeus/Jones/Butcher
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }
  const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const ANUAIS = {
    ano_novo: { tema: "ano_novo", nome: "Ano novo", quando: "27/dez a 3/jan", periodo: a => [new Date(a, 11, 27), new Date(a + 1, 0, 3)] },
    carnaval: { tema: "carnaval", nome: "Carnaval", quando: "sábado de carnaval até a Quarta de Cinzas", periodo: a => { const p = pascoaDe(a); return [somaDias(p, -50), somaDias(p, -46)]; } },
    pascoa: { tema: "pascoa", nome: "Páscoa", quando: "semana da Páscoa", periodo: a => { const p = pascoaDe(a); return [somaDias(p, -7), somaDias(p, 1)]; } },
    junina: { tema: "junina", nome: "Festa junina", quando: "1º a 30/jun", periodo: a => [new Date(a, 5, 1), new Date(a, 5, 30)] },
    halloween: { tema: "halloween", nome: "Halloween", quando: "24 a 31/out", periodo: a => [new Date(a, 9, 24), new Date(a, 9, 31)] },
    natal: { tema: "natal", nome: "Natal", quando: "1º a 26/dez", periodo: a => [new Date(a, 11, 1), new Date(a, 11, 26)] },
  };
  function anuaisAtivos(datas, agora = new Date()) {
    const out = [];
    for (const [id, d] of Object.entries(ANUAIS)) {
      const cfg = datas && datas[id]; if (!cfg || !cfg.ativo) continue;
      for (const ano of [agora.getFullYear() - 1, agora.getFullYear()]) { const [i, f] = d.periodo(ano); if (agora >= i && agora < somaDias(f, 1)) { out.push({ id, tema: d.tema, salas: cfg.salas || [] }); break; } }
    }
    return out;
  }
  const periodoTexto = (id, ano = new Date().getFullYear()) => { const [i, f] = ANUAIS[id].periodo(ano), fm = d => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); return `${fm(i)} a ${fm(f)}`; };

  /* tema guardado no fim da pauta: "⟦tema:natal⟧" (não precisa de coluna nova no banco) */
  const MARCA = /\s*⟦tema:([a-z]+)⟧\s*$/;
  const temaDe = r => { const m = r && r.pauta && String(r.pauta).match(MARCA); return m && TEMAS[m[1]] ? m[1] : null; };
  const pautaSemTema = p => p ? String(p).replace(MARCA, "") : p;
  const comTema = (pauta, tema) => { const p = pautaSemTema(pauta || "").trim(); return tema && TEMAS[tema] ? (p ? p + " " : "") + `⟦tema:${tema}⟧` : (p || null); };

  /* onde pôr: cantos livres no chão e a parede de cima */
  function ocupado(x, y, w, h, extra) {
    const T_ = T, x0 = x * T_, y0 = y * T_, x1 = x0 + w, y1 = y0 + h;
    for (const it of allItemsBase()) { if (it.z === "wall" || it.z === "floor") continue; const b = caixa(it); if (b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0) return true; }
    for (const it of extra) { if (it.z === "wall" || it.z === "floor") continue; const a = ASSETS[it.k]; if (it.x * T_ < x1 && it.x * T_ + a.w > x0 && it.y * T_ < y1 && it.y * T_ + a.h > y0) return true; }
    return !livre(x0 + w / 2, y1 - 4);
  }
  const allItemsBase = () => { const d = window.DECORACAO; window.DECORACAO = null; try { return allItems(); } finally { window.DECORACAO = d; } };
  function montarTema(r, tema, titulo) {
    const t = TEMAS[tema], out = [], T_ = T;
    const add = (k, x, y, z) => out.push({ k, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z, room: r.id, deco: true, id: "deco_" + k + "_" + out.length });
    // faixa no maior trecho livre da parede de cima (sem cobrir telão, quadro ou logo)
    const fk = faixa(t.faixa(titulo), t.cor), fa = ASSETS[fk], fw = fa.w / T_;
    const naParede = allItemsBase().filter(o => ASSETS[o.k] && (o.room ? o.room === r.id : (o.x >= r.x - 0.5 && o.x <= r.x + r.w)) && o.y < r.y + 0.3 && o.y > r.y - 3.2
        && /^(telao|tv|projecao|quadro|logo|relogio|claquete|placa)/.test(o.k))
      .map(o => [o.x, o.x + ASSETS[o.k].w / T_]).sort((p, q) => p[0] - q[0]);
    let melhor = [r.x + 0.2, r.x + 0.2], ini = r.x + 0.2;
    for (const [a0, a1] of [...naParede, [r.x + r.w - 0.2, r.x + r.w]]) { if (a0 - ini > melhor[1] - melhor[0]) melhor = [ini, a0]; ini = Math.max(ini, a1); }
    const gap = melhor[1] - melhor[0], fx = gap >= fw ? (melhor[0] + melhor[1]) / 2 - fw / 2 : r.x + r.w / 2 - fw / 2;
    add(fk, fx, gap >= fw ? r.y - 1.6 : r.y - 0.35, "wall");
    if (gap < fw) out[out.length - 1].pendurada = true; // sem espaço na parede: fica pendurada do teto, no meio da sala
    if (t.parede) { // enfeites de parede só onde não há telão, logo, quadro (nem a faixa)
      const cheio = [...naParede, ...(gap >= fw ? [[fx, fx + fw]] : [])], livreEm = (x, pw) => !cheio.some(([a0, a1]) => x < a1 && x + pw > a0);
      let n = 0;
      for (const k of [t.parede, ASSETS[t.parede + "_p"] ? t.parede + "_p" : null].filter(Boolean)) { // primeiro as longas, depois as curtas nos espaços que sobraram
        const pw = ASSETS[k].w / T_;
        for (let x = r.x + 0.3; x + pw <= r.x + r.w - 0.3 && n < 6; x += 0.25) if (livreEm(x, pw)) { add(k, x, r.y - 1.2, "wall"); cheio.push([x, x + pw]); n++; x += pw - 0.25; }
      } }
    // cantos e centro, só onde está livre
    const cantos = [[r.x + 0.4, r.y + 0.3], [r.x + r.w - 0.4, r.y + 0.3], [r.x + 0.4, r.y + r.h - 0.3], [r.x + r.w - 0.4, r.y + r.h - 0.3]];
    t.cantos.forEach((k, i) => {
      const a = ASSETS[k], [cx, cy] = cantos[i % 4], dirx = cx < r.x + r.w / 2 ? 1 : -1, diry = cy < r.y + r.h / 2 ? 1 : -1;
      for (let tent = 0; tent < 16; tent++) {
        const ox = (tent % 4) * 0.7 * dirx, oy = Math.floor(tent / 4) * 0.7 * diry;
        const x = (dirx > 0 ? cx : cx - a.w / T_) + ox, y = (diry > 0 ? cy : cy - a.h / T_) + oy;
        if (x < r.x + 0.1 || x + a.w / T_ > r.x + r.w - 0.1 || y < r.y || y + a.h / T_ > r.y + r.h - 0.1) continue;
        if (!ocupado(x, y, a.w, a.h, out)) { add(k, x, y); break; }
      }
    });
    for (const k of t.centro) { const a = ASSETS[k];
      for (const [dx, dy] of [[0, -2], [0, 0], [-2, -1], [2, -1], [0, 2]]) { const x = r.x + r.w / 2 - a.w / T_ / 2 + dx, y = r.y + r.h / 2 - a.h / T_ / 2 + dy; if (!ocupado(x, y, a.w, a.h, out)) { add(k, x, y); break; } } }
    if (t.chao) for (let i = 0; i < Math.min(8, Math.floor(r.w * r.h / 12)); i++) { const s = (i * 7919 + r.x * 31 + r.y * 17) % 997; add(t.chao, r.x + 0.5 + (s % 100) / 100 * (r.w - 1.5), r.y + 1 + ((s * 13) % 100) / 100 * (r.h - 2), "floor"); }
    return out;
  }

  /* quais eventos estão "valendo" agora (30 min antes até 15 min depois) */
  let opt = {}, assinatura = "", mapaDe = null;
  function atualizar() {
    if (!window.S && typeof S === "undefined") return; if (!opt.reunioes) return;
    if (S !== mapaDe) { mapaDe = S; assinatura = ""; } // mapa novo: monta de novo
    const agora = Date.now(), ativos = (opt.reunioes() || []).filter(r => r.sala_id && temaDe(r) && new Date(r.inicio).getTime() - 30 * 60e3 <= agora && new Date(r.fim).getTime() + 15 * 60e3 >= agora);
    // datas do ano ligadas pelo admin (uma sala com evento da agenda decorado fica com a decoração do evento)
    const anuais = anuaisAtivos((opt.espaco && opt.espaco() || {}).datas).filter(a => !emPrevia || a.id !== emPrevia.id);
    if (emPrevia) anuais.unshift(emPrevia);
    const comEvento = new Set(ativos.map(r => r.sala_id)), doAno = [];
    for (const a of anuais) for (const id of (a.salas.includes("*") ? S.rooms.filter(r => r.type !== "corredor" && !(window.TYPES && TYPES[r.type] && TYPES[r.type].noWalls)).map(r => r.id) : a.salas))
      if (!comEvento.has(id) && !doAno.some(x => x.sala === id)) doAno.push({ sala: id, tema: a.tema });
    const nova = ativos.map(r => r.id + ":" + temaDe(r) + ":" + r.sala_id + ":" + r.titulo).concat(doAno.map(x => "ano:" + x.tema + ":" + x.sala)).sort().join("|");
    if (nova === assinatura) return; assinatura = nova;
    const itens = [];
    for (const r of ativos) { const sala = S.rooms.find(q => q.id === r.sala_id); if (sala) itens.push(...montarTema(sala, temaDe(r), r.titulo)); }
    for (const x of doAno) { const sala = S.rooms.find(q => q.id === x.sala); if (sala) itens.push(...montarTema(sala, x.tema, null)); }
    window.DECORACAO = itens.length ? itens : null;
    try { _itensDe = null; } catch (e) {}
    opt.aoMudar && opt.aoMudar(ativos, doAno);
  }
  /* prévia de uma data do ano fora do período (só nesta tela, não salva nada) */
  let emPrevia = null, pilula = null;
  function previa(id, salas) {
    emPrevia = id && ANUAIS[id] ? { id, tema: ANUAIS[id].tema, salas: salas && salas.length ? salas : ["*"] } : null;
    assinatura = "-"; atualizar();
    if (!pilula) { pilula = document.createElement("button"); pilula.id = "decoPrevia"; pilula.onclick = () => previa(null);
      pilula.style.cssText = "position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:60;border:0;border-radius:999px;padding:8px 14px;background:#3d5afe;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer";
      document.body.appendChild(pilula); }
    pilula.style.display = emPrevia ? "" : "none";
    if (emPrevia) { const t = TEMAS[emPrevia.tema]; pilula.textContent = `👁️ Prévia: ${t ? t.nome : id} · clique para sair`; }
  }
  function iniciar(o) { opt = o || {}; atualizar(); setInterval(atualizar, 30000); }

  /* logo do espaço: o PNG enviado vira o desenho de todos os itens "Logo" (encaixado em 96x64, fundo transparente) */
  let logoOriginal = null;
  function aplicarLogo(dataUrl) {
    if (typeof IMG === "undefined") return;
    if (!logoOriginal) logoOriginal = IMG.logo;
    if (!dataUrl) { if (logoOriginal) IMG.logo = logoOriginal; const fim = () => { montarPulpito(IMG.logo); opt.aoLogo && opt.aoLogo(); }; if (IMG.logo.complete === false) IMG.logo.onload = fim; else fim(); return; }
    const im = new Image();
    im.onload = () => { const a = ASSETS.logo, c = document.createElement("canvas"); c.width = a.w; c.height = a.h; const g = c.getContext("2d");
      const k = Math.min(a.w / im.width, a.h / im.height), w = im.width * k, h = im.height * k; g.imageSmoothingEnabled = true; g.drawImage(im, (a.w - w) / 2, (a.h - h) / 2, w, h);
      // cópia com 4x mais resolução para o 3D (de perto o logo fica nítido)
      const hd = document.createElement("canvas"); hd.width = a.w * 4; hd.height = a.h * 4; hd.getContext("2d").drawImage(im, (hd.width - w * 4) / 2, (hd.height - h * 4) / 2, w * 4, h * 4);
      c._hd = hd; IMG.logo = c; montarPulpito(c); opt.aoLogo && opt.aoLogo(); };
    im.src = dataUrl;
  }
  /* púlpito com o logo do espaço na frente, na proporção certa (não estica) */
  let pulpitoOriginal = null;
  function montarPulpito(logo) {
    if (typeof IMG === "undefined" || !IMG.pulpito) return;
    if (!pulpitoOriginal) pulpitoOriginal = IMG.pulpito;
    const base = pulpitoOriginal; if (!base.width || !logo || !logo.width) return;
    const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0);
    // painel da frente (x 7..24, y 12..23): madeira escura e o logo encaixado
    g.fillStyle = "#5a3a22"; g.fillRect(7, 12, 18, 12); g.fillStyle = "#2a1a10"; g.fillRect(7, 12, 18, 1); g.fillRect(7, 23, 18, 1); g.fillRect(7, 12, 1, 12); g.fillRect(24, 12, 1, 12);
    const fonte = recorteDoLogo(logo), k = Math.min(16 / fonte.width, 10 / fonte.height), w = fonte.width * k, h = fonte.height * k;
    g.imageSmoothingEnabled = true; g.drawImage(fonte, 16 - w / 2, 18 - h / 2, w, h);
    // cópia 8x: a madeira continua em pixel art e o logo sai nítido, sem esticar
    const E = 8, n = document.createElement("canvas"); n.width = 32 * E; n.height = 32 * E; const q = n.getContext("2d");
    q.imageSmoothingEnabled = false; q.drawImage(c, 0, 0, n.width, n.height);
    q.fillStyle = "#5a3a22"; q.fillRect(8 * E, 13 * E, 16 * E, 10 * E);
    q.imageSmoothingEnabled = true; q.imageSmoothingQuality = "high";
    const kk = Math.min(15 * E / fonte.width, 9 * E / fonte.height), nw = fonte.width * kk, nh = fonte.height * kk;
    q.drawImage(fonte, 16 * E - nw / 2, 18 * E - nh / 2, nw, nh);
    c._nitido = n; IMG.pulpito = c;
  }
  // tira a parte transparente em volta do logo, para ele ocupar o painel
  function recorteDoLogo(img) {
    const src = img._hd || img, c = document.createElement("canvas"); c.width = src.width; c.height = src.height; const g = c.getContext("2d"); g.drawImage(src, 0, 0);
    let d; try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return src; }
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return src;
    const r = document.createElement("canvas"); r.width = x1 - x0 + 1; r.height = y1 - y0 + 1; r.getContext("2d").drawImage(c, x0, y0, r.width, r.height, 0, 0, r.width, r.height);
    return r;
  }
  // reduz a imagem enviada (máx. 384x256) para guardar no mapa
  function prepararLogo(arquivo) {
    return new Promise((ok, erro) => {
      if (!arquivo || !/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(arquivo.type)) return erro(new Error("Envie uma imagem PNG, JPG, WEBP ou SVG"));
      if (arquivo.size > 5e6) return erro(new Error("Imagem muito grande (máximo 5 MB)"));
      const fr = new FileReader(); fr.onerror = () => erro(new Error("Não consegui ler a imagem"));
      fr.onload = () => { const im = new Image(); im.onerror = () => erro(new Error("Imagem inválida")); im.onload = () => {
        const k = Math.min(1, 384 / im.width, 256 / im.height), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/png")); }; im.src = fr.result; };
      fr.readAsDataURL(arquivo);
    });
  }

  window.Decoracao = { TEMAS, ANUAIS, anuaisAtivos, periodoTexto, recorteDoLogo, previa, temaDe, pautaSemTema, comTema, iniciar, atualizar, aplicarLogo, prepararLogo, get itens() { return window.DECORACAO || []; } };
})();
