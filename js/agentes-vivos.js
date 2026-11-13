/* Agentes vivos: de tempos em tempos um agente levanta e, sem sair da própria sala, vai até a mesa de um colega
   (os dois conversam sobre o trabalho com balões) ou usa algo da sala: café na máquina, água no bebedouro,
   mexer no rack de servidor. Depois volta para a cadeira. De pé, ele tem o mesmo capuz, cabelo e fone de quando está sentado.
   O plano é sorteado por janela de 45 s com semente fixa, então todo mundo vê a mesma cena ao mesmo tempo.
   Funciona no 2D e no 3D: quem está de pé vira um "ator" desenhado como as pessoas; a cadeira fica vazia. */
window.AgentesVivos = (function () {
  const JANELA = 45000, VEL = 52; // px por segundo
  const fora = new Set(); window.AGENTES_FORA = fora;
  let ags = [], planoDe = null, plano = null, mapaVersao = null;

  // número aleatório repetível
  function semente(n) { let x = n >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  const nomeDe = id => (window.TI && TI.info ? TI.info(id).nome : id) || id;

  // visual de pé = o mesmo do sprite sentado (capuz, cabelo, fone), vindo do número do item agente_N
  function folhaDe(it, i) {
    const n = parseInt(String(it.k).split("_")[1]) || i + 1;
    if (window.AvatarPixel && AvatarPixel.agenteFolha) return Promise.resolve(AvatarPixel.agenteFolha(n));
    return Avatar.montar(Avatar.aleatorio());
  }
  const naSala = (sala, x, y) => { const r = roomAt(x, y - 4); return !!r && r.id === sala.id; };
  const livreNa = (sala, x, y) => livre(x, y) && naSala(sala, x, y);

  function montar() {
    fora.clear(); ags = []; plano = null; planoDe = null;
    const itens = allItems().filter(it => /^agente_\d+$/.test(it.k) && it.agente);
    itens.forEach((it, i) => {
      const sala = roomAt(it.x * T + 16, it.y * T + 30);
      // onde ele fica de pé: logo atrás da cadeira (ou o lugar livre mais perto)
      let casa = null;
      for (const [dx, dy] of [[0, 30], [0, 44], [20, 30], [-20, 30], [26, 44], [-26, 44], [0, 58]]) { const x = it.x * T + 16 + dx, y = it.y * T + 40 + dy; if (sala && livreNa(sala, x, y)) { casa = { x, y }; break; } }
      if (!casa || !sala) return;
      const ator = new Ator({ id: "agente:" + it.agente, nome: "🤖 " + nomeDe(it.agente), sheet: null, x: casa.x, y: casa.y, agente: it.agente });
      folhaDe(it, i).then(sh => ator.sheet = sh).catch(() => {});
      ags.push({ id: it.agente, it, sala, casa, ator });
    });
  }

  function caminho(de, para, sala) {
    const p = findPath(grid, Math.floor(de.x / C16), Math.floor(de.y / C16), Math.floor(para.x / C16), Math.floor(para.y / C16));
    if (!p || !p.length) return null;
    if (sala && p.some(([x, y]) => !naSala(sala, x, y))) return null; // nunca sai da própria sala
    const pts = [{ x: de.x, y: de.y }, ...p.map(([x, y]) => ({ x, y }))]; pts[pts.length - 1] = { x: para.x, y: para.y };
    let tot = 0; for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return { pts, tot, dur: tot / VEL * 1000 };
  }
  function pontoEm(c, ms) { // posição e direção depois de ms andando
    let d = Math.max(0, ms) / 1000 * VEL;
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i], s = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= s) { const k = s ? d / s : 1, dx = b.x - a.x, dy = b.y - a.y; return { x: a.x + dx * k, y: a.y + dy * k, dir: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0) }; }
      d -= s;
    }
    const f = c.pts[c.pts.length - 1]; return { x: f.x, y: f.y, dir: 0 };
  }

  /* falas: usam o que está acontecendo de verdade (tendências, prospecção) */
  function dialogo(a, b, rnd) {
    const r = window.TI && TI.resumo ? TI.resumo() : { tend: [], pega: [], pendentes: 0, enviados: 0, responderam: 0 };
    const pick = l => l[Math.floor(rnd() * l.length)];
    const curto = s => !s ? "" : s.length > 38 ? s.slice(0, 36) + "…" : s;
    const tA = a.sala.type, tB = b.sala.type, nB = nomeDe(b.id).split(" ")[0];
    const t1 = curto(pick(r.tend.length ? r.tend : ["vídeos curtos com IA"])), tp = curto(pick(r.pega.length ? r.pega : r.tend.length ? r.tend : ["Reels com bastidores"]));
    if (tA === "ti" && tB === "edicao") return [`${nB}, essa dá roteiro: ${tp}`, "Manda! Já penso no gancho ✍️", "Foi aprovada lá no telão ✅", "Fechado, sai hoje 🎬"];
    if (tA === "edicao" && tB === "ti") return [`Tem tendência nova pra mim?`, `Tem! ${tp}`, "Perfeito, vira vídeo 🎬", "Depois me mostra o corte ✂️"];
    if (tA === "edicao") return pick([["Roteiro novo saindo ✍️", "Já separo as cenas 🎬", "Sem tela parada, hein", "Pode deixar ✂️"], ["Narração ficou boa?", "Ficou! Ajustei o ritmo 🎙️", "Bora renderizar", "Subindo pra aprovação ⏳"]]);
    if (/prospec/.test((window.TI && TI.info(a.id).tipo) || "") || /prospec/.test((window.TI && TI.info(b.id).tipo) || ""))
      return [`Mandei e-mail pra ${r.enviados || "várias"} empresas 📨`, r.responderam ? `${r.responderam} já responderam!` : "Alguma respondeu?", r.responderam ? "Virou tarefa no telão ✅" : "Ainda aguardando…", "Bora pra próxima lista 🔎"];
    return pick([[`Viu essa? ${t1}`, "Vi! Tá crescendo rápido 📈", "Vou detalhar no telão", "Fechado 👍"],
      ["Quantas pra avaliar hoje?", `${r.pendentes || "Algumas"} no telão`, "Boa, a equipe vai gostar", "☕ Café depois?"],
      [`Cruzei com dados do Meta Ads`, "E aí, confirma?", "Confirma, sobe a nota ⭐", "Publicando 📤"]]);
  }

  /* coisas da sala com que os agentes mexem: onde ficar (na frente do item) e o que dizer */
  const USOS = {
    maquina_cafe: { emoji: "☕", falas: [["☕ Passando um café…", "Esse é o terceiro hoje 😅"], ["☕ Expresso duplo", "Agora o roteiro sai"], ["☕ Quem deixou sem água?", "Pronto, enchi ✅"]] },
    cafeteira: { emoji: "☕", falas: [["☕ Um cafezinho rápido", "Bora voltar 💪"]] },
    bebedouro: { emoji: "💧", falas: [["💧 Hidratando", "Água gelada, perfeito"], ["💧 Enchendo a garrafa", "Meta: 2 litros hoje"]] },
    rack_servidor: { emoji: "🖥️", falas: [["🔧 Checando o servidor…", "Tudo verde por aqui ✅"], ["🖥️ Reiniciando o nó 3", "Voltou, latência ok 📶"], ["🔌 Ajeitando os cabos", "Bem melhor assim"], ["📊 CPU em 82%…", "Vou balancear a carga ⚖️"]] },
  };
  function pontosDeUso(sala) {
    const out = [];
    for (const it of allItems()) {
      const u = USOS[it.k]; if (!u || !ASSETS[it.k]) continue;
      const b = caixa(it), x = b.x + b.w / 2;
      for (const dy of [10, 18, 26]) { const y = b.y + b.h + dy; if (livreNa(sala, x, y)) { out.push({ it, u, x, y }); break; } }
    }
    return out;
  }

  /* plano da janela: cada sala tem sua cena (um encontro entre colegas ou alguém usando algo da sala) */
  function planejar(janela) {
    const rnd = semente(janela * 2654435761 % 4294967296);
    const enc = [], ocupados = new Set(), alvosUsados = new Set();
    const salas = [...new Set(ags.map(g => g.sala))];
    for (const sala of salas) {
      const daSala = ags.filter(g => g.sala === sala); if (!daSala.length) continue;
      const cenas = rnd() < 0.4 ? 2 : 1;
      for (let k = 0; k < cenas * 4 && enc.filter(e => e.a.sala === sala).length < cenas; k++) {
        const livres = daSala.filter(g => !ocupados.has(g.id)); if (!livres.length) break;
        const a = livres[Math.floor(rnd() * livres.length)];
        const colegas = livres.filter(b => b !== a), usos = pontosDeUso(sala).filter(p => !alvosUsados.has(p.x + "," + p.y));
        const conversa = colegas.length && (!usos.length || rnd() < 0.45);
        const inicio = 1500 + rnd() * 6000 + enc.length * 3500;
        if (conversa) {
          const b = colegas[Math.floor(rnd() * colegas.length)], lado = rnd() < 0.5 ? -1 : 1;
          const alvo = [{ x: b.casa.x + 40 * lado, y: b.casa.y }, { x: b.casa.x - 40 * lado, y: b.casa.y }, { x: b.casa.x, y: b.casa.y + 34 }, { x: b.casa.x + 30 * lado, y: b.casa.y + 14 }].find(p => livreNa(sala, p.x, p.y));
          if (!alvo) continue;
          const ida = caminho(a.casa, alvo, sala); if (!ida || ida.dur > 14000) continue;
          const chega = inicio + ida.dur, fim = chega + 12000;
          enc.push({ tipo: "conversa", a, b, ida, inicio, chega, fim, volta: fim + ida.dur, falas: dialogo(a, b, rnd) });
          ocupados.add(a.id); ocupados.add(b.id);
        } else if (usos.length) {
          const u = usos[Math.floor(rnd() * usos.length)];
          const ida = caminho(a.casa, u, sala); if (!ida || ida.dur > 14000) continue;
          const chega = inicio + ida.dur, fim = chega + 7000;
          enc.push({ tipo: "uso", a, uso: u, ida, inicio, chega, fim, volta: fim + ida.dur, falas: u.u.falas[Math.floor(rnd() * u.u.falas.length)] });
          ocupados.add(a.id); alvosUsados.add(u.x + "," + u.y);
        }
      }
    }
    return enc;
  }

  function atualizar(agora) {
    if (!ags.length || typeof grid === "undefined" || !grid) return;
    const janela = Math.floor(agora / JANELA), t = agora - janela * JANELA;
    if (planoDe !== janela) { planoDe = janela; plano = planejar(janela); }
    fora.clear();
    for (const g of ags) { g.ator.moving = false; g.ator.falaChat = null; g.ator.nome = "🤖 " + nomeDe(g.id); }
    for (const e of plano) {
      const A = e.a.ator, B = e.b ? e.b.ator : null;
      if (t < e.inicio || t > e.volta) continue;
      fora.add(e.a.id);
      if (t < e.chega) { const p = pontoEm(e.ida, t - e.inicio); andar(A, p, t); }
      else if (t < e.fim && e.tipo === "uso") {
        const f = e.ida.pts[e.ida.pts.length - 1]; A.x = f.x; A.y = f.y; A.moving = false; A.dir = 3; // de costas, mexendo no item
        A.frame = Math.floor(t / 400) % 2 ? 0 : 2; // mexe os braços
        const i = Math.min(e.falas.length - 1, Math.floor((t - e.chega) / 3500));
        A.falaChat = e.falas[i]; A.falaChatAte = performance.now() + 400;
      }
      else if (t < e.fim) {
        const f = e.ida.pts[e.ida.pts.length - 1]; A.x = f.x; A.y = f.y; A.moving = false; A.frame = 0;
        // o visitado levanta e conversa
        fora.add(e.b.id); B.x = e.b.casa.x; B.y = e.b.casa.y; B.moving = false; B.frame = 0;
        A.dir = Math.abs(B.x - A.x) > Math.abs(B.y - A.y) ? (B.x < A.x ? 1 : 2) : (B.y < A.y ? 3 : 0);
        B.dir = Math.abs(A.x - B.x) > Math.abs(A.y - B.y) ? (A.x < B.x ? 1 : 2) : (A.y < B.y ? 3 : 0);
        const i = Math.min(3, Math.floor((t - e.chega) / 3000)), quem = i % 2 === 0 ? A : B;
        quem.falaChat = e.falas[i]; quem.falaChatAte = performance.now() + 400;
        A.conversa = B; B.conversa = A; A.falando = quem === A; B.falando = quem === B;
      } else { // volta pelo mesmo caminho
        const p = pontoEm({ ...e.ida, pts: e.ida.pts.slice().reverse() }, t - e.fim); andar(A, p, t); A.conversa = null; A.falando = false;
      }
    }
    for (const g of ags) if (!fora.has(g.id)) { g.ator.conversa = null; g.ator.falando = false; g.ator.x = g.casa.x; g.ator.y = g.casa.y; }
  }
  function andar(A, p, t) { A.x = p.x; A.y = p.y; A.dir = p.dir; A.moving = true; A.frame = 1 + (Math.floor(t / 125) % 4); }

  // atores para desenhar junto com as pessoas (só os que estão de pé)
  const atores = () => ags.filter(g => fora.has(g.id) && g.ator.sheet).map(g => g.ator);

  return { montar, atualizar, atores, get fora() { return fora; }, get plano() { return plano; } };
})();
