/* Reuniões nas salas de reunião.
   – No horário, quem foi convidado e está online recebe um convite na tela: "Entrar sentado" leva a pessoa
     direto para uma cadeira livre da sala; quem recusar ainda pode entrar andando.
   – Durante a reunião (de 5 min antes até o fim), quem não foi convidado não entra na sala.
   – Quem apresenta (o organizador, ou quem ele escolheu) fala; todo mundo entra mutado e pede a palavra
     levantando a mão — a moderação é a mesma do auditório (Palco).
   – O telão da sala mostra o assunto da reunião e um letreiro passando com a pauta.
   Convite "sem ninguém marcado" = todos convidados. */
window.Reuniao = (function () {
  let opt = null;
  const ANTES = 5 * 60e3;
  const lista = () => (window.Social && Social.reunioes) || [];
  const ms = d => new Date(d).getTime();
  const marca = (r, k) => { const m = r && r.pauta && String(r.pauta).match(new RegExp("⟦" + k + ":([^⟧]+)⟧")); return m ? m[1] : null; };
  const limpa = p => String(p || "").replace(/\s*⟦[a-z]+:[^⟧]*⟧/g, "").trim();
  const palestranteDe = r => marca(r, "pal") || (r && r.criado_por) || null;
  const souConvidado = (r, id) => { id = id || Dados.meuId(); return !r.convidados || !r.convidados.length || r.convidados.includes(id) || r.criado_por === id || palestranteDe(r) === id; };
  const nomeDe = id => { const u = window.Social && Social.usuarios && Social.usuarios.find(u => u.id === id); return u ? u.nome : ""; };
  const hora = d => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function iniciar(o) { opt = o; }
  /* reunião valendo agora numa sala de reunião */
  function ativaEm(sala, agora = Date.now()) {
    if (!sala || sala.type !== "reuniao") return null;
    return lista().find(r => r.sala_id === sala.id && ms(r.inicio) - ANTES <= agora && ms(r.fim) >= agora) || null;
  }
  function proximaHoje(sala, agora = Date.now()) {
    if (!sala) return null; const fimDoDia = new Date(); fimDoDia.setHours(23, 59, 59, 999);
    return lista().filter(r => r.sala_id === sala.id && ms(r.inicio) > agora && ms(r.inicio) <= fimDoDia.getTime()).sort((a, b) => ms(a.inicio) - ms(b.inicio))[0] || null;
  }
  /* não convidado não entra durante a reunião */
  let ultimoAviso = 0;
  function bloqueia(sala) { const r = ativaEm(sala); return !!r && !souConvidado(r); }
  function avisarBloqueio(sala) {
    if (Date.now() - ultimoAviso < 3000) return; ultimoAviso = Date.now();
    const r = ativaEm(sala); if (r) opt.toast(`🔒 ${sala.name}: reunião “${r.titulo}” em andamento — só convidados entram`);
  }
  /* quem apresenta (fala sem pedir) numa sala de reunião com reunião valendo */
  function palestranteDaSala(sala) { const r = ativaEm(sala); return r ? palestranteDe(r) : null; }

  /* ---------- convite na hora da reunião ---------- */
  const CH = "nextco_convites_reuniao";
  const respondidos = (() => { try { return JSON.parse(localStorage.getItem(CH)) || {}; } catch (e) { return {}; } })();
  function convite(r) {
    if (!opt || respondidos[r.id] || !souConvidado(r)) return false;
    const sala = S.rooms.find(x => x.id === r.sala_id); if (!sala) return false;
    const aqui = opt.salaAtual(); if (aqui && aqui.id === sala.id) return false; // já está lá
    respondidos[r.id] = Date.now(); try { localStorage.setItem(CH, JSON.stringify(respondidos)); } catch (e) {}
    const pal = palestranteDe(r), quem = pal === Dados.meuId() ? "você" : nomeDe(pal);
    const c = document.createElement("div"); c.className = "reu-convite";
    c.innerHTML = `<div class="rc-ic">📅</div><div class="rc-tx"><small>Reunião começando · ${esc(sala.name)} · ${hora(r.inicio)}–${hora(r.fim)}</small><b>${esc(r.titulo)}</b>${quem ? `<small>Apresenta: ${esc(quem)}</small>` : ""}</div>
      <div class="rc-ac"><button class="btn pri" data-r="entrar">🪑 Entrar sentado</button><button class="btn" data-r="recusar">Recusar</button></div>`;
    document.body.appendChild(c);
    const fechar = () => c.remove(), tm = setTimeout(fechar, 3 * 60e3);
    c.onclick = e => { const b = e.target.closest("[data-r]"); if (!b) return; clearTimeout(tm); fechar();
      if (b.dataset.r === "entrar") opt.teleportar(sala.id);
      else opt.toast("Tudo bem — se mudar de ideia, é só ir andando até a " + sala.name); };
    return true;
  }

  /* ---------- telão da sala: assunto da reunião + letreiro passando ---------- */
  // no 3D o telão é redesenhado a cada 0,5 s; com letreiro, ~12 vezes por segundo
  function animaTelao(it) { const agora = performance.now(); if (agora - (it._letreiroT || 0) < 80) return false; const r = roomAt(it.x * T + 96, it.y * T + 150); if (!r || r.type !== "reuniao" || !(ativaEm(r) || proximaHoje(r))) return false; it._letreiroT = agora; return true; }
  function letreiro(g, x, y, w, texto, cor) { // faixa de LED com o texto correndo
    g.save(); g.beginPath(); g.rect(x, y, w, 12); g.clip();
    g.fillStyle = "#0b0a10"; g.fillRect(x, y, w, 12); g.fillStyle = cor; g.fillRect(x, y, 3, 12);
    g.font = "bold 7px system-ui,sans-serif"; g.textBaseline = "middle"; g.fillStyle = "#ffd36a";
    const tw = g.measureText(texto).width + 40, off = (performance.now() / 1000 * 26) % tw;
    for (let k = 0; k < 3; k++) g.fillText(texto, x + w - off + k * tw - tw, y + 6.5);
    g.restore();
  }
  function quebra(g, texto, max, linhas) {
    const pal = String(texto).split(/\s+/), out = []; let l = "";
    for (const p of pal) { const t = l ? l + " " + p : p; if (g.measureText(t).width > max && l) { out.push(l); l = p; if (out.length === linhas) break; } else l = t; }
    if (out.length < linhas && l) out.push(l);
    if (out.length === linhas && pal.join(" ").length > out.join(" ").length) out[linhas - 1] = out[linhas - 1].replace(/.{0,2}$/, "…");
    return out;
  }
  /* desenha por cima do telão (192x96) da sala de reunião */
  function desenharNoTelao(g, x, y, sala) {
    if (!sala || sala.type !== "reuniao") return;
    const r = ativaEm(sala);
    if (r) {
      const pal = palestranteDe(r), agora = Date.now(), aoVivo = ms(r.inicio) <= agora;
      g.save(); g.fillStyle = "#14121c"; g.fillRect(x + 6, y + 6, 180, 77);
      g.fillStyle = aoVivo ? "#e5484d" : "#3d5afe"; g.fillRect(x + 6, y + 6, 180, 10);
      g.fillStyle = "#fff"; g.font = "bold 7px system-ui,sans-serif"; g.textBaseline = "middle";
      g.fillText(aoVivo ? (Math.floor(agora / 600) % 2 ? "● AO VIVO" : "○ AO VIVO") : "COMEÇA ÀS " + hora(r.inicio), x + 10, y + 11.5);
      g.textAlign = "right"; g.fillText(hora(r.inicio) + "–" + hora(r.fim), x + 182, y + 11.5); g.textAlign = "left";
      g.font = "bold 11px system-ui,sans-serif";
      quebra(g, r.titulo, 170, 2).forEach((l, i) => g.fillText(l, x + 11, y + 28 + i * 13));
      g.font = "600 7px system-ui,sans-serif"; g.fillStyle = "#b9b4c8";
      if (pal) g.fillText("🎤 Apresenta: " + (nomeDe(pal) || "organizador"), x + 11, y + 58);
      const conv = (r.convidados || []).length; g.fillText(conv ? `👥 ${conv + 1} convidados` : "👥 Aberta a todos", x + 110, y + 58);
      g.restore();
      const pauta = limpa(r.pauta);
      letreiro(g, x + 6, y + 70, 180, (pauta ? pauta + "   •   " : "") + r.titulo + "   •   Levante a mão ✋ para pedir a palavra", aoVivo ? "#e5484d" : "#3d5afe");
      return;
    }
    const prox = proximaHoje(sala);
    if (prox) letreiro(g, x + 6, y + 70, 180, `PRÓXIMA REUNIÃO · ${hora(prox.inicio)} · ${prox.titulo}` + (palestranteDe(prox) ? ` · Apresenta: ${nomeDe(palestranteDe(prox))}` : ""), "#3d5afe");
  }

  return { iniciar, ativaEm, proximaHoje, bloqueia, avisarBloqueio, palestranteDe, palestranteDaSala, souConvidado, convite, desenharNoTelao, animaTelao, limpa };
})();
