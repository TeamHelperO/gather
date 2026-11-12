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
  const cores = [["#2f6fd8", "#1d4a99"], ["#7b4fd8", "#52309a"], ["#1f9e6e", "#13704d"], ["#d8682f", "#9a4419"], ["#c23a5a", "#86223c"]];
  cores.forEach(([c1, c2], i) => {
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
  const fmtQuando = d => { const dt = new Date(d), min = Math.round((Date.now() - dt) / 60000); return min < 1 ? "agora" : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : dt.toLocaleDateString("pt-BR"); };
  const nomeDe = id => (id && pessoas[id]) || "alguém";
  const meuId = () => Dados.meuId();

  async function iniciar(o) {
    opt = o;
    await recarregar();
    Dados.ouvirTendencias(recarregar); Dados.ouvirAgentes(recarregar);
    setInterval(recarregar, 60000);
  }
  async function recarregar() {
    const [t, a, u] = await Promise.all([Dados.listarTendencias(150), Dados.listarAgentes(), Dados.listarUsuarios()]);
    tend = t; agentes = a; pessoas = Object.fromEntries(u.map(p => [p.id, p.nome]));
    if (painel) renderPainel();
  }
  const agenteInfo = id => agentes.find(a => a.id === id) || { id, nome: id, status: "parado" };
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
  function fecharPainel() { if (!painel) return; painel.remove(); painel = null; removeEventListener("keydown", escFechar); }
  function escFechar(e) { if (e.key === "Escape") fecharPainel(); }
  function renderPainel() {
    if (!painel) return;
    const adm = Dados.ehAdmin(), eu = meuId();
    const cont = { pendente: 0, pega: 0, nao_pega: 0 }; tend.forEach(t => cont[t.decisao]++);
    const busca = (painel.querySelector("[data-busca]") || {}).value || "";
    const lista = tend.filter(t => (filtro === "todas" || t.decisao === filtro) && (!busca || (t.titulo + " " + (t.resumo || "") + " " + (t.categoria || "")).toLowerCase().includes(busca.toLowerCase())));
    const win = painel.querySelector(".tend-win"), rolagem = (win.querySelector(".tend-lista") || {}).scrollTop || 0;
    win.innerHTML = `
      <div class="tend-top"><b>📈 Tendências de mercado</b>
        <div class="tend-agentes">${agentes.map(a => `<span class="ag ${online(a) ? "on" : ""}" title="${esc(a.detalhe || "")}">🤖 ${esc(a.nome)} <small>${online(a) ? esc(a.status) : "parado"}</small></span>`).join("")}</div>
        <button class="tend-x" data-fechar aria-label="Fechar">✕</button></div>
      <div class="tend-barra">
        ${[["pendente", "🆕 Para avaliar"], ["pega", "✅ Pega"], ["nao_pega", "❌ Não pega"], ["todas", "Todas"]].map(([k, l]) => `<button class="tab ${filtro === k ? "on" : ""}" data-filtro="${k}">${l}${k !== "todas" ? ` <i>${cont[k]}</i>` : ""}</button>`).join("")}
        <input data-busca placeholder="Buscar…" value="${esc(busca)}">
        ${adm ? `<button class="btn pri" data-nova>＋ Nova</button>` : ""}
      </div>
      ${adm && painel.dataset.nova ? `<form class="tend-form" data-form>
        <input name="titulo" placeholder="Título da tendência" required maxlength="200">
        <textarea name="resumo" placeholder="Resumo (o que é e por que importa)" rows="2"></textarea>
        <div class="row2"><input name="categoria" placeholder="Categoria (ex.: IA, Social, Ads)"><input name="fonte_url" placeholder="Link da fonte (opcional)">
        <select name="relevancia"><option value="">Relevância</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select>
        <button class="btn pri">Salvar</button><button type="button" class="btn" data-cancelar>Cancelar</button></div></form>` : ""}
      <div class="tend-lista">${lista.length ? lista.map(t => cartao(t, eu, adm)).join("") : `<p class="tend-vazio">${tend.length ? "Nada neste filtro." : "Ainda não há tendências. Assim que os agentes publicarem, elas aparecem aqui em tempo real."}</p>`}</div>`;
    const l = win.querySelector(".tend-lista"); if (l) l.scrollTop = rolagem;
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
    const fd = new FormData(e.target);
    try {
      await Dados.criarTendencia({ titulo: fd.get("titulo"), resumo: fd.get("resumo"), categoria: fd.get("categoria"), fonte_url: fd.get("fonte_url"), relevancia: +fd.get("relevancia") || null });
      painel.dataset.nova = ""; await recarregar(); opt.toast("Tendência adicionada");
    } catch (err) { opt.toast(traduz(err)); }
  }
  painelBusca();
  function painelBusca() { document.addEventListener("input", e => { if (painel && e.target.matches("[data-busca]")) { const pos = e.target.selectionStart; renderPainel(); const i = painel.querySelector("[data-busca]"); i.focus(); i.setSelectionRange(pos, pos); } }); }
  const traduz = err => { const m = (err && err.message) || ""; return /travada/.test(m) ? "Travada por outra pessoa" : /destrava/.test(m) ? "Só quem travou (ou um admin) pode destravar" : m || "Não foi possível salvar"; };
  const seguro = u => /^https?:\/\//i.test(u) ? u : "https://" + u.replace(/^[a-z]+:/i, "");
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  // fecha o painel se a pessoa sair da sala de TI
  function atualizar() { if (painel && opt && opt.eu && !dentroDaTI()) { fecharPainel(); opt.toast("Você saiu da TI: o painel de tendências foi fechado"); } }
  return { iniciar, desenhaveis, nomes, clicou, abrirPainel, fecharPainel, atualizar, get aberto() { return !!painel; } };
})();
