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
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const RODAPE = 'Se não quiser receber mais e-mails da Next Co., é só responder com "remover".';

const api = (caminho, token, opcoes = {}) => fetch(`${SUPA}${caminho}`, { ...opcoes, headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opcoes.headers || {}) } });

const { enviarSMTP } = require("./_smtp.js");

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
