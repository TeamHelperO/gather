/* Envia o e-mail de prospecção aprovado no painel, pelo e-mail do cPanel (SMTP).
   Variáveis na Vercel:
     SMTP_HOST       – ex.: mail.seudominio.com.br
     SMTP_PORT       – 465 (SSL, padrão) ou 587 (STARTTLS)
     SMTP_USER       – o e-mail completo da conta
     SMTP_PASS       – a senha dessa conta de e-mail
     SMTP_FROM       – opcional: "Next Co. <contato@seudominio.com.br>" (padrão: SMTP_USER)
     SMTP_COPIA      – opcional: endereço que recebe uma cópia oculta de cada envio (o cPanel não guarda em "Enviados")
     SMTP_LIMITE_DIA – opcional: máximo de envios por dia (padrão 40, para não cair em spam nem estourar o limite do servidor)
   Só administradores logados enviam. POST { id, email, assunto, corpo, teste? } */
const net = require("net"), tls = require("tls"), crypto = require("crypto");
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const RODAPE = 'Se não quiser receber mais e-mails da Next Co., é só responder com "remover".';

const api = (caminho, token, opcoes = {}) => fetch(`${SUPA}${caminho}`, { ...opcoes, headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opcoes.headers || {}) } });

/* ---------- SMTP mínimo (sem dependências) ---------- */
class Conversa {
  constructor(s) { this.ligar(s); }
  ligar(s) {
    this.s = s; this.buf = "";
    s.on("data", d => { this.buf += d.toString("utf8"); this.ver(); });
    s.on("error", e => { const w = this.w; this.w = null; if (w) w.falha(e); });
  }
  ver() {
    if (!this.w) return;
    const linhas = this.buf.split("\r\n");
    for (let i = 0; i < linhas.length - 1; i++) if (/^\d{3}( |$)/.test(linhas[i])) {
      const resp = linhas.slice(0, i + 1).join("\n"); this.buf = linhas.slice(i + 1).join("\r\n");
      const w = this.w; this.w = null; return w.ok({ cod: +linhas[i].slice(0, 3), texto: resp });
    }
  }
  async cmd(linha, esperado, mostrar) {
    const p = new Promise((ok, falha) => { this.w = { ok, falha }; });
    if (linha != null) this.s.write(linha + "\r\n");
    this.ver();
    const r = await p;
    if (!esperado.includes(r.cod)) throw new Error(`Servidor de e-mail recusou ${mostrar || (linha || "a conexão").split(" ")[0]}: ${r.texto.replace(/\s+/g, " ").slice(0, 200)}`);
    return r;
  }
}
const ssl = porta => porta === 465 || process.env.SMTP_SSL === "1";
function conectar(host, porta) {
  return new Promise((ok, falha) => {
    const s = ssl(porta) ? tls.connect({ host, port: porta, servername: host }) : net.connect({ host, port: porta });
    s.once(ssl(porta) ? "secureConnect" : "connect", () => ok(s));
    s.once("error", falha);
    s.setTimeout(20000, () => s.destroy(new Error("O servidor de e-mail demorou demais para responder")));
  });
}
const b64 = t => Buffer.from(t, "utf8").toString("base64");
const quebrar = t => t.replace(/.{1,76}/g, "$&\r\n");
const cab = t => /^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64(t)}?=`;
const endereco = t => ((String(t).match(/<([^>]+)>/) || [])[1] || String(t)).trim();
const remetente = t => { const m = String(t).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/); return m && m[1] ? `${cab(m[1])} <${m[2]}>` : endereco(t); };
const escHtml = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function montar({ de, para, assunto, corpo }) {
  const dom = endereco(de).split("@")[1] || "localhost", lim = "=_nc_" + crypto.randomBytes(9).toString("hex");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1d1d1f">` +
    corpo.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${escHtml(p).replace(/\n/g, "<br>")}</p>`).join("") + `</div>`;
  return [
    `From: ${remetente(de)}`, `To: <${para}>`, `Reply-To: <${endereco(de)}>`, `Subject: ${cab(assunto)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`, `Message-ID: <${crypto.randomUUID()}@${dom}>`,
    `List-Unsubscribe: <mailto:${endereco(de)}?subject=remover>`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${lim}"`, "",
    `--${lim}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", quebrar(b64(corpo)),
    `--${lim}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", quebrar(b64(html)),
    `--${lim}--`, "",
  ].join("\r\n");
}

async function enviarSMTP({ para, assunto, corpo }) {
  const host = process.env.SMTP_HOST, porta = parseInt(process.env.SMTP_PORT) || 465, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  const de = process.env.SMTP_FROM || user, copia = process.env.SMTP_COPIA;
  let s = await conectar(host, porta), c = new Conversa(s);
  try {
    await c.cmd(null, [220]);
    await c.cmd("EHLO nextco.vercel", [250]);
    if (!ssl(porta)) {
      await c.cmd("STARTTLS", [220]);
      s.removeAllListeners("data"); s.removeAllListeners("error");
      s = await new Promise((ok, falha) => { const t = tls.connect({ socket: s, servername: host }, () => ok(t)); t.once("error", falha); });
      c = new Conversa(s);
      await c.cmd("EHLO nextco.vercel", [250]);
    }
    await c.cmd("AUTH PLAIN " + Buffer.from(`\0${user}\0${pass}`).toString("base64"), [235], "o login (confira SMTP_USER e SMTP_PASS)");
    await c.cmd(`MAIL FROM:<${endereco(de)}>`, [250]);
    await c.cmd(`RCPT TO:<${para}>`, [250, 251], "o destinatário");
    if (copia) await c.cmd(`RCPT TO:<${endereco(copia)}>`, [250, 251], "a cópia");
    await c.cmd("DATA", [354]);
    await c.cmd(montar({ de, para, assunto, corpo }).replace(/\r\n\./g, "\r\n..") + "\r\n.", [250], "a mensagem");
    await c.cmd("QUIT", [221]).catch(() => {});
  } finally { s.end(); }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const corpoReq = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return res.status(401).json({ erro: "Entre na sua conta" });
  const adm = await api("/rest/v1/rpc/e_admin", token, { method: "POST", body: "{}" }).then(r => r.ok ? r.json() : false).catch(() => false);
  if (adm !== true) return res.status(403).json({ erro: "Só administradores enviam e-mails de prospecção" });
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return res.status(200).json({ ok: false, erro: "Configure SMTP_HOST, SMTP_USER e SMTP_PASS na Vercel (dados do e-mail do cPanel)" });

  const id = String(corpoReq.id || ""), assunto = String(corpoReq.assunto || "").trim().slice(0, 200), texto = String(corpoReq.corpo || "").trim().slice(0, 8000);
  if (!assunto || texto.length < 20) return res.status(400).json({ erro: "Escreva o assunto e o texto do e-mail" });
  const [p] = await api(`/rest/v1/prospects?select=*&id=eq.${encodeURIComponent(id)}`, token).then(r => r.ok ? r.json() : []).catch(() => []);
  if (!p) return res.status(404).json({ erro: "Empresa não encontrada" });

  const assinatura = String(corpoReq.assinatura || "").trim();
  const final = texto + (assinatura && !texto.includes(assinatura) ? "\n\n" + assinatura : "") + "\n\n—\n" + RODAPE;

  // teste: manda para o próprio admin, sem mudar nada na empresa
  if (corpoReq.teste) {
    const u = await api("/auth/v1/user", token).then(r => r.ok ? r.json() : null).catch(() => null);
    if (!u || !u.email) return res.status(200).json({ ok: false, erro: "Não achei o seu e-mail" });
    try { await enviarSMTP({ para: u.email, assunto: "[TESTE] " + assunto, corpo: final }); return res.status(200).json({ ok: true, teste: true, para: u.email }); }
    catch (e) { return res.status(200).json({ ok: false, erro: e.message }); }
  }

  const para = String(corpoReq.email || p.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(para)) return res.status(400).json({ erro: "E-mail do destinatário inválido" });
  if (p.status === "enviado") return res.status(409).json({ erro: "Esta empresa já recebeu o e-mail" });
  if (p.status === "descadastrado") return res.status(409).json({ erro: "Esta empresa pediu para não receber e-mails" });
  const ja = await api(`/rest/v1/prospects?select=id&status=eq.enviado&id=neq.${encodeURIComponent(id)}&email=eq.${encodeURIComponent(para)}`, token).then(r => r.ok ? r.json() : []).catch(() => []);
  if (ja.length) return res.status(409).json({ erro: "Esse endereço já recebeu um e-mail nosso" });
  const limite = parseInt(process.env.SMTP_LIMITE_DIA) || 40;
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) + "T03:00:00Z";
  const enviadosHoje = await api(`/rest/v1/prospects?select=id&status=eq.enviado&enviado_em=gte.${hoje}`, token).then(r => r.ok ? r.json() : []).catch(() => []);
  if (enviadosHoje.length >= limite) return res.status(200).json({ ok: false, erro: `Limite de ${limite} e-mails por dia atingido. Continue amanhã.` });

  const uid = await api("/auth/v1/user", token).then(r => r.ok ? r.json() : {}).then(u => u.id || null).catch(() => null);
  const marcar = campos => api(`/rest/v1/prospects?id=eq.${encodeURIComponent(id)}`, token, { method: "PATCH", body: JSON.stringify(campos) });
  try {
    await enviarSMTP({ para, assunto, corpo: final });
    await marcar({ status: "enviado", email: para, assunto, corpo: texto, enviado_em: new Date().toISOString(), enviado_por: uid, erro: null });
    return res.status(200).json({ ok: true, para, hoje: enviadosHoje.length + 1, limite });
  } catch (e) {
    await marcar({ erro: e.message.slice(0, 300), email: para, assunto, corpo: texto, editado_por: uid });
    return res.status(200).json({ ok: false, erro: e.message });
  }
};
