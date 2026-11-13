/* Central de configurações: tudo o que antes ficava espalhado no menu do personagem, em abas.
   Geral (conta e aparência) · Sala (nome, modo, convite, mapa) · Administração (gestor, pessoas, removidos)
   · IA e agentes (preenchida por window.IAConfig quando existir). Configuracoes.abrir("sala") abre direto numa aba. */
window.Configuracoes = (function () {
  let opt = null, modal = null, aba = "geral";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const corNome = n => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},55%,48%)`; };
  const iniciais = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const MODOS = { "2d": "Só 2D", "3d": "Só 3D", ambos: "2D e 3D" };

  function abrir(qual) {
    if (qual) aba = qual;
    if (!modal) {
      modal = document.createElement("div"); modal.className = "soc-modal cfg-modal"; document.body.appendChild(modal);
      modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-cfechar]")) fechar(); else clique(e); });
      modal.addEventListener("submit", e => { e.preventDefault(); enviar(e.target); });
      addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("on")) fechar(); });
    }
    opt.aoAbrir && opt.aoAbrir();
    desenhar(); modal.classList.add("on");
  }
  function fechar() { if (modal) modal.classList.remove("on"); }
  const abas = () => [["geral", "👤 Geral"], ["sala", "🏢 Sala"], ...(opt.souDono() ? [["admin", "🛡️ Administração"], ["ia", "🤖 IA e agentes"]] : [])];

  async function desenhar() {
    if (!abas().some(a => a[0] === aba)) aba = "geral";
    const corpo = aba === "geral" ? geral() : aba === "sala" ? sala() : aba === "admin" ? await admin() : await ia();
    modal.innerHTML = `<div class="sm-win cfg-win">
      <div class="sm-h"><b>⚙️ Configurações</b><button data-cfechar class="sc-x" aria-label="Fechar">×</button></div>
      <div class="cfg-grade"><nav class="cfg-nav">${abas().map(([k, l]) => `<button data-caba="${k}" class="${aba === k ? "on" : ""}">${l}</button>`).join("")}</nav>
      <div class="cfg-corpo">${corpo}</div></div></div>`;
  }
  const bloco = (titulo, html, desc) => `<section class="cfg-b"><h4>${titulo}</h4>${desc ? `<p class="cfg-d">${desc}</p>` : ""}${html}</section>`;
  const linha = (rot, html) => `<div class="cfg-l"><span>${rot}</span><div>${html}</div></div>`;

  /* ---------- Geral ---------- */
  function geral() {
    const u = opt.user(), n = "Notification" in window ? Notification.permission : "indisponível";
    const st = window.Social ? Social.status : "disponivel";
    return bloco("Você", `<div class="cfg-eu"><span class="av" style="background:${corNome(u.nome)}">${esc(iniciais(u.nome))}</span><div><b>${esc(u.nome)}</b><small>${esc(u.email)}</small></div>
          <a class="btn" href="avatar.html">🧍 Editar personagem</a></div>`)
      + bloco("Status e avisos",
        linha("Status", `<select data-cstatus>${Object.entries(window.Social ? Social.STATUS : {}).map(([k, s]) => `<option value="${k}" ${k === st ? "selected" : ""}>${s.nome}</option>`).join("")}</select>`)
        + linha("Notificações do navegador", n === "granted" ? "✅ Ligadas" : n === "denied" ? "🚫 Bloqueadas no navegador (libere no cadeado da barra de endereço)" : n === "indisponível" ? "Este navegador não tem" : `<button class="btn" data-cnotif>Ligar notificações</button>`))
      + bloco("Áudio", linha("Microfone, saída e volumes", `<button class="btn" data-caudio>🎚️ Abrir ajustes de áudio</button>`))
      + bloco("Visual",
        (opt.modoSala() === "ambos" ? linha("Modo", `<div class="cfg-seg">${[["2d", "2D"], ["3d", "3D"]].map(([k, l]) => `<button data-cmodo="${k}" class="${(opt.em3d() ? "3d" : "2d") === k ? "on" : ""}">${l}</button>`).join("")}</div>`) : linha("Modo", MODOS[opt.modoSala()] + " (definido pela sala)"))
        + (opt.modoSala() !== "2d" ? linha("Câmera no 3D", `<div class="cfg-seg">${[["1p", "Primeira pessoa"], ["iso", "Visão de cima"]].map(([k, l]) => `<button data-cvista="${k}" class="${(window.Iso3D ? Iso3D.vista : "1p") === k ? "on" : ""}">${l}</button>`).join("")}</div>`) : ""))
      + bloco("Senha", `<form class="cfg-form" data-cform="senha"><label>Nova senha<input name="s1" type="password" minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres" required></label>
          <label>Repita a senha<input name="s2" type="password" minlength="8" autocomplete="new-password" required></label><div class="cfg-acoes"><button class="btn pri">🔑 Salvar senha</button></div></form>`,
        "Com uma senha você entra com e-mail e senha, sem esperar o link por e-mail. Serve para criar a primeira senha ou trocar a atual.")
      + bloco("Seus dados", linha("Tempo nesta sala", `<button class="btn" data-ctempo>📊 Meu tempo</button>`) + linha("Tutorial", `<button class="btn" data-ctour>🧭 Ver o tutorial de novo</button>`) + linha("Minimapa", `<button class="btn" data-cmapa>🗺️ ${window.Minimapa && Minimapa.ligado ? "Esconder" : "Mostrar"} (tecla M)</button>`) + linha("Exportar", `<button class="btn" data-cexp>💾 Baixar meus dados (JSON)</button>`) + linha("Conta", `<button class="btn dan" data-csair>🚪 Sair da conta</button>`));
  }

  /* ---------- Sala ---------- */
  function sala() {
    const i = opt.info(), dono = opt.souDono() && !opt.ehNext;
    return bloco("Esta sala virtual", `<div class="sala-info"><div><b>${esc(i.nome)}</b><small>ID da sala: <code>${esc(opt.idPublico())}</code> · ${MODOS[opt.modoSala()]}</small></div><button class="btn" data-cconvite>Copiar convite</button></div>`
        + linha("Outras salas", `<a class="btn" href="salas.html">🔁 Trocar de sala / criar sala</a>`))
      + (dono ? bloco("Nome e modo", `<form class="cfg-form" data-cform="sala">
            <label>Nome<input name="nome" maxlength="40" value="${esc(i.nome)}" required></label>
            <div class="cfg-modos">${[["2d", "2D", "Visão de cima"], ["3d", "3D", "Primeira pessoa"], ["ambos", "2D e 3D", "Cada um escolhe"]].map(([v, t, d]) =>
              `<label><input type="radio" name="modo" value="${v}" ${opt.modoSala() === v ? "checked" : ""}><b>${t}</b><small>${d}</small></label>`).join("")}</div>
            <button class="btn pri">Salvar</button></form>`, "O modo vale para todo mundo que entrar nesta sala.") : "")
      + (opt.souDono() ? bloco("Logo da sala", `<div class="cfg-logo"><div class="cfg-logo-prev">${opt.logo && opt.logo() ? `<img src="${opt.logo()}" alt="Logo atual">` : "<small>Logo padrão</small>"}</div>
            <div class="cfg-acoes"><label class="btn pri">🖼️ Enviar imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-clogo hidden></label>
            ${opt.logo && opt.logo() ? `<button type="button" class="btn dan" data-clogotira>Voltar ao padrão</button>` : ""}</div></div>`,
          "A imagem aparece em todos os itens “Logo” das salas, no 2D e no 3D. Use PNG com fundo transparente para ficar melhor.") : "")
      + bloco("Mapa e telões",
        (opt.ehNext || opt.souDono() ? linha("Salas, móveis e portas", `<a class="btn" href="editor.html?sala=${encodeURIComponent(opt.mapaId)}">🛠️ Abrir o editor do mapa</a>`) : "")
        + linha("Tarefas da equipe", `<button class="btn" data-ctelao>📋 Telão da equipe</button>`)
        + (opt.ehNext ? linha("Sala de Pesquisa", `<button class="btn" data-ctend>📈 Tendências e prospecção</button>`) + linha("Sala de Edição", `<button class="btn" data-cedicao>🎬 Roteiros e vídeos</button>`) : ""));
  }

  /* ---------- Administração ---------- */
  async function admin() {
    const i = opt.info(), usuarios = window.Social ? Social.usuarios : [], nome = id => (usuarios.find(u => u.id === id) || {}).nome || "Alguém";
    const online = opt.outros();
    return bloco("Equipe", linha("Presença e relatório da semana", `<button class="btn" data-cgestor>📈 Painel do gestor</button>`)
        + (opt.ehAdminGeral() ? linha("Salas com senha, acesso e papéis", `<button class="btn" data-cacesso>🛡️ Regras de acesso</button>`) : ""))
      + bloco(`Pessoas na sala agora (${online.length})`, online.length ? `<div class="cfg-pessoas">${online.map(o => `<div class="cfg-p"><span class="av" style="background:${corNome(o.nome)}">${esc(iniciais(o.nome))}</span><b>${esc(o.nome)}</b>
          ${o.proj || o.tela ? `<button class="btn" data-cparar="${esc(o.id)}">⛔ Encerrar projeção</button>` : ""}<button class="btn dan" data-cremover="${esc(o.id)}">🚪 Remover</button></div>`).join("")}</div>` : `<p class="cfg-d">Só você por aqui.</p>`,
        "Remover tira a pessoa na hora e impede que ela entre de novo até você readmitir.")
      + blocoDatas(i)
      + bloco("Removidos", (i.banidos || []).length ? `<div class="cfg-pessoas">${i.banidos.map(id => `<div class="cfg-p"><span class="av" style="background:${corNome(nome(id))}">${esc(iniciais(nome(id)))}</span><b>${esc(nome(id))}</b><button class="btn" data-creadmitir="${esc(id)}">Readmitir</button></div>`).join("")}</div>` : `<p class="cfg-d">Ninguém foi removido desta sala.</p>`);
  }

  /* datas comemorativas do ano: o admin liga cada uma e escolhe as salas que se enfeitam */
  function blocoDatas(i) {
    if (!window.Decoracao) return "";
    const datas = i.datas || {}, salas = (opt.salas ? opt.salas() : []).filter(r => r.type !== "corredor");
    const linhas = Object.entries(Decoracao.ANUAIS).map(([id, d]) => {
      const c = datas[id] || {}, sel = new Set(c.salas || []), tema = Decoracao.TEMAS[d.tema];
      return `<div class="cfg-data ${c.ativo ? "on" : ""}">
        <label class="cfg-data-h"><input type="checkbox" name="ativo_${id}" ${c.ativo ? "checked" : ""}><b>${esc(tema ? tema.nome : d.nome)}</b><small>${esc(Decoracao.periodoTexto(id))}</small></label>
        <div class="cfg-data-salas"><label class="chip"><input type="checkbox" name="sala_${id}" value="*" ${sel.has("*") ? "checked" : ""}>Todas as salas</label>
          ${salas.map(r => `<label class="chip"><input type="checkbox" name="sala_${id}" value="${esc(r.id)}" ${sel.has(r.id) ? "checked" : ""}>${esc(r.name)}</label>`).join("")}</div></div>`;
    }).join("");
    return bloco("Datas comemorativas", `<form class="cfg-form" data-cform="datas">${linhas}<div class="cfg-acoes"><button class="btn pri">Salvar datas</button></div></form>`,
      "Ligue as datas e escolha as salas: todo ano, nesses dias, elas se enfeitam sozinhas no 2D e no 3D (sem mexer no mapa). Uma sala com evento decorado na agenda usa a decoração do evento.");
  }

  /* ---------- IA e agentes ---------- */
  async function ia() {
    if (window.IAConfig) return IAConfig.html(opt);
    return bloco("IA e agentes", `<p class="cfg-d">Em breve.</p>`);
  }

  async function clique(e) {
    const t = e.target.closest("button,a"); if (!t) return;
    const d = t.dataset;
    if (d.caba) { aba = d.caba; return desenhar(); }
    if ("cnotif" in d) { try { await Notification.requestPermission(); } catch (er) {} return desenhar(); }
    if ("caudio" in d) { fechar(); return opt.abrirAudio(); }
    if (d.cmodo) { if ((opt.em3d() ? "3d" : "2d") !== d.cmodo) opt.alternar3d(); setTimeout(desenhar, 300); return; }
    if (d.cvista) { if (window.Iso3D && Iso3D.vista !== d.cvista) opt.trocarVista(); if (!opt.em3d() && opt.modoSala() !== "2d") opt.alternar3d(); setTimeout(desenhar, 300); return; }
    if ("ctempo" in d) { fechar(); return Gestor.abrirMeuTempo(); }
    if ("ctour" in d) { fechar(); return window.Tour && Tour.iniciar(null, true); }
    if ("cmapa" in d) { const on = window.Minimapa && Minimapa.alternar(); t.textContent = `🗺️ ${on ? "Esconder" : "Mostrar"} (tecla M)`; return; }
    if ("cexp" in d) return opt.exportar();
    if ("csair" in d) return opt.sair();
    if ("clogotira" in d) { if (!d.ok) { d.ok = 1; t.textContent = "Confirmar"; return; } try { await opt.salvarLogo(null); opt.toast("Logo padrão de volta"); desenhar(); } catch (er) { opt.toast("Não consegui: " + (er.message || "")); } return; }
    if ("cconvite" in d) { const link = location.origin + location.pathname + "?sala=" + opt.idPublico();
      await navigator.clipboard.writeText(`Entre na sala "${opt.info().nome}": ${link}  (ID: ${opt.idPublico()})`); t.textContent = "Copiado ✓"; setTimeout(() => t.textContent = "Copiar convite", 1500); return; }
    if ("ctelao" in d) { fechar(); return opt.abrirTelao(); }
    if ("ctend" in d) { fechar(); return TI.abrirPainel(); }
    if ("cedicao" in d) { fechar(); return Edicao.abrirPainel(); }
    if ("cgestor" in d) { fechar(); return Gestor.abrirPainel(); }
    if ("cacesso" in d) { fechar(); return Acesso.abrirAdmin(); }
    if (d.cparar) { const o = opt.outros().find(x => x.id === d.cparar); if (o) opt.acaoAdmin(o, "parar_proj"); return; }
    if (d.cremover) {
      if (!d.ok) { d.ok = 1; t.textContent = "Confirmar remoção"; return; }
      const o = opt.outros().find(x => x.id === d.cremover); if (o) await opt.acaoAdmin(o, "expulsar"); return desenhar();
    }
    if (d.creadmitir) { await opt.readmitir(d.creadmitir); opt.toast("Pessoa readmitida"); return desenhar(); }
    if (window.IAConfig && IAConfig.clique) { const r = await IAConfig.clique(e, opt); if (r) desenhar(); }
  }
  async function enviar(f) {
    if (f.dataset.cform === "senha") {
      const s1 = f.s1.value, s2 = f.s2.value;
      if (s1.length < 8) return opt.toast("A senha precisa de pelo menos 8 caracteres");
      if (s1 !== s2) return opt.toast("As duas senhas não são iguais");
      try { await Dados.definirSenha(s1); f.reset(); opt.toast("🔑 Senha salva. Da próxima vez, entre com e-mail e senha."); } catch (er) { opt.toast("Não consegui salvar a senha: " + (er.message || "")); }
      return;
    }
    if (f.dataset.cform === "datas") {
      const fd = new FormData(f), datas = {};
      for (const id of Object.keys(Decoracao.ANUAIS)) { const salas = fd.getAll("sala_" + id); datas[id] = { ativo: fd.has("ativo_" + id), salas: salas.includes("*") ? ["*"] : salas }; }
      const sem = Object.entries(datas).filter(([, d]) => d.ativo && !d.salas.length).map(([id]) => Decoracao.ANUAIS[id].nome);
      if (sem.length) return opt.toast(`Escolha pelo menos uma sala para: ${sem.join(", ")}`);
      try { await opt.salvarDatas(datas); opt.toast("🎉 Datas comemorativas salvas"); desenhar(); } catch (er) { opt.toast("Não consegui salvar: " + (er.message || "")); }
      return;
    }
    if (f.dataset.cform === "sala") {
      const fd = new FormData(f), nome = String(fd.get("nome") || "").trim(), modo = fd.get("modo");
      if (!nome) return;
      try { await opt.salvarSala(nome, modo); opt.toast("⚙️ Sala atualizada"); desenhar(); } catch (er) { opt.toast("Não consegui salvar: " + (er.message || "")); }
      return;
    }
    if (window.IAConfig && IAConfig.enviar) { const r = await IAConfig.enviar(f, opt); if (r) desenhar(); }
  }
  // Logo da sala: arquivo escolhido
  document.addEventListener("change", async e => {
    if (!e.target.matches("[data-clogo]")) return;
    const arq = e.target.files && e.target.files[0]; if (!arq) return;
    try { const url = await Decoracao.prepararLogo(arq); await opt.salvarLogo(url); opt.toast("🖼️ Logo atualizado em todas as salas"); desenhar(); }
    catch (er) { opt.toast(er.message || "Não consegui enviar a imagem"); }
  });
  // Mudou de status por aqui
  document.addEventListener("change", e => { if (e.target.matches("[data-cstatus]") && window.Social) { Social.mudarStatus(e.target.value); opt.toast("Status: " + Social.STATUS[e.target.value].nome); } });

  function iniciar(o) { opt = o; }
  return { iniciar, abrir, fechar, get aberto() { return !!(modal && modal.classList.contains("on")); } };
})();
