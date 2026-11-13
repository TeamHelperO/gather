/* Sala de Edição: Pena (roteirista), Claquete (diretor de cenas) e Corte (editor de vídeo).
   – Pega as tendências marcadas como "pega" na sala de Pesquisa e pede à IA um roteiro com cenas detalhadas (api/agentes.js).
   – O telão de roteiros mostra os últimos; clicar abre o painel (só para quem está na sala).
   – "Gerar vídeo animado": monta no navegador um vídeo animado (js/video.js), para baixar.
   Registra as artes: precisa ser carregado ANTES de js/mapa-core.js (e depois de js/ti.js). */
(function registrarArtes() {
  if (!window.ASSETS) return;
  const nova = (w, h, desenha) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); desenha((x, y, ww, hh, cor) => { g.fillStyle = cor; g.fillRect(x, y, ww, hh); }, g); return c.toDataURL(); };
  if (ASSETS.telao) ASSETS.telao_rot = { ...ASSETS.telao, label: "Telão de roteiros", cat: "Edição", pal: true };
  // ring light (32x64)
  ASSETS.ring_light = { src: nova(32, 64, (R, g) => {
    g.strokeStyle = "#fff6d8"; g.lineWidth = 4; g.beginPath(); g.arc(16, 14, 10, 0, 7); g.stroke();
    g.strokeStyle = "#c9c2a8"; g.lineWidth = 1; g.beginPath(); g.arc(16, 14, 12.5, 0, 7); g.stroke();
    R(15, 24, 2, 34, "#2b2f39"); R(8, 58, 16, 2, "#2b2f39"); R(6, 60, 4, 3, "#1d2028"); R(22, 60, 4, 3, "#1d2028"); R(14, 12, 4, 4, "#1d2028");
  }), w: 32, h: 64, label: "Ring light", cat: "Edição", pal: true };
  // câmera no tripé (32x64)
  ASSETS.camera_tripe = { src: nova(32, 64, R => {
    R(7, 8, 18, 12, "#1d2028"); R(8, 9, 16, 10, "#2b2f39"); R(24, 11, 6, 6, "#15181f"); R(26, 12, 3, 4, "#3a6fd8"); R(10, 6, 6, 3, "#1d2028"); R(9, 11, 2, 2, "#e5484d");
    R(15, 20, 2, 10, "#3b414e"); R(14, 30, 4, 3, "#2b2f39");
    for (let i = 0; i < 28; i++) { R(15 - Math.round(i * 0.4), 33 + i, 2, 1, "#3b414e"); R(15, 33 + i, 2, 1, "#3b414e"); R(15 + Math.round(i * 0.4), 33 + i, 2, 1, "#3b414e"); }
  }), w: 32, h: 64, label: "Câmera no tripé", cat: "Edição", pal: true };
  // claquete na parede (32x32)
  ASSETS.claquete = { src: nova(32, 32, R => {
    R(4, 12, 24, 16, "#1d2028"); R(5, 13, 22, 14, "#2b2f39"); R(7, 16, 18, 1, "#8a8578"); R(7, 20, 18, 1, "#8a8578"); R(7, 24, 12, 1, "#8a8578");
    for (let i = 0; i < 6; i++) { R(4 + i * 4, 6 - (i % 2), 4, 6, i % 2 ? "#f2f2f2" : "#1d2028"); }
  }), w: 32, h: 32, label: "Claquete", cat: "Edição", pal: true };
})();

window.Edicao = (function () {
  let opt = null, roteiros = [], tend = [], painel = null, aba = "roteiros", aberto = null, pedindo = null, formato = "Reels/TikTok de 30 a 60 segundos";
  let verDescartados = false, renderPendente = false;
  const urls = new Map(); // caminho do vídeo → { url, ate }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STATUS = { rascunho: "📝 Rascunho", aguardando: "⏳ Aguardando aprovação", aprovado: "✅ Aprovado", gravando: "🎥 Gravando", publicado: "🚀 Publicado", descartado: "🗑️ Descartado" };
  const fmtQuando = d => { const dt = new Date(d), min = Math.round((Date.now() - dt) / 60000); return min < 1 ? "agora" : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : dt.toLocaleDateString("pt-BR"); };

  async function iniciar(o) {
    opt = o; await recarregar();
    if (Dados.ouvirRoteiros) Dados.ouvirRoteiros(recarregar);
    if (Dados.ouvirTendencias) Dados.ouvirTendencias(recarregar);
  }
  async function recarregar() {
    const [r, t] = await Promise.all([Dados.listarRoteiros ? Dados.listarRoteiros(100) : [], Dados.listarTendencias(150)]);
    roteiros = r || []; tend = t || [];
    if (painel) render(false);
  }

  /* ---------------- sala ---------------- */
  const salaDoIt = it => (it.room && roomById(it.room)) || roomAt(it.x * T + 96, it.y * T + 110);
  const minhaSala = () => { const e = opt && opt.eu && opt.eu(); const r = e && roomAt(e.px, e.py - 4); return r || null; };
  const dentroDaEdicao = () => { const r = minhaSala(); return !!(r && r.type === "edicao"); };
  const dentro = it => { const r = salaDoIt(it), m = minhaSala(); return !r || (m && r.id === m.id); };

  /* ---------------- telão no mapa ---------------- */
  function desenhaveis() {
    const out = [];
    for (const it of allItems()) if (it.k === "telao_rot") out.push({ sort: sortKey(it) + 0.01, draw: g => tela(g, Math.round(it.x * T), Math.round(it.y * T), it) });
    return out;
  }
  function tela(g, x, y, it) {
    g.save();
    g.fillStyle = "#1a1220"; g.fillRect(x + 6, y + 6, 180, 77);
    g.fillStyle = "#e04fa0"; g.fillRect(x + 6, y + 6, 180, 9);
    g.fillStyle = "#fff"; g.font = "bold 7px system-ui,sans-serif"; g.textBaseline = "middle";
    g.fillText("🎬 ROTEIROS", x + 10, y + 10.5);
    if (!dentro(it)) {
      g.textAlign = "center"; g.fillStyle = "#c9b4c8"; g.font = "bold 8px system-ui,sans-serif"; g.fillText("🔒 Só para quem está na sala", x + 96, y + 46);
      g.restore(); return;
    }
    const pega = tend.filter(t => t.decisao === "pega").length;
    g.textAlign = "right"; g.fillText(pega ? `${pega} p/ roteirizar` : "", x + 182, y + 10.5); g.textAlign = "left";
    const lista = roteiros.filter(r => r.status !== "descartado").slice(0, 5);
    if (!lista.length) {
      g.fillStyle = "#c9b4c8"; g.font = "6px system-ui,sans-serif"; g.textAlign = "center";
      g.fillText("Nenhum roteiro ainda", x + 96, y + 42); g.fillText("Toque para pedir um ao Pena ✍️", x + 96, y + 52);
    } else lista.forEach((r, i) => {
      const yy = y + 22 + i * 12;
      g.fillStyle = { aguardando: "#f2a33a", aprovado: "#3fbf5f", gravando: "#8b6cff", publicado: "#2fd4e8", descartado: "#6b6577" }[r.status] || "#e04fa0"; g.fillRect(x + 10, yy - 3, 3, 7);
      g.fillStyle = "#fff"; g.font = "6px system-ui,sans-serif";
      let t = r.titulo || ""; while (t && g.measureText(t).width > 140) t = t.slice(0, -2);
      g.fillText(t + (t !== r.titulo ? "…" : ""), x + 17, yy);
      g.fillStyle = "#c9b4c8"; g.textAlign = "right"; g.fillText(`${(r.cenas || []).length} cenas`, x + 182, yy); g.textAlign = "left";
    });
    g.restore();
  }
  function clicou(wx, wy) {
    for (const it of allItems()) {
      if (it.k === "telao_rot" && wx >= it.x * T && wx <= it.x * T + 192 && wy >= it.y * T && wy <= it.y * T + 90) {
        if (!dentro(it)) { const r = salaDoIt(it); opt.toast(`🔒 Entre em ${r ? r.name : "Edição"} para ver os roteiros`); return true; }
        abrirPainel(); return true;
      }
    }
    return false;
  }

  /* ---------------- painel ---------------- */
  function abrirPainel() {
    if (painel) return;
    if (opt && opt.eu && !dentroDaEdicao()) { opt.toast("🔒 Os roteiros só abrem dentro da sala de Edição"); return; }
    painel = document.createElement("div");
    painel.className = "tend-bg";
    painel.innerHTML = `<div class="tend-win ed-win" role="dialog" aria-label="Sala de Edição"></div>`;
    document.body.appendChild(painel);
    painel.addEventListener("click", aoClicar);
    painel.addEventListener("change", aoMudar);
    addEventListener("keydown", escFechar);
    opt.aoAbrir && opt.aoAbrir();
    render();
  }
  function fecharPainel() { if (!painel) return; pararVideo(); painel.remove(); painel = null; removeEventListener("keydown", escFechar); }
  function escFechar(e) { if (e.key === "Escape") fecharPainel(); }
  function atualizar() { if (painel && opt && opt.eu && !dentroDaEdicao()) { fecharPainel(); opt.toast("Você saiu da Edição: os roteiros foram fechados"); } }

  const tocando = () => painel && [...painel.querySelectorAll("video")].some(v => !v.paused && !v.ended);
  /* roteiro aprovado → tarefa "Publicar" no telão da sala de Edição (com o vídeo e as etapas) */
  const marca = id => `[roteiro:${id}]`;
  async function tarefaDoRoteiro(r) {
    if (!r) return;
    try {
      const todas = await Dados.listarTarefas();
      if (todas.some(t => (t.descricao || "").includes(marca(r.id)))) return; // já existe
      const sala = (typeof S !== "undefined" && S ? S.rooms : []).find(x => x.type === "edicao");
      const prazo = new Date(Date.now() + 2 * 864e5); prazo.setMinutes(prazo.getMinutes() - prazo.getTimezoneOffset());
      await Dados.salvarTarefa({ titulo: ("🎬 Publicar: " + (r.titulo || "vídeo")).slice(0, 120), status: "a_fazer", responsavel: Dados.sessao ? Dados.sessao() : "",
        prazo: prazo.toISOString().slice(0, 10), progressoManual: 0, ordem: 0, sala: sala ? sala.id : null,
        descricao: `Vídeo aprovado na sala de Edição${r.formato ? " (" + r.formato + ")" : ""}. Abra em Menu → Roteiros para baixar o vídeo.\n${marca(r.id)}`,
        etapas: ["Baixar e revisar o vídeo final", "Escrever legenda e hashtags", "Agendar ou publicar", "Marcar como Publicado na Edição"].map((texto, k) => ({ id: "e" + k, texto, feito: false })) },
        null, "Criada ao aprovar o vídeo");
    } catch (e) { console.warn("tarefa do roteiro:", e); }
  }
  // status do roteiro acompanha a tarefa: gravando → em andamento; publicado → feito
  async function acompanharTarefa(id, status) {
    if (!/^(gravando|publicado)$/.test(status)) return;
    try {
      const t = (await Dados.listarTarefas()).find(t => (t.descricao || "").includes(marca(id))); if (!t) return;
      const novo = status === "publicado" ? "feito" : "andamento"; if (t.status === novo) return;
      if (novo === "feito") t.etapas = (t.etapas || []).map(e => ({ ...e, feito: true }));
      t.status = novo; await Dados.salvarTarefa(t, null, novo === "feito" ? "Concluiu a tarefa (vídeo publicado)" : "Moveu para Em andamento (gravando)");
    } catch (e) {}
  }
  function render(forcar) {
    if (!painel) return;
    if (!forcar && (gravacao || tocando())) { renderPendente = true; return; }
    renderPendente = false;
    const win = painel.querySelector(".ed-win"), rol = (win.querySelector(".tend-lista") || {}).scrollTop || 0;
    const pegas = tend.filter(t => t.decisao === "pega"), feitas = new Set(roteiros.map(r => r.tendencia_id));
    win.innerHTML = `
      <div class="tend-top"><b>🎬 Sala de Edição</b>
        <div class="tend-agentes"><span class="ag on">✍️ Pena <small>roteiros</small></span><span class="ag on">🎥 Claquete <small>cenas</small></span><span class="ag on">✂️ Corte <small>vídeo</small></span></div>
        <button class="tend-x" data-fechar aria-label="Fechar">✕</button></div>
      <div class="tend-barra">
        <button class="tab ${aba === "roteiros" ? "on" : ""}" data-aba="roteiros">🎬 Roteiros <i>${roteiros.filter(r => r.status !== "descartado").length}</i></button>
        ${roteiros.some(r => r.status === "aguardando") ? `<span class="chip ed-aguarda">⏳ ${roteiros.filter(r => r.status === "aguardando").length} vídeo(s) para aprovar</span>` : ""}
        <button class="tab ${aba === "pedir" ? "on" : ""}" data-aba="pedir">✍️ Pedir roteiro <i>${pegas.filter(t => !feitas.has(t.id)).length}</i></button>
        <select data-formato title="Formato do vídeo">${["Reels/TikTok de 30 a 60 segundos", "Shorts de até 30 segundos", "Carrossel narrado de 60 a 90 segundos", "Vídeo para YouTube de 3 a 5 minutos", "Anúncio (Meta Ads) de 15 a 30 segundos"].map(f => `<option ${f === formato ? "selected" : ""}>${f}</option>`).join("")}</select>
      </div>
      <div class="tend-lista">${aba === "pedir" ? listaPedir(pegas, feitas) : listaRoteiros()}</div>`;
    const l = win.querySelector(".tend-lista"); if (l) l.scrollTop = rol;
    carregarPlayers();
  }
  function listaPedir(pegas, feitas) {
    const item = (t, marcada) => `<article class="tc ${t.decisao}">
        <div class="tc-top"><b>${esc(t.titulo)}</b>${t.relevancia ? `<span class="estrelas">${"★".repeat(t.relevancia)}</span>` : ""}</div>
        ${t.resumo ? `<p>${esc(t.resumo)}</p>` : ""}
        <div class="tc-acoes">${feitas.has(t.id) ? `<span class="chip">já tem roteiro</span>` : ""}
          <button class="btn ${marcada ? "pri" : ""}" data-pedir="${t.id}" ${pedindo ? "disabled" : ""}>${pedindo === t.id ? "⏳ Pena está escrevendo…" : "✍️ Gerar roteiro"}</button></div></article>`;
    return (pegas.length ? `<p class="ed-dica">Tendências marcadas como <b>✅ Pega</b> na Pesquisa:</p>` + pegas.map(t => item(t, true)).join("")
      : `<p class="tend-vazio">Nenhuma tendência aprovada ainda. Só entra na Edição o que for marcado como <b>✅ Pega</b> no painel da sala de Pesquisa.</p>`);
  }
  function listaRoteiros() {
    const visiveis = roteiros.filter(r => verDescartados || r.status !== "descartado");
    const ndesc = roteiros.length - roteiros.filter(r => r.status !== "descartado").length;
    const extra = ndesc ? `<p class="ed-dica"><label class="ed-voz"><input type="checkbox" data-ver-desc ${verDescartados ? "checked" : ""}> mostrar ${ndesc} versão(ões) descartada(s)</label></p>` : "";
    if (!visiveis.length) return extra + `<p class="tend-vazio">Ainda não há roteiros. Vá em <b>✍️ Pedir roteiro</b> e escolha uma tendência.</p>`;
    const adm = Dados.ehAdmin(), ocupado = !!(gravacao || pedindo);
    // os que esperam aprovação primeiro
    const ordem = { aguardando: 0, rascunho: 1, aprovado: 2, gravando: 3, publicado: 4, descartado: 5 };
    return extra + visiveis.slice().sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) || new Date(b.criado_em) - new Date(a.criado_em)).map(r => {
      const exp = aberto === r.id, cenas = r.cenas || [], temVideo = !!r.video_path;
      const versao = r.substitui ? `<span class="chip">🔁 nova versão</span>` : "";
      return `<article class="tc ed-rot ${r.status}" data-id="${r.id}">
        <div class="tc-top"><b>${esc(r.titulo)}</b></div>
        <div class="tc-meta"><span class="ed-st ${r.status}">${STATUS[r.status] || r.status}</span>${versao}<span class="chip">${esc((r.formato || "").split(" de ")[0])}</span><span>${cenas.length} cenas</span><span>${fmtQuando(r.criado_em)}</span>
          <select data-status="${r.id}" title="Mudar status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        ${r.gancho ? `<p class="ed-gancho">🪝 ${esc(r.gancho)}</p>` : ""}
        ${temVideo ? `<div class="ed-salvo"><video class="ed-canvas" data-player="${esc(r.video_path)}" controls playsinline preload="metadata"></video>
          <div class="ed-salvo-acoes"><small>💾 Vídeo salvo ${r.video_em ? fmtQuando(r.video_em) : ""}</small>
            ${r.status === "aguardando" ? `<button class="btn ok" data-aprovar="${r.id}">✅ Aprovar vídeo</button>` : ""}
            ${r.status !== "descartado" ? `<button class="btn" data-recriar="${r.id}" ${ocupado ? "disabled" : ""} title="O Pena escreve um roteiro novo, o Claquete refaz as cenas e o Corte gera outro vídeo">🔁 Recriar (novo roteiro e cenas)</button>` : ""}
            <a class="btn" data-baixar="${esc(r.video_path)}" href="#" download>⬇️ Baixar</a></div></div>` : ""}
        <div class="tc-acoes"><button class="btn" data-abrir="${r.id}">${exp ? "▲ Fechar" : "▼ Roteiro e cenas"}</button>
          ${!temVideo && r.status !== "descartado" ? `<button class="btn pri" data-video="${r.id}" ${ocupado ? "disabled" : ""}>🎞️ Gerar vídeo</button>
          <button class="btn" data-recriar="${r.id}" ${ocupado ? "disabled" : ""}>🔁 Recriar</button>` : ""}
          ${temVideo && r.status !== "descartado" ? `<button class="btn" data-video="${r.id}" ${ocupado ? "disabled" : ""} title="Gera de novo o vídeo deste mesmo roteiro">🎞️ Refazer só o vídeo</button>` : ""}
          <label class="ed-voz" title="Narração em português gerada no seu navegador"><input type="checkbox" data-voz ${comVoz ? "checked" : ""}> 🎙️ com voz</label>
          <button class="btn" data-copiar="${r.id}">📋 Copiar</button>
          ${adm ? `<button class="btn" data-excluir="${r.id}" title="Excluir">🗑️</button>` : ""}</div>
        <div class="ed-video" data-video-area="${r.id}"></div>
        ${exp ? `<div class="ed-detalhe">
          ${r.roteiro ? `<h4>Narração</h4><p class="ed-texto">${esc(r.roteiro)}</p>` : ""}
          <h4>Cenas</h4>
          <div class="ed-cenas">${cenas.map(c => `<div class="ed-cena"><b>Cena ${c.n} <small>${esc(c.duracao)}</small></b>
            <div><span>🎥 Como gravar</span>${esc(c.visual)}</div>
            ${c.fala ? `<div><span>🗣️ Fala</span>${esc(c.fala)}</div>` : ""}
            ${c.texto_tela ? `<div><span>🔤 Na tela</span>${esc(c.texto_tela)}</div>` : ""}
            ${c.audio ? `<div><span>🎵 Áudio</span>${esc(c.audio)}</div>` : ""}
            <div><span>✨ Animação</span>${esc(window.Video ? Video.escolherTipo(c, c.n - 1) : c.animacao || "")}</div></div>`).join("")}</div></div>` : ""}
      </article>`;
    }).join("");
  }
  // links temporários (1 h) dos vídeos salvos
  async function urlDe(caminho) {
    const c = urls.get(caminho); if (c && c.ate > Date.now()) return c.url;
    const url = await Dados.urlVideo(caminho); urls.set(caminho, { url, ate: Date.now() + 50 * 60000 }); return url;
  }
  async function carregarPlayers() {
    if (!painel) return;
    for (const v of painel.querySelectorAll("video[data-player]")) if (!v.src) urlDe(v.dataset.player).then(u => { v.src = u; }).catch(() => {});
    for (const a of painel.querySelectorAll("a[data-baixar]")) urlDe(a.dataset.baixar).then(u => { a.href = u; }).catch(() => {});
  }
  const textoRoteiro = r => `${r.titulo}\n${r.formato || ""}\n\nGANCHO: ${r.gancho || ""}\n\nNARRAÇÃO:\n${r.roteiro || ""}\n\nCENAS:\n` +
    (r.cenas || []).map(c => `Cena ${c.n} (${c.duracao})\n  Como gravar: ${c.visual}\n  Fala: ${c.fala || "-"}\n  Na tela: ${c.texto_tela || "-"}\n  Áudio: ${c.audio || "-"}`).join("\n\n");

  async function aoClicar(e) {
    const b = e.target;
    if (b === painel || b.closest("[data-fechar]")) return fecharPainel();
    const q = sel => b.closest(sel);
    if (q("[data-aba]")) { aba = q("[data-aba]").dataset.aba; return render(true); }
    if (q("[data-abrir]")) { const id = q("[data-abrir]").dataset.abrir; aberto = aberto === id ? null : id; return render(true); }
    if (q("[data-pedir]")) { const t = tend.find(x => x.id === q("[data-pedir]").dataset.pedir); return t && t.decisao === "pega" && produzir(t, null); }
    if (q("[data-aprovar]")) { const id = q("[data-aprovar]").dataset.aprovar; try { await Dados.mexerRoteiro(id, "aprovado"); opt.toast("✅ Vídeo aprovado · virou tarefa no telão da Edição"); tarefaDoRoteiro(roteiros.find(x => x.id === id)); Dados.registrarAtividade(null, "acao", "Aprovou vídeo: " + (roteiros.find(x => x.id === id) || {}).titulo, { sala: "Edição" }); } catch (er) { opt.toast("Não consegui aprovar"); } await recarregar(); return render(true); }
    if (q("[data-recriar]")) return recriar(roteiros.find(x => x.id === q("[data-recriar]").dataset.recriar));
    if (q("[data-copiar]")) { const r = roteiros.find(x => x.id === q("[data-copiar]").dataset.copiar); try { await navigator.clipboard.writeText(textoRoteiro(r)); opt.toast("📋 Roteiro copiado"); } catch (er) { opt.toast("Não consegui copiar"); } return; }
    if (q("[data-excluir]")) { const id = q("[data-excluir]").dataset.excluir; try { await Dados.excluirRoteiro(id); opt.toast("Roteiro excluído"); await recarregar(); } catch (er) { opt.toast("Não consegui excluir"); } return; }
    if (q("[data-video]")) { const id = q("[data-video]").dataset.video; if (aberto !== id) { aberto = id; render(); } return gerarVideo(roteiros.find(x => x.id === id)); }
  }
  async function aoMudar(e) {
    if (e.target.matches("[data-formato]")) { formato = e.target.value; return; }
    if (e.target.matches("[data-voz]")) { comVoz = e.target.checked; return; }
    if (e.target.matches("[data-ver-desc]")) { verDescartados = e.target.checked; return render(true); }
    if (e.target.matches("[data-status]")) {
      try { await Dados.mexerRoteiro(e.target.dataset.status, e.target.value); opt.toast("Status: " + STATUS[e.target.value]); acompanharTarefa(e.target.dataset.status, e.target.value); }
      catch (er) { opt.toast("Não consegui mudar o status"); }
      recarregar();
    }
  }
  // Pena (roteiro) → Claquete (cenas) → Corte (vídeo salvo para aprovação)
  async function produzir(t, anterior) {
    if (pedindo || gravacao) { opt.toast("Espere o vídeo atual terminar"); return; }
    pedindo = t.id || "x"; render(true);
    opt.toast(anterior ? "🔁 Recriando: novo roteiro, novas cenas e novo vídeo…" : "✍️ Pena está escrevendo o roteiro e Claquete detalhando as cenas (até 1 min)…");
    let novoId = null;
    try {
      const token = await Dados.token();
      const r = await fetch("/api/agentes", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ acao: "roteiro", formato, tendencia: { id: t.id || null, titulo: t.titulo, resumo: t.resumo, categoria: t.categoria },
          anterior: anterior ? { id: anterior.id, titulo: anterior.titulo, gancho: anterior.gancho } : null }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) opt.toast("✍️ " + (j.erro || "Não consegui gerar o roteiro (" + r.status + ")"));
      else { novoId = j.id; opt.toast(`🎬 Roteiro pronto com ${j.cenas} cenas. Corte vai gerar o vídeo…`); aba = "roteiros"; aberto = null; }
      Dados.registrarAtividade(null, "acao", `${anterior ? "Recriou" : "Pediu"} roteiro: ${t.titulo}`, { sala: "Edição" });
    } catch (er) { opt.toast("✍️ Falha ao chamar o roteirista"); }
    pedindo = null; await recarregar();
    if (anterior && novoId && anterior.status !== "descartado") { await Dados.mexerRoteiro(anterior.id, "descartado").catch(() => {}); await recarregar(); }
    render(true);
    // já gera e salva o vídeo do roteiro novo
    const novo = novoId && roteiros.find(x => x.id === novoId);
    if (novo) gerarVideo(novo);
  }
  function recriar(r) {
    if (!r) return;
    const t = tend.find(x => x.id === r.tendencia_id) || { id: r.tendencia_id, titulo: r.titulo, resumo: r.gancho || r.roteiro, categoria: "" };
    return produzir(t, r);
  }

  /* ---------------- vídeo animado (js/video.js) ---------------- */
  let gravacao = null, comVoz = true;
  function pararVideo() { if (gravacao) { gravacao.cancelado = true; gravacao = null; } }
  async function gerarVideo(r) {
    if (!r || !window.Video) return;
    pararVideo(); await new Promise(res => setTimeout(res, 60));
    const area = painel && painel.querySelector(`[data-video-area="${r.id}"]`); if (!area) return;
    const eu = gravacao = { cancelado: false };
    area.innerHTML = `<p class="ed-dica">✂️ Corte está animando o vídeo… <span data-prog>0%</span> <small>(é gravado em tempo real; deixe esta janela aberta)</small></p><p class="ed-dica" data-status></p>`;
    try {
      const res = await Video.gerar(r, {
        canvas: c => { c.className = "ed-canvas"; area.appendChild(c); },
        voz: comVoz,
        aoStatus: t => { const e = area.querySelector("[data-status]"); if (e) e.textContent = t; },
        aoProgredir: p => { const e = area.querySelector("[data-prog]"); if (e) e.textContent = Math.round(p * 100) + "%"; },
        cancelado: () => eu.cancelado,
      });
      if (!res || eu.cancelado) return;
      const url = URL.createObjectURL(res.blob);
      const nome = (r.titulo || "roteiro").normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 50);
      area.innerHTML = `<p class="ed-dica">✂️ Vídeo animado pronto (${Math.round(res.duracao)} s, ${res.comVoz ? "com narração e trilha sonora" : "com trilha sonora"}).</p>
        ${res.aviso ? `<p class="ed-dica">⚠️ ${esc(res.aviso)}</p>` : ""}
        <video class="ed-canvas" src="${url}" controls playsinline></video>
        <a class="btn pri" href="${url}" download="${nome}.${res.ext}">⬇️ Baixar vídeo (.${res.ext})</a>
        <p class="ed-dica" data-salvando>💾 Salvando para aprovação…</p>`;
      Dados.registrarAtividade(null, "acao", `Gerou vídeo animado: ${r.titulo}`, { sala: "Edição" });
      // sempre fica salvo, aguardando aprovação
      try {
        await Dados.salvarVideo(r.id, res.blob, res.ext);
        opt.toast("💾 Vídeo salvo — aguardando aprovação");
        gravacao = null; URL.revokeObjectURL(url); await recarregar(); render(true);
      } catch (er) {
        console.warn("salvar vídeo:", er);
        const e2 = area.querySelector("[data-salvando]"); if (e2) e2.textContent = "⚠️ Não consegui salvar o vídeo (" + (er.message || er) + "). Baixe agora para não perder.";
        gravacao = null;
      }
    } catch (e) { area.innerHTML = `<p class="ed-dica">⚠️ ${esc(e.message || "Não consegui gerar o vídeo")}</p>`; gravacao = null; }
    if (renderPendente) render(false);
  }

  return { iniciar, recarregar, desenhaveis, clicou, abrirPainel, fecharPainel, atualizar, get aberto() { return !!painel; } };
})();
