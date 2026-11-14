chrome.storage.session.get(["app", "pc"]).then(s => {
  document.getElementById("app").textContent = s.app || "nenhum";
  document.getElementById("pc").textContent = s.pc ? "conectado" : "não encontrado (opcional)";
});
