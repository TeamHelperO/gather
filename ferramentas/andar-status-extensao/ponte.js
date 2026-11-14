// Ponte entre a extensão e a página do Andar (só roda nos endereços do Andar).
(() => {
  let porta = null;
  const paraPagina = m => window.postMessage({ fonte: "andar-ext", versao: "1.0.0", ...m }, location.origin);
  function conectar() {
    try { porta = chrome.runtime.connect({ name: "andar" }); } catch (e) { return; }
    porta.onMessage.addListener(paraPagina);
    porta.onDisconnect.addListener(() => { porta = null; setTimeout(conectar, 1000); });
  }
  conectar();
  paraPagina({ tipo: "ola" });
  setInterval(() => { if (porta) try { porta.postMessage({ tipo: "ping" }); } catch (e) {} }, 2000);
  window.addEventListener("message", e => { if (e.source === window && e.data && e.data.fonte === "andar-pagina" && e.data.tipo === "quem") paraPagina({ tipo: "ola" }); });
})();
