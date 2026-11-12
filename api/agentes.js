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
const LIMITE = 54000; // a Vercel (plano Hobby) corta em 60 s
const restante = () => LIMITE - (Date.now() - INICIO.t);
const tentativas = [];
const modelosMortos = new Set();
const semKw = new Set();      // modelos que não aceitam chat_template_kwargs
const puladosNaRodada = new Set();
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
  return [...new Set([process.env.NVIDIA_MODEL, ...PREFERIDOS.filter(tem), ...extras].filter(Boolean))].filter(m => !modelosMortos.has(m) && !puladosNaRodada.has(m));
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

// chama um modelo com uma chave; erros marcados: cota (troca de chave) ou morto (pula o modelo)
async function chamar(modelo, chave, n, mensagens, sinal) {
  const t0 = Date.now();
  const r = await fetch(NV, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", Accept: "application/json" },
    // desliga o "raciocínio" (senão o modelo gasta os tokens pensando e não escreve a resposta)
    body: JSON.stringify({ model: modelo, messages: mensagens, temperature: 0.6, max_tokens: 4096, ...(semKw.has(modelo) ? {} : { chat_template_kwargs: { enable_thinking: false, thinking: false } }) }),
    signal: AbortSignal.any([sinal, AbortSignal.timeout(Math.max(5000, restante() - 3000))]),
  }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
  const reg = `${modelo} · chave ${n} · ${r.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s`;
  tentativas.push(reg); console.log("[agentes]", reg);
  const erro = (msg, tipo) => { const e = new Error(msg); e[tipo] = true; return e; };
  if (r.status === 0) { if (sinal.aborted) throw erro("cancelado", "cancelado"); throw erro(`${modelo} demorou demais`, "morto"); }
  if (r.ok) {
    const j = await r.json(), msg = j.choices?.[0]?.message || {};
    // alguns modelos (com "raciocínio") devolvem a resposta em reasoning_content, ou o JSON dentro de ```json
    const texto = [msg.content, msg.reasoning_content, msg.reasoning].filter(Boolean).join("\n");
    if (!Object.keys(lerJSON(texto)).length) { console.log("[agentes] sem JSON:", JSON.stringify(msg).slice(0, 300), "…", JSON.stringify(msg).slice(-300), "finish:", j.choices?.[0]?.finish_reason); throw erro(`${modelo} não devolveu JSON`, "semJson"); }
    return { texto, chave: n, modelo };
  }
  const txt = await r.text(); console.log("[agentes] resposta:", txt.slice(0, 200));
  if ((r.status === 400 || r.status === 422) && /chat_template|kwargs|thinking|extra/i.test(txt)) throw erro(`${modelo} não aceita desligar raciocínio`, "semKwargs");
  if ([404, 410, 400, 422].includes(r.status)) throw erro(`${modelo} indisponível (${r.status})`, "morto");
  if (ehFimDeCota(r.status, txt)) throw erro(`chave ${n} sem créditos (${r.status})`, "cota");
  throw erro(`${modelo}: erro ${r.status}`, "morto");
}

// várias IAs ao mesmo tempo: a primeira que responder bem ganha, as outras são canceladas
async function perguntar(mensagens) {
  const lista = chaves();
  if (!lista.length) throw new Error("NVIDIA_API_KEYS não configurada");
  let ultimo = "nenhum modelo respondeu";
  for (let i = 0; i < lista.length; i++) {
    if ((esgotadas.get(i) || 0) > Date.now()) continue;
    while (restante() > 8000) {
      const cands = (await modelos()).slice(0, 5);
      if (!cands.length) break;
      const ctrl = new AbortController();
      try { const r = await Promise.any(cands.map(m => chamar(m, lista[i], i + 1, mensagens, ctrl.signal))); ctrl.abort(); return r; }
      catch (agg) {
        const erros = agg.errors || [agg];
        erros.forEach((e, k) => { if (e.morto) modelosMortos.add(cands[k]); else if (e.semKwargs) semKw.add(cands[k]); else if (e.semJson) puladosNaRodada.add(cands[k]); });
        ultimo = erros.map(e => e.message).filter(m => m !== "cancelado").slice(-1)[0] || ultimo;
        if (erros.some(e => e.cota)) { esgotadas.set(i, Date.now() + 60 * 60000); break; } // acabou: próxima chave
      }
    }
  }
  throw new Error("A IA da NVIDIA não respondeu: " + ultimo);
}

const rpc = (fn, corpo, token) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});
const status = (agente, s, d) => rpc("agente_status", { p_chave: process.env.AGENTES_CHAVE, p_agente: agente, p_status: s, p_detalhe: d }).catch(() => {});

// lê o JSON da IA mesmo "sujo": texto antes/depois, ```json, quebra de linha dentro de texto, vírgula sobrando ou resposta cortada
function consertarJSON(t) {
  let out = "", dentro = false, esc = false; const pilha = [], cortes = [];
  for (let k = 0; k < t.length; k++) {
    const ch = t[k];
    if (dentro) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === "\\") { esc = true; out += ch; continue; }
      if (ch === '"') { dentro = false; out += ch; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r" || ch === "\t") { out += " "; continue; }
      out += ch; continue;
    }
    if (ch === '"') { dentro = true; out += ch; continue; }
    if (ch === "{" || ch === "[") pilha.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") { pilha.pop(); out += ch; cortes.push([out.length, pilha.slice()]); continue; }
    out += ch;
  }
  const limpar = x => x.replace(/,\s*([}\]])/g, "$1");
  const tentar = x => { try { return JSON.parse(limpar(x)); } catch (e) { return null; } };
  let o = tentar(out); if (o) return o;
  if (dentro) out += '"';
  o = tentar(out + pilha.slice().reverse().join("")); if (o) return o;
  // cortada no meio: volta até o último objeto/lista completo e fecha o resto
  for (let c = cortes.length - 1; c >= 0; c--) { const [pos, pl] = cortes[c]; o = tentar(out.slice(0, pos) + pl.slice().reverse().join("")); if (o) return o; }
  return null;
}
function lerJSON(txt) {
  txt = String(txt || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/gi, "");
  // tenta cada "{" (o raciocínio pode vir antes); fica com o primeiro objeto que tenha alguma lista dentro
  const ini = [...txt.matchAll(/\{/g)].map(m => m.index).slice(0, 40);
  for (const a of ini) {
    const o = consertarJSON(txt.slice(a));
    if (o && typeof o === "object" && !Array.isArray(o) && Object.values(o).some(Array.isArray)) return o;
  }
  const arr = txt.indexOf("["); // veio só uma lista: vira do primeiro agente
  if (arr >= 0) { const l = consertarJSON(txt.slice(arr)); if (Array.isArray(l)) return { agente1: l }; }
  return {};
}

// uma chamada só para os agentes escolhidos (mais rápido e gasta menos cota)
async function rodada(lista, porAgente) {
  await Promise.all(lista.map(a => status(a.id, "pesquisando", `Pedindo à IA tendências de ${a.cat}`)));
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const { texto, chave, modelo } = await perguntar([
    { role: "system", content: "/no_think\nVocê é uma equipe de analistas de tendências de mercado. Responda só com JSON válido, em português do Brasil, sem texto fora do JSON." },
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

/* ---------- Sala de Edição: roteirista (Pena) + diretor de cenas (Claquete) + editor (Corte) ---------- */
async function usuarioLogado(req) {
  const auth = req.headers.authorization || "", token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token === process.env.CRON_SECRET) return null;
  const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!r || !r.ok) return null;
  const u = await r.json(); return u && u.id ? u.id : null;
}
const texto = (v, n) => (v == null ? "" : String(v)).slice(0, n);

async function roteirizar(t, formato, pedidoPor) {
  await status("agente6", "escrevendo", `Roteiro sobre: ${texto(t.titulo, 120)}`);
  await status("agente7", "planejando cenas", "Esperando o roteiro do Pena");
  const { texto: resp, modelo, chave } = await perguntar([
    { role: "system", content: "/no_think\nVocê é uma dupla de criação de vídeos curtos para redes sociais: um roteirista e um diretor de cenas. Responda só com JSON válido, em português do Brasil." },
    { role: "user", content: `Crie um vídeo no formato "${formato}" sobre esta tendência de mercado, para uma agência/empresa digital brasileira:\n` +
      `Título: ${texto(t.titulo, 200)}\nResumo: ${texto(t.resumo, 800)}\nCategoria: ${texto(t.categoria, 60)}\n\n` +
      `Devolva: {"titulo": "título do vídeo", "gancho": "frase dos 3 primeiros segundos", "roteiro": "texto completo da narração", ` +
      `"cenas": [{"n": 1, "duracao": "0-3s", "visual": "o que aparece e como gravar (enquadramento, movimento, cenário, quem aparece)", "fala": "o que é dito", "texto_tela": "frase curta de impacto (até 6 palavras)", "audio": "música/efeito", ` +
      `"animacao": "uma destas: chat, grafico, dashboard, cadeado, celular, relogio, dinheiro, robo, integracao, pessoa, numero, alvo"}], ` +
      `"cta": "chamada final"}.\n` +
      `Regras da narração (o vídeo é narrado do começo ao fim, sem silêncio):\n` +
      `- De 5 a 8 cenas. TODA cena tem "fala" — nenhuma cena muda.\n` +
      `- Cada "fala" tem de 8 a 22 palavras (cerca de 2,5 palavras por segundo) e a "duracao" combina com ela.\n` +
      `- As falas formam um texto corrido: cada uma continua a anterior e puxa a próxima (use conectores como "e mais", "só que", "por isso", "resultado:").\n` +
      `- O campo "roteiro" é a junção das falas, na ordem.\n` +
      `- "texto_tela" resume a fala em até 6 palavras (não repete a fala inteira).\n` +
      `- "animacao" escolhe o desenho que melhor ilustra a fala; evite repetir a mesma em cenas seguidas.\n` +
      `Prontas para alguém gravar com celular. Não invente números nem marcas reais.` },
  ]);
  const j = lerJSON(resp);
  // nenhuma cena sem fala: usa o texto da tela ou a descrição como último recurso
  [].concat(j.cenas || []).forEach(c => { if (c && !String(c.fala || "").trim()) c.fala = c.texto_tela || ""; });
  const cenas = [].concat(j.cenas || []).filter(c => c && (c.visual || c.fala)).slice(0, 12).map((c, k) => ({
    n: k + 1, duracao: texto(c.duracao, 20), visual: texto(c.visual, 600), fala: texto(c.fala, 600), texto_tela: texto(c.texto_tela, 200), audio: texto(c.audio, 200),
    animacao: ["chat", "grafico", "dashboard", "cadeado", "celular", "relogio", "dinheiro", "robo", "integracao", "pessoa", "numero", "alvo"].includes(String(c.animacao || "").toLowerCase()) ? String(c.animacao).toLowerCase() : undefined,
  }));
  if (!cenas.length) throw new Error(`A IA (${modelo.split("/").pop()}) não devolveu as cenas`);
  await status("agente7", "cenas prontas", `${cenas.length} cenas detalhadas`);
  const roteiro = texto(j.roteiro, 6000) + (j.cta ? `\n\nCTA: ${texto(j.cta, 300)}` : "");
  const r = await rpc("agente_roteiro", {
    p_chave: process.env.AGENTES_CHAVE, p_agente: "agente6", p_tendencia: t.id || null, p_titulo: texto(j.titulo || t.titulo, 200),
    p_gancho: texto(j.gancho, 500), p_roteiro: roteiro, p_formato: texto(formato, 60), p_cenas: cenas, p_pedido_por: pedidoPor,
  });
  if (!r.ok) throw new Error("Não consegui salvar o roteiro (" + r.status + "): " + (await r.text()).slice(0, 120));
  const id = await r.json();
  await status("agente6", "roteiro pronto", `${texto(j.titulo || t.titulo, 80)} · ${modelo.split("/").pop()} · chave ${chave}`);
  await status("agente8", "pronto para editar", "Abra o roteiro e clique em Gerar vídeo animado");
  return { id, cenas: cenas.length, modelo };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const corpo = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  if (corpo.acao === "roteiro") {
    // qualquer pessoa logada pode pedir um roteiro
    const uid = await usuarioLogado(req);
    if (!uid) return res.status(401).json({ erro: "Entre na sua conta para pedir roteiros" });
    if (!chaves().length || !process.env.AGENTES_CHAVE) return res.status(200).json({ ok: false, erro: "Configure NVIDIA_API_KEYS e AGENTES_CHAVE na Vercel" });
    if (!corpo.tendencia || !corpo.tendencia.titulo) return res.status(400).json({ erro: "Escolha uma tendência" });
    INICIO.t = Date.now(); tentativas.length = 0; puladosNaRodada.clear();
    try { return res.status(200).json({ ok: true, ...(await roteirizar(corpo.tendencia, texto(corpo.formato || "Reels/TikTok de 30 a 60 segundos", 60), uid)), tentativas }); }
    catch (e) { await status("agente6", "erro", e.message.slice(0, 140)); return res.status(200).json({ ok: false, erro: e.message, tentativas }); }
  }
  if (!(await autorizado(req))) return res.status(401).json({ erro: "Só administradores (ou o cron) podem rodar os agentes" });
  if (!chaves().length || !process.env.AGENTES_CHAVE) return res.status(200).json({ ok: false, erro: "Configure NVIDIA_API_KEYS e AGENTES_CHAVE na Vercel" });
  const porAgente = Math.max(1, Math.min(5, parseInt(req.query && req.query.n) || 2));
  const so = req.query && req.query.agente;
  INICIO.t = Date.now(); tentativas.length = 0; puladosNaRodada.clear();
  const lista = AGENTES.filter(a => !so || a.id === so);
  let resultado;
  try { resultado = await rodada(lista, porAgente); }
  catch (e) { await Promise.all(lista.map(a => status(a.id, "erro", e.message.slice(0, 140)))); resultado = lista.map(a => ({ agente: a.nome, erro: e.message })); }
  return res.status(200).json({ ok: resultado.some(r => r.publicadas), resultado, tentativas });
};
