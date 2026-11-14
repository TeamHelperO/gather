/* Servidores TURN para as chamadas de áudio (necessários quando alguém está no 4G ou numa rede que bloqueia conexão direta).
   Usa o TURN gratuito da Cloudflare. Configure na Vercel (Settings → Environment Variables):
     CF_TURN_KEY_ID     – "Turn Token ID" criado em dash.cloudflare.com → Realtime → TURN Server
     CF_TURN_API_TOKEN  – "API Token" desse mesmo TURN
   Sem as variáveis, devolve lista vazia e o áudio usa só STUN (funciona na maioria das redes Wi-Fi). */
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = (process.env.CF_TURN_KEY_ID || "").trim(), token = (process.env.CF_TURN_API_TOKEN || "").trim();
  if (!id || !token) return res.status(200).json({ iceServers: [], configurado: false });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!r.ok) return res.status(200).json({ iceServers: [], configurado: true, erro: r.status,
      // só o formato, nunca o valor: ajuda a ver se o ID colado é o "Turn Token ID" (32 caracteres hexadecimais)
      formato_id: { tamanho: id.length, hex32: /^[0-9a-f]{32}$/i.test(id) }, tamanho_token: token.length });
    const j = await r.json();
    const lista = [].concat(j.iceServers || []).map(s => ({ ...s, urls: [].concat(s.urls || []).filter(u => !/:53\b/.test(u)) })); // porta 53 trava em alguns navegadores
    return res.status(200).json({ iceServers: lista, configurado: true });
  } catch (e) {
    return res.status(200).json({ iceServers: [], configurado: true, erro: "falha" });
  }
};
