/* Uma conta, um lugar por vez: quando a mesma conta entra no escritório em outro aparelho
   (ou outra aba), a sessão que já estava aberta cai.
   – Canal "conta-<id do usuário>" (Supabase Realtime): quem entra avisa "assumi"; quem já estava sai.
   – Quem volta de uma queda de conexão e encontra outra sessão da conta aberta também sai.
   – Ao entrar, as sessões de login dos OUTROS aparelhos são revogadas (signOut scope "others"),
     então o aparelho derrubado precisa fazer login de novo. Outra aba do mesmo navegador só fecha. */
window.SessaoUnica = (function () {
  let canal = null, minha = null, opts = {}, inscricoes = 0, caiu = false;
  const navId = (() => {
    try { let v = localStorage.getItem("nextco_nav"); if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); localStorage.setItem("nextco_nav", v); } return v; }
    catch (e) { return "sem-id"; }
  })();
  function dispositivo() {
    const u = navigator.userAgent;
    const nav = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "navegador";
    const so = /Android/.test(u) ? "Android" : /iPhone|iPad|iPod/.test(u) ? "iPhone/iPad" : /Windows/.test(u) ? "Windows" : /Mac OS X/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "";
    return so ? `${nav} no ${so}` : nav;
  }

  function iniciar(o) {
    opts = o || {};
    const uid = Dados.meuId(); if (!uid || !Dados.cliente || !Dados.cliente.channel) return;
    minha = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
    // soOutrosAparelhos: páginas como a escolha de sala só derrubam outros aparelhos, nunca outra aba deste navegador
    const eu = { sessao: minha, nav: navId, disp: dispositivo(), desde: Date.now(), soOutros: !!opts.soOutrosAparelhos };
    canal = Dados.cliente.channel("conta-" + uid, { config: { presence: { key: minha }, broadcast: { self: false } } });
    // alguém da mesma conta acabou de entrar: esta sessão é a antiga
    canal.on("broadcast", { event: "assumi" }, ({ payload }) => { if (payload && payload.sessao !== minha && !(payload.soOutros && payload.nav === navId)) derrubar(payload); });
    // voltei de uma queda e a conta já está aberta em outro lugar: esta sessão é a antiga
    canal.on("presence", { event: "sync" }, () => {
      if (inscricoes < 2 || caiu) return;
      const outras = Object.entries(canal.presenceState()).filter(([k, m]) => k !== minha && m.length && !(m[m.length - 1].nav === navId && (m[m.length - 1].soOutros || eu.soOutros)));
      if (outras.length) derrubar(outras[0][1][outras[0][1].length - 1]);
    });
    canal.subscribe(async status => {
      if (status !== "SUBSCRIBED" || caiu) return;
      inscricoes++;
      await canal.track(eu);
      if (inscricoes === 1) {
        canal.send({ type: "broadcast", event: "assumi", payload: eu });
        // derruba o login dos outros aparelhos (as outras abas deste navegador usam a mesma sessão e só fecham pelo aviso acima)
        try { Dados.cliente.auth.signOut({ scope: "others" }); } catch (e) {}
      }
    });
  }

  async function derrubar(outra) {
    if (caiu) return; caiu = true;
    const mesmaMaquina = outra && outra.nav === navId;
    try { if (opts.aoCair) opts.aoCair(); } catch (e) {}
    try { if (canal) { canal.untrack(); Dados.cliente.removeChannel(canal); } } catch (e) {}
    if (!mesmaMaquina) { try { await Dados.cliente.auth.signOut({ scope: "local" }); } catch (e) {} }
    const onde = mesmaMaquina ? "em outra aba deste navegador" : `em outro aparelho${outra && outra.disp ? ` (${outra.disp})` : ""}`;
    const tela = document.createElement("div");
    tela.id = "sessaoCaiu";
    tela.innerHTML = `<div class="sc-card">
        <div class="sc-ic">🔒</div>
        <h2>Sua conta foi aberta ${onde}</h2>
        <p>Cada conta fica conectada em um lugar por vez, então esta janela foi desconectada.</p>
        ${mesmaMaquina ? `<button class="btn pri" id="scVoltar">Usar nesta aba</button>`
          : `<button class="btn pri" id="scEntrar">Entrar de novo aqui</button><p class="sc-obs">Ao entrar aqui, o outro aparelho é que será desconectado.</p>`}
      </div>`;
    const css = document.createElement("style");
    css.textContent = `#sessaoCaiu{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(14,11,24,.82);backdrop-filter:blur(6px);padding:20px}
      #sessaoCaiu .sc-card{background:var(--panel,#24222b);color:var(--ink,#f1efe9);border:1px solid var(--line,#3a3742);border-radius:18px;max-width:420px;padding:26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
      #sessaoCaiu .sc-ic{font-size:42px}#sessaoCaiu h2{margin:8px 0 6px;font-size:20px}#sessaoCaiu p{color:var(--mut,#a29d95);margin:0 0 16px}
      #sessaoCaiu .btn{width:100%}#sessaoCaiu .sc-obs{font-size:12.5px;margin:10px 0 0}`;
    document.head.appendChild(css); document.body.appendChild(tela);
    const v = document.getElementById("scVoltar"); if (v) v.onclick = () => location.reload();
    const e = document.getElementById("scEntrar"); if (e) e.onclick = () => { location.href = "index.html"; };
  }

  return { iniciar, get derrubada() { return caiu; }, dispositivo };
})();
