// Ponte entre a extensão e a página do Andar (só roda nos endereços do Andar).
(() => {
  let porta = null, ultimo = null;
  const paraPagina = m => window.postMessage({ fonte: "andar-ext", versao: "1.1.0", ...m }, location.origin);
  function conectar() {
    try { porta = chrome.runtime.connect({ name: "andar" }); } catch (e) { return; }
    porta.onMessage.addListener(m => { ultimo = m; paraPagina(m); });
    porta.onDisconnect.addListener(() => { porta = null; setTimeout(conectar, 1000); });
  }
  conectar();
  paraPagina({ tipo: "ola" });
  setInterval(() => { if (porta) try { porta.postMessage({ tipo: "ping" }); } catch (e) {} }, 2000);
  window.addEventListener("message", e => { if (e.source === window && e.data && e.data.fonte === "andar-pagina" && e.data.tipo === "quem") { paraPagina({ tipo: "ola" }); if (ultimo) paraPagina(ultimo); } // a página chegou depois: repete o último aviso });
})();
