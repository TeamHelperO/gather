/* Montaria para andar mais rápido no corredor e na área externa.
   – Ao sair de uma sala para o corredor, a pessoa sobe na montaria escolhida; ao entrar numa sala, desce sozinha.
   – Escolha no botão da barra (🛴 patinete, 🛹 skate, 🐴 cavalo ou 🚶 a pé). A escolha fica salva neste navegador.
   – Os outros veem a montaria de cada um (vai no estado de posição: "mont"). */
window.Montaria = (function () {
  const TIPOS = [
    { id: "patinete", icone: "🛴", nome: "Patinete" },
    { id: "skate", icone: "🛹", nome: "Skate" },
    { id: "cavalo", icone: "🐴", nome: "Cavalo" },
    { id: "", icone: "🚶", nome: "A pé" },
  ];
  const VEL_BASE = 120, VEL_MONTADO = { patinete: 270, skate: 290, cavalo: 320 };
  let escolha = (() => { try { const v = localStorage.getItem("nextco_montaria"); return v === null ? "patinete" : v; } catch (e) { return "patinete"; } })();
  let ativa = null; // montaria em uso agora

  const noCorredor = a => { const r = roomAt(a.px, a.py - 4); return !r || r.type === "corredor"; };

  function atualizar(eu) {
    const quer = !eu.assento && noCorredor(eu) ? (escolha || null) : null;
    ativa = quer;
    eu.montaria = ativa;
    const b = document.getElementById("btnMont");
    if (b) { const t = TIPOS.find(t => t.id === escolha) || TIPOS[3]; const txt = `${t.icone} ${t.nome}`; if (b.textContent !== txt) b.textContent = txt; b.title = "Montaria no corredor (clique para trocar)"; }
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
  function altura(tipo) { return tipo === "cavalo" ? 13 : tipo ? 4 : 0; }
  function desenharAtras(g, tipo, x, y, dir, t, andando) {
    if (tipo === "cavalo") cavalo(g, x, y, dir, t, andando, true);
    else if (tipo === "skate") skate(g, x, y, dir, t, andando);
    else if (tipo === "patinete") patinete(g, x, y, dir, t, andando, true);
  }
  function desenharFrente(g, tipo, x, y, dir, t, andando) {
    if (tipo === "patinete") patinete(g, x, y, dir, t, andando, false);
    else if (tipo === "cavalo") cavalo(g, x, y, dir, t, andando, false);
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
  function cavalo(g, x, y, dir, t, andando, atras) {
    const passo = andando ? Math.floor(t * 10) % 2 : 0, f = dir === 1 ? -1 : 1, c = "#9a6236", e = "#6b3f1f", cr = "#3a2414";
    if (dir === 1 || dir === 2) {
      if (atras) {
        R(g, x - 13, y - 17, 26, 10, c); R(g, x - 13, y - 17, 26, 2, "#b47a4a");               // corpo
        // pernas
        R(g, x - 11, y - 8, 3, 8 - passo * 2, e); R(g, x - 6, y - 8, 3, 6 + passo * 2, e);
        R(g, x + 4, y - 8, 3, 8 - passo * 2, e); R(g, x + 9, y - 8, 3, 6 + passo * 2, e);
        // cauda
        const cx = x - 14 * f; R(g, cx - (f > 0 ? 2 : 0), y - 17, 3, 9 + passo, cr);
        R(g, x - 4, y - 19, 9, 3, "#c23a3a");                                                    // sela
      } else {
        // pescoço e cabeça na frente
        const hx = x + 12 * f;
        R(g, hx - (f > 0 ? 0 : 4), y - 26, 5, 12, c); R(g, hx + (f > 0 ? 2 : -9), y - 28, 8, 6, c);
        R(g, hx + (f > 0 ? 7 : -9), y - 26, 2, 2, cr);                                         // focinho
        R(g, hx + (f > 0 ? 4 : -5), y - 27, 1, 1, "#000");                                      // olho
        R(g, hx - (f > 0 ? 1 : -2), y - 28, 4, 10, cr);                                         // crina
      }
    } else {
      if (atras) {
        R(g, x - 11, y - 21, 22, 15, c); R(g, x - 11, y - 21, 22, 2, "#b47a4a");               // corpo visto de frente/costas
        R(g, x - 10, y - 7, 4, 7 - passo, e); R(g, x - 4, y - 7, 3, 7 - (1 - passo), e);
        R(g, x + 1, y - 7, 3, 7 - passo, e); R(g, x + 6, y - 7, 4, 7 - (1 - passo), e);
        R(g, x - 8, y - 23, 16, 3, "#c23a3a");                                                    // sela
        if (dir === 3) { R(g, x - 3, y - 36, 6, 13, c); R(g, x - 1, y - 38, 2, 12, cr); R(g, x - 4, y - 38, 2, 3, c); R(g, x + 2, y - 38, 2, 3, c); }
      } else if (dir === 0) {                                                                     // cabeça na frente
        R(g, x - 4, y - 16, 8, 13, c); R(g, x - 4, y - 16, 8, 2, "#b47a4a"); R(g, x - 3, y - 5, 6, 3, cr);
        R(g, x - 3, y - 12, 1, 1, "#000"); R(g, x + 2, y - 12, 1, 1, "#000");
        R(g, x - 5, y - 18, 2, 3, c); R(g, x + 3, y - 18, 2, 3, c); R(g, x - 1, y - 17, 2, 5, cr);
      } else if (dir === 3) R(g, x - 1, y - 8, 2, 8, cr);                                        // cauda
    }
  }

  return { atualizar, velocidade, trocar, altura, desenharAtras, desenharFrente, get ativa() { return ativa; }, get escolha() { return escolha; } };
})();
