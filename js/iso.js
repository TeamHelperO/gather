/* Protótipo 3D isométrico do escritório (Three.js, low-poly).
   Usa o mesmo mapa (salas, portas, móveis automáticos), a mesma colisão e o mesmo caminho (findPath) do 2D:
   1 unidade 3D = 1 tile (32 px). Só visual + andar; áudio, telões e agentes continuam no escritório 2D por enquanto. */
import * as THREE from "./vendor/three/three.min.js";

const $ = id => document.getElementById(id);
const cv = $("cena");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const cena = new THREE.Scene();
cena.background = new THREE.Color("#1b1828");

/* ---------- paleta e materiais ---------- */
const PISO = { f_madeira: ["#c98f5a", "#b97e4b"], f_carpete_azul: ["#5168c4", "#4a60b6"], f_carpete_verde: ["#5c9a68", "#558f60"], f_carpete_cinza: ["#8f93a0", "#868a97"],
  f_ceramica: ["#efe8dc", "#e2dacb"], f_grama: ["#73b65a", "#69aa51"], f_palco: ["#8f3f3f", "#7f3636"], f_ti: ["#2c3442", "#262d3a"] };
const TOM_SALA = { recepcao: 0xffd296, copa: 0xffc68c, trabalho: 0xffe2b4, ti: 0x50c8ff, edicao: 0xe65abe, auditorio: 0xffbe78, reuniao: 0xaabeff, silenciosa: 0x96e6aa };
const mats = {};
const mat = (cor, o = {}) => { const k = cor + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.78, metalness: 0.02, ...o })); };
const brilho = (cor, forca = 1.4) => mat("#111111", { emissive: new THREE.Color(cor), emissiveIntensity: forca, roughness: 0.4 });
function texturaPiso(tipo) {
  const [a, b] = PISO[tipo] || PISO.f_madeira, c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  g.fillStyle = a; g.fillRect(0, 0, 64, 64);
  if (tipo === "f_madeira" || tipo === "f_palco") { g.fillStyle = b; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16, 64, 1); g.fillRect(((0) % 64), 0, 1, 16); g.fillRect(32, 16, 1, 16); g.fillRect(12, 32, 1, 16); g.fillRect(44, 48, 1, 16); }
  else if (tipo === "f_ceramica" || tipo === "f_ti") { g.fillStyle = b; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(0, 32, 64, 2); g.fillRect(32, 0, 2, 64); if (tipo === "f_ti") { g.fillStyle = "#2fd4e8"; g.fillRect(6, 6, 3, 3); g.fillRect(40, 40, 3, 3); } }
  else { g.fillStyle = b; for (let i = 0; i < 90; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function caixaM(w, h, d, m, x = 0, y = 0, z = 0, sombra = true) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === "string" ? mat(m) : m);
  me.position.set(x, y + h / 2, z); me.castShadow = sombra; me.receiveShadow = true; return me;
}
function cilindro(r, h, m, x = 0, y = 0, z = 0, seg = 12) { const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), typeof m === "string" ? mat(m) : m); me.position.set(x, y + h / 2, z); me.castShadow = me.receiveShadow = true; return me; }
function bola(r, m, x = 0, y = 0, z = 0, det = 0) { const me = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det), typeof m === "string" ? mat(m, { flatShading: true }) : m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; return me; }
function telaTexto(titulo, cor = "#3d5afe", linhas = 4) {
  const c = document.createElement("canvas"); c.width = 384; c.height = 192; const g = c.getContext("2d");
  g.fillStyle = "#121a2b"; g.fillRect(0, 0, 384, 192); g.fillStyle = cor; g.fillRect(0, 0, 384, 30);
  g.fillStyle = "#fff"; g.font = "800 17px Inter,system-ui,sans-serif"; g.textBaseline = "middle"; g.fillText(titulo, 12, 16);
  for (let i = 0; i < linhas; i++) { g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(14, 50 + i * 32, 150 + (i * 53) % 90, 8); g.fillStyle = cor; g.fillRect(200, 50 + i * 32, 60 + (i * 41) % 110, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.5 });
}
// cor média do sprite 2D (para móveis sem modelo próprio)
function corMedia(k) {
  const im = IMG[k]; if (!im || !im.width) return "#9a8f80";
  const c = document.createElement("canvas"); c.width = 8; c.height = 8; const g = c.getContext("2d"); g.drawImage(im, 0, 0, 8, 8);
  const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  return n ? `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})` : "#9a8f80";
}

/* ---------- personagens low-poly ---------- */
function corAvatar(av) {
  const C = Avatar.CAT, a = Object.assign({}, Avatar.PADRAO, av || {});
  const pele = C.pele.cores[a.pele] || "#d09a6a";
  const cab = a.cabelo && C.cabelo.estilos[a.cabelo.estilo], cabelo = cab && cab.cores ? cab.cores[a.cabelo.cor] || "#4a3022" : null;
  const roupa = (C.cima.estilos[a.cima && a.cima.estilo] || {}).cores, camisa = roupa ? roupa[a.cima.cor] || Object.values(roupa)[0] : "#2f2b2e";
  const bx = (C.baixo.estilos[a.baixo && a.baixo.estilo] || {}).cores, calca = bx ? bx[a.baixo.cor] || Object.values(bx)[0] : "#3d5a8a";
  return { pele, cabelo, camisa: typeof camisa === "string" ? camisa : "#2f2b2e", calca: typeof calca === "string" ? calca : "#3d5a8a" };
}
function personagem(c) {
  const g = new THREE.Group(), p = {};
  p.pernaE = caixaM(0.13, 0.42, 0.14, c.calca, -0.09, 0, 0); p.pernaD = caixaM(0.13, 0.42, 0.14, c.calca, 0.09, 0, 0);
  p.corpo = caixaM(0.4, 0.42, 0.24, c.camisa, 0, 0.42, 0);
  p.bracoE = caixaM(0.1, 0.38, 0.12, c.camisa, -0.26, 0.44, 0); p.bracoD = caixaM(0.1, 0.38, 0.12, c.camisa, 0.26, 0.44, 0);
  p.cabeca = caixaM(0.34, 0.32, 0.3, c.pele, 0, 0.86, 0);
  if (c.cabelo) { p.cabelo = caixaM(0.37, 0.12, 0.33, c.cabelo, 0, 1.12, -0.01); p.nuca = caixaM(0.37, 0.22, 0.08, c.cabelo, 0, 0.92, -0.14); }
  const olho = mat("#1d1d1f"); p.olhoE = caixaM(0.05, 0.06, 0.02, olho, -0.08, 0.98, 0.155, false); p.olhoD = caixaM(0.05, 0.06, 0.02, olho, 0.08, 0.98, 0.155, false);
  for (const k in p) g.add(p[k]);
  for (const k of ["pernaE", "pernaD"]) { p[k].geometry.translate(0, -0.21, 0); p[k].position.y += 0.42; }
  for (const k of ["bracoE", "bracoD"]) { p[k].geometry.translate(0, -0.17, 0); p[k].position.y += 0.36; }
  g.userData.partes = p; return g;
}
function animarAndar(g, t, andando) {
  const p = g.userData.partes, a = andando ? Math.sin(t * 11) * 0.6 : 0;
  p.pernaE.rotation.x = a; p.pernaD.rotation.x = -a; p.bracoE.rotation.x = -a * 0.8; p.bracoD.rotation.x = a * 0.8;
  g.children.forEach(m => { if (m === p.pernaE || m === p.pernaD) return; m.position.y = (m.userData.y0 ??= m.position.y) + (andando ? Math.abs(Math.sin(t * 11)) * 0.03 : 0); });
}

/* ---------- móveis ---------- */
const NA_PAREDE = /^(telao|telao_tend|telao_rot|tv|tv_off|projecao|quadro_branco|quadro_avisos|relogio|logo|placa|claquete|janela)$/;
function movel(it, sala) {
  const a = ASSETS[it.k]; if (!a) return null;
  const k = it.k, w = a.w / T, g = new THREE.Group();
  let prof = Math.max(0.35, Math.min(1.2, Math.min(a.h * 0.45, 26) / T + 0.25));
  const add = m => (g.add(m), m);
  if (/^mesa_pc$|^mesa$/.test(k)) { prof = 1.1; add(caixaM(w - 0.05, 0.07, prof, "#c08850", 0, 0.72, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(caixaM(0.06, 0.72, 0.06, "#6b5a4a", x * (w / 2 - 0.12), 0, z * (prof / 2 - 0.1))); add(caixaM(0.5, 0.4, prof - 0.2, "#a8743f", w / 2 - 0.35, 0.3, 0)); }
  else if (k === "mesa_copa") { prof = 1.4; add(cilindro(0.7, 0.06, "#f2efe8", 0, 0.7, 0, 20)); add(cilindro(0.07, 0.7, "#6b6672", 0, 0, 0)); add(bola(0.09, "#e5484d", -0.2, 0.82, 0.1)); }
  else if (k === "monitor") { prof = 0.3; add(caixaM(0.06, 0.18, 0.06, "#2b2f39", 0, 0.78, 0)); add(caixaM(0.6, 0.36, 0.04, "#1d2028", 0, 0.92, 0)); add(caixaM(0.54, 0.3, 0.01, brilho("#3d7cff", 0.9), 0, 0.95, 0.025, false)); g.userData.sobreMesa = true; }
  else if (k === "gabinete") { prof = 0.45; add(caixaM(0.22, 0.48, 0.42, "#16181f", 0, 0.78, 0)); add(caixaM(0.02, 0.4, 0.3, brilho("#c84bff", 1.6), 0.115, 0.82, 0, false)); g.userData.sobreMesa = true; }
  else if (/^teclado|^mouse$|^notebook$/.test(k)) { prof = 0.25; if (k === "notebook") { add(caixaM(0.5, 0.03, 0.34, "#c9ccd6", 0, 0.79, 0)); add(caixaM(0.5, 0.32, 0.02, "#c9ccd6", 0, 0.8, -0.16)); add(caixaM(0.44, 0.26, 0.01, brilho("#3d7cff", 0.8), 0, 0.83, -0.145, false)); } else add(caixaM(k === "mouse" ? 0.08 : 0.5, 0.03, k === "mouse" ? 0.12 : 0.17, k === "mouse" ? "#2b2f39" : brilho("#ff5ad1", 0.5), 0, 0.79, 0)); g.userData.sobreMesa = true; }
  else if (/^cadeira_/.test(k)) {
    prof = 0.5; const cor = k === "cadeira_plateia" ? "#7a2f3a" : "#3a3f4a";
    add(caixaM(0.48, 0.08, 0.46, cor, 0, 0.42, 0)); add(cilindro(0.04, 0.42, "#2b2f39", 0, 0, 0)); const enc = add(caixaM(0.48, 0.5, 0.07, cor, 0, 0.5, -0.2));
    const rot = { cadeira_baixo: Math.PI, cadeira_cima: 0, cadeira_esq: -Math.PI / 2, cadeira_dir: Math.PI / 2, cadeira_plateia: Math.PI }[k] ?? 0; g.rotation.y = rot; void enc;
  }
  else if (k === "sofa" || k === "poltrona") { prof = 0.9; const cor = k === "sofa" ? "#3f5fd6" : "#e08a3a"; add(caixaM(w - 0.1, 0.36, prof, cor, 0, 0.05, 0)); add(caixaM(w - 0.1, 0.45, 0.2, cor, 0, 0.35, -prof / 2 + 0.1)); add(caixaM(0.18, 0.5, prof, cor, -w / 2 + 0.14, 0.05, 0)); add(caixaM(0.18, 0.5, prof, cor, w / 2 - 0.14, 0.05, 0)); }
  else if (/^planta/.test(k)) { prof = 0.5; const gr = k === "planta_grande"; add(cilindro(0.2, 0.32, "#c96a3a", 0, 0, 0)); add(bola(gr ? 0.42 : 0.3, "#3f9a4a", 0, gr ? 0.85 : 0.6, 0)); add(bola(gr ? 0.3 : 0.2, "#56b85c", 0.12, gr ? 1.15 : 0.82, 0.05)); }
  else if (k === "estante") { prof = 0.45; add(caixaM(w, 1.9, prof, "#8a5a32", 0, 0, 0)); const cores = ["#d0463c", "#3d6fd6", "#e8b83a", "#4e9a5a", "#7d5bc4"]; for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) add(caixaM(w / 7.5, 0.3, 0.05, cores[(r * 3 + i) % 5], -w / 2 + 0.15 + i * w / 6.5, 0.12 + r * 0.45, prof / 2 + 0.01, false)); }
  else if (k === "geladeira") { prof = 0.7; add(caixaM(0.8, 1.8, prof, "#e9ecf2", 0, 0, 0)); add(caixaM(0.04, 0.5, 0.04, "#9aa0ad", 0.3, 1.1, prof / 2 + 0.02)); }
  else if (k === "jukebox" || k === "fliperama") { prof = 0.7; add(caixaM(0.85, 1.6, prof, k === "jukebox" ? "#b8322f" : "#5a3fc4", 0, 0, 0)); add(caixaM(0.6, 0.45, 0.02, brilho(k === "jukebox" ? "#ffd166" : "#2fd4e8", 1.2), 0, 0.95, prof / 2 + 0.01, false)); }
  else if (k === "pingpong") { prof = 1.6; add(caixaM(w - 0.2, 0.06, prof, "#2e8a55", 0, 0.72, 0)); add(caixaM(0.02, 0.15, prof, "#ffffff", 0, 0.78, 0, false)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(caixaM(0.06, 0.72, 0.06, "#2b2f39", x * (w / 2 - 0.3), 0, z * (prof / 2 - 0.15))); }
  else if (k === "tapete") { g.add(caixaM(w, 0.02, a.h / T, "#9c3a3a", 0, 0.1, 0, false)); g.add(caixaM(w * 0.6, 0.025, a.h / T * 0.5, "#e2b04a", 0, 0.1, 0, false)); g.userData.chao = true; prof = a.h / T; }
  else if (k === "rack_servidor") { prof = 0.8; add(caixaM(0.9, 1.9, prof, "#15181f", 0, 0, 0)); for (let i = 0; i < 9; i++) { add(caixaM(0.7, 0.13, 0.01, "#262b36", 0, 0.2 + i * 0.18, prof / 2 + 0.005, false)); add(caixaM(0.05, 0.05, 0.01, brilho(i % 3 ? "#3fbf5f" : "#2fd4e8", 2), 0.28, 0.24 + i * 0.18, prof / 2 + 0.01, false)); } }
  else if (k === "ring_light") { prof = 0.4; add(cilindro(0.03, 1.5, "#2b2f39", 0, 0, 0)); const r = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 24), brilho("#fff6d8", 2)); r.position.set(0, 1.6, 0); add(r); }
  else if (k === "camera_tripe") { prof = 0.5; for (const ang of [0, 2.1, 4.2]) { const l = caixaM(0.03, 1.2, 0.03, "#3b414e", Math.cos(ang) * 0.18, 0, Math.sin(ang) * 0.18); l.rotation.z = Math.cos(ang) * 0.15; l.rotation.x = -Math.sin(ang) * 0.15; add(l); } add(caixaM(0.4, 0.26, 0.3, "#1d2028", 0, 1.2, 0)); add(cilindro(0.08, 0.12, "#15181f", 0, 1.27, 0.2)); }
  else if (k === "pulpito") { prof = 0.6; add(caixaM(0.7, 1.1, 0.5, "#8a5a32", 0, 0, 0)); add(caixaM(0.3, 0.3, 0.01, "#1d1d1f", 0, 0.55, 0.26, false)); }
  else if (k === "f_palco" || k === "palco_frente") { g.add(caixaM(1, 0.3, 1, "#7f3636", 0, 0, 0)); g.userData.chao = true; prof = 1; }
  else if (/^agente_\d$/.test(k) || /^npc_/.test(k)) {
    const cores = ["#2f6fd8", "#7b4fd8", "#1f9e6e", "#d8682f", "#c23a5a", "#e0b030", "#3a3f4a", "#e04fa0"];
    const n = /^agente_(\d)$/.exec(k), cor = n ? cores[(+n[1] - 1) % 8] : k === "npc_robo" ? "#c9ccd6" : "#3d6fd6";
    const p = personagem({ pele: "#2a2f3a", cabelo: cor, camisa: cor, calca: "#2b2f39" }); p.scale.setScalar(0.95); if (n) { p.rotation.y = Math.PI; p.position.y = 0.05; }
    add(p); add(caixaM(0.06, 0.06, 0.06, brilho("#2fd4e8", 2), 0, 1.0, n ? -0.17 : 0.16, false)); prof = 0.5;
  }
  else if (NA_PAREDE.test(k)) {
    const tela = /^(telao|telao_tend|telao_rot|tv|projecao)/.test(k);
    if (tela) {
      const ww = k === "tv" || k === "tv_off" ? 1.3 : Math.min(5.6, w * 0.95), hh = ww * (k === "projecao" ? 0.62 : 0.5);
      const titulo = k === "telao_tend" ? "TENDÊNCIAS DE MERCADO" : k === "telao_rot" ? "ROTEIROS DA EDIÇÃO" : k === "projecao" ? "TELÃO DE PROJEÇÃO" : `TELÃO · ${(sala && sala.name || "").toUpperCase()}`;
      const cor = k === "telao_tend" ? "#13a6b8" : k === "telao_rot" ? "#e04fa0" : "#3d5afe";
      add(caixaM(ww + 0.12, hh + 0.12, 0.08, "#15161d", 0, 0, 0));
      add(new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), k === "tv_off" ? mat("#0b0c10") : telaTexto(titulo, cor))).position.set(0, (hh + 0.12) / 2, 0.045);
      g.userData.alturaParede = 1.15 + hh * 0.2;
    } else if (k === "relogio") { const r = cilindro(0.25, 0.04, "#ffffff", 0, 0, 0, 20); r.rotation.x = Math.PI / 2; r.position.set(0, 0.25, 0.03); add(r); g.userData.alturaParede = 1.7; }
    else { add(caixaM(Math.min(w, 2.6), Math.min(a.h / T, 1.2), 0.05, corMedia(k), 0, 0, 0)); g.userData.alturaParede = 1.25; }
    g.userData.parede = true; prof = 0.1;
  }
  else { // genérico: caixa na cor do desenho 2D
    const h = Math.max(0.3, Math.min(1.6, a.h / T * 0.75)); add(caixaM(Math.max(0.3, w - 0.15), h, Math.min(prof, 0.9), corMedia(k), 0, 0, 0));
  }
  g.userData.prof = prof; return g;
}

/* ---------- montagem do mapa ---------- */
const paredes = [];
const objetos = new THREE.Group(); cena.add(objetos);
function montar() {
  const W = S.w, H = S.h;
  const grama = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshStandardMaterial({ map: (() => { const t = texturaPiso("f_grama"); t.repeat.set((W + 40) / 2, (H + 40) / 2); return t; })(), roughness: 1 }));
  grama.rotation.x = -Math.PI / 2; grama.position.set(W / 2, 0, H / 2); grama.receiveShadow = true; objetos.add(grama);
  const ALT = 2.2, ESP = 0.14;
  for (const r of S.rooms) {
    const tipo = r.floor || TYPES[r.type].floor, tex = texturaPiso(tipo); tex.repeat.set(r.w / 2, r.h / 2);
    const chao = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.08, r.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    chao.position.set(r.x + r.w / 2, 0.04, r.y + r.h / 2); chao.receiveShadow = true; objetos.add(chao);
    if (TOM_SALA[r.type]) { const l = new THREE.PointLight(TOM_SALA[r.type], 6, Math.max(r.w, r.h) * 1.1, 1.6); l.position.set(r.x + r.w / 2, 2.6, r.y + r.h / 2); objetos.add(l); }
    if (TYPES[r.type].noWalls) continue;
    const vidro = TYPES[r.type].glass, dt = doorTile(r), lado = r.door ? r.door.side : "nenhuma";
    const corParede = vidro ? new THREE.MeshStandardMaterial({ color: "#bfe3ff", transparent: true, opacity: 0.35, roughness: 0.1 }) : mat("#efe9dc");
    const lados = [ // [x0,z0,x1,z1, normal(x,z), lado da porta]
      [r.x, r.y, r.x + r.w, r.y, [0, -1], "cima"], [r.x, r.y + r.h, r.x + r.w, r.y + r.h, [0, 1], "baixo"],
      [r.x, r.y, r.x, r.y + r.h, [-1, 0], "esquerda"], [r.x + r.w, r.y, r.x + r.w, r.y + r.h, [1, 0], "direita"]];
    for (const [x0, z0, x1, z1, n, sd] of lados) {
      const horiz = z0 === z1, comp = horiz ? x1 - x0 : z1 - z0, trechos = [];
      if (lado === sd && dt != null) { const p = horiz ? dt - x0 : dt - z0; if (p > 0) trechos.push([0, p]); if (p + 1 < comp) trechos.push([p + 1, comp]); } else trechos.push([0, comp]);
      for (const [a, b] of trechos) {
        const len = b - a, m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : ESP, ALT, horiz ? ESP : len), vidro && sd !== "cima" ? corParede : mat("#efe9dc"));
        m.geometry.translate(0, ALT / 2, 0);
        m.position.set(horiz ? x0 + a + len / 2 : x0, 0, horiz ? z0 : z0 + a + len / 2); m.castShadow = true; m.receiveShadow = true;
        const topo = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : ESP + 0.02, 0.06, horiz ? ESP + 0.02 : len), mat("#3a3346")); topo.position.y = ALT; m.add(topo);
        m.userData.normal = n; objetos.add(m); paredes.push(m);
      }
    }
  }
  // móveis
  for (const it of allItems()) {
    const a = ASSETS[it.k]; if (!a || it.k === "parede") continue;
    const sala = it.room && roomById(it.room);
    const g = movel(it, sala); if (!g) continue;
    const cx = it.x + a.w / T / 2;
    if (g.userData.parede) { const r = sala || roomAt(it.x * T + 16, it.y * T + a.h + 40); g.position.set(cx, g.userData.alturaParede, (r ? r.y : it.y + 2) + 0.09); }
    else if (g.userData.chao) g.position.set(cx, 0.04, it.y + a.h / T / 2);
    else { const base = it.y + a.h / T; g.position.set(cx, g.userData.sobreMesa ? 0 : 0.08, base - g.userData.prof / 2 - 0.05); }
    if (it.rot) g.rotation.y += -it.rot * Math.PI / 180; if (it.flip) g.scale.x *= -1;
    objetos.add(g);
  }
}

/* ---------- luz e câmera ---------- */
cena.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3048, 1.15));
const sol = new THREE.DirectionalLight(0xfff1dc, 1.9); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
cena.add(sol, sol.target);
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
let zoom = innerWidth <= 760 ? 7 : 9, giro = 0, giroAlvo = 0;
const alvo = new THREE.Vector3();
function ajustar() {
  renderer.setSize(innerWidth, innerHeight, false);
  const asp = innerWidth / innerHeight; camera.left = -zoom * asp; camera.right = zoom * asp; camera.top = zoom; camera.bottom = -zoom; camera.updateProjectionMatrix();
}
addEventListener("resize", ajustar);
addEventListener("wheel", e => { zoom = Math.max(4, Math.min(22, zoom * Math.exp(e.deltaY * 0.0012))); ajustar(); }, { passive: true });
$("gEsq").onclick = () => giroAlvo -= Math.PI / 2; $("gDir").onclick = () => giroAlvo += Math.PI / 2;

/* ---------- eu: andar (teclado e clique), com a mesma colisão do 2D ---------- */
let eu = null, euPos = { x: 0, y: 0 }, caminho = null, grid = null, dirAng = 0;
const teclas = new Set();
addEventListener("keydown", e => { if (e.key === "q" || e.key === "Q") giroAlvo -= Math.PI / 2; if (e.key === "e" || e.key === "E") giroAlvo += Math.PI / 2; if (/^(Arrow|w|a|s|d|W|A|S|D)/.test(e.key)) { teclas.add(e.key.toLowerCase()); caminho = null; } });
addEventListener("keyup", e => teclas.delete(e.key.toLowerCase()));
const livre = (x, y) => { for (const [dx, dy] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) if (grid.blocked(Math.floor((x + dx) / C16), Math.floor((y + dy) / C16))) return false; return x > 8 && y > 8 && x < S.w * T - 8 && y < S.h * T - 8; };
const ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
cv.addEventListener("pointerdown", e => {
  const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(v, camera);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plano, p)) return;
  const path = findPath(grid, Math.floor(euPos.x / C16), Math.floor(euPos.y / C16), Math.floor(p.x * T / C16), Math.floor(p.z * T / C16));
  if (path && path.length) caminho = path;
});
function mover(dt) {
  let vx = 0, vy = 0;
  if (teclas.has("arrowup") || teclas.has("w")) vy -= 1; if (teclas.has("arrowdown") || teclas.has("s")) vy += 1;
  if (teclas.has("arrowleft") || teclas.has("a")) vx -= 1; if (teclas.has("arrowright") || teclas.has("d")) vx += 1;
  if (vx || vy) { // relativo à câmera: "cima" é para dentro da tela
    const c = Math.cos(giro), s = Math.sin(giro), ix = (vx - vy) * Math.SQRT1_2, iy = (vx + vy) * Math.SQRT1_2;
    vx = ix * c - iy * s; vy = ix * s + iy * c;
  } else if (caminho && caminho.length) {
    const [tx, ty] = caminho[0], dx = tx - euPos.x, dy = ty - euPos.y, d = Math.hypot(dx, dy);
    if (d < 4) caminho.shift(); else { vx = dx / d; vy = dy / d; }
  }
  const n = Math.hypot(vx, vy), andando = n > 0;
  if (andando) {
    const vel = 115 * dt / n, nx = euPos.x + vx * vel, ny = euPos.y + vy * vel;
    if (livre(nx, euPos.y)) euPos.x = nx; if (livre(euPos.x, ny)) euPos.y = ny;
    dirAng = Math.atan2(vx, vy);
  }
  eu.position.set(euPos.x / T, 0.08, euPos.y / T);
  eu.rotation.y += ((dirAng - eu.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12);
  return andando;
}

/* ---------- rótulos (HTML sobre o 3D) ---------- */
const rotulos = [];
function rotulo(txt, cls, pos3) { const el = document.createElement("div"); el.className = "rotulo " + cls; el.textContent = txt; document.body.appendChild(el); rotulos.push({ el, pos3 }); return el; }
function atualizarRotulos() {
  for (const r of rotulos) {
    const p = (typeof r.pos3 === "function" ? r.pos3() : r.pos3).clone().project(camera);
    const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
    r.el.style.display = vis ? "" : "none"; if (!vis) continue;
    r.el.style.left = ((p.x + 1) / 2 * innerWidth).toFixed(1) + "px"; r.el.style.top = ((1 - p.y) / 2 * innerHeight).toFixed(1) + "px";
  }
}

/* ---------- paredes da frente ficam baixas (corte isométrico) ---------- */
function cortarParedes() {
  const vx = Math.sin(giro + Math.PI / 4), vz = Math.cos(giro + Math.PI / 4); // direção da câmera para a cena (no chão)
  for (const m of paredes) { const [nx, nz] = m.userData.normal, frente = nx * vx + nz * vz > 0.2; const alvoY = frente ? 0.18 : 1; m.scale.y += (alvoY - m.scale.y) * 0.25; }
}

/* ---------- laço ---------- */
let ultimo = performance.now(), tempo = 0;
function quadro(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora; tempo += dt;
  giro += (giroAlvo - giro) * Math.min(1, dt * 8);
  const andando = mover(dt); animarAndar(eu, tempo, andando);
  alvo.lerp(new THREE.Vector3(eu.position.x, 0.6, eu.position.z), Math.min(1, dt * 6));
  const d = 40, ang = giro + Math.PI / 4;
  camera.position.set(alvo.x + Math.sin(ang) * d, alvo.y + d * 0.82, alvo.z + Math.cos(ang) * d); camera.lookAt(alvo);
  sol.position.set(alvo.x + 14, 26, alvo.z + 8); sol.target.position.copy(alvo);
  const sc = sol.shadow.camera, raio = zoom * 2.2; sc.left = -raio; sc.right = raio; sc.top = raio; sc.bottom = -raio; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
  cortarParedes(); camera.updateMatrixWorld(); atualizarRotulos();
  const r = roomAt(euPos.x, euPos.y - 4); $("ondeEstou").textContent = r ? r.name : "Área externa";
  renderer.render(cena, camera);
  requestAnimationFrame(quadro);
}

/* ---------- início ---------- */
async function iniciar() {
  if (!window.__assetsOk && imgsLeft > 0) await new Promise(res => { window.onAssetsReady = res; });
  const email = await Dados.exigirSessao("index.html"); if (!email) return;
  const user = await Dados.getUsuario(email);
  window.S = await Dados.carregarMapa("principal") || templateNext();
  grid = buildBlocked();
  montar();
  eu = personagem(corAvatar(user && user.avatar)); cena.add(eu);
  const pos = user && user.posicao, rec = S.rooms.find(r => r.type === "recepcao") || S.rooms[0];
  euPos = pos && pos.x ? { x: pos.x, y: pos.y } : { x: (rec.x + rec.w / 2) * T, y: (rec.y + rec.h / 2) * T };
  if (!livre(euPos.x, euPos.y)) for (let i = 0; i < 400 && !livre(euPos.x, euPos.y); i++) euPos.x += 8;
  alvo.set(euPos.x / T, 0.6, euPos.y / T);
  rotulo((user && user.nome) || "Você", "eu", () => new THREE.Vector3(eu.position.x, 1.55, eu.position.z));
  for (const r of S.rooms) if (!TYPES[r.type].noWalls) rotulo(r.name, "sala", new THREE.Vector3(r.x + r.w / 2, 2.6, r.y + 0.3));
  ajustar(); $("load").remove(); requestAnimationFrame(quadro);
}
iniciar();
window.__iso = { cena, camera, get euPos() { return euPos; }, set euPos(v) { euPos = v; }, girar: d => giroAlvo += d * Math.PI / 2, renderer };
