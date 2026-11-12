/* Agentes da TI usando a IA da NVIDIA (build.nvidia.com / integrate.api.nvidia.com).
   Cada rodada: cada agente pede à IA tendências da sua área e publica no painel de Tendências.

   Variáveis na Vercel (Settings → Environment Variables):
     NVIDIA_API_KEYS   – uma ou mais chaves "nvapi-…", separadas por vírgula ou quebra de linha.
                         Quando uma chave acaba os créditos/tokens (ou é recusada), passa para a próxima sozinho.
     AGENTES_CHAVE     – a chave dos agentes (a mesma usada no agente_publicar).
     NVIDIA_MODEL      – opcional; se não tiver ou for desativado, escolhe sozinho entre os modelos que a NVIDIA oferece hoje (lista PREFERIDOS + catálogo /v1/models).
     CRON_SECRET       – opcional; a Vercel manda no cron. Também serve para chamar de fora: /api/agentes?segredo=…
   Quem pode rodar: o cron da Vercel, quem tiver o CRON_SECRET, ou um administrador logado (botão no painel). */
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const NV = "https://integrate.api.nvidia.com/v1/chat/completions";
// modelos em ordem de preferência: se um for desativado pela NVIDIA (404/410), passa para o próximo
// os rápidos primeiro: a Vercel corta a função em 60 s
const PREFERIDOS = ["google/gemma-4-31b-it", "nvidia/nemotron-3.5-lightning-30b-a3b", "nv-mistralai/mistral-nemo-12b-instruct", "deepseek-ai/deepseek-v4.1-flash",
  "google/gemma-3-12b-it", "mistralai/mistral-large-2-instruct", "nvidia/llama-3.1-nemotron-70b-instruct", "openai/gpt-oss-20b"];
const INICIO = { t: 0 };
const LIMITE = 280000; // a função pode rodar até 300 s (vercel.json)
const restante = () => LIMITE - (Date.now() - INICIO.t);
const tentativas = [];
const modelosMortos = new Set();
let catalogo = null; // modelos que a NVIDIA oferece hoje (lido de /v1/models)
async function modelos() {
  if (!catalogo) {
    try {
      const k = chaves()[0];
      const r = await fetch("https://integrate.api.nvidia.com/v1/models", { headers: k ? { Authorization: `Bearer ${k}` } : {} });
      if (r.ok) catalogo = ((await r.json()).data || []).map(m => m.id);
    } catch (e) {}
  }
  const tem = id => !catalogo || catalogo.includes(id);
  const extras = (catalogo || []).filter(id => /instruct|-it$|chat/i.test(id) && !/embed|guard|safety|reward|parse|vision|vlm|coder|code|retriev|chatqa/i.test(id));
  return [...new Set([process.env.NVIDIA_MODEL, ...PREFERIDOS.filter(tem), ...extras].filter(Boolean))].filter(m => !modelosMortos.has(m));
}

const AGENTES = [
  { id: "agente1", nome: "Radar", area: "redes sociais, Meta Ads, TikTok e marketing de performance", cat: "Social/Ads" },
  { id: "agente2", nome: "Faro", area: "e-commerce, varejo online, marketplaces e comportamento de compra", cat: "E-commerce" },
  { id: "agente3", nome: "Lupa", area: "conteúdo, SEO, criadores e formatos que estão engajando", cat: "Conteúdo" },
  { id: "agente4", nome: "Pulso", area: "inteligência artificial, ferramentas e automação para negócios", cat: "IA/Tech" },
  { id: "agente5", nome: "Bússola", area: "economia, consumo e oportunidades de negócio no Brasil", cat: "Mercado" },
];

// chaves esgotadas ficam de lado por um tempo (enquanto a função estiver "quente")
const esgotadas = new Map(); // índice -> até quando
const chaves = () => (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || "").split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
const ehFimDeCota = (status, txt) => [401, 402, 403, 429].includes(status) || /credit|quota|limit|insufficient|exceed|expired/i.test(txt || "");

async function perguntar(mensagens) {
  let ultimo;
  for (const modelo of (await modelos()).slice(0, 6)) {
    if (restante() < 15000) break;
    try { return await perguntarModelo(mensagens, modelo); }
    catch (e) { ultimo = e; if (e.modeloMorto) { modelosMortos.add(modelo); continue; } throw e; }
  }
  throw ultimo || new Error("Nenhum modelo de conversa encontrado na NVIDIA");
}
async function perguntarModelo(mensagens, modelo) {
  const lista = chaves();
  if (!lista.length) throw new Error("NVIDIA_API_KEYS não configurada");
  const erros = [];
  for (let i = 0; i < lista.length; i++) {
    if ((esgotadas.get(i) || 0) > Date.now()) continue;
    const t0 = Date.now();
    const r = await fetch(NV, {
      method: "POST",
      headers: { Authorization: `Bearer ${lista[i]}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model: modelo, messages: mensagens, temperature: 0.7, max_tokens: 1200 }),
      signal: AbortSignal.timeout(Math.max(5000, Math.min(90000, restante() - 5000))),
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    const reg = `${modelo} · chave ${i + 1} · ${r.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s`;
    tentativas.push(reg); console.log("[agentes]", reg);
    if (r.status === 0) { const et = await r.text(); console.log("[agentes] falha de rede:", et); const e = new Error(/timeout|abort/i.test(et) ? `modelo ${modelo} demorou demais` : `falha ao chamar ${modelo}: ${et.slice(0, 80)}`); e.modeloMorto = true; throw e; }
    if (r.ok) { const j = await r.json(); if (!j.choices?.[0]?.message?.content) { const e = new Error(`modelo ${modelo} respondeu vazio`); e.modeloMorto = true; throw e; } return { texto: j.choices?.[0]?.message?.content || "", chave: i + 1, modelo }; }
    const txt = await r.text();
    console.log("[agentes] resposta:", txt.slice(0, 300));
    if (r.status === 404 || r.status === 410 || r.status === 400 || r.status === 422) { const e = new Error(`modelo ${modelo} indisponível (${r.status})`); e.modeloMorto = true; throw e; }
    erros.push(`chave ${i + 1}: ${r.status}`);
    if (ehFimDeCota(r.status, txt)) { esgotadas.set(i, Date.now() + 60 * 60000); continue; } // acabou: próxima chave
    if (r.status >= 500 || r.status === 0) continue; // instabilidade: tenta a próxima
    throw new Error(`NVIDIA ${r.status}: ${txt.slice(0, 200)}`);
  }
  throw new Error("Todas as chaves da NVIDIA falharam ou estão sem créditos (" + erros.join(", ") + ")");
}

const rpc = (fn, corpo, token) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});
const status = (agente, s, d) => rpc("agente_status", { p_chave: process.env.AGENTES_CHAVE, p_agente: agente, p_status: s, p_detalhe: d }).catch(() => {});

function lerJSON(txt) {
  const m = txt.match(/\{[\s\S]*\}/); if (!m) return {};
  try { return JSON.parse(m[0]); } catch (e) { return {}; }
}

// uma chamada só para os agentes escolhidos (mais rápido e gasta menos cota)
async function rodada(lista, porAgente) {
  await Promise.all(lista.map(a => status(a.id, "pesquisando", `Pedindo à IA tendências de ${a.cat}`)));
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const { texto, chave, modelo } = await perguntar([
    { role: "system", content: "Você é uma equipe de analistas de tendências de mercado. Responda só com JSON válido, em português do Brasil, sem texto fora do JSON." },
    { role: "user", content: `Hoje é ${hoje}. Para uma agência/empresa digital brasileira, cada agente lista ${porAgente} tendências atuais e acionáveis da sua área:\n` +
      lista.map(a => `- ${a.id} (${a.nome}): ${a.area}`).join("\n") +
      `\nFormato: {"agente1": [{"titulo": "até 90 caracteres", "resumo": "2 frases: o que é e por que vale (ou não) pegar", "relevancia": 1-5}], ...}. Não invente números nem links.` },
  ]);
  const json = lerJSON(texto), resultado = [];
  for (const a of lista) {
    const itens = [].concat(json[a.id] || json[a.nome] || []).filter(t => t && t.titulo).slice(0, porAgente);
    let publicadas = 0;
    for (const t of itens) {
      const r = await rpc("agente_publicar", {
        p_chave: process.env.AGENTES_CHAVE, p_agente: a.id, p_titulo: String(t.titulo).slice(0, 200),
        p_resumo: t.resumo ? String(t.resumo).slice(0, 1000) : null, p_fonte_url: null, p_categoria: a.cat,
        p_relevancia: Math.max(1, Math.min(5, parseInt(t.relevancia) || 3)),
      });
      if (r.ok) publicadas++;
    }
    await status(a.id, publicadas ? "publicou" : "erro", publicadas ? `${publicadas} tendência(s) nova(s) · chave ${chave} · ${modelo.split("/").pop()}` : `A IA (${modelo.split("/").pop()}) não devolveu tendências`);
    resultado.push({ agente: a.nome, publicadas, chave, modelo });
  }
  return resultado;
}

async function autorizado(req) {
  const segredo = process.env.CRON_SECRET, auth = req.headers.authorization || "";
  if (segredo && (auth === `Bearer ${segredo}` || (req.query && req.query.segredo === segredo))) return true;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token === segredo) return false;
  const r = await rpc("e_admin", {}, token).catch(() => null);
  return !!(r && r.ok && (await r.json()) === true);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await autorizado(req))) return res.status(401).json({ erro: "Só administradores (ou o cron) podem rodar os agentes" });
  if (!chaves().length || !process.env.AGENTES_CHAVE) return res.status(200).json({ ok: false, erro: "Configure NVIDIA_API_KEYS e AGENTES_CHAVE na Vercel" });
  const porAgente = Math.max(1, Math.min(5, parseInt(req.query && req.query.n) || 2));
  const so = req.query && req.query.agente;
  INICIO.t = Date.now(); tentativas.length = 0;
  const lista = AGENTES.filter(a => !so || a.id === so);
  let resultado;
  try { resultado = await rodada(lista, porAgente); }
  catch (e) { await Promise.all(lista.map(a => status(a.id, "erro", e.message.slice(0, 140)))); resultado = lista.map(a => ({ agente: a.nome, erro: e.message })); }
  return res.status(200).json({ ok: resultado.some(r => r.publicadas), resultado, tentativas });
};
