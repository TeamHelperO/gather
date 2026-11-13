/* Para o gestor: presença (minutos online, em reunião, ocupado/foco e ausente, por dia) e relatório da semana.
   – Cada pessoa registra 1 minuto por minuto pelo servidor (registrar_presenca); nada de áudio, tela, conversa ou posição.
   – Todo mundo vê o próprio tempo em "Meu tempo"; administradores e o dono da sala virtual veem a equipe.
   – Aviso de transparência na primeira vez que a pessoa entra em cada sala virtual. */
window.Gestor = (function () {
  let opt = null, semTabela = false, modal = null, aba = "presenca", periodo = 7;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const H = m => window.RelatorioCore ? RelatorioCore.horas(m) : Math.round(m) + " min";
  const corNome = n => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},55%,48%)`; };
  const iniciais = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const diaISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

  /* ---------- batida de presença (1 por minuto) ---------- */
  function estadoAgora() {
    const st = window.Social ? Social.status : "disponivel";
    if (st === "ausente" || document.hidden && Date.now() - ultimaVisivel > 10 * 60e3) return "ausente";
    if (st === "ocupado") return "ocupado";
    if (st === "reuniao") return "reuniao";
    const r = opt.salaAtual();
    if (r && /^(reuniao|auditorio)$/.test(r.type) && opt.outros().some(o => { const s = roomAt(o.px, o.py - 4); return s && s.id === r.id; })) return "reuniao";
    return "online";
  }
  let ultimaVisivel = Date.now();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) ultimaVisivel = Date.now(); });
  async function bater() {
    if (semTabela || (window.SessaoUnica && SessaoUnica.derrubada)) return;
    if (!document.hidden) ultimaVisivel = Date.now();
    const ok = await Dados.registrarPresenca(opt.mapaId, estadoAgora());
    if (!ok) semTabela = true; // banco sem a migração: para de tentar
  }

  function avisoTransparencia() {
    const k = "nextco_aviso_presenca_" + opt.mapaId;
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch (e) { return; }
    const c = document.createElement("div"); c.className = "soc-toque";
    c.innerHTML = `<div class="tq-ic">📊</div><div class="tq-tx"><b>Transparência:</b> esta sala registra só o seu <b>tempo online, em reunião, ocupado e ausente</b> (sem áudio, tela, conversas ou localização). Você vê o seu em <b>Menu → Meu tempo</b>.</div><div class="tq-ac"><button class="btn pri" data-ok>Entendi</button></div>`;
    document.body.appendChild(c); c.querySelector("[data-ok]").onclick = () => c.remove(); setTimeout(() => c.remove(), 30000);
  }

  /* ---------- modal ---------- */
  function abrirModal(html) {
    if (!modal) { modal = document.createElement("div"); modal.className = "soc-modal gs-modal"; document.body.appendChild(modal);
      modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-gfechar]")) modal.classList.remove("on"); else clique(e); }); }
    modal.innerHTML = `<div class="sm-win gs-win">${html}</div>`; modal.classList.add("on"); opt.aoAbrir && opt.aoAbrir();
  }
  const semMigracao = `<p class="soc-vazio">Para registrar a presença, rode o arquivo <b>rodar_no_supabase_7.sql</b> no Supabase (SQL Editor).</p>`;

  /* ---------- Meu tempo (todo mundo) ---------- */
  async function abrirMeuTempo() {
    abrirModal(`<div class="sm-h"><b>📊 Meu tempo</b><button data-gfechar class="sc-x">×</button></div><p class="soc-vazio">Carregando…</p>`);
    const desde = diaISO(Date.now() - 13 * 864e5);
    const l = await Dados.listarPresenca(opt.mapaId, desde);
    if (l == null) return abrirModal(`<div class="sm-h"><b>📊 Meu tempo</b><button data-gfechar class="sc-x">×</button></div>${semMigracao}`);
    const meus = l.filter(x => x.usuario === Dados.meuId());
    const max = Math.max(60, ...meus.map(x => x.min_online));
    const dias = []; for (let i = 13; i >= 0; i--) { const d = diaISO(Date.now() - i * 864e5); dias.push(meus.find(x => x.dia === d) || { dia: d, min_online: 0, min_reuniao: 0, min_ocupado: 0, min_ausente: 0 }); }
    const sem = meus.filter(x => x.dia >= diaISO(Date.now() - 6 * 864e5));
    const soma = k => sem.reduce((s, x) => s + (x[k] || 0), 0);
    abrirModal(`<div class="sm-h"><b>📊 Meu tempo nesta sala</b><button data-gfechar class="sc-x">×</button></div>
      <div class="gs-corpo">
        <div class="gs-cards">${[["Online (7 dias)", soma("min_online"), "#3d5afe"], ["Em reunião", soma("min_reuniao"), "#f2a33a"], ["Ocupado / foco", soma("min_ocupado"), "#e5484d"], ["Ausente", soma("min_ausente"), "#9aa0ad"]]
          .map(([l, v, c]) => `<div><b style="color:${c}">${H(v)}</b><small>${l}</small></div>`).join("")}</div>
        <div class="gs-dias">${dias.map(d => { const h = d.min_online / max * 100;
          return `<div class="gs-dia" title="${new Date(d.dia + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}: ${H(d.min_online)} online, ${H(d.min_reuniao)} em reunião">
            <div class="gs-col" style="height:${h}%">${barra(d)}</div><small>${new Date(d.dia + "T12:00").toLocaleDateString("pt-BR", { weekday: "narrow" })}</small></div>`; }).join("")}</div>
        ${legenda()}
        <p class="gs-obs">Só minutos por estado são guardados. ${opt.podeVerEquipe() ? "Como gestor, você vê a equipe em Menu → Painel do gestor." : "O gestor desta sala vê esse resumo da equipe."}</p>
      </div>`);
  }
  // barra empilhada: reunião, ocupado, ausente e o resto online
  function barra(d) {
    const t = Math.max(1, d.min_online), on = Math.max(0, d.min_online - d.min_reuniao - d.min_ocupado - d.min_ausente);
    return [["#3fbf5f", on], ["#f2a33a", d.min_reuniao], ["#e5484d", d.min_ocupado], ["#9aa0ad", d.min_ausente]].filter(x => x[1] > 0)
      .map(([c, v]) => `<i style="background:${c};flex:${v / t}"></i>`).join("");
  }
  const legenda = () => `<div class="gs-leg"><span><i style="background:#3fbf5f"></i>Disponível</span><span><i style="background:#f2a33a"></i>Reunião</span><span><i style="background:#e5484d"></i>Ocupado/foco</span><span><i style="background:#9aa0ad"></i>Ausente</span></div>`;

  /* ---------- Painel do gestor ---------- */
  let dados = null;
  async function abrirPainel(qual) {
    if (qual) aba = qual;
    abrirModal(`<div class="sm-h"><b>📈 Painel do gestor</b><button data-gfechar class="sc-x">×</button></div><p class="soc-vazio">Carregando…</p>`);
    const [pres, usuarios] = await Promise.all([Dados.listarPresenca(opt.mapaId, diaISO(Date.now() - 29 * 864e5)), Dados.listarUsuarios()]);
    dados = { pres, usuarios };
    desenhar();
  }
  function desenhar() {
    const topo = `<div class="sm-h"><b>📈 Painel do gestor</b><div class="gs-abas">${[["presenca", "Presença"], ["relatorio", "Relatório da semana"]].map(([k, l]) => `<button data-aba="${k}" class="${aba === k ? "on" : ""}">${l}</button>`).join("")}</div><button data-gfechar class="sc-x">×</button></div>`;
    abrirModal(topo + `<div class="gs-corpo">${aba === "presenca" ? presenca() : relatorio()}</div>`);
  }
  function presenca() {
    if (dados.pres == null) return semMigracao;
    const desde = diaISO(Date.now() - (periodo - 1) * 864e5), hoje = diaISO(Date.now());
    const online = new Set([Dados.meuId(), ...opt.outros().map(o => o.id)]);
    const status = id => id === Dados.meuId() ? (window.Social ? Social.status : "disponivel") : ((opt.outros().find(o => o.id === id) || {}).status || "disponivel");
    const linhas = new Map();
    for (const x of dados.pres.filter(x => x.dia >= desde)) {
      const l = linhas.get(x.usuario) || { id: x.usuario, dias: 0, min_online: 0, min_reuniao: 0, min_ocupado: 0, min_ausente: 0, hoje: null };
      l.dias += x.min_online ? 1 : 0; for (const k of ["min_online", "min_reuniao", "min_ocupado", "min_ausente"]) l[k] += x[k] || 0;
      if (x.dia === hoje) l.hoje = x; linhas.set(x.usuario, l);
    }
    for (const id of online) if (!linhas.has(id)) linhas.set(id, { id, dias: 0, min_online: 0, min_reuniao: 0, min_ocupado: 0, min_ausente: 0, hoje: null });
    const nome = id => (dados.usuarios.find(u => u.id === id) || {}).nome || "—";
    const lista = [...linhas.values()].sort((a, b) => (online.has(b.id) - online.has(a.id)) || b.min_online - a.min_online);
    const max = Math.max(60, ...lista.map(l => l.min_online));
    const cor = { disponivel: "#3fbf5f", ocupado: "#e5484d", reuniao: "#f2a33a", ausente: "#9aa0ad" };
    const h = d => d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
    dados.linhasPresenca = lista.map(l => ({ ...l, nome: nome(l.id) }));
    return `<div class="gs-barra"><div class="gs-per">${[[1, "Hoje"], [7, "7 dias"], [30, "30 dias"]].map(([n, t]) => `<button data-per="${n}" class="${periodo === n ? "on" : ""}">${t}</button>`).join("")}</div>
        <span class="gs-on">🟢 ${online.size} online agora</span><button class="btn" data-csv>Baixar CSV</button></div>
      ${legenda()}
      <table class="gs-tab"><thead><tr><th>Pessoa</th><th>Tempo no período</th><th>Online</th><th>Reunião</th><th>Foco</th><th>Ausente</th><th>Dias</th><th>Hoje</th></tr></thead><tbody>
      ${lista.map(l => { const n = nome(l.id), on = online.has(l.id), st = status(l.id);
        return `<tr><td><span class="av" style="background:${corNome(n)}">${esc(iniciais(n))}</span><span class="gs-n"><b>${esc(n)}</b><small>${on ? `<i class="dot" style="background:${cor[st]}"></i>${({ disponivel: "Disponível", ocupado: "Ocupado", reuniao: "Em reunião", ausente: "Ausente" })[st]}` : "offline"}</small></span></td>
          <td class="gs-bar"><div style="width:${Math.max(2, l.min_online / max * 100)}%">${barra(l)}</div></td>
          <td><b>${H(l.min_online)}</b></td><td>${H(l.min_reuniao)}</td><td>${H(l.min_ocupado)}</td><td>${H(l.min_ausente)}</td><td>${l.dias}</td>
          <td><small>${l.hoje ? `${h(l.hoje.primeira)}–${h(l.hoje.ultima)}` : "—"}</small></td></tr>`; }).join("") || `<tr><td colspan="8" class="soc-vazio">Ainda não há registros neste período.</td></tr>`}
      </tbody></table>
      <p class="gs-obs">Conta 1 minuto por minuto conectado, pela hora do servidor. "Reunião" = status Em reunião ou estar numa sala de reunião/auditório com mais alguém; "Foco" = status Ocupado; "Ausente" = parado 10+ min ou com a janela escondida. Cada pessoa vê o próprio tempo.</p>`;
  }
  function relatorio() {
    const rel = RelatorioCore.calcular({ tarefas: opt.tarefas(), usuarios: dados.usuarios, presenca: (dados.pres || []).filter(x => x.dia >= diaISO(Date.now() - 6 * 864e5)) });
    dados.rel = rel;
    const nomes = t => esc(rel.respsDe(t).map(rel.nome).join(", ") || "sem responsável");
    const f = s => new Date(String(s).slice(0, 10) + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `<div class="gs-barra"><span class="gs-on">${rel.inicio.toLocaleDateString("pt-BR")} a ${rel.fim.toLocaleDateString("pt-BR")} · ${rel.abertas} abertas de ${rel.total}</span>
        <button class="btn" data-copiar>Copiar resumo</button>${opt.ehNext && opt.ehAdmin() ? `<button class="btn pri" data-email>Enviar por e-mail agora</button>` : ""}</div>
      <div class="gs-cards">${[["Concluídas", rel.concluidas.length, "#2e9e4c"], ["Atrasadas", rel.atrasadas.length, "#e5484d"], ["Vencem em 7 dias", rel.vencendo.length, "#d48a12"], ["Bloqueadas", rel.bloqueadas.length, "#6b6760"]]
        .map(([l, v, c]) => `<div><b style="color:${c}">${v}</b><small>${l}</small></div>`).join("")}</div>
      <div class="gs-cols">
        <section><h4>⚠ Atrasadas</h4>${rel.atrasadas.map(t => `<div class="gs-t" data-tarefa="${esc(t.id)}"><b>${esc(t.titulo)}</b><small>prazo ${f(t.prazo)} · ${nomes(t)}</small></div>`).join("") || `<p class="gs-nada">Nenhuma 🎉</p>`}</section>
        <section><h4>✅ Concluídas na semana</h4>${rel.concluidas.map(({ t, quando }) => `<div class="gs-t" data-tarefa="${esc(t.id)}"><b>${esc(t.titulo)}</b><small>${quando.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })} · ${nomes(t)}</small></div>`).join("") || `<p class="gs-nada">Nada concluído ainda</p>`}</section>
        <section><h4>⏳ Vencem em 7 dias</h4>${rel.vencendo.map(t => `<div class="gs-t" data-tarefa="${esc(t.id)}"><b>${esc(t.titulo)}</b><small>${f(t.prazo)} · ${nomes(t)}</small></div>`).join("") || `<p class="gs-nada">Nada vencendo</p>`}</section>
      </div>
      <h4 style="margin:16px 0 6px">👥 Carga por pessoa</h4>
      <table class="gs-tab"><thead><tr><th>Pessoa</th><th>Abertas</th><th>Atrasadas</th><th>Bloqueadas</th><th>Concluídas</th><th>Online (7d)</th><th>Reunião</th></tr></thead><tbody>
      ${rel.pessoas.map(x => `<tr class="${x.sobrecarga ? "gs-alerta" : ""}"><td><span class="av" style="background:${corNome(x.nome)}">${esc(iniciais(x.nome))}</span><span class="gs-n"><b>${esc(x.nome)}</b>${x.sobrecarga ? `<small>⚠ sobrecarregado</small>` : ""}</span></td>
        <td><b>${x.abertas}</b></td><td>${x.atrasadas || "—"}</td><td>${x.bloqueadas || "—"}</td><td>${x.concluidas || "—"}</td><td>${x.minOnline ? H(x.minOnline) : "—"}</td><td>${x.minReuniao ? H(x.minReuniao) : "—"}</td></tr>`).join("") || `<tr><td colspan="7" class="soc-vazio">Sem tarefas com responsável.</td></tr>`}
      </tbody></table>
      <p class="gs-obs">${opt.ehNext ? "Toda segunda às 8h os administradores recebem este relatório por e-mail." : "Mostra as tarefas dos telões desta sala virtual."} ⚠ = 3 ou mais atrasadas, ou 5+ abertas e 50% acima da média da equipe.</p>`;
  }
  async function clique(e) {
    const a = e.target.closest("[data-aba]"); if (a) { aba = a.dataset.aba; return desenhar(); }
    const p = e.target.closest("[data-per]"); if (p) { periodo = +p.dataset.per; return desenhar(); }
    const t = e.target.closest("[data-tarefa]"); if (t) { modal.classList.remove("on"); return opt.abrirTarefa(t.dataset.tarefa); }
    if (e.target.closest("[data-copiar]")) { const b = e.target.closest("[data-copiar]"); await navigator.clipboard.writeText(RelatorioCore.texto(dados.rel, "Relatório da semana — " + opt.nomeSala())); b.textContent = "Copiado ✓"; setTimeout(() => b.textContent = "Copiar resumo", 1500); }
    if (e.target.closest("[data-csv]")) {
      const linhas = [["pessoa", "minutos_online", "minutos_reuniao", "minutos_foco", "minutos_ausente", "dias"]].concat((dados.linhasPresenca || []).map(l => [l.nome, l.min_online, l.min_reuniao, l.min_ocupado, l.min_ausente, l.dias]));
      const csv = "﻿" + linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `presenca-${periodo}d-${diaISO(Date.now())}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    const em = e.target.closest("[data-email]"); if (em) {
      em.disabled = true; em.textContent = "Enviando…";
      try { const r = await fetch("/api/relatorio", { method: "POST", headers: { Authorization: "Bearer " + await Dados.token() } }); const j = await r.json().catch(() => ({}));
        opt.toast(j.ok ? `📧 Relatório enviado para ${j.enviados.join(", ")}` : "📧 " + (j.erro || (j.falhas || []).join("; ") || "Não deu certo")); }
      catch (err) { opt.toast("📧 Falha ao enviar"); }
      em.disabled = false; em.textContent = "Enviar por e-mail agora";
    }
  }

  function iniciar(o) {
    opt = o;
    setTimeout(bater, 5000); setInterval(bater, 60000);
    setTimeout(avisoTransparencia, 4000);
  }
  return { iniciar, abrirMeuTempo, abrirPainel };
})();
