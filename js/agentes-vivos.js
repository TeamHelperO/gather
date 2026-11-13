/* Agentes vivos: de tempos em tempos um agente levanta, vai até a mesa de outro (até atravessando a porta
   entre Pesquisa e Edição), os dois conversam sobre o trabalho com balões e cada um volta para a cadeira.
   O plano é sorteado por janela de 45 s com semente fixa, então todo mundo vê a mesma cena ao mesmo tempo.
   Funciona no 2D e no 3D: quem está de pé vira um "ator" desenhado como as pessoas; a cadeira fica vazia. */
window.AgentesVivos = (function () {
  const JANELA = 45000, VEL = 52; // px por segundo
  const fora = new Set(); window.AGENTES_FORA = fora;
  let ags = [], planoDe = null, plano = null, mapaVersao = null;

  // número aleatório repetível
  function semente(n) { let x = n >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  const nomeDe = id => (window.TI && TI.info ? TI.info(id).nome : id) || id;

  // visual de cada agente para andar: o mesmo jeitão (moletom colorido) do sprite sentado
  const MOLETOM = ["azul", "roxo", "verde", "laranja", "rosa", "vermelho", "amarelo", "cinza"];
  function avatarDe(i) {
    const r = Math.random, rnd = semente(1000 + i * 77); Math.random = rnd;
    let av; try { av = Avatar.aleatorio(); } finally { Math.random = r; }
    const cores = Object.keys(((Avatar.CAT.cima || {}).estilos || {}).moletom ? Avatar.CAT.cima.estilos.moletom.cores || {} : {});
    av.cima = { estilo: "moletom", cor: cores.find(c => c.includes(MOLETOM[i % MOLETOM.length])) || cores[i % Math.max(1, cores.length)] || "preta" };
    av.chapeu = { estilo: "nenhum", cor: "preto" }; av.joia = { estilo: "nenhum" };
    return av;
  }

  function montar() {
    fora.clear(); ags = []; plano = null; planoDe = null;
    const itens = allItems().filter(it => /^agente_\d+$/.test(it.k) && it.agente);
    itens.forEach((it, i) => {
      const sala = roomAt(it.x * T + 16, it.y * T + 30);
      // onde ele fica de pé: logo atrás da cadeira (ou o lugar livre mais perto)
      let casa = null;
      for (const [dx, dy] of [[0, 30], [0, 44], [20, 30], [-20, 30], [0, 58], [26, 44], [-26, 44]]) { const x = it.x * T + 16 + dx, y = it.y * T + 40 + dy; if (livre(x, y)) { casa = { x, y }; break; } }
      if (!casa || !sala) return;
      const ator = new Ator({ id: "agente:" + it.agente, nome: "🤖 " + nomeDe(it.agente), sheet: null, x: casa.x, y: casa.y, agente: it.agente });
      Avatar.montar(avatarDe(i)).then(sh => ator.sheet = sh).catch(() => {});
      ags.push({ id: it.agente, it, sala, casa, ator });
    });
  }

  function caminho(de, para) {
    const p = findPath(grid, Math.floor(de.x / C16), Math.floor(de.y / C16), Math.floor(para.x / C16), Math.floor(para.y / C16));
    if (!p || !p.length) return null;
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

  /* plano da janela: um agente visita outro (às vezes dois encontros) */
  function planejar(janela) {
    const rnd = semente(janela * 2654435761 % 4294967296);
    const enc = [], ocupados = new Set();
    const n = ags.length < 2 ? 0 : rnd() < 0.35 ? 2 : 1;
    for (let k = 0; k < n * 4 && enc.length < n; k++) {
      const a = ags[Math.floor(rnd() * ags.length)], cand = ags.filter(b => b !== a && !ocupados.has(b.id) && !ocupados.has(a.id));
      if (!cand.length) continue;
      // de preferência na mesma sala; às vezes atravessa a porta para a sala vizinha
      const mesma = cand.filter(b => b.sala.id === a.sala.id), outra = cand.filter(b => b.sala.id !== a.sala.id);
      const b = (rnd() < 0.3 && outra.length ? outra : mesma.length ? mesma : outra)[Math.floor(rnd() * (rnd() < 0.3 && outra.length ? outra.length : (mesma.length || outra.length)))];
      if (!b) continue;
      const lado = rnd() < 0.5 ? -1 : 1, alvo = [{ x: b.casa.x + 40 * lado, y: b.casa.y }, { x: b.casa.x - 40 * lado, y: b.casa.y }, { x: b.casa.x, y: b.casa.y + 34 }, { x: b.casa.x + 30 * lado, y: b.casa.y + 14 }].find(p => livre(p.x, p.y));
      if (!alvo) continue;
      const ida = caminho(a.casa, alvo); if (!ida || ida.dur > 14000) continue;
      const inicio = 1500 + rnd() * 6000 + enc.length * 4000, chega = inicio + ida.dur, fim = chega + 12000;
      enc.push({ a, b, ida, inicio, chega, fim, volta: fim + ida.dur, falas: dialogo(a, b, rnd) });
      ocupados.add(a.id); ocupados.add(b.id);
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
      const A = e.a.ator, B = e.b.ator;
      if (t < e.inicio || t > e.volta) continue;
      fora.add(e.a.id);
      if (t < e.chega) { const p = pontoEm(e.ida, t - e.inicio); andar(A, p, t); }
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

  return { montar, atualizar, atores, get fora() { return fora; } };
})();
