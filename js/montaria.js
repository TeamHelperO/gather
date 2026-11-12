/* Locomoção para andar mais rápido no corredor e na área externa.
   – Ao sair de uma sala para o corredor, a pessoa sobe na montaria escolhida; ao entrar numa sala, desce sozinha.
   – Escolha no botão da barra (🛴 patinete, 🛹 skate, ⛸️ patins ou 🚶 a pé). A escolha fica salva neste navegador.
   – Os outros veem a montaria de cada um (vai no estado de posição: "mont"). */
window.Montaria = (function () {
  const TIPOS = [
    { id: "patinete", icone: "🛴", nome: "Patinete" },
    { id: "skate", icone: "🛹", nome: "Skate" },
    { id: "patins", icone: "⛸️", nome: "Patins" },
    { id: "", icone: "🚶", nome: "A pé" },
  ];
  const VEL_BASE = 120, VEL_MONTADO = { patinete: 270, skate: 290, patins: 260 };
  let escolha = (() => { try { const v = localStorage.getItem("nextco_montaria"); return v === null || !TIPOS.some(t => t.id === v) ? "patinete" : v; } catch (e) { return "patinete"; } })();
  let ativa = null; // montaria em uso agora

  const noCorredor = a => { const r = roomAt(a.px, a.py - 4); return !r || r.type === "corredor"; };

  function atualizar(eu) {
    const quer = !eu.assento && noCorredor(eu) ? (escolha || null) : null;
    ativa = quer;
    eu.montaria = ativa;
    const b = document.getElementById("btnMont");
    if (b) { const t = TIPOS.find(t => t.id === escolha) || TIPOS[3]; const ic = { patinete: "wind", skate: "zap", patins: "sparkles" }[t.id] || "footprints"; if (window.ROTULO) ROTULO(b, ic, t.nome); else { const txt = `${t.icone} ${t.nome}`; if (b.textContent !== txt) b.textContent = txt; } b.title = "Montaria no corredor (clique para trocar)"; }
  }
  function velocidade() { return ativa ? VEL_MONTADO[ativa] || VEL_BASE : VEL_BASE; }
  function trocar() {
    const i = TIPOS.findIndex(t => t.id === escolha);
    escolha = TIPOS[(i + 1) % TIPOS.length].id;
    try { localStorage.setItem("nextco_montaria", escolha); } catch (e) {}
    const t = TIPOS.find(t => t.id === escolha);
    return escolha ? `${t.icone} ${t.nome}: aparece quando você estiver no corredor` : "🚶 Andando a pé";
  }

  /* ---------- desenho (pixel art, coordenadas do mundo; x,y = pés da pessoa) ---------- */
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
  /* devolve quanto a pessoa sobe (px) em cima da montaria */
  function altura(tipo) { return tipo === "patins" ? 3 : tipo ? 4 : 0; }
  function desenharAtras(g, tipo, x, y, dir, t, andando) {
    if (tipo === "patins") patins(g, x, y, dir, t, andando);
    else if (tipo === "skate") skate(g, x, y, dir, t, andando);
    else if (tipo === "patinete") patinete(g, x, y, dir, t, andando, true);
  }
  function desenharFrente(g, tipo, x, y, dir, t, andando) {
    if (tipo === "patinete") patinete(g, x, y, dir, t, andando, false);
  }
  function rodas(g, xs, y, t, andando) {
    for (const wx of xs) { R(g, wx - 1, y, 3, 3, "#1d1b24"); if (andando && Math.floor(t * 12) % 2) R(g, wx, y + 1, 1, 1, "#9a96a8"); }
  }
  function patinete(g, x, y, dir, t, andando, base) {
    const lado = dir === 1 || dir === 2, f = dir === 1 ? -1 : 1;
    if (lado) {
      if (base) { R(g, x - 9, y - 2, 18, 2, "#2e7de8"); R(g, x - 9, y - 1, 18, 1, "#1d4fa0"); rodas(g, [x - 8, x + 8], y, t, andando); return; }
      const px = x + 8 * f; R(g, px, y - 26, 1, 24, "#b9bccb"); R(g, px - 3, y - 27, 7, 2, "#2a2833");   // cano e guidão
    } else {
      if (base) { R(g, x - 2, y - 7, 5, 12, "#2e7de8"); rodas(g, [x], dir === 0 ? y + 4 : y - 9, t, andando); if (dir === 3) { R(g, x, y - 32, 1, 24, "#b9bccb"); R(g, x - 6, y - 33, 13, 2, "#2a2833"); } return; }
      if (dir === 0) { R(g, x, y - 22, 1, 24, "#b9bccb"); R(g, x - 6, y - 23, 13, 2, "#2a2833"); }
    }
  }
  function skate(g, x, y, dir, t, andando) {
    const lado = dir === 1 || dir === 2;
    if (lado) {
      R(g, x - 10, y - 3, 20, 2, "#e8682e"); R(g, x - 11, y - 4, 2, 2, "#e8682e"); R(g, x + 9, y - 4, 2, 2, "#e8682e");
      R(g, x - 10, y - 1, 20, 1, "#7a2e12"); rodas(g, [x - 7, x + 7], y, t, andando);
    } else {
      R(g, x - 3, y - 9, 6, 15, "#e8682e"); R(g, x - 3, y - 9, 6, 1, "#ffb08a");
      rodas(g, [x - 3, x + 3], y + 4, t, andando);
    }
  }
  function patins(g, x, y, dir, t, andando) { // um patim em cada pé
    const passo = andando ? Math.floor(t * 8) % 2 : 0, lado = dir === 1 || dir === 2;
    const pes = lado ? [x - 3 + (passo ? 2 : -2), x + 2 + (passo ? -2 : 2)] : [x - 5, x + 5];
    for (const [i, px] of pes.entries()) {
      const py = y - 3 - (!lado && andando && (i + passo) % 2 ? 2 : 0);
      R(g, px - 4, py, 9, 2, "#e84fa0"); R(g, px - 4, py, 9, 1, "#ff9fd0");                 // bota do patim
      R(g, px - 4, py + 2, 2, 2, "#1d1b24"); R(g, px + 3, py + 2, 2, 2, "#1d1b24");           // rodinhas
      if (andando && Math.floor(t * 12) % 2) R(g, px - 1, py + 2, 2, 1, "#fff");
    }
  }

  return { atualizar, velocidade, trocar, altura, desenharAtras, desenharFrente, get ativa() { return ativa; }, get escolha() { return escolha; } };
})();
