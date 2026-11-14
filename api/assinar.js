/* Checkout da assinatura (Mercado Pago, sem plano fixo: o valor é preço do plano × pessoas).
   POST { mapa, plano: "equipe"|"empresa", pessoas } com o token do dono do espaço (Authorization: Bearer ...).
   Devolve { url } do checkout do Mercado Pago; depois o webhook (api/mp-webhook) ativa a assinatura.
   Na Vercel: MP_ACCESS_TOKEN (Access Token de produção do Mercado Pago) e AGENTES_CHAVE (já existe). */
const { PRECOS, NOME_PRODUTO, rpc, mp, SUPA, ANON } = require("./_assinatura.js");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!process.env.MP_ACCESS_TOKEN) return res.status(200).json({ erro: "Pagamento ainda não configurado (falta MP_ACCESS_TOKEN na Vercel)" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ erro: "Entre na sua conta" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const mapa = String((b && b.mapa) || "").slice(0, 60), plano = String((b && b.plano) || ""), pessoas = Math.round(Number(b && b.pessoas));
  if (!mapa || mapa === "principal") return res.status(400).json({ erro: "Espaço inválido" });
  if (!PRECOS[plano]) return res.status(400).json({ erro: "Plano inválido" });
  if (!(pessoas >= 1 && pessoas <= 500)) return res.status(400).json({ erro: "Informe de 1 a 500 pessoas" });
  try {
    // só o dono do espaço assina
    const dono = await rpc("dono_da_sala", { p_mapa: mapa }, token);
    if (dono !== true) return res.status(403).json({ erro: "Só o dono do espaço pode assinar" });
    const u = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }).then(r => r.json());
    if (!u || !u.email) return res.status(401).json({ erro: "Entre na sua conta" });
    const valor = Math.round(PRECOS[plano] * pessoas * 100) / 100;
    const origem = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const assinatura = await mp("/preapproval", { method: "POST", body: JSON.stringify({
      reason: `${NOME_PRODUTO} — plano ${plano === "empresa" ? "Empresa" : "Equipe"}, ${pessoas} pessoa${pessoas > 1 ? "s" : ""}`,
      external_reference: `${mapa}|${plano}|${pessoas}`,
      payer_email: u.email,
      back_url: `${origem}/escritorio?sala=${encodeURIComponent(mapa)}&assinatura=ok`,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: valor, currency_id: "BRL" },
      status: "pending",
    }) });
    await rpc("assinatura_registrar", { p_chave: process.env.AGENTES_CHAVE, p_mapa: mapa, p_status: "pendente", p_plano: plano, p_pessoas: pessoas, p_valor: valor, p_mp_id: assinatura.id, p_email: u.email }).catch(() => {});
    return res.status(200).json({ url: assinatura.init_point, valor });
  } catch (e) {
    return res.status(200).json({ erro: "Não consegui abrir o pagamento: " + String(e.message || e).slice(0, 160) });
  }
};
