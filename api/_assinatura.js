/* Comum ao checkout e ao webhook do Mercado Pago. Preços por pessoa/mês (R$). */
const SUPA = process.env.SUPABASE_URL || "https://geqljiqocpzlkxjjoylk.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_eNVC3vsJuDQritXDoVyiOw_FbMokMGj";
const PRECOS = { equipe: 19.9, empresa: 29.9 };
const NOME_PRODUTO = process.env.PRODUTO_NOME || "Escritório Virtual";
const rpc = async (fn, corpo, token) => {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const t = await r.text(); if (!r.ok) throw new Error(t.slice(0, 200)); try { return JSON.parse(t); } catch (e) { return t; }
};
const mp = async (caminho, opts = {}) => {
  const r = await fetch(`https://api.mercadopago.com${caminho}`, { ...opts, headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error((j && (j.message || j.error)) || t.slice(0, 200));
  return j;
};
// status do Mercado Pago -> status da assinatura no escritório
const STATUS = { authorized: "ativa", pending: "pendente", paused: "pausada", cancelled: "cancelada" };
module.exports = { SUPA, ANON, PRECOS, NOME_PRODUTO, rpc, mp, STATUS };
