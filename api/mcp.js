/* Servidor MCP de cada sala (modelo SaaS): o cliente conecta a IA dele (Claude, ChatGPT, Cursor, n8n, um agente próprio…)
   e ela vira os agentes da sala: lê o que cada agente deve pesquisar, publica tendências no telão, muda o status do agente
   no mapa, lê e cria tarefas no telão de gestão.
   Endereço:  https://<site>/api/mcp   ·   Autenticação: "Authorization: Bearer <token da sala>" (ou ?token=…)
   O token é gerado pelo dono em Configurações → IA e agentes; o banco guarda só o hash. A sala da Next não tem MCP.
   Transporte: MCP "Streamable HTTP" sem sessão (cada POST é um JSON-RPC; resposta em JSON). */
const crypto = require("crypto");
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const CHAVE = () => process.env.AGENTES_CHAVE;
const VERSOES = ["2025-06-18", "2025-03-26", "2024-11-05"];

const rpc = async (fn, corpo) => {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const t = await r.text(); if (!r.ok) { let m = t; try { m = JSON.parse(t).message || t; } catch (e) {} throw new Error(String(m).slice(0, 200)); }
  try { return JSON.parse(t); } catch (e) { return t; }
};

const FERRAMENTAS = [
  { name: "listar_agentes", description: "Lista os agentes de pesquisa da sala: id, nome, o que cada um pesquisa (foco), instruções (prompt) e status. Use antes de pesquisar para saber o que cada agente deve buscar.",
    inputSchema: { type: "object", properties: {} } },
  { name: "listar_tendencias", description: "Lista as últimas tendências do telão da sala, com a decisão da equipe (pendente, pega, nao_pega). Use para não repetir assuntos.",
    inputSchema: { type: "object", properties: { limite: { type: "integer", minimum: 1, maximum: 100, description: "Quantas (padrão 30)" } } } },
  { name: "publicar_tendencia", description: "Publica uma tendência no telão da sala em nome de um agente. A equipe avalia depois (pega / não pega).",
    inputSchema: { type: "object", required: ["agente", "titulo"], properties: {
      agente: { type: "string", description: "id ou nome do agente (de listar_agentes)" },
      titulo: { type: "string", maxLength: 200 }, resumo: { type: "string", description: "o que é e por que vale (ou não) pegar" },
      fonte_url: { type: "string", description: "link da fonte, se houver" }, categoria: { type: "string" },
      relevancia: { type: "integer", minimum: 1, maximum: 5 } } } },
  { name: "status_agente", description: "Muda o que aparece em cima do agente no mapa (ex.: 'pesquisando', 'publicou') com um detalhe curto.",
    inputSchema: { type: "object", required: ["agente", "status"], properties: { agente: { type: "string" }, status: { type: "string", maxLength: 40 }, detalhe: { type: "string", maxLength: 200 } } } },
  { name: "listar_tarefas", description: "Lista as tarefas do telão de gestão da sala (título, responsáveis, prazo, status) e os ambientes da sala.",
    inputSchema: { type: "object", properties: {} } },
  { name: "criar_tarefa", description: "Cria uma tarefa no telão de gestão da sala (coluna A fazer).",
    inputSchema: { type: "object", required: ["titulo"], properties: { titulo: { type: "string", maxLength: 120 }, descricao: { type: "string" },
      prazo: { type: "string", description: "AAAA-MM-DD" }, ambiente: { type: "string", description: "nome ou id do ambiente (opcional)" } } } },
];

async function executar(nome, a, mapa) {
  const base = { p_chave: CHAVE(), p_mapa: mapa };
  switch (nome) {
    case "listar_agentes": {
      const cfg = await rpc("ia_sala_config", base);
      return (cfg.agentes || []).map(x => ({ id: x.id, nome: x.nome, foco: x.foco, instrucoes: x.prompt, categoria: x.categoria, ligado: x.ativo !== false, status: x.status, detalhe: x.detalhe }));
    }
    case "listar_tendencias": return (await rpc("mcp_dados", { ...base, p_limite: Math.max(1, Math.min(100, +a.limite || 30)) })).tendencias;
    case "publicar_tendencia": {
      const id = await rpc("agente_publicar_sala", { ...base, p_agente: String(a.agente || ""), p_titulo: String(a.titulo || ""), p_resumo: a.resumo ? String(a.resumo) : null,
        p_fonte_url: /^https?:\/\//i.test(a.fonte_url || "") ? String(a.fonte_url) : null, p_categoria: a.categoria ? String(a.categoria) : null,
        p_relevancia: a.relevancia ? Math.max(1, Math.min(5, parseInt(a.relevancia) || 3)) : null });
      return { ok: true, id };
    }
    case "status_agente": await rpc("agente_status_sala", { ...base, p_agente: String(a.agente || ""), p_status: String(a.status || ""), p_detalhe: a.detalhe ? String(a.detalhe) : null }); return { ok: true };
    case "listar_tarefas": { const d = await rpc("mcp_dados", { ...base, p_limite: 1 }); return { ambientes: d.salas, tarefas: d.tarefas }; }
    case "criar_tarefa": {
      const prazo = /^\d{4}-\d{2}-\d{2}$/.test(a.prazo || "") ? a.prazo : null;
      return { ok: true, id: await rpc("mcp_criar_tarefa", { ...base, p_titulo: String(a.titulo || ""), p_descricao: a.descricao ? String(a.descricao) : null, p_prazo: prazo, p_sala: a.ambiente ? String(a.ambiente) : null }) };
    }
  }
  throw Object.assign(new Error("Ferramenta desconhecida: " + nome), { codigo: -32602 });
}

async function responder(msg, mapa) {
  const { id, method, params = {} } = msg || {};
  const ok = result => ({ jsonrpc: "2.0", id, result }), erro = (code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return erro(-32600, "Pedido inválido");
  if (id === undefined) return null; // notificação (ex.: notifications/initialized): sem resposta
  switch (method) {
    case "initialize": return ok({ protocolVersion: VERSOES.includes(params.protocolVersion) ? params.protocolVersion : VERSOES[0],
      capabilities: { tools: { listChanged: false } }, serverInfo: { name: "escritorio-virtual", version: "1.0.0" },
      instructions: "Você é a IA dos agentes desta sala do escritório virtual. Use listar_agentes para ver o foco de cada agente, pesquise, e publique as tendências com publicar_tendencia (uma por chamada). Atualize o status do agente com status_agente enquanto trabalha." });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: FERRAMENTAS });
    case "tools/call":
      try {
        const r = await executar(params.name, params.arguments || {}, mapa);
        return ok({ content: [{ type: "text", text: JSON.stringify(r, null, 1) }], isError: false });
      } catch (e) {
        if (e.codigo) return erro(e.codigo, e.message);
        return ok({ content: [{ type: "text", text: "Erro: " + e.message }], isError: true });
      }
    case "resources/list": return ok({ resources: [] });
    case "prompts/list": return ok({ prompts: [] });
  }
  return erro(-32601, "Método não existe: " + method);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(405).setHeader("Allow", "POST").json({ erro: "Use POST (MCP Streamable HTTP)" });
  if (req.method === "DELETE") return res.status(204).end();
  if (!CHAVE()) return res.status(500).json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Servidor sem AGENTES_CHAVE" } });
  const auth = req.headers.authorization || "", token = (auth.startsWith("Bearer ") ? auth.slice(7) : (req.query && req.query.token) || "").trim();
  const negar = () => res.status(401).setHeader("WWW-Authenticate", 'Bearer realm="escritorio-virtual"').json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Token inválido. Gere um em Configurações → IA e agentes." } });
  if (!/^ev_[A-Za-z0-9_-]{20,}$/.test(token)) return negar();
  let mapa;
  try { mapa = await rpc("ia_sala_do_token", { p_chave: CHAVE(), p_hash: crypto.createHash("sha256").update(token).digest("hex") }); } catch (e) { mapa = null; }
  if (!mapa || typeof mapa !== "string") return negar();
  const corpo = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return undefined; } })() : req.body;
  if (corpo === undefined) return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } });
  if (Array.isArray(corpo)) {
    const out = (await Promise.all(corpo.map(m => responder(m, mapa)))).filter(Boolean);
    return out.length ? res.status(200).json(out) : res.status(202).end();
  }
  const r = await responder(corpo, mapa);
  return r ? res.status(200).json(r) : res.status(202).end();
};
