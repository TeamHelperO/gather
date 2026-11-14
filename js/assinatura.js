/* Assinatura do espaço (Mercado Pago, por pessoa/mês) e teste grátis de 7 dias para até 10 pessoas.
   – Durante o teste, o dono vê quantos dias faltam e o botão "Assinar".
   – Teste acabado sem assinatura: o escritório fica fechado até o dono assinar (os dados ficam guardados).
   O espaço da Next ("principal") não é cobrado. */
window.Assinatura = (function () {
  const PRECOS = { equipe: { nome: "Equipe", preco: 19.9, d: "Áudio, vídeo, reuniões com convite, telão e chat" }, empresa: { nome: "Empresa", preco: 29.9, d: "Tudo do Equipe + agentes de IA com a sua chave e logo próprio" } };
  const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let opt = null, info = null;

  async function verificar(o) {
    opt = o; if (o.mapaId === "principal") return;
    try { const { data, error } = await Dados.cliente.rpc("assinatura_info", { p_mapa: o.mapaId }); if (error || !data) return; info = data; }
    catch (e) { return; } // tabela ainda não criada: segue sem cobrança
    if (new URLSearchParams(location.search).get("assinatura") === "ok") {
      opt.toast("✅ Pagamento enviado! Assim que o Mercado Pago confirmar, a assinatura é ativada (leva alguns segundos)");
      history.replaceState(null, "", location.pathname + location.search.replace(/[?&]assinatura=ok/, "").replace(/^&/, "?"));
      setTimeout(() => verificar(o), 15000);
    }
    desenhar();
  }
  function desenhar() {
    document.getElementById("assPill")?.remove();
    if (!info) return;
    if (!info.liberado) return bloquear();
    document.getElementById("assBloqueio")?.remove();
    if (info.status !== "ativa" && info.dono) {
      const p = document.createElement("button"); p.id = "assPill"; p.className = "pill hud";
      p.textContent = `🎁 Teste grátis: ${info.dias} dia${info.dias === 1 ? "" : "s"} · Assinar`;
      p.onclick = () => escolherPlano(); document.body.appendChild(p);
    }
  }
  function bloquear() {
    let el = document.getElementById("assBloqueio");
    if (!el) { el = document.createElement("div"); el.id = "assBloqueio"; document.body.appendChild(el); }
    const titulo = info.status === "cancelada" ? "A assinatura deste espaço foi cancelada" : info.status === "pausada" ? "A assinatura deste espaço está pausada" : "O teste grátis de 7 dias terminou";
    el.innerHTML = `<div class="ass-caixa"><div class="ass-ic">⏳</div><h2>${titulo}</h2>
      <p>Tudo o que vocês fizeram continua guardado. ${info.dono ? "Assine para liberar o escritório para a equipe." : "Peça ao dono do espaço para assinar e liberar o escritório."}</p>
      <div class="ass-ac">${info.dono ? `<button class="btn pri" data-ass="planos">Ver planos e assinar</button>` : ""}<a class="btn" href="salas.html">Voltar às salas</a></div></div>`;
    el.onclick = e => { if (e.target.closest('[data-ass="planos"]')) escolherPlano(); };
  }
  function escolherPlano() {
    let m = document.getElementById("assModal"); if (!m) { m = document.createElement("div"); m.id = "assModal"; document.body.appendChild(m); }
    const pessoas = Math.max(1, info.pessoas || 10);
    m.innerHTML = `<form class="ass-caixa"><button type="button" class="ass-x" data-fechar>×</button><h2>Escolha o plano</h2>
      <div class="ass-planos">${Object.entries(PRECOS).map(([k, p], i) => `<label class="ass-plano"><input type="radio" name="plano" value="${k}" ${i === 0 ? "checked" : ""}><b>${p.nome}</b><span>${reais(p.preco)} <small>por pessoa/mês</small></span><small>${esc(p.d)}</small></label>`).join("")}</div>
      <label class="ass-pessoas">Quantas pessoas na equipe? <input name="pessoas" type="number" min="1" max="500" value="${pessoas}"></label>
      <p class="ass-total">Total: <b data-total></b> por mês · PIX, cartão ou boleto pelo Mercado Pago · cancele quando quiser</p>
      <button class="btn pri" data-pagar>Ir para o pagamento</button><p class="ass-erro" data-erro></p></form>`;
    m.classList.add("on");
    const f = m.querySelector("form"), total = () => { const fd = new FormData(f), v = PRECOS[fd.get("plano")].preco * Math.max(1, +fd.get("pessoas") || 1); f.querySelector("[data-total]").textContent = reais(Math.round(v * 100) / 100); };
    f.oninput = total; total();
    m.onclick = e => { if (e.target === m || e.target.closest("[data-fechar]")) m.classList.remove("on"); };
    f.onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(f), b = f.querySelector("[data-pagar]"), erro = f.querySelector("[data-erro]");
      b.disabled = true; b.textContent = "Abrindo o Mercado Pago…"; erro.textContent = "";
      try {
        const token = await Dados.tokenAtual();
        const r = await fetch("/api/assinar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ mapa: opt.mapaId, plano: fd.get("plano"), pessoas: +fd.get("pessoas") }) }).then(r => r.json());
        if (r.url) { location.href = r.url; return; }
        erro.textContent = r.erro || "Não consegui abrir o pagamento";
      } catch (er) { erro.textContent = "Sem conexão com o servidor"; }
      b.disabled = false; b.textContent = "Ir para o pagamento";
    };
  }
  return { verificar, escolherPlano, get info() { return info; }, PRECOS };
})();
