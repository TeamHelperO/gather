/* Modo 3D isométrico do escritório (Three.js). É só outra forma de DESENHAR o mesmo escritório:
   a lógica (andar, colisão, áudio, telões, projeção, palco, TI, Edição, sentar, montarias, presença) continua no escritorio.html.
   – Pessoas: o próprio pixel art do avatar (folha 32×48), em pé de frente para a câmera, com a direção certa conforme o giro.
   – Telas (telões, tendências, roteiros, projeção, monitores): textura viva desenhada pelas mesmas funções do 2D.
   – Móveis e salas: low-poly, com luz e sombra.
   API: Iso3D.montar(S) · Iso3D.render(atores, desenhaveis, t, zoom, P) · Iso3D.tela(wx, wy, alturaPx) · Iso3D.mundo(sx, sy)
        Iso3D.escala() · Iso3D.direcaoTeclas(vx, vy) · Iso3D.girar(±1) · Iso3D.ativo */
import * as THREE from "./vendor/three/three.min.js";

const cv = document.getElementById("cv3d");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
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

/* ---------- móveis ---------- */
const NA_PAREDE = /^(telao|telao_tend|telao_rot|tv|tv_off|projecao|quadro_branco|quadro_avisos|relogio|logo|placa|claquete|janela)$/;
function movel(it, sala) {
  const a = ASSETS[it.k]; if (!a) return null;
  const k = it.k, w = a.w / T, g = new THREE.Group();
  let prof = Math.max(0.35, Math.min(1.2, Math.min(a.h * 0.45, 26) / T + 0.25));
  const add = m => (g.add(m), m);
  if (/^mesa_pc$|^mesa$/.test(k)) { prof = 1.1; add(caixaM(w - 0.05, 0.07, prof, "#c08850", 0, 0.72, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(caixaM(0.06, 0.72, 0.06, "#6b5a4a", x * (w / 2 - 0.12), 0, z * (prof / 2 - 0.1))); add(caixaM(0.5, 0.4, prof - 0.2, "#a8743f", w / 2 - 0.35, 0.3, 0)); }
  else if (k === "mesa_copa") { prof = 1.4; add(cilindro(0.7, 0.06, "#f2efe8", 0, 0.7, 0, 20)); add(cilindro(0.07, 0.7, "#6b6672", 0, 0, 0)); add(bola(0.09, "#e5484d", -0.2, 0.82, 0.1)); }
  else if (k === "monitor") { prof = 0.3; add(caixaM(0.06, 0.18, 0.06, "#2b2f39", 0, 0.78, 0)); add(caixaM(0.6, 0.38, 0.04, "#1d2028", 0, 0.92, 0)); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), materialTela(it, TELAS.monitor)); pl.position.set(0, 1.11, 0.025); add(pl); g.userData.sobreMesa = true; }
  else if (k === "gabinete") { prof = 0.45; add(caixaM(0.22, 0.48, 0.42, "#16181f", 0, 0.78, 0)); add(caixaM(0.02, 0.4, 0.3, brilho("#c84bff", 1.6), 0.115, 0.82, 0, false)); g.userData.sobreMesa = true; }
  else if (/^teclado|^mouse$|^notebook$/.test(k)) { prof = 0.25; if (k === "notebook") { add(caixaM(0.5, 0.03, 0.34, "#c9ccd6", 0, 0.79, 0)); add(caixaM(0.5, 0.32, 0.02, "#c9ccd6", 0, 0.8, -0.16)); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), materialTela(it, TELAS.notebook)); pl.position.set(0, 0.97, -0.145); add(pl); } else add(caixaM(k === "mouse" ? 0.08 : 0.5, 0.03, k === "mouse" ? 0.12 : 0.17, k === "mouse" ? "#2b2f39" : brilho("#ff5ad1", 0.5), 0, 0.79, 0)); g.userData.sobreMesa = true; }
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
  else if (/^agente_\d$/.test(k) || /^npc_/.test(k) || k === "pet") { // pixel art em pé, sempre de frente para a câmera
    const sp = spriteDe(IMG[k], a.w, a.h); add(sp); g.userData.billboard = true; prof = 0.4;
  }
  else if (NA_PAREDE.test(k)) {
    const tela = /^(telao|telao_tend|telao_rot|tv|projecao)/.test(k);
    if (tela) {
      const ww = a.w / T, hh = a.h / T;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), materialTela(it)); pl.position.set(0, hh / 2, 0.05); add(pl);
      add(caixaM(ww * 0.98, hh * 0.9, 0.06, "#15161d", 0, hh * 0.05, 0));
      g.userData.alturaParede = 0.75;
    } else if (k === "relogio") { const r = cilindro(0.25, 0.04, "#ffffff", 0, 0, 0, 20); r.rotation.x = Math.PI / 2; r.position.set(0, 0.25, 0.03); add(r); g.userData.alturaParede = 1.7; }
    else { add(caixaM(Math.min(w, 2.6), Math.min(a.h / T, 1.2), 0.05, corMedia(k), 0, 0, 0)); g.userData.alturaParede = 1.25; }
    g.userData.parede = true; prof = 0.1;
  }
  else { // genérico: caixa na cor do desenho 2D
    const h = Math.max(0.3, Math.min(1.6, a.h / T * 0.75)); add(caixaM(Math.max(0.3, w - 0.15), h, Math.min(prof, 0.9), corMedia(k), 0, 0, 0));
  }
  g.userData.prof = prof; return g;
}


/* ---------- texturas vivas: o 2D desenha, o 3D mostra ---------- */
const telas = []; // { it, c, g, tex }
function materialTela(it, recorte) {
  const a = ASSETS[it.k], c = document.createElement("canvas"); c.width = a.w; c.height = a.h;
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
  if (recorte) { const [x, y, w, h] = recorte; tex.offset.set(x / a.w, 1 - (y + h) / a.h); tex.repeat.set(w / a.w, h / a.h); }
  telas.push({ it, c, g: c.getContext("2d"), tex });
  return new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.75, roughness: 0.6 });
}
function spriteDe(img, w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 })); sp.center.set(0.5, 0.02); sp.scale.set(w / T, h / T, 1); return sp;
}
let ultimaTela = 0;
function atualizarTelas(desenhaveis, agora, rapido) {
  const todas = agora - ultimaTela >= 500; if (todas) ultimaTela = agora;
  for (const s of telas) {
    if (!todas && !(rapido && s.it.k === "projecao")) continue;
    const { it, c, g } = s, a = ASSETS[it.k];
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.setTransform(1, 0, 0, 1, -it.x * T, -it.y * T); g.imageSmoothingEnabled = false;
    g.drawImage(IMG[it.k], it.x * T, it.y * T);
    for (const d of desenhaveis) { try { d.draw(g); } catch (e) {} }
    s.tex.needsUpdate = true; void a;
  }
}

/* ---------- montagem ---------- */
const paredes = [], cartazes = []; // cartazes: agentes, NPCs e pets em pixel art
let objetos = null;
function montar(S) {
  if (objetos) { cena.remove(objetos); objetos.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  objetos = new THREE.Group(); cena.add(objetos); cartazes.length = 0; paredes.length = 0; telas.length = 0; escuros.clear();
  const W = S.w, H = S.h;
  const tg = texturaPiso("f_grama"); tg.repeat.set((W + 40) / 2, (H + 40) / 2);
  const grama = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshStandardMaterial({ map: tg, roughness: 1 }));
  grama.rotation.x = -Math.PI / 2; grama.position.set(W / 2, 0, H / 2); grama.receiveShadow = true; objetos.add(grama);
  const ALT = 2.4, ESP = 0.14;
  for (const r of S.rooms) {
    const tipo = r.floor || TYPES[r.type].floor, tex = texturaPiso(tipo); tex.repeat.set(r.w / 2, r.h / 2);
    const chao = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.08, r.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    chao.position.set(r.x + r.w / 2, 0.04, r.y + r.h / 2); chao.receiveShadow = true; objetos.add(chao);
    if (TOM_SALA[r.type]) { // tom de luz da sala sem custo de luz extra: um brilho suave no piso
      const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), cor = "#" + TOM_SALA[r.type].toString(16).padStart(6, "0");
      const rg = g.createRadialGradient(32, 26, 0, 32, 32, 34); rg.addColorStop(0, cor + "55"); rg.addColorStop(1, cor + "00"); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      const tx = new THREE.CanvasTexture(c); const luz = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      luz.rotation.x = -Math.PI / 2; luz.position.set(r.x + r.w / 2, 0.095, r.y + r.h / 2); objetos.add(luz);
      escuros.set(r.id, { brilho: luz });
    }
    if (!TYPES[r.type].noWalls) { // "teto" escuro, ligado quando a luz da sala está apagada
      const sombra = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.MeshBasicMaterial({ color: 0x060816, transparent: true, opacity: 0.66, depthWrite: false }));
      sombra.rotation.x = -Math.PI / 2; sombra.position.set(r.x + r.w / 2, ALT + 0.03, r.y + r.h / 2); sombra.renderOrder = 10; sombra.visible = false;
      sombra.matrixAutoUpdate = true; objetos.add(sombra);
      escuros.set(r.id, { ...(escuros.get(r.id) || {}), sombra });
    }
    if (TYPES[r.type].noWalls) continue;
    const vidro = TYPES[r.type].glass, dt = doorTile(r), lado = r.door ? r.door.side : "nenhuma";
    const matVidro = new THREE.MeshStandardMaterial({ color: "#bfe3ff", transparent: true, opacity: 0.35, roughness: 0.1 });
    const lados = [[r.x, r.y, r.x + r.w, r.y, [0, -1], "cima"], [r.x, r.y + r.h, r.x + r.w, r.y + r.h, [0, 1], "baixo"],
      [r.x, r.y, r.x, r.y + r.h, [-1, 0], "esquerda"], [r.x + r.w, r.y, r.x + r.w, r.y + r.h, [1, 0], "direita"]];
    for (const [x0, z0, x1, z1, n, sd] of lados) {
      const horiz = z0 === z1, comp = horiz ? x1 - x0 : z1 - z0, trechos = [];
      if (lado === sd && dt != null) { const p = horiz ? dt - x0 : dt - z0; if (p > 0) trechos.push([0, p]); if (p + 1 < comp) trechos.push([p + 1, comp]); } else trechos.push([0, comp]);
      for (const [a, b] of trechos) {
        const len = b - a, m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : ESP, ALT, horiz ? ESP : len), vidro && sd !== "cima" ? matVidro : mat("#efe9dc"));
        m.geometry.translate(0, ALT / 2, 0);
        m.position.set(horiz ? x0 + a + len / 2 : x0, 0, horiz ? z0 : z0 + a + len / 2); m.castShadow = true; m.receiveShadow = true;
        const topo = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : ESP + 0.02, 0.06, horiz ? ESP + 0.02 : len), mat("#3a3346")); topo.position.y = ALT; m.add(topo);
        m.userData.normal = n; objetos.add(m); paredes.push(m);
      }
    }
  }
  for (const it of allItems()) {
    const a = ASSETS[it.k]; if (!a || it.k === "parede") continue;
    const sala = it.room && roomById(it.room);
    const g = movel(it, sala); if (!g) continue;
    const cx = it.x + a.w / T / 2;
    if (g.userData.parede) { const r = sala || roomAt(it.x * T + 16, it.y * T + a.h + 40); g.position.set(cx, g.userData.alturaParede, (r ? r.y : it.y + 2) + 0.09); }
    else if (g.userData.chao) g.position.set(cx, 0.04, it.y + a.h / T / 2);
    else if (g.userData.billboard) { g.position.set(cx, 0.06, it.y + a.h / T - 0.1); cartazes.push(g); }
    else { const base = it.y + a.h / T; g.position.set(cx, g.userData.sobreMesa ? 0 : 0.08, base - g.userData.prof / 2 - 0.05); }
    if (it.rot) g.rotation.y += -it.rot * Math.PI / 180; if (it.flip) g.scale.x *= -1;
    g.traverse(o => { o.userData.item = it; });
    objetos.add(g);
  }
  const caixaTmp = new THREE.Box3(), tam = new THREE.Vector3();
  objetos.updateMatrixWorld(true);
  objetos.traverse(o => {
    if (paredes.includes(o) || o.parent && paredes.includes(o.parent) || o.isSprite) return;
    if (o.isMesh && o.castShadow) { caixaTmp.setFromObject(o).getSize(tam); if (Math.max(tam.x, tam.y, tam.z) < 0.45) o.castShadow = false; }
    o.matrixAutoUpdate = false; o.updateMatrix();
  });
}

/* ---------- luz e câmera ---------- */
const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3048, 1.15); cena.add(hemi);
const sol = new THREE.DirectionalLight(0xfff1dc, 1.9); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
cena.add(sol, sol.target);
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
/* primeira pessoa: câmera nos olhos do seu personagem (padrão do 3D); "iso" = visão de cima */
const camFP = new THREE.PerspectiveCamera(70, 1, 0.05, 300);
let vista = (() => { try { return localStorage.getItem("nextco_vista3d") || "1p"; } catch (e) { return "1p"; } })();
let yaw = null, pitch = -0.04, eu = null;
const fp = () => vista === "1p";
const camAtual = () => (fp() ? camFP : camera);
const CEU = new THREE.Color("#a9cdf0"), FUNDO = new THREE.Color("#1b1828");
let giro = 0, giroAlvo = 0, meia = 9, VW = innerWidth, VH = innerHeight;
const alvo = new THREE.Vector3(); let alvoPronto = false;
let tamanho = "";
function ajustar() {
  VW = innerWidth; VH = innerHeight;
  const k = VW + "x" + VH + "@" + renderer.getPixelRatio(); if (k !== tamanho) { tamanho = k; renderer.setSize(VW, VH, false); }
  const asp = VW / VH; camFP.aspect = asp; camFP.updateProjectionMatrix(); camera.left = -meia * asp; camera.right = meia * asp; camera.top = meia; camera.bottom = -meia; camera.updateProjectionMatrix();
}
addEventListener("resize", ajustar);
const angulo = () => (fp() && yaw != null ? yaw : giro + Math.PI / 4);

/* ---------- pessoas: pixel art do avatar como "cartaz" de frente para a câmera ---------- */
const pessoas = new Map(); // ator → { sp, c, g, tex }
function spriteDaPessoa(a) {
  let s = pessoas.get(a); if (s) return s;
  const c = document.createElement("canvas"); c.width = 64; c.height = 80;
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.4 }));
  sp.center.set(0.5, 12 / 80); sp.scale.set(64 / T, 80 / T, 1); sp.renderOrder = 2; sp.userData.ator = a;
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshBasicMaterial({ color: 0x140f1e, transparent: true, opacity: 0.28, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  cena.add(sp, sombra);
  s = { sp, c, g: c.getContext("2d"), tex, sombra }; pessoas.set(a, s); return s;
}
// direção do mundo (0 baixo, 1 esquerda, 2 direita, 3 cima) → direção vista pela câmera
const VET = [[0, 1], [-1, 0], [1, 0], [0, -1]];
function direcaoVista(d) {
  const [vx, vz] = VET[d] || VET[0], f = angulo(), fx = -Math.sin(f), fz = -Math.cos(f), rx = Math.cos(f), rz = -Math.sin(f);
  const sx = vx * rx + vz * rz, sd = -(vx * fx + vz * fz);
  return Math.abs(sx) > Math.abs(sd) ? (sx < 0 ? 1 : 2) : (sd > 0 ? 0 : 3);
}
function desenharPessoa(a, t) {
  const s = spriteDaPessoa(a), g = s.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 64, 80); g.imageSmoothingEnabled = false;
  g.setTransform(1, 0, 0, 1, 32 - Math.round(a.px), 68 - Math.round(a.py));
  const d = a.dir; if (!a.assento) a.dir = direcaoVista(d);
  try { a.draw(g, t); } finally { a.dir = d; }
  s.tex.needsUpdate = true;
  s.sp.position.set(a.px / T, a.assento ? 0.12 : 0.08, a.py / T);
  s.sombra.position.set(a.px / T, 0.1, a.py / T); s.sombra.visible = !a.assento;
}

/* ---------- paredes da frente ficam baixas (corte isométrico) ---------- */
function cortarParedes() {
  if (fp()) { for (const m of paredes) m.scale.y = 1; return; }
  const vx = Math.sin(angulo()), vz = Math.cos(angulo());
  for (const m of paredes) { const [nx, nz] = m.userData.normal, frente = nx * vx + nz * vz > 0.2; const y = frente ? 0.16 : 1; m.scale.y += (y - m.scale.y) * 0.25; }
}

/* ---------- qualidade adaptativa ---------- */
let somaDt = 0, nDt = 0, nivel = 0;
function medirDesempenho(dt) {
  if (!dt) return; somaDt += dt; nDt++;
  if (nDt < 90) return;
  const media = somaDt / nDt; somaDt = 0; nDt = 0;
  if (media > 1 / 40 && nivel < 2) { // abaixo de ~40 qps
    nivel++;
    if (nivel === 1) { renderer.setPixelRatio(1); tamanho = ""; ajustar(); }
    if (nivel === 2) { renderer.shadowMap.enabled = false; cena.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
    console.info("3D: qualidade reduzida para manter a fluidez (nível " + nivel + ")");
  }
}

/* ---------- API para o escritório ---------- */
let ativo = false, montadoPara = null;
const escuros = new Map(); // sala → { brilho, sombra }
let apagadaFn = null;
const Iso3D = {
  get ativo() { return ativo; },
  ligar(sim, S) { ativo = !!sim; cv.style.display = ativo ? "block" : "none"; if (ativo) { if (montadoPara !== S) { montar(S); montadoPara = S; } ajustar(); } },
  montar(S) { montar(S); montadoPara = S; },
  luzes(apagada) {
    apagadaFn = apagada;
    for (const [id, e] of escuros) { const off = apagada(id); if (e.sombra && e.sombra.visible !== off) e.sombra.visible = off; if (e.brilho && e.brilho.visible === off) e.brilho.visible = !off; }
  },
  girar(d) { if (fp()) { if (yaw != null) yaw -= d * Math.PI / 4; return; } giroAlvo += d * Math.PI / 2; },
  // teclas/joystick: "cima" é para dentro da tela, conforme o giro da câmera
  direcaoTeclas(vx, vy) {
    if (!vx && !vy) return [0, 0];
    if (fp() && yaw != null) { // frente/trás na direção do olhar, lados = andar de lado
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), f = -vy, l = vx;
      return [f * fx + l * rx, f * fz + l * rz];
    }
    const c = Math.cos(giro), s = Math.sin(giro), ix = (vx - vy) * Math.SQRT1_2, iy = (vx + vy) * Math.SQRT1_2;
    return [ix * c - iy * s, ix * s + iy * c];
  },
  render(atores, desenhaveis, t, zoom, P, dt) {
    if (!ativo) return;
    medirDesempenho(dt);
    const m = 11.5 / Math.max(0.6, zoom); if (m !== meia) { meia = m; ajustar(); }
    giro += (giroAlvo - giro) * Math.min(1, (dt || 0.016) * 8);
    eu = P;
    const foco = new THREE.Vector3(P.px / T, 0.6, P.py / T);
    if (!alvoPronto) { alvo.copy(foco); alvoPronto = true; } else alvo.lerp(foco, Math.min(1, (dt || 0.016) * (fp() ? 30 : 6)));
    if (fp()) {
      if (yaw == null) yaw = [Math.PI, Math.PI / 2, -Math.PI / 2, 0][P.dir || 0];
      const fov = Math.max(42, Math.min(88, 70 / Math.pow(Math.max(0.6, zoom) / 1.4, 0.35)));
      if (Math.abs(camFP.fov - fov) > 0.3) { camFP.fov = fov; camFP.updateProjectionMatrix(); }
      const olho = P.assento ? 1.18 : 1.55;
      camFP.position.set(alvo.x, olho, alvo.z);
      camFP.lookAt(alvo.x - Math.sin(yaw) * Math.cos(pitch), olho + Math.sin(pitch), alvo.z - Math.cos(yaw) * Math.cos(pitch)); camFP.updateMatrixWorld();
      // luz apagada na sala em que você está: o ambiente escurece, só as telas brilham
      const r = window.roomAt && roomAt(P.px, P.py - 4), escuro = !!(r && apagadaFn && apagadaFn(r.id));
      hemi.intensity = escuro ? 0.12 : 1.55; sol.intensity = escuro ? 0.1 : 1.9;
      cena.background = escuro ? FUNDO : CEU;
    } else {
      hemi.intensity = 1.15; sol.intensity = 1.9; cena.background = FUNDO;
      const d = 40, ang = angulo();
      camera.position.set(alvo.x + Math.sin(ang) * d, alvo.y + d * 0.82, alvo.z + Math.cos(ang) * d); camera.lookAt(alvo); camera.updateMatrixWorld();
    }
    sol.position.set(alvo.x + 14, 26, alvo.z + 8); sol.target.position.copy(alvo);
    const sc = sol.shadow.camera, raio = fp() ? 16 : meia * 2.2; sc.left = -raio; sc.right = raio; sc.top = raio; sc.bottom = -raio; sc.near = 1; sc.far = 90; sc.updateProjectionMatrix();
    const vivos = new Set(atores);
    for (const [a, s] of pessoas) if (!vivos.has(a)) { cena.remove(s.sp, s.sombra); s.tex.dispose(); pessoas.delete(a); }
    const perto = (x, z) => fp() && Math.hypot(x - alvo.x, z - alvo.z) < 1.4; // na 1ª pessoa, quem está colado na câmera some para não tapar a vista
    for (const a of atores) { desenharPessoa(a, t); const s = pessoas.get(a), some = fp() && (a === P || perto(a.px / T, a.py / T)); s.sp.visible = !some; if (some) s.sombra.visible = false; }
    for (const g of cartazes) { const v = !perto(g.position.x, g.position.z); if (g.visible !== v) g.visible = v; }
    const temVideo = window.Projecao && (Projecao.apresentando || document.querySelector("video[autoplay]"));
    atualizarTelas(desenhaveis, performance.now(), !!temVideo);
    cortarParedes();
    renderer.render(cena, camAtual());
  },
  // mundo (px do 2D, altura em px acima do chão) → tela (px CSS)
  tela(wx, wy, h = 0) {
    const v = new THREE.Vector3(wx / T, 0.08 + h / T, wy / T).project(camAtual());
    if (v.z > 1 || v.z < -1) return [-1e4, -1e4]; // atrás da câmera
    return [(v.x + 1) / 2 * VW, (1 - v.y) / 2 * VH];
  },
  escala() { return VH / (2 * meia) / T; },
  // px de tela por px do mundo num ponto (na primeira pessoa depende da distância)
  escalaEm(wx, wy) {
    if (!fp()) return this.escala();
    const a = this.tela(wx, wy, 0), b = this.tela(wx, wy, T); if (a[0] < -9e3 || b[0] < -9e3) return 0;
    return Math.hypot(a[0] - b[0], a[1] - b[1]) / T;
  },
  get primeiraPessoa() { return ativo && fp(); },
  get vista() { return vista; },
  trocarVista(v) { vista = v || (fp() ? "iso" : "1p"); if (fp() && eu) this.olharPara(eu.dir); try { localStorage.setItem("nextco_vista3d", vista); } catch (e) {} if (!fp()) for (const [, s] of pessoas) s.sp.visible = true; return vista; },
  virar(rad) { if (yaw != null) yaw += rad; },
  olharPara(dir) { yaw = [Math.PI, Math.PI / 2, -Math.PI / 2, 0][dir || 0]; pitch = -0.04; },
  inclinar(rad) { pitch = Math.max(-0.75, Math.min(0.6, pitch + rad)); },
  // para onde você está olhando, como direção do 2D (0 baixo, 1 esquerda, 2 direita, 3 cima)
  direcaoDoOlhar() { if (yaw == null) return 0; const fx = -Math.sin(yaw), fz = -Math.cos(yaw); return Math.abs(fx) > Math.abs(fz) ? (fx < 0 ? 1 : 2) : (fz < 0 ? 3 : 0); }, // px de tela por px do mundo (em objetos de frente para a câmera)
  // tela → mundo: o que está sob o dedo (telão, monitor, pessoa) ou o ponto do chão
  mundo(sx, sy) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(sx / VW * 2 - 1, -(sy / VH) * 2 + 1), camAtual());
    const alvos = [...[...pessoas].filter(([a]) => !(fp() && a === eu)).map(([, s]) => s.sp), ...(objetos ? objetos.children : [])];
    for (const h of ray.intersectObjects(alvos, true)) {
      const o = h.object;
      if (o.userData.ator) { const a = o.userData.ator; return [a.px, a.py - 14]; }
      const it = o.userData.item; if (!it) continue;
      if (/^(telao|telao_tend|telao_rot|projecao|tv|monitor|notebook|rack_servidor)$/.test(it.k) || /^agente_/.test(it.k)) {
        const a = ASSETS[it.k]; return [it.x * T + a.w / 2, it.y * T + Math.min(a.h / 2, 30)];
      }
      break;
    }
    const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08), p)) return [-1, -1];
    return [p.x * T, p.z * T];
  },
};
window.Iso3D = Iso3D;
window.dispatchEvent(new Event("iso3d-pronto"));
