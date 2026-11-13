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
    // alguém chegou: responde na hora com a minha última posição (não espera o laço do jogo, que para quando a aba está em segundo plano)
    canal.on("broadcast", { event: "ola" }, ({ payload }) => { if (payload && payload.id !== meuId) { ultimoEstado = ""; responderOla(); cb.aoOla && cb.aoOla(payload.id); } });
    canal.on("broadcast", { event: "admin" }, ({ payload }) => { if (payload && (payload.to === meuId || payload.to === "*")) cb.aoAdmin && cb.aoAdmin(payload); });
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
  /* Envia a posição. O Supabase (plano grátis) aguenta ~100 mensagens/s no projeto, e cada envio chega a todos
     da sala, então a frequência cai conforme entra gente: até 3 pessoas 10x/s, 4 pessoas ~6x/s, 6 pessoas ~2,5x/s
     (nunca menos de 2x/s). Mudança de estado (parou, sentou, emote, microfone) vai na hora; parado, reenvia a cada 2 s.
     Quem recebe guarda as posições e anda suavemente entre elas (ver moverOutros). */
  let ultimoSemPos = "", ultimoObj = null;
  function responderOla() {
    if (!pronto || !ultimoObj) return;
    const atraso = document.hidden ? 0 : Math.random() * 250; // espalha as respostas (em segundo plano manda já: o navegador atrasa timers)
    setTimeout(() => { if (pronto && ultimoObj) { canal.send({ type: "broadcast", event: "pos", payload: { id: meuId, iv: intervaloEnvio(), ...ultimoObj } }); ultimoEnvio = performance.now(); } }, atraso);
  }
  function intervaloEnvio() { const n = presentes.size + 1; return Math.max(100, Math.min(500, Math.round(1000 * n * (n - 1) / 70))); }
  function enviarPosicao(estado, agora) {
    ultimoObj = estado;
    if (!pronto) return;
    const chave = JSON.stringify(estado), { x, y, ...resto } = estado, semPos = JSON.stringify(resto);
    if (chave === ultimoEstado && agora - ultimoEnvio < 2000) return;
    const mudouEstado = semPos !== ultimoSemPos;
    if (agora - ultimoEnvio < (mudouEstado ? 60 : intervaloEnvio())) return;
    ultimoEstado = chave; ultimoSemPos = semPos; ultimoEnvio = agora;
    canal.send({ type: "broadcast", event: "pos", payload: { id: meuId, iv: intervaloEnvio(), ...estado } });
  }
  function atualizarPresenca(obj) { if (pronto) canal.track(obj); }
  function sinal(para, dados) { if (pronto) canal.send({ type: "broadcast", event: "rtc", payload: { from: meuId, to: para, ...dados } }); }
  function admin(para, dados) { if (pronto) canal.send({ type: "broadcast", event: "admin", payload: { from: meuId, to: para, ...dados } }); }
  function toque(para, dados) { if (pronto) canal.send({ type: "broadcast", event: "toque", payload: { from: meuId, to: para, ...dados } }); }
  function luz(sala, est) { if (pronto) canal.send({ type: "broadcast", event: "luz", payload: { sala, acesa: !!est.acesa, ts: est.ts, por: est.por || "" } }); }
  function sair() { if (canal) { canal.untrack(); Dados.cliente.removeChannel(canal); canal = null; pronto = false; } }
  return { entrar, enviarPosicao, atualizarPresenca, sinal, luz, toque, admin, sair, get conectado() { return pronto; }, get online() { return presentes.size + 1; } };
})();
