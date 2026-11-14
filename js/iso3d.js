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
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
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
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.anisotropy = ANISO; t.colorSpace = THREE.SRGBColorSpace; return t;
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
  // sino e cafeteira ficam em cima de uma mesa; se não houver mesa embaixo, ganham um balcãozinho
  const semMesa = () => { const cx = it.x * T + a.w / 2, cy = it.y * T + a.h - 4; return !allItems().some(m => m !== it && /^(mesa|balcao)/.test(m.k) && ASSETS[m.k] && cx > m.x * T && cx < m.x * T + ASSETS[m.k].w && cy > m.y * T - 8 && cy < m.y * T + ASSETS[m.k].h + 4); };
  if ((k === "sino" || k === "cafeteira") && semMesa()) add(caixaM(0.5, 0.74, 0.45, "#e9e4da", 0, 0, 0));
  if (/^mesa_pc$|^mesa$/.test(k)) { prof = 1.1; add(caixaM(w - 0.05, 0.07, prof, "#c08850", 0, 0.72, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(caixaM(0.06, 0.72, 0.06, "#6b5a4a", x * (w / 2 - 0.12), 0, z * (prof / 2 - 0.1))); add(caixaM(0.5, 0.4, prof - 0.2, "#a8743f", w / 2 - 0.35, 0.3, 0)); }
  else if (k === "mesa_copa") { prof = 1.4; add(cilindro(0.7, 0.06, "#f2efe8", 0, 0.7, 0, 20)); add(cilindro(0.07, 0.7, "#6b6672", 0, 0, 0)); add(bola(0.09, "#e5484d", -0.2, 0.82, 0.1)); }
  else if (k === "monitor") { prof = 0.3; add(caixaM(0.22, 0.02, 0.16, "#2b2f39", 0, 0.79, 0)); add(caixaM(0.06, 0.2, 0.05, "#2b2f39", 0, 0.8, -0.03)); add(caixaM(0.78, 0.47, 0.04, "#1d2028", 0, 0.96, 0)); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.73, 0.42), materialTela(it, TELAS.monitor)); pl.position.set(0, 1.195, 0.025); add(pl); g.userData.sobreMesa = true; }
  else if (k === "gabinete") { prof = 0.5; add(caixaM(0.24, 0.52, 0.48, "#16181f", 0, 0.79, 0)); add(caixaM(0.02, 0.44, 0.36, brilho("#c84bff", 1.6), 0.125, 0.83, 0, false)); g.userData.sobreMesa = true; }
  else if (/^teclado|^mouse$|^notebook$/.test(k)) { prof = 0.25; if (k === "notebook") { add(caixaM(0.5, 0.03, 0.34, "#c9ccd6", 0, 0.79, 0)); add(caixaM(0.5, 0.32, 0.02, "#c9ccd6", 0, 0.8, -0.16)); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), materialTela(it, TELAS.notebook)); pl.position.set(0, 0.97, -0.145); add(pl); } else add(caixaM(k === "mouse" ? 0.08 : 0.5, 0.03, k === "mouse" ? 0.12 : 0.17, k === "mouse" ? "#2b2f39" : brilho("#ff5ad1", 0.5), 0, 0.79, 0)); g.userData.sobreMesa = true; }
  else if (/^cadeira_/.test(k)) {
    prof = 0.5; const cor = k === "cadeira_plateia" ? "#7a2f3a" : "#3a3f4a";
    add(caixaM(0.48, 0.08, 0.46, cor, 0, 0.42, 0)); add(cilindro(0.04, 0.42, "#2b2f39", 0, 0, 0)); const enc = add(caixaM(0.48, 0.5, 0.07, cor, 0, 0.5, -0.2));
    const rot = { cadeira_baixo: 0, cadeira_cima: Math.PI, cadeira_esq: -Math.PI / 2, cadeira_dir: Math.PI / 2, cadeira_plateia: Math.PI }[k] ?? 0; g.rotation.y = rot; void enc;
  }
  else if (k === "sofa" || k === "poltrona") { prof = 0.9; const cor = k === "sofa" ? "#3f5fd6" : "#e08a3a"; add(caixaM(w - 0.1, 0.36, prof, cor, 0, 0.05, 0)); add(caixaM(w - 0.1, 0.45, 0.2, cor, 0, 0.35, -prof / 2 + 0.1)); add(caixaM(0.18, 0.5, prof, cor, -w / 2 + 0.14, 0.05, 0)); add(caixaM(0.18, 0.5, prof, cor, w / 2 - 0.14, 0.05, 0));
    const f = typeof frenteDoEstofado === "function" ? frenteDoEstofado(it) : null; // encostado na parede: de costas para ela
    if (f != null) g.rotation.y = { 0: 0, 3: Math.PI, 2: Math.PI / 2, 1: -Math.PI / 2 }[f]; }
  else if (/^planta/.test(k)) { prof = 0.5; const gr = k === "planta_grande"; add(cilindro(0.2, 0.32, "#c96a3a", 0, 0, 0)); add(bola(gr ? 0.42 : 0.3, "#3f9a4a", 0, gr ? 0.85 : 0.6, 0)); add(bola(gr ? 0.3 : 0.2, "#56b85c", 0.12, gr ? 1.15 : 0.82, 0.05)); }
  else if (k === "estante") { prof = 0.45; add(caixaM(w, 1.9, prof, "#8a5a32", 0, 0, 0)); const cores = ["#d0463c", "#3d6fd6", "#e8b83a", "#4e9a5a", "#7d5bc4"]; for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) add(caixaM(w / 7.5, 0.3, 0.05, cores[(r * 3 + i) % 5], -w / 2 + 0.15 + i * w / 6.5, 0.12 + r * 0.45, prof / 2 + 0.01, false)); }
  else if (k === "geladeira") { prof = 0.7; add(caixaM(0.8, 1.8, prof, "#e9ecf2", 0, 0, 0)); add(caixaM(0.04, 0.5, 0.04, "#9aa0ad", 0.3, 1.1, prof / 2 + 0.02)); }
  else if (k === "jukebox" || k === "fliperama") { prof = 0.7; add(caixaM(0.85, 1.6, prof, k === "jukebox" ? "#b8322f" : "#5a3fc4", 0, 0, 0)); add(caixaM(0.6, 0.45, 0.02, brilho(k === "jukebox" ? "#ffd166" : "#2fd4e8", 1.2), 0, 0.95, prof / 2 + 0.01, false)); }
  else if (k === "pingpong") { prof = 1.6; add(caixaM(w - 0.2, 0.06, prof, "#2e8a55", 0, 0.72, 0)); add(caixaM(0.02, 0.15, prof, "#ffffff", 0, 0.78, 0, false)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(caixaM(0.06, 0.72, 0.06, "#2b2f39", x * (w / 2 - 0.3), 0, z * (prof / 2 - 0.15))); }
  else if (k === "tapete") { g.add(caixaM(w, 0.02, a.h / T, "#9c3a3a", 0, 0.1, 0, false)); g.add(caixaM(w * 0.6, 0.025, a.h / T * 0.5, "#e2b04a", 0, 0.1, 0, false)); g.userData.chao = true; prof = a.h / T; }
  else if (k === "rack_servidor") { prof = 0.8; add(caixaM(0.9, 1.9, prof, "#15181f", 0, 0, 0)); for (let i = 0; i < 9; i++) { add(caixaM(0.7, 0.13, 0.01, "#262b36", 0, 0.2 + i * 0.18, prof / 2 + 0.005, false)); add(caixaM(0.05, 0.05, 0.01, brilho(i % 3 ? "#3fbf5f" : "#2fd4e8", 2), 0.28, 0.24 + i * 0.18, prof / 2 + 0.01, false)); } }
  else if (k === "maquina_cafe") { prof = 0.6; add(caixaM(0.82, 1.75, prof, "#2c313c", 0, 0, 0)); add(caixaM(0.5, 0.26, 0.02, brilho("#e8c27a", 0.9), 0, 1.3, prof / 2 + 0.01, false));
    add(caixaM(0.52, 0.5, 0.2, "#0d1015", 0, 0.62, prof / 2 - 0.08, false)); add(cilindro(0.07, 0.12, "#f2efe8", 0, 0.7, prof / 2 - 0.05)); for (const [x, c] of [[-0.18, "#d9772e"], [0, "#3fbf5f"], [0.18, "#2fd4e8"]]) add(caixaM(0.1, 0.08, 0.02, brilho(c, 1.2), x, 1.12, prof / 2 + 0.01, false)); }
  else if (k === "bebedouro") { prof = 0.45; add(caixaM(0.42, 0.95, 0.4, "#e9ecf2", 0, 0, 0)); add(cilindro(0.17, 0.42, mat("#8fd0ff", { transparent: true, opacity: 0.7, roughness: 0.1 }), 0, 0.95, 0, 16)); add(caixaM(0.06, 0.04, 0.06, "#3d6fd6", -0.08, 0.7, 0.22, false)); add(caixaM(0.06, 0.04, 0.06, "#e5484d", 0.08, 0.7, 0.22, false)); }
  else if (k === "ring_light") { prof = 0.4; add(cilindro(0.03, 1.5, "#2b2f39", 0, 0, 0)); const r = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 24), brilho("#fff6d8", 2)); r.position.set(0, 1.6, 0); add(r); }
  else if (k === "camera_tripe") { prof = 0.5; for (const ang of [0, 2.1, 4.2]) { const l = caixaM(0.03, 1.2, 0.03, "#3b414e", Math.cos(ang) * 0.18, 0, Math.sin(ang) * 0.18); l.rotation.z = Math.cos(ang) * 0.15; l.rotation.x = -Math.sin(ang) * 0.15; add(l); } add(caixaM(0.4, 0.26, 0.3, "#1d2028", 0, 1.2, 0)); add(cilindro(0.08, 0.12, "#15181f", 0, 1.27, 0.2)); }
  else if (/^mesa_reuniao/.test(k)) { prof = Math.max(1, a.h / T * 0.75); add(caixaM(w - 0.2, 0.07, prof, "#8a5a32", 0, 0.72, 0)); for (const x of [-1, 1]) add(caixaM(0.12, 0.72, prof * 0.6, "#4a3828", x * (w / 2 - 0.5), 0, 0)); }
  else if (k === "relogio_ponto") { prof = 0.35; add(caixaM(0.08, 1.15, 0.08, "#2b2f39", 0, 0, 0)); add(caixaM(0.32, 0.4, 0.12, "#1d2028", 0, 1.1, 0)); add(caixaM(0.24, 0.16, 0.01, brilho("#3fbf5f", 1.3), 0, 1.3, 0.065, false)); }
  else if (k === "sino") { prof = 0.2; add(cilindro(0.07, 0.08, "#e8b83a", 0, 0.74, 0)); add(bola(0.03, "#e8b83a", 0, 0.85, 0)); g.userData.sobreMesa = true; }
  else if (k === "cafeteira") { prof = 0.3; add(caixaM(0.25, 0.35, 0.25, "#2c313c", 0, 0.74, 0)); add(cilindro(0.05, 0.08, "#f2efe8", 0, 0.76, 0.06)); g.userData.sobreMesa = true; }
  else if (k === "caixa_som") { prof = 0.45; add(caixaM(0.5, 1.1, 0.42, "#1d2028", 0, 0, 0)); add(cilindro(0.15, 0.02, "#3b414e", 0, 0.35, 0.215)); add(cilindro(0.08, 0.02, "#3b414e", 0, 0.8, 0.215)); }
  else if (k === "megafone") { prof = 0.3; add(cilindro(0.03, 1.0, "#2b2f39", 0, 0, 0)); add(caixaM(0.2, 0.18, 0.3, "#e5484d", 0, 1.0, 0)); }
  else if (k === "pufe") { prof = 0.5; add(cilindro(0.26, 0.4, "#e2b23a", 0, 0, 0, 20)); add(cilindro(0.27, 0.04, "#c9962a", 0, 0.38, 0, 20)); }
  else if (k === "pulpito") { prof = 0.6; add(caixaM(0.7, 1.1, 0.5, "#8a5a32", 0, 0, 0));
    // logo do espaço na frente, encaixado sem esticar (painel de 0,56 x 0,42 m)
    const logo = IMG.logo && IMG.logo.width && window.Decoracao ? Decoracao.recorteDoLogo(IMG.logo) : null;
    add(caixaM(0.6, 0.46, 0.01, "#5a3a22", 0, 0.4, 0.255, false));
    if (logo) { logo._hd = logo; const kk = Math.min(0.54 / logo.width, 0.4 / logo.height), lw = logo.width * kk, lh = logo.height * kk;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshStandardMaterial({ map: texDe(logo), transparent: true, alphaTest: 0.05, roughness: 0.6 })); pl.position.set(0, 0.63, 0.262); add(pl); }
  }
  else if (k === "f_palco" || k === "palco_frente") { g.add(caixaM(1, 0.3, 1, "#7f3636", 0, 0, 0)); g.userData.chao = true; prof = 1; }
  else if (/^agente_\d$/.test(k) && window.AvatarPixel && AvatarPixel.agenteFolha) { // agente sentado: cadeira de verdade e pose de frente, de lado ou de costas conforme a câmera
    const folha = AvatarPixel.agenteFolha(parseInt(k.split("_")[1]) || 1), tex = {};
    for (const [d, col] of [[0, 0], [3, 2], [1, 4], [2, 5]]) { const c = document.createElement("canvas"); c.width = 32; c.height = 48; c.getContext("2d").drawImage(folha, col * 32, 4 * 48, 32, 48, 0, 0, 32, 48);
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; tex[d] = t; }
    const m = new THREE.SpriteMaterial({ map: tex[3], alphaTest: 0.5 }), sp = new THREE.Sprite(m);
    sp.center.set(0.5, 3 / 48); sp.scale.set(32 / T * GENTE, 48 / T * GENTE, 1); sp.position.y = 0.06; add(sp);
    // cadeira: o agente olha para a mesa (para cima no 2D), o encosto fica do lado de fora
    add(caixaM(0.48, 0.08, 0.46, "#3a3f4a", 0, 0.42, 0)); add(cilindro(0.04, 0.42, "#2b2f39", 0, 0, 0)); add(caixaM(0.48, 0.5, 0.07, "#3a3f4a", 0, 0.5, 0.2));
    g.userData.billboard = true; g.userData.vistas = { tex, mat: m, olha: 3, sp }; prof = 0.5;
  }
  else if (/^agente_\d$/.test(k) || /^npc_/.test(k) || k === "pet") { // pixel art em pé, sempre de frente para a câmera
    const sp = spriteDe(IMG[k], a.w, a.h); sp.scale.multiplyScalar(GENTE); add(sp); g.userData.billboard = true; prof = 0.4;
  }
  else if (/^bib_/.test(k) && it.z === "wall" && IMG[k] && IMG[k].width) { // quadros, espelho e mural da biblioteca: a imagem na parede
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(a.w / T, a.h / T), new THREE.MeshStandardMaterial({ map: texDe(IMG[k]), transparent: true, alphaTest: 0.1, roughness: 0.7 }));
    pl.position.set(0, a.h / T / 2, 0.06); add(pl); g.userData.parede = true; g.userData.alturaParede = k === "bib_espelho" ? 0.6 : 1.45; prof = 0.1;
  }
  else if (/^bib_/.test(k)) { // móveis e plantas da biblioteca: em pé, de frente para a câmera
    const sp = spriteDe(IMG[k], a.w, a.h); sp.scale.multiplyScalar(/planta/.test(k) ? 1.4 : 1.15); add(sp); g.userData.billboard = true; prof = 0.4;
  }
  else if (/^nat_/.test(k) && it.z === "floor") { // flores e pedras na grama
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(a.w / T, a.h / T), new THREE.MeshStandardMaterial({ map: texDe(IMG[k]), transparent: true, alphaTest: 0.3, roughness: 0.95 }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.03, 0); add(pl); g.userData.chao = true; prof = 0.01;
  }
  else if (/^nat_/.test(k)) { // árvores e arbustos da área externa: em pé, de frente para a câmera, em tamanho de árvore
    const sp = spriteDe(IMG[k], a.w, a.h); sp.scale.multiplyScalar(ESCALA_NAT[k] || 2.4); add(sp); g.userData.billboard = true; prof = 0.4;
  }
  else if (/^deco_/.test(k) && it.z === "floor") { // confete no chão
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(a.w / T, a.h / T), new THREE.MeshStandardMaterial({ map: texDe(IMG[k]), transparent: true, alphaTest: 0.3, roughness: 0.9 }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.095, 0); add(pl); g.userData.chao = true; prof = 0.01;
  }
  else if (/^deco_/.test(k) && it.z === "wall") { // faixa, bandeirinhas, luzinhas, teia: desenho na parede
    const brilha = /^deco_(luzes|cascata|guirlanda|estrela)/.test(k);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(a.w / T, a.h / T), new THREE.MeshStandardMaterial({ map: texDe(IMG[k]), transparent: true, alphaTest: 0.2, roughness: 0.8, side: THREE.DoubleSide,
      emissive: brilha ? new THREE.Color("#ffffff") : new THREE.Color("#000000"), emissiveMap: brilha ? texDe(IMG[k]) : null, emissiveIntensity: brilha ? 0.9 : 0 }));
    pl.position.set(0, a.h / T / 2, 0.06); add(pl);
    g.userData.parede = true; g.userData.alturaParede = it.beiral ? 3.05 : /^deco_faixa/.test(k) ? 2.55 : k === "deco_teia" ? 2.5 : /^deco_cascata/.test(k) ? 2.15 : /^deco_(guirlanda|estrela)/.test(k) ? 2.35 : 2.3; prof = 0.1;
  }
  else if (/^deco_/.test(k)) { // balões, bolo, árvore, abóbora…: em pé, sempre de frente
    const sp = spriteDe(IMG[k], a.w, a.h); sp.scale.multiplyScalar(k === "deco_arvore" ? 1.5 : 1.15); add(sp); g.userData.billboard = true; prof = 0.3;
  }
  else if ((k === "logo" || k === "quadro_avisos" || k === "placa") && IMG[k] && IMG[k].width) { // logo (o PNG enviado pelo dono) e quadros: a imagem de verdade na parede
    const f = Math.min(1, 2.6 / (a.w / T)), pl = new THREE.Mesh(new THREE.PlaneGeometry(a.w / T * f, a.h / T * f), new THREE.MeshStandardMaterial({ map: texDe(IMG[k]), transparent: true, alphaTest: 0.05, roughness: 0.7 }));
    pl.position.set(0, a.h / T * f / 2, 0.06); add(pl);
    g.userData.parede = true; g.userData.alturaParede = k === "logo" ? 1.3 : 1.25; prof = 0.1;
  }
  else if (NA_PAREDE.test(k)) {
    const tela = /^(telao|telao_tend|telao_rot|tv|projecao)/.test(k);
    if (tela) {
      const f = Math.min(1, (PE_DIREITO - 0.35 - 0.75) / (a.h / T)), ww = a.w / T * f, hh = a.h / T * f;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), materialTela(it)); pl.position.set(0, hh / 2, 0.05); add(pl);
      add(caixaM(ww * 0.98, hh * 0.9, 0.06, "#15161d", 0, hh * 0.05, 0));
      g.userData.alturaParede = 0.75;
    } else if (k === "relogio") { const r = cilindro(0.25, 0.04, "#ffffff", 0, 0, 0, 20); r.rotation.x = Math.PI / 2; r.position.set(0, 0.25, 0.03); add(r); g.userData.alturaParede = 1.7; }
    else { add(caixaM(Math.min(w, 2.6), Math.min(a.h / T, 1.2), 0.05, corMedia(k), 0, 0, 0)); g.userData.alturaParede = 1.25; }
    g.userData.parede = true; prof = 0.1;
  }
  else { // genérico: caixa na cor do desenho 2D
    const h = Math.max(0.3, Math.min(1.1, a.h / T * 0.6)); add(caixaM(Math.max(0.3, w - 0.15), h, Math.min(prof, 0.9), corMedia(k), 0, 0, 0));
  }
  g.userData.prof = prof; return g;
}


/* ---------- texturas vivas: o 2D desenha, o 3D mostra ---------- */
const telas = []; // { it, c, g, tex }
function texDe(img) {
  if (!img) return null; if (img._tex3d) return img._tex3d;
  const hd = img._hd, fonte = hd || img; // logo enviado: versão nítida, suavizada
  const t = fonte instanceof HTMLCanvasElement ? new THREE.CanvasTexture(fonte) : new THREE.Texture(fonte);
  t.magFilter = hd ? THREE.LinearFilter : THREE.NearestFilter; t.minFilter = hd ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; img._tex3d = t; return t;
}
function materialTela(it, recorte) {
  // telas desenhadas em alta resolução (texto e vídeo nítidos de perto, na primeira pessoa)
  const a = ASSETS[it.k], esc = /^(telao|telao_tend|telao_rot|projecao|tv)$/.test(it.k) ? 4 : 3, c = document.createElement("canvas"); c.width = a.w * esc; c.height = a.h * esc;
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = ANISO; tex.colorSpace = THREE.SRGBColorSpace;
  if (recorte) { const [x, y, w, h] = recorte; tex.offset.set(x / a.w, 1 - (y + h) / a.h); tex.repeat.set(w / a.w, h / a.h); }
  telas.push({ it, c, g: c.getContext("2d"), tex, esc });
  return new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.75, roughness: 0.6 });
}
function spriteDe(img, w, h) {
  let c = img;
  if (!img._pisca) { c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0); }
  const tex = new THREE.CanvasTexture(c); if (img._pisca) (img._texs = img._texs || []).push(tex); // pisca-pisca: atualiza junto com o desenho tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 })); sp.center.set(0.5, 0.02); sp.scale.set(w / T, h / T, 1); return sp;
}
let ultimaTela = 0;
function atualizarTelas(desenhaveis, agora, rapido) {
  const todas = agora - ultimaTela >= 500; if (todas) ultimaTela = agora;
  for (const s of telas) {
    if (!todas && !(rapido && s.it.k === "projecao") && !(/^telao/.test(s.it.k) && window.Reuniao && Reuniao.animaTelao(s.it))) continue; // letreiro da reunião corre suave
    const { it, c, g, esc } = s, a = ASSETS[it.k];
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.setTransform(esc, 0, 0, esc, -it.x * T * esc, -it.y * T * esc); g.imageSmoothingEnabled = false;
    g.drawImage(IMG[it.k], it.x * T, it.y * T);
    for (const d of desenhaveis) { try { d.draw(g); } catch (e) {} }
    s.tex.needsUpdate = true; void a;
  }
}

/* ---------- montagem ---------- */
const paredes = [], cartazes = []; // cartazes: agentes, NPCs e pets em pixel art
const solidos = [], tetos = [], portas3d = []; // caixas no chão (colisão no 3D), tetos (só na 1ª pessoa) e portas que abrem
const PE_DIREITO = 3.6; // mesma altura de parede e teto em todas as salas; telões grandes diminuem para caber
const GENTE = 1.27; // o desenho da pessoa tem ~1,35 tile; ×1,27 ≈ 1,72 m, na escala dos móveis (1 tile = 1 m)
const ESCALA_NAT = { nat_arvore: 2.6, nat_arvore2: 2.5, nat_pinheiro: 2.8, nat_arbusto: 1.6 };
const SEM_BATER = /^(deco_|nat_|bib_|cadeira_|pessoa|npc_|pet$|tapete$|f_palco$|palco_frente$|placa$|logo$|relogio$|quadro_avisos$|janela$|porta_retrato$|monitor$|teclado|mouse$|notebook$|gabinete$|projecao$|sino$)/;
let objetos = null;
function montar(S) {
  if (objetos) { cena.remove(objetos); objetos.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  objetos = new THREE.Group(); cena.add(objetos); cartazes.length = 0; paredes.length = 0; telas.length = 0; escuros.clear(); solidos.length = 0; tetos.length = 0; portas3d.length = 0;
  const W = S.w, H = S.h;
  const tg = texturaPiso("f_grama"); tg.repeat.set((W + 40) / 2, (H + 40) / 2);
  const grama = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshStandardMaterial({ map: tg, roughness: 1 }));
  grama.rotation.x = -Math.PI / 2; grama.position.set(W / 2, 0, H / 2); grama.receiveShadow = true; objetos.add(grama);
  // mata em volta do escritório (só no 3D, onde a grama continua além do mapa)
  { const ks = ["nat_arvore", "nat_arvore2", "nat_pinheiro", "nat_arvore", "nat_pinheiro", "nat_arbusto"], mats = {};
    let sd = (W * 31 + H * 17) >>> 0; const rr = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let x = -10; x < W + 10; x += 2.3) for (let z = -10; z < H + 10; z += 2.3) {
      if (!(x < -1 || z < -1.2 || x > W + 0.4 || z > H + 0.4) || rr() < 0.22) continue;
      const k = ks[Math.floor(rr() * ks.length)], im = IMG[k], a = ASSETS[k]; if (!im || !a) continue;
      const m = mats[k] || (mats[k] = new THREE.SpriteMaterial({ map: texDe(im), alphaTest: 0.5 }));
      const sp = new THREE.Sprite(m), e = ESCALA_NAT[k] || 2.4; sp.center.set(0.5, 0.02); sp.scale.set(a.w / T * e, a.h / T * e, 1);
      sp.position.set(x + rr() * 1.1, 0, z + rr() * 1.1); objetos.add(sp);
    } }
  const ALT = alturaParedes(), ESP = 0.14;
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
    { // teto (aparece só na primeira pessoa) com luminárias que apagam junto com a luz da sala
      const forroM = new THREE.MeshStandardMaterial({ color: "#f1ede4", roughness: 0.95, emissive: new THREE.Color("#c9c1b2"), emissiveIntensity: 0.62, side: THREE.DoubleSide });
      const teto = new THREE.Group(), forro = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), forroM);
      forro.rotation.x = Math.PI / 2; forro.position.set(r.x + r.w / 2, ALT - 0.005, r.y + r.h / 2); teto.add(forro);
      const luzM = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#fff4dc"), emissiveIntensity: 1.3 });
      for (let x = r.x + 1.5; x < r.x + r.w - 0.5; x += 3) for (let z = r.y + 1.5; z < r.y + r.h - 0.5; z += 3) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.5), luzM); l.position.set(x, ALT - 0.03, z); teto.add(l); }
      teto.visible = false; objetos.add(teto); tetos.push(teto);
      escuros.set(r.id, { ...(escuros.get(r.id) || {}), luminaria: luzM, forro: forroM });
    }
    const vidro = TYPES[r.type].glass, dt = doorTile(r), lado = r.door ? r.door.side : "nenhuma";
    const matVidro = new THREE.MeshStandardMaterial({ color: "#bfe3ff", transparent: true, opacity: 0.35, roughness: 0.1 });
    const lados = [[r.x, r.y, r.x + r.w, r.y, [0, -1], "cima"], [r.x, r.y + r.h, r.x + r.w, r.y + r.h, [0, 1], "baixo"],
      [r.x, r.y, r.x, r.y + r.h, [-1, 0], "esquerda"], [r.x + r.w, r.y, r.x + r.w, r.y + r.h, [1, 0], "direita"]];
    for (const [x0, z0, x1, z1, n, sd] of lados) {
      const horiz = z0 === z1, comp = horiz ? x1 - x0 : z1 - z0, trechos = [];
      // um vão em cada porta deste lado (a principal e as extras)
      const vaos = portasDe(r).filter(p => p.side === sd).map(p => horiz ? p.tile - x0 : p.tile - z0).sort((a, b) => a - b);
      let ini = 0; for (const p of vaos) { if (p > ini) trechos.push([ini, p]); ini = p + 1; } if (ini < comp) trechos.push([ini, comp]);
      for (const [a, b] of trechos) {
        const len = b - a, m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : ESP, ALT, horiz ? ESP : len), vidro && sd !== "cima" ? matVidro : mat("#efe9dc"));
        m.geometry.translate(0, ALT / 2, 0);
        m.position.set(horiz ? x0 + a + len / 2 : x0, 0, horiz ? z0 : z0 + a + len / 2); m.castShadow = true; m.receiveShadow = true;
        const topo = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : ESP + 0.02, 0.06, horiz ? ESP + 0.02 : len), mat("#3a3346")); topo.position.y = ALT; m.add(topo);
        m.userData.normal = n; objetos.add(m); paredes.push(m);
      }
    }
    for (const p of portasDe(r)) portas3d.push({ r, p, vidro, privada: r.type === "reuniao" }); // montadas depois (sem repetir a porta de uma parede dividida)
  }
  palcos.length = 0;
  for (const it of allItems()) if (it.k === "f_palco" || it.k === "palco_frente") { const a = ASSETS[it.k]; if (a) palcos.push({ x0: it.x, x1: it.x + a.w / T, z0: it.y, z1: it.y + a.h / T, y: 0.34 }); }
  for (const it of allItems()) {
    const a = ASSETS[it.k]; if (!a || it.k === "parede") continue;
    const sala = it.room && roomById(it.room);
    const g = movel(it, sala); if (!g) continue;
    const cx = it.x + a.w / T / 2;
    if (g.userData.parede && it.pendurada) { const r = sala || roomAt(it.x * T + 16, it.y * T + a.h + 40); g.position.set(cx, 2.62, r ? r.y + Math.min(2.2, r.h * 0.35) : it.y + 2); }
    else if (g.userData.parede) { const r = sala || roomAt(it.x * T + 16, it.y * T + a.h + 40); g.position.set(cx, g.userData.alturaParede, (r ? r.y : it.y + 2) + 0.09); }
    else if (g.userData.chao) g.position.set(cx, 0.04, it.y + a.h / T / 2);
    else if (g.userData.billboard) {
      let z = it.y + a.h / T - 0.1;
      if (!g.userData.vistas) { // mascote/NPC atrás de um balcão ou mesa no 2D: fica atrás dela no 3D, não dentro
        const m = allItems().find(o => MESAS3D.test(o.k) && ASSETS[o.k] && cx > o.x && cx < o.x + ASSETS[o.k].w / T && z > o.y + ASSETS[o.k].h / T - 1.25 && z < o.y + ASSETS[o.k].h / T + 0.3);
        if (m) z = m.y + ASSETS[m.k].h / T - 0.05 - profMesa(m) - 0.3;
      }
      if (g.userData.vistas) { // senta encostado na mesa que está logo acima no 2D
        const m = allItems().find(o => MESAS3D.test(o.k) && ASSETS[o.k] && cx > o.x && cx < o.x + ASSETS[o.k].w / T && o.y + ASSETS[o.k].h / T > it.y - 0.6 && o.y + ASSETS[o.k].h / T < it.y + a.h / T + 0.2);
        if (m) z = m.y + ASSETS[m.k].h / T - 0.05 + 0.4;
      }
      g.position.set(cx, 0.06 + alturaChao(cx, z), z); cartazes.push(g);
    }
    else if (g.userData.sobreMesa && mesaSob(it)) { const [x, z] = naMesa(it, mesaSob(it)); g.position.set(x, 0, z); }
    else { const base = it.y + a.h / T, z = base - g.userData.prof / 2 - 0.05; g.position.set(cx, (g.userData.sobreMesa ? 0 : 0.08) + alturaChao(cx, z), z); }
    girarComoNoEditor(g, it);
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
  // colisão do 3D: a área que o móvel ocupa no chão (o 2D só bloqueia a faixa da frente)
  for (const g of objetos.children) {
    const it = g.userData && g.userData.item; if (!it || g.userData.parede || g.userData.chao || SEM_BATER.test(it.k) || it.z === "floor" || it.z === "wall") continue;
    caixaTmp.setFromObject(g); if (!isFinite(caixaTmp.min.x)) continue;
    solidos.push({ x0: caixaTmp.min.x + 0.03, z0: caixaTmp.min.z + 0.03, x1: caixaTmp.max.x - 0.03, z1: caixaTmp.max.z - 0.03 });
  }
  montarPortas();
}
/* mesa embaixo de um item (monitor, gabinete, teclado…) e onde ele fica em cima dela no 3D */
/* chão elevado (palco do auditório): quem está em cima sobe junto */
const palcos = [];
function alturaChao(x, z) { for (const b of palcos) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b.y; return 0; }
const MESAS3D = /^(mesa|mesa_pc|mesa_reuniao\d*|balcao)$/;
const profMesa = m => /^mesa_reuniao/.test(m.k) ? Math.max(1, ASSETS[m.k].h / T * 0.75) : 1.1;
function mesaSob(it) {
  if (it._mesa !== undefined) return it._mesa;
  const a = ASSETS[it.k], cx = it.x * T + a.w / 2, by = it.y * T + a.h;
  return (it._mesa = allItems().find(m => MESAS3D.test(m.k) && ASSETS[m.k] && cx >= m.x * T - 4 && cx <= m.x * T + ASSETS[m.k].w + 4 && by >= m.y * T - 12 && by <= m.y * T + ASSETS[m.k].h + 10) || null);
}
function naMesa(it, m) {
  const a = ASSETS[it.k], am = ASSETS[m.k], pr = profMesa(m), z1 = m.y + am.h / T - 0.05, z0 = z1 - pr;
  const f = Math.max(0, Math.min(1, (it.y * T + a.h - m.y * T) / am.h)); // no 2D: mais para cima = mais para o fundo da mesa
  const x = Math.max(m.x + 0.25, Math.min(m.x + am.w / T - 0.25, it.x + a.w / T / 2));
  return [x, z0 + 0.22 + f * Math.max(0, pr - 0.44)];
}
/* "Girar 90°" e "Espelhar" do editor valem também no 3D (sentido horário visto de cima, como no 2D) */
function girarComoNoEditor(g, it) {
  const r = ((it.rot || 0) % 360 + 360) % 360;
  if (r) g.rotation.y -= r * Math.PI / 180;
  if (it.flip) g.scale.x *= -1;
}
/* pé-direito padrão de todas as salas: 3,6 m, ou mais se algum telão/projeção da parede passar disso */
function alturaParedes() { return PE_DIREITO; }
/* portas de verdade nos vãos: abrem sozinhas quando alguém chega perto */
function montarPortas() {
  const vistas = new Set(), lista = portas3d.splice(0), ALT = alturaParedes(), AP = 2.15;
  for (const { r, p, vidro, privada } of lista) {
    const horiz = p.side === "cima" || p.side === "baixo";
    const fixo = p.side === "cima" ? r.y : p.side === "baixo" ? r.y + r.h : p.side === "esquerda" ? r.x : r.x + r.w;
    const chave = (horiz ? "h" : "v") + fixo + ":" + p.tile; if (vistas.has(chave)) continue; vistas.add(chave);
    const piv = new THREE.Group(); piv.position.set(horiz ? p.tile : fixo, 0.08, horiz ? fixo : p.tile);
    const folhaM = vidro ? new THREE.MeshStandardMaterial({ color: "#bfe3ff", transparent: true, opacity: 0.45, roughness: 0.1 }) : mat(privada ? "#5b3a26" : "#8a5a32");
    const folha = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.94 : 0.05, AP - 0.08, horiz ? 0.05 : 0.94), folhaM);
    folha.position.set(horiz ? 0.49 : 0, (AP - 0.08) / 2, horiz ? 0 : 0.49); folha.castShadow = true; piv.add(folha);
    const mac = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat("#d8c27a", { metalness: 0.6, roughness: 0.3 }));
    mac.position.set(horiz ? 0.84 : 0.05, 1.0, horiz ? 0.05 : 0.84); piv.add(mac);
    const verga = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1 : 0.14, ALT - AP, horiz ? 0.14 : 1), mat("#efe9dc"));
    verga.position.set(horiz ? p.tile + 0.5 : fixo, AP + (ALT - AP) / 2, horiz ? fixo : p.tile + 0.5);
    // abre para dentro da sala
    const aberta = { cima: -Math.PI / 2, baixo: Math.PI / 2, esquerda: Math.PI / 2, direita: -Math.PI / 2 }[p.side] * 0.92;
    const normal = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] }[p.side];
    objetos.add(piv, verga);
    portas3d.push({ piv, verga, aberta, ang: 0, cx: horiz ? p.tile + 0.5 : fixo, cz: horiz ? fixo : p.tile + 0.5, normal });
  }
}
function animarPortas(atores, dt) {
  const k = 1 - Math.exp(-(dt || 0.016) * 7);
  for (const d of portas3d) {
    let perto = false; for (const a of atores) if (Math.abs(a.px / T - d.cx) < 1.5 && Math.abs(a.py / T - d.cz) < 1.5) { perto = true; break; }
    const alvoA = perto ? d.aberta : 0; if (Math.abs(alvoA - d.ang) < 0.002 && d.parada) continue;
    d.ang += (alvoA - d.ang) * k; d.parada = Math.abs(alvoA - d.ang) < 0.002; d.piv.rotation.y = d.ang;
  }
}

/* ---------- luz e câmera ---------- */
const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3048, 1.15); cena.add(hemi);
const sol = new THREE.DirectionalLight(0xfff1dc, 1.9); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
cena.add(sol, sol.target);
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
/* primeira pessoa: câmera nos olhos do seu personagem (padrão do 3D); "iso" = visão de cima */
const camFP = new THREE.PerspectiveCamera(58, 1, 0.05, 300); // campo de visão menor: menos distorção nas bordas
let vista = (() => { try { return localStorage.getItem("nextco_vista3d") || "1p"; } catch (e) { return "1p"; } })();
let yaw = null, pitch = -0.04, eu = null, yawAlvo = null, pitchAlvo = -0.04;
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
  sp.center.set(0.5, 12 / 80); sp.scale.set(64 / T * GENTE, 80 / T * GENTE, 1); sp.renderOrder = 2; sp.userData.ator = a;
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
/* empurra um ponto um pouco na direção da câmera (no chão), para um desenho plano não ser cortado pelo móvel em volta */
function paraACamera(pos, dist) {
  const cam = camAtual(); let dx = cam.position.x - pos.x, dz = cam.position.z - pos.z; const L = Math.hypot(dx, dz);
  if (L < 0.001) return; pos.x += dx / L * Math.min(dist, L * 0.5); pos.z += dz / L * Math.min(dist, L * 0.5);
}
function direcaoVistaEm(d, x, z) {
  if (!fp()) return direcaoVista(d);
  const cam = camAtual(), dx = x - cam.position.x, dz = z - cam.position.z, L = Math.hypot(dx, dz) || 1; // de onde você olha para ela
  const [vx, vz] = VET[d] || VET[0], fx = dx / L, fz = dz / L, rx = -fz, rz = fx;
  const sx = vx * rx + vz * rz, sd = -(vx * fx + vz * fz);
  return Math.abs(sx) > Math.abs(sd) ? (sx < 0 ? 1 : 2) : (sd > 0 ? 0 : 3);
}
function desenharPessoa(a, t) {
  const s = spriteDaPessoa(a), g = s.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 64, 80); g.imageSmoothingEnabled = false;
  g.setTransform(1, 0, 0, 1, 32 - Math.round(a.px), 68 - Math.round(a.py));
  const d = a.dir; if (!a.assento) a.dir = direcaoVista(d);
  else a.vistaSentado = direcaoVistaEm(a.assento.dir ?? (a.assento.face === "costas" ? 3 : 0), a.px / T, a.py / T); // sentado: de frente, de costas ou de lado conforme você gira em volta
  try { a.draw(g, t); } finally { a.dir = d; a.vistaSentado = undefined; }
  s.tex.needsUpdate = true;
  const ch = alturaChao(a.px / T, a.py / T - 0.05);
  s.sp.position.set(a.px / T, (a.assento ? 0.12 : 0.08) + ch, a.py / T);
  if (a.assento) paraACamera(s.sp.position, 0.38); // sentado: o desenho fica na frente da própria cadeira (não é cortado pelo encosto)
  s.sombra.position.set(a.px / T, 0.1 + ch, a.py / T); s.sombra.visible = !a.assento;
}

/* ---------- paredes da frente ficam baixas (corte isométrico) ---------- */
function cortarParedes() {
  if (fp()) { for (const m of paredes) m.scale.y = 1; for (const d of portas3d) { d.piv.scale.y = 1; d.verga.visible = true; } return; }
  const vx = Math.sin(angulo()), vz = Math.cos(angulo());
  for (const m of paredes) { const [nx, nz] = m.userData.normal, frente = nx * vx + nz * vz > 0.2; const y = frente ? 0.16 : 1; m.scale.y += (y - m.scale.y) * 0.25; }
  for (const d of portas3d) { const [nx, nz] = d.normal, frente = nx * vx + nz * vz > 0.2; d.piv.scale.y += ((frente ? 0.16 : 1) - d.piv.scale.y) * 0.25; d.verga.visible = !frente; }
}

/* ---------- qualidade adaptativa ---------- */
let somaDt = 0, nDt = 0, nivel = 0;
function medirDesempenho(dt) {
  if (!dt) return; somaDt += dt; nDt++;
  if (nDt < 90) return;
  const media = somaDt / nDt; somaDt = 0; nDt = 0;
  if (media > 1 / 32 && nivel < 2) { // abaixo de ~32 qps
    nivel++;
    if (nivel === 1) { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25)); tamanho = ""; ajustar(); }
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
    for (const [id, e] of escuros) { const off = apagada(id); if (e.sombra && e.sombra.visible !== (off && !fp())) e.sombra.visible = off && !fp(); if (e.brilho && e.brilho.visible === off) e.brilho.visible = !off; if (e.luminaria) e.luminaria.emissiveIntensity = off ? 0.04 : 1.3; if (e.forro) e.forro.emissiveIntensity = off ? 0.03 : 0.62; }
  },
  girar(d) { if (fp()) { if (yawAlvo != null) yawAlvo -= d * Math.PI / 4; return; } giroAlvo += d * Math.PI / 2; },
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
      if (yaw == null) yaw = yawAlvo = [Math.PI, Math.PI / 2, -Math.PI / 2, 0][P.dir || 0];
      const kOlhar = 1 - Math.exp(-(dt || 0.016) * 22); yaw += (yawAlvo - yaw) * kOlhar; pitch += (pitchAlvo - pitch) * kOlhar;
      const fov = Math.max(38, Math.min(72, 58 / Math.pow(Math.max(0.6, zoom) / 1.4, 0.35)));
      if (Math.abs(camFP.fov - fov) > 0.3) { camFP.fov = fov; camFP.updateProjectionMatrix(); }
      const olho = (P.assento ? 1.2 : 1.6) + alturaChao(P.px / T, P.py / T - 0.05);
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
    for (const g of cartazes) { const ag = g.userData.item && g.userData.item.agente; const v = !perto(g.position.x, g.position.z) && !(ag && window.AGENTES_FORA && AGENTES_FORA.has(ag)); if (g.visible !== v) g.visible = v;
      const vs = g.userData.vistas; if (vs && v) { const t = vs.tex[direcaoVistaEm(vs.olha, g.position.x, g.position.z)]; if (vs.mat.map !== t) { vs.mat.map = t; vs.mat.needsUpdate = true; }
        const sp = vs.sp; if (sp) { const p = new THREE.Vector3(g.position.x, 0, g.position.z); paraACamera(p, 0.38); p.y = g.position.y + 0.06; g.updateMatrixWorld(); g.worldToLocal(p); sp.position.copy(p); sp.updateMatrix(); } } }
    const temVideo = window.Projecao && (Projecao.apresentando || document.querySelector("video[autoplay]"));
    atualizarTelas(desenhaveis, performance.now(), !!temVideo);
    animarPortas(atores, dt);
    for (const tt of tetos) if (tt.visible !== fp()) tt.visible = fp();
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
  // para onde a câmera olha, em ângulo do canvas 2D (x para a direita, y para baixo); null fora da 1ª pessoa
  get olhar() { return ativo && fp() && yaw != null ? Math.atan2(-Math.cos(yaw), -Math.sin(yaw)) : null; },
  // colisão do 3D: o corpo (raio ~0,2 tile) não entra na área do móvel no chão
  empurrar(px, py, raio = 0.2) {
    let x = px / T, z = py / T;
    for (let volta = 0; volta < 3; volta++) { let mexeu = false;
      for (const b of solidos) { const x0 = b.x0 - raio, x1 = b.x1 + raio, z0 = b.z0 - raio, z1 = b.z1 + raio; if (x <= x0 || x >= x1 || z <= z0 || z >= z1) continue;
        const opc = [[x0 - x, 0], [x1 - x, 0], [0, z0 - z], [0, z1 - z]].sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]))[0]; x += opc[0]; z += opc[1]; mexeu = true; }
      if (!mexeu) break; }
    return [x * T, z * T];
  },
  livre(px, py, raio = 0.2) { const x = px / T, z = py / T; for (const b of solidos) if (x > b.x0 - raio && x < b.x1 + raio && z > b.z0 - raio && z < b.z1 + raio) return false; return true; },
  get vista() { return vista; },
  trocarVista(v) { vista = v || (fp() ? "iso" : "1p"); if (fp() && eu) this.olharPara(eu.dir); try { localStorage.setItem("nextco_vista3d", vista); } catch (e) {} if (!fp()) for (const [, s] of pessoas) s.sp.visible = true; return vista; },
  virar(rad) { if (yawAlvo != null) yawAlvo += rad; },
  olharPara(dir) { yaw = yawAlvo = [Math.PI, Math.PI / 2, -Math.PI / 2, 0][dir || 0]; pitch = pitchAlvo = -0.04; },
  // vira a cabeça aos poucos para a direção em que você anda (andar por toque na 1ª pessoa)
  seguirOlhar(vx, vz, dt) { if (!fp() || yawAlvo == null || (!vx && !vz)) return; const alvoY = Math.atan2(-vx, -vz); let d = alvoY - yawAlvo; d = Math.atan2(Math.sin(d), Math.cos(d)); yawAlvo += d * Math.min(1, (dt || 0.016) * 5); },
  inclinar(rad) { pitchAlvo = Math.max(-0.8, Math.min(0.7, pitchAlvo + rad)); },
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
