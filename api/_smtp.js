/* SMTP mínimo, sem dependências (e-mail do cPanel). Usado por api/email.js e api/relatorio.js.
   Variáveis: SMTP_HOST, SMTP_PORT (465 SSL ou 587 STARTTLS), SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_COPIA, SMTP_SSL=1 (força SSL) */
const net = require("net"), tls = require("tls"), crypto = require("crypto");
/* ---------- SMTP mínimo (sem dependências) ---------- */
class Conversa {
  constructor(s) { this.ligar(s); }
  ligar(s) {
    this.s = s; this.buf = "";
    s.on("data", d => { this.buf += d.toString("utf8"); this.ver(); });
    s.on("error", e => { const w = this.w; this.w = null; if (w) w.falha(e); });
  }
  ver() {
    if (!this.w) return;
    const linhas = this.buf.split("\r\n");
    for (let i = 0; i < linhas.length - 1; i++) if (/^\d{3}( |$)/.test(linhas[i])) {
      const resp = linhas.slice(0, i + 1).join("\n"); this.buf = linhas.slice(i + 1).join("\r\n");
      const w = this.w; this.w = null; return w.ok({ cod: +linhas[i].slice(0, 3), texto: resp });
    }
  }
  async cmd(linha, esperado, mostrar) {
    const p = new Promise((ok, falha) => { this.w = { ok, falha }; });
    if (linha != null) this.s.write(linha + "\r\n");
    this.ver();
    const r = await p;
    if (!esperado.includes(r.cod)) throw new Error(`Servidor de e-mail recusou ${mostrar || (linha || "a conexão").split(" ")[0]}: ${r.texto.replace(/\s+/g, " ").slice(0, 200)}`);
    return r;
  }
}
const ssl = porta => porta === 465 || process.env.SMTP_SSL === "1";
function conectar(host, porta) {
  return new Promise((ok, falha) => {
    const s = ssl(porta) ? tls.connect({ host, port: porta, servername: host }) : net.connect({ host, port: porta });
    s.once(ssl(porta) ? "secureConnect" : "connect", () => ok(s));
    s.once("error", falha);
    s.setTimeout(20000, () => s.destroy(new Error("O servidor de e-mail demorou demais para responder")));
  });
}
const b64 = t => Buffer.from(t, "utf8").toString("base64");
const quebrar = t => t.replace(/.{1,76}/g, "$&\r\n");
const cab = t => /^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64(t)}?=`;
const endereco = t => ((String(t).match(/<([^>]+)>/) || [])[1] || String(t)).trim();
const remetente = t => { const m = String(t).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/); return m && m[1] ? `${cab(m[1])} <${m[2]}>` : endereco(t); };
const escHtml = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function montar({ de, para, assunto, corpo, html: htmlPronto }) {
  const dom = endereco(de).split("@")[1] || "localhost", lim = "=_nc_" + crypto.randomBytes(9).toString("hex");
  const html = htmlPronto || `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1d1d1f">` +
    corpo.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${escHtml(p).replace(/\n/g, "<br>")}</p>`).join("") + `</div>`;
  return [
    `From: ${remetente(de)}`, `To: <${para}>`, `Reply-To: <${endereco(de)}>`, `Subject: ${cab(assunto)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`, `Message-ID: <${crypto.randomUUID()}@${dom}>`,
    `List-Unsubscribe: <mailto:${endereco(de)}?subject=remover>`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${lim}"`, "",
    `--${lim}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", quebrar(b64(corpo)),
    `--${lim}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", quebrar(b64(html)),
    `--${lim}--`, "",
  ].join("\r\n");
}

async function enviarSMTP({ para, assunto, corpo, html }) {
  const host = process.env.SMTP_HOST, porta = parseInt(process.env.SMTP_PORT) || 465, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  const de = process.env.SMTP_FROM || user, copia = process.env.SMTP_COPIA;
  let s = await conectar(host, porta), c = new Conversa(s);
  try {
    await c.cmd(null, [220]);
    await c.cmd("EHLO nextco.vercel", [250]);
    if (!ssl(porta)) {
      await c.cmd("STARTTLS", [220]);
      s.removeAllListeners("data"); s.removeAllListeners("error");
      s = await new Promise((ok, falha) => { const t = tls.connect({ socket: s, servername: host }, () => ok(t)); t.once("error", falha); });
      c = new Conversa(s);
      await c.cmd("EHLO nextco.vercel", [250]);
    }
    await c.cmd("AUTH PLAIN " + Buffer.from(`\0${user}\0${pass}`).toString("base64"), [235], "o login (confira SMTP_USER e SMTP_PASS)");
    await c.cmd(`MAIL FROM:<${endereco(de)}>`, [250]);
    await c.cmd(`RCPT TO:<${para}>`, [250, 251], "o destinatário");
    if (copia) await c.cmd(`RCPT TO:<${endereco(copia)}>`, [250, 251], "a cópia");
    await c.cmd("DATA", [354]);
    await c.cmd(montar({ de, para, assunto, corpo, html }).replace(/\r\n\./g, "\r\n..") + "\r\n.", [250], "a mensagem");
    await c.cmd("QUIT", [221]).catch(() => {});
  } finally { s.end(); }
}

const smtpPronto = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
module.exports = { enviarSMTP, montar, smtpPronto };
