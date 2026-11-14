/* Moderação do auditório.
   – Quem está em cima do palco vira palestrante: pode mutar e desmutar todo mundo da plateia e atender os pedidos.
   – Quem está na plateia pode levantar a mão (✋ aparece em cima da pessoa). Os pedidos entram numa fila, em ordem.
   – O palestrante libera a fala do primeiro da fila; quando a pessoa termina, ele muta de novo e o pedido sai da fila.
   Tudo é transmitido no estado de posição (Sala): quem está no palco manda "mod" (estado da moderação) e
   quem levantou a mão manda "mao" (horário do pedido). Assim quem chega depois já recebe o estado certo. */
window.Palco = (function () {
  let opt = null;
  let mod = null;            // meu estado de moderação (quando estou no palco): { sala, mudo, libera:[], cala:[], atendidos:{id:t}, t }
  let maoT = null;           // horário em que levantei a mão
  let travado = false, liberado = false, painelSala = null;

  function iniciar(o) { opt = o; }
  const eu = () => opt.eu();
  // sala de reunião com reunião valendo funciona como o auditório: quem apresenta é o "palco", o resto é plateia
  const reuniaoDe = a => { const r = roomAt(a.px, a.py - 4); return r && r.type === "reuniao" && window.Reuniao && Reuniao.ativaEm(r) ? r : null; };
  const salaAud = a => { const r = roomAt(a.px, a.py - 4); return r && r.type === "auditorio" ? r : reuniaoDe(a); };
  const noPalco = a => Projecao.salaNoPalco(a);
  // palco que a pessoa pode usar (com palestrante fixo, só ele); na reunião, só quem apresenta
  const palcoUsavel = a => {
    const reu = reuniaoDe(a); if (reu) return Reuniao.palestranteDaSala(reu) === a.id ? reu : null;
    const p = noPalco(a); return p && Acesso.podePalestrar(a, p.id) ? p : null;
  };

  /* palestrante que manda na sala (o que mexeu por último, entre quem está no palco agora) */
  function moderador(sala) {
    let m = null;
    for (const o of opt.outros()) {
      if (!o.visto || !o.mod || o.mod.sala !== sala.id) continue;
      const p = palcoUsavel(o); if (!p || p.id !== sala.id) continue;
      if (!m || (o.mod.t || 0) > (m.mod.t || 0)) m = o;
    }
    return m;
  }

  function atualizar() {
    if (!opt) return;
    const e = eu(), palco = palcoUsavel(e), aud = salaAud(e);
    // --- palestrante ---
    if (palco && (palco.type === "auditorio" || palco.type === "reuniao")) {
      // na reunião todo mundo começa mutado (quem apresenta libera a fala de quem levantar a mão)
      if (!mod || mod.sala !== palco.id) mod = { sala: palco.id, mudo: palco.type === "reuniao", libera: [], cala: [], atendidos: {}, t: palco.type === "reuniao" ? Date.now() : 0 };
      if (maoT) maoT = null;
    } else mod = null;
    // --- plateia ---
    let deveTravar = false, estaLiberado = false;
    if (aud && !palco) {
      const m = moderador(aud);
      if (m) {
        const me = e.id, s = m.mod;
        estaLiberado = (s.libera || []).includes(me);
        deveTravar = (s.mudo && !estaLiberado) || (s.cala || []).includes(me);
        const at = s.atendidos && s.atendidos[me];
        if (maoT && at && at >= maoT) { maoT = null; opt.toast(estaLiberado ? "Seu pedido foi atendido" : "O palestrante encerrou seu pedido ✋"); }
      }
    } else if (maoT) maoT = null; // saiu do auditório: baixa a mão
    if (deveTravar !== travado) {
      travado = deveTravar;
      Voz.bloquear(travado, true);
      const naReuniao = aud && aud.type === "reuniao";
      opt.toast(travado ? (naReuniao ? "🔇 Reunião em andamento: você entrou mutado. Levante a mão ✋ para pedir a palavra" : "🔇 O palestrante mutou a plateia. Levante a mão para pedir a palavra") : "🎙️ Seu microfone foi liberado");
      opt.aoMudarAudio && opt.aoMudarAudio();
    }
    if (estaLiberado && !liberado) opt.toast("🎙️ Você pode falar agora");
    liberado = estaLiberado;
    atualizarBotoes(e, palco, aud);
  }

  /* ---------------- ações ---------------- */
  function levantarMao() {
    const e = eu(); if (!salaAud(e) || palcoUsavel(e)) { opt.toast("Levantar a mão funciona na plateia do auditório e nas reuniões"); return; }
    maoT = maoT ? null : Date.now();
    opt.toast(maoT ? "✋ Mão levantada: o palestrante vai ver seu pedido" : "Mão abaixada");
    atualizarBotoes(e, palcoUsavel(e), salaAud(e));
  }
  const mexe = fn => { if (!mod) return; fn(mod); mod.t = Date.now(); renderPainel(); };
  function mutarTodos() { mexe(m => { m.mudo = true; m.libera = []; m.cala = []; }); opt.toast("🔇 Plateia mutada"); }
  function desmutarTodos() { mexe(m => { m.mudo = false; m.libera = []; m.cala = []; }); opt.toast("🎙️ Plateia liberada"); }
  function liberar(id) { mexe(m => { m.cala = m.cala.filter(x => x !== id); if (!m.libera.includes(id)) m.libera.push(id); }); }
  function encerrar(id) { // muta de novo e tira o pedido da fila
    mexe(m => { m.libera = m.libera.filter(x => x !== id); if (!m.mudo && !m.cala.includes(id)) m.cala.push(id); m.atendidos[id] = Date.now(); limpar(m); });
  }
  function dispensar(id) { mexe(m => { m.atendidos[id] = Date.now(); limpar(m); }); }
  function mutarPessoa(id) { mexe(m => { m.libera = m.libera.filter(x => x !== id); if (!m.mudo && !m.cala.includes(id)) m.cala.push(id); }); }
  function limpar(m) { const ids = Object.keys(m.atendidos); if (ids.length > 30) for (const id of ids.sort((a, b) => m.atendidos[a] - m.atendidos[b]).slice(0, ids.length - 30)) delete m.atendidos[id]; }

  /* ---------------- interface ---------------- */
  function plateia() { // quem está no auditório (fora do palco)
    if (!mod) return [];
    return opt.outros().filter(o => o.visto && (() => { const a = salaAud(o); return a && a.id === mod.sala && !palcoUsavel(o); })());
  }
  function fila() { // mãos levantadas, em ordem de pedido (quem já foi atendido depois de pedir sai)
    return plateia().filter(o => o.mao && !(mod.atendidos[o.id] >= o.mao)).sort((a, b) => a.mao - b.mao);
  }
  function atualizarBotoes(e, palco, aud) {
    const bm = document.getElementById("btnMao");
    if (bm) {
      const mostra = aud && !palco;
      bm.style.display = mostra ? "" : "none";
      if (window.ROTULO) ROTULO(bm, "hand", maoT ? "Baixar a mão" : "Levantar a mão");
      else { const txt = maoT ? "✋ Baixar a mão" : "✋ Levantar a mão"; if (bm.textContent !== txt) bm.textContent = txt; }
      bm.classList.toggle("on", !!maoT);
    }
    const quero = palco && (palco.type === "auditorio" || palco.type === "reuniao") ? palco.id : null;
    if (quero !== painelSala) { painelSala = quero; renderPainel(); }
    else if (painelSala) renderPainelLeve();
  }
  let ultimaAssinatura = "";
  function renderPainelLeve() { // só redesenha se mudou alguém na fila/plateia
    const ass = JSON.stringify([mod && mod.mudo, mod && mod.libera, mod && mod.cala, fila().map(o => o.id), plateia().map(o => [o.id, !!o.mic])]);
    if (ass !== ultimaAssinatura) renderPainel();
  }
  function renderPainel() {
    let el = document.getElementById("palcoPainel");
    if (!painelSala || !mod) { if (el) el.remove(); ultimaAssinatura = ""; return; }
    if (!el) { el = document.createElement("div"); el.id = "palcoPainel"; document.body.appendChild(el); el.addEventListener("click", aoClicar); }
    const f = fila(), pl = plateia();
    ultimaAssinatura = JSON.stringify([mod.mudo, mod.libera, mod.cala, f.map(o => o.id), pl.map(o => [o.id, !!o.mic])]);
    const falando = pl.filter(o => mod.libera.includes(o.id));
    const reu = (roomById(mod.sala) || {}).type === "reuniao";
    el.innerHTML = `<div class="pp-top"><b>${reu ? "🎤 Você está apresentando" : "🎤 Você está no palco"}</b><small>${pl.length} ${reu ? "na reunião" : "na plateia"}</small></div>
      <div class="pp-acoes">${mod.mudo
        ? `<button class="pp-btn" data-desmutar>🎙️ Desmutar todos</button>`
        : `<button class="pp-btn alerta" data-mutar>🔇 Mutar todos</button>`}</div>
      ${falando.length ? `<div class="pp-sec">Falando agora</div>${falando.map(o => `<div class="pp-linha falando"><span>🎙️ ${esc(o.nome)}</span><button class="pp-mini alerta" data-encerrar="${esc(o.id)}">🔇 Mutar e encerrar</button></div>`).join("")}` : ""}
      <div class="pp-sec">✋ Pedidos ${f.length ? `<i>${f.length}</i>` : ""}</div>
      ${f.length ? f.map((o, i) => `<div class="pp-linha ${i === 0 ? "primeiro" : ""}"><span>${i + 1}. ${esc(o.nome)} <small>${fmt(o.mao)}</small></span>
          ${mod.libera.includes(o.id) ? "" : `<button class="pp-mini ok" data-liberar="${esc(o.id)}">🎙️ Liberar fala</button>`}
          <button class="pp-mini" data-dispensar="${esc(o.id)}" title="Tirar da fila sem liberar">✕</button></div>`).join("")
        : `<div class="pp-vazio">Ninguém pediu a palavra.</div>`}
      ${pl.length ? `<details class="pp-det"><summary>${reu ? "Participantes" : "Plateia"}</summary>${pl.map(o => {
          const cal = (mod.mudo && !mod.libera.includes(o.id)) || mod.cala.includes(o.id);
          return `<div class="pp-linha"><span>${cal ? "🔇" : "🎙️"} ${esc(o.nome)}</span>${cal ? `<button class="pp-mini ok" data-liberar="${esc(o.id)}">Liberar</button>` : `<button class="pp-mini" data-mutarp="${esc(o.id)}">Mutar</button>`}</div>`; }).join("")}</details>` : ""}`;
  }
  function aoClicar(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.mutar !== undefined) mutarTodos();
    else if (b.dataset.desmutar !== undefined) desmutarTodos();
    else if (b.dataset.liberar) liberar(b.dataset.liberar);
    else if (b.dataset.encerrar) encerrar(b.dataset.encerrar);
    else if (b.dataset.dispensar) dispensar(b.dataset.dispensar);
    else if (b.dataset.mutarp) mutarPessoa(b.dataset.mutarp);
  }
  const fmt = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min`; };
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  return {
    iniciar, atualizar, levantarMao, mutarTodos, desmutarTodos, liberar, encerrar, dispensar,
    get estado() { return mod ? { sala: mod.sala, mudo: mod.mudo, libera: mod.libera, cala: mod.cala, atendidos: mod.atendidos, t: mod.t } : null; },
    get mao() { return maoT; }, get travado() { return travado; },
  };
})();
