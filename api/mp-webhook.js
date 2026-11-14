/* Notificações do Mercado Pago (configure em "Suas integrações" → Webhooks → evento "Planos e assinaturas",
   URL: https://SEU-DOMINIO/api/mp-webhook). A notificação só traz o id: a assinatura é lida de novo na API
   do Mercado Pago (com o nosso Access Token), então ninguém consegue ativar um espaço mandando dados falsos. */
const { rpc, mp, STATUS, PRECOS } = require("./_assinatura.js");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const q = req.query || {}, tipo = (b && (b.type || b.topic)) || q.type || q.topic || "";
  const id = (b && b.data && b.data.id) || q["data.id"] || q.id;
  if (!/preapproval/.test(tipo) || !id || !process.env.MP_ACCESS_TOKEN) return res.status(200).json({ ok: true, ignorado: true });
  try {
    const a = await mp(`/preapproval/${encodeURIComponent(id)}`);
    const [mapa, plano, pessoas] = String(a.external_reference || "").split("|");
    if (!mapa || !PRECOS[plano]) return res.status(200).json({ ok: true, ignorado: true });
    await rpc("assinatura_registrar", { p_chave: process.env.AGENTES_CHAVE, p_mapa: mapa, p_status: STATUS[a.status] || "pendente", p_plano: plano, p_pessoas: parseInt(pessoas) || null,
      p_valor: a.auto_recurring && a.auto_recurring.transaction_amount || null, p_mp_id: a.id, p_email: a.payer_email || null });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: String(e.message || e).slice(0, 200) }); // o Mercado Pago tenta de novo
  }
};
