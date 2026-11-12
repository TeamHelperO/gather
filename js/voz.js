/* Áudio do escritório (WebRTC, uma ligação direta entre cada par de pessoas que devem se ouvir).
   Regras:
     – sala fechada (reunião, telão, auditório): todo mundo dentro da MESMA sala se ouve, volume cheio;
       quem está fora não ouve.
     – área aberta (trabalho, recepção, copa, corredor, área externa): ouve quem está perto; o volume cai com a distância.
     – área silenciosa: sem áudio.
   Os sinais da ligação passam pelo canal da Sala (Supabase Realtime).

   Preferências de cada pessoa (salvas neste navegador, por e-mail):
     – microfone escolhido, saída de áudio escolhida (fone/caixa), redução de ruído e cancelamento de eco;
     – volume individual de cada colega (0–200%), que vale só para quem ajustou.

   Saída de áudio: no Chrome/Edge o som das pessoas passa pelo Web Audio (AudioContext.setSinkId), o que
   permite volume acima de 100% e trocar o dispositivo de saída. Nos outros navegadores usa o elemento
   <audio> (volume até 100%; troca de saída só se o navegador tiver setSinkId). */
window.Voz = (function () {
  const FECHADAS = new Set(["reuniao", "telao", "auditorio"]);
  const ALCANCE = 210, CHEIO = 70; // px: até CHEIO volume 100%, some em ALCANCE
  const MODO_WEBAUDIO = typeof window.AudioContext === "function" && typeof AudioContext.prototype.setSinkId === "function";
  const SAIDA_NO_ELEMENTO = typeof HTMLMediaElement !== "undefined" && typeof HTMLMediaElement.prototype.setSinkId === "function";

  let ligado = false, stream = null, micAberto = true, ctxAudio = null, meuId = null;
  let iceServers = (window.CONFIG && CONFIG.ICE) || [];
  /* Busca servidores TURN (necessários em 4G/redes de empresa). /api/turn devolve [] se não estiver configurado. */
  async function carregarIce() {
    try {
      const r = await fetch("/api/turn", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.iceServers) && j.iceServers.length) iceServers = [...(CONFIG.ICE || []), ...j.iceServers]; }
    } catch (e) {}
  }
  const temTurn = () => iceServers.some(s => [].concat(s.urls || s.url || []).some(u => /^turns?:/.test(u)));
  const peers = new Map(); // id -> { pc, audio, fonte, ganho, analisador, pendentes:[], vol }
  const proximaTentativa = new Map(), falhas = new Map(); // reconexão com espera crescente
  let nivelLocal = null;

  /* ---------- preferências ---------- */
  let chave = "escritorio-audio";
  let pref = { mic: "", saida: "", ruido: true, eco: true, vols: {} };
  function carregarPref() {
    try { pref = Object.assign({ mic: "", saida: "", ruido: true, eco: true, vols: {} }, JSON.parse(localStorage.getItem(chave) || "{}")); } catch (e) {}
  }
  function salvarPref() { try { localStorage.setItem(chave, JSON.stringify(pref)); } catch (e) {} }
  function configurar(email) { chave = "escritorio-audio:" + (email || "anon"); carregarPref(); }
  carregarPref();

  /* ---------- zonas ---------- */
  function zona(ator) {
    const r = roomAt(ator.px, ator.py - 4);
    if (!r) return { tipo: "aberta", id: "fora" };
    if (r.type === "silenciosa") return { tipo: "silencio", id: r.id, nome: r.name };
    if (FECHADAS.has(r.type)) return { tipo: "fechada", id: r.id, nome: r.name };
    return { tipo: "aberta", id: r.id, nome: r.name };
  }
  function regra(a, b) { // devem se ouvir? e com que volume
    const za = zona(a), zb = zona(b);
    if (za.tipo === "silencio" || zb.tipo === "silencio") return 0;
    if (za.tipo === "fechada" || zb.tipo === "fechada") return za.id === zb.id ? 1 : 0;
    const d = Math.hypot(a.px - b.px, a.py - b.py);
    if (d >= ALCANCE) return 0;
    return d <= CHEIO ? 1 : 1 - (d - CHEIO) / (ALCANCE - CHEIO);
  }

  /* ---------- microfone ---------- */
  function restricoes(deviceId) {
    const a = { echoCancellation: pref.eco, noiseSuppression: pref.ruido, autoGainControl: true };
    if (deviceId) a.deviceId = { exact: deviceId };
    return { audio: a, video: false };
  }
  async function pegarMic(deviceId) {
    try { return await navigator.mediaDevices.getUserMedia(restricoes(deviceId)); }
    catch (e) {
      // o dispositivo salvo sumiu (fone desconectado etc.): volta pro padrão
      if (deviceId && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) {
        try { return await navigator.mediaDevices.getUserMedia(restricoes("")); } catch (e2) { return null; }
      }
      return null;
    }
  }
  function garantirCtx() {
    if (!ctxAudio) ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxAudio.state === "suspended") ctxAudio.resume().catch(() => {});
    return ctxAudio;
  }

  async function ativar(id) {
    meuId = id;
    garantirCtx();
    await carregarIce();
    await aplicarSaida(pref.saida, false);
    stream = await pegarMic(pref.mic);
    if (stream) { nivelLocal = medidor(stream); for (const t of stream.getAudioTracks()) t.enabled = micAberto; }
    ligado = true;
    return { comMicrofone: !!stream };
  }
  function medidor(ms) {
    try {
      const src = garantirCtx().createMediaStreamSource(ms), an = ctxAudio.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      return () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) { const x = (v - 128) / 128; s += x * x; } return Math.sqrt(s / buf.length); };
    } catch (e) { return null; }
  }
  /* Navegadores só tocam som depois de um toque/clique na página: chamar no primeiro gesto. */
  function desbloquear() {
    garantirCtx();
    for (const p of peers.values()) if (p.audio && p.audio.paused) p.audio.play().catch(() => {});
  }
  function alternarMic() {
    if (!stream) return false;
    micAberto = !micAberto;
    for (const t of stream.getAudioTracks()) t.enabled = micAberto;
    return micAberto;
  }

  /* Troca o microfone (ou reaplica ruído/eco) sem derrubar as conversas. */
  async function trocarMic(deviceId) {
    pref.mic = deviceId || ""; salvarPref();
    if (!ligado) return { ok: true };
    const novo = await pegarMic(pref.mic);
    if (!novo) return { ok: false };
    const tinha = !!stream, velho = stream;
    stream = novo; nivelLocal = medidor(stream);
    const trilha = stream.getAudioTracks()[0];
    trilha.enabled = micAberto;
    if (tinha) {
      for (const p of peers.values()) {
        const s = p.pc.getSenders().find(s => s.track && s.track.kind === "audio") || p.pc.getSenders()[0];
        if (s) await s.replaceTrack(trilha).catch(() => {});
      }
    } else {
      // antes só ouvia: as ligações precisam ser refeitas para enviar a voz
      for (const id of [...peers.keys()]) fechar(id, true);
    }
    if (velho) velho.getTracks().forEach(t => t.stop());
    return { ok: true, label: trilha.label };
  }
  async function processamento({ ruido, eco }) {
    if (ruido != null) pref.ruido = !!ruido;
    if (eco != null) pref.eco = !!eco;
    salvarPref();
    if (ligado && stream) await trocarMic(pref.mic);
  }

  /* ---------- saída (fone / caixa de som) ---------- */
  async function aplicarSaida(deviceId, salvar = true) {
    if (salvar) { pref.saida = deviceId || ""; salvarPref(); }
    const id = deviceId || "";
    try {
      if (MODO_WEBAUDIO && ctxAudio) await ctxAudio.setSinkId(id);
      else if (SAIDA_NO_ELEMENTO) for (const p of peers.values()) if (p.audio) await p.audio.setSinkId(id);
      return true;
    } catch (e) {
      if (id) { // o dispositivo salvo não existe mais: volta pro padrão
        try { if (MODO_WEBAUDIO && ctxAudio) await ctxAudio.setSinkId(""); } catch (e2) {}
      }
      return false;
    }
  }
  /* Toca um "plim" no dispositivo de saída escolhido. */
  function testarSaida() {
    const ctx = garantirCtx();
    const tocar = destino => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime;
      o.type = "sine"; o.frequency.setValueAtTime(880, t0); o.frequency.setValueAtTime(1320, t0 + 0.12);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      o.connect(g); g.connect(destino); o.start(t0); o.stop(t0 + 0.5);
    };
    if (MODO_WEBAUDIO) { aplicarSaida(pref.saida, false).then(() => tocar(ctx.destination)); return; }
    const dest = ctx.createMediaStreamDestination(), el = new Audio();
    el.srcObject = dest.stream;
    const go = () => { el.play().catch(() => {}); tocar(dest); setTimeout(() => { el.srcObject = null; }, 800); };
    if (SAIDA_NO_ELEMENTO && pref.saida) el.setSinkId(pref.saida).then(go, go); else go();
  }

  /* ---------- volume individual ---------- */
  function volumePessoa(id) { const v = pref.vols[id]; return v == null ? 1 : v; }
  function definirVolumePessoa(id, v) {
    v = Math.max(0, Math.min(MODO_WEBAUDIO ? 2 : 1, +v));
    if (Math.abs(v - 1) < 0.001) delete pref.vols[id]; else pref.vols[id] = v;
    salvarPref();
    const p = peers.get(id); if (p) aplicarVolume(p, id);
  }
  function aplicarVolume(p, id) {
    const v = Math.max(0, p.vol * volumePessoa(id));
    if (p.ganho) p.ganho.gain.setTargetAtTime(v, ctxAudio.currentTime, 0.05);
    else if (p.audio) p.audio.volume = Math.min(1, v);
  }

  /* ---------- lista de dispositivos ---------- */
  async function dispositivos() {
    let lista = [];
    try { lista = await navigator.mediaDevices.enumerateDevices(); } catch (e) {}
    const nome = (d, i, tipo) => d.label || `${tipo} ${i + 1}`;
    const entradas = lista.filter(d => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId === "default" ? "" : d.deviceId, nome: nome(d, i, "Microfone"), padrao: d.deviceId === "default" }));
    const saidas = lista.filter(d => d.kind === "audiooutput").map((d, i) => ({ id: d.deviceId === "default" ? "" : d.deviceId, nome: nome(d, i, "Saída"), padrao: d.deviceId === "default" }));
    const temNomes = lista.some(d => d.label);
    return { entradas, saidas, temNomes, podeEscolherSaida: MODO_WEBAUDIO || SAIDA_NO_ELEMENTO, volumeMax: MODO_WEBAUDIO ? 2 : 1 };
  }
  async function pedirPermissao() {
    const s = await pegarMic(pref.mic); if (!s) return false;
    s.getTracks().forEach(t => t.stop()); return true;
  }
  /* Medidor do microfone para o painel (usa a ligação atual ou abre um teste temporário). */
  async function testeMic() {
    if (ligado && stream) return { nivel: () => (micAberto && nivelLocal ? nivelLocal() : 0), parar() {} };
    const s = await pegarMic(pref.mic); if (!s) return null;
    const n = medidor(s);
    return { nivel: () => (n ? n() : 0), parar() { s.getTracks().forEach(t => t.stop()); } };
  }

  /* ---------- ligações ---------- */
  function criar(id, iniciar) {
    const pc = new RTCPeerConnection({ iceServers });
    const p = { pc, audio: null, fonte: null, ganho: null, analisador: null, pendentes: [], vol: 0, criado: performance.now(), conectouEm: 0, caiuEm: 0 };
    peers.set(id, p);
    if (stream) for (const t of stream.getAudioTracks()) pc.addTrack(t, stream);
    else pc.addTransceiver("audio", { direction: "recvonly" });
    pc.onicecandidate = (e) => { if (e.candidate) Sala.sinal(id, { tipo: "ice", candidato: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      const ms = e.streams[0] || new MediaStream([e.track]);
      if (!p.audio) { p.audio = new Audio(); p.audio.autoplay = true; p.audio.playsInline = true; p.audio.style.display = "none"; document.body.appendChild(p.audio); }
      p.audio.srcObject = ms;
      if (MODO_WEBAUDIO) {
        // o <audio> mudo mantém o fluxo do WebRTC vivo no Chrome; o som sai pelo Web Audio (com ganho e saída escolhida)
        p.audio.muted = true;
        try {
          const ctx = garantirCtx();
          if (p.fonte) p.fonte.disconnect();
          p.fonte = ctx.createMediaStreamSource(ms);
          if (!p.ganho) { p.ganho = ctx.createGain(); p.ganho.connect(ctx.destination); }
          p.fonte.connect(p.ganho);
        } catch (err) { p.audio.muted = false; p.ganho = null; }
      } else if (SAIDA_NO_ELEMENTO && pref.saida) p.audio.setSinkId(pref.saida).catch(() => {});
      aplicarVolume(p, id);
      p.audio.play().catch(() => {});
      p.analisador = medidor(ms);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") { p.conectouEm = performance.now(); p.caiuEm = 0; }
      else if (st === "disconnected") p.caiuEm = performance.now();
      else if (st === "failed" || st === "closed") { falhas.set(id, (falhas.get(id) || 0) + 1); fechar(id, st === "failed"); }
    };
    if (iniciar) (async () => {
      const oferta = await pc.createOffer(); await pc.setLocalDescription(oferta);
      Sala.sinal(id, { tipo: "oferta", sdp: pc.localDescription.toJSON() });
    })();
    return p;
  }
  function fechar(id, avisar = true) {
    const p = peers.get(id); if (!p) return;
    peers.delete(id);
    try { p.pc.close(); } catch (e) {}
    try { if (p.fonte) p.fonte.disconnect(); if (p.ganho) p.ganho.disconnect(); } catch (e) {}
    if (p.audio) { p.audio.srcObject = null; p.audio.remove(); }
    if (avisar) Sala.sinal(id, { tipo: "tchau" });
  }
  async function aoSinal(msg) {
    if (!ligado) return;
    const id = msg.from;
    try {
      if (msg.tipo === "oferta") {
        let p = peers.get(id); if (p) fechar(id, false);
        p = criar(id, false);
        await p.pc.setRemoteDescription(msg.sdp);
        for (const c of p.pendentes) await p.pc.addIceCandidate(c).catch(() => {}); p.pendentes = [];
        const resp = await p.pc.createAnswer(); await p.pc.setLocalDescription(resp);
        Sala.sinal(id, { tipo: "resposta", sdp: p.pc.localDescription.toJSON() });
      } else if (msg.tipo === "resposta") {
        const p = peers.get(id); if (!p) return;
        await p.pc.setRemoteDescription(msg.sdp);
        for (const c of p.pendentes) await p.pc.addIceCandidate(c).catch(() => {}); p.pendentes = [];
      } else if (msg.tipo === "ice") {
        const p = peers.get(id); if (!p) return;
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(msg.candidato).catch(() => {}); else p.pendentes.push(msg.candidato);
      } else if (msg.tipo === "tchau") fechar(id, false);
    } catch (e) { console.warn("áudio:", e); }
  }
  /* Chamado a cada quadro: abre/fecha ligações e ajusta volumes; marca quem está falando. */
  function atualizar(eu, outros, agora) {
    if (nivelLocal && micAberto && nivelLocal() > 0.04) eu.vozAtiva = agora;
    if (!ligado) return;
    for (const o of outros) {
      const v = o.audio === false ? 0 : regra(eu, o);
      let p = peers.get(o.id);
      o.volPessoal = volumePessoa(o.id);
      // ligação travada (o outro não respondeu ou a rede bloqueou): derruba e tenta de novo
      if (p) {
        const st = p.pc.connectionState;
        const travada = st !== "connected" && agora - p.criado > 10000;
        const caiu = st === "disconnected" && p.caiuEm && agora - p.caiuEm > 5000;
        if (travada || caiu) {
          const n = (falhas.get(o.id) || 0) + 1; falhas.set(o.id, n);
          fechar(o.id, true); p = null;
          proximaTentativa.set(o.id, agora + Math.min(30000, 1500 * n));
        }
      }
      if (v > 0) {
        if (!p && meuId < o.id && agora >= (proximaTentativa.get(o.id) || 0)) criar(o.id, true);
        const q = peers.get(o.id);
        o.estadoAudio = !q ? "esperando" : q.pc.connectionState === "connected" ? "conectado" : "conectando";
        o.audioFalhas = falhas.get(o.id) || 0;
        if (q) {
          if (Math.abs(q.vol - v) > 0.01) { q.vol = v; aplicarVolume(q, o.id); }
          if (q.analisador && q.analisador() > 0.03) o.vozAtiva = agora;
        }
        o.ouvindo = !!q && q.pc.connectionState === "connected";
        if (o.ouvindo) falhas.delete(o.id);
      } else {
        o.estadoAudio = null;
        if (p) fechar(o.id, true);
        o.ouvindo = false;
      }
    }
    for (const id of [...peers.keys()]) if (!outros.some(o => o.id === id)) fechar(id, false);
  }
  function desligar() { for (const id of [...peers.keys()]) fechar(id, true); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; ligado = false; }

  // fone desconectado / novo dispositivo: se o escolhido sumiu, segue no padrão
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", async () => {
      const d = await dispositivos();
      if (pref.mic && ligado && !d.entradas.some(x => x.id === pref.mic)) { const salvo = pref.mic; await trocarMic(""); pref.mic = salvo; salvarPref(); }
      if (pref.saida && !d.saidas.some(x => x.id === pref.saida)) await aplicarSaida("", false);
      else if (pref.saida) await aplicarSaida(pref.saida, false);
      window.dispatchEvent(new Event("voz:dispositivos"));
    });
  }

  return {
    configurar, ativar, alternarMic, desbloquear, aoSinal, atualizar, desligar, zona,
    dispositivos, pedirPermissao, trocarMic, processamento, aplicarSaida, testarSaida, testeMic,
    volumePessoa, definirVolumePessoa,
    get pref() { return { ...pref, vols: { ...pref.vols } }; },
    get ligado() { return ligado; }, get temMic() { return !!stream; }, get micAberto() { return micAberto && !!stream; },
    get conexoes() { return peers.size; }, get temTurn() { return temTurn(); }, get micAtual() { return stream ? (stream.getAudioTracks()[0] || {}).label || "" : ""; },
  };
})();
