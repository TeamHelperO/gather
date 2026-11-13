/* Tempo real do escritório: quem está online, onde está e o que está fazendo.
   Usa um canal do Supabase Realtime:
     presence  → entrou/saiu + nome e personagem
     broadcast "pos" → posição, direção, assento, ação (até ~10x por segundo enquanto anda)
     broadcast "rtc" → sinais das chamadas de áudio (WebRTC) entre duas pessoas */
window.Sala = (function () {
  let canal = null, meuId = null, cb = {}, presentes = new Map(), ultimoEnvio = 0, ultimoEstado = "", pronto = false;

  function entrar(opts) {
    meuId = opts.id; cb = opts;
    canal = Dados.cliente.channel(opts.canal || "escritorio-principal", { config: { presence: { key: meuId }, broadcast: { self: false } } });
    canal.on("presence", { event: "sync" }, () => {
      const st = canal.presenceState(), agora = new Set();
      for (const [id, metas] of Object.entries(st)) {
        if (id === meuId || !metas.length) continue;
        agora.add(id);
        const m = metas[metas.length - 1];
        if (!presentes.has(id)) { presentes.set(id, m); cb.aoEntrar && cb.aoEntrar(id, m); }
        else if (JSON.stringify(presentes.get(id).avatar) !== JSON.stringify(m.avatar) || presentes.get(id).nome !== m.nome || presentes.get(id).status !== m.status) { presentes.set(id, m); cb.aoMudar && cb.aoMudar(id, m); }
      }
      for (const id of [...presentes.keys()]) if (!agora.has(id)) { presentes.delete(id); cb.aoSair && cb.aoSair(id); }
    });
    canal.on("broadcast", { event: "pos" }, ({ payload }) => { if (payload && payload.id !== meuId) cb.aoMover && cb.aoMover(payload.id, payload); });
    canal.on("broadcast", { event: "ola" }, ({ payload }) => { if (payload && payload.id !== meuId) { ultimoEstado = ""; cb.aoOla && cb.aoOla(payload.id); } }); // alguém chegou: reenvia minha posição (e o estado das luzes)
    canal.on("broadcast", { event: "toque" }, ({ payload }) => { if (payload && payload.to === meuId) cb.aoToque && cb.aoToque(payload); });
    canal.on("broadcast", { event: "luz" }, ({ payload }) => { if (payload && payload.sala) cb.aoLuz && cb.aoLuz(payload.sala, payload); });
    canal.on("broadcast", { event: "rtc" }, ({ payload }) => { if (payload && payload.to === meuId) cb.aoSinal && cb.aoSinal(payload); });
    canal.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        pronto = true;
        await canal.track(opts.presenca());
        canal.send({ type: "broadcast", event: "ola", payload: { id: meuId } });
        cb.aoConectar && cb.aoConectar();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        pronto = false; cb.aoDesconectar && cb.aoDesconectar(status);
      }
    });
  }
  /* Envia a posição: no máximo 10x/s quando mudou, e de 2 em 2 s mesmo parado. */
  function enviarPosicao(estado, agora) {
    if (!pronto) return;
    const chave = JSON.stringify(estado);
    if (chave === ultimoEstado && agora - ultimoEnvio < 2000) return;
    if (agora - ultimoEnvio < 100) return;
    ultimoEstado = chave; ultimoEnvio = agora;
    canal.send({ type: "broadcast", event: "pos", payload: { id: meuId, ...estado } });
  }
  function atualizarPresenca(obj) { if (pronto) canal.track(obj); }
  function sinal(para, dados) { if (pronto) canal.send({ type: "broadcast", event: "rtc", payload: { from: meuId, to: para, ...dados } }); }
  function toque(para, dados) { if (pronto) canal.send({ type: "broadcast", event: "toque", payload: { from: meuId, to: para, ...dados } }); }
  function luz(sala, est) { if (pronto) canal.send({ type: "broadcast", event: "luz", payload: { sala, acesa: !!est.acesa, ts: est.ts, por: est.por || "" } }); }
  function sair() { if (canal) { canal.untrack(); Dados.cliente.removeChannel(canal); canal = null; pronto = false; } }
  return { entrar, enviarPosicao, atualizarPresenca, sinal, luz, toque, sair, get conectado() { return pronto; }, get online() { return presentes.size + 1; } };
})();
