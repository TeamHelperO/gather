/* Relatório semanal das tarefas por e-mail para os administradores.
   – Cron da Vercel toda segunda às 8h (Brasília): GET com Authorization: Bearer CRON_SECRET.
   – Botão "Enviar por e-mail agora" no painel do gestor: POST com o token de um administrador.
   Usa AGENTES_CHAVE (RPC relatorio_semana) para ler os dados e o SMTP do cPanel (SMTP_*) para enviar. */
const { enviarSMTP, smtpPronto } = require("./_smtp.js");
const Rel = require("../js/relatorio-core.js");
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const rpc = (fn, corpo, token) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo || {}) });

async function quemPede(req) {
  const segredo = process.env.CRON_SECRET, auth = req.headers.authorization || "";
  if (segredo && auth === `Bearer ${segredo}`) return { cron: true };
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const r = await rpc("e_admin", {}, token).catch(() => null);
  if (!(r && r.ok && (await r.json()) === true)) return null;
  const u = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }).then(x => x.ok ? x.json() : null).catch(() => null);
  return { admin: true, email: u && u.email };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const quem = await quemPede(req);
  if (!quem) return res.status(401).json({ erro: "Só o cron ou administradores" });
  if (!process.env.AGENTES_CHAVE) return res.status(200).json({ ok: false, erro: "Configure AGENTES_CHAVE na Vercel" });
  if (!smtpPronto()) return res.status(200).json({ ok: false, erro: "Configure o e-mail do cPanel (SMTP_HOST, SMTP_USER, SMTP_PASS) na Vercel" });

  const r = await rpc("relatorio_semana", { p_chave: process.env.AGENTES_CHAVE, p_mapa: "principal" });
  if (!r.ok) return res.status(200).json({ ok: false, erro: "Rode o arquivo rodar_no_supabase_7.sql no Supabase (" + r.status + ")" });
  const d = await r.json();
  // tarefas do escritório da Next: as das salas do mapa principal e as sem sala
  const salas = new Set((d.salas || []).map(s => s.id));
  const tarefas = (d.tarefas || []).filter(t => !t.sala || salas.has(t.sala));
  const rel = Rel.calcular({ tarefas, usuarios: d.usuarios, presenca: d.presenca });
  const link = `https://${req.headers.host || "gather-next.vercel.app"}/escritorio.html?sala=nextco`;
  const html = Rel.html(rel, "Relatório da semana — Escritório Next Co.", link), texto = Rel.texto(rel, "Relatório da semana — Escritório Next Co.");

  // cron: todos os administradores; botão: só quem pediu
  const para = quem.cron ? (d.usuarios || []).filter(u => u.papel === "admin" && u.email).map(u => u.email) : [quem.email].filter(Boolean);
  if (!para.length) return res.status(200).json({ ok: false, erro: "Nenhum administrador com e-mail" });
  const assunto = `Relatório da semana: ${rel.concluidas.length} concluídas, ${rel.atrasadas.length} atrasadas`;
  const enviados = [], falhas = [];
  for (const e of para) { try { await enviarSMTP({ para: e, assunto, corpo: texto, html }); enviados.push(e); } catch (err) { falhas.push(e + ": " + err.message); } }
  return res.status(200).json({ ok: enviados.length > 0, enviados, falhas, resumo: { concluidas: rel.concluidas.length, atrasadas: rel.atrasadas.length } });
};
