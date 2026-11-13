/* Minimapa: planta do escritório no canto com as salas e onde está cada pessoa (2D e 3D).
   Toque/clique num ponto do minimapa para ir até lá. Tecla M ou o botão de mapa mostram/escondem. */
window.Minimapa = (function () {
  const COR = { recepcao: "#e8cf9c", trabalho: "#c99a6b", copa: "#e7ddcc", reuniao: "#8f9fd8", ti: "#3c4a62", edicao: "#7b6bd0", auditorio: "#a85a4a", silenciosa: "#86c79a", corredor: "#b48a5f", lazer: "#9fcf86" };
  let cv = null, g = null, ligado = true, esc = 1, ox = 0, oy = 0, W = 200, H = 140, ultimo = 0, opt = {};
  const chave = "nextco_minimapa";
  function iniciar(o) {
    opt = o || {};
    try { const v = localStorage.getItem(chave); ligado = v == null ? !matchMedia("(pointer:coarse)").matches : v === "1"; } catch (e) {}
    cv = document.createElement("canvas"); cv.id = "miniMapa"; cv.setAttribute("aria-label", "Minimapa: toque para ir até lá"); cv.title = "Minimapa · clique para ir até lá (M esconde)";
    document.body.appendChild(cv); g = cv.getContext("2d");
    cv.addEventListener("pointerup", e => {
      e.stopPropagation(); const r = cv.getBoundingClientRect();
      const wx = ((e.clientX - r.left) - ox) / esc, wy = ((e.clientY - r.top) - oy) / esc;
      if (opt.irPara) opt.irPara(wx, wy);
    });
    cv.addEventListener("pointerdown", e => e.stopPropagation());
    addEventListener("keydown", e => { if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey && !e.target.matches("input,select,textarea") && !(opt.bloqueado && opt.bloqueado())) alternar(); });
    aplicar();
  }
  function aplicar() { if (cv) cv.style.display = ligado ? "block" : "none"; const b = document.getElementById("bMapa"); if (b) b.classList.toggle("on", ligado); }
  function alternar() { ligado = !ligado; try { localStorage.setItem(chave, ligado ? "1" : "0"); } catch (e) {} aplicar(); return ligado; }
  function medir(S) {
    const T_ = window.T || 32, mw = S.w * T_, mh = S.h * T_, maxW = Math.min(220, innerWidth * 0.42), maxH = 150;
    esc = Math.min(maxW / mw, maxH / mh); W = Math.round(mw * esc) + 12; H = Math.round(mh * esc) + 12; ox = 6; oy = 6;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px"; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // pessoas: [{x,y,cor,eu,dir(rad?)}]
  function desenhar(S, pessoas, salaAtual, olhar) {
    if (!ligado || !cv || !S) return;
    const agora = performance.now(); if (agora - ultimo < 180) return; ultimo = agora;
    const T_ = window.T || 32; medir(S);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(20,16,32,.78)"; g.beginPath(); g.roundRect(0, 0, W, H, 10); g.fill();
    for (const r of S.rooms) {
      const x = ox + r.x * T_ * esc, y = oy + r.y * T_ * esc, w = r.w * T_ * esc, h = r.h * T_ * esc;
      g.fillStyle = COR[r.type] || "#9a8f80"; g.globalAlpha = salaAtual && salaAtual.id === r.id ? 1 : 0.72; g.fillRect(x, y, w, h); g.globalAlpha = 1;
      if (window.TYPES && TYPES[r.type] && !TYPES[r.type].noWalls) { g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = salaAtual && salaAtual.id === r.id ? 1.6 : 0.8; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    }
    for (const p of pessoas) {
      const x = ox + p.x * esc, y = oy + p.y * esc;
      if (p.eu) {
        if (olhar != null) { // cone de visão
          g.fillStyle = "rgba(61,90,254,.35)"; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 16, olhar - 0.55, olhar + 0.55); g.closePath(); g.fill();
        }
        g.fillStyle = "#3d5afe"; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
      } else { g.fillStyle = p.cor || "#7ee787"; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); g.stroke(); }
    }
  }
  return { iniciar, desenhar, alternar, get ligado() { return ligado; } };
})();
