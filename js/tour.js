/* Primeira entrada guiada (~30 s): escolher 2D ou 3D (se a sala deixa), andar, falar, sentar e o telão.
   Cada passo se completa sozinho quando a pessoa faz a ação; dá para pular. Aparece uma vez por aparelho
   (Configurações → Geral → "Ver o tutorial de novo" mostra outra vez). */
window.Tour = (function () {
  const CHAVE = "nextco_tour_v1";
  let el = null, passos = [], i = 0, opt = {}, ini = null, timer = null;
  const toque = () => matchMedia("(pointer:coarse)").matches;
  function montarPassos() {
    const l = [];
    if (opt.modoSala && opt.modoSala() === "ambos") l.push({ id: "vista", titulo: "Como quer ver o escritório?", texto: "Dá para trocar quando quiser no botão 3D, no canto direito.",
      botoes: [["2d", "🗺️ 2D, de cima"], ["3d", "🧊 3D, em primeira pessoa"]] });
    l.push({ id: "andar", titulo: "Ande pelo escritório", texto: toque() ? "Toque no chão para ir até lá, ou use o controle no canto. No 3D, para frente anda e para os lados vira." : "Use as setas ou WASD, ou clique no chão para ir até lá.",
      feito: () => { const P = opt.eu(); if (!P) return false; if (!ini) ini = { x: P.x, y: P.y }; return Math.hypot(P.x - ini.x, P.y - ini.y) > 70; } });
    l.push({ id: "falar", titulo: "Converse com quem está perto", texto: "Quem chega perto de você se ouve, como no escritório de verdade; numa sala fechada, só quem está dentro. Toque no botão do áudio para abrir o microfone e falar.",
      feito: () => !!(window.Voz && Voz.micAberto), destaque: "#btnAudio" });
    l.push({ id: "sentar", titulo: "Sente para trabalhar", texto: "Pare perto de uma cadeira ou toque em Sentar. Na sua mesa, o computador liga.",
      feito: () => { const P = opt.eu(); return !!(P && P.assento); }, destaque: '[data-emote="4"]' });
    l.push({ id: "telao", titulo: "O telão da sala", texto: "Cada sala tem um telão com as tarefas da equipe. Chegue perto dele e toque em Abrir telão.",
      feito: () => !!(window.Telao && Telao.aberto), destaque: "#btnTelao" });
    l.push({ id: "fim", titulo: "Pronto! 🎉", texto: "Clique em alguém para conversar, chamar ou mandar mensagem. Tudo o mais fica em Configurações, no seu nome lá em cima.", botoes: [["fim", "Começar"]] });
    return l;
  }
  function iniciar(o, forcar) {
    if (o) opt = o;
    try { if (!forcar && localStorage.getItem(CHAVE)) return; } catch (e) {}
    passos = montarPassos(); i = 0; ini = null;
    if (!el) {
      el = document.createElement("div"); el.id = "tour"; el.setAttribute("role", "dialog"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el);
      el.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return; const a = b.dataset.t;
        if (a === "pular" || a === "fim") return fechar();
        if (a === "prox") return avancar();
        if (a === "2d" || a === "3d") { opt.vista && opt.vista(a); return avancar(); }
      });
    }
    el.style.display = "block"; mostrar();
    clearInterval(timer); timer = setInterval(checar, 400);
  }
  function mostrar() {
    const p = passos[i]; if (!p) return fechar();
    document.querySelectorAll(".tour-foco").forEach(x => x.classList.remove("tour-foco"));
    if (p.destaque) { const d = document.querySelector(p.destaque); if (d && d.offsetParent) d.classList.add("tour-foco"); }
    const n = passos.length - 1, pos = Math.min(i + 1, n);
    el.innerHTML = `<div class="tour-topo"><span>${p.id === "fim" ? "Tudo certo" : `Passo ${pos} de ${n}`}</span><button data-t="pular" aria-label="Pular o tutorial">Pular</button></div>
      <b>${p.titulo}</b><p>${p.texto}</p>
      <div class="tour-pts">${passos.slice(0, n).map((_, k) => `<i class="${k < i ? "ok" : k === i ? "ag" : ""}"></i>`).join("")}</div>
      <div class="tour-bts">${(p.botoes || []).map(([k, t]) => `<button class="pri" data-t="${k}">${t}</button>`).join("") || `<button data-t="prox">Próximo</button>`}</div>`;
  }
  function checar() {
    const p = passos[i]; if (!p || !p.feito) return;
    if (p.id === "telao") { const d = document.querySelector("#btnTelao"); if (d && d.offsetParent && !d.classList.contains("tour-foco")) d.classList.add("tour-foco"); }
    if (p.feito()) { el.classList.add("tour-ok"); setTimeout(() => el && el.classList.remove("tour-ok"), 500); avancar(); }
  }
  function avancar() { i++; if (passos[i] && passos[i].id === "andar") ini = null; mostrar(); }
  function fechar() {
    clearInterval(timer); timer = null; if (el) el.style.display = "none";
    document.querySelectorAll(".tour-foco").forEach(x => x.classList.remove("tour-foco"));
    try { localStorage.setItem(CHAVE, "1"); } catch (e) {}
  }
  return { iniciar, fechar, get aberto() { return !!(el && el.style.display === "block"); } };
})();
