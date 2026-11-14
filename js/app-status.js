/* =====================================================================
   STATUS DO APP EM TEMPO REAL
   Mostra ao lado do nome o app de trabalho que a pessoa está usando agora
   (Figma, Notion, VS Code...). Quem descobre o app é a extensão "Andar Status"
   (sites no navegador) e, opcionalmente, o "Andar Status para PC" (programas
   instalados). A pessoa liga/desliga e escolhe quais apps podem aparecer;
   também dá para marcar à mão ("Estou no Figma").
   ===================================================================== */
(function () {
  // id -> nome, cor do selo e sigla (selo simples, sem logo de terceiros)
  const APPS = {
    figma: ["Figma", "#a259ff", "Fg"], notion: ["Notion", "#2f2f2f", "N"], canva: ["Canva", "#00b8d9", "Cv"],
    gdocs: ["Google Docs", "#2b6de8", "Doc"], gsheets: ["Google Planilhas", "#1e8e3e", "Pl"], gslides: ["Google Apresentações", "#f4b400", "Ap"],
    gforms: ["Google Forms", "#7248b9", "Fm"], gdrive: ["Google Drive", "#1a73e8", "Dr"], gmail: ["Gmail", "#d93025", "M"],
    gcalendar: ["Google Agenda", "#1a73e8", "Ag"], meet: ["Google Meet", "#00897b", "Mt"],
    metaads: ["Gerenciador de Anúncios", "#0866ff", "Ads"], googleads: ["Google Ads", "#fbbc04", "GA"], ganalytics: ["Google Analytics", "#e8710a", "An"],
    vscode: ["VS Code", "#0078d4", "VS"], cursor: ["Cursor", "#1d1d1f", "Cu"], github: ["GitHub", "#24292f", "GH"], gitlab: ["GitLab", "#e24329", "GL"],
    sublime: ["Sublime Text", "#ff9800", "St"], intellij: ["IntelliJ", "#fe315d", "IJ"], pycharm: ["PyCharm", "#21d789", "Py"], webstorm: ["WebStorm", "#07c3f2", "WS"],
    androidstudio: ["Android Studio", "#3ddc84", "AS"], xcode: ["Xcode", "#1575f9", "Xc"],
    photoshop: ["Photoshop", "#31a8ff", "Ps"], illustrator: ["Illustrator", "#ff9a00", "Ai"], premiere: ["Premiere", "#9999ff", "Pr"],
    aftereffects: ["After Effects", "#9999ff", "Ae"], indesign: ["InDesign", "#ff3366", "Id"], lightroom: ["Lightroom", "#31a8ff", "Lr"],
    photopea: ["Photopea", "#18a497", "Pp"], capcut: ["CapCut", "#1d1d1f", "CC"], davinci: ["DaVinci Resolve", "#e25b34", "DR"],
    blender: ["Blender", "#ea7600", "Bl"], unity: ["Unity", "#1d1d1f", "U"], godot: ["Godot", "#478cbf", "Gd"], obs: ["OBS", "#302e31", "OBS"],
    excel: ["Excel", "#107c41", "X"], word: ["Word", "#185abd", "W"], powerpoint: ["PowerPoint", "#c43e1c", "P"], outlook: ["Outlook", "#0078d4", "O"],
    office: ["Microsoft 365", "#d83b01", "365"], teams: ["Teams", "#5b5fc7", "T"], slack: ["Slack", "#4a154b", "S"], zoom: ["Zoom", "#0b5cff", "Z"],
    whatsapp: ["WhatsApp", "#25d366", "WA"], discord: ["Discord", "#5865f2", "Dc"],
    trello: ["Trello", "#0c66e4", "Tr"], miro: ["Miro", "#ffd02f", "Mi"], asana: ["Asana", "#f06a6a", "As"], clickup: ["ClickUp", "#7b68ee", "CU"],
    linear: ["Linear", "#5e6ad2", "Li"], jira: ["Jira", "#0c66e4", "J"], monday: ["monday", "#ff3d57", "mo"],
    chatgpt: ["ChatGPT", "#10a37f", "AI"], claude: ["Claude", "#d97757", "AI"], webflow: ["Webflow/Framer", "#146ef5", "Wf"],
    vercel: ["Vercel", "#1d1d1f", "▲"], supabase: ["Supabase", "#3ecf8e", "Sb"],
  };
  // grupos para a lista de escolha
  const GRUPOS = [["Design", ["figma", "canva", "photoshop", "illustrator", "indesign", "lightroom", "photopea", "premiere", "aftereffects", "capcut", "davinci", "blender"]],
    ["Código", ["vscode", "cursor", "github", "gitlab", "sublime", "intellij", "pycharm", "webstorm", "androidstudio", "xcode", "unity", "godot", "vercel", "supabase"]],
    ["Documentos", ["notion", "gdocs", "gsheets", "gslides", "gforms", "gdrive", "excel", "word", "powerpoint", "office", "webflow"]],
    ["Marketing", ["metaads", "googleads", "ganalytics"]],
    ["Gestão", ["trello", "miro", "asana", "clickup", "linear", "jira", "monday"]],
    ["Conversa", ["gmail", "outlook", "slack", "teams", "zoom", "meet", "gcalendar", "whatsapp", "discord", "chatgpt", "claude", "obs"]]];

  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let mostrar = ls.get("andar_app_mostrar", true);
  let ocultos = new Set(ls.get("andar_app_ocultos", ["whatsapp", "discord"])); // apps que a pessoa escolheu não mostrar
  let manual = ls.get("andar_app_manual", null);
  let detectado = null, extensao = false, pc = false, aoMudar = null, ultimo;

  function atual() {
    if (!mostrar) return null;
    const id = detectado || manual;
    return id && APPS[id] && !ocultos.has(id) ? id : null;
  }
  function avisar() { const a = atual(); if (a !== ultimo) { ultimo = a; aoMudar && aoMudar(a); } }

  window.addEventListener("message", e => {
    if (e.source !== window || !e.data || e.data.fonte !== "andar-ext") return;
    extensao = true;
    if (e.data.tipo === "app") { detectado = e.data.app && APPS[e.data.app] ? e.data.app : null; pc = !!e.data.pc; avisar(); }
  });
  window.postMessage({ fonte: "andar-pagina", tipo: "quem" }, location.origin);

  /* ---------- selo desenhado ao lado do nome (2D e 3D) ---------- */
  function desenharSelo(ctx, x, y, id) { // x,y = canto esquerdo, centro vertical; devolve a largura usada
    const a = APPS[id]; if (!a) return 0;
    ctx.save(); ctx.font = "900 9px Inter,system-ui,sans-serif";
    const w = Math.max(19, ctx.measureText(a[2]).width + 10);
    ctx.fillStyle = a[1]; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y - 9.5, w, 19, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = claro(a[1]) ? "#16141f" : "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(a[2], x + w / 2, y + 0.5);
    ctx.restore(); return w;
  }
  function claro(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 170; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function seloHtml(id) { const a = APPS[id]; if (!a) return ""; return `<i class="app-selo" style="background:${a[1]};color:${claro(a[1]) ? "#16141f" : "#fff"}">${esc(a[2])}</i>`; }

  /* ---------- seção no menu de status ---------- */
  function secaoMenu() {
    const a = atual(), det = detectado || null;
    const origem = !extensao ? `<a href="status-app.html" target="_blank">Instale a extensão</a> para detectar sozinho.`
      : pc ? "Detectando sites e programas do computador." : `Detectando sites. <a href="status-app.html" target="_blank">App para PC</a> detecta programas instalados.`;
    const opcoes = GRUPOS.map(([g, ids]) => `<optgroup label="${g}">${ids.map(id => `<option value="${id}" ${manual === id ? "selected" : ""}>${esc(APPS[id][0])}</option>`).join("")}</optgroup>`).join("");
    return `<div class="app-sec"><div class="app-lin"><b>App em uso</b><label class="app-sw"><input type="checkbox" data-app-mostrar ${mostrar ? "checked" : ""}><span></span></label></div>
      <div class="app-agora">${a ? seloHtml(a) + `<span>${esc(APPS[a][0])}</span>` : `<span class="mut">${mostrar ? (det && ocultos.has(det) ? `${esc(APPS[det][0])} (oculto)` : "Nenhum app agora") : "Não mostrar"}</span>`}</div>
      <p>${origem}</p>
      <select data-app-manual><option value="">Escolher à mão…</option>${opcoes}</select>
      <button data-app-lista>Escolher quais apps aparecem</button></div>`;
  }
  function ligarMenu(pop, redesenhar) {
    const ck = pop.querySelector("[data-app-mostrar]"); if (!ck) return;
    ck.onchange = () => { mostrar = ck.checked; ls.set("andar_app_mostrar", mostrar); avisar(); redesenhar(); };
    pop.querySelector("[data-app-manual]").onchange = e => { manual = e.target.value || null; ls.set("andar_app_manual", manual); avisar(); redesenhar(); };
    pop.querySelector("[data-app-lista]").onclick = () => abrirLista(redesenhar);
  }
  function abrirLista(depois) {
    const fundo = document.createElement("div"); fundo.className = "app-modal";
    fundo.innerHTML = `<div class="app-caixa" role="dialog" aria-label="Quais apps aparecem"><h3>Quais apps aparecem para a equipe</h3>
      <p>Só os marcados aparecem ao lado do seu nome. O Andar nunca vê o que você faz dentro deles, só qual app está na frente.</p>
      <div class="app-grupos">${GRUPOS.map(([g, ids]) => `<div><b>${g}</b>${ids.map(id => `<label><input type="checkbox" value="${id}" ${ocultos.has(id) ? "" : "checked"}>${seloHtml(id)}${esc(APPS[id][0])}</label>`).join("")}</div>`).join("")}</div>
      <div class="app-bts"><button data-x="nenhum">Desmarcar todos</button><button data-x="todos">Marcar todos</button><button class="pri" data-x="ok">Pronto</button></div></div>`;
    document.body.appendChild(fundo);
    const caixas = () => [...fundo.querySelectorAll("input[type=checkbox]")];
    fundo.onclick = e => {
      const x = e.target.dataset && e.target.dataset.x;
      if (x === "todos" || x === "nenhum") caixas().forEach(c => c.checked = x === "todos");
      if (x === "ok" || e.target === fundo) { ocultos = new Set(caixas().filter(c => !c.checked).map(c => c.value)); ls.set("andar_app_ocultos", [...ocultos]); fundo.remove(); avisar(); depois && depois(); }
    };
  }

  const css = document.createElement("style");
  css.textContent = `.app-selo{display:inline-grid;place-items:center;min-width:20px;height:18px;padding:0 4px;border-radius:5px;font:900 9.5px Inter,system-ui,sans-serif;font-style:normal;margin-right:6px;vertical-align:middle}
.app-sec{border-top:1px solid var(--line,#e4dfd5);margin-top:8px;padding:10px 10px 4px;display:grid;gap:6px;min-width:240px}
.app-lin{display:flex;justify-content:space-between;align-items:center}.app-agora{display:flex;align-items:center;font-weight:700}.app-sec .mut{opacity:.6;font-weight:600}
.app-sec p{margin:0;font-size:12px;opacity:.75}.app-sec a{color:inherit;text-decoration:underline}
.app-sec select,.app-sec>button{width:100%;font:inherit;font-size:13px;padding:7px 9px;border-radius:9px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.12);color:inherit;cursor:pointer;text-align:left}
.app-sw{position:relative;width:34px;height:20px}.app-sw input{opacity:0;width:0;height:0}.app-sw span{position:absolute;inset:0;border-radius:99px;background:#6b6760;cursor:pointer;transition:.2s}
.app-sw span:before{content:"";position:absolute;width:14px;height:14px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.2s}.app-sw input:checked+span{background:var(--brand,#1a7f4b)}.app-sw input:checked+span:before{transform:translateX(14px)}
.app-sw input:focus-visible+span{outline:2px solid #ffd23e;outline-offset:2px}
.app-modal{position:fixed;inset:0;z-index:300;background:rgba(10,8,16,.6);display:grid;place-items:center;padding:16px}
.app-caixa{background:#fff;color:#1d1d1f;border-radius:16px;max-width:760px;width:100%;max-height:86vh;overflow:auto;padding:22px}
.app-caixa h3{margin:0 0 6px}.app-caixa p{margin:0 0 14px;color:#6b6760;font-size:14px}
.app-grupos{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}.app-grupos b{display:block;margin-bottom:6px}
.app-grupos label{display:flex;align-items:center;gap:6px;font-size:14px;padding:3px 0;cursor:pointer}.app-grupos .app-selo{margin-right:2px}
.app-bts{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}.app-bts button{font:inherit;padding:8px 14px;border-radius:10px;border:1px solid #e4dfd5;background:#f3f1ec;cursor:pointer}
.app-bts .pri{background:var(--brand,#1a7f4b);border-color:transparent;color:#fff;font-weight:700}`;
  document.head.appendChild(css);

  window.AppStatus = {
    APPS, atual, desenharSelo, seloHtml, secaoMenu, ligarMenu,
    nome: id => APPS[id] ? APPS[id][0] : "",
    set aoMudar(f) { aoMudar = f; }, get extensao() { return extensao; }, get pc() { return pc; },
  };
})();
