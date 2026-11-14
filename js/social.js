/* Convivência no escritório: status, chat (sala, geral e direto), cartão da pessoa (ir até, chamar,
   mensagem), notificações do navegador, agenda de reuniões e avisos (menções, convites, tarefas).
   Usa Dados (Supabase) e Sala (canal do escritório). Iniciar com Social.iniciar({...}) depois de entrar na sala. */
window.Social = (function () {
  let opt = null, usuarios = [], semTabela = false;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const iniciais = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const corNome = n => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},55%,48%)`; };
  const hora = d => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = d => { const x = new Date(d), h = new Date(); const ds = (a, b) => a.toDateString() === b.toDateString();
    if (ds(x, h)) return "Hoje"; const am = new Date(h); am.setDate(h.getDate() + 1); if (ds(x, am)) return "Amanhã";
    const on = new Date(h); on.setDate(h.getDate() - 1); if (ds(x, on)) return "Ontem";
    return x.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }); };
  const usuario = id => usuarios.find(u => u.id === id) || null;
  const nomeDe = id => (usuario(id) || {}).nome || "Alguém";

  /* ================= STATUS ================= */
  const STATUS = { disponivel: { nome: "Disponível", cor: "#3fbf5f" }, ocupado: { nome: "Ocupado", cor: "#e5484d" }, reuniao: { nome: "Em reunião", cor: "#f2a33a" }, ausente: { nome: "Ausente", cor: "#9aa0ad" } };
  let status = ls.get("nextco_status", "disponivel"), autoAusente = false, ultimaAcao = Date.now();
  if (status === "ausente") status = "disponivel"; // ao entrar, volta a disponível
  const AUSENTE_MIN = 10;
  function mudarStatus(s, auto) {
    if (!STATUS[s]) return;
    status = s; autoAusente = !!auto;
    if (!auto) ls.set("nextco_status", s);
    opt && opt.presencaMudou && opt.presencaMudou();
    desenharTopo();
  }
  function atividade() {
    ultimaAcao = Date.now();
    if (autoAusente) { mudarStatus(ls.get("nextco_status", "disponivel") === "ausente" ? "disponivel" : ls.get("nextco_status", "disponivel")); opt.toast("👋 Bem-vindo de volta" + (opt.micMudo && opt.micMudo() ? " · seu microfone continua mudo" : "")); }
  }
  function checarAusencia() {
    if (status === "ausente" || autoAusente) return;
    if (Date.now() - ultimaAcao > AUSENTE_MIN * 60e3) {
      mudarStatus("ausente", true);
      if (opt.mutar) opt.mutar();
    }
  }

  /* ================= NOTIFICAÇÕES ================= */
  function pedirPermissao() {
    if (!("Notification" in window) || Notification.permission !== "default" || ls.get("nextco_notif_pedido", false)) return;
    ls.set("nextco_notif_pedido", true);
    try { Notification.requestPermission(); } catch (e) {}
  }
  function notificar(titulo, corpo, aoClicar, sempre) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (!sempre && !document.hidden) return;
    try { const n = new Notification(titulo, { body: corpo, icon: "assets/favicon.png", tag: titulo + corpo.slice(0, 20) }); n.onclick = () => { window.focus(); n.close(); aoClicar && aoClicar(); }; } catch (e) {}
  }
  let ctxSom = null;
  function som(tipo) {
    try {
      ctxSom = ctxSom || new (window.AudioContext || window.webkitAudioContext)();
      const notas = tipo === "toque" ? [880, 1175, 880, 1175] : tipo === "reuniao" ? [660, 880, 1046] : [880, 1320];
      notas.forEach((f, i) => { const o = ctxSom.createOscillator(), g = ctxSom.createGain(); o.type = "sine"; o.frequency.value = f;
        const t0 = ctxSom.currentTime + i * 0.16; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        o.connect(g).connect(ctxSom.destination); o.start(t0); o.stop(t0 + 0.16); });
    } catch (e) {}
  }

  /* ================= MENÇÕES ================= */
  function acharMencoes(texto) {
    const t = " " + String(texto || "").toLowerCase();
    return usuarios.filter(u => { const n = String(u.nome || "").toLowerCase().trim(); if (!n) return false;
      return t.includes("@" + n) || t.includes("@" + n.split(/\s+/)[0]); });
  }
  const realcar = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/@([\wÀ-ÿ]+)/g, '<b class="men">@$1</b>');

  /* ================= TOPO: status, chat, agenda, avisos ================= */
  let topo = null;
  function montarTopo() {
    topo = document.createElement("div"); topo.className = "soc-topo";
    topo.innerHTML = `<button class="pill hud soc-st" data-st title="Seu status"></button>
      <button class="pill hud soc-ic" data-chat title="Chat (C)"><span class="soc-ico"></span><i class="bdg"></i></button>
      <button class="pill hud soc-ic" data-agenda title="Agenda de reuniões"><span class="soc-ico"></span><i class="bdg"></i></button>
      <button class="pill hud soc-ic" data-avisos title="Avisos"><span class="soc-ico"></span><i class="bdg"></i></button>`;
    const eu = document.getElementById("eu"); eu.parentNode.insertBefore(topo, eu);
    const icone = (sel, nome) => { const el = topo.querySelector(sel + " .soc-ico"); el.innerHTML = window.ICONE ? ICONE(nome, 18) : ""; };
    icone("[data-chat]", "message-circle"); icone("[data-agenda]", "calendar"); icone("[data-avisos]", "bell");
    topo.addEventListener("click", e => {
      pedirPermissao();
      if (e.target.closest("[data-st]")) return menuStatus(e.target.closest("[data-st]"));
      if (e.target.closest("[data-chat]")) return chat.aberto ? fecharChat() : abrirChat();
      if (e.target.closest("[data-agenda]")) return abrirAgenda();
      if (e.target.closest("[data-avisos]")) return abrirAvisos();
    });
    desenharTopo();
  }
  function desenharTopo() {
    if (!topo) return;
    const st = STATUS[status];
    topo.querySelector("[data-st]").innerHTML = `<i class="dot" style="background:${st.cor}"></i><span>${st.nome}</span>`;
    const b = (sel, n) => { const el = topo.querySelector(sel + " .bdg"); el.textContent = n > 99 ? "99+" : n || ""; el.style.display = n ? "" : "none"; };
    b("[data-chat]", naoLidasTotal()); b("[data-agenda]", proximasMinhas().filter(r => new Date(r.inicio) - Date.now() < 24 * 3600e3).length); b("[data-avisos]", avisos.filter(a => !a.lido).length);
  }
  function menuStatus(bt) {
    fecharPop();
    const r = bt.getBoundingClientRect();
    const pop = abrirPop(r.left, r.bottom + 6, `<div class="soc-menu">${Object.entries(STATUS).map(([k, s]) =>
      `<button data-set="${k}" class="${status === k ? "on" : ""}"><i class="dot" style="background:${s.cor}"></i>${s.nome}</button>`).join("")}
      <p>Fica "Ausente" sozinho depois de ${AUSENTE_MIN} min parado (e o microfone é mutado).</p></div>`);
    pop.onclick = e => { const b = e.target.closest("[data-set]"); if (b) { mudarStatus(b.dataset.set); fecharPop(); opt.toast(`Status: ${STATUS[b.dataset.set].nome}`); } };
  }

  /* ================= POPOVER (cartão da pessoa, menus) ================= */
  let pop = null;
  function abrirPop(x, y, html) {
    fecharPop();
    pop = document.createElement("div"); pop.className = "soc-pop"; pop.innerHTML = html; document.body.appendChild(pop);
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + "px"; pop.style.top = Math.max(8, Math.min(innerHeight - h - 8, y)) + "px";
    setTimeout(() => addEventListener("pointerdown", foraPop, true), 0);
    return pop;
  }
  function foraPop(e) { if (pop && !pop.contains(e.target)) fecharPop(); }
  function fecharPop() { if (pop) { pop.remove(); pop = null; } removeEventListener("pointerdown", foraPop, true); }

  function cartao(a, x, y) {
    const st = STATUS[a.status] || STATUS.disponivel;
    const p = abrirPop(x + 10, y - 20, `<div class="soc-card">
      <div class="sc-top"><span class="av" style="background:${corNome(a.nome)}">${esc(iniciais(a.nome))}</span>
        <div><b>${esc(a.nome)}</b><small><i class="dot" style="background:${st.cor}"></i>${st.nome}${a.sala ? " · " + esc(a.sala) : ""}</small></div></div>
      <div class="sc-acoes">
        <button data-a="ir">🚶 Ir até</button><button data-a="chamar">🔔 Chamar</button>
        <button data-a="msg">💬 Mensagem</button><button data-a="vol">🎚️ Volume</button>
        ${a.tela ? `<button data-a="tela" class="full">🖥️ Ver a tela compartilhada</button>` : ""}
      </div>
      ${opt.souAdmin && opt.souAdmin() ? `<div class="sc-adm"><small>Administrador da sala</small>
        ${a.proj || a.tela ? `<button data-a="parar_proj">⛔ Encerrar a projeção</button>` : ""}
        <button data-a="expulsar" class="dan">🚪 Remover da sala</button></div>` : ""}</div>`);
    p.onclick = e => {
      const b = e.target.closest("[data-a]"); if (!b) return; fecharPop();
      const ac = b.dataset.a;
      if (ac === "ir") { opt.irAte(a); opt.toast(`Indo até ${a.nome}…`); }
      if (ac === "chamar") chamar(a);
      if (ac === "msg") abrirChat(Dados.canalDM(a.id));
      if (ac === "vol") opt.abrirVolume(a.id);
      if (ac === "tela") opt.verTela(a);
      if (ac === "parar_proj") opt.acaoAdmin(a, "parar_proj");
      if (ac === "expulsar") {
        const p2 = abrirPop(x + 10, y - 20, `<div class="soc-card"><b>Remover ${esc(a.nome)} da sala?</b><p style="color:var(--mut);font-size:13px;margin:6px 0 10px">A pessoa sai na hora e não consegue entrar de novo até você readmitir em Configurações → Administração.</p>
          <div class="sc-acoes"><button data-c="sim" class="dan">Remover</button><button data-c="nao">Cancelar</button></div></div>`);
        p2.onclick = ev => { const c = ev.target.closest("[data-c]"); if (!c) return; fecharPop(); if (c.dataset.c === "sim") opt.acaoAdmin(a, "expulsar"); };
      }
    };
  }

  /* ================= CHAMAR (toque) ================= */
  const ultimosToques = {};
  function chamar(a) {
    if (Date.now() - (ultimosToques[a.id] || 0) < 8000) return opt.toast("Espere um pouco antes de chamar de novo");
    ultimosToques[a.id] = Date.now();
    const eu = opt.eu();
    Sala.toque && Sala.toque(a.id, { tipo: "chamar", nome: eu.nome, sala: opt.nomeSalaAtual() || "" });
    opt.toast(a.status === "ocupado" ? `🔔 ${a.nome} está ocupado, mas recebeu o seu toque` : a.status === "ausente" ? `🔔 ${a.nome} está ausente — o toque fica na tela dele` : `🔔 Chamando ${a.nome}…`);
  }
  let caixaToque = null;
  function recebeuToque(msg) {
    if (msg.tipo === "resposta") return opt.toast(msg.resposta === "indo" ? `🚶 ${msg.nome} está indo até você` : `🙅 ${msg.nome}: agora não`);
    if (msg.tipo !== "chamar") return;
    som("toque");
    notificar(`${msg.nome} está te chamando`, msg.sala ? `Em ${msg.sala}` : "No escritório virtual", null, true);
    if (caixaToque) caixaToque.remove();
    caixaToque = document.createElement("div"); caixaToque.className = "soc-toque";
    caixaToque.innerHTML = `<div class="tq-ic">🔔</div><div class="tq-tx"><b>${esc(msg.nome)}</b> está te chamando${msg.sala ? ` em <b>${esc(msg.sala)}</b>` : ""}</div>
      <div class="tq-ac"><button class="btn pri" data-r="indo">Ir até</button><button class="btn" data-r="msg">Mensagem</button><button class="btn" data-r="nao">Agora não</button></div>`;
    document.body.appendChild(caixaToque);
    const fechar = () => { if (caixaToque) { caixaToque.remove(); caixaToque = null; } };
    const timer = setTimeout(fechar, 30000);
    caixaToque.onclick = e => {
      const b = e.target.closest("[data-r]"); if (!b) return; clearTimeout(timer); fechar();
      const r = b.dataset.r, quem = opt.outros().find(o => o.id === msg.from);
      if (r === "indo") { if (quem) opt.irAte(quem); Sala.toque(msg.from, { tipo: "resposta", resposta: "indo", nome: opt.eu().nome }); }
      if (r === "nao") Sala.toque(msg.from, { tipo: "resposta", resposta: "nao", nome: opt.eu().nome });
      if (r === "msg") abrirChat(Dados.canalDM(msg.from));
    };
  }

  /* ================= CHAT ================= */
  const chat = { aberto: false, canal: null, mensagens: {}, painel: null, carregados: new Set() };
  let lidoAte = ls.get("nextco_chat_lido_" + (window.mapaId || ""), {});
  const naoLidas = {}; // canal → número
  const canalSala = () => { const r = opt.salaAtual(); return r ? "sala:" + r.id : null; };
  const nomeCanal = c => c === "geral" ? "Geral" : c.startsWith("sala:") ? ((opt.salas().find(r => "sala:" + r.id === c) || {}).name || "Sala") : nomeDe(c.split(":").slice(1).find(id => id !== Dados.meuId()));
  const relevante = c => c === "geral" || c === canalSala() || (c.startsWith("dm:") && c.includes(Dados.meuId()));
  function naoLidasTotal() { let n = 0; for (const [c, v] of Object.entries(naoLidas)) if (relevante(c)) n += v; return n; }
  function marcarLido(c) { lidoAte[c] = new Date().toISOString(); naoLidas[c] = 0; ls.set("nextco_chat_lido_" + opt.mapaId, lidoAte); desenharTopo(); }

  async function carregarDMs() {
    const l = await Dados.listarDMs(opt.mapaId); if (l == null) { semTabela = true; return; }
    for (const m of l.slice().reverse()) {
      (chat.mensagens[m.canal] = chat.mensagens[m.canal] || []).push(m);
      if (m.autor !== Dados.meuId() && (!lidoAte[m.canal] || m.criado_em > lidoAte[m.canal])) naoLidas[m.canal] = (naoLidas[m.canal] || 0) + 1;
    }
    desenharTopo();
  }
  async function carregarCanal(c) {
    if (chat.carregados.has(c)) return;
    const l = await Dados.listarMensagens(opt.mapaId, c); if (l == null) { semTabela = true; return; }
    chat.carregados.add(c);
    const ja = new Set((chat.mensagens[c] || []).map(m => m.id));
    chat.mensagens[c] = l.concat((chat.mensagens[c] || []).filter(m => !l.some(x => x.id === m.id))).sort((a, b) => a.criado_em < b.criado_em ? -1 : 1);
    void ja;
  }
  function novaMensagem(p) {
    const m = p.new, velho = p.old;
    if (p.eventType === "DELETE") { for (const c in chat.mensagens) chat.mensagens[c] = chat.mensagens[c].filter(x => x.id !== (velho && velho.id)); if (chat.aberto) desenharChat(); return; }
    if (!m || !relevante(m.canal) && !m.canal.startsWith("sala:")) return;
    const lista = chat.mensagens[m.canal] = chat.mensagens[m.canal] || [];
    if (lista.some(x => x.id === m.id)) return;
    lista.push(m);
    const meu = m.autor === Dados.meuId();
    const vendo = chat.aberto && chat.canal === m.canal && !document.hidden;
    if (!meu && relevante(m.canal)) {
      if (vendo) marcarLido(m.canal); else naoLidas[m.canal] = (naoLidas[m.canal] || 0) + 1;
      const mencionado = acharMencoes(m.texto).some(u => u.id === Dados.meuId());
      if (m.canal.startsWith("dm:") || mencionado) {
        if (!vendo) { som("msg"); opt.toast(`💬 ${nomeDe(m.autor)}: ${m.texto.slice(0, 60)}`); }
        notificar(`${nomeDe(m.autor)}${m.canal.startsWith("dm:") ? "" : " em " + nomeCanal(m.canal)}`, m.texto.slice(0, 140), () => abrirChat(m.canal));
      }
      // balão em cima de quem falou na sala
      if (m.canal.startsWith("sala:") || m.canal === "geral") { const a = opt.outros().find(o => o.id === m.autor); if (a) { a.falaChat = m.texto.slice(0, 80); a.falaChatAte = performance.now() + 6000; } }
    }
    if (meu) { const a = opt.eu(); a.falaChat = m.texto.slice(0, 80); a.falaChatAte = performance.now() + 6000; }
    if (chat.aberto) desenharChat(); desenharTopo();
  }
  async function abrirChat(canal) {
    if (!chat.painel) {
      chat.painel = document.createElement("aside"); chat.painel.className = "soc-chat";
      document.body.appendChild(chat.painel);
      chat.painel.addEventListener("click", cliqueChat);
      chat.painel.addEventListener("submit", enviarChat);
      chat.painel.addEventListener("keydown", e => { if (e.key === "Escape") fecharChat(); });
    }
    chat.aberto = true; chat.painel.classList.add("on");
    chat.canal = canal || (chat.canal && chat.canal !== "diretas" ? chat.canal : canalSala() || "geral");
    opt.aoAbrir && opt.aoAbrir();
    desenharChat();
    if (chat.canal !== "diretas") { await carregarCanal(chat.canal); marcarLido(chat.canal); desenharChat(); }
    setTimeout(() => { const i = chat.painel.querySelector("textarea"); if (i && innerWidth > 760) i.focus(); }, 30);
  }
  function fecharChat() { chat.aberto = false; if (chat.painel) chat.painel.classList.remove("on"); }
  function desenharChat() {
    const p = chat.painel; if (!p) return;
    const cs = canalSala(), c = chat.canal, eu = Dados.meuId();
    const nDM = Object.entries(naoLidas).filter(([k]) => k.startsWith("dm:")).reduce((s, [, v]) => s + v, 0);
    const abas = [[cs, cs ? nomeCanal(cs) : null], ["geral", "Geral"], ["diretas", `Diretas${nDM ? ` <i>${nDM}</i>` : ""}`]].filter(a => a[0] && a[1]);
    let corpo = "";
    if (semTabela) corpo = `<p class="soc-vazio">Para usar o chat, rode o arquivo <b>rodar_no_supabase_6.sql</b> no Supabase.</p>`;
    else if (c === "diretas") {
      const conversas = Object.keys(chat.mensagens).filter(k => k.startsWith("dm:") && k.includes(eu))
        .map(k => ({ k, ult: chat.mensagens[k][chat.mensagens[k].length - 1] })).filter(x => x.ult).sort((a, b) => a.ult.criado_em < b.ult.criado_em ? 1 : -1);
      const comConversa = new Set(conversas.map(x => x.k));
      const outros = usuarios.filter(u => u.id !== eu && !comConversa.has(Dados.canalDM(u.id)));
      const online = new Set(opt.outros().map(o => o.id));
      corpo = `<div class="soc-dms">${conversas.map(x => { const n = nomeCanal(x.k), nl = naoLidas[x.k] || 0;
          return `<button data-canal="${esc(x.k)}"><span class="av" style="background:${corNome(n)}">${esc(iniciais(n))}</span><span class="dm-tx"><b>${esc(n)}</b><small>${esc((x.ult.autor === eu ? "Você: " : "") + x.ult.texto.slice(0, 60))}</small></span>${nl ? `<i>${nl}</i>` : ""}</button>`; }).join("")}
        ${outros.length ? `<div class="dm-sep">Começar conversa</div>` + outros.map(u => `<button data-canal="${esc(Dados.canalDM(u.id))}"><span class="av" style="background:${corNome(u.nome)}">${esc(iniciais(u.nome))}</span><span class="dm-tx"><b>${esc(u.nome)}</b><small>${online.has(u.id) ? "online agora" : "offline"}</small></span></button>`).join("") : ""}</div>`;
    } else {
      const ms = chat.mensagens[c] || []; let ultDia = "", ultAutor = "", ultT = 0;
      corpo = `<div class="soc-msgs">${ms.length ? ms.map(m => {
          const d = dia(m.criado_em), junto = m.autor === ultAutor && d === ultDia && new Date(m.criado_em) - ultT < 5 * 60e3;
          const sep = d !== ultDia ? `<div class="msg-dia">${esc(d)}</div>` : ""; ultDia = d; ultAutor = m.autor; ultT = new Date(m.criado_em);
          const n = nomeDe(m.autor), meu = m.autor === eu;
          return sep + `<div class="msg ${junto ? "junto" : ""} ${meu ? "meu" : ""}" data-mid="${m.id}">${junto ? "" : `<span class="av" style="background:${corNome(n)}">${esc(iniciais(n))}</span>`}
            <div class="msg-c">${junto ? "" : `<div class="msg-h"><b>${esc(n)}</b><small>${hora(m.criado_em)}</small></div>`}<div class="msg-t">${realcar(m.texto)}</div></div>
            ${meu ? `<button class="msg-x" data-apagar="${m.id}" title="Apagar">×</button>` : ""}</div>`;
        }).join("") : `<p class="soc-vazio">${c.startsWith("dm:") ? "Comece a conversa." : c === "geral" ? "Mensagens para todo mundo desta sala virtual." : "Mensagens para quem está nesta sala."}</p>`}</div>
        <form class="soc-env"><textarea rows="1" maxlength="2000" placeholder="${c.startsWith("dm:") ? "Mensagem para " + esc(nomeCanal(c)) : "Escreva… use @nome para chamar alguém"}"></textarea><button class="btn pri" aria-label="Enviar">➤</button></form>`;
    }
    const rasc = p.querySelector("textarea") ? p.querySelector("textarea").value : "";
    p.innerHTML = `<div class="sc-h"><b>💬 ${c === "diretas" ? "Conversas diretas" : esc(nomeCanal(c))}</b>${c.startsWith("dm:") ? `<button data-canal="diretas" class="sc-v">‹ Voltar</button>` : ""}<button data-fechar class="sc-x" aria-label="Fechar">×</button></div>
      <div class="sc-abas">${abas.map(([k, l]) => `<button data-canal="${esc(k)}" class="${(c === k || (k === "diretas" && c.startsWith("dm:"))) ? "on" : ""}">${l}${k !== "diretas" && naoLidas[k] ? ` <i>${naoLidas[k]}</i>` : ""}</button>`).join("")}</div>${corpo}`;
    const ta = p.querySelector("textarea"); if (ta) { ta.value = rasc; ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); } }); }
    const l = p.querySelector(".soc-msgs"); if (l) l.scrollTop = l.scrollHeight;
  }
  async function cliqueChat(e) {
    if (e.target.closest("[data-fechar]")) return fecharChat();
    const ap = e.target.closest("[data-apagar]"); if (ap) { try { await Dados.apagarMensagem(ap.dataset.apagar); } catch (err) { opt.toast("Não consegui apagar"); } return; }
    const c = e.target.closest("[data-canal]"); if (c) { chat.canal = c.dataset.canal; desenharChat(); if (chat.canal !== "diretas") { await carregarCanal(chat.canal); marcarLido(chat.canal); desenharChat(); } }
  }
  async function enviarChat(e) {
    e.preventDefault();
    const ta = chat.painel.querySelector("textarea"), texto = ta.value.trim(); if (!texto) return;
    ta.value = "";
    try {
      const m = await Dados.enviarMensagem(opt.mapaId, chat.canal, texto);
      novaMensagem({ eventType: "INSERT", new: m });
      // menções: aviso para quem não está nesta conversa direta
      const men = acharMencoes(texto).filter(u => u.id !== Dados.meuId());
      if (men.length) Dados.criarAvisos(men.map(u => ({ para: u.id, tipo: "mencao", texto: `${opt.eu().nome} mencionou você em ${nomeCanal(chat.canal)}: “${texto.slice(0, 120)}”`, dados: { mapa: opt.mapaId, canal: chat.canal } })));
    } catch (err) { ta.value = texto; opt.toast("Não consegui enviar" + (err && err.message ? ": " + err.message : "")); }
  }

  /* ================= AGENDA ================= */
  let reunioes = [];
  const envolvido = r => !r.convidados || !r.convidados.length || r.convidados.includes(Dados.meuId()) || r.criado_por === Dados.meuId();
  const proximasMinhas = () => reunioes.filter(r => envolvido(r) && new Date(r.fim) > Date.now());
  async function carregarReunioes() { const l = await Dados.listarReunioes(opt.mapaId); if (l) reunioes = l; desenharTopo(); if (agendaAberta) desenharAgenda(); if (window.Decoracao) Decoracao.atualizar(); }
  const D = window.Decoracao || { temaDe: () => null, pautaSemTema: p => p, comTema: p => p, TEMAS: {} };
  const lembrados = ls.get("nextco_lembretes", {});
  function checarLembretes() {
    const agora = Date.now();
    for (const r of proximasMinhas()) {
      const ini = new Date(r.inicio).getTime(), falta = ini - agora;
      const k5 = r.id + ":5", k0 = r.id + ":0";
      if (falta <= 5 * 60e3 && falta > 60e3 && !lembrados[k5]) { lembrados[k5] = 1; ls.set("nextco_lembretes", lembrados); lembrete(r, `Começa em ${Math.round(falta / 60e3)} min`); }
      if (falta <= 60e3 && falta > -10 * 60e3 && !lembrados[k0]) { lembrados[k0] = 1; ls.set("nextco_lembretes", lembrados);
        // reunião numa sala: convite para entrar já sentado (no lugar do lembrete)
        if (r.sala_id && window.Reuniao) { som("reuniao"); notificar(`📅 ${r.titulo}`, `Começando agora${r.sala_nome ? " · " + r.sala_nome : ""}`, null, true); if (Reuniao.convite(r)) continue; }
        lembrete(r, "Começando agora"); }
    }
  }
  function lembrete(r, quando) {
    som("reuniao");
    notificar(`📅 ${r.titulo}`, `${quando}${r.sala_nome ? " · " + r.sala_nome : ""}`, () => r.sala_id && opt.irParaSala(r.sala_id), true);
    const c = document.createElement("div"); c.className = "soc-toque";
    c.innerHTML = `<div class="tq-ic">📅</div><div class="tq-tx"><b>${esc(r.titulo)}</b><br>${esc(quando)}${r.sala_nome ? ` · ${esc(r.sala_nome)}` : ""}</div>
      <div class="tq-ac">${r.sala_id ? `<button class="btn pri" data-r="ir">Ir para a sala</button>` : ""}<button class="btn" data-r="ok">Ok</button></div>`;
    document.body.appendChild(c);
    const fechar = () => c.remove(); const tm = setTimeout(fechar, 60000);
    c.onclick = e => { const b = e.target.closest("[data-r]"); if (!b) return; clearTimeout(tm); fechar(); if (b.dataset.r === "ir") opt.irParaSala(r.sala_id); };
  }
  function linkGoogle(r) {
    const f = d => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const link = location.origin + location.pathname + "?sala=" + encodeURIComponent(opt.idPublico());
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(r.titulo) + "&dates=" + f(r.inicio) + "/" + f(r.fim) +
      "&details=" + encodeURIComponent((D.pautaSemTema(r.pauta) ? D.pautaSemTema(r.pauta) + "\n\n" : "") + "Entrar no escritório virtual: " + link + (r.sala_nome ? "\nSala: " + r.sala_nome : "")) +
      "&location=" + encodeURIComponent((r.sala_nome ? r.sala_nome + " · " : "") + "Escritório virtual");
  }
  let agendaAberta = false, modal = null;
  function abrirModal(html) {
    if (!modal) { modal = document.createElement("div"); modal.className = "soc-modal"; document.body.appendChild(modal);
      modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-mfechar]")) fecharModal(); }); }
    modal.innerHTML = `<div class="sm-win">${html}</div>`; modal.classList.add("on"); opt.aoAbrir && opt.aoAbrir();
  }
  function fecharModal() { if (modal) modal.classList.remove("on"); agendaAberta = false; }
  function abrirAgenda() { agendaAberta = true; desenharAgenda(); carregarReunioes(); }
  function desenharAgenda(editar) {
    if (semTabela) return abrirModal(`<div class="sm-h"><b>📅 Agenda</b><button data-mfechar class="sc-x">×</button></div><p class="soc-vazio">Rode o arquivo <b>rodar_no_supabase_6.sql</b> no Supabase para usar a agenda.</p>`);
    if (editar) return formReuniao(editar === true ? null : editar);
    const futuras = reunioes.filter(r => new Date(r.fim) > Date.now());
    let ultDia = "";
    const linhas = futuras.map(r => {
      const d = dia(r.inicio), sep = d !== ultDia ? `<div class="msg-dia">${esc(d)}</div>` : ""; ultDia = d;
      const agora = new Date(r.inicio) <= Date.now(), meu = r.criado_por === Dados.meuId(), conv = (r.convidados || []).map(nomeDe);
      return sep + `<div class="ag-r ${envolvido(r) ? "eu" : ""} ${agora ? "agora" : ""}">
        <div class="ag-h">${hora(r.inicio)}<small>${hora(r.fim)}</small></div>
        <div class="ag-c"><b>${esc(r.titulo)}</b>${agora ? ` <span class="ag-tag">acontecendo</span>` : ""}${D.temaDe(r) ? ` <span class="ag-tag tema">${esc(D.TEMAS[D.temaDe(r)].nome)}</span>` : ""}
          <small>${r.sala_nome ? "📍 " + esc(r.sala_nome) + " · " : ""}${conv.length ? "👥 " + esc(conv.join(", ")) : "👥 todos"} · por ${esc(nomeDe(r.criado_por))}</small>
          ${D.pautaSemTema(r.pauta) ? `<p>${esc(D.pautaSemTema(r.pauta))}</p>` : ""}
          <div class="ag-ac">${r.sala_id ? `<button class="btn" data-ir="${esc(r.sala_id)}">🚶 Ir para a sala</button>` : ""}<a class="btn" href="${linkGoogle(r)}" target="_blank" rel="noopener">Google Agenda</a>
            ${meu ? `<button class="btn" data-editar="${r.id}">Editar</button><button class="btn dan" data-cancelar="${r.id}">Cancelar</button>` : ""}</div></div></div>`;
    }).join("");
    abrirModal(`<div class="sm-h"><b>📅 Agenda de reuniões</b><button class="btn pri" data-nova>+ Marcar reunião</button><button data-mfechar class="sc-x">×</button></div>
      <div class="ag-lista">${linhas || `<p class="soc-vazio">Nenhuma reunião marcada. Marque uma e todo mundo convidado recebe o aviso e um lembrete 5 minutos antes.</p>`}</div>`);
    modal.querySelector(".sm-win").onclick = async e => {
      if (e.target.closest("[data-nova]")) return formReuniao(null);
      const ir = e.target.closest("[data-ir]"); if (ir) { fecharModal(); opt.irParaSala(ir.dataset.ir); return; }
      const ed = e.target.closest("[data-editar]"); if (ed) return formReuniao(reunioes.find(r => r.id === ed.dataset.editar));
      const ca = e.target.closest("[data-cancelar]"); if (ca) {
        if (!ca.dataset.ok) { ca.dataset.ok = 1; ca.textContent = "Confirmar cancelamento"; return; }
        try { const r = reunioes.find(x => x.id === ca.dataset.cancelar); await Dados.excluirReuniao(ca.dataset.cancelar);
          Dados.criarAvisos((r.convidados || []).map(id => ({ para: id, tipo: "reuniao", texto: `${opt.eu().nome} cancelou a reunião “${r.titulo}” (${dia(r.inicio)} ${hora(r.inicio)})`, dados: { mapa: opt.mapaId } })));
          carregarReunioes(); } catch (err) { opt.toast("Não consegui cancelar"); }
      }
    };
  }
  function formReuniao(r) {
    const salas = opt.salas().filter(s => s.type !== "corredor");
    const atual = opt.salaAtual(), padrao = (r && r.sala_id) || (atual && atual.type !== "corredor" ? atual.id : ((salas.find(s => s.type === "reuniao") || salas[0] || {}).id));
    const ini = r ? new Date(r.inicio) : new Date(Math.ceil(Date.now() / (15 * 60e3)) * 15 * 60e3 + 15 * 60e3);
    const dur = r ? Math.round((new Date(r.fim) - new Date(r.inicio)) / 60e3) : 30;
    const pad = n => String(n).padStart(2, "0");
    const dataV = `${ini.getFullYear()}-${pad(ini.getMonth() + 1)}-${pad(ini.getDate())}`, horaV = `${pad(ini.getHours())}:${pad(ini.getMinutes())}`;
    const conv = new Set(r ? r.convidados || [] : []);
    abrirModal(`<div class="sm-h"><b>${r ? "Editar reunião" : "Marcar reunião"}</b><button data-mfechar class="sc-x">×</button></div>
      <form class="ag-form">
        <label>Assunto<input name="titulo" required maxlength="160" value="${esc(r ? r.titulo : "")}" placeholder="Ex.: Alinhamento da campanha"></label>
        <div class="row3"><label>Dia<input name="data" type="date" required value="${dataV}"></label><label>Hora<input name="hora" type="time" required value="${horaV}"></label>
          <label>Duração<select name="dur">${[15, 30, 45, 60, 90, 120, 180].map(m => `<option value="${m}" ${m === dur ? "selected" : ""}>${m < 60 ? m + " min" : m / 60 + " h"}</option>`).join("")}</select></label></div>
        <label>Sala<select name="sala"><option value="">Sem sala</option>${salas.map(s => `<option value="${esc(s.id)}" ${s.id === padrao ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
        <label>Convidados <small>(sem ninguém marcado = todos)</small></label>
        <div class="ag-conv">${usuarios.filter(u => u.id !== Dados.meuId()).map(u => `<label class="chip"><input type="checkbox" name="conv" value="${u.id}" ${conv.has(u.id) ? "checked" : ""}><span class="av" style="background:${corNome(u.nome)}">${esc(iniciais(u.nome))}</span>${esc(u.nome)}</label>`).join("")}</div>
        <label>Quem apresenta <small>(fala sem pedir; os outros entram mutados e levantam a mão)</small><select name="pal">${[{ id: Dados.meuId(), nome: (opt.eu().nome || "Eu") + " (eu)" }, ...usuarios.filter(u => u.id !== Dados.meuId())].map(u => `<option value="${u.id}" ${(r ? (window.Reuniao ? Reuniao.palestranteDe(r) : r.criado_por) : Dados.meuId()) === u.id ? "selected" : ""}>${esc(u.nome)}</option>`).join("")}</select></label>
        <label>Pauta<textarea name="pauta" rows="3" maxlength="1000" placeholder="Opcional">${esc(r ? D.pautaSemTema(r.pauta) || "" : "")}</textarea></label>
        ${opt.souAdmin && opt.souAdmin() ? `<label>Decoração temática <small>(a sala do evento se enfeita sozinha de 30 min antes até 15 min depois)</small><select name="tema"><option value="">Nenhuma</option>${Object.entries(D.TEMAS).map(([k, t]) => `<option value="${k}" ${r && D.temaDe(r) === k ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}</select></label>` : ""}
        <div class="ag-ac"><button class="btn pri">${r ? "Salvar" : "Marcar e avisar"}</button><button type="button" class="btn" data-voltar>Voltar</button></div>
      </form>`);
    const f = modal.querySelector("form");
    modal.querySelector("[data-voltar]").onclick = () => desenharAgenda();
    f.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(f), inicio = new Date(fd.get("data") + "T" + fd.get("hora")), fim = new Date(inicio.getTime() + (+fd.get("dur")) * 60e3);
      const sala = salas.find(s => s.id === fd.get("sala"));
      const temaEsc = fd.has("tema") ? String(fd.get("tema") || "") : (r ? D.temaDe(r) : ""); // quem não é admin não vê a opção e mantém o tema que já existia
      const dados = { mapa_id: opt.mapaId, titulo: String(fd.get("titulo")).trim(), pauta: D.comTema((String(fd.get("pauta") || "").trim() + (fd.get("pal") && fd.get("pal") !== (r ? r.criado_por : Dados.meuId()) ? ` ⟦pal:${fd.get("pal")}⟧` : "")).trim(), temaEsc) || null, inicio: inicio.toISOString(), fim: fim.toISOString(),
        sala_id: sala ? sala.id : null, sala_nome: sala ? sala.name : null, convidados: fd.getAll("conv") };
      if (r) dados.id = r.id;
      try {
        await Dados.salvarReuniao(dados);
        const novos = dados.convidados.filter(id => !r || !(r.convidados || []).includes(id));
        Dados.criarAvisos(novos.map(id => ({ para: id, tipo: "reuniao", texto: `${opt.eu().nome} te convidou: “${dados.titulo}” — ${dia(dados.inicio)} às ${hora(dados.inicio)}${sala ? " · " + sala.name : ""}`, dados: { mapa: opt.mapaId } })));
        opt.toast(r ? "📅 Reunião atualizada" : "📅 Reunião marcada" + (novos.length ? ` · ${novos.length} convidado(s) avisado(s)` : ""));
        await carregarReunioes(); desenharAgenda();
      } catch (err) { opt.toast("Não consegui salvar: " + ((err && err.message) || "")); }
    };
  }

  /* ================= AVISOS ================= */
  let avisos = [];
  async function carregarAvisos() { const l = await Dados.listarAvisos(); if (l) avisos = l; desenharTopo(); }
  function novoAviso(a) {
    if (!a || avisos.some(x => x.id === a.id)) return;
    avisos.unshift(a); desenharTopo(); som("msg");
    opt.toast("🔔 " + a.texto.slice(0, 90));
    notificar(a.tipo === "reuniao" ? "📅 Reunião" : a.tipo === "tarefa" ? "✅ Tarefa" : "💬 Menção", a.texto, () => abrirAviso(a));
  }
  function abrirAviso(a) {
    const d = a.dados || {};
    if (d.mapa && d.mapa !== opt.mapaId) { location.href = "escritorio.html?sala=" + encodeURIComponent(d.mapa); return; }
    if (a.tipo === "reuniao") return abrirAgenda();
    if (d.tarefa) return opt.abrirTarefa(d.tarefa);
    if (d.canal) return abrirChat(d.canal);
  }
  function abrirAvisos() {
    const ic = { mencao: "💬", reuniao: "📅", tarefa: "✅" };
    abrirModal(`<div class="sm-h"><b>🔔 Avisos</b><button data-mfechar class="sc-x">×</button></div>
      <div class="av-lista">${semTabela ? `<p class="soc-vazio">Rode o <b>rodar_no_supabase_6.sql</b> no Supabase para receber avisos.</p>` : avisos.length ? avisos.map(a =>
        `<button class="av-i ${a.lido ? "" : "novo"}" data-aviso="${a.id}"><span>${ic[a.tipo] || "🔔"}</span><span><b>${esc(a.texto)}</b><small>${dia(a.criado_em)} ${hora(a.criado_em)}</small></span></button>`).join("") : `<p class="soc-vazio">Nada por aqui. Menções (@nome), convites de reunião e tarefas atribuídas a você aparecem aqui.</p>`}</div>`);
    modal.querySelector(".sm-win").onclick = e => { const b = e.target.closest("[data-aviso]"); if (b) { const a = avisos.find(x => x.id === b.dataset.aviso); fecharModal(); if (a) abrirAviso(a); } };
    const nl = avisos.filter(a => !a.lido).map(a => a.id); avisos.forEach(a => a.lido = true); Dados.marcarAvisosLidos(nl); desenharTopo();
  }

  /* ================= PRAZOS (tarefas) ================= */
  function avisarPrazos(tarefas, eu) {
    const k = "nextco_prazos_" + new Date().toDateString(); if (ls.get(k, false)) return;
    const minha = t => String(t.responsavel || "").split(";").map(x => x.trim()).some(r => r === eu.email || r === eu.nome);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let atrasadas = 0, hojeN = 0, amanha = 0;
    for (const t of tarefas) {
      if (!minha(t) || t.status === "feito" || !t.prazo) continue;
      const d = new Date(t.prazo + "T00:00:00"), dd = Math.round((d - hoje) / 864e5);
      if (dd < 0) atrasadas++; else if (dd === 0) hojeN++; else if (dd === 1) amanha++;
    }
    if (!atrasadas && !hojeN && !amanha) return;
    ls.set(k, true);
    const partes = [atrasadas && `${atrasadas} atrasada${atrasadas > 1 ? "s" : ""}`, hojeN && `${hojeN} para hoje`, amanha && `${amanha} para amanhã`].filter(Boolean);
    const txt = "Suas tarefas: " + partes.join(", ");
    setTimeout(() => { opt.toast("⏰ " + txt); notificar("⏰ Prazos", txt, null, true); }, 2500);
  }

  /* ================= INÍCIO ================= */
  async function iniciar(o) {
    opt = o;
    lidoAte = ls.get("nextco_chat_lido_" + opt.mapaId, {});
    montarTopo();
    usuarios = await Dados.listarUsuarios();
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => addEventListener(ev, atividade, { passive: true }));
    let ultMov = 0; addEventListener("pointermove", () => { const n = Date.now(); if (n - ultMov > 3000) { ultMov = n; atividade(); } }, { passive: true });
    setInterval(() => { checarAusencia(); checarLembretes(); }, 20000);
    addEventListener("keydown", e => { if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.metaKey && !e.target.matches("input,textarea,select") && !opt.bloqueado()) { e.preventDefault(); chat.aberto ? fecharChat() : abrirChat(); } });
    if (Dados.ouvirMensagens) Dados.ouvirMensagens(opt.mapaId, novaMensagem);
    if (Dados.ouvirReunioes) Dados.ouvirReunioes(opt.mapaId, carregarReunioes);
    if (Dados.ouvirAvisos) Dados.ouvirAvisos(novoAviso);
    await Promise.all([carregarDMs(), carregarReunioes(), carregarAvisos()]);
    checarLembretes();
    // quando muda de sala, a aba "Sala" do chat acompanha
    setInterval(() => { const c = canalSala(); if (c !== ultimaSalaChat) { ultimaSalaChat = c; if (chat.aberto && chat.canal.startsWith("sala:")) abrirChat(c || "geral"); else desenharTopo(); } }, 1000);
  }
  let ultimaSalaChat = null;
  return {
    iniciar, cartao, recebeuToque, abrirChat, fecharChat, abrirAgenda, avisarPrazos, acharMencoes, notificar, mudarStatus,
    STATUS, get status() { return status; }, get reunioes() { return reunioes; }, get chatAberto() { return chat.aberto; }, get usuarios() { return usuarios; },
  };
})();
