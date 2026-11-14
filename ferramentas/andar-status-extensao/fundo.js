// Andar Status: descobre o app em uso e avisa as abas do Andar.
// - navegador em foco: o site da aba ativa (só os da lista em apps.js)
// - outro programa em foco: pergunta ao "Andar Status para PC" (http://127.0.0.1:47321), se instalado
importScripts("apps.js");

let focoNoNavegador = true, appNavegador = null, appPC = null, pcAtivo = false, ultimoEnviado;
const portas = new Set();

async function lerAbaAtiva() {
  try {
    const [aba] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    appNavegador = aba ? appDoSite(aba.url || "") : null;
  } catch (e) { appNavegador = null; }
}
async function lerPC() {
  try {
    const r = await fetch("http://127.0.0.1:47321/status", { cache: "no-store" });
    const j = await r.json(); pcAtivo = true; appPC = j.app && j.app !== "navegador" ? j.app : null;
    focoNoNavegador = j.app === "navegador"; // com o app de PC, ele é quem sabe o que está na frente
  } catch (e) { pcAtivo = false; appPC = null; }
}
// voltar para a aba do Andar não apaga o app: ele continua aparecendo por até 10 min
// (você deu uma olhada no escritório, mas segue trabalhando no Figma)
const MANTER_MS = 10 * 60 * 1000;
let ultimoApp = null, ultimoAppEm = 0;
function atual() {
  let app = focoNoNavegador ? appNavegador : appPC;
  if (app === "andar") app = Date.now() - ultimoAppEm < MANTER_MS ? ultimoApp : null;
  else if (app) { ultimoApp = app; ultimoAppEm = Date.now(); }
  else ultimoApp = null; // foi para algo fora da lista: some
  return app;
}
function enviar(forcar) {
  const app = atual();
  if (!forcar && app === ultimoEnviado) return;
  ultimoEnviado = app;
  const msg = { tipo: "app", app, pc: pcAtivo };
  for (const p of portas) { try { p.postMessage(msg); } catch (e) {} }
  chrome.storage.session.set({ app, pc: pcAtivo }).catch(() => {});
}
async function atualizar(forcar) { await lerAbaAtiva(); enviar(forcar); }

chrome.tabs.onActivated.addListener(() => atualizar());
chrome.tabs.onUpdated.addListener((id, mud, aba) => { if (mud.url || mud.status === "complete") atualizar(); });
chrome.windows.onFocusChanged.addListener(async w => {
  focoNoNavegador = w !== chrome.windows.WINDOW_ID_NONE;
  if (!focoNoNavegador) await lerPC();
  atualizar();
});

// cada aba do Andar abre uma porta; enquanto houver porta aberta, a extensão fica acordada e consulta o PC
chrome.runtime.onConnect.addListener(p => {
  if (p.name !== "andar") return;
  portas.add(p);
  p.onDisconnect.addListener(() => portas.delete(p));
  p.onMessage.addListener(m => { if (m && m.tipo === "ping") tique(); });
  lerPC().then(() => atualizar(true));
});
// enquanto houver aba do Andar aberta, consulta o app de PC a cada 2 s pelo próprio fundo
// (a aba em segundo plano é desacelerada pelo Chrome e não dá conta disso sozinha)
setInterval(() => { if (portas.size) { chrome.runtime.getPlatformInfo(() => {}); tique(); } }, 2000);
let ocupado = false;
async function tique() {
  if (ocupado) return; ocupado = true;
  try { await lerPC(); if (!focoNoNavegador || !pcAtivo) await lerAbaAtiva(); enviar(); } finally { ocupado = false; }
}
