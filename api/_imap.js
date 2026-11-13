/* IMAP mínimo, sem dependências: lê a caixa de entrada do e-mail do cPanel para achar respostas.
   Só leitura (BODY.PEEK: não marca como lida). Variáveis: IMAP_HOST (padrão SMTP_HOST), IMAP_PORT (993),
   IMAP_USER / IMAP_PASS (padrão SMTP_USER / SMTP_PASS). */
const tls = require("tls");

class Imap {
  constructor() { this.buf = Buffer.alloc(0); this.n = 0; this.esperando = null; }
  conectar(host, porta) {
    return new Promise((ok, falha) => {
      this.s = tls.connect({ host, port: porta, servername: host }, () => {});
      this.s.setTimeout(25000, () => this.s.destroy(new Error("O servidor de e-mail demorou demais")));
      this.s.on("data", d => { this.buf = Buffer.concat([this.buf, d]); this.ver(); });
      this.s.on("error", e => { if (this.esperando) { const w = this.esperando; this.esperando = null; w.falha(e); } else falha(e); });
      this.esperando = { tag: "*", ok: () => ok(), falha };
      this.ver();
    });
  }
  // percorre o buffer pulando literais {n}; termina quando acha a linha marcada com a tag
  ver() {
    const w = this.esperando; if (!w) return;
    let i = 0;
    while (i < this.buf.length) {
      const fim = this.buf.indexOf("\r\n", i); if (fim < 0) return;
      const linha = this.buf.slice(i, fim).toString("latin1");
      const lit = linha.match(/\{(\d+)\}$/);
      if (lit) { const n = +lit[1]; if (fim + 2 + n > this.buf.length) return; i = fim + 2 + n; continue; }
      if (w.tag === "*" ? /^\* (OK|PREAUTH)/.test(linha) : linha.startsWith(w.tag + " ")) {
        const resp = this.buf.slice(0, fim + 2); this.buf = this.buf.slice(fim + 2); this.esperando = null;
        if (w.tag !== "*" && !/^\S+ OK/.test(linha)) return w.falha(new Error("E-mail recusou: " + linha.slice(0, 200)));
        return w.ok(resp);
      }
      if (w.tag === "*" && /^\* BYE/.test(linha)) { this.esperando = null; return w.falha(new Error(linha)); }
      i = fim + 2;
    }
  }
  cmd(texto) {
    const tag = "A" + (++this.n);
    return new Promise((ok, falha) => { this.esperando = { tag, ok, falha }; this.s.write(`${tag} ${texto}\r\n`); this.ver(); });
  }
  fim() { try { this.s.write("Z LOGOUT\r\n"); this.s.end(); } catch (e) {} }
}

const q = s => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
const MES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// separa as respostas FETCH: [{ uid, partes: { "HEADER": Buffer, "TEXT": Buffer } }]
function lerFetch(buf) {
  const out = []; let i = 0, atual = null;
  while (i < buf.length) {
    const fim = buf.indexOf("\r\n", i); if (fim < 0) break;
    let linha = buf.slice(i, fim).toString("latin1");
    if (/^\* \d+ FETCH/.test(linha)) { atual = { uid: null, partes: {} }; out.push(atual); }
    const u = linha.match(/UID (\d+)/); if (u && atual) atual.uid = +u[1];
    const lit = linha.match(/BODY\[([^\]]*)\](?:<\d+>)? \{(\d+)\}$/);
    if (lit && atual) {
      const n = +lit[2], dados = buf.slice(fim + 2, fim + 2 + n);
      atual.partes[/HEADER/.test(lit[1]) ? "HEADER" : "TEXT"] = dados; i = fim + 2 + n;
      // depois do literal pode vir o resto da linha (ex.: " UID 12)")
      const prox = buf.indexOf("\r\n", i); const resto = buf.slice(i, prox < 0 ? buf.length : prox).toString("latin1");
      const u2 = resto.match(/UID (\d+)/); if (u2) atual.uid = +u2[1];
      continue;
    }
    i = fim + 2;
  }
  return out;
}

/* ---------- decodificação ---------- */
function decQP(s) { return Buffer.from(s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1"); }
function decB64(s) { const t = s.replace(/[^A-Za-z0-9+/=]/g, ""); return Buffer.from(t.slice(0, t.length - (t.length % 4)), "base64"); }
function charset(buf, cs) { cs = String(cs || "utf-8").toLowerCase(); return /8859|latin|1252|ascii/.test(cs) ? buf.toString("latin1") : buf.toString("utf8"); }
function decPalavras(s) {
  return String(s || "").replace(/\s+(?==\?)/g, "").replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, cs, tipo, txt) =>
    charset(tipo.toUpperCase() === "B" ? decB64(txt) : decQP(txt.replace(/_/g, " ")), cs));
}
function cabecalhos(texto) {
  const h = {}; String(texto).replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/).forEach(l => { const m = l.match(/^([\w-]+):\s*(.*)$/); if (m) h[m[1].toLowerCase()] = m[2]; });
  return h;
}
const endereco = de => ((String(de).match(/<([^>]+)>/) || [])[1] || (String(de).match(/[^\s<>"]+@[^\s<>"]+/) || [""])[0]).toLowerCase().trim();

// texto legível da mensagem (primeira parte text/plain, ou html sem tags), sem a mensagem citada
function textoDaMensagem(cab, corpo) {
  const ct = cab["content-type"] || "text/plain", cte = (cab["content-transfer-encoding"] || "").toLowerCase();
  let txt = "";
  const lim = (ct.match(/boundary="?([^";]+)"?/i) || [])[1];
  if (/multipart/i.test(ct) && lim) {
    const partes = corpo.toString("latin1").split("--" + lim);
    const parse = p => { const k = p.indexOf("\r\n\r\n") >= 0 ? p.indexOf("\r\n\r\n") : p.indexOf("\n\n"); if (k < 0) return null; return { h: cabecalhos(p.slice(0, k)), b: p.slice(k).replace(/^\s+/, "") }; };
    let escolhida = null, html = null;
    const visitar = lista => { for (const p of lista) { const x = parse(p); if (!x) continue; const t = x.h["content-type"] || "";
      const sub = (t.match(/boundary="?([^";]+)"?/i) || [])[1];
      if (/multipart/i.test(t) && sub) visitar(x.b.split("--" + sub));
      else if (/text\/plain/i.test(t) && !escolhida) escolhida = x; else if (/text\/html/i.test(t) && !html) html = x; } };
    visitar(partes);
    const x = escolhida || html;
    if (x) { const e = (x.h["content-transfer-encoding"] || "").toLowerCase(), cs = (x.h["content-type"].match(/charset="?([^";]+)/i) || [])[1];
      const raw = e === "base64" ? decB64(x.b) : e === "quoted-printable" ? decQP(x.b) : Buffer.from(x.b, "latin1");
      txt = charset(raw, cs); if (!escolhida) txt = htmlParaTexto(txt); }
  } else {
    const cs = (ct.match(/charset="?([^";]+)/i) || [])[1];
    const raw = cte === "base64" ? decB64(corpo.toString("latin1")) : cte === "quoted-printable" ? decQP(corpo.toString("latin1")) : corpo;
    txt = charset(raw, cs); if (/html/i.test(ct)) txt = htmlParaTexto(txt);
  }
  return limparCitacao(txt);
}
function htmlParaTexto(h) { return h.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"'); }
function limparCitacao(t) {
  const linhas = String(t).replace(/\r/g, "").split("\n"), out = [];
  for (const l of linhas) {
    if (/^\s*>/.test(l)) break;
    if (/^(Em|On) .{5,120}(escreveu|wrote):?\s*$/i.test(l.trim()) || /^-{2,}\s*(Mensagem original|Original Message)/i.test(l.trim()) || /^(De|From):\s.+@/i.test(l.trim())) break;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}

/* Lê as mensagens recebidas desde `desde` e devolve as que vêm de um dos remetentes procurados.
   procurar(endereco) → item ou null. Retorna [{ item, de, assunto, data, texto }] */
async function buscarRespostas(desde, procurar) {
  const host = process.env.IMAP_HOST || process.env.SMTP_HOST, porta = parseInt(process.env.IMAP_PORT) || 993;
  const user = process.env.IMAP_USER || process.env.SMTP_USER, pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("Configure o e-mail do cPanel na Vercel (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  const c = new Imap();
  try {
    await c.conectar(host, porta);
    await c.cmd(`LOGIN ${q(user)} ${q(pass)}`).catch(() => { throw new Error("Login no e-mail recusado (confira usuário e senha)"); });
    await c.cmd("EXAMINE INBOX"); // só leitura
    const d = new Date(desde); const data = `${d.getUTCDate()}-${MES[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    const busca = (await c.cmd(`UID SEARCH SINCE ${data}`)).toString("latin1");
    const uids = ((busca.match(/^\* SEARCH([\d ]*)/m) || [])[1] || "").trim().split(/\s+/).filter(Boolean).map(Number).slice(-400);
    if (!uids.length) return [];
    const cabs = lerFetch(await c.cmd(`UID FETCH ${uids.join(",")} (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE CONTENT-TYPE CONTENT-TRANSFER-ENCODING)])`));
    const achadas = [];
    for (const m of cabs) {
      const h = cabecalhos((m.partes.HEADER || Buffer.alloc(0)).toString("latin1")), de = endereco(h.from || "");
      const item = de && procurar(de); if (!item) continue;
      const quando = new Date(h.date || Date.now());
      achadas.push({ uid: m.uid, item, de, assunto: decPalavras(h.subject || ""), data: isNaN(quando) ? new Date() : quando, cab: h });
    }
    if (achadas.length) {
      const corpos = lerFetch(await c.cmd(`UID FETCH ${achadas.map(a => a.uid).join(",")} (UID BODY.PEEK[TEXT]<0.12000>)`));
      for (const a of achadas) { const b = corpos.find(x => x.uid === a.uid); a.texto = b && b.partes.TEXT ? textoDaMensagem(a.cab, b.partes.TEXT) : ""; delete a.cab; }
    }
    return achadas;
  } finally { c.fim(); }
}

module.exports = { buscarRespostas, textoDaMensagem, limparCitacao, decPalavras };
