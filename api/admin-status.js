/* Situação das integrações para o painel administrativo (admin.html).
   GET com o token de um admin geral (Authorization: Bearer ...). Nunca devolve chaves nem senhas:
   só se cada coisa está configurada e, quando dá para testar de graça, se está funcionando. */
const { SUPA, ANON, rpc } = require("./_assinatura.js");

const tem = (...nomes) => nomes.every(n => !!String(process.env[n] || "").trim());
const comPrazo = (p, ms = 6000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("demorou demais")), ms))]);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ erro: "Entre na sua conta" });
  try { if ((await rpc("e_admin", {}, token)) !== true) return res.status(403).json({ erro: "Só para administradores" }); }
  catch (e) { return res.status(403).json({ erro: "Só para administradores" }); }

  const itens = [];
  const add = (grupo, nome, ok, detalhe, ajuda) => itens.push({ grupo, nome, ok, detalhe, ajuda });
  const host = req.headers["x-forwarded-host"] || req.headers.host;

  // Mercado Pago
  if (!tem("MP_ACCESS_TOKEN")) add("Pagamentos", "Mercado Pago", false, "Falta MP_ACCESS_TOKEN na Vercel", "Mercado Pago → Suas integrações → Credenciais de produção → Access Token");
  else {
    try {
      const r = await comPrazo(fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN.trim()}` } }));
      const j = await r.json().catch(() => ({}));
      if (r.ok) add("Pagamentos", "Mercado Pago", true, `Conectado à conta ${j.nickname || j.email || j.id}${String(process.env.MP_ACCESS_TOKEN).trim().startsWith("TEST-") ? " (modo de TESTE)" : ""}`);
      else add("Pagamentos", "Mercado Pago", false, `O Mercado Pago recusou o token (erro ${r.status})`, "Gere um novo Access Token de produção e troque na Vercel");
    } catch (e) { add("Pagamentos", "Mercado Pago", false, "Não consegui falar com o Mercado Pago agora", ""); }
  }
  add("Pagamentos", "Webhook do Mercado Pago", null, `Endereço para cadastrar: https://${host}/api/mp-webhook (evento “Planos e assinaturas”)`, "O painel do Mercado Pago é o único lugar que confirma se ele foi cadastrado");

  // Chamadas de áudio e vídeo
  if (!tem("CF_TURN_KEY_ID", "CF_TURN_API_TOKEN")) add("Chamadas", "TURN (Cloudflare)", false, "Sem TURN: quem está no 4G ou em rede de empresa pode não conseguir falar", "Cloudflare → Realtime → TURN Server");
  else {
    try {
      const r = await comPrazo(fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CF_TURN_KEY_ID.trim()}/credentials/generate-ice-servers`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CF_TURN_API_TOKEN.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify({ ttl: 60 }) }));
      add("Chamadas", "TURN (Cloudflare)", r.ok, r.ok ? "Funcionando" : `A Cloudflare recusou as chaves (erro ${r.status})`);
    } catch (e) { add("Chamadas", "TURN (Cloudflare)", false, "Não consegui falar com a Cloudflare agora"); }
  }

  // IA
  const nv = (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || "").split(/[\s,;]+/).filter(Boolean).length;
  add("IA", "Agentes (NVIDIA)", nv > 0, nv ? `${nv} chave${nv > 1 ? "s" : ""} configurada${nv > 1 ? "s" : ""}${process.env.NVIDIA_MODEL ? " · modelo " + process.env.NVIDIA_MODEL : ""}` : "Falta NVIDIA_API_KEYS: os agentes de IA não trabalham");

  // E-mail
  add("E-mail", "Envio (SMTP)", tem("SMTP_HOST", "SMTP_USER", "SMTP_PASS"), tem("SMTP_HOST", "SMTP_USER", "SMTP_PASS") ? `Pelo servidor ${process.env.SMTP_HOST}${process.env.SMTP_LIMITE_DIA ? " · limite " + process.env.SMTP_LIMITE_DIA + "/dia" : ""}` : "Faltam SMTP_HOST, SMTP_USER e SMTP_PASS: relatórios e prospecção não saem");
  add("E-mail", "Leitura de respostas (IMAP)", tem("IMAP_HOST", "IMAP_USER", "IMAP_PASS"), tem("IMAP_HOST", "IMAP_USER", "IMAP_PASS") ? "Configurado" : "Faltam IMAP_HOST, IMAP_USER e IMAP_PASS (respostas dos e-mails)");

  // Outros
  add("Outros", "Chave dos agentes e do webhook", tem("AGENTES_CHAVE"), tem("AGENTES_CHAVE") ? "Configurada" : "Falta AGENTES_CHAVE: o webhook não consegue ativar assinaturas");
  add("Outros", "Tarefas agendadas (cron)", tem("CRON_SECRET"), tem("CRON_SECRET") ? "Configurada" : "Falta CRON_SECRET");
  add("Outros", "Google Maps / Places", tem("GOOGLE_PLACES_KEY") || tem("GOOGLE_MAPS_API_KEY"), tem("GOOGLE_PLACES_KEY") || tem("GOOGLE_MAPS_API_KEY") ? "Configurada" : "Sem chave do Google: a prospecção não busca empresas no mapa");

  return res.status(200).json({ itens, nomeProduto: process.env.PRODUTO_NOME || "Andar", supabase: SUPA.replace(/^https:\/\//, ""), anon: !!ANON });
};
