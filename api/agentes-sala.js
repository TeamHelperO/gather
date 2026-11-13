/* Agentes de pesquisa das salas de clientes (modelo SaaS): cada sala usa a IA do próprio cliente.
   O dono da sala cadastra em Configurações → IA e agentes:
     – endereço compatível com OpenAI (OpenAI, OpenRouter, Groq, Together, Gemini /v1beta/openai, Ollama exposto, NVIDIA etc.),
     – modelo e chave de API (a chave fica no banco, sem leitura pelo navegador).
   A sala da Next ("principal") nunca passa por aqui: ela usa /api/agentes com as chaves da Next.

   Quem pode rodar:
     POST {mapa}  com o token do dono da sala (botão "Rodar agentes" do painel)
     GET/POST     pelo cron da Vercel ou com CRON_SECRET: roda todas as salas que têm IA configurada.
   Precisa de AGENTES_CHAVE na Vercel (a mesma da Next) para falar com o banco. */
const { lerJSON } = require("./_json.js");
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const CHAVE = () => process.env.AGENTES_CHAVE;

const rpc = (fn, corpo, token) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});
const rpcJson = async (fn, corpo, token) => { const r = await rpc(fn, corpo, token); const t = await r.text(); if (!r.ok) throw new Error(t.slice(0, 200)); try { return JSON.parse(t); } catch (e) { return t; } };

// só endereços https públicos (nada de rede interna)
function urlSegura(base) {
  let u; try { u = new URL(String(base || "").trim()); } catch (e) { return null; }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.includes(":") || /^\d+$/.test(h)) return null;
  return u.toString().replace(/\/+$/, "");
}
const endpoint = base => /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";

async function perguntar(cfg, mensagens, ms) {
  const base = urlSegura(cfg.base_url); if (!base) throw new Error("Endereço da IA inválido (use https)");
  const r = await fetch(endpoint(base), {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.chave}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ model: cfg.modelo, messages: mensagens, temperature: 0.7, max_tokens: 3000 }),
    signal: AbortSignal.timeout(ms),
  }).catch(e => ({ ok: false, status: 0, text: async () => String(e && e.name === "TimeoutError" ? "a IA demorou demais" : e) }));
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    if ([401, 403].includes(r.status)) throw new Error("A IA recusou a chave (" + r.status + ")");
    if (r.status === 404) throw new Error("Modelo ou endereço não encontrado (404)");
    if (r.status === 429) throw new Error("A IA está sem cota ou limitando pedidos (429)");
    throw new Error(`A IA respondeu ${r.status || "sem conexão"}: ${t}`);
  }
  const j = await r.json(), m = j.choices?.[0]?.message || {};
  return String(m.content || m.reasoning_content || "");
}

async function rodarSala(mapa, ms) {
  const cfg = await rpcJson("ia_sala_config", { p_chave: CHAVE(), p_mapa: mapa });
  if (!cfg || !cfg.base_url || !cfg.modelo || !cfg.chave) throw new Error("Configure a IA da sala (endereço, modelo e chave) em Configurações → IA e agentes");
  const lista = (cfg.agentes || []).filter(a => a.ativo !== false && a.tipo !== "edicao" && a.tipo !== "prospeccao");
  if (!lista.length) throw new Error("A sala não tem agentes ligados (crie na aba Agentes do painel de Pesquisa)");
  const curto = id => String(id).split(":").pop();
  const status = (a, s, d) => rpc("agente_status_sala", { p_chave: CHAVE(), p_mapa: mapa, p_agente: a.id, p_status: s, p_detalhe: d }).catch(() => {});
  await Promise.all(lista.map(a => status(a, "pesquisando", `Pedindo à IA tendências de ${a.categoria || a.nome}`)));
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }), por = 3;
  let texto;
  try {
    texto = await perguntar(cfg, [
      { role: "system", content: "Você é uma equipe de analistas de tendências de mercado. Responda só com JSON válido, em português do Brasil, sem texto fora do JSON." },
      { role: "user", content: `Hoje é ${hoje}. Cada agente lista ${por} tendências atuais e acionáveis da sua área:\n` +
        lista.map(a => `- ${curto(a.id)} (${a.nome}): ${a.foco || a.categoria || a.nome}` + (a.prompt ? `\n  instruções do ${a.nome}: ${String(a.prompt).slice(0, 600).replace(/\s+/g, " ")}` : "")).join("\n") +
        `\nFormato: {"${curto(lista[0].id)}": [{"titulo": "até 90 caracteres", "resumo": "2 frases: o que é e por que vale (ou não) pegar", "relevancia": 1-5}], ...}. Não invente números nem links.` },
    ], ms);
  } catch (e) { await Promise.all(lista.map(a => status(a, "erro", e.message.slice(0, 180)))); throw e; }
  const json = lerJSON(texto), resultado = [];
  for (const a of lista) {
    const itens = [].concat(json[curto(a.id)] || json[a.id] || json[a.nome] || []).filter(t => t && t.titulo).slice(0, por);
    let publicadas = 0;
    for (const t of itens) {
      const r = await rpc("agente_publicar_sala", { p_chave: CHAVE(), p_mapa: mapa, p_agente: a.id, p_titulo: String(t.titulo).slice(0, 200),
        p_resumo: t.resumo ? String(t.resumo).slice(0, 1000) : null, p_fonte_url: null, p_categoria: a.categoria || null,
        p_relevancia: Math.max(1, Math.min(5, parseInt(t.relevancia) || 3)) });
      if (r.ok) publicadas++;
    }
    await status(a, publicadas ? "publicou" : "erro", publicadas ? `${publicadas} tendência(s) nova(s) · ${cfg.modelo}` : `A IA (${cfg.modelo}) não devolveu tendências`);
    resultado.push({ agente: a.nome, publicadas });
  }
  return resultado;
}

async function donoDaSala(req, mapa) {
  const auth = req.headers.authorization || "", token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token === process.env.CRON_SECRET) return false;
  const r = await rpc("dono_da_sala", { p_mapa: mapa }, token).catch(() => null);
  return !!(r && r.ok && (await r.json()) === true);
}
const ehCron = req => { const s = process.env.CRON_SECRET, a = req.headers.authorization || ""; return !!s && (a === `Bearer ${s}` || (req.query && req.query.segredo === s)); };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!CHAVE()) return res.status(200).json({ ok: false, erro: "Falta AGENTES_CHAVE na Vercel" });
  const corpo = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const mapa = String(corpo.mapa || (req.query && req.query.mapa) || "").trim();
  const t0 = Date.now();
  try {
    if (mapa) {
      if (mapa === "principal") return res.status(400).json({ ok: false, erro: "A sala da Next usa a IA da Next" });
      if (!ehCron(req) && !(await donoDaSala(req, mapa))) return res.status(403).json({ ok: false, erro: "Só o dono da sala roda os agentes" });
      const resultado = await rodarSala(mapa, 50000);
      await rpc("ia_sala_registrar", { p_chave: CHAVE(), p_mapa: mapa, p_erro: null }).catch(() => {});
      return res.status(200).json({ ok: true, resultado });
    }
    if (!ehCron(req)) return res.status(401).json({ ok: false, erro: "Informe a sala" });
    const salas = await rpcJson("ia_salas_ativas", { p_chave: CHAVE() });
    const feitas = [];
    for (const m of [].concat(salas || []).map(x => typeof x === "string" ? x : x.ia_salas_ativas || Object.values(x)[0])) {
      const resta = 55000 - (Date.now() - t0); if (resta < 12000) break;
      try { const r = await rodarSala(m, Math.min(40000, resta - 4000)); feitas.push({ mapa: m, resultado: r }); await rpc("ia_sala_registrar", { p_chave: CHAVE(), p_mapa: m, p_erro: null }).catch(() => {}); }
      catch (e) { feitas.push({ mapa: m, erro: e.message }); await rpc("ia_sala_registrar", { p_chave: CHAVE(), p_mapa: m, p_erro: e.message }).catch(() => {}); }
    }
    return res.status(200).json({ ok: true, salas: feitas });
  } catch (e) {
    if (mapa) await rpc("ia_sala_registrar", { p_chave: CHAVE(), p_mapa: mapa, p_erro: e.message }).catch(() => {});
    return res.status(200).json({ ok: false, erro: e.message });
  }
};
module.exports.urlSegura = urlSegura;
