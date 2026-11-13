/* Lê a caixa de entrada do e-mail do cPanel e acha respostas das empresas prospectadas.
   Resposta normal → prospect "respondeu" + tarefa "📨 Responder <empresa>" no telão para quem enviou + aviso.
   Resposta pedindo para sair ("remover") → prospect "descadastrado", sem tarefa.
   Chamado pelo cron (Bearer CRON_SECRET) ou por um administrador logado (botão "Verificar respostas"). */
const { buscarRespostas } = require("./_imap.js");
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const rpc = (fn, corpo, token) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo || {}) });
const QUER_SAIR = /\b(remover|remova|descadastr|unsubscribe|n[ãa]o (quero|desejo|tenho interesse em) receber|pare de (me )?enviar|me tire da lista)/i;

async function autorizado(req) {
  const segredo = process.env.CRON_SECRET, auth = req.headers.authorization || "";
  if (segredo && auth === `Bearer ${segredo}`) return true;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const r = await rpc("e_admin", {}, token).catch(() => null);
  return !!(r && r.ok && (await r.json()) === true);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await autorizado(req))) return res.status(401).json({ erro: "Só o cron ou administradores" });
  if (!process.env.AGENTES_CHAVE) return res.status(200).json({ ok: false, erro: "Configure AGENTES_CHAVE na Vercel" });
  const r = await rpc("prospects_enviados", { p_chave: process.env.AGENTES_CHAVE });
  if (!r.ok) return res.status(200).json({ ok: false, erro: "Rode o arquivo rodar_no_supabase_8.sql no Supabase (" + r.status + ")" });
  const enviados = await r.json();
  if (!enviados.length) return res.status(200).json({ ok: true, respostas: 0, verificados: 0, msg: "Nenhum e-mail enviado aguardando resposta" });

  const porEmail = new Map(enviados.map(p => [p.email, p])), porDominio = new Map();
  for (const p of enviados) if (p.dominio && !porDominio.has(p.dominio)) porDominio.set(p.dominio, p);
  const procurar = de => porEmail.get(de) || porDominio.get(de.split("@")[1]) || null;
  const desde = new Date(Math.min(...enviados.map(p => new Date(p.enviado_em).getTime())) - 864e5);

  let achadas;
  try { achadas = await buscarRespostas(desde, procurar); }
  catch (e) { return res.status(200).json({ ok: false, erro: e.message }); }

  const feitos = new Set(), resultado = [];
  for (const a of achadas.sort((x, y) => x.data - y.data)) {
    const p = a.item;
    if (feitos.has(p.id) || a.data < new Date(p.enviado_em)) continue; // só o que chegou depois do envio, uma vez por empresa
    feitos.add(p.id);
    const remover = QUER_SAIR.test((a.texto || "").slice(0, 400)) || QUER_SAIR.test(a.assunto || "");
    const texto = (a.assunto ? `Assunto: ${a.assunto}\n\n` : "") + (a.texto || "(sem texto)");
    const x = await rpc("prospect_respondeu", { p_chave: process.env.AGENTES_CHAVE, p_id: p.id, p_texto: texto, p_quando: a.data.toISOString(), p_remover: remover, p_de: a.de });
    resultado.push({ empresa: p.empresa, de: a.de, remover, ok: x.ok, tarefa: x.ok ? await x.json() : null });
  }
  return res.status(200).json({ ok: true, verificados: enviados.length, lidas: achadas.length, respostas: resultado.filter(x => !x.remover).length, saiu: resultado.filter(x => x.remover).length, detalhes: resultado });
};
