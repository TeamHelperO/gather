/* Telão da equipe: quadro de tarefas com colunas, arrastar, responsável, prazo, etapas, % e escalonamento.
   Usa apenas Dados (js/dados.js). Abre como sobreposição no escritório ou em tela cheia (telao.html). */
window.Telao = (function () {
  const STATUS = [
    { id: "a_fazer", nome: "A fazer", cor: "#9a948a" },
    { id: "andamento", nome: "Em andamento", cor: "#1a7f4b" },
    { id: "bloqueado", nome: "Bloqueado", cor: "#e5484d" },
    { id: "feito", nome: "Feito", cor: "#3fbf5f" },
  ];
  const NIVEL = { 1: "Escalonado · nível 1 (responsável)", 2: "Escalonado · nível 2 (líder)", 3: "Escalonado · nível 3 (gestor)" };

  /* ---------- regras ---------- */
  function progresso(t) {
    if (t.status === "feito") return 100;
    if (t.etapas && t.etapas.length) return Math.round(t.etapas.filter(e => e.feito).length / t.etapas.length * 100);
    return Math.max(0, Math.min(100, +t.progressoManual || 0));
  }
  function diasAtraso(t) {
    if (!t.prazo || t.status === "feito") return 0;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.floor((hoje - new Date(t.prazo + "T00:00:00")) / 86400000);
  }
  function diasAtrasoData(prazo) { const hoje = new Date(); hoje.setHours(0, 0, 0, 0); return Math.floor((hoje - new Date(prazo + "T00:00:00")) / 86400000); }
  function nivel(t) {
    if (t.status === "feito") return 0;
    const a = diasAtraso(t); let n = a > 3 ? 3 : a > 1 ? 2 : a > 0 ? 1 : 0;
    if (t.status === "bloqueado") n = Math.max(n, 1);
    return n;
  }
  function resumo(ts) {
    const ativas = ts.filter(t => t.status !== "feito");
    const media = ts.length ? Math.round(ts.reduce((s, t) => s + progresso(t), 0) / ts.length) : 0;
    return { total: ts.length, ativas: ativas.length, media, escalonadas: ts.filter(t => nivel(t) > 0).length, feitas: ts.length - ativas.length };
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const iniciais = n => String(n || "?").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("") || "?";
  const corNome = n => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 55% 45%)`; };
  const fmtData = d => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";

  /* ---------- estilos ---------- */
  const CSS = `
.tl{position:fixed;inset:0;z-index:60;background:rgba(14,12,22,.72);display:flex;align-items:stretch;justify-content:center;padding:14px;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink,#1d1d1f)}
.tl.cheia{position:static;background:none;padding:0;min-height:100vh}
.tl-box{background:#121a2b;color:#e8ecf6;border-radius:18px;border:4px solid #24242c;box-shadow:0 20px 60px rgba(0,0,0,.5);width:100%;max-width:1280px;display:flex;flex-direction:column;overflow:hidden}
.tl.cheia .tl-box{border-radius:0;border:0;max-width:none;min-height:100vh}
.tl-head{background:#1a7f4b;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tl-head h2{margin:0;font-size:17px;letter-spacing:.02em}
.tl-sum{font-size:13px;opacity:.9}
.tl-sum b{font-size:15px}
.tl-sp{flex:1}
.tl-btn{border:0;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font:inherit;font-weight:700}
.tl-btn.w{background:#fff;color:#146a3e}.tl-btn.g{background:rgba(255,255,255,.18);color:#fff}
.tl-btn.x{background:rgba(255,255,255,.18);color:#fff;width:38px;height:38px;padding:0;font-size:20px}
.tl-fil{display:flex;gap:6px;padding:10px 14px 0;flex-wrap:wrap}
.tl-fil button{border:1px solid #2a3550;background:#182238;color:#cfd6e6;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.tl-fil button.on{background:#e8ecf6;color:#121a2b;border-color:#e8ecf6}
.tl-board{flex:1;display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:12px;padding:12px 14px 14px;overflow:auto;scroll-snap-type:x mandatory}
@media (max-width:760px){.tl{padding:0}.tl-box{border-radius:0;border:0}.tl-board{grid-template-columns:repeat(4,86vw)}}
.tl-col{background:#182238;border-radius:12px;display:flex;flex-direction:column;min-height:200px;scroll-snap-align:start}
.tl-col h4{margin:0;padding:10px 12px;font-size:13px;display:flex;align-items:center;gap:8px;text-transform:uppercase;letter-spacing:.05em}
.tl-col h4 i{width:10px;height:10px;border-radius:3px;display:inline-block}
.tl-col h4 span{margin-left:auto;background:#24304c;border-radius:999px;padding:1px 8px;font-size:12px}
.tl-list{flex:1;padding:0 8px 8px;display:flex;flex-direction:column;gap:8px;min-height:60px;overflow-y:auto}
.tl-col.alvo{outline:2px dashed #8fa0ff;outline-offset:-4px}
.tl-add{margin:0 8px 8px;border:1px dashed #33405f;background:none;color:#9fb0d6;border-radius:10px;padding:8px;font:inherit;font-weight:600;cursor:pointer}
.tl-card{background:#f4f1ea;color:#1d1d1f;border-radius:10px;padding:10px 10px 9px 10px;cursor:pointer;position:relative;border-left:5px solid #9a948a;user-select:none;touch-action:pan-y}
.tl-card:hover{box-shadow:0 0 0 2px #8fa0ff}
.tl-card.n1{border-left-color:#f2a33a}.tl-card.n2{border-left-color:#e5484d}.tl-card.n3{border-left-color:#b3001b;box-shadow:0 0 0 2px #e5484d}
.tl-card .t{font-weight:700;margin:0 22px 6px 0;word-break:break-word}
.tl-card .meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:#5d5852}
.tl-card .av{width:22px;height:22px;border-radius:50%;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;flex:none}
.tl-card .bar{height:8px;background:#ddd6c8;border-radius:4px;margin-top:8px;overflow:hidden}
.tl-card .bar i{display:block;height:100%;border-radius:4px}
.tl-card .pc{font-weight:800;color:#1d1d1f}
.tl-card .esc{margin-top:7px;font-size:11px;font-weight:800;color:#b3261e;background:#fbe4e4;border-radius:6px;padding:3px 6px;display:inline-block}
.tl-card .atr{color:#b3261e;font-weight:700}
.tl-card .alca{position:absolute;right:4px;top:4px;width:26px;height:26px;border-radius:7px;display:grid;place-items:center;color:#9a948a;touch-action:none;cursor:grab;font-size:16px}
.tl-card .alca:hover{background:#e7e2d8}
.tl-ghost{position:fixed;z-index:80;pointer-events:none;transform:rotate(2deg);box-shadow:0 12px 30px rgba(0,0,0,.4);opacity:.95}
.tl-ph{height:6px;border-radius:3px;background:#8fa0ff}
.tl-card.arrastando{opacity:.25}
.tl-vazio{color:#7f8db0;font-size:13px;text-align:center;padding:12px 6px}
.tl-modal{position:fixed;inset:0;z-index:90;background:rgba(10,8,16,.6);display:grid;place-items:center;padding:12px}
.tl-modal.hidden{display:none}
.tl-form{background:var(--panel,#fff);color:var(--ink,#1d1d1f);border-radius:16px;width:100%;max-width:520px;max-height:92vh;overflow:auto;padding:16px}
.tl-form h3{margin:0 0 10px;font-size:17px;display:flex;align-items:center}
.tl-form h3 button{margin-left:auto}
.tl-f{display:flex;flex-direction:column;gap:5px;margin:10px 0}
.tl-f label{font-size:12px;font-weight:700;color:var(--mut,#6b6760);text-transform:uppercase;letter-spacing:.04em}
.tl-f input,.tl-f select,.tl-f textarea{border:1px solid var(--line,#e4dfd5);background:var(--chip,#f3f1ec);color:inherit;border-radius:10px;padding:9px 11px;font:inherit}
.tl-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.tl-f input,.tl-f select{min-width:0;width:100%}
.tl-com{display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--line,#e4dfd5)}.tl-com p{margin:2px 0 0;white-space:pre-wrap;word-break:break-word;font-size:13.5px}
.tl-com small{color:var(--mut,#6b6760);font-size:11px}.tl-com .av{width:26px;height:26px;border-radius:50%;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;flex:none}
.tl-coms textarea{flex:1;border:1px solid var(--line,#e4dfd5);border-radius:10px;background:var(--chip,#f3f1ec);padding:8px 10px;font:inherit;resize:vertical}
.tl-coms .men{color:#1a7f4b}
.tl-resps{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-height:46px;padding:6px 8px;border:1px solid var(--line,#e4dfd5);border-radius:11px;background:var(--chip,#f3f1ec)}
.tl-resps input{flex:1;min-width:120px;border:0!important;background:transparent!important;padding:4px!important;height:auto!important;outline:none}
.tl-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 3px;border-radius:999px;background:var(--panel,#fff);border:1px solid var(--line,#e4dfd5);font-size:13px;font-weight:650}
.tl-chip .av{width:22px;height:22px;border-radius:50%;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;flex:none}
.tl-chip button{width:20px;height:20px;border-radius:50%;line-height:1;font-size:15px;color:var(--mut,#6b6760)}.tl-chip button:hover{background:var(--line,#e4dfd5)}
.tl-card .avs{display:inline-flex}.tl-card .avs .av+.av{margin-left:-7px;box-shadow:0 0 0 2px var(--panel,#fff)}
.tl-et{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line,#e4dfd5)}
.tl-et input[type=checkbox]{width:20px;height:20px;accent-color:#3fbf5f;flex:none}
.tl-et span{flex:1;word-break:break-word}
.tl-et.ok span{text-decoration:line-through;color:var(--mut,#6b6760)}
.tl-et button{border:0;background:none;color:var(--mut,#6b6760);font-size:18px;cursor:pointer;width:28px;height:28px}
.tl-novaet{display:flex;gap:6px;margin-top:8px}.tl-novaet input{flex:1}
.tl-acts{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.tl-acts .tl-btn{background:var(--chip,#f3f1ec);color:inherit;border:1px solid var(--line,#e4dfd5)}
.tl-acts .tl-btn.pri{background:#1a7f4b;color:#fff;border-color:#1a7f4b}
.tl-acts .tl-btn.dan{color:#e5484d}
.tl-hist{font-size:12px;color:var(--mut,#6b6760);margin-top:10px}
.tl-hist div{padding:2px 0}
.tl-pbar{display:flex;align-items:center;gap:10px}.tl-pbar input{flex:1;accent-color:#1a7f4b}
.tl-projs{flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;padding:12px 14px 14px;overflow:auto;align-content:start}
.tl-proj{background:#f4f1ea;color:#1d1d1f;border-radius:14px;padding:14px 14px 12px;cursor:pointer;border-top:6px solid var(--c,#1a7f4b);display:flex;flex-direction:column;gap:8px;text-align:left;font:inherit}
.tl-proj:hover{box-shadow:0 0 0 2px #8fa0ff}
.tl-proj h3{margin:0;font-size:16px;word-break:break-word}
.tl-proj .lin{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#5d5852;flex-wrap:wrap}
.tl-proj .lin b{color:#1d1d1f}
.tl-proj .rot{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#8a847a}
.tl-proj .av{width:24px;height:24px;border-radius:50%;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;flex:none}
.tl-proj .bar{height:8px;background:#ddd6c8;border-radius:4px;overflow:hidden;flex:1}.tl-proj .bar i{display:block;height:100%}
.tl-proj .atr{color:#b3261e;font-weight:700}
.tl-proj .avs{display:inline-flex}.tl-proj .avs .av{width:22px;height:22px;font-size:9px}.tl-proj .avs .av+.av{margin-left:-6px;box-shadow:0 0 0 2px #f4f1ea}
.tl-proj.avulsas{border-top-color:#9a948a;background:#e9e5dc}
.tl-proj.fechado{opacity:.6}
.tl-pnovo{border:2px dashed #33405f;background:none;color:#9fb0d6;border-radius:14px;min-height:150px;font:inherit;font-weight:700;cursor:pointer}
.tl-pbarra{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;background:#182238;border-bottom:1px solid #24304c;font-size:13px}
.tl-pbarra .volta{border:1px solid #2a3550;background:#121a2b;color:#cfd6e6;border-radius:9px;padding:6px 10px;font:inherit;font-weight:700;cursor:pointer}
.tl-pbarra h3{margin:0;font-size:16px;display:flex;align-items:center;gap:8px}.tl-pbarra h3 i{width:12px;height:12px;border-radius:4px}
.tl-pbarra .av{width:22px;height:22px;border-radius:50%;color:#fff;display:inline-grid;place-items:center;font-size:9.5px;font-weight:800;vertical-align:middle;margin-right:4px}
.tl-pbarra .rot{color:#8fa0c8;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-right:4px}
.tl-pbarra .atr{color:#ff8a80;font-weight:800}
.tl-card .ptag{display:inline-block;font-size:10.5px;font-weight:800;border-radius:5px;padding:1px 6px;margin-bottom:5px;color:#fff}
.tl-card .fora{color:#b3261e;font-weight:700}
.tl-cores{display:flex;gap:8px;flex-wrap:wrap}.tl-cores label{width:30px;height:30px;border-radius:9px;cursor:pointer;position:relative}
.tl-cores input{position:absolute;opacity:0}.tl-cores input:checked+span{position:absolute;inset:-3px;border:3px solid #1d1d1f;border-radius:11px}
.tl-aviso{margin:10px 14px 0;background:#3a2f12;color:#ffd98a;border-radius:10px;padding:9px 12px;font-size:13px}
`;
  function injetarCSS() { if (document.getElementById("tl-css")) return; const s = document.createElement("style"); s.id = "tl-css"; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- quadro ---------- */
  let estado = null;
  function abrir(opts) {
    injetarCSS();
    // cada sala tem o seu telão: só as tarefas daquela sala (sem sala = sala padrão, a Área de trabalho)
    estado = { email: opts.email, cheia: !!opts.telaCheia, aoFechar: opts.aoFechar, filtro: "todas", filtroP: "ativos", tarefas: [], todas: [], projetos: null, projeto: null, usuarios: [], nome: opts.nome || "",
      sala: opts.sala || null, nomeSala: opts.nomeSala || "", salaPadrao: opts.salaPadrao || null, focar: opts.focar || null };
    const tvURL = "telao.html" + (estado.sala ? `?sala=${encodeURIComponent(estado.sala)}&nome=${encodeURIComponent(estado.nomeSala)}&padrao=${encodeURIComponent(estado.salaPadrao || "")}` : "");
    const raiz = document.createElement("div"); raiz.className = "tl" + (estado.cheia ? " cheia" : "");
    raiz.innerHTML = `<div class="tl-box">
      <div class="tl-head"><h2>📊 ${estado.nomeSala ? "TELÃO · " + esc(estado.nomeSala).toUpperCase() : "TELÃO DA EQUIPE"}</h2><div class="tl-sum" id="tlSum"></div><div class="tl-sp"></div>
        <button class="tl-btn w" data-nova id="tlNova">+ Nova tarefa</button>
        ${estado.cheia ? `<a class="tl-btn g" href="escritorio.html" style="text-decoration:none">← Escritório</a>` : `<a class="tl-btn g" href="${tvURL}" target="_blank" rel="noopener" style="text-decoration:none" title="Abrir em tela cheia (TV)">⛶</a><button class="tl-btn x" data-fechar aria-label="Fechar">×</button>`}
      </div>
      <div id="tlPbarra"></div><div id="tlAviso"></div>
      <div class="tl-fil" id="tlFil"></div>
      <div class="tl-board" id="tlBoard"></div>
    </div>
    <div class="tl-modal hidden" id="tlModal"></div>`;
    (opts.container || document.body).appendChild(raiz);
    estado.raiz = raiz;
    raiz.addEventListener("click", clique);
    raiz.addEventListener("pointerdown", inicioArraste);
    if (!estado.cheia) raiz.addEventListener("pointerdown", e => { if (e.target === raiz) fechar(); });
    addEventListener("keydown", tecla);
    const aoMudar = () => { if (!estado) return; if (arr && arr.ativo) estado.pendente = true; else recarregar(); };
    if (Dados.ouvirTarefas) estado.canal = Dados.ouvirTarefas(aoMudar);
    if (Dados.ouvirProjetos) estado.canalP = Dados.ouvirProjetos(aoMudar);
    recarregar();
    return { fechar };
  }
  function tecla(e) { if (e.key === "Escape" && estado) { const m = estado.raiz.querySelector("#tlModal"); if (!m.classList.contains("hidden")) m.classList.add("hidden"); else if (!estado.cheia) fechar(); } }
  function fechar() {
    if (!estado) return; removeEventListener("keydown", tecla);
    if (estado.canal && Dados.cliente) Dados.cliente.removeChannel(estado.canal);
    if (estado.canalP && Dados.cliente) Dados.cliente.removeChannel(estado.canalP);
    estado.raiz.remove(); const cb = estado.aoFechar; estado = null; if (cb) cb();
  }
  /* projetos: cada um tem responsável e prazo; dentro dele, o Kanban das tarefas.
     estado.projeto: null = lista de projetos · "_avulsas" = tarefas sem projeto · id = um projeto */
  const AVULSAS = "_avulsas";
  async function recarregar() {
    if (!estado) return; estado.pendente = false;
    const [todas, projetos, usuarios] = await Promise.all([Dados.listarTarefas(), Dados.listarProjetos ? Dados.listarProjetos() : null, Dados.listarUsuarios()]);
    if (!estado) return;
    estado.usuarios = usuarios;
    estado.projetos = projetos ? filtrarSala(projetos, estado.sala, estado.salaPadrao) : null;
    const ids = new Set((estado.projetos || []).map(p => p.id));
    // tarefas deste telão: as dos projetos daqui + as avulsas da sala
    estado.todas = todas.filter(t => (t.projeto && ids.has(t.projeto)) || (!t.projeto || !projetos || !projetos.some(p => p.id === t.projeto)) && filtrarSala([t], estado.sala, estado.salaPadrao).length);
    if (estado.projeto && estado.projeto !== AVULSAS && !ids.has(estado.projeto)) estado.projeto = null; // projeto apagado
    if (!estado.projetos) estado.projeto = AVULSAS; // banco sem projetos: quadro único, como antes
    estado.tarefas = tarefasDoProjeto(estado.projeto);
    desenhar();
    if (estado.focar) { const t = estado.todas.find(x => x.id === estado.focar); estado.focar = null; if (t) { if (estado.projetos) { estado.projeto = t.projeto && ids.has(t.projeto) ? t.projeto : AVULSAS; estado.tarefas = tarefasDoProjeto(estado.projeto); desenhar(); } editar(t); } }
  }
  function tarefasDoProjeto(id) {
    if (!id) return estado.todas;
    const ids = new Set((estado.projetos || []).map(p => p.id));
    return id === AVULSAS ? estado.todas.filter(t => !t.projeto || !ids.has(t.projeto)) : estado.todas.filter(t => t.projeto === id);
  }
  const projDe = id => (estado.projetos || []).find(p => p.id === id) || null;
  function abrirProjeto(id) { estado.projeto = id; estado.filtro = "todas"; estado.tarefas = tarefasDoProjeto(id); desenhar(); estado.raiz.querySelector("#tlBoard").scrollLeft = 0; }
  function nomeResp(r) { if (!r) return ""; const u = estado.usuarios.find(u => u.email === r); return u ? u.nome : r; }
  // vários responsáveis por tarefa: guardados no mesmo campo, separados por ";" (e-mail de usuário ou nome livre)
  const respsDe = t => String((t && t.responsavel) || "").split(";").map(x => x.trim()).filter(Boolean);
  function minha(t) { return respsDe(t).some(r => r === estado.email || r === estado.nome || nomeResp(r) === estado.nome); }
  const listaNomes = l => l.length <= 2 ? l.join(" e ") : `${l.slice(0, 2).join(", ")} +${l.length - 2}`;
  const meuResp = r => r === estado.email || r === estado.nome || nomeResp(r) === estado.nome;
  const avatar = (n, cls = "av") => `<span class="${cls}" style="background:${corNome(n)}">${esc(iniciais(n))}</span>`;
  function desenharProjetos() {
    const r = estado.raiz, ps = estado.projetos;
    const abertos = ps.filter(p => p.status === "ativo"), atrasados = abertos.filter(p => p.prazo && diasAtrasoData(p.prazo) > 0);
    r.querySelector("#tlSum").innerHTML = `<b>${abertos.length}</b> projeto${abertos.length === 1 ? "" : "s"} em andamento · ${atrasados.length ? `<b>⚠ ${atrasados.length} atrasado${atrasados.length > 1 ? "s" : ""}</b>` : "nenhum atrasado"}`;
    r.querySelector("#tlNova").textContent = "+ Novo projeto"; r.querySelector("#tlNova").dataset.nova = "projeto";
    r.querySelector("#tlPbarra").innerHTML = "";
    const fil = [["ativos", "Em andamento"], ["meus", "Sou responsável"], ["comigo", "Com tarefas minhas"], ["semana", "📅 Minha semana"], ["fechados", "Concluídos"]];
    r.querySelector("#tlFil").innerHTML = fil.map(([k, l]) => `<button data-filp="${k}" class="${estado.filtroP === k ? "on" : ""}">${l}</button>`).join("");
    const board = r.querySelector("#tlBoard");
    if (estado.filtroP === "semana") { board.className = "tl-board"; board.innerHTML = minhaSemana(estado.todas); return; }
    const passa = p => estado.filtroP === "fechados" ? p.status !== "ativo"
      : p.status === "ativo" && (estado.filtroP === "ativos" || (estado.filtroP === "meus" && respsDe(p).some(meuResp)) || (estado.filtroP === "comigo" && tarefasDoProjeto(p.id).some(t => t.status !== "feito" && minha(t))));
    const lista = ps.filter(passa).sort((a, b) => (a.prazo || "9999") < (b.prazo || "9999") ? -1 : 1);
    const avulsas = tarefasDoProjeto(AVULSAS);
    board.className = "tl-projs";
    board.innerHTML = lista.map(cartaoProjeto).join("")
      + (estado.filtroP === "ativos" && avulsas.length ? cartaoProjeto({ id: AVULSAS, titulo: "Tarefas avulsas", descricao: "Tarefas que não estão em nenhum projeto", status: "ativo" }) : "")
      + (estado.filtroP === "ativos" ? `<button class="tl-pnovo" data-nova="projeto">+ Novo projeto</button>` : "")
      + (!lista.length && estado.filtroP !== "ativos" ? `<div class="tl-vazio" style="grid-column:1/-1;padding:40px">Nenhum projeto aqui.</div>` : "");
  }
  function cartaoProjeto(p) {
    const ts = tarefasDoProjeto(p.id), sm = resumo(ts), atr = p.prazo && p.status === "ativo" ? diasAtrasoData(p.prazo) : 0;
    const atrasadas = ts.filter(t => diasAtraso(t) > 0).length;
    const equipe = [...new Set(ts.flatMap(respsDe).map(nomeResp))];
    const prox = ts.filter(t => t.status !== "feito" && t.prazo).sort((a, b) => a.prazo < b.prazo ? -1 : 1)[0];
    const cor = sm.media >= 100 ? "#3fbf5f" : atrasadas ? "#e5484d" : "#1a7f4b";
    const av = p.id === AVULSAS;
    return `<button class="tl-proj ${av ? "avulsas" : ""} ${p.status !== "ativo" ? "fechado" : ""}" data-proj="${p.id}" style="--c:${esc(p.cor || "#1a7f4b")}">
      <h3>${esc(p.titulo)}${p.status === "concluido" ? " ✅" : p.status === "arquivado" ? " 🗄️" : ""}</h3>
      ${av ? `<div class="lin">${esc(p.descricao)}</div>` : `<div class="lin"><span class="rot">Responsáve${respsDe(p).length > 1 ? "is" : "l"}</span>${respsDe(p).length ? `<span class="avs">${respsDe(p).slice(0, 4).map(r => avatar(nomeResp(r))).join("")}</span><b>${esc(listaNomes(respsDe(p).map(nomeResp)))}</b>` : "<span>sem responsável</span>"}</div>
      <div class="lin"><span class="rot">Entrega</span>${p.prazo ? `<b class="${atr > 0 ? "atr" : ""}">${fmtData(p.prazo)}${atr > 0 ? ` · atrasado ${atr}d` : ""}</b>` : "<span>sem prazo</span>"}</div>`}
      <div class="lin"><div class="bar"><i style="width:${sm.media}%;background:${cor}"></i></div><b>${sm.media}%</b></div>
      <div class="lin"><span>${sm.feitas}/${sm.total} tarefa${sm.total === 1 ? "" : "s"}</span>${atrasadas ? `<span class="atr">· ${atrasadas} atrasada${atrasadas > 1 ? "s" : ""}</span>` : ""}${sm.escalonadas ? `<span class="atr">· ⚠ ${sm.escalonadas}</span>` : ""}
        ${equipe.length ? `<span class="avs" style="margin-left:auto" title="${esc(equipe.join(", "))}">${equipe.slice(0, 5).map(n => avatar(n)).join("")}</span>` : ""}</div>
      ${prox ? `<div class="lin"><span class="rot">Próxima</span><span>${esc(prox.titulo.slice(0, 40))} · ${esc(respsDe(prox).map(nomeResp)[0] || "sem resp.")} · ${fmtData(prox.prazo)}</span></div>` : ""}
    </button>`;
  }
  function barraProjeto() {
    if (!estado.projetos) return "";
    const p = estado.projeto === AVULSAS ? null : projDe(estado.projeto), sm = resumo(estado.tarefas);
    const atr = p && p.prazo && p.status === "ativo" ? diasAtrasoData(p.prazo) : 0;
    return `<div class="tl-pbarra"><button class="volta" data-voltar>← Projetos</button>
      <h3><i style="background:${esc(p ? p.cor : "#9a948a")}"></i>${esc(p ? p.titulo : "Tarefas avulsas")}</h3>
      ${p ? `<span><span class="rot">Responsáve${respsDe(p).length > 1 ? "is" : "l"} do projeto</span>${respsDe(p).length ? respsDe(p).map(r => avatar(nomeResp(r))).join("") + esc(listaNomes(respsDe(p).map(nomeResp))) : "—"}</span>
      <span><span class="rot">Entrega</span>${p.prazo ? `<b class="${atr > 0 ? "atr" : ""}">${fmtData(p.prazo)}${atr > 0 ? ` (atrasado ${atr}d)` : ""}</b>` : "—"}</span>` : ""}
      <span><b>${sm.media}%</b> · ${sm.feitas}/${sm.total} feitas</span>
      ${p ? `<button class="volta" data-editproj style="margin-left:auto">✏️ Editar projeto</button>` : ""}</div>`;
  }
  function desenhar() {
    if (estado.projetos && !estado.projeto) return desenharProjetos();
    const r = estado.raiz, ts = estado.tarefas, sm = resumo(ts);
    r.querySelector("#tlBoard").className = "tl-board";
    r.querySelector("#tlNova").textContent = "+ Nova tarefa"; r.querySelector("#tlNova").dataset.nova = "";
    r.querySelector("#tlPbarra").innerHTML = barraProjeto();
    r.querySelector("#tlAviso").innerHTML = estado.projetos ? "" : `<div class="tl-aviso">Para organizar as tarefas em projetos, rode o arquivo <b>rodar_no_supabase_12.sql</b> no Supabase.</div>`;
    r.querySelector("#tlSum").innerHTML = `<b>${sm.media}%</b> concluído · ${sm.ativas} abertas · ${sm.escalonadas ? `<b>⚠ ${sm.escalonadas} escalonada${sm.escalonadas > 1 ? "s" : ""}</b>` : "nada escalonado"}`;
    const fil = [["todas", "Todas"], ["minhas", "Minhas"], ["semana", "📅 Minha semana"], ["escalonadas", "⚠ Escalonadas"], ["semdono", "Sem responsável"]];
    r.querySelector("#tlFil").innerHTML = fil.map(([k, l]) => `<button data-fil="${k}" class="${estado.filtro === k ? "on" : ""}">${l}</button>`).join("");
    const passa = t => estado.filtro === "todas" || (estado.filtro === "minhas" && minha(t)) || (estado.filtro === "escalonadas" && nivel(t) > 0) || (estado.filtro === "semdono" && !respsDe(t).length);
    if (estado.filtro === "semana") { r.querySelector("#tlBoard").innerHTML = minhaSemana(ts); return; }
    r.querySelector("#tlBoard").innerHTML = STATUS.map(st => {
      const lista = ts.filter(t => (t.status || "a_fazer") === st.id && passa(t));
      return `<section class="tl-col" data-st="${st.id}"><h4><i style="background:${st.cor}"></i>${st.nome}<span>${lista.length}</span></h4>
        <div class="tl-list">${lista.map(cartao).join("") || `<div class="tl-vazio">${st.id === "a_fazer" && !ts.length ? "Nenhuma tarefa ainda. Crie a primeira!" : "Arraste tarefas para cá"}</div>`}</div>
        <button class="tl-add" data-nova="${st.id}">+ Adicionar</button></section>`;
    }).join("");
  }
  // minhas tarefas abertas por dia: atrasadas, hoje, próximos 7 dias e sem prazo
  function minhaSemana(ts) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const grupos = new Map([["atr", { nome: "⚠ Atrasadas", l: [] }]]);
    for (let i = 0; i < 7; i++) { const d = new Date(hoje); d.setDate(hoje.getDate() + i);
      grupos.set("d" + i, { nome: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }), l: [] }); }
    grupos.set("depois", { nome: "Mais pra frente", l: [] }); grupos.set("sem", { nome: "Sem prazo", l: [] });
    for (const t of ts.filter(t => minha(t) && t.status !== "feito")) {
      if (!t.prazo) { grupos.get("sem").l.push(t); continue; }
      const dd = Math.round((new Date(t.prazo + "T00:00:00") - hoje) / 864e5);
      grupos.get(dd < 0 ? "atr" : dd < 7 ? "d" + dd : "depois").l.push(t);
    }
    const cols = [...grupos.values()].filter(g => g.l.length);
    if (!cols.length) return `<div class="tl-vazio" style="grid-column:1/-1;padding:40px">Nenhuma tarefa aberta com você neste telão. 🎉</div>`;
    return cols.map(g => `<section class="tl-col"><h4 style="text-transform:capitalize">${esc(g.nome)}<span>${g.l.length}</span></h4><div class="tl-list">${g.l.map(cartao).join("")}</div></section>`).join("");
  }
  // @menções: usuários cujo nome (ou primeiro nome) aparece depois de um @
  function mencoes(texto) {
    const t = " " + String(texto || "").toLowerCase();
    return estado.usuarios.filter(u => { const n = String(u.nome || "").toLowerCase().trim(); return n && (t.includes("@" + n) || t.includes("@" + n.split(/\s+/)[0])); });
  }
  function cartao(t) {
    const p = progresso(t), n = nivel(t), atr = diasAtraso(t), resps = respsDe(t).map(nomeResp);
    const nCom = (t.comentarios || []).length;
    const textoResp = resps.length <= 2 ? resps.join(" e ") : `${resps.slice(0, 2).join(", ")} +${resps.length - 2}`;
    const cor = p >= 100 ? "#3fbf5f" : n >= 2 ? "#e5484d" : n === 1 ? "#f2a33a" : "#1a7f4b";
    const et = t.etapas && t.etapas.length ? `☑ ${t.etapas.filter(e => e.feito).length}/${t.etapas.length}` : "";
    const pj = t.projeto && projDe(t.projeto), fora = pj && pj.prazo && t.prazo && t.prazo > pj.prazo;
    return `<div class="tl-card ${n ? "n" + n : ""}" data-id="${t.id}">
      <div class="alca" title="Arrastar" aria-label="Arrastar">⠿</div>
      ${pj && estado.projeto !== t.projeto ? `<span class="ptag" style="background:${esc(pj.cor)}">${esc(pj.titulo)}</span>` : ""}
      <div class="t">${esc(t.titulo)}</div>
      <div class="meta">${resps.length ? `<span class="avs" title="${esc(resps.join(", "))}">${resps.slice(0, 3).map(n => `<span class="av" style="background:${corNome(n)}">${esc(iniciais(n))}</span>`).join("")}</span><span>${esc(textoResp)}</span>` : `<span>Sem responsável</span>`}
        ${t.prazo ? `<span class="${atr > 0 ? "atr" : ""}">· ${atr > 0 ? `atrasada ${atr}d` : "até " + fmtData(t.prazo)}</span>` : ""}${et ? `<span>· ${et}</span>` : ""}${nCom ? `<span>· 💬 ${nCom}</span>` : ""}</div>
      ${fora ? `<div class="meta"><span class="fora">⚠ prazo depois da entrega do projeto (${fmtData(pj.prazo)})</span></div>` : ""}
      <div class="meta" style="margin-top:6px"><div class="bar" style="flex:1;margin:0"><i style="width:${p}%;background:${cor}"></i></div><span class="pc">${p}%</span></div>
      ${n ? `<div class="esc">⚠ ${NIVEL[n]}</div>` : ""}
    </div>`;
  }

  /* ---------- cliques ---------- */
  let ignorarClique = false;
  function clique(e) {
    if (ignorarClique) { ignorarClique = false; return; }
    const r = estado.raiz;
    if (e.target.closest("[data-fechar]")) return fechar();
    const f = e.target.closest("[data-fil]"); if (f) { estado.filtro = f.dataset.fil; return desenhar(); }
    const fp = e.target.closest("[data-filp]"); if (fp) { estado.filtroP = fp.dataset.filp; return desenhar(); }
    if (e.target.closest("[data-voltar]")) { estado.projeto = null; return desenhar(); }
    if (e.target.closest("[data-editproj]")) return editarProjeto(projDe(estado.projeto));
    const pj = e.target.closest("[data-proj]"); if (pj) return abrirProjeto(pj.dataset.proj);
    const nv = e.target.closest("[data-nova]"); if (nv) return nv.dataset.nova === "projeto" ? editarProjeto(null) : editar(null, nv.dataset.nova || "a_fazer");
    const c = e.target.closest(".tl-card"); if (c && !e.target.closest(".alca")) return editar(estado.todas.find(t => t.id === c.dataset.id));
  }

  /* ---------- formulário ---------- */
  function editar(t, status) {
    const novo = !t;
    const projAtual = estado.projeto && estado.projeto !== AVULSAS ? projDe(estado.projeto) : null;
    const d = t ? JSON.parse(JSON.stringify(t)) : { titulo: "", descricao: "", responsavel: "", prazo: "", status: status || "a_fazer", etapas: [], progressoManual: 0,
      sala: (projAtual && projAtual.sala) || estado.sala || null, projeto: projAtual ? projAtual.id : null };
    d.etapas = d.etapas || [];
    const m = estado.raiz.querySelector("#tlModal");
    const opts = estado.usuarios.map(u => `<option value="${esc(u.email)}">${esc(u.nome)}</option>`).join("");
    const addResp = v => {
      v = String(v || "").trim().replace(/[;,]+$/, ""); if (!v) return;
      const u = estado.usuarios.find(u => u.email === v || u.nome === v), val = u ? u.email : v.replace(/;/g, " ");
      const l = respsDe(d); if (!l.includes(val)) l.push(val); d.responsavel = l.join(";");
    };
    let desenhando = false;
    const render = () => {
      if (desenhando) return; desenhando = true;
      const p = progresso(d);
      try { m.innerHTML = `<form class="tl-form" autocomplete="off">
        <h3>${novo ? "Nova tarefa" : "Editar tarefa"}<button type="button" class="tl-btn" data-x style="background:none;font-size:22px">×</button></h3>
        <div class="tl-f"><label>Tarefa</label><input name="titulo" required maxlength="120" value="${esc(d.titulo)}" placeholder="Ex.: Campanha Black Friday do cliente X"></div>
        <div class="tl-row">
          <div class="tl-f"><label>Responsáveis da tarefa</label>
            <div class="tl-resps">${respsDe(d).map((r, i) => `<span class="tl-chip"><span class="av" style="background:${corNome(nomeResp(r))}">${esc(iniciais(nomeResp(r)))}</span>${esc(nomeResp(r))}<button type="button" data-rmresp="${i}" aria-label="Tirar ${esc(nomeResp(r))}">×</button></span>`).join("")}
              <input name="responsavel" list="tlUsers" placeholder="${respsDe(d).length ? "+ adicionar" : "Nome ou e-mail e Enter"}"></div><datalist id="tlUsers">${opts}</datalist></div>
          <div class="tl-f"><label>Prazo de entrega</label><input name="prazo" type="date" value="${esc(d.prazo || "")}">
            ${(() => { const pj = d.projeto && projDe(d.projeto); return pj && pj.prazo && d.prazo && d.prazo > pj.prazo ? `<small style="color:#b3261e;font-weight:700">⚠ Depois da entrega do projeto (${fmtData(pj.prazo)})</small>` : pj && pj.prazo ? `<small style="color:var(--mut,#6b6760)">Projeto entrega em ${fmtData(pj.prazo)}</small>` : ""; })()}</div>
        </div>
        ${estado.projetos ? `<div class="tl-f"><label>Projeto</label><select name="projeto"><option value="">Sem projeto (tarefa avulsa)</option>${estado.projetos.filter(p => p.status === "ativo" || p.id === d.projeto).map(p => `<option value="${esc(p.id)}" ${p.id === d.projeto ? "selected" : ""}>${esc(p.titulo)}</option>`).join("")}</select></div>` : ""}
        <div class="tl-row">
          <div class="tl-f"><label>Status</label><select name="status">${STATUS.map(s => `<option value="${s.id}" ${s.id === d.status ? "selected" : ""}>${s.nome}</option>`).join("")}</select></div>
          <div class="tl-f"><label>Progresso</label>${d.etapas.length ? `<div style="padding:9px 0;font-weight:800">${p}% <span style="font-weight:400;color:var(--mut,#6b6760)">(pelas etapas)</span></div>` : `<div class="tl-pbar"><input name="progressoManual" type="range" min="0" max="100" step="5" value="${+d.progressoManual || 0}"><b id="tlPv">${+d.progressoManual || 0}%</b></div>`}</div>
        </div>
        <div class="tl-f"><label>Etapas (checklist)</label>
          <div>${d.etapas.map((e, i) => `<div class="tl-et ${e.feito ? "ok" : ""}"><input type="checkbox" data-et="${i}" ${e.feito ? "checked" : ""}><span>${esc(e.texto)}</span><button type="button" data-rmet="${i}" aria-label="Remover etapa">×</button></div>`).join("") || `<div style="color:var(--mut,#6b6760);font-size:13px">Sem etapas. Com etapas, o % é calculado sozinho.</div>`}</div>
          <div class="tl-novaet"><input id="tlEt" placeholder="Nova etapa e Enter" maxlength="120"><button type="button" class="tl-btn" data-addet style="background:var(--chip,#f3f1ec);border:1px solid var(--line,#e4dfd5)">+</button></div>
        </div>
        <div class="tl-f"><label>Observações</label><textarea name="descricao" rows="3" maxlength="1000">${esc(d.descricao || "")}</textarea></div>
        ${nivel(d) ? `<div class="tl-card n${nivel(d)}" style="cursor:default;padding:8px"><div class="esc" style="margin:0">⚠ ${NIVEL[nivel(d)]}${d.status === "bloqueado" ? " — tarefa bloqueada" : ""}${diasAtraso(d) > 0 ? ` — ${diasAtraso(d)} dia(s) de atraso` : ""}</div></div>` : ""}
        <div class="tl-acts"><button class="tl-btn pri" type="submit">Salvar</button><button class="tl-btn" type="button" data-x>Cancelar</button>${novo ? "" : `<button class="tl-btn dan" type="button" data-del>Excluir</button>`}</div>
        ${t ? `<div class="tl-f tl-coms"><label>Comentários</label>
          ${(d.comentarios || []).map(c => `<div class="tl-com"><span class="av" style="background:${corNome(c.nome || "")}">${esc(iniciais(c.nome || "?"))}</span><div><b>${esc(c.nome || "—")}</b> <small>${new Date(c.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small><p>${esc(c.texto).replace(/@([\wÀ-ÿ]+)/g, '<b class="men">@$1</b>')}</p></div></div>`).join("") || `<div style="color:var(--mut,#6b6760);font-size:13px">Nenhum comentário ainda.</div>`}
          <div class="tl-novaet"><textarea id="tlCom" rows="2" maxlength="1500" placeholder="Comentar… use @nome para avisar alguém"></textarea><button type="button" class="tl-btn pri" data-comentar style="background:#1a7f4b;color:#fff">Enviar</button></div></div>` : ""}
        ${t && t.historico ? `<div class="tl-hist"><b>Histórico</b>${t.historico.slice(-6).reverse().map(h => `<div>${new Date(h.quando).toLocaleString("pt-BR")} · ${esc(nomeResp(h.email) || "—")} · ${esc(h.acao)}</div>`).join("")}</div>` : ""}
      </form>`; } finally { desenhando = false; }
      const f = m.querySelector("form");
      const ler = () => { d.titulo = f.titulo.value; d.descricao = f.descricao.value; d.prazo = f.prazo.value; d.status = f.status.value;
        if (f.projeto) { d.projeto = f.projeto.value || null; const pj = projDe(d.projeto); if (pj && pj.sala) d.sala = pj.sala; }
        addResp(f.responsavel.value);
        if (f.progressoManual) d.progressoManual = +f.progressoManual.value; };
      // responsáveis: escolher da lista (ou digitar e Enter) adiciona; × tira
      f.responsavel.onkeydown = e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); ler(); render(); m.querySelector("[name=responsavel]").focus(); } };
      f.responsavel.onchange = () => { if (estado.usuarios.some(u => u.email === f.responsavel.value)) { ler(); render(); m.querySelector("[name=responsavel]").focus(); } };
      m.querySelectorAll("[data-rmresp]").forEach(b => b.onclick = () => { ler(); const l = respsDe(d); l.splice(+b.dataset.rmresp, 1); d.responsavel = l.join(";"); render(); });
      if (f.progressoManual) f.progressoManual.oninput = e => { m.querySelector("#tlPv").textContent = e.target.value + "%"; };
      f.status.onchange = () => { ler(); render(); };
      f.prazo.onchange = () => { ler(); render(); };
      if (f.projeto) f.projeto.onchange = () => { ler(); render(); };
      const addEt = () => { const i = m.querySelector("#tlEt"); const v = i.value.trim(); if (!v) return; ler(); d.etapas.push({ id: Math.random().toString(36).slice(2, 8), texto: v, feito: false }); render(); m.querySelector("#tlEt").focus(); };
      m.querySelector("#tlEt").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); addEt(); } };
      m.querySelector("[data-addet]").onclick = addEt;
      m.querySelectorAll("[data-et]").forEach(c => c.onchange = () => { ler(); d.etapas[+c.dataset.et].feito = c.checked; if (d.etapas.every(e => e.feito) && d.status !== "feito") d.status = "feito"; else if (!d.etapas.every(e => e.feito) && d.status === "feito") d.status = "andamento"; else if (d.status === "a_fazer" && c.checked) d.status = "andamento"; render(); });
      m.querySelectorAll("[data-rmet]").forEach(b => b.onclick = () => { ler(); d.etapas.splice(+b.dataset.rmet, 1); render(); });
      m.querySelectorAll("[data-x]").forEach(b => b.onclick = () => m.classList.add("hidden"));
      const bc = m.querySelector("[data-comentar]");
      if (bc) bc.onclick = async () => {
        const ta = m.querySelector("#tlCom"), texto = ta.value.trim(); if (!texto) return;
        bc.disabled = true;
        try {
          const c = await Dados.comentarTarefa(t.id, texto); ler();
          d.comentarios = (d.comentarios || []).concat(c); t.comentarios = d.comentarios;
          const meuId = Dados.meuId && Dados.meuId();
          const alvos = new Map(mencoes(texto).map(u => [u.id, "mencionou você"]));
          for (const r of respsDe(d)) { const u = estado.usuarios.find(u => u.email === r); if (u && !alvos.has(u.id)) alvos.set(u.id, "comentou"); }
          if (Dados.criarAvisos) Dados.criarAvisos([...alvos].filter(([id]) => id !== meuId).map(([id, acao]) => ({ para: id, tipo: acao === "comentou" ? "tarefa" : "mencao",
            texto: `${estado.nome || "Alguém"} ${acao} em “${d.titulo}”: ${texto.slice(0, 120)}`, dados: { tarefa: t.id, mapa: window.mapaIdAtual || null } })));
          render();
        } catch (err) { bc.disabled = false; alert(/comentar_tarefa|function/i.test(err.message || "") ? "Para comentar, rode o arquivo rodar_no_supabase_6.sql no Supabase." : "Não consegui comentar: " + (err.message || "")); }
      };
      const del = m.querySelector("[data-del]");
      if (del) del.onclick = async () => { if (del.dataset.ok) { await Dados.excluirTarefa(t.id, estado.email); m.classList.add("hidden"); recarregar(); } else { del.dataset.ok = 1; del.textContent = "Confirmar exclusão"; } };
      f.onsubmit = async e => {
        e.preventDefault(); ler(); if (!d.titulo.trim()) { f.titulo.focus(); return; }
        let acao = novo ? "Criou a tarefa" : "Editou a tarefa";
        if (!novo && t.status !== d.status) acao = `Moveu para "${STATUS.find(s => s.id === d.status).nome}"`;
        if (!novo && d.status === "feito" && t.status !== "feito") acao = "Concluiu a tarefa";
        if (novo) d.ordem = Math.max(0, ...estado.todas.filter(x => x.status === d.status).map(x => (x.ordem ?? 0) + 1));
        if (!novo && (t.projeto || null) !== (d.projeto || null)) acao = d.projeto ? `Moveu para o projeto "${(projDe(d.projeto) || {}).titulo || ""}"` : "Tirou do projeto";
        const salva = await Dados.salvarTarefa(d, estado.email, acao); if (salva && salva.id) d.id = salva.id;
        // avisa quem acabou de virar responsável
        const antes = new Set(novo ? [] : respsDe(t)), meuId = Dados.meuId && Dados.meuId();
        const novos = respsDe(d).filter(r => !antes.has(r)).map(r => estado.usuarios.find(u => u.email === r)).filter(u => u && u.id !== meuId);
        if (novos.length && Dados.criarAvisos && d.id) Dados.criarAvisos(novos.map(u => ({ para: u.id, tipo: "tarefa", texto: `${estado.nome || "Alguém"} colocou você como responsável em “${d.titulo}”${d.prazo ? " (prazo " + fmtData(d.prazo) + ")" : ""}`, dados: { tarefa: d.id, mapa: window.mapaIdAtual || null } })));
        m.classList.add("hidden"); recarregar();
      };
    };
    render();
    m.classList.remove("hidden");
    setTimeout(() => { const i = m.querySelector("[name=titulo]"); if (novo && i) i.focus(); }, 30);
  }

  /* ---------- formulário do projeto ---------- */
  const CORES = ["#1a7f4b", "#2b6de8", "#7248b9", "#d9480f", "#c2255c", "#0b7d7d", "#a86a00", "#495057"];
  function editarProjeto(p) {
    const novo = !p, m = estado.raiz.querySelector("#tlModal");
    const d = p ? JSON.parse(JSON.stringify(p)) : { titulo: "", descricao: "", responsavel: estado.email, prazo: "", cor: CORES[(estado.projetos || []).length % CORES.length], status: "ativo", sala: estado.sala || null };
    const opts = estado.usuarios.map(u => `<option value="${esc(u.email)}">${esc(u.nome)}</option>`).join("");
    const ts = p ? tarefasDoProjeto(p.id) : [];
    const addResp = v => { v = String(v || "").trim().replace(/[;,]+$/, ""); if (!v) return;
      const u = estado.usuarios.find(u => u.email === v || u.nome === v), val = u ? u.email : v.replace(/;/g, " ");
      const l = respsDe(d); if (!l.includes(val)) l.push(val); d.responsavel = l.join(";"); };
    const ler = f => { d.titulo = f.titulo.value; d.prazo = f.prazo.value; d.descricao = f.descricao.value; d.cor = (f.querySelector("[name=cor]:checked") || {}).value || d.cor; if (f.status) d.status = f.status.value; addResp(f.responsavel.value); };
    let desenhando = false;
    const render = () => {
    if (desenhando) return; desenhando = true;
    try { m.innerHTML = `<form class="tl-form" autocomplete="off">
      <h3>${novo ? "Novo projeto" : "Editar projeto"}<button type="button" class="tl-btn" data-x style="background:none;font-size:22px">×</button></h3>
      <div class="tl-f"><label>Projeto</label><input name="titulo" required maxlength="100" value="${esc(d.titulo)}" placeholder="Ex.: Lançamento do site do cliente X"></div>
      <div class="tl-row">
        <div class="tl-f"><label>Responsáveis do projeto</label>
          <div class="tl-resps">${respsDe(d).map((r, i) => `<span class="tl-chip"><span class="av" style="background:${corNome(nomeResp(r))}">${esc(iniciais(nomeResp(r)))}</span>${esc(nomeResp(r))}<button type="button" data-rmresp="${i}" aria-label="Tirar ${esc(nomeResp(r))}">×</button></span>`).join("")}
            <input name="responsavel" list="tlUsersP" placeholder="${respsDe(d).length ? "+ adicionar" : "Nome ou e-mail e Enter"}"></div><datalist id="tlUsersP">${opts}</datalist></div>
        <div class="tl-f"><label>Entrega do projeto</label><input name="prazo" type="date" value="${esc(d.prazo || "")}"></div>
      </div>
      <div class="tl-f"><label>Cor</label><div class="tl-cores">${CORES.map(c => `<label style="background:${c}"><input type="radio" name="cor" value="${c}" ${c === d.cor ? "checked" : ""}><span></span></label>`).join("")}</div></div>
      ${novo ? "" : `<div class="tl-f"><label>Situação</label><select name="status">${[["ativo", "Em andamento"], ["concluido", "Concluído"], ["arquivado", "Arquivado"]].map(([k, l]) => `<option value="${k}" ${k === d.status ? "selected" : ""}>${l}</option>`).join("")}</select></div>`}
      <div class="tl-f"><label>Descrição</label><textarea name="descricao" rows="3" maxlength="1000" placeholder="Objetivo, cliente, links…">${esc(d.descricao || "")}</textarea></div>
      <p style="font-size:13px;color:var(--mut,#6b6760);margin:6px 0 0">Os responsáveis do projeto acompanham a entrega. Cada tarefa dentro do projeto tem o seu próprio responsável e prazo.</p>
      <div class="tl-acts"><button class="tl-btn pri" type="submit">${novo ? "Criar projeto" : "Salvar"}</button><button class="tl-btn" type="button" data-x>Cancelar</button>${novo ? "" : `<button class="tl-btn dan" type="button" data-del>Excluir projeto</button>`}</div>
    </form>`; } finally { desenhando = false; }
    const f = m.querySelector("form");
    f.responsavel.onkeydown = e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); ler(f); render(); m.querySelector("[name=responsavel]").focus(); } };
    f.responsavel.onchange = () => { if (estado.usuarios.some(u => u.email === f.responsavel.value)) { ler(f); render(); m.querySelector("[name=responsavel]").focus(); } };
    m.querySelectorAll("[data-rmresp]").forEach(b => b.onclick = () => { ler(f); const l = respsDe(d); l.splice(+b.dataset.rmresp, 1); d.responsavel = l.join(";"); render(); });
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = () => m.classList.add("hidden"));
    const del = m.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      if (!del.dataset.ok) { del.dataset.ok = 1; del.textContent = ts.length ? `Confirmar (as ${ts.length} tarefas viram avulsas)` : "Confirmar exclusão"; return; }
      await Dados.excluirProjeto(p.id); m.classList.add("hidden"); estado.projeto = null; recarregar();
    };
    f.onsubmit = async e => {
      e.preventDefault(); if (!f.titulo.value.trim()) return f.titulo.focus();
      ler(f); d.titulo = d.titulo.trim(); d.status = d.status || "ativo";
      const antes = new Set(p ? respsDe(p) : []);
      if (novo) d.ordem = (estado.projetos || []).length;
      let salvo;
      try { salvo = await Dados.salvarProjeto(d, novo ? "Criou o projeto" : p.status !== d.status ? (d.status === "concluido" ? "Concluiu o projeto" : d.status === "arquivado" ? "Arquivou o projeto" : "Reabriu o projeto") : "Editou o projeto"); }
      catch (err) { alert("Não consegui salvar o projeto: " + (err.message || "")); return; }
      const meuId = Dados.meuId && Dados.meuId();
      const novos = respsDe(d).filter(r => !antes.has(r)).map(r => estado.usuarios.find(u => u.email === r)).filter(u => u && u.id !== meuId);
      if (novos.length && Dados.criarAvisos) Dados.criarAvisos(novos.map(u => ({ para: u.id, tipo: "tarefa", texto: `${estado.nome || "Alguém"} colocou você como responsável pelo projeto “${d.titulo}”${d.prazo ? " (entrega " + fmtData(d.prazo) + ")" : ""}`, dados: { mapa: window.mapaIdAtual || null } })));
      m.classList.add("hidden");
      if (novo) estado.projeto = salvo.id;
      recarregar();
    };
    };
    render();
    m.classList.remove("hidden");
    setTimeout(() => { const i = m.querySelector("[name=titulo]"); if (novo && i) i.focus(); }, 30);
  }

  /* ---------- arrastar entre colunas ---------- */
  let arr = null;
  function inicioArraste(e) {
    const card = e.target.closest(".tl-card[data-id]"); if (!card) return;
    const alca = e.target.closest(".alca");
    if (!alca && e.pointerType !== "mouse") return; // no toque, arraste pela alça ⠿
    if (e.button && e.button !== 0) return;
    arr = { card, id: card.dataset.id, x0: e.clientX, y0: e.clientY, ativo: false, pid: e.pointerId };
    addEventListener("pointermove", moveArraste); addEventListener("pointerup", fimArraste); addEventListener("pointercancel", fimArraste);
    if (alca) { e.preventDefault(); comecar(e); }
  }
  function comecar(e) {
    const r = arr.card.getBoundingClientRect();
    arr.ativo = true; arr.dx = e.clientX - r.left; arr.dy = e.clientY - r.top;
    arr.ghost = arr.card.cloneNode(true); arr.ghost.classList.add("tl-ghost"); arr.ghost.style.width = r.width + "px";
    document.body.appendChild(arr.ghost); arr.card.classList.add("arrastando");
    arr.ph = document.createElement("div"); arr.ph.className = "tl-ph";
    posicionar(e);
  }
  function moveArraste(e) {
    if (!arr) return;
    if (!arr.ativo) { if (Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) < 6) return; comecar(e); }
    e.preventDefault(); posicionar(e);
  }
  function posicionar(e) {
    arr.ghost.style.left = (e.clientX - arr.dx) + "px"; arr.ghost.style.top = (e.clientY - arr.dy) + "px";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    let col = el && el.closest && el.closest(".tl-col");
    if (col && !col.dataset.st) col = null; // colunas da "Minha semana" não são status: lá não dá para soltar
    estado.raiz.querySelectorAll(".tl-col.alvo").forEach(c => c !== col && c.classList.remove("alvo"));
    // rolar o quadro na horizontal perto das bordas (celular)
    const board = estado.raiz.querySelector("#tlBoard"), br = board.getBoundingClientRect();
    if (e.clientX > br.right - 40) board.scrollLeft += 14; else if (e.clientX < br.left + 40) board.scrollLeft -= 14;
    if (!col) { arr.alvo = null; arr.ph.remove(); return; }
    col.classList.add("alvo");
    const lista = col.querySelector(".tl-list");
    const cards = [...lista.querySelectorAll(".tl-card:not(.arrastando)")];
    let antes = null; for (const c of cards) { const r = c.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { antes = c; break; } }
    const vazio = lista.querySelector(".tl-vazio"); if (vazio) vazio.remove();
    lista.insertBefore(arr.ph, antes);
    arr.alvo = { status: col.dataset.st, lista };
  }
  async function fimArraste() {
    removeEventListener("pointermove", moveArraste); removeEventListener("pointerup", fimArraste); removeEventListener("pointercancel", fimArraste);
    const a = arr; arr = null; if (!a || !a.ativo) return;
    ignorarClique = true; setTimeout(() => ignorarClique = false, 50);
    a.ghost.remove(); a.card.classList.remove("arrastando");
    estado.raiz.querySelectorAll(".tl-col.alvo").forEach(c => c.classList.remove("alvo"));
    if (!a.alvo) { a.ph.remove(); return; }
    // nova ordem da coluna de destino
    const ids = []; for (const n of a.alvo.lista.children) { if (n === a.ph) ids.push(a.id); else if (n.dataset && n.dataset.id && n.dataset.id !== a.id) ids.push(n.dataset.id); }
    a.ph.remove();
    const t = estado.todas.find(x => x.id === a.id), antes = t.status;
    await Dados.salvarOrdem(ids.map((id, i) => ({ id, status: a.alvo.status, ordem: i })));
    if (antes !== a.alvo.status) {
      const nt = { ...t, status: a.alvo.status, ordem: ids.indexOf(a.id) };
      const nome = STATUS.find(s => s.id === a.alvo.status).nome;
      await Dados.salvarTarefa(nt, estado.email, a.alvo.status === "feito" ? "Concluiu a tarefa" : `Moveu para "${nome}"`);
    }
    recarregar();
  }

  /* ---------- tela do telão no mapa (dados reais) ---------- */
  /* tarefas de uma sala (as que não têm sala ficam na sala padrão) */
  function filtrarSala(lista, sala, padrao) { if (!sala) return lista; return lista.filter(t => (t.sala || padrao || null) === sala); }
  function desenharTela(g, x, y, tarefas, titulo) {
    // área da tela do sprite M38 (192x96): x 6..185, y 6..82
    g.save();
    g.fillStyle = "#121a2b"; g.fillRect(x + 6, y + 6, 180, 77);
    g.fillStyle = "#1a7f4b"; g.fillRect(x + 6, y + 6, 180, 9);
    g.fillStyle = "#ffffff"; g.font = "bold 7px system-ui,sans-serif"; g.textBaseline = "middle";
    const sm = resumo(tarefas);
    let tt0 = titulo || "TELÃO DA EQUIPE"; while (g.measureText(tt0).width > 140 && tt0.length > 4) tt0 = tt0.slice(0, -2); if (tt0 !== (titulo || "TELÃO DA EQUIPE")) tt0 += "…";
    g.fillText(tt0, x + 10, y + 10.5);
    g.textAlign = "right"; g.fillText(sm.total ? sm.media + "%" : "", x + 182, y + 10.5); g.textAlign = "left";
    const ativos = tarefas.filter(t => t.status !== "feito").sort((a, b) => nivel(b) - nivel(a) || progresso(b) - progresso(a)).slice(0, 5);
    if (!ativos.length) {
      g.fillStyle = "#cfd6e6"; g.font = "6px system-ui,sans-serif"; g.textAlign = "center";
      g.fillText(tarefas.length ? "Tudo em dia! 🎉" : "Sem tarefas — toque para criar", x + 96, y + 46); g.textAlign = "left";
    }
    ativos.forEach((t, i) => {
      const yy = y + 21 + i * 11, p = progresso(t), n = nivel(t);
      g.fillStyle = "#cfd6e6"; g.font = "6px system-ui,sans-serif";
      let tt = t.titulo; while (g.measureText(tt).width > 64 && tt.length > 3) tt = tt.slice(0, -2); if (tt !== t.titulo) tt += "…";
      g.fillText(tt, x + 10, yy + 3);
      g.fillStyle = "#2a3550"; g.fillRect(x + 78, yy, 90, 6);
      g.fillStyle = p >= 100 ? "#3fbf5f" : n >= 2 ? "#e5484d" : n ? "#f2a33a" : "#1a7f4b"; g.fillRect(x + 78, yy, Math.round(90 * p / 100), 6);
      g.fillStyle = "#ffffff"; g.fillText(String(p), x + 171, yy + 3);
    });
    if (sm.escalonadas) { g.fillStyle = "#e5484d"; g.fillRect(x + 10, y + 77, 4, 2); g.font = "bold 5px system-ui,sans-serif"; g.fillText(`${sm.escalonadas} ESCALONADA${sm.escalonadas > 1 ? "S" : ""}`, x + 17, y + 78); }
    g.restore();
  }

  return { abrir, fechar, progresso, nivel, resumo, desenharTela, filtrarSala, get aberto() { return !!estado; } };
})();
