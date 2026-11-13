/* Configurações → "IA e agentes" (modelo SaaS).
   – Sala da Next: só um aviso; a IA da Next (NVIDIA) é gerenciada fora do painel e ninguém mexe nela daqui.
   – Sala de cliente: o dono escolhe como os agentes pensam:
       1) Chave de API própria (qualquer IA compatível com OpenAI) → os agentes rodam sozinhos todo dia e no botão "Rodar agentes".
       2) MCP: conecta a IA do cliente (Claude, ChatGPT, Cursor, n8n…) no endereço /api/mcp com o token da sala;
          ela lê o foco dos agentes e publica tendências / cria tarefas.
   A chave nunca volta para o navegador (só os 4 últimos caracteres); o token MCP aparece uma vez só. */
window.IAConfig = (function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const PROVEDORES = [
    ["OpenAI", "https://api.openai.com/v1"], ["Anthropic (Claude)", "https://api.anthropic.com/v1"], ["Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai"],
    ["OpenRouter", "https://openrouter.ai/api/v1"], ["Groq", "https://api.groq.com/openai/v1"], ["NVIDIA", "https://integrate.api.nvidia.com/v1"],
  ];
  let info = null, infoDe = null, tokenNovo = null, erro = null, rodando = false;
  const bloco = (titulo, html, desc) => `<section class="cfg-b"><h4>${titulo}</h4>${desc ? `<p class="cfg-d">${desc}</p>` : ""}${html}</section>`;
  const quando = d => d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";
  const urlMcp = () => location.origin + "/api/mcp";

  async function carregar(opt, forcar) {
    if (!forcar && infoDe === opt.mapaId && info) return;
    try { info = await Dados.iaSalaInfo(opt.mapaId); erro = null; }
    catch (e) { info = null; erro = /function|does not exist|schema cache/i.test(e.message || "") ? "migracao" : (e.message || "erro"); }
    infoDe = opt.mapaId;
  }

  async function html(opt) {
    if (opt.ehNext) return bloco("IA e agentes", `<div class="ia-trava">🔒 <div><b>IA própria da Next</b><p class="cfg-d">Os agentes desta sala usam a IA da Next, configurada direto no servidor. Essas configurações não aparecem no painel e não podem ser vistas nem mudadas por outras salas.</p></div></div>
      ${linhaBotoes([["ctend", "Abrir painel de Pesquisa"]])}`,
      "As salas criadas por clientes usam a IA do próprio cliente, por chave de API ou MCP.");
    await carregar(opt);
    if (erro === "migracao") return bloco("IA e agentes", `<p class="cfg-d aviso">Falta rodar o arquivo <b>rodar_no_supabase_9.sql</b> no Supabase (SQL Editor) para ligar a IA das salas.</p>`);
    if (erro) return bloco("IA e agentes", `<p class="cfg-d aviso">Não consegui ler a configuração: ${esc(erro)}</p><button class="btn" data-iarecarregar>Tentar de novo</button>`);
    const i = info || {};
    const prov = PROVEDORES.map(([n, u]) => `<button type="button" class="chip-b ${i.base_url === u ? "on" : ""}" data-iaprov="${esc(u)}">${esc(n)}</button>`).join("");
    const st = i.ultima_rodada ? (i.ultimo_erro ? `⚠️ Última rodada ${quando(i.ultima_rodada)}: ${esc(i.ultimo_erro)}` : `✅ Última rodada ${quando(i.ultima_rodada)}`) : "Os agentes ainda não rodaram.";
    return bloco("1 · Chave de API da sua IA", `<form class="cfg-form ia-form" data-iaform>
        <div class="ia-prov">${prov}</div>
        <label>Endereço (compatível com OpenAI)<input name="base_url" required placeholder="https://api.openai.com/v1" value="${esc(i.base_url || "")}" autocomplete="off"></label>
        <label>Modelo<input name="modelo" required placeholder="ex.: gpt-4o-mini, claude-haiku…, gemini-…" value="${esc(i.modelo || "")}" autocomplete="off"></label>
        <label>Chave de API<input name="chave" type="password" placeholder="${i.tem_chave ? "•••• " + esc(i.chave_fim) + " (deixe em branco para manter)" : "cole a chave aqui"}" autocomplete="new-password"></label>
        <div class="cfg-acoes"><button class="btn pri">Salvar</button>${i.tem_chave ? `<button type="button" class="btn dan" data-iaapagar>Apagar chave</button>` : ""}
          <button type="button" class="btn" data-iarodar ${rodando || !i.tem_chave ? "disabled" : ""}>${rodando ? "⏳ Rodando…" : "▶ Rodar agentes agora"}</button></div>
        <p class="cfg-d">${st}</p>
      </form>`, "Os agentes da sala de Pesquisa pedem tendências a essa IA uma vez por dia e quando você clica em Rodar. O custo fica na sua conta da IA. A chave fica guardada no servidor e não aparece para ninguém.")
      + bloco("2 · Conectar sua IA por MCP", (tokenNovo ? `<div class="ia-token"><b>Seu token (copie agora, ele não aparece de novo):</b><code>${esc(tokenNovo)}</code>
          <div class="cfg-acoes"><button type="button" class="btn" data-iacopiar="${esc(tokenNovo)}">Copiar token</button><button type="button" class="btn" data-iacopiar="${esc(urlMcp() + "?token=" + tokenNovo)}">Copiar endereço com token</button>
          <button type="button" class="btn" data-iacopiar='${esc(JSON.stringify({ mcpServers: { "escritorio-virtual": { type: "http", url: urlMcp(), headers: { Authorization: "Bearer " + tokenNovo } } } }, null, 2))}'>Copiar JSON (Claude Code, Cursor…)</button></div></div>` :
          `<p class="cfg-d">${i.tem_mcp ? `Token ativo terminando em <b>${esc(i.mcp_fim)}</b>.` : "Nenhum token ainda."}</p>`)
        + `<div class="cfg-l"><span>Endereço</span><div><code>${esc(urlMcp())}</code> <button type="button" class="btn" data-iacopiar="${esc(urlMcp())}">Copiar</button></div></div>
        <div class="cfg-acoes"><button type="button" class="btn ${i.tem_mcp ? "" : "pri"}" data-iatoken>${i.tem_mcp ? "Gerar outro token (o antigo para de funcionar)" : "Gerar token"}</button>${i.tem_mcp ? `<button type="button" class="btn dan" data-iarevogar>Desligar MCP</button>` : ""}</div>
        <p class="cfg-d">Na sua IA, adicione um servidor MCP (HTTP) com esse endereço e o cabeçalho <code>Authorization: Bearer &lt;token&gt;</code>. Se ela só aceita um endereço, use o endereço com token. Ferramentas: listar_agentes, listar_tendencias, publicar_tendencia, status_agente, listar_tarefas, criar_tarefa.</p>`,
        "Use quando a sua IA já tem acesso a ferramentas (busca na web, seus dados): ela trabalha como os agentes da sala e publica direto no telão.")
      + bloco("3 · Agentes", linhaBotoes([["ctend", "Abrir painel de Pesquisa (nomes, foco e instruções dos agentes)"]]), "Cada agente tem nome, o que pesquisa e instruções. É isso que a IA recebe, pela chave ou pelo MCP.");
  }
  const linhaBotoes = l => `<div class="cfg-acoes">${l.map(([k, t]) => `<button type="button" class="btn" data-${k}>${t}</button>`).join("")}</div>`;

  async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
  function gerarToken() { const b = new Uint8Array(30); crypto.getRandomValues(b); return "ev_" + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

  async function clique(e, opt) {
    const t = e.target.closest("button"); if (!t) return false; const d = t.dataset;
    try {
      if (d.iaprov) { const f = t.closest("form"); f.base_url.value = d.iaprov; f.querySelectorAll("[data-iaprov]").forEach(b => b.classList.toggle("on", b === t)); f.modelo.focus(); return false; }
      if ("iarecarregar" in d) { await carregar(opt, true); return true; }
      if (d.iacopiar) { await navigator.clipboard.writeText(d.iacopiar); const o = t.textContent; t.textContent = "Copiado ✓"; setTimeout(() => t.textContent = o, 1500); return false; }
      if ("iaapagar" in d) { if (!d.ok) { d.ok = 1; t.textContent = "Confirmar"; return false; } await Dados.iaSalaSalvar(opt.mapaId, { ...(info || {}), apagar: true }); await carregar(opt, true); opt.toast("Chave apagada"); return true; }
      if ("iatoken" in d) {
        if (info && info.tem_mcp && !d.ok) { d.ok = 1; t.textContent = "Confirmar: o token antigo para de funcionar"; return false; }
        const tok = gerarToken(); await Dados.iaSalaMcp(opt.mapaId, await sha256(tok), tok.slice(-4)); tokenNovo = tok; await carregar(opt, true); return true;
      }
      if ("iarevogar" in d) { if (!d.ok) { d.ok = 1; t.textContent = "Confirmar"; return false; } await Dados.iaSalaMcp(opt.mapaId, "", ""); tokenNovo = null; await carregar(opt, true); opt.toast("MCP desligado"); return true; }
      if ("iarodar" in d) {
        rodando = true; t.disabled = true; t.textContent = "⏳ Rodando…";
        const token = await Dados.tokenAtual();
        const r = await fetch("/api/agentes-sala", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify({ mapa: opt.mapaId }) });
        const j = await r.json().catch(() => ({})); rodando = false;
        if (!j.ok) opt.toast("🤖 " + (j.erro || "Falhou (" + r.status + ")"));
        else opt.toast(`🤖 ${(j.resultado || []).reduce((s, x) => s + (x.publicadas || 0), 0)} tendência(s) nova(s) no painel de Pesquisa`);
        await carregar(opt, true); return true;
      }
    } catch (er) { rodando = false; opt.toast("Não consegui: " + ((er && er.message) || "")); return true; }
    return false;
  }
  async function enviar(f, opt) {
    if (!("iaform" in f.dataset)) return false;
    const fd = new FormData(f);
    try {
      const base = String(fd.get("base_url") || "").trim();
      if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(base)) { opt.toast("Use um endereço https"); return false; }
      await Dados.iaSalaSalvar(opt.mapaId, { base_url: base.replace(/\/chat\/completions\/?$/, "").replace(/\/+$/, ""), modelo: String(fd.get("modelo") || "").trim(), chave: String(fd.get("chave") || "").trim() });
      await carregar(opt, true); opt.toast("🤖 IA da sala salva"); return true;
    } catch (er) { opt.toast("Não consegui salvar: " + ((er && er.message) || "")); return false; }
  }
  // ao sair da aba o token some (só aparece uma vez)
  addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-caba],[data-cfechar]")) tokenNovo = null; }, true);
  return { html, clique, enviar };
})();
