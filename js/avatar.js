/* Catálogo das camadas do personagem (planilha P01–P18) e montagem do spritesheet.
   Cada camada é uma folha de 192x336 (6 colunas x 7 linhas de 32x48):
   linha 0 baixo, 1 esquerda, 2 direita, 3 cima (coluna 0 parado, 1–4 andando),
   linha 4 sentar, 5 acenar, 6 dançar. */
(function () {
  const B = "assets/personagens/";
  const HAIR = { preto: "#2b2626", castanho_escuro: "#4a3022", castanho: "#7a4b2a", loiro: "#e0b860", ruivo: "#d9772e", grisalho: "#b4afab", acaju: "#8e2f2a", rosa: "#d96aa7" };
  const CLOTH = { branco: "#f2f0ea", preto: "#2f2b2e", cinza: "#8d8f99", marinho: "#2f4470", azul: "#3d6fd6", vermelho: "#d0463c", verde: "#4e9a5a", amarelo: "#e8b83a", roxo: "#7d5bc4", rosa: "#e07aa8" };
  const BOT = { jeans: "#3d5a8a", preto: "#2f2b2e", cinza: "#8d8f99", bege: "#c8b48a", verde_oliva: "#6b7a45", vinho: "#7a2f3a" };
  const SHOE = { branco: "#f2f0ea", preto: "#2f2b2e", vermelho: "#d0463c", azul: "#3d6fd6", marrom: "#6e4526", cinza: "#8d8f99" };
  const SKIN = ["#f6d3b3", "#eab88f", "#d09a6a", "#a8724a", "#7d5235", "#553522"];
  const pick = (obj, n) => Object.fromEntries(Object.entries(obj).slice(0, n));

  const CAT = {
    pele: { label: "Pele", cores: Object.fromEntries(SKIN.map((c, i) => [String(i + 1), c])) },
    olhos: { label: "Olhos", estilos: { "1": "Redondos", "2": "Pontinhos", "3": "Cílios", "4": "Sonolentos", "5": "Grandes", "6": "Sorrindo" } },
    sobrancelha: { label: "Sobrancelha", estilos: { "1": "Reta", "2": "Arqueada", "3": "Grossa" } },
    cabelo: { label: "Cabelo", estilos: {
      curto: { nome: "Curto", cores: HAIR, arq: c => `P03_cabelo_curto/P03_curto_${c}.png` },
      longo: { nome: "Longo", cores: HAIR, arq: c => `P04_cabelo_longo/P04_longo_${c}.png` },
      cacheado1: { nome: "Cacheado", cores: HAIR, arq: c => `P05_cabelo_cacheado/P05_cacheado_volume1_${c}.png` },
      cacheado2: { nome: "Black power", cores: HAIR, arq: c => `P05_cabelo_cacheado/P05_cacheado_volume2_${c}.png` },
      coque: { nome: "Coque", cores: HAIR, arq: c => `P07_coque_rabo_trancas/P07_coque_${c}.png` },
      rabo: { nome: "Rabo de cavalo", cores: HAIR, arq: c => `P07_coque_rabo_trancas/P07_rabo_de_cavalo_${c}.png` },
      trancas: { nome: "Tranças", cores: HAIR, arq: c => `P07_coque_rabo_trancas/P07_trancas_${c}.png` },
      raspado: { nome: "Raspado", cores: pick(HAIR, 4), arq: c => `P06_cabelo_raspado/P06_raspado_${c}.png` },
      careca: { nome: "Careca", cores: null, arq: null },
    } },
    barba: { label: "Barba", estilos: {
      nenhuma: { nome: "Sem barba", cores: null, arq: null },
      cheia: { nome: "Cheia", cores: HAIR, arq: c => `P08_barba_bigode/P08_cheia_${c}.png` },
      bigode: { nome: "Bigode", cores: HAIR, arq: c => `P08_barba_bigode/P08_bigode_${c}.png` },
      cavanhaque: { nome: "Cavanhaque", cores: HAIR, arq: c => `P08_barba_bigode/P08_cavanhaque_${c}.png` },
      rala: { nome: "Por fazer", cores: HAIR, arq: c => `P08_barba_bigode/P08_rala_${c}.png` },
    } },
    cima: { label: "Roupa", estilos: {
      camiseta: { nome: "Camiseta", cores: CLOTH, arq: c => `P09_camiseta/P09_camiseta_${c}.png` },
      social: { nome: "Camisa social", cores: pick(CLOTH, 6), arq: c => `P10_camisa_social/P10_social_${c}.png` },
      moletom: { nome: "Moletom", cores: pick(CLOTH, 8), arq: c => `P11_moletom/P11_moletom_${c}.png` },
      vestido: { nome: "Vestido", cores: pick(CLOTH, 6), arq: c => `P12_vestido/P12_vestido_${c}.png` },
      next: { nome: "Camiseta Next Co.", cores: { preta: "#1d1d1f", branca: "#f2f0ea" }, arq: c => `P13_camiseta_next/P13_next_${c}.png` },
    } },
    baixo: { label: "Calça / saia", estilos: {
      calca: { nome: "Calça", cores: BOT, arq: c => `P14_calca_short_saia/P14_calca_${c}.png` },
      short: { nome: "Short", cores: BOT, arq: c => `P14_calca_short_saia/P14_short_${c}.png` },
      saia: { nome: "Saia", cores: BOT, arq: c => `P14_calca_short_saia/P14_saia_${c}.png` },
      nenhuma: { nome: "Nenhuma", cores: null, arq: null },
    } },
    calcado: { label: "Calçado", estilos: {
      tenis: { nome: "Tênis", cores: SHOE, arq: c => `P15_tenis_sapato/P15_tenis_${c}.png` },
      sapato: { nome: "Sapato", cores: SHOE, arq: c => `P15_tenis_sapato/P15_sapato_${c}.png` },
    } },
    oculos: { label: "Óculos", estilos: {
      nenhum: { nome: "Sem óculos", cores: null, arq: null },
      redondo: { nome: "Redondo", cores: null, arq: () => "P16_oculos/P16_oculos_redondo.png" },
      quadrado: { nome: "Quadrado", cores: null, arq: () => "P16_oculos/P16_oculos_quadrado.png" },
      escuro: { nome: "Escuro", cores: null, arq: () => "P16_oculos/P16_oculos_escuro.png" },
    } },
    chapeu: { label: "Chapéu", estilos: {
      nenhum: { nome: "Nenhum", cores: null, arq: null },
      bone: { nome: "Boné", cores: pick(CLOTH, 6), arq: c => `P17_bone_chapeu/P17_bone_${c}.png` },
      chapeu: { nome: "Chapéu", cores: pick(CLOTH, 6), arq: c => `P17_bone_chapeu/P17_chapeu_${c}.png` },
      gorro: { nome: "Gorro", cores: pick(CLOTH, 6), arq: c => `P17_bone_chapeu/P17_gorro_${c}.png` },
    } },
    joia: { label: "Joias e bolsa", estilos: { nenhum: { nome: "Nenhum", cores: null, arq: null }, brincos: { nome: "Brincos", cores: null, arq: null }, colar: { nome: "Colar", cores: null, arq: null }, brincos_colar: { nome: "Brincos + colar", cores: null, arq: null }, bolsa: { nome: "Bolsa", cores: null, arq: null } } },
    fone: { label: "Fone de ouvido", estilos: { nao: { nome: "Sem fone", cores: null, arq: null }, sim: { nome: "Com fone", cores: null, arq: () => "P18_fone_de_ouvido/P18_fone.png" } } },
  };

  const PADRAO = {
    pele: "3", olhos: "1", sobrancelha: "1",
    cabelo: { estilo: "curto", cor: "castanho" }, barba: { estilo: "nenhuma", cor: "castanho" },
    cima: { estilo: "next", cor: "preta" }, baixo: { estilo: "calca", cor: "jeans" }, calcado: { estilo: "tenis", cor: "branco" },
    oculos: { estilo: "nenhum" }, chapeu: { estilo: "nenhum", cor: "preto" }, fone: { estilo: "nao" }, joia: { estilo: "nenhum" },
  };
  const ORDEM = ["pele", "olhos", "sobrancelha", "barba", "baixo", "calcado", "cima", "cabelo", "oculos", "chapeu", "fone"];

  function aleatorio() {
    const r = o => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
    const a = { pele: r(CAT.pele.cores), olhos: r(CAT.olhos.estilos), sobrancelha: r(CAT.sobrancelha.estilos) };
    for (const p of ["cabelo", "barba", "cima", "baixo", "calcado", "oculos", "chapeu", "fone", "joia"]) {
      let est = r(CAT[p].estilos);
      if (p === "barba" && Math.random() < 0.6) est = "nenhuma";
      if ((p === "oculos" || p === "chapeu") && Math.random() < 0.6) est = "nenhum";
      if (p === "fone") est = "nao";
      const e = CAT[p].estilos[est];
      a[p] = { estilo: est, cor: e.cores ? r(e.cores) : null };
    }
    if (a.cima.estilo === "vestido") a.baixo = { estilo: "nenhuma", cor: null };
    if (a.barba.estilo !== "nenhuma") a.barba.cor = a.cabelo.cor in HAIR ? a.cabelo.cor : "preto";
    return a;
  }

  function arquivos(av) {
    av = Object.assign({}, PADRAO, av || {});
    const out = [];
    for (const p of ORDEM) {
      if (p === "pele") { out.push(`P01_corpo_base/P01_corpo_tom${av.pele}.png`); continue; }
      if (p === "olhos") { out.push(`P02_rosto/P02_olhos_estilo${av.olhos}.png`); continue; }
      if (p === "sobrancelha") { out.push(`P02_rosto/P02_sobrancelha_estilo${av.sobrancelha}.png`); continue; }
      const sel = av[p]; if (!sel) continue;
      const e = CAT[p].estilos[sel.estilo]; if (!e || !e.arq) continue;
      const cor = e.cores ? (sel.cor in e.cores ? sel.cor : Object.keys(e.cores)[0]) : null;
      out.push(e.arq(cor));
    }
    return out.map(f => B + f);
  }

  const cache = {};
  function carregar(src) {
    if (!cache[src]) cache[src] = new Promise((ok, erro) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => erro(new Error("Falha ao carregar " + src)); im.src = src; });
    return cache[src];
  }
  /* Monta o spritesheet completo (canvas 192x336) a partir das camadas. */
  async function montar(av) {
    // estilo novo: personagem desenhado em pixel art pelo gerador (js/avatar-pixel.js), com contorno, volume e expressões
    if (window.AvatarPixel) return AvatarPixel.folha(av);
    const ims = await Promise.all(arquivos(av).map(carregar));
    const c = document.createElement("canvas"); c.width = 192; c.height = 336;
    const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
    for (const im of ims) x.drawImage(im, 0, 0);
    return c;
  }

  window.Avatar = { CAT, PADRAO, ORDEM, aleatorio, arquivos, montar, FW: 32, FH: 48 };
})();
