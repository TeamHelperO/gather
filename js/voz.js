/* Áudio do escritório (WebRTC, uma ligação direta entre cada par de pessoas que devem se ouvir).
   Regras:
     – sala fechada (reunião, telão, auditório): todo mundo dentro da MESMA sala se ouve, volume cheio;
       quem está fora não ouve.
     – área aberta (trabalho, recepção, copa, corredor, área externa): ouve quem está perto; o volume cai com a distância.
     – área silenciosa: sem áudio.
   Os sinais da ligação passam pelo canal da Sala (Supabase Realtime). */
window.Voz = (function () {
  const FECHADAS = new Set(["reuniao", "telao", "auditorio"]);
  const ALCANCE = 210, CHEIO = 70; // px: até CHEIO volume 100%, some em ALCANCE
  let ligado = false, stream = null, micAberto = true, ctxAudio = null, meuId = null;
  const peers = new Map(); // id -> { pc, audio, analisador, dados, pendentes:[] }
  let nivelLocal = null;

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

  async function ativar(id) {
    meuId = id;
    ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    try { await ctxAudio.resume(); } catch (e) {}
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      nivelLocal = medidor(stream);
    } catch (e) { stream = null; }
    ligado = true;
    return { comMicrofone: !!stream };
  }
  function medidor(ms) {
    try {
      const src = ctxAudio.createMediaStreamSource(ms), an = ctxAudio.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      return () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) { const x = (v - 128) / 128; s += x * x; } return Math.sqrt(s / buf.length); };
    } catch (e) { return null; }
  }
  function alternarMic() {
    if (!stream) return false;
    micAberto = !micAberto;
    for (const t of stream.getAudioTracks()) t.enabled = micAberto;
    return micAberto;
  }

  function criar(id, iniciar) {
    const pc = new RTCPeerConnection({ iceServers: CONFIG.ICE });
    const p = { pc, audio: null, analisador: null, pendentes: [], vol: 0 };
    peers.set(id, p);
    if (stream) for (const t of stream.getAudioTracks()) pc.addTrack(t, stream);
    else pc.addTransceiver("audio", { direction: "recvonly" });
    pc.onicecandidate = (e) => { if (e.candidate) Sala.sinal(id, { tipo: "ice", candidato: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      const ms = e.streams[0] || new MediaStream([e.track]);
      if (!p.audio) { p.audio = new Audio(); p.audio.autoplay = true; p.audio.playsInline = true; document.body.appendChild(p.audio); p.audio.style.display = "none"; }
      p.audio.srcObject = ms; p.audio.volume = p.vol; p.audio.play().catch(() => {});
      p.analisador = medidor(ms);
    };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState)) fechar(id, false); };
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
      const v = regra(eu, o), p = peers.get(o.id);
      if (v > 0) {
        if (!p && meuId < o.id && !o._pedindo) criar(o.id, true);
        const q = peers.get(o.id);
        if (q) { q.vol = v; if (q.audio) q.audio.volume = Math.max(0, Math.min(1, v)); if (q.analisador && q.analisador() > 0.03) o.vozAtiva = agora; }
        o.ouvindo = !!q;
      } else {
        if (p) fechar(o.id, true);
        o.ouvindo = false;
      }
    }
    for (const id of [...peers.keys()]) if (!outros.some(o => o.id === id)) fechar(id, false);
  }
  function desligar() { for (const id of [...peers.keys()]) fechar(id, true); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; ligado = false; }
  return { ativar, alternarMic, aoSinal, atualizar, desligar, zona, get ligado() { return ligado; }, get temMic() { return !!stream; }, get micAberto() { return micAberto && !!stream; }, get conexoes() { return peers.size; } };
})();
