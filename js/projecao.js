/* Telão de projeção do auditório.
   – Item "projecao" (categoria Auditório no editor). Já vem montado na parede do palco de todo auditório.
   – Sala com palco (auditório): só quem está EM CIMA DO PALCO pode compartilhar a tela.
   – Sala sem palco (ex.: reunião com telão de projeção): quem estiver dentro e compartilhar primeiro.
   – Administrador ou dono da sala virtual pode encerrar a projeção de qualquer pessoa (Projecao.pararPorAdmin).
   – A tela compartilhada aparece no próprio item, no mapa, para quem está na sala.
   – Clicar no telão abre uma janela maior, com tela cheia. Dá para assistir de qualquer lugar pela janela.
   Transmissão por WebRTC (quem apresenta envia para cada pessoa que está assistindo); sinais pela Sala
   (Supabase Realtime) com canal "proj". Quem está apresentando avisa no estado de posição: proj = id da sala.

   Este arquivo também registra a arte do item (precisa ser carregado ANTES de js/mapa-core.js). */
(function registrarArte() {
  if (!window.ASSETS || ASSETS.projecao) return;
  const W = 192, H = 120, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const R = (x, y, w, h, cor) => { g.fillStyle = cor; g.fillRect(x, y, w, h); };
  // cabos de sustentação
  R(30, 0, 2, 6, "#3a3742"); R(160, 0, 2, 6, "#3a3742");
  // caixa do rolo (em cima)
  R(2, 4, 188, 9, "#2b2a33"); R(2, 4, 188, 2, "#4a4856"); R(2, 11, 188, 2, "#17161c"); R(4, 6, 6, 5, "#55535f"); R(182, 6, 6, 5, "#55535f");
  // tela branca com borda preta (padrão de telão de projeção)
  R(6, 13, 180, 103, "#17161c");
  R(8, 13, 176, 101, "#f4f2ee");
  R(8, 13, 176, 3, "#dcd8d0");
  // barra de peso embaixo + puxador
  R(4, 114, 184, 4, "#2b2a33"); R(4, 114, 184, 1, "#4a4856"); R(92, 118, 8, 2, "#55535f");
  ASSETS.projecao = { src: c.toDataURL(), w: W, h: H, label: "Telão de projeção", cat: "Auditório", pal: true };
})();

window.Projecao = (function () {
  const TELA = { x: 8, y: 16, w: 176, h: 98 }; // área da imagem dentro do item (px)
  let opt = null;               // { meuId, eu(), outros(), toast(), salvarEstado() }
  let itens = [], palco = new Set();
  // quem apresenta (eu)
  let share = null;             // { stream, sala, video, viewers: Map(id -> pc) }
  let foraDoPalcoDesde = 0;
  // quem assiste
  const vendo = new Map();      // sala -> { pc, stream, de, pedidoEm, video, audio, conectado }
  let popup = null;             // { sala, el, video }

  function iniciar(o) { opt = o; recalcular(); }
  function recalcular() {
    const todos = allItems();
    itens = todos.filter(i => i.k === "projecao");
    palco = new Set(todos.filter(i => i.k === "f_palco").map(i => Math.round(i.x) + "," + Math.round(i.y)));
  }
  const salaDoItem = it => (it.room && roomById(it.room)) || roomAt(it.x * T + 96, it.y * T + 110) || roomAt(it.x * T + 96, it.y * T + 140);
  const salasComTelao = () => new Set(itens.map(salaDoItem).filter(Boolean).map(r => r.id));
  // salas que têm piso de palco: nelas só quem está no palco apresenta
  const salasComPalco = () => { const s = new Set(); for (const k of palco) { const [x, y] = k.split(",").map(Number); const r = roomAt(x * T + 16, y * T + 16); if (r) s.add(r.id); } return s; };
  // sala com telão de projeção e sem palco onde a pessoa está: livre para quem compartilhar primeiro
  function salaLivre(a) {
    if (!a) return null;
    const r = roomAt(a.px, a.py - 4);
    return r && salasComTelao().has(r.id) && !salasComPalco().has(r.id) ? r : null;
  }
  function salaNoPalco(a) {
    if (!a) return null;
    const tx = Math.floor(a.px / T), ty = Math.floor((a.py - 2) / T);
    if (!palco.has(tx + "," + ty)) return null;
    const r = roomAt(a.px, a.py - 2);
    return r && salasComTelao().has(r.id) ? r : null;
  }
  // chave da transmissão: id da sala (telão do auditório) ou "mesa:<id da pessoa>" (tela do computador da mesa)
  const podePalestrar = (a, salaId) => !window.Acesso || Acesso.podePalestrar(a, salaId);
  const apresentador = chave => (String(chave).startsWith("mesa:")
    ? opt.outros().find(o => o.visto && o.id === chave.slice(5) && o.tela)
    : opt.outros().find(o => o.visto && o.proj === chave && podePalestrar(o, chave))) || null;
  const naMesa = a => !!(a && a.assento && a.assento.trabalho);
  /* recursos da sala só para quem está dentro dela */
  const salaDe = a => { const r = a && roomAt(a.px, a.py - 4); return r ? r.id : null; };
  // sala onde a transmissão acontece: a do telão, ou a sala onde está quem mostra a tela da mesa
  function salaDaChave(chave) {
    if (!String(chave).startsWith("mesa:")) return chave;
    const id = chave.slice(5), eu = opt.eu();
    if (eu && eu.id === id) return salaDe(eu);
    const o = opt.outros().find(o => o.id === id); return o ? salaDe(o) : null;
  }
  const podeVer = (a, chave) => { const s = salaDaChave(chave); return !!s && salaDe(a) === s; };
  const ice = () => (window.Voz && Voz.iceServers) || CONFIG.ICE || [];
  const podeCompartilhar = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

  /* ---------------- quem apresenta ---------------- */
  async function compartilhar() {
    const eu = opt.eu(), r = salaNoPalco(eu) || salaLivre(eu), mesa = !r && naMesa(eu);
    if (!r && !mesa) { opt.toast("Suba no palco do auditório, entre numa sala com telão de projeção, ou sente numa mesa de trabalho, para compartilhar a tela"); return; }
    if (r && !podePalestrar(eu, r.id)) { opt.toast(`🎤 Só ${Acesso.nomeDe(Acesso.palestranteDe(r.id))} pode apresentar neste auditório`); return; }
    const outro = r && apresentador(r.id);
    if (outro) { opt.toast(`${outro.nome} já está apresentando`); return; }
    if (!podeCompartilhar()) { opt.toast("Compartilhar tela só funciona no computador (Chrome, Edge, Firefox ou Safari)"); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        // só o som do que roda no computador: sem microfone e sem o áudio desta página (as vozes da chamada), para não dar eco
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false, restrictOwnAudio: true },
        systemAudio: "include", selfBrowserSurface: "exclude", surfaceSwitching: "include", monitorTypeSurfaces: "include",
      });
      // garante que nenhuma faixa de microfone entre na transmissão
      for (const t of stream.getAudioTracks()) if (/microfone|microphone|mic\b/i.test(t.label || "")) { stream.removeTrack(t); t.stop(); }
    }
    catch (e) { if (e && e.name !== "NotAllowedError") opt.toast("Não foi possível compartilhar a tela"); return; }
    const v = stream.getVideoTracks()[0];
    if (v && "contentHint" in v) v.contentHint = "detail";
    v.addEventListener("ended", () => parar(true));
    const chave = r ? r.id : "mesa:" + eu.id;
    share = { stream, sala: chave, tipo: r ? (salasComPalco().has(r.id) ? "palco" : "livre") : "mesa", nomeSala: r ? r.name : "mesa", video: videoOculto(stream, true), viewers: new Map() };
    foraDoPalcoDesde = 0;
    if (r) { opt.toast("Você está apresentando no telão 🎬"); opt.registrar && opt.registrar(`Começou a apresentar no telão de ${r.name}`, r.name); }
    else { opt.toast("Sua tela está aberta: quem chegar perto e clicar no seu computador consegue ver 🖥️"); opt.registrar && opt.registrar("Abriu a tela do computador para os colegas", eu.sala); }
  }
  function parar(avisar) {
    if (!share) return;
    for (const [id, pc] of share.viewers) { try { pc.close(); } catch (e) {} Sala.sinal(id, { canal: "proj", tipo: "fim", sala: share.sala }); }
    share.stream.getTracks().forEach(t => t.stop());
    share.video.remove();
    if (popup && popup.sala === share.sala) atualizarPopup();
    share = null;
    if (avisar) opt.toast("Apresentação encerrada");
  }
  async function aoPedido(msg) { // alguém quer assistir
    if (!share || msg.sala !== share.sala) { Sala.sinal(msg.from, { canal: "proj", tipo: "fim", sala: msg.sala }); return; }
    const quem = opt.outros().find(o => o.id === msg.from);
    if (!quem || !podeVer(quem, share.sala)) { Sala.sinal(msg.from, { canal: "proj", tipo: "fim", sala: msg.sala }); return; }
    const velho = share.viewers.get(msg.from); if (velho) { try { velho.close(); } catch (e) {} }
    const pc = new RTCPeerConnection({ iceServers: ice() });
    share.viewers.set(msg.from, pc);
    for (const t of share.stream.getTracks()) pc.addTrack(t, share.stream);
    pc.onicecandidate = e => { if (e.candidate) Sala.sinal(msg.from, { canal: "proj", tipo: "ice", sala: share.sala, candidato: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState) && share && share.viewers.get(msg.from) === pc) share.viewers.delete(msg.from); };
    try {
      const s = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (s) { const p = s.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = 2500000; await s.setParameters(p).catch(() => {}); }
      const oferta = await pc.createOffer(); await pc.setLocalDescription(oferta);
      Sala.sinal(msg.from, { canal: "proj", tipo: "oferta", sala: share.sala, sdp: pc.localDescription.toJSON() });
    } catch (e) { console.warn("projeção:", e); }
  }

  /* ---------------- quem assiste ---------------- */
  function pedir(sala, de) {
    let v = vendo.get(sala);
    if (!v) { v = { pc: null, stream: null, de, pedidoEm: 0, tentativas: 0, video: null, audio: null, pendentes: [] }; vendo.set(sala, v); }
    v.de = de; v.pedidoEm = performance.now(); v.tentativas++;
    Sala.sinal(de, { canal: "proj", tipo: "quero", sala });
  }
  function largar(sala, avisar = true) {
    const v = vendo.get(sala); if (!v) return;
    vendo.delete(sala);
    if (v.pc) try { v.pc.close(); } catch (e) {}
    if (v.video) v.video.remove(); if (v.audio) { v.audio.srcObject = null; v.audio.remove(); }
    if (avisar && v.de) Sala.sinal(v.de, { canal: "proj", tipo: "tchau", sala });
    if (popup && popup.sala === sala) atualizarPopup();
  }
  async function aoOferta(msg) {
    const v = vendo.get(msg.sala); if (!v || v.de !== msg.from) return;
    if (v.pc) try { v.pc.close(); } catch (e) {}
    const pc = new RTCPeerConnection({ iceServers: ice() }); v.pc = pc; v.pendentes = [];
    pc.onicecandidate = e => { if (e.candidate) Sala.sinal(msg.from, { canal: "proj", tipo: "ice", sala: msg.sala, candidato: e.candidate.toJSON() }); };
    pc.ontrack = e => {
      const ms = e.streams[0] || new MediaStream([e.track]);
      v.stream = ms;
      if (!v.video) v.video = videoOculto(ms, true); else v.video.srcObject = ms;
      if (ms.getAudioTracks().length) { // áudio da apresentação (vídeo com som, por exemplo)
        if (!v.audio) { v.audio = new Audio(); v.audio.autoplay = true; v.audio.style.display = "none"; document.body.appendChild(v.audio); }
        v.audio.srcObject = ms; v.audio.play().catch(() => {});
      }
      if (popup && popup.sala === msg.sala) atualizarPopup();
    };
    pc.onconnectionstatechange = () => { v.conectado = pc.connectionState === "connected"; if (pc.connectionState === "failed") { v.stream = null; v.pedidoEm = 0; } };
    try {
      await pc.setRemoteDescription(msg.sdp);
      for (const c of v.pendentes) await pc.addIceCandidate(c).catch(() => {}); v.pendentes = [];
      const resp = await pc.createAnswer(); await pc.setLocalDescription(resp);
      Sala.sinal(msg.from, { canal: "proj", tipo: "resposta", sala: msg.sala, sdp: pc.localDescription.toJSON() });
    } catch (e) { console.warn("projeção:", e); }
  }

  /* ---------------- sinais ---------------- */
  async function aoSinal(msg) {
    try {
      if (msg.tipo === "quero") return aoPedido(msg);
      if (msg.tipo === "oferta") return aoOferta(msg);
      if (msg.tipo === "resposta") {
        const pc = share && share.viewers.get(msg.from); if (!pc) return;
        await pc.setRemoteDescription(msg.sdp);
        for (const c of pc._pendentes || []) await pc.addIceCandidate(c).catch(() => {}); pc._pendentes = []; // endereços que chegaram antes da resposta
        return;
      }
      if (msg.tipo === "ice") {
        const pcShare = share && share.viewers.get(msg.from);
        // quem apresenta: o endereço de quem assiste pode chegar antes da resposta ser aplicada; guarda e aplica depois (antes se perdia e a tela ficava carregando)
        if (pcShare) { if (pcShare.remoteDescription) await pcShare.addIceCandidate(msg.candidato).catch(() => {}); else (pcShare._pendentes = pcShare._pendentes || []).push(msg.candidato); return; }
        const v = vendo.get(msg.sala);
        if (v && v.pc) { if (v.pc.remoteDescription) await v.pc.addIceCandidate(msg.candidato).catch(() => {}); else v.pendentes.push(msg.candidato); }
        return;
      }
      if (msg.tipo === "tchau") { const pc = share && share.viewers.get(msg.from); if (pc) { try { pc.close(); } catch (e) {} share.viewers.delete(msg.from); } return; }
      if (msg.tipo === "fim") { const v = vendo.get(msg.sala); if (v && v.de === msg.from) largar(msg.sala, false); }
    } catch (e) { console.warn("projeção:", e); }
  }

  /* ---------------- a cada quadro ---------------- */
  function atualizar(agora) {
    if (!opt) return;
    const eu = opt.eu();
    // quem apresenta precisa continuar no palco (2 s de tolerância)
    if (share) {
      const r = share.tipo === "livre" ? salaLivre(eu) : salaNoPalco(eu);
      const ok = share.tipo === "mesa" ? naMesa(eu) : (r && r.id === share.sala);
      if (ok) foraDoPalcoDesde = 0;
      else if (!foraDoPalcoDesde) foraDoPalcoDesde = agora;
      else if (agora - foraDoPalcoDesde > 2000) { const m = share.tipo; parar(false); opt.toast(m === "mesa" ? "Você levantou da mesa: sua tela foi fechada" : m === "livre" ? "Você saiu da sala: a projeção foi encerrada" : "Você saiu do palco: a apresentação foi encerrada"); }
    }
    // quem saiu da sala deixa de receber a transmissão
    if (share) for (const [id, pc] of [...share.viewers]) {
      const o = opt.outros().find(o => o.id === id);
      if (!o || !podeVer(o, share.sala)) { try { pc.close(); } catch (e) {} share.viewers.delete(id); Sala.sinal(id, { canal: "proj", tipo: "fim", sala: share.sala }); }
    }
    // a janela fecha se eu sair da sala
    if (popup && !podeVer(eu, popup.sala)) { const m = String(popup.sala).startsWith("mesa:"); fecharPopup(); opt.toast(m ? "Você saiu da sala: a tela do colega foi fechada" : "Você saiu da sala: a projeção foi fechada"); }
    // assistir: só quem está na sala do telão
    const minhaSala = roomAt(eu.px, eu.py - 4);
    const queroVer = new Map();
    for (const salaId of salasComTelao()) {
      const ap = apresentador(salaId); if (!ap) continue;
      if ((minhaSala && minhaSala.id === salaId) || (popup && popup.sala === salaId)) queroVer.set(salaId, ap.id);
    }
    // tela de um colega na mesa: só enquanto a janela estiver aberta
    if (popup && String(popup.sala).startsWith("mesa:")) { const ap = apresentador(popup.sala); if (ap) queroVer.set(popup.sala, ap.id); }
    for (const [sala, de] of queroVer) {
      const v = vendo.get(sala);
      if (!v || v.de !== de) { if (v) largar(sala); pedir(sala, de); continue; }
      const espera = Math.min(20000, 6000 * v.tentativas);
      if (!v.conectado && agora - v.pedidoEm > espera) pedir(sala, de); // não respondeu: pede de novo
      // conectado mas sem imagem: o navegador pode ter pausado o vídeo escondido; dá play de novo
      if (v.video && v.stream && (v.video.paused || v.video.readyState < 2) && agora - (v.tocouEm || 0) > 1500) { v.tocouEm = agora; v.video.play().catch(() => {}); }
      // conectado há 12 s e nenhuma imagem: refaz a conexão do zero
      if (v.conectado && v.video && v.video.readyState < 2 && agora - v.pedidoEm > 12000) { largar(sala); pedir(sala, de); }
    }
    for (const sala of [...vendo.keys()]) if (!queroVer.has(sala)) largar(sala);
    atualizarBotao(eu);
    if (popup) atualizarPopupStatus();
  }

  /* ---------------- botão de apresentar ---------------- */
  function atualizarBotao(eu) {
    const b = document.getElementById("btnProj"); if (!b) return;
    const r = salaNoPalco(eu) || salaLivre(eu);
    let mostra = false, txt = "", ativo = true;
    if (share) { mostra = true; txt = share.tipo === "mesa" ? `⏹ Fechar minha tela${share.viewers.size ? ` (${share.viewers.size} vendo)` : ""}` : `⏹ Parar de compartilhar${share.viewers.size ? ` (${share.viewers.size} vendo)` : ""}`; }
    else if (!r && naMesa(eu)) { mostra = true; txt = podeCompartilhar() ? "🖥️ Deixar colegas verem minha tela" : "🖥️ Mostrar tela (só no computador)"; }
    else if (r && !podePalestrar(eu, r.id)) { mostra = true; txt = `🎤 Palestrante: ${Acesso.nomeDe(Acesso.palestranteDe(r.id))}`; ativo = false; }
    else if (r) {
      mostra = true;
      const ap = apresentador(r.id);
      if (ap) { txt = `🎬 ${ap.nome} está apresentando`; ativo = false; }
      else txt = podeCompartilhar() ? "🖥️ Compartilhar minha tela no telão" : "🖥️ Compartilhar tela (só no computador)";
    }
    const d = mostra ? "flex" : "none"; if (b.style.display !== d) b.style.display = d;
    // ícone Lucide no lugar do emoji do começo do texto
    const ic = /^⏹/.test(txt) ? "x" : /^🎤/.test(txt) ? "mic" : /^🎬/.test(txt) ? "presentation" : "monitor";
    const limpo = txt.replace(/^(⏹|🖥️|🎤|🎬)\s*/u, "");
    if (window.ROTULO) ROTULO(b, ic === "x" ? "presentation" : ic, limpo); else if (b.textContent !== txt) b.textContent = txt;
    b.disabled = !ativo; b.classList.toggle("parar", !!share);
  }
  function clicarBotao() { if (share) parar(true); else compartilhar(); }

  /* ---------------- desenho no mapa ---------------- */
  function streamDaSala(sala) {
    if (share && share.sala === sala) return share.video;
    const v = vendo.get(sala); return v && v.stream ? v.video : null;
  }
  function desenhar(g, it, t) {
    const r = salaDoItem(it), sala = r && r.id;
    const x = Math.round(it.x * T) + TELA.x, y = Math.round(it.y * T) + TELA.y, w = TELA.w, h = TELA.h;
    const vid = sala && streamDaSala(sala);
    const ap = sala && (share && share.sala === sala ? { nome: "Você" } : apresentador(sala));
    if (vid && vid.readyState >= 2 && vid.videoWidth) {
      g.fillStyle = "#000"; g.fillRect(x, y, w, h);
      const k = Math.min(w / vid.videoWidth, h / vid.videoHeight), dw = vid.videoWidth * k, dh = vid.videoHeight * k;
      g.save(); g.imageSmoothingEnabled = true; g.drawImage(vid, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); g.restore();
      etiqueta(g, x + 3, y + 3, "● AO VIVO" + (ap ? " · " + ap.nome : ""), "#e5484d");
      return;
    }
    g.save(); g.textAlign = "center"; g.textBaseline = "middle";
    if (ap && !(sala && podeVer(opt.eu(), sala))) {
      g.fillStyle = "#1d1b26"; g.fillRect(x, y, w, h);
      g.fillStyle = "#fff"; g.font = "bold 9px system-ui,sans-serif"; g.fillText("🔒 Apresentação em andamento", x + w / 2, y + h / 2 - 8);
      g.fillStyle = "#b9b4c8"; g.font = "7px system-ui,sans-serif"; g.fillText("Só para quem está na sala", x + w / 2, y + h / 2 + 8);
    } else if (ap) {
      g.fillStyle = "#1d1b26"; g.fillRect(x, y, w, h);
      g.fillStyle = "#fff"; g.font = "bold 9px system-ui,sans-serif"; g.fillText(`🎬 ${ap.nome} está apresentando`, x + w / 2, y + h / 2 - 8);
      g.fillStyle = "#b9b4c8"; g.font = "7px system-ui,sans-serif";
      const v = vendo.get(sala), est = !v ? "Clique para assistir" : !v.conectado ? (v.tentativas > 2 ? "Sem conexão com quem apresenta · tentando de novo" : "Conectando à apresentação…") : "Recebendo a imagem…";
      g.fillText(est, x + w / 2, y + h / 2 + 8);
      etiqueta(g, x + 3, y + 3, "● AO VIVO", "#e5484d");
    } else {
      g.fillStyle = "rgba(61,90,254,.08)"; g.fillRect(x, y, w, h);
      g.fillStyle = "#8a8578"; g.font = "bold 8px system-ui,sans-serif"; g.fillText("TELÃO DE PROJEÇÃO", x + w / 2, y + h / 2 - 6);
      g.font = "7px system-ui,sans-serif"; g.fillText(r && !salasComPalco().has(r.id) ? "Livre: quem entrar pode compartilhar a tela" : "Suba no palco para compartilhar sua tela", x + w / 2, y + h / 2 + 7);
    }
    g.restore();
  }
  function etiqueta(g, x, y, txt, cor) {
    g.save(); g.font = "bold 6px system-ui,sans-serif"; const w = g.measureText(txt).width + 6;
    g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x, y, w, 9); g.fillStyle = cor; g.textBaseline = "middle"; g.fillText(txt, x + 3, y + 5); g.restore();
  }
  /* clique no mapa (coordenadas do mundo) */
  function clicou(wx, wy) {
    for (const it of itens) {
      if (wx >= it.x * T && wx <= it.x * T + 192 && wy >= it.y * T && wy <= it.y * T + 120) {
        const r = salaDoItem(it);
        if (r && !podeVer(opt.eu(), r.id)) { opt.toast(`🔒 Entre em ${r.name} para ver o telão`); return true; }
        abrirPopup(r ? r.id : null, r ? r.name : "Auditório"); return true;
      }
    }
    return false;
  }
  const desenhaveis = () => itens.map(it => ({ sort: (it.room && roomById(it.room) ? roomById(it.room).y * T : it.y * T) + 0.6, draw: g => desenhar(g, it, performance.now() / 1000) }));

  /* ---------------- janela (popup) ---------------- */
  /* tela do computador de um colega (ele precisa estar perto) */
  function abrirTelaDe(pessoa) {
    if (!podeVer(opt.eu(), "mesa:" + pessoa.id)) { opt.toast(`🔒 Entre na sala de ${pessoa.nome} para ver a tela`); return; }
    abrirPopup("mesa:" + pessoa.id, "Tela de " + pessoa.nome, true);
  }
  function abrirPopup(sala, nome, mesa) {
    fecharPopup();
    const el = document.createElement("div");
    el.className = "proj-bg";
    el.innerHTML = `<div class="proj-win" role="dialog" aria-label="Telão de projeção">
      <div class="proj-top"><b>${mesa ? "🖥️ " + esc(nome) : "🎬 Telão · " + esc(nome || "Auditório")}</b><span class="proj-status"></span>
        <button class="proj-btn" data-som title="Som da apresentação">🔊</button>
        <button class="proj-btn" data-cheia title="Tela cheia">⛶ Tela cheia</button>
        <button class="proj-btn" data-fechar aria-label="Fechar">✕</button></div>
      <div class="proj-palco"><video playsinline autoplay muted></video><div class="proj-vazio"></div></div>
    </div>`;
    document.body.appendChild(el);
    popup = { sala, el, video: el.querySelector("video"), comSom: true };
    el.addEventListener("click", e => {
      if (e.target === el || e.target.closest("[data-fechar]")) fecharPopup();
      else if (e.target.closest("[data-cheia]")) telaCheia();
      else if (e.target.closest("[data-som]")) { popup.comSom = !popup.comSom; atualizarPopup(); }
    });
    popup.video.addEventListener("dblclick", telaCheia);
    addEventListener("keydown", escFechar);
    atualizarPopup();
  }
  function escFechar(e) { if (e.key === "Escape" && popup && !document.fullscreenElement) fecharPopup(); }
  function fecharPopup() {
    if (!popup) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    popup.video.srcObject = null; popup.el.remove(); popup = null;
    removeEventListener("keydown", escFechar);
    // de volta ao áudio da sala, se estiver lá
    for (const v of vendo.values()) if (v.audio) v.audio.muted = false;
  }
  function telaCheia() {
    if (!popup) return;
    const alvo = popup.el.querySelector(".proj-palco"), v = popup.video;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (alvo.requestFullscreen) alvo.requestFullscreen().catch(() => v.webkitEnterFullscreen && v.webkitEnterFullscreen());
    else if (alvo.webkitRequestFullscreen) alvo.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iPhone
  }
  function atualizarPopup() {
    if (!popup) return;
    const meu = share && share.sala === popup.sala;
    const v = vendo.get(popup.sala);
    const ms = meu ? share.stream : v && v.stream;
    if (popup.video.srcObject !== (ms || null)) popup.video.srcObject = ms || null;
    // som: quem apresenta não ouve o próprio som; quem assiste ouve pelo vídeo da janela (e silencia o da sala para não dobrar)
    const temAudio = !!(ms && ms.getAudioTracks().length) && !meu;
    popup.video.muted = !temAudio || !popup.comSom;
    if (v && v.audio) v.audio.muted = true;
    if (ms) { const pv = popup.video; pv.play().catch(() => { pv.muted = true; pv.play().catch(() => {}); }); }
    const b = popup.el.querySelector("[data-som]"); b.style.display = temAudio ? "" : "none"; b.textContent = popup.comSom ? "🔊" : "🔇";
    atualizarPopupStatus();
  }
  function atualizarPopupStatus() {
    if (!popup) return;
    const meu = share && share.sala === popup.sala, ap = meu ? null : popup.sala && apresentador(popup.sala);
    const v = vendo.get(popup.sala), tem = meu || (v && v.stream);
    const st = meu ? "● Você está apresentando" : ap ? (tem ? `● Ao vivo · ${ap.nome}` : `Conectando à tela de ${ap.nome}…`) : "";
    const s = popup.el.querySelector(".proj-status"); if (s.textContent !== st) s.textContent = st;
    const vazio = popup.el.querySelector(".proj-vazio");
    const mesa = String(popup.sala).startsWith("mesa:");
    const msg = tem ? "" : ap ? "Conectando…" : mesa ? "Essa pessoa fechou a tela." : "Ninguém está apresentando agora.<br><small>" + (popup.sala && !salasComPalco().has(popup.sala) ? "Quem estiver na sala pode compartilhar a tela." : "Quem subir no palco pode compartilhar a tela.") + "</small>";
    if (vazio.innerHTML !== msg) vazio.innerHTML = msg;
    vazio.style.display = tem ? "none" : "grid";
    if (tem && popup.video.srcObject !== (meu ? share.stream : v.stream)) atualizarPopup();
  }

  /* ---------------- utilitários ---------------- */
  function videoOculto(ms, mudo) {
    const v = document.createElement("video");
    v.muted = mudo; v.playsInline = true; v.autoplay = true; v.srcObject = ms;
    // fica dentro da tela (1 px quase transparente): vídeo fora da tela pode ser pausado pelo navegador e a imagem não chega
    v.style.cssText = "position:fixed;width:1px;height:1px;opacity:.01;pointer-events:none;left:0;bottom:0;z-index:-1";
    document.body.appendChild(v); v.play().catch(() => {});
    return v;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  // diagnóstico no console: Projecao.diagnostico()
  function diagnostico() { return [...vendo.entries()].map(([sala, v]) => ({ sala, de: v.de, conectado: v.conectado, tentativas: v.tentativas, estado: v.pc && v.pc.connectionState, ice: v.pc && v.pc.iceConnectionState, temStream: !!v.stream, videoPronto: v.video && v.video.readyState, pausado: v.video && v.video.paused })); }
  return { diagnostico,
    iniciar, recalcular, aoSinal, atualizar, desenhaveis, clicou, clicarBotao, abrirPopup, fecharPopup, parar,
    get minhaSala() { return share && (share.tipo === "palco" || share.tipo === "livre") ? share.sala : null; },
    // um administrador mandou encerrar minha projeção (telão ou tela da mesa)
    pararPorAdmin(quem) { if (!share) return false; parar(false); opt.toast(`⛔ ${quem || "O administrador"} encerrou sua projeção`); return true; },
    get minhaTela() { return !!(share && share.tipo === "mesa"); },
    abrirTelaDe, salaNoPalco,
    get apresentando() { return !!share; },
    get estado() { return { apresentando: share && share.sala, assistindo: [...vendo.entries()].map(([s, v]) => ({ sala: s, de: v.de, video: !!v.stream, conectado: !!v.conectado })), salas: [...salasComTelao()], popup: popup && popup.sala }; },
  };
})();
