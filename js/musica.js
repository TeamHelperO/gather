/* =====================================================================
   MÚSICA AMBIENTE
   – Cada sala pode ter uma música do YouTube (o administrador cola o link).
     Toca para quem está DENTRO da sala, todos no mesmo ponto da música,
     pelo player oficial do YouTube. O cartão pode ficar recolhido (só o nome
     e o volume) e a música continua tocando. Ninguém pausa só para si: quem
     não quiser ouvir baixa o próprio volume (ou pede ao administrador).
   – No corredor toca uma música de elevador baixinha, composta aqui mesmo
     (Web Audio, sem direitos autorais): acordes de bossa, baixo e vibrafone.
   – Volume: o da sala (definido pelo administrador) × o seu. Quando alguém
     perto fala, a música abaixa sozinha.
   ===================================================================== */
window.Musica = (function () {
  let o = null, card = null, player = null, ytCarregando = false, ytPronto = false;
  let salaId = null, videoAtual = null, recolhido = true, duck = 1, ultimaAssinatura = null;
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  recolhido = ls.get("andar_musica_recolhido", true);
  let meuVol = ls.get("andar_musica_vol", 70), meuElev = ls.get("andar_elevador_vol", 60), elevMudo = ls.get("andar_elevador_mudo", false);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------- link do YouTube -> id do vídeo ---------- */
  function idDoLink(txt) {
    const s = String(txt || "").trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    let u; try { u = new URL(s.startsWith("http") ? s : "https://" + s); } catch (e) { return null; }
    const h = u.hostname.replace(/^(www|m|music)\./, "");
    if (h === "youtu.be") return (u.pathname.slice(1).match(/^[\w-]{11}/) || [])[0] || null;
    if (h === "youtube.com" || h === "youtube-nocookie.com") {
      if (u.searchParams.get("v")) return (u.searchParams.get("v").match(/^[\w-]{11}/) || [])[0] || null;
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); return m ? m[1] : null;
    }
    return null;
  }

  /* ---------- player do YouTube (API oficial de iframe) ---------- */
  function carregarYT() {
    if (ytPronto || ytCarregando) return; ytCarregando = true;
    const antes = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { ytPronto = true; if (antes) antes(); tique(); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
    s.onerror = () => { ytCarregando = false; };
    document.head.appendChild(s);
  }
  function tocar(mus) {
    if (!ytPronto) { carregarYT(); return; }
    const inicio = Math.max(0, (Date.now() - (mus.desde || Date.now())) / 1000);
    if (!player) {
      player = new YT.Player("musPlayer", {
        width: 200, height: 200, videoId: mus.yt,
        playerVars: { autoplay: 1, controls: 1, rel: 0, playsinline: 1, modestbranding: 1, start: 0 },
        events: {
          onReady: () => { sincronizar(mus); aplicarVolume(); player.playVideo(); atualizarTitulo(); },
          onStateChange: e => { if (e.data === 0) { player.seekTo(0, true); player.playVideo(); } if (e.data === 1) atualizarTitulo(); },
          onError: () => { const t = card && card.querySelector("[data-titulo]"); if (t) t.textContent = "Este vídeo não pode tocar fora do YouTube"; },
        },
      });
    } else {
      player.loadVideoById({ videoId: mus.yt, startSeconds: inicio });
      setTimeout(() => sincronizar(mus), 1500);
    }
  }
  // todos ouvem o mesmo trecho: posição = tempo desde que a música foi posta, dando a volta no fim
  function sincronizar(mus) {
    if (!player || !player.getDuration) return;
    const dur = player.getDuration() || 0, desde = (Date.now() - (mus.desde || Date.now())) / 1000;
    if (dur > 5) player.seekTo(desde % dur, true);
  }
  function atualizarTitulo() {
    const t = card && card.querySelector("[data-titulo]"); if (!t || !player || !player.getVideoData) return;
    const d = player.getVideoData(); if (d && d.title) { t.textContent = d.title; const t2 = card.querySelector("[data-titulo2]"); if (t2) t2.textContent = d.title; }
  }
  function parar() { if (player && player.stopVideo) player.stopVideo(); videoAtual = null; }
  function aplicarVolume() {
    const sala = salaObj(); const vs = sala && sala.musica ? (sala.musica.volume ?? 50) : 50;
    if (player && player.setVolume) player.setVolume(Math.round(vs / 100 * meuVol * duck));
    Elevador.volume(elevMudo ? 0 : (meuElev / 100) * duck);
  }

  /* ---------- música de elevador (gerada aqui) ---------- */
  const Elevador = (function () {
    let ctx = null, mestre = null, ligado = false, timer = null, prox = 0, compasso = 0, alvo = 0.6;
    const BPM = 88, SEM = 60 / BPM;
    const nota = n => 440 * Math.pow(2, (n - 69) / 12);
    // ii–V–I em Dó e em Fá, com acordes de quatro notas (voicings próximos)
    const PROG = [[50, [62, 65, 69, 72]], [55, [59, 62, 65, 69]], [48, [59, 64, 67, 71]], [45, [60, 64, 67, 71]],
                  [43, [60, 65, 69, 72]], [48, [58, 64, 67, 70]], [53, [60, 64, 69, 72]], [52, [62, 64, 67, 71]]];
    function iniciarCtx() {
      if (ctx) return true;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
      mestre = ctx.createGain(); mestre.gain.value = 0; mestre.connect(lp); lp.connect(ctx.destination);
      return true;
    }
    function tom(t, freq, dur, vol, tipo = "sine", ataque = 0.01) {
      const g = ctx.createGain(), os = ctx.createOscillator(); os.type = tipo; os.frequency.value = freq;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      os.connect(g); g.connect(mestre); os.start(t); os.stop(t + dur + 0.05);
    }
    function piano(t, n, dur, vol) { tom(t, nota(n), dur, vol); tom(t, nota(n) * 2, dur * 0.4, vol * 0.18); } // piano elétrico simples
    function chimbal(t, vol) {
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = "highpass"; hp.frequency.value = 7000; g.gain.value = vol;
      s.buffer = b; s.connect(hp); hp.connect(g); g.connect(mestre); s.start(t);
    }
    function agendarCompasso(t) {
      const [baixo, acorde] = PROG[compasso % PROG.length]; compasso++;
      // bossa: acorde em 1, no "e" do 2 e no 4; baixo na tônica e na quinta
      for (const [b, dur] of [[0, 1.2], [1.5, 0.9], [3, 1.1]]) for (const n of acorde) piano(t + b * SEM, n, dur, 0.045);
      tom(t, nota(baixo), SEM * 1.6, 0.16, "triangle"); tom(t + 2 * SEM, nota(baixo + 7), SEM * 1.4, 0.13, "triangle");
      for (let i = 0; i < 8; i++) chimbal(t + i * SEM / 2, i % 2 ? 0.025 : 0.04);
      // vibrafone: frase curta com notas do acorde, de vez em quando
      if (Math.random() < 0.7) for (let i = 0; i < 3; i++) if (Math.random() < 0.75) { const n = acorde[(Math.random() * acorde.length) | 0] + 12; tom(t + (0.5 + i * 1.1) * SEM, nota(n), 1.6, 0.05); tom(t + (0.5 + i * 1.1) * SEM, nota(n) * 4, 0.3, 0.012); }
    }
    function agendar() { while (prox < ctx.currentTime + 0.8) { agendarCompasso(prox); prox += 4 * SEM; } }
    return {
      ligar() {
        if (ligado || !iniciarCtx()) return; ligado = true;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        prox = ctx.currentTime + 0.1; agendar(); timer = setInterval(agendar, 250);
        mestre.gain.setTargetAtTime(alvo * 0.35, ctx.currentTime, 0.8);
      },
      desligar() {
        if (!ligado) return; ligado = false; clearInterval(timer); timer = null;
        mestre.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      },
      volume(v) { alvo = v; if (ctx && ligado) mestre.gain.setTargetAtTime(v * 0.35, ctx.currentTime, 0.3); },
      destravar() { if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {}); },
      get ligado() { return ligado; },
    };
  })();

  /* ---------- cartão na tela ---------- */
  const salaObj = () => { const r = o && o.sala(); return r || null; };
  function criarCard() {
    card = document.createElement("div"); card.id = "musCard"; card.className = "pill hud mus-card"; card.hidden = true;
    document.body.appendChild(card);
    card.addEventListener("click", clique); card.addEventListener("input", mexeu);
  }
  function soltarPlayer() { if (player) { try { player.destroy(); } catch (e) {} player = null; } videoAtual = null; }
  // fica logo abaixo das pílulas do canto de cima (sala, teste grátis), sem cobrir nenhuma
  function posicionar() {
    if (!card || innerWidth <= 760) return;
    let y = 56; for (const sel of ["#sala", "#assPill"]) { const el = document.querySelector(sel); if (el && el.offsetParent) { const b = el.getBoundingClientRect(); if (b.left < 400) y = Math.max(y, b.bottom); } }
    card.style.top = (y + 8) + "px";
  }
  function render() {
    const r = salaObj(), mus = r && r.musica, admin = o.souAdmin();
    if (!(r && r.type !== "corredor" && mus && mus.yt)) soltarPlayer(); // sem música aqui: o player sai junto
    if (r && r.type === "corredor") {
      const ligadoNoEspaco = o.mapa().musicaCorredor !== false;
      if (!ligadoNoEspaco && !admin) { card.hidden = true; return; }
      card.hidden = false; card.className = "pill hud mus-card mini";
      card.innerHTML = `<span class="mus-ic">🎶</span><b>${ligadoNoEspaco ? "Música de corredor" : "Música de corredor desligada"}</b>
        ${ligadoNoEspaco ? `<input type="range" min="0" max="100" value="${elevMudo ? 0 : meuElev}" data-elev aria-label="Volume da música do corredor">` : ""}
        ${admin ? `<button data-corredor title="Ligar ou desligar para todo o espaço">${ligadoNoEspaco ? "Desligar para todos" : "Ligar"}</button>` : ""}`;
      return;
    }
    if (!r || !mus || !mus.yt) {
      if (r && admin && r.type !== "silenciosa") { card.hidden = false; card.className = "pill hud mus-card mini"; card.innerHTML = `<button data-por>🎵 Pôr música nesta sala</button>`; }
      else card.hidden = true;
      return;
    }
    card.hidden = false;
    // recolhido: o player continua na página (só sai da tela), então a música não para
    card.className = "pill hud mus-card" + (recolhido ? " recolhido" : "");
    if (!card.querySelector("#musPlayer")) {
      card.innerHTML = `<div class="mus-player"><div id="musPlayer"></div></div>
        <div class="mus-lado"><div class="mus-top"><span>🎵 Música da sala</span><button data-min title="Recolher (a música continua)" aria-label="Recolher">–</button></div>
        <b data-titulo>Carregando…</b>
        <div class="mus-curto"><span class="mus-ic">🎵</span><b data-titulo2>Carregando…</b><input type="range" min="0" max="100" value="${meuVol}" data-meu aria-label="Meu volume da música"><button data-abrir title="Mostrar o player" aria-label="Mostrar o player">▾</button></div>
        <label class="mus-vol">Meu volume<input type="range" min="0" max="100" value="${meuVol}" data-meu aria-label="Meu volume da música"></label>
        ${admin ? `<label class="mus-vol">Volume da sala<input type="range" min="0" max="100" value="${mus.volume ?? 50}" data-sala aria-label="Volume da música para todos da sala"></label>
        <div class="mus-bts"><button data-por>Trocar</button><button data-tirar>Tirar</button></div>` : ""}</div>`;
      soltarPlayer();
    }
  }
  function clique(e) {
    const b = e.target.closest("button"); if (!b) return;
    Elevador.destravar();
    if (b.dataset.min !== undefined) { recolhido = true; ls.set("andar_musica_recolhido", true); card.classList.add("recolhido"); posicionar(); }
    else if (b.dataset.abrir !== undefined) { recolhido = false; ls.set("andar_musica_recolhido", false); card.classList.remove("recolhido"); posicionar(); }
    else if (b.dataset.por !== undefined) pedirLink();
    else if (b.dataset.tirar !== undefined) { const r = salaObj(); if (r) { delete r.musica; o.salvar(); render(); o.toast("Música tirada da sala"); } }
    else if (b.dataset.corredor !== undefined) { const m = o.mapa(); m.musicaCorredor = m.musicaCorredor === false; o.salvar(); render(); tique(); }
  }
  let salvarVolT = null;
  function mexeu(e) {
    const el = e.target;
    if (el.dataset.meu !== undefined) { meuVol = +el.value; ls.set("andar_musica_vol", meuVol); card.querySelectorAll("[data-meu]").forEach(x => { if (x !== el) x.value = meuVol; }); aplicarVolume(); }
    if (el.dataset.elev !== undefined) { meuElev = +el.value; elevMudo = meuElev === 0; ls.set("andar_elevador_vol", meuElev); ls.set("andar_elevador_mudo", elevMudo); aplicarVolume(); }
    if (el.dataset.sala !== undefined) { const r = salaObj(); if (r && r.musica) { r.musica.volume = +el.value; aplicarVolume(); clearTimeout(salvarVolT); salvarVolT = setTimeout(() => o.salvar(), 600); } }
  }
  function pedirLink() {
    const r = salaObj(); if (!r) return;
    const fundo = document.createElement("div"); fundo.className = "mus-modal";
    fundo.innerHTML = `<form class="mus-caixa"><h3>Música da sala “${esc(r.name)}”</h3>
      <p>Cole o link de um vídeo do YouTube. Ele toca para todos que estiverem dentro da sala, no mesmo trecho, e recomeça quando acaba. Cada pessoa só pode baixar o próprio volume.</p>
      <input name="link" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" required>
      <small data-erro></small>
      <div class="mus-bts"><button type="button" data-cancelar>Cancelar</button><button type="submit" class="pri">Tocar na sala</button></div></form>`;
    document.body.appendChild(fundo);
    const f = fundo.querySelector("form"), inp = f.link; inp.focus();
    inp.oninput = () => f.querySelector("[data-erro]").textContent = "";
    fundo.onclick = e => { if (e.target === fundo || e.target.dataset.cancelar !== undefined) fundo.remove(); };
    f.onsubmit = e => {
      e.preventDefault(); const id = idDoLink(inp.value);
      if (!id) { f.querySelector("[data-erro]").textContent = "Esse não parece um link de vídeo do YouTube."; return; }
      r.musica = { yt: id, volume: (r.musica && r.musica.volume) ?? 50, desde: Date.now(), por: o.meuNome() };
      o.salvar(); fundo.remove(); videoAtual = null; render(); tique(); o.toast("🎵 Música posta na sala");
    };
  }

  /* ---------- a cada segundo: em que sala estou, o que toca, quanto abaixar ---------- */
  function tique() {
    if (!o) return;
    const r = salaObj(), id = r ? r.id : null, mus = r && r.musica && r.musica.yt ? r.musica : null;
    if (id !== salaId) salaId = id;
    // redesenha o cartão quando algo muda (outra sala, música posta/tirada por alguém, corredor ligado/desligado)
    const assinatura = [id, r && r.type, mus && mus.yt, mus && mus.desde, o.souAdmin(), o.mapa().musicaCorredor].join("|");
    if (assinatura !== ultimaAssinatura) { ultimaAssinatura = assinatura; render(); }
    posicionar();
    // corredor
    if (r && r.type === "corredor" && o.mapa().musicaCorredor !== false && !elevMudo) Elevador.ligar(); else Elevador.desligar();
    // música da sala
    if (mus) {
      const chave = mus.yt + "|" + mus.desde;
      if (chave !== videoAtual) { videoAtual = ytPronto ? chave : null; tocar(mus); }
    } else if (videoAtual) parar();
    duck = o.alguemFalando() ? 0.4 : 1;
    aplicarVolume();
  }

  const css = document.createElement("style");
  css.textContent = `.mus-card{position:fixed;left:12px;top:62px;z-index:40;display:flex;gap:12px;padding:10px;align-items:stretch;max-width:calc(100vw - 24px)}
.mus-card[hidden]{display:none}
.mus-card.mini{align-items:center;gap:10px;padding:7px 10px;font-size:13px}
.mus-card.mini input[type=range]{width:90px}
.mus-card button{font:inherit;font-size:12.5px;font-weight:700;border:0;border-radius:9px;padding:6px 10px;background:rgba(127,127,127,.16);color:inherit;cursor:pointer}
.mus-card button:hover{background:rgba(127,127,127,.28)}
.mus-curto{display:none}
.mus-card.recolhido{padding:7px 10px}
.mus-card.recolhido .mus-player{position:fixed;left:-10000px;top:0}
.mus-card.recolhido .mus-lado>*:not(.mus-curto){display:none}
.mus-card.recolhido .mus-lado{width:auto}
.mus-card.recolhido .mus-curto{display:flex;align-items:center;gap:9px;font-size:13px}
.mus-curto b{max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.mus-curto input{width:90px;accent-color:var(--brand,#1a7f4b)}
.mus-player{width:200px;height:200px;border-radius:10px;overflow:hidden;background:#000;flex:none}
.mus-player iframe{width:200px;height:200px;display:block}
.mus-lado{display:flex;flex-direction:column;gap:7px;width:190px;font-size:13px}
.mus-top{display:flex;justify-content:space-between;align-items:center;font-weight:700;opacity:.8}
.mus-top button{padding:2px 9px}
.mus-lado b{font-size:13.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.mus-vol{display:grid;gap:2px;font-size:12px;opacity:.85}.mus-vol input{width:100%;accent-color:var(--brand,#1a7f4b)}
.mus-bts{display:flex;gap:6px;margin-top:auto}
.mus-modal{position:fixed;inset:0;z-index:300;background:rgba(10,8,16,.6);display:grid;place-items:center;padding:16px}
.mus-caixa{background:#fff;color:#1d1d1f;border-radius:16px;max-width:520px;width:100%;padding:22px;display:grid;gap:10px}
.mus-caixa h3{margin:0}.mus-caixa p{margin:0;color:#6b6760;font-size:14px}
.mus-caixa input{font:inherit;padding:11px 12px;border-radius:10px;border:1.5px solid #e4dfd5}
.mus-caixa small{color:#c0392b;min-height:1em}
.mus-caixa .mus-bts button{font:inherit;padding:9px 14px;border-radius:10px;border:1px solid #e4dfd5;background:#f3f1ec;cursor:pointer}
.mus-caixa .mus-bts{justify-content:flex-end}.mus-caixa .pri{background:var(--brand,#1a7f4b)!important;color:#fff;border-color:transparent!important;font-weight:700}
@media (max-width:760px){.mus-card{top:auto;bottom:150px}.mus-lado{width:150px}}`;
  document.head.appendChild(css);

  return {
    iniciar(opts) {
      o = opts; criarCard(); setInterval(tique, 1000);
      for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => Elevador.destravar(), { passive: true });
      if (opts.mapa().rooms.some(r => r.musica && r.musica.yt)) carregarYT();
    },
    idDoLink, tique, get elevadorTocando() { return Elevador.ligado; },
  };
})();
