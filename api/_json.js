// lê o JSON da IA mesmo "sujo": texto antes/depois, ```json, quebra de linha dentro de texto, vírgula sobrando ou resposta cortada
function consertarJSON(t) {
  let out = "", dentro = false, esc = false; const pilha = [], cortes = [];
  for (let k = 0; k < t.length; k++) {
    const ch = t[k];
    if (dentro) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === "\\") { esc = true; out += ch; continue; }
      if (ch === '"') { dentro = false; out += ch; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r" || ch === "\t") { out += " "; continue; }
      out += ch; continue;
    }
    if (ch === '"') { dentro = true; out += ch; continue; }
    if (ch === "{" || ch === "[") pilha.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") { pilha.pop(); out += ch; cortes.push([out.length, pilha.slice()]); continue; }
    out += ch;
  }
  const limpar = x => x.replace(/,\s*([}\]])/g, "$1");
  const tentar = x => { try { return JSON.parse(limpar(x)); } catch (e) { return null; } };
  let o = tentar(out); if (o) return o;
  if (dentro) out += '"';
  o = tentar(out + pilha.slice().reverse().join("")); if (o) return o;
  // cortada no meio: volta até o último objeto/lista completo e fecha o resto
  for (let c = cortes.length - 1; c >= 0; c--) { const [pos, pl] = cortes[c]; o = tentar(out.slice(0, pos) + pl.slice().reverse().join("")); if (o) return o; }
  return null;
}
function lerJSON(txt) {
  txt = String(txt || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/gi, "");
  // tenta cada "{" (o raciocínio pode vir antes); fica com o primeiro objeto que tenha alguma lista dentro
  const ini = [...txt.matchAll(/\{/g)].map(m => m.index).slice(0, 40);
  for (const a of ini) {
    const o = consertarJSON(txt.slice(a));
    if (o && typeof o === "object" && !Array.isArray(o) && Object.values(o).some(Array.isArray)) return o;
  }
  const arr = txt.indexOf("["); // veio só uma lista: vira do primeiro agente
  if (arr >= 0) { const l = consertarJSON(txt.slice(arr)); if (Array.isArray(l)) return { agente1: l }; }
  return {};
}

module.exports = { consertarJSON, lerJSON };
