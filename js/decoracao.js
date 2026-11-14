/* Decoração temática automática dos eventos da agenda + logo próprio do espaço.
   – Na agenda, o admin/dono escolhe um tema para o evento (aniversário, Natal, Halloween, festa junina, comemoração).
     De 30 min antes até 15 min depois do evento, a sala do evento ganha os itens do tema sozinha (2D e 3D),
     sem mexer no mapa salvo e sem bloquear a passagem. Ao acabar, tudo some.
   – Logo: o dono sobe um PNG em Configurações → Sala e ele aparece em todos os itens "Logo" do espaço.
   Os desenhos são feitos aqui mesmo, em pixel art, no estilo dos outros itens. */
(function () {
  function tela(w, h, f) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); f((x, y, ww, hh, cor) => { g.fillStyle = cor; g.fillRect(x, y, ww, hh); }, g); return c; }
  const A = (k, w, h, f, label, extra) => { const c = tela(w, h, f); window.ASSETS[k] = { src: c.toDataURL(), w, h, label, cat: "Festa", ...(extra || {}) }; return c; };

  /* pisca-pisca: o desenho é refeito a cada meio segundo no mesmo canvas (o 2D e o 3D usam esse canvas direto) */
  const PISCA = {};
  const Pk = (k, w, h, f, label, extra) => { const c = tela(w, h, (R, g) => f(R, g, 0)); c._pisca = true; window.ASSETS[k] = { src: c.toDataURL(), w, h, label, cat: "Festa", ...(extra || {}) }; PISCA[k] = { c, f }; return c; };
  const escuro = cor => { const n = parseInt(cor.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255, m = v => Math.round(v * 0.35); return `rgb(${m(r)},${m(gg)},${m(b)})`; };
  // uma lâmpada: acesa (com brilho em volta) ou apagada; o padrão alterna metade/metade e às vezes "corre"
  const acesa = (i, fase) => (fase % 8 < 4) ? (i + fase) % 2 === 0 : (i + fase) % 3 !== 0;
  const lampada = (R, x, y, cor, ligada) => { if (ligada) { R(x - 1, y - 1, 5, 6, cor.length === 7 ? cor + "55" : cor); R(x, y, 3, 4, cor); R(x, y, 1, 1, "#ffffff"); } else R(x, y, 3, 4, escuro(cor)); };
  const PALETAS = { natal: ["#ff3b3b", "#3fdf6f", "#ffd23e", "#4d7bff"], ouro: ["#ffd23e", "#fff1b0", "#ffb020", "#ffe58a"], halloween: ["#ff8a1f", "#a259ff", "#7dff5a", "#ff8a1f"], festa: ["#ff4fa0", "#ffd23e", "#3fdf6f", "#4dc3ff"] };

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
  Pk("deco_arvore", 48, 72, (R, g, fase) => {
    R(20, 62, 8, 8, "#6b3f22"); R(14, 68, 20, 3, "#8a5a32");
    for (let i = 0; i < 4; i++) { const y = 10 + i * 13, w = 14 + i * 8; R(24 - w / 2, y, w, 15, i % 2 ? "#1f7a46" : "#25904f"); R(24 - w / 2 + 2, y + 12, w - 4, 3, "#17633a"); }
    R(21, 2, 6, 6, "#f2c14e"); R(23, 0, 2, 10, "#f2c14e"); R(19, 4, 10, 2, "#f2c14e");
    // bolas fixas + pisca-pisca em zigue-zague
    for (const [x, y, c] of [[16, 20, "#e5484d"], [30, 26, "#3d5afe"], [26, 36, "#e5484d"], [14, 50, "#3d5afe"]]) R(x, y, 3, 3, c);
    const pis = [[20, 16], [26, 18], [12, 28], [20, 30], [34, 32], [10, 42], [18, 44], [28, 42], [36, 44], [6, 56], [16, 58], [26, 56], [38, 58]];
    pis.forEach(([x, y], i) => lampada(R, x, y, PALETAS.natal[i % 4], acesa(i, fase)));
    if (fase % 2) R(23, 3, 2, 2, "#ffffff"); // estrela cintila
  }, "Árvore de Natal");
  const luzes = (W, cores) => (R, g, fase) => {
    g.strokeStyle = "#2b2f39"; g.lineWidth = 1; g.beginPath(); for (let x = 0; x < W; x += 24) { g.moveTo(x, 2); g.quadraticCurveTo(x + 12, 12, x + 24, 2); } g.stroke();
    for (let i = 0; i < W / 8; i++) { const x = 4 + i * 8, y = 4 + Math.round(4 * Math.sin((i % 3) * 1.4)); lampada(R, x, y, cores[i % cores.length], acesa(i, fase)); }
  };
  for (const [suf, pal, nome] of [["", "natal", "Pisca-pisca"], ["_ouro", "ouro", "Pisca-pisca dourado"], ["_hw", "halloween", "Pisca-pisca de Halloween"], ["_festa", "festa", "Pisca-pisca colorido"]]) {
    Pk("deco_luzes" + suf, 96, 16, luzes(96, PALETAS[pal]), nome, { z: "wall" }); Pk("deco_luzes" + suf + "_p", 64, 16, luzes(64, PALETAS[pal]), nome + " (curto)", { z: "wall" });
  }
  // cascata de luzes: fios caindo do alto, cada um piscando
  const cascata = cores => (R, g, fase) => {
    R(0, 0, 64, 2, "#2b2f39");
    for (let f = 0; f < 8; f++) { const x = 3 + f * 8, n = 3 + (f * 5) % 3; R(x + 1, 2, 1, n * 9, "#2b2f39"); for (let j = 0; j < n; j++) lampada(R, x, 6 + j * 9, cores[(f + j) % cores.length], acesa(f * 3 + j, fase)); }
  };
  Pk("deco_cascata", 64, 44, cascata(PALETAS.natal), "Cascata de luzes", { z: "wall" });
  Pk("deco_cascata_ouro", 64, 44, cascata(PALETAS.ouro), "Cascata dourada", { z: "wall" });
  // guirlanda com luzinhas
  Pk("deco_guirlanda", 32, 32, (R, g, fase) => {
    g.fillStyle = "#1f7a46"; g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.arc(16, 16, 7, 0, Math.PI * 2, true); g.fill();
    g.fillStyle = "#25904f"; for (let a = 0; a < 12; a++) { const ang = a * Math.PI / 6; g.fillRect(16 + Math.cos(ang) * 10 - 2, 16 + Math.sin(ang) * 10 - 2, 4, 4); }
    R(12, 25, 8, 4, "#e5484d"); R(10, 27, 3, 4, "#e5484d"); R(19, 27, 3, 4, "#e5484d"); R(15, 26, 2, 2, "#b02a2e");
    for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4 - Math.PI / 2; lampada(R, Math.round(16 + Math.cos(ang) * 10) - 1, Math.round(16 + Math.sin(ang) * 10) - 2, PALETAS.natal[a % 4], acesa(a, fase)); }
  }, "Guirlanda", { z: "wall" });
  // boneco de neve com cachecol e luzinha no chapéu
  Pk("deco_boneco_neve", 32, 44, (R, g, fase) => {
    g.fillStyle = "#f4f7fb"; g.beginPath(); g.arc(16, 33, 10, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(16, 17, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#d7dde8"; g.fillRect(8, 38, 16, 3);
    R(9, 6, 14, 3, "#1b1b1f"); R(11, 0, 10, 7, "#1b1b1f"); R(11, 4, 10, 1, "#e5484d");
    R(13, 15, 2, 2, "#1b1b1f"); R(18, 15, 2, 2, "#1b1b1f"); R(16, 18, 4, 1, "#ff8a1f");
    R(9, 22, 14, 3, "#e5484d"); R(18, 24, 3, 7, "#e5484d"); for (const y of [29, 34]) R(15, y, 2, 2, "#1b1b1f");
    lampada(R, 15, 0, fase % 2 ? "#ffd23e" : "#ff3b3b", true);
  }, "Boneco de neve");
  // poste de luz pisca (vela grande) para festas
  Pk("deco_estrela", 32, 32, (R, g, fase) => {
    const raio = fase % 2 ? 14 : 12; g.fillStyle = fase % 2 ? "#ffe58a" : "#ffd23e"; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? raio * 0.45 : raio, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); } g.closePath(); g.fill();
    R(15, 9, 2, 2, "#ffffff"); if (fase % 3 === 0) { R(2, 4, 1, 1, "#ffffff"); R(29, 26, 1, 1, "#ffffff"); }
  }, "Estrela brilhante", { z: "wall" });
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
  function faixa(texto, cor, largura) {
    const w = Math.max(64, Math.min(160, Math.floor(largura || 160))), h = 28;
    const k = "deco_faixa_" + (texto + cor).replace(/[^a-z0-9]/gi, "").slice(0, 40) + (w < 160 ? "_" + w : "");
    if (window.ASSETS[k]) return k;
    const c = A(k, w, h, (R, g) => {
      R(4, 5, w - 8, 18, cor); R(4, 5, w - 8, 2, "rgba(255,255,255,.3)"); R(0, 8, 6, 12, cor); R(w - 6, 8, 6, 12, cor); R(0, 0, 2, 8, "#6b6760"); R(w - 2, 0, 2, 8, "#6b6760");
      g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; let fs = 13; g.font = `bold ${fs}px system-ui, sans-serif`;
      while (g.measureText(texto).width > w - 14 && fs > 5) { fs--; g.font = `bold ${fs}px system-ui, sans-serif`; }
      g.fillText(texto, w / 2, 14.5);
    }, "Faixa", { z: "wall" });
    if (typeof IMG !== "undefined") IMG[k] = c; // o próprio desenho (já pronto para o 2D e o 3D)
    return k;
  }

  const TEMAS = {
    // parede: enfeites da parede de cima, na ordem, repetindo nos trechos livres (o 1º leva também a versão curta)
    aniversario: { nome: "🎂 Aniversário", beiral: "deco_luzes_festa", faixa: t => "FELIZ ANIVERSÁRIO!", cor: "#e5484d", cantos: ["deco_baloes", "deco_baloes", "deco_baloes", "deco_baloes"], centro: ["deco_bolo"], parede: ["deco_luzes_festa", "deco_bandeirinhas"], chao: "deco_confete" },
    natal: { nome: "🎄 Natal", beiral: "deco_luzes", faixa: t => "FELIZ NATAL!", cor: "#1f7a46", cantos: ["deco_arvore", "deco_boneco_neve", "deco_presentes", "deco_presentes"], centro: [], parede: ["deco_cascata", "deco_guirlanda", "deco_luzes", "deco_estrela", "deco_guirlanda"] },
    halloween: { nome: "🎃 Halloween", beiral: "deco_luzes_hw", faixa: t => "HALLOWEEN", cor: "#e07a1f", cantos: ["deco_abobora", "deco_abobora", "deco_abobora", "deco_abobora"], centro: [], parede: ["deco_luzes_hw", "deco_teia"] },
    junina: { nome: "🌽 Festa junina", beiral: "deco_luzes_festa", faixa: t => "ARRAIÁ!", cor: "#c4601a", cantos: ["deco_fogueira"], centro: [], parede: ["deco_bandeirinhas", "deco_luzes_festa"] },
    ano_novo: { nome: "🥂 Ano novo", beiral: "deco_luzes_ouro", faixa: t => "FELIZ ANO NOVO!", cor: "#1d2040", cantos: ["deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro"], centro: [], parede: ["deco_luzes_ouro", "deco_fogos", "deco_cascata_ouro", "deco_estrela"], chao: "deco_confete" },
    carnaval: { nome: "🎭 Carnaval", beiral: "deco_luzes_festa", faixa: t => "CARNAVAL!", cor: "#7b4fd8", cantos: ["deco_mascara", "deco_baloes", "deco_mascara", "deco_baloes"], centro: [], parede: ["deco_luzes_festa", "deco_bandeirinhas"], chao: "deco_confete" },
    pascoa: { nome: "🐣 Páscoa", faixa: t => "FELIZ PÁSCOA!", cor: "#e07aa8", cantos: ["deco_ovos", "deco_ovos", "deco_ovos"], centro: [], parede: ["deco_bandeirinhas"] },
    comemoracao: { nome: "🎊 Comemoração", beiral: "deco_luzes_ouro", faixa: t => (t || "PARABÉNS, EQUIPE!").toUpperCase().slice(0, 26), cor: "#3d5afe", cantos: ["deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro", "deco_baloes_ouro"], centro: [], parede: ["deco_luzes_ouro", "deco_bandeirinhas"], chao: "deco_confete" },
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
      const cfg = datas && datas[id]; if (!cfg || !(cfg.ativo || cfg.agora)) continue;
      if (cfg.agora) { out.push({ id, tema: d.tema, salas: cfg.salas || [] }); continue; } // o admin mandou mostrar já
      for (const ano of [agora.getFullYear() - 1, agora.getFullYear()]) { const [i, f] = d.periodo(ano); if (agora >= i && agora < somaDias(f, 1)) { out.push({ id, tema: d.tema, salas: cfg.salas || [] }); break; } }
    }
    return out;
  }
  const periodoTexto = (id, ano = new Date().getFullYear()) => { const [i, f] = ANUAIS[id].periodo(ano), fm = d => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); return `${fm(i)} a ${fm(f)}`; };

  /* tema guardado no fim da pauta: "⟦tema:natal⟧" (não precisa de coluna nova no banco) */
  const MARCA = /⟦tema:([a-z_]+)⟧/; // marcas na pauta: ⟦tema:natal⟧, ⟦pal:id de quem apresenta⟧ (não aparecem para ninguém)
  const temaDe = r => { const m = r && r.pauta && String(r.pauta).match(MARCA); return m && TEMAS[m[1]] ? m[1] : null; };
  const pautaSemTema = p => p ? String(p).replace(/\s*⟦[a-z_]+:[^⟧]*⟧/g, "").trim() : p; // texto da pauta, sem nenhuma marca
  const comTema = (pauta, tema) => { const p = String(pauta || "").replace(/\s*⟦tema:[a-z_]+⟧/g, "").trim(); return tema && TEMAS[tema] ? (p ? p + " " : "") + `⟦tema:${tema}⟧` : (p || null); };

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
    const naParede = allItemsBase().filter(o => ASSETS[o.k] && (o.room ? o.room === r.id : (o.x >= r.x - 0.5 && o.x <= r.x + r.w)) && o.y < r.y + 0.3 && o.y > r.y - 3.2
        && /^(telao|tv|projecao|quadro|logo|relogio|claquete|placa|estante|armario|rack|geladeira|bib_)/.test(o.k))
      .map(o => [o.x, o.x + ASSETS[o.k].w / T_]).sort((p, q) => p[0] - q[0]);
    let melhor = [r.x + 0.2, r.x + 0.2], ini = r.x + 0.2;
    for (const [a0, a1] of [...naParede, [r.x + r.w - 0.2, r.x + r.w]]) { if (a0 - ini > melhor[1] - melhor[0]) melhor = [ini, a0]; ini = Math.max(ini, a1); }
    // a faixa encolhe (até 3 blocos) para caber no maior trecho livre; se nem assim couber, fica pendurada à frente
    // a faixa encolhe até 2 blocos para caber na parede; se nem assim couber, a sala fica sem faixa (nunca no chão)
    const gap = melhor[1] - melhor[0], cabe = gap * T_ - 8 >= 64;
    const fk = cabe ? faixa(t.faixa(titulo), t.cor, gap * T_ - 8) : null, fw = fk ? ASSETS[fk].w / T_ : 0, fx = fk ? (melhor[0] + melhor[1]) / 2 - fw / 2 : 0;
    if (fk) add(fk, fx, r.y - 1.6, "wall");
    if (t.parede) { // enfeites de parede só onde não há telão, logo, quadro (nem a faixa)
      const cheio = [...naParede, ...(fk ? [[fx, fx + fw]] : [])], livreEm = (x, pw) => !cheio.some(([a0, a1]) => x < a1 && x + pw > a0);
      const lista = [].concat(t.parede), alturaDe = k => /cascata/.test(k) ? r.y - 1.45 : /guirlanda|estrela/.test(k) ? r.y - 1.4 : r.y - 1.2;
      let n = 0, i = 0;
      // varre a parede da esquerda para a direita, alternando os enfeites do tema; onde o longo não cabe, tenta os menores
      for (let x = r.x + 0.3; x < r.x + r.w - 0.3 && n < 10; x += 0.25) {
        // o que pisca (fios e cascatas) vem primeiro, do maior para o menor; o resto revezando nos espaços que sobram
        const fio = k => /^deco_(luzes|cascata)/.test(k), vez = lista.filter(k => !fio(k)), tam = k => ASSETS[k] ? ASSETS[k].w : 0;
        const ops = [...new Set([...[...lista, ...lista.map(k => k + "_p")].filter(fio).sort((a, b) => tam(b) - tam(a)), ...(vez.length ? [vez[i % vez.length]] : []), ...vez, ...lista.map(k => k + "_p")])].filter(k => ASSETS[k]);
        const k = ops.find(k => { const pw = ASSETS[k].w / T_; return x + pw <= r.x + r.w - 0.3 && livreEm(x, pw); });
        if (!k) continue;
        const pw = ASSETS[k].w / T_; add(k, x, alturaDe(k), "wall"); cheio.push([x, x + pw]); n++; i++; x += pw + 0.1 - 0.25;
      } }
    if (t.beiral) { // pisca-pisca correndo no alto de toda a parede, pulando o que é alto (telão, TV, quadro)
      const altos = naParede.filter(([a0]) => true), pw = ASSETS[t.beiral].w / T_, pp = ASSETS[t.beiral + "_p"].w / T_;
      for (let x = r.x + 0.05; x < r.x + r.w - 0.1;) {
        const k = [t.beiral, t.beiral + "_p"].find(k => { const w = ASSETS[k].w / T_; return x + w <= r.x + r.w - 0.05 && !altos.some(([a0, a1]) => x < a1 && x + w > a0); });
        if (k) { add(k, x, r.y - 1.88, "wall"); out[out.length - 1].beiral = true; x += ASSETS[k].w / T_; } else x += 0.25;
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
  let fase = 0;
  function piscar() {
    const d = window.DECORACAO; if (!d || !d.some(it => PISCA[it.k])) return; // nada piscando na tela: não gasta nada
    fase++;
    for (const k in PISCA) { const p = PISCA[k], g = p.c.getContext("2d"); g.clearRect(0, 0, p.c.width, p.c.height);
      p.f((x, y, w, h, cor) => { g.fillStyle = cor; g.fillRect(x, y, w, h); }, g, fase);
      if (p.c._tex3d) p.c._tex3d.needsUpdate = true; for (const t of p.c._texs || []) t.needsUpdate = true; }
  }
  function iniciar(o) {
    opt = o || {}; if (typeof IMG !== "undefined") for (const k in PISCA) IMG[k] = PISCA[k].c;
    atualizar(); setInterval(atualizar, 30000); setInterval(piscar, 450);
  }

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
