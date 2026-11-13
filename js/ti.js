/* Sala de TI: racks de servidores, 5 computadores com 5 agentes de IA e o telão de tendências de mercado.
   – Os agentes (Radar, Faro, Lupa, Pulso, Bússola) publicam tendências pela função agente_publicar do banco
     e avisam o que estão fazendo por agente_status (ver README → "Agentes da sala de TI").
   – O telão de tendências mostra as últimas no mapa; clicar abre o painel com travar/destravar e pega/não pega.
   Este arquivo também registra as artes (precisa ser carregado ANTES de js/mapa-core.js). */
(function registrarArtes() {
  if (!window.ASSETS) return;
  const nova = (w, h, desenha) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); desenha((x, y, ww, hh, cor) => { g.fillStyle = cor; g.fillRect(x, y, ww, hh); }, g); return c.toDataURL(); };

  // piso da TI: placas escuras com frisos ciano
  ASSETS.f_ti = { src: nova(32, 32, R => { R(0, 0, 32, 32, "#232a36"); R(0, 0, 32, 1, "#2f3846"); R(0, 0, 1, 32, "#2f3846"); R(16, 0, 1, 32, "#1c222c"); R(0, 16, 32, 1, "#1c222c"); R(3, 3, 2, 2, "#2fd4e8"); R(19, 19, 2, 2, "#1b8c9c"); }), w: 32, h: 32, label: "Piso de TI", cat: "piso", pal: false };

  // rack de servidor (32x64)
  ASSETS.rack_servidor = { src: nova(32, 64, R => {
    R(2, 2, 28, 60, "#15181f"); R(2, 2, 28, 2, "#3b414e"); R(2, 2, 2, 60, "#2a2f3a"); R(28, 2, 2, 60, "#0c0e13");
    for (let i = 0; i < 9; i++) { const y = 7 + i * 6; R(5, y, 22, 5, "#262b36"); R(5, y, 22, 1, "#323846"); R(7, y + 2, 10, 1, "#1a1e27"); R(22, y + 2, 1, 1, "#3fbf5f"); R(24, y + 2, 1, 1, "#2fd4e8"); }
    R(4, 61, 4, 2, "#0c0e13"); R(24, 61, 4, 2, "#0c0e13");
  }), w: 32, h: 64, label: "Rack de servidor", cat: "TI", pal: true };

  // agentes de IA sentados de costas no computador (capuz colorido + fone)
  const cores = [["#2f6fd8", "#1d4a99"], ["#7b4fd8", "#52309a"], ["#1f9e6e", "#13704d"], ["#d8682f", "#9a4419"], ["#c23a5a", "#86223c"],
    /* sala de Edição: Pena (roteirista), Claquete (cenas), Corte (editor) */ ["#e0b030", "#a07a14"], ["#3a3f4a", "#22262e"], ["#e04fa0", "#9c2a6c"]];
  cores.forEach(([c1, c2], i) => {
    // com o gerador de personagens carregado, os agentes ficam no mesmo estilo das pessoas
    if (window.AvatarPixel) { ASSETS["agente_" + (i + 1)] = { src: AvatarPixel.agente(c1, ["#2b2626", "#4a3022", "#7a4b2a", "#e0b860", "#d9772e", "#2b2626", "#8e2f2a", "#d96aa7"][i]).toDataURL(), w: 32, h: 40, label: "Agente de IA " + (i + 1), cat: "TI", pal: true }; return; }
    ASSETS["agente_" + (i + 1)] = { src: nova(32, 40, R => {
      R(9, 31, 14, 3, "#2b2f39"); R(15, 34, 2, 4, "#2b2f39"); R(10, 38, 12, 2, "#1d2028");          // cadeira
      R(7, 20, 18, 12, c2); R(8, 19, 16, 12, c1); R(6, 22, 3, 8, c2); R(23, 22, 3, 8, c2);              // corpo/braços
      R(10, 6, 12, 14, c2); R(9, 8, 14, 11, c1); R(11, 5, 10, 3, c1);                                    // capuz
      R(8, 11, 2, 5, "#1a1d24"); R(22, 11, 2, 5, "#1a1d24"); R(9, 7, 14, 2, "#1a1d24");                 // fone
      R(8, 12, 1, 2, "#2fd4e8"); R(23, 12, 1, 2, "#2fd4e8");                                              // luz do fone
      R(14, 22, 4, 7, c2);                                                                               // costura
    }), w: 32, h: 40, label: "Agente de IA " + (i + 1), cat: "TI", pal: true };
  });

  // telão de tendências: mesma moldura do telão de gestão
  if (ASSETS.telao) ASSETS.telao_tend = { ...ASSETS.telao, label: "Telão de tendências", cat: "TI", pal: true };
})();

window.TI = (function () {
  let tend = [], agentes = [], pessoas = {}, opt = null, painel = null, filtro = "pendente";
  let modo = "tend", prosp = [], filtroP = "revisar", buscando = false, enviando = null;
  const rascP = {}, rascAg = {};   // o que a pessoa está editando (sobrevive às atualizações em tempo real)
  const fmtQuando = d => { const dt = new Date(d), min = Math.round((Date.now() - dt) / 60000); return min < 1 ? "agora" : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : dt.toLocaleDateString("pt-BR"); };
  const nomeDe = id => (id && pessoas[id]) || "alguém";
  const meuId = () => Dados.meuId();
  // sala da Next (IA da Next, prospecção) ou sala de cliente (IA própria do cliente, só pesquisa)
  const mapaAtual = () => window.mapaIdAtual || "principal";
  const ehNext = () => mapaAtual() === "principal";
  const podeMexer = () => ehNext() ? Dados.ehAdmin() : !!((window.souDonoDaSala && souDonoDaSala()) || Dados.ehAdmin());
  const idAgente = id => !id || ehNext() || String(id).includes(":") ? id : mapaAtual() + ":" + id;

  async function iniciar(o) {
    opt = o;
    await recarregar();
    Dados.ouvirTendencias(recarregar); Dados.ouvirAgentes(recarregar);
    if (Dados.ouvirProspects) Dados.ouvirProspects(recarregar);
    setInterval(recarregar, 60000);
  }
  async function recarregar() {
    const [t, a, u, p] = await Promise.all([Dados.listarTendencias(150), Dados.listarAgentes(), Dados.listarUsuarios(), (ehNext() && Dados.listarProspects) ? Dados.listarProspects() : null]);
    tend = t; agentes = a; pessoas = Object.fromEntries(u.map(p => [p.id, p.nome])); prosp = p;
    if (painel) renderPainel();
  }
  const agenteInfo = id => agentes.find(a => a.id === idAgente(id)) || agentes.find(a => a.id === id) || { id, nome: id, status: "parado" };
  const online = a => a.visto_em && Date.now() - new Date(a.visto_em) < 15 * 60000;

  /* ---------------- desenho no mapa ---------------- */
  function desenhaveis(t) {
    const out = [];
    for (const it of allItems()) {
      if (it.k === "rack_servidor") out.push({ sort: sortKey(it) + 0.01, draw: g => leds(g, it, t) });
      else if (it.k === "telao_tend") out.push({ sort: sortKey(it) + 0.01, draw: g => tela(g, Math.round(it.x * T), Math.round(it.y * T), t, it) });
    }
    return out;
  }
  function leds(g, it, t) {
    const x = Math.round(it.x * T), y = Math.round(it.y * T), s = Math.round(it.x * 7 + it.y * 13);
    for (let i = 0; i < 9; i++) {
      const yy = y + 9 + i * 6;
      const a = Math.sin(t * (3 + (i % 3)) + s + i) > 0.2, b = Math.sin(t * (5 + (i % 4)) + s * 2 + i * 3) > 0.6;
      g.fillStyle = a ? "#5cff7a" : "#1e5a2a"; g.fillRect(x + 22, yy, 1, 1);
      g.fillStyle = b ? "#7ff3ff" : "#1b5560"; g.fillRect(x + 24, yy, 1, 1);
      if (Math.sin(t * 9 + i + s) > 0.85) { g.fillStyle = "#ffb04a"; g.fillRect(x + 26, yy, 1, 1); }
    }
  }
  /* recursos da TI só para quem está dentro da sala */
  const salaDoIt = it => (it.room && roomById(it.room)) || roomAt(it.x * T + 16, it.y * T + 40);
  const minhaSala = () => { const e = opt && opt.eu && opt.eu(); const r = e && roomAt(e.px, e.py - 4); return r ? r.id : null; };
  const dentro = it => { const r = salaDoIt(it); return !r || r.id === minhaSala(); };
  const dentroDaTI = () => { const id = minhaSala(), r = id && roomById(id); return !!(r && r.type === "ti"); };
  function tela(g, x, y, t, it) {
    if (it && !dentro(it)) {
      g.save();
      g.fillStyle = "#0f1622"; g.fillRect(x + 6, y + 6, 180, 77);
      g.fillStyle = "#13a6b8"; g.fillRect(x + 6, y + 6, 180, 9);
      g.fillStyle = "#fff"; g.font = "bold 7px system-ui,sans-serif"; g.textBaseline = "middle";
      g.fillText("TENDÊNCIAS DE MERCADO", x + 10, y + 10.5);
      g.textAlign = "center"; g.fillStyle = "#9fb3c8"; g.font = "bold 8px system-ui,sans-serif";
      g.fillText("🔒 Só para quem está na sala", x + 96, y + 46);
      g.restore(); return;
    }
    g.save();
    g.fillStyle = "#0f1622"; g.fillRect(x + 6, y + 6, 180, 77);
    g.fillStyle = "#13a6b8"; g.fillRect(x + 6, y + 6, 180, 9);
    g.fillStyle = "#fff"; g.font = "bold 7px system-ui,sans-serif"; g.textBaseline = "middle";
    g.fillText("TENDÊNCIAS DE MERCADO", x + 10, y + 10.5);
    const pend = tend.filter(x => x.decisao === "pendente").length;
    g.textAlign = "right"; g.fillText(pend ? `${pend} p/ avaliar` : "", x + 182, y + 10.5); g.textAlign = "left";
    const lista = tend.slice(0, 5);
    if (!lista.length) {
      g.fillStyle = "#9fb3c8"; g.font = "6px system-ui,sans-serif"; g.textAlign = "center";
      g.fillText("Aguardando os agentes publicarem…", x + 96, y + 44);
      g.fillText("Toque para abrir o painel", x + 96, y + 54); g.textAlign = "left";
    }
    lista.forEach((tt, i) => {
      const yy = y + 20 + i * 12;
      const cor = tt.decisao === "pega" ? "#3fbf5f" : tt.decisao === "nao_pega" ? "#e5484d" : "#f2a33a";
      g.fillStyle = cor; g.fillRect(x + 10, yy, 3, 8);
      g.fillStyle = "#e6edf5"; g.font = "6px system-ui,sans-serif";
      let s = tt.titulo; while (g.measureText(s).width > 128 && s.length > 3) s = s.slice(0, -2); if (s !== tt.titulo) s += "…";
      g.fillText(s, x + 17, yy + 4);
      g.fillStyle = "#7f93a8"; g.font = "5px system-ui,sans-serif";
      g.textAlign = "right"; g.fillText((tt.travada ? "🔒 " : "") + (tt.decisao === "pega" ? "PEGA" : tt.decisao === "nao_pega" ? "NÃO PEGA" : "NOVA"), x + 182, yy + 4); g.textAlign = "left";
    });
    // cursor piscando = agentes trabalhando
    if (agentes.some(online) && Math.floor(t * 2) % 2) { g.fillStyle = "#13a6b8"; g.fillRect(x + 10, y + 79, 4, 2); }
    g.restore();
  }
  /* nomes e balões dos agentes (coordenadas de tela) */
  function nomes(ctx, cam, zoom, t) {
    for (const it of allItems()) {
      if (!/^agente_\d$/.test(it.k) || !it.agente) continue;
      if (window.AGENTES_FORA && AGENTES_FORA.has(it.agente)) continue; // está de pé andando: o nome vai com ele
      const a = agenteInfo(it.agente);
      const sx = (it.x * T + 16) * zoom + cam.ox, sy = (it.y * T + 56) * zoom + cam.oy;
      if (sx < -80 || sx > innerWidth + 80 || sy < -40 || sy > innerHeight + 40) continue;
      const on = online(a), st = String(a.status || ""), txt = `🤖 ${a.nome}` + (on && st && st !== "parado" ? ` · ${st.length > 14 ? st.slice(0, 13) + "…" : st}` : "");
      ctx.font = "700 11px system-ui,sans-serif"; const w = ctx.measureText(txt).width + 12;
      ctx.fillStyle = on ? "rgba(19,166,184,.92)" : "rgba(20,16,32,.72)"; ctx.beginPath(); ctx.roundRect(sx - w / 2, sy - 18, w, 16, 6); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, sx, sy - 10); ctx.textAlign = "left";
      if (on) { ctx.fillStyle = Math.floor(t * 2) % 2 ? "#5cff7a" : "#2a8a3a"; ctx.beginPath(); ctx.arc(sx - w / 2 - 5, sy - 10, 3, 0, 7); ctx.fill(); }
    }
  }
  /* clique no mapa (coordenadas do mundo) */
  function clicou(wx, wy) {
    for (const it of allItems()) {
      if (it.k === "telao_tend" && wx >= it.x * T && wx <= it.x * T + 192 && wy >= it.y * T && wy <= it.y * T + 90) {
        const r = salaDoIt(it);
        if (!dentro(it)) { opt.toast(`🔒 Entre em ${r ? r.name : "TI"} para usar o painel de tendências`); return true; }
        abrirPainel(); return true;
      }
      if (/^agente_\d$/.test(it.k) && it.agente && wx >= it.x * T && wx <= it.x * T + 32 && wy >= it.y * T - 8 && wy <= it.y * T + 40) {
        if (!dentro(it)) { opt.toast("🔒 Entre na sala de TI para falar com os agentes"); return true; }
        const a = agenteInfo(it.agente);
        opt.toast(`🤖 ${a.nome}: ${online(a) ? (a.detalhe || a.status) : "parado (sem sinal há mais de 15 min)"}`);
        return true;
      }
    }
    return false;
  }

  /* ---------------- painel ---------------- */
  function abrirPainel() {
    if (painel) return;
    if (opt && opt.eu && !dentroDaTI()) { opt.toast("🔒 O painel de tendências só abre dentro da sala de TI"); return; }
    painel = document.createElement("div");
    painel.className = "tend-bg";
    painel.innerHTML = `<div class="tend-win" role="dialog" aria-label="Tendências de mercado"></div>`;
    document.body.appendChild(painel);
    painel.addEventListener("click", aoClicar);
    painel.addEventListener("submit", aoEnviar);
    addEventListener("keydown", escFechar);
    opt.aoAbrir && opt.aoAbrir();
    renderPainel();
    Dados.registrarAtividade(null, "acao", "Abriu o painel de tendências", { sala: "TI" });
  }
  let rodando = false;
  async function rodarAgentes() {
    if (rodando) return; rodando = true; renderPainel();
    try {
      const token = Dados.token ? await Dados.token() : null;
      const r = ehNext() ? await fetch("/api/agentes", { method: "POST", headers: token ? { Authorization: "Bearer " + token } : {} })
        : await fetch("/api/agentes-sala", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify({ mapa: mapaAtual() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.erro) opt.toast("🤖 " + (j.erro || "Não consegui rodar os agentes (" + r.status + ")"));
      else {
        const n = (j.resultado || []).reduce((s, x) => s + (x.publicadas || 0), 0), falhas = (j.resultado || []).filter(x => x.erro);
        opt.toast(`🤖 ${n} tendência(s) nova(s)` + (falhas.length ? ` · erro: ${falhas[0].erro}` : ""));
      }
    } catch (e) { opt.toast("🤖 Falha ao chamar os agentes"); }
    rodando = false; await recarregar(); renderPainel();
  }
  function fecharPainel() { if (!painel) return; painel.remove(); painel = null; removeEventListener("keydown", escFechar); }
  function escFechar(e) { if (e.key === "Escape") fecharPainel(); }
  function renderPainel() {
    if (!painel) return;
    const adm = podeMexer(), eu = meuId();
    const cont = { pendente: 0, pega: 0, nao_pega: 0 }; tend.forEach(t => cont[t.decisao]++);
    const busca = (painel.querySelector("[data-busca]") || {}).value || "";
    const lista = tend.filter(t => (filtro === "todas" || t.decisao === filtro) && (!busca || (t.titulo + " " + (t.resumo || "") + " " + (t.categoria || "")).toLowerCase().includes(busca.toLowerCase())));
    const win = painel.querySelector(".tend-win"), rolagem = (win.querySelector(".tend-lista") || {}).scrollTop || 0;
    // guarda o foco e o que está sendo digitado
    const foco = document.activeElement && win.contains(document.activeElement) && document.activeElement.dataset.chave ? document.activeElement : null;
    const fChave = foco && foco.dataset.chave, fSel = foco && "selectionStart" in foco ? [foco.selectionStart, foco.selectionEnd] : null;
    const daPesquisa = agentes.filter(a => a.tipo !== "edicao" && !/^agente[678]$/.test(a.id));
    const nP = (prosp || []).filter(p => p.status === "revisar").length;
    win.innerHTML = `
      <div class="tend-top"><b>🔎 Sala de Pesquisa</b>
        <div class="tend-agentes">${daPesquisa.map(a => `<span class="ag ${online(a) ? "on" : ""} ${a.ativo === false ? "off" : ""}" title="${esc(a.detalhe || "")}">${a.tipo === "prospeccao" ? "📨" : "🤖"} ${esc(a.nome)} <small>${a.ativo === false ? "desligado" : online(a) ? esc(a.status) : "parado"}</small></span>`).join("")}</div>
        <button class="tend-x" data-fechar aria-label="Fechar">✕</button></div>
      <div class="tend-modos">${[["tend", "📈 Tendências"], ...(ehNext() ? [["prosp", `📨 Prospecção${nP ? ` <i>${nP}</i>` : ""}`]] : []), ["agentes", "⚙️ Agentes"]].map(([k, l]) => `<button class="${modo === k ? "on" : ""}" data-modo="${k}">${l}</button>`).join("")}</div>
      ${modo === "agentes" ? corpoAgentes(daPesquisa, adm) : modo === "prosp" && ehNext() ? corpoProsp(adm) : corpoTend(adm, cont, busca, lista, eu)}`;
    const l = win.querySelector(".tend-lista"); if (l) l.scrollTop = rolagem;
    if (fChave) { const el = win.querySelector(`[data-chave="${CSS.escape(fChave)}"]`); if (el) { el.focus(); if (fSel) try { el.setSelectionRange(fSel[0], fSel[1]); } catch (e) {} } }
  }
  function corpoTend(adm, cont, busca, lista, eu) {
    return `
      <div class="tend-barra">
        ${[["pendente", "🆕 Para avaliar"], ["pega", "✅ Pega"], ["nao_pega", "❌ Não pega"], ["todas", "Todas"]].map(([k, l]) => `<button class="tab ${filtro === k ? "on" : ""}" data-filtro="${k}">${l}${k !== "todas" ? ` <i>${cont[k]}</i>` : ""}</button>`).join("")}
        <input data-busca data-chave="busca" placeholder="Buscar…" value="${esc(busca)}">
        ${adm ? `<button class="btn" data-rodar ${rodando ? "disabled" : ""} title="${ehNext() ? "Os agentes de pesquisa pedem tendências à IA da Next agora" : "Os agentes pedem tendências à IA configurada em Configurações → IA e agentes"}">${rodando ? "⏳ Agentes trabalhando…" : "▶ Rodar agentes"}</button><button class="btn pri" data-nova>＋ Nova</button>` : ""}
      </div>
      ${adm && painel.dataset.nova ? `<form class="tend-form" data-form>
        <input name="titulo" placeholder="Título da tendência" required maxlength="200">
        <textarea name="resumo" placeholder="Resumo (o que é e por que importa)" rows="2"></textarea>
        <div class="row2"><input name="categoria" placeholder="Categoria (ex.: IA, Social, Ads)"><input name="fonte_url" placeholder="Link da fonte (opcional)">
        <select name="relevancia"><option value="">Relevância</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select>
        <button class="btn pri">Salvar</button><button type="button" class="btn" data-cancelar>Cancelar</button></div></form>` : ""}
      <div class="tend-lista">${lista.length ? lista.map(t => cartao(t, eu, adm)).join("") : `<p class="tend-vazio">${tend.length ? "Nada neste filtro." : "Ainda não há tendências. Assim que os agentes publicarem, elas aparecem aqui em tempo real."}</p>`}</div>
      <p class="tend-rodape">${ehNext() ? "Só as tendências marcadas como <b>✅ Pega</b> seguem para a sala de Edição." : "As tendências vêm da IA da sua sala (Configurações → IA e agentes) ou da sua IA conectada por MCP."}</p>`;
  }

  /* ---------- aba Agentes: nome, foco e instruções de cada pesquisador ---------- */
  function corpoAgentes(lista, adm) {
    if (!lista.length) return ehNext() ? `<p class="tend-vazio">Nenhum agente encontrado.</p>`
      : `<p class="tend-vazio">Esta sala ainda não tem agentes.${adm ? `<br><br><button class="btn pri" data-criaragentes>＋ Criar os 5 agentes de pesquisa</button>` : " Peça ao dono da sala para criá-los."}</p>`;
    const semMigracao = !lista.some(a => "tipo" in a);
    const dis = adm && !semMigracao ? "" : "disabled";
    const v = (a, k, padrao) => { const r = rascAg[a.id]; return r && k in r ? r[k] : padrao; };
    return `${semMigracao ? `<p class="ed-dica aviso">Para editar os agentes, rode o arquivo <b>rodar_no_supabase_5.sql</b> no Supabase (SQL Editor).</p>` : !adm ? `<p class="ed-dica">Só administradores podem mudar os agentes.</p>` : ""}
      <div class="tend-lista ag-lista">${lista.map(a => {
        const c = a.config || {}, pro = v(a, "tipo", a.tipo) === "prospeccao", k = n => `ag-${a.id}-${n}`;
        return `<form class="tc ag-card ${pro ? "pro" : ""}" data-agform="${a.id}">
          <div class="tc-top"><b>${pro ? "📨" : "🤖"} ${esc(v(a, "nome", a.nome))}</b><span class="chip">${a.id}</span></div>
          <label>Nome<input name="nome" data-chave="${k("nome")}" maxlength="30" value="${esc(v(a, "nome", a.nome))}" ${dis}></label>
          <div class="row2">
            <label>Função<select name="tipo" data-chave="${k("tipo")}" ${dis}><option value="pesquisa" ${!pro ? "selected" : ""}>Pesquisa de tendências</option>${ehNext() ? `<option value="prospeccao" ${pro ? "selected" : ""}>Prospecção de clientes</option>` : ""}</select></label>
            <label>Categoria<input name="categoria" data-chave="${k("categoria")}" maxlength="40" value="${esc(v(a, "categoria", a.categoria || ""))}" ${dis}></label>
          </div>
          <label>${pro ? "Que tipo de empresa procurar" : "O que pesquisar"}<textarea name="foco" data-chave="${k("foco")}" rows="2" ${dis}>${esc(v(a, "foco", a.foco || ""))}</textarea></label>
          <label>${pro ? "Como escrever o e-mail (prompt)" : "Instruções / prompt"}<textarea name="prompt" data-chave="${k("prompt")}" rows="3" placeholder="${pro ? "Tom, o que destacar, o que evitar…" : "Ex.: foque em novidades das últimas semanas, cite exemplos brasileiros…"}" ${dis}>${esc(v(a, "prompt", a.prompt || ""))}</textarea></label>
          ${pro ? `
          <div class="row2">
            <label>Segmentos (um por linha)<textarea name="segmentos" data-chave="${k("seg")}" rows="4" ${dis}>${esc(v(a, "segmentos", [].concat(c.segmentos || []).join("\n")))}</textarea></label>
            <label>Cidades (uma por linha)<textarea name="cidades" data-chave="${k("cid")}" rows="4" ${dis}>${esc(v(a, "cidades", [].concat(c.cidades || []).join("\n")))}</textarea></label>
          </div>
          <label>O que a Next Co. oferece (vai em todos os e-mails)<textarea name="oferta" data-chave="${k("oferta")}" rows="4" ${dis}>${esc(v(a, "oferta", c.oferta || ""))}</textarea></label>
          <div class="row2">
            <label>Assinatura<textarea name="assinatura" data-chave="${k("ass")}" rows="2" ${dis}>${esc(v(a, "assinatura", c.assinatura || ""))}</textarea></label>
            <label>Empresas por rodada<input name="por_rodada" data-chave="${k("n")}" type="number" min="1" max="8" value="${esc(v(a, "por_rodada", c.por_rodada || 5))}" ${dis}></label>
          </div>` : ""}
          <div class="tc-acoes"><label class="liga"><input type="checkbox" name="ativo" ${v(a, "ativo", a.ativo !== false) ? "checked" : ""} ${dis}> Ligado</label>
            ${adm && !semMigracao ? `<button class="btn pri">Salvar</button>${rascAg[a.id] ? `<button type="button" class="btn" data-agdesfaz="${a.id}">Desfazer</button>` : ""}` : ""}</div>
        </form>`; }).join("")}</div>`;
  }

  /* ---------- aba Prospecção: empresas encontradas + e-mail para aprovar ---------- */
  function corpoProsp(adm) {
    if (prosp == null) return `<p class="tend-vazio">Para usar a prospecção, rode o arquivo <b>rodar_no_supabase_5.sql</b> no Supabase (SQL Editor).</p>`;
    const cont = { revisar: 0, sem_email: 0, enviado: 0, respondeu: 0, descartado: 0 }; prosp.forEach(p => { if (p.status in cont) cont[p.status]++; else if (p.status === "descadastrado") cont.descartado++; });
    const busca = ((painel.querySelector("[data-busca]") || {}).value || "").toLowerCase();
    const lista = prosp.filter(p => (filtroP === "todas" || p.status === filtroP || (filtroP === "descartado" && p.status === "descadastrado")) &&
      (!busca || [p.empresa, p.segmento, p.cidade, p.email, p.site].join(" ").toLowerCase().includes(busca)));
    const pro = agentes.find(a => a.tipo === "prospeccao");
    return `<div class="tend-barra">
        ${[["revisar", "✍️ Para aprovar"], ["sem_email", "📞 Sem e-mail"], ["enviado", "✅ Enviados"], ["respondeu", "💬 Responderam"], ["descartado", "🗑 Descartados"], ["todas", "Todas"]].map(([k, l]) => `<button class="tab ${filtroP === k ? "on" : ""}" data-filtrop="${k}">${l}${k !== "todas" ? ` <i>${cont[k]}</i>` : ""}</button>`).join("")}
        <input data-busca data-chave="buscap" placeholder="Buscar empresa, cidade…" value="${esc(busca)}">
        ${adm ? `<button class="btn" data-respostas ${lendoRespostas ? "disabled" : ""} title="Lê a caixa de entrada do e-mail do cPanel e transforma respostas em tarefas no telão">${lendoRespostas ? "⏳ Lendo e-mails…" : "📥 Verificar respostas"}</button>` : ""}
        ${adm ? `<button class="btn" data-prospectar ${buscando || !pro ? "disabled" : ""} title="${pro ? esc(pro.nome) + " busca empresas no Google Maps e escreve os e-mails" : "Escolha um agente de prospecção na aba Agentes"}">${buscando ? "⏳ Buscando empresas…" : "▶ Buscar empresas agora"}</button>` : ""}
      </div>
      <div class="tend-lista pr-lista">${lista.length ? lista.map(p => cartaoProsp(p, adm)).join("") : `<p class="tend-vazio">${prosp.length ? "Nada neste filtro." : `Ainda não há empresas. ${adm ? "Clique em <b>▶ Buscar empresas agora</b>." : ""}`}</p>`}</div>
      <p class="tend-rodape">Nenhum e-mail sai sem alguém clicar em <b>Enviar</b>. Cada empresa recebe no máximo um e-mail, com a opção de pedir para não receber mais. Quem responde vira tarefa no telão para quem enviou; quem pede para sair é descadastrado sozinho.</p>`;
  }
  function cartaoProsp(p, adm) {
    const r = rascP[p.id] || {}, v = (k, d) => k in r ? r[k] : (d ?? ""), k = n => `pr-${p.id}-${n}`;
    const editar = adm && p.status === "revisar";
    const meta = `<div class="tc-meta">${p.segmento ? `<span class="chip">${esc(p.segmento)}</span>` : ""}${p.cidade ? `<span>📍 ${esc(p.cidade)}</span>` : ""}
      ${p.avaliacao ? `<span>⭐ ${esc(p.avaliacao)} (${esc(p.avaliacoes || 0)})</span>` : ""}<span>${fmtQuando(p.criado_em)}</span>
      ${p.site ? `<a href="${esc(seguro(p.site))}" target="_blank" rel="noopener noreferrer">site ↗</a>` : ""}${p.maps_url ? `<a href="${esc(seguro(p.maps_url))}" target="_blank" rel="noopener noreferrer">mapa ↗</a>` : ""}
      ${p.telefone ? `<span>📞 ${esc(p.telefone)}</span>` : ""}</div>`;
    const quem = p.status === "enviado" ? `<div class="tc-quem"><span>✅ Enviado para <b>${esc(p.email)}</b> por <b>${esc(nomeDe(p.enviado_por))}</b> · ${fmtQuando(p.enviado_em)}</span></div>` :
      p.status === "descadastrado" ? `<div class="tc-quem"><span>🚫 Pediu para não receber e-mails${p.respondeu_em ? " · " + fmtQuando(p.respondeu_em) : ""}</span></div>` : "";
    const resposta = p.resposta && (p.status === "respondeu" || p.status === "descadastrado") ? `<div class="pr-resp"><b>💬 Resposta ${p.respondeu_em ? "· " + fmtQuando(p.respondeu_em) : ""}</b><pre>${esc(p.resposta)}</pre></div>` : "";
    return `<article class="tc pr ${p.status}" data-pid="${p.id}">
      <div class="tc-top"><b>${esc(p.empresa)}</b></div>${meta}
      ${p.analise ? `<p class="pr-analise">💡 ${esc(p.analise)}</p>` : ""}
      ${p.erro && p.status === "revisar" ? `<p class="pr-erro">⚠️ Último envio falhou: ${esc(p.erro)}</p>` : ""}
      ${editar ? `
        <label>Para<input data-campo="email" data-chave="${k("email")}" list="${k("lista")}" value="${esc(v("email", p.email))}"></label>
        <datalist id="${k("lista")}">${(p.emails || []).map(e => `<option value="${esc(e)}">`).join("")}</datalist>
        <label>Assunto<input data-campo="assunto" data-chave="${k("assunto")}" maxlength="200" value="${esc(v("assunto", p.assunto))}"></label>
        <label>Mensagem<textarea data-campo="corpo" data-chave="${k("corpo")}" rows="9">${esc(v("corpo", p.corpo))}</textarea></label>
        <div class="tc-acoes">
          <button class="btn pri" data-enviar ${enviando ? "disabled" : ""}>${enviando === p.id ? "⏳ Enviando…" : "✉️ Enviar"}</button>
          <button class="btn" data-teste ${enviando ? "disabled" : ""} title="Manda este texto para o seu e-mail, para conferir">Testar no meu e-mail</button>
          ${rascP[p.id] ? `<button class="btn" data-salvarp>Salvar texto</button>` : ""}
          <button class="del" data-pstatus="descartado" title="Descartar">🗑</button></div>`
      : p.status === "sem_email" ? `<p class="pr-dica">Não achei e-mail no site. Dá para chamar pelo telefone/WhatsApp${p.maps_url ? " ou pelo mapa" : ""}.</p>
        ${adm ? `<div class="tc-acoes"><button class="btn" data-addemail>＋ Tenho o e-mail</button><button class="del" data-pstatus="descartado" title="Descartar">🗑</button></div>` : ""}`
      : `${resposta}${p.assunto ? `<details><summary>${p.status === "respondeu" ? "E-mail enviado: " : ""}${esc(p.assunto)}</summary><pre class="pr-corpo">${esc(p.corpo || "")}</pre></details>` : ""}${quem}
        ${p.status === "respondeu" ? `<div class="tc-quem"><span>Enviado por <b>${esc(nomeDe(p.enviado_por))}</b> para ${esc(p.email)}</span></div><div class="tc-acoes">${p.tarefa_id ? `<button class="btn pri" data-vertarefa="${esc(p.tarefa_id)}">📋 Abrir tarefa no telão</button>` : ""}<a class="btn" style="text-decoration:none;color:inherit" href="mailto:${esc(p.email)}?subject=${encodeURIComponent("Re: " + (p.assunto || ""))}">✉️ Responder</a></div>` : ""}
        ${adm ? `<div class="tc-acoes">${p.status === "enviado" ? `<button class="btn" data-pstatus="descadastrado" title="Respondeu pedindo para sair">🚫 Pediu para sair</button>` : p.status !== "revisar" && p.status !== "respondeu" ? `<button class="btn" data-pstatus="${p.email ? "revisar" : "sem_email"}">↩ Voltar para aprovação</button>` : ""}</div>` : ""}`}
    </article>`;
  }
  function cartao(t, eu, adm) {
    const travadaOutro = t.travada && t.travada_por !== eu && !adm;
    const dono = t.travada ? nomeDe(t.travada_por) : "";
    return `<article class="tc ${t.decisao}" data-id="${t.id}">
      <div class="tc-top"><b>${esc(t.titulo)}</b>${t.relevancia ? `<span class="estrelas" title="Relevância ${t.relevancia}/5">${"★".repeat(t.relevancia)}</span>` : ""}</div>
      <div class="tc-meta">${t.categoria ? `<span class="chip">${esc(t.categoria)}</span>` : ""}<span>🤖 ${esc(agenteNome(t.agente))}</span><span>${fmtQuando(t.criado_em)}</span>
        ${t.fonte_url ? `<a href="${esc(seguro(t.fonte_url))}" target="_blank" rel="noopener noreferrer">fonte ↗</a>` : ""}</div>
      ${t.resumo ? `<p>${esc(t.resumo)}</p>` : ""}
      <div class="tc-acoes">
        <button class="dec pega ${t.decisao === "pega" ? "on" : ""}" data-acao="${t.decisao === "pega" ? "pendente" : "pega"}" ${travadaOutro ? "disabled" : ""}>✅ Pega</button>
        <button class="dec nao ${t.decisao === "nao_pega" ? "on" : ""}" data-acao="${t.decisao === "nao_pega" ? "pendente" : "nao_pega"}" ${travadaOutro ? "disabled" : ""}>❌ Não pega</button>
        <button class="trava ${t.travada ? "on" : ""}" data-acao="${t.travada ? "destravar" : "travar"}" ${travadaOutro ? "disabled" : ""}>${t.travada ? "🔒 Travada" : "🔓 Travar"}</button>
        ${adm ? `<button class="del" data-del title="Excluir">🗑</button>` : ""}
      </div>
      <div class="tc-quem">
        ${t.decisao !== "pendente" ? `<span>${t.decisao === "pega" ? "✅ Pega" : "❌ Não pega"} por <b>${esc(nomeDe(t.decidido_por))}</b> · ${fmtQuando(t.decidido_em)}</span>` : `<span>Aguardando decisão</span>`}
        ${t.travada ? `<span>🔒 Travada por <b>${esc(dono)}</b> · ${fmtQuando(t.travada_em)}</span>` : ""}
      </div>
    </article>`;
  }
  const agenteNome = id => { const a = agentes.find(a => a.id === id || a.nome === id); return a ? a.nome : id === "manual" ? "manual" : (id || "agente"); };
  async function aoClicar(e) {
    if (e.target === painel || e.target.closest("[data-fechar]")) return fecharPainel();
    const f = e.target.closest("[data-filtro]"); if (f) { filtro = f.dataset.filtro; return renderPainel(); }
    const m = e.target.closest("[data-modo]"); if (m) { modo = m.dataset.modo; if (modo === "prosp" && Dados.ehAdmin && Dados.ehAdmin()) verificarRespostas(true); const b = painel.querySelector("[data-busca]"); if (b) b.value = ""; const l = painel.querySelector(".tend-lista"); if (l) l.scrollTop = 0; return renderPainel(); }
    const fp = e.target.closest("[data-filtrop]"); if (fp) { filtroP = fp.dataset.filtrop; return renderPainel(); }
    if (e.target.closest("[data-prospectar]")) return prospectar();
    if (e.target.closest("[data-respostas]")) return verificarRespostas(false);
    const vt = e.target.closest("[data-vertarefa]"); if (vt) { fecharPainel(); if (window.abrirTarefaPorId) setTimeout(() => abrirTarefaPorId(vt.dataset.vertarefa), 50); return; }
    const df = e.target.closest("[data-agdesfaz]"); if (df) { delete rascAg[df.dataset.agdesfaz]; return renderPainel(); }
    const pc = e.target.closest("[data-pid]"); if (pc) return acaoProsp(e, pc.dataset.pid);
    if (e.target.closest("[data-rodar]")) return rodarAgentes();
    if (e.target.closest("[data-criaragentes]")) { try { await Dados.agentesSalaCriar(mapaAtual()); opt.toast("🤖 Agentes criados"); } catch (err) { opt.toast(traduz(err)); } return recarregar(); }
    if (e.target.closest("[data-nova]")) { painel.dataset.nova = painel.dataset.nova ? "" : "1"; return renderPainel(); }
    if (e.target.closest("[data-cancelar]")) { painel.dataset.nova = ""; return renderPainel(); }
    const card = e.target.closest("[data-id]"); if (!card) return;
    const id = card.dataset.id;
    try {
      if (e.target.closest("[data-del]")) { if (!confirm("Excluir esta tendência?")) return; await Dados.excluirTendencia(id); }
      else { const b = e.target.closest("[data-acao]"); if (!b) return; b.disabled = true; await Dados.mexerTendencia(id, b.dataset.acao); }
      await recarregar();
    } catch (err) { opt.toast(traduz(err)); recarregar(); }
  }
  async function aoEnviar(e) {
    e.preventDefault();
    if (e.target.dataset.agform) return salvarAgente(e.target);
    const fd = new FormData(e.target);
    try {
      await Dados.criarTendencia({ titulo: fd.get("titulo"), resumo: fd.get("resumo"), categoria: fd.get("categoria"), fonte_url: fd.get("fonte_url"), relevancia: +fd.get("relevancia") || null });
      painel.dataset.nova = ""; await recarregar(); opt.toast("Tendência adicionada");
    } catch (err) { opt.toast(traduz(err)); }
  }
  /* ---------- ações da prospecção e dos agentes ---------- */
  async function salvarAgente(form) {
    const id = form.dataset.agform, fd = new FormData(form), a = agentes.find(x => x.id === id) || {};
    const linhas = t => String(t || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
    const campos = { nome: String(fd.get("nome") || "").trim() || a.nome, tipo: fd.get("tipo"), categoria: String(fd.get("categoria") || "").trim() || null,
      foco: String(fd.get("foco") || "").trim() || null, prompt: String(fd.get("prompt") || "").trim() || null, ativo: !!fd.get("ativo") };
    if (campos.tipo === "prospeccao") {
      const outro = agentes.find(x => x.tipo === "prospeccao" && x.id !== id);
      if (outro) return opt.toast(`📨 ${outro.nome} já é o prospectador. Mude ele para pesquisa antes.`);
      campos.config = { ...(a.config || {}), segmentos: linhas(fd.get("segmentos")), cidades: linhas(fd.get("cidades")), oferta: String(fd.get("oferta") || "").trim(),
        assinatura: String(fd.get("assinatura") || "").trim(), por_rodada: Math.max(1, Math.min(8, +fd.get("por_rodada") || 5)) };
      if (fd.get("segmentos") == null) campos.config = { segmentos: [], cidades: [], por_rodada: 5, ...(a.config || {}) };
    }
    if (!ehNext()) { delete campos.tipo; delete campos.config; }
    try { await (ehNext() ? Dados.salvarAgente(id, campos) : Dados.salvarAgenteSala(id, campos)); delete rascAg[id]; opt.toast(`💾 ${campos.nome} salvo`); await recarregar(); }
    catch (err) { opt.toast("Não consegui salvar: " + ((err && err.message) || "")); }
  }
  // lê a caixa de entrada atrás de respostas (botão, ou sozinho ao abrir a aba, no máximo a cada 10 min)
  let lendoRespostas = false;
  async function verificarRespostas(silencioso) {
    if (lendoRespostas) return;
    try { if (silencioso && Date.now() - (+localStorage.getItem("nextco_respostas_em") || 0) < 10 * 60e3) return; localStorage.setItem("nextco_respostas_em", Date.now()); } catch (e) {}
    lendoRespostas = true; if (!silencioso) renderPainel();
    try {
      const token = Dados.token ? await Dados.token() : null;
      const r = await fetch("/api/respostas", { method: "POST", headers: token ? { Authorization: "Bearer " + token } : {} });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { if (!silencioso) opt.toast("📥 " + (j.erro || "Não consegui ler o e-mail (" + r.status + ")")); }
      else if (j.respostas || j.saiu) { opt.toast(`📥 ${j.respostas} resposta(s) nova(s)` + (j.respostas ? " · viraram tarefa no telão" : "") + (j.saiu ? ` · ${j.saiu} pediu para sair` : "")); if (j.respostas) filtroP = "respondeu"; }
      else if (!silencioso) opt.toast("📥 Nenhuma resposta nova");
    } catch (e) { if (!silencioso) opt.toast("📥 Falha ao ler o e-mail"); }
    lendoRespostas = false; await recarregar(); renderPainel();
  }
  async function prospectar() {
    if (buscando) return; buscando = true; renderPainel();
    try {
      const token = Dados.token ? await Dados.token() : null;
      const r = await fetch("/api/agentes?acao=prospectar", { method: "POST", headers: token ? { Authorization: "Bearer " + token } : {} });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) opt.toast("📨 " + (j.erro || "Não consegui buscar empresas (" + r.status + ")"));
      else { opt.toast(`📨 ${j.novas} e-mail(s) para aprovar` + (j.semEmail ? ` · ${j.semEmail} sem e-mail` : "") + (j.consulta ? ` · ${j.consulta}` : "")); if (j.novas) filtroP = "revisar"; }
    } catch (e) { opt.toast("📨 Falha ao chamar o prospectador"); }
    buscando = false; await recarregar(); renderPainel();
  }
  async function acaoProsp(e, id) {
    const p = (prosp || []).find(x => x.id === id); if (!p) return;
    const card = e.target.closest("[data-pid]"), val = c => { const el = card.querySelector(`[data-campo="${c}"]`); return el ? el.value.trim() : (rascP[id] || {})[c] ?? p[c]; };
    try {
      const st = e.target.closest("[data-pstatus]");
      if (st) { await Dados.mexerProspect(id, { status: st.dataset.pstatus }); delete rascP[id]; return recarregar(); }
      if (e.target.closest("[data-salvarp]")) { await Dados.mexerProspect(id, { email: val("email"), assunto: val("assunto"), corpo: val("corpo") }); delete rascP[id]; opt.toast("💾 Texto salvo"); return recarregar(); }
      if (e.target.closest("[data-addemail]")) {
        const em = (prompt(`E-mail de ${p.empresa}:`) || "").trim().toLowerCase();
        if (!em) return; if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(em)) return opt.toast("E-mail inválido");
        await Dados.mexerProspect(id, { email: em, status: "revisar", corpo: p.corpo || "", assunto: p.assunto || "" }); filtroP = "revisar"; return recarregar();
      }
      const teste = !!e.target.closest("[data-teste]");
      if (!teste && !e.target.closest("[data-enviar]")) return;
      if (enviando) return;
      const email = val("email"), assunto = val("assunto"), corpo = val("corpo");
      if (!teste && !confirm(`Enviar o e-mail para ${email}?`)) return;
      const pro = agentes.find(a => a.tipo === "prospeccao"), assinatura = (pro && pro.config && pro.config.assinatura) || "";
      enviando = id; renderPainel();
      const token = await Dados.token();
      const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ id, email, assunto, corpo, assinatura, teste }) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) opt.toast("✉️ " + (j.erro || "Falhou (" + r.status + ")"));
      else if (teste) opt.toast(`✉️ Teste enviado para ${j.para}`);
      else { delete rascP[id]; opt.toast(`✉️ Enviado para ${j.para} · ${j.hoje}/${j.limite} hoje`); }
    } catch (err) { opt.toast("Não deu certo: " + ((err && err.message) || "")); }
    enviando = null; await recarregar();
  }
  // guarda o que está sendo digitado (a lista atualiza em tempo real)
  document.addEventListener("input", e => {
    if (!painel || !painel.contains(e.target)) return;
    const pc = e.target.closest("[data-pid]"), c = e.target.dataset.campo;
    if (pc && c) { (rascP[pc.dataset.pid] = rascP[pc.dataset.pid] || {})[c] = e.target.value; const sv = pc.querySelector("[data-salvarp]"); if (!sv) { const ac = pc.querySelector(".tc-acoes"); ac && ac.querySelector("[data-teste]").insertAdjacentHTML("afterend", `<button class="btn" data-salvarp>Salvar texto</button>`); } }
    const ag = e.target.closest("[data-agform]");
    if (ag && e.target.name) { const r = rascAg[ag.dataset.agform] = rascAg[ag.dataset.agform] || {}; r[e.target.name] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (e.target.name === "tipo") renderPainel(); }
  });
  document.addEventListener("change", e => { if (painel && e.target.matches("[data-agform] [name=ativo], [data-agform] select")) e.target.dispatchEvent(new Event("input", { bubbles: true })); });

  painelBusca();
  function painelBusca() { document.addEventListener("input", e => { if (painel && e.target.matches("[data-busca]")) { const pos = e.target.selectionStart; renderPainel(); const i = painel.querySelector("[data-busca]"); i.focus(); i.setSelectionRange(pos, pos); } }); }
  const traduz = err => { const m = (err && err.message) || ""; return /travada/.test(m) ? "Travada por outra pessoa" : /destrava/.test(m) ? "Só quem travou (ou um admin) pode destravar" : m || "Não foi possível salvar"; };
  const seguro = u => /^https?:\/\//i.test(u) ? u : "https://" + u.replace(/^[a-z]+:/i, "");
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  // fecha o painel se a pessoa sair da sala de TI
  function atualizar() { if (painel && opt && opt.eu && !dentroDaTI()) { fecharPainel(); opt.toast("Você saiu da TI: o painel de tendências foi fechado"); } }
  function abrirEm(m) { modo = m || "tend"; abrirPainel(); }
  // para os agentes conversarem sobre o trabalho de verdade
  function resumo() {
    return { tend: tend.slice(0, 6).map(t => t.titulo), pega: tend.filter(t => t.decisao === "pega").slice(0, 4).map(t => t.titulo),
      pendentes: tend.filter(t => t.decisao === "pendente").length, enviados: (prosp || []).filter(p => p.status === "enviado").length,
      responderam: (prosp || []).filter(p => p.status === "respondeu").length };
  }
  return { iniciar, desenhaveis, nomes, clicou, abrirPainel, abrirEm, fecharPainel, atualizar, resumo, info: id => agenteInfo(id), get aberto() { return !!painel; } };
})();
