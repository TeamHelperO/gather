/* Relatório da semana: o mesmo cálculo no painel do gestor (navegador) e no e-mail automático (api/relatorio.js). */
(function (raiz) {
  const DIA = 864e5;
  const respsDe = t => String((t && t.responsavel) || "").split(";").map(x => x.trim()).filter(Boolean);
  const dataLocal = s => new Date(String(s).slice(0, 10) + "T00:00:00");
  const fmt = d => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const horas = m => { m = Math.round(m || 0); return m < 60 ? m + " min" : Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : ""); };

  function calcular({ tarefas, usuarios, presenca, hoje }) {
    hoje = hoje ? new Date(hoje) : new Date(); hoje.setHours(0, 0, 0, 0);
    const ini = new Date(hoje.getTime() - 7 * DIA), fimSemana = new Date(hoje.getTime() + 7 * DIA);
    const nome = r => { const u = (usuarios || []).find(u => u.email === r || u.id === r); return u ? u.nome : r; };
    const aberta = t => t.status !== "feito";
    const concluiuNaSemana = t => {
      if (t.status !== "feito") return null;
      const h = (t.historico || []).filter(x => /conclu/i.test(x.acao || "")).map(x => new Date(x.quando)).filter(d => d >= ini).pop();
      if (h) return h;
      const at = new Date(t.atualizadoEm || t.atualizado_em || 0); return at >= ini ? at : null;
    };
    const concluidas = [], atrasadas = [], vencendo = [], bloqueadas = [];
    for (const t of tarefas || []) {
      const c = concluiuNaSemana(t); if (c) concluidas.push({ t, quando: c });
      if (!aberta(t)) continue;
      if (t.status === "bloqueado") bloqueadas.push(t);
      if (t.prazo) { const p = dataLocal(t.prazo); if (p < hoje) atrasadas.push(t); else if (p < fimSemana) vencendo.push(t); }
    }
    atrasadas.sort((a, b) => a.prazo < b.prazo ? -1 : 1); vencendo.sort((a, b) => a.prazo < b.prazo ? -1 : 1);

    // por pessoa (responsáveis que são usuários e nomes livres)
    const p = new Map();
    const pessoa = chave => { const k = nome(chave); if (!p.has(k)) p.set(k, { nome: k, abertas: 0, atrasadas: 0, concluidas: 0, bloqueadas: 0, minOnline: 0, minReuniao: 0, minOcupado: 0, minAusente: 0, dias: 0 }); return p.get(k); };
    for (const t of tarefas || []) for (const r of respsDe(t)) {
      const x = pessoa(r);
      if (aberta(t)) { x.abertas++; if (t.status === "bloqueado") x.bloqueadas++; if (t.prazo && dataLocal(t.prazo) < hoje) x.atrasadas++; }
    }
    for (const { t } of concluidas) for (const r of respsDe(t)) pessoa(r).concluidas++;
    for (const d of presenca || []) {
      const u = (usuarios || []).find(u => u.id === d.usuario); if (!u) continue;
      const x = pessoa(u.email); x.minOnline += d.min_online || 0; x.minReuniao += d.min_reuniao || 0; x.minOcupado += d.min_ocupado || 0; x.minAusente += d.min_ausente || 0; if (d.min_online) x.dias++;
    }
    const lista = [...p.values()];
    const comTarefa = lista.filter(x => x.abertas), media = comTarefa.length ? comTarefa.reduce((s, x) => s + x.abertas, 0) / comTarefa.length : 0;
    for (const x of lista) x.sobrecarga = x.atrasadas >= 3 || (x.abertas >= 5 && x.abertas >= media * 1.5);
    lista.sort((a, b) => b.abertas - a.abertas || b.concluidas - a.concluidas || a.nome.localeCompare(b.nome));
    const total = (tarefas || []).length, abertas = (tarefas || []).filter(aberta).length;
    return { inicio: ini, fim: new Date(hoje), concluidas, atrasadas, vencendo, bloqueadas, pessoas: lista, total, abertas, nome, respsDe };
  }

  function texto(r, titulo) {
    const linhas = [`${titulo || "Relatório da semana"} (${fmt(r.inicio)} a ${fmt(r.fim)})`, "",
      `✅ Concluídas: ${r.concluidas.length}   ⚠ Atrasadas: ${r.atrasadas.length}   ⏳ Vencem em 7 dias: ${r.vencendo.length}   ⛔ Bloqueadas: ${r.bloqueadas.length}`, ""];
    if (r.concluidas.length) { linhas.push("Concluídas:"); r.concluidas.forEach(({ t }) => linhas.push(`• ${t.titulo}${r.respsDe(t).length ? " — " + r.respsDe(t).map(r.nome).join(", ") : ""}`)); linhas.push(""); }
    if (r.atrasadas.length) { linhas.push("Atrasadas:"); r.atrasadas.forEach(t => linhas.push(`• ${t.titulo} (prazo ${fmt(dataLocal(t.prazo))})${r.respsDe(t).length ? " — " + r.respsDe(t).map(r.nome).join(", ") : " — sem responsável"}`)); linhas.push(""); }
    if (r.pessoas.length) { linhas.push("Por pessoa:"); r.pessoas.forEach(x => linhas.push(`• ${x.nome}: ${x.abertas} abertas, ${x.atrasadas} atrasadas, ${x.concluidas} concluídas${x.minOnline ? `, ${horas(x.minOnline)} online (${horas(x.minReuniao)} em reunião)` : ""}${x.sobrecarga ? " ⚠ sobrecarregado" : ""}`)); }
    return linhas.join("\n");
  }

  function html(r, titulo, link) {
    const e = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const card = (n, l, cor) => `<td style="padding:10px 14px;background:#f6f5f2;border-radius:10px;text-align:center"><div style="font-size:24px;font-weight:800;color:${cor}">${n}</div><div style="font-size:12px;color:#6b6760">${l}</div></td>`;
    const li = (t, extra) => `<li style="margin:4px 0">${e(t.titulo)}<span style="color:#6b6760"> ${extra}</span></li>`;
    return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d1d1f;max-width:640px;margin:auto">
      <h2 style="margin:0 0 4px">${e(titulo || "Relatório da semana")}</h2><p style="color:#6b6760;margin:0 0 16px">${fmt(r.inicio)} a ${fmt(r.fim)}</p>
      <table cellspacing="8" style="width:100%"><tr>${card(r.concluidas.length, "concluídas", "#2e9e4c")}${card(r.atrasadas.length, "atrasadas", "#e5484d")}${card(r.vencendo.length, "vencem em 7 dias", "#d48a12")}${card(r.bloqueadas.length, "bloqueadas", "#6b6760")}</tr></table>
      ${r.atrasadas.length ? `<h3>⚠ Atrasadas</h3><ul>${r.atrasadas.map(t => li(t, `· prazo ${fmt(dataLocal(t.prazo))} · ${e(r.respsDe(t).map(r.nome).join(", ") || "sem responsável")}`)).join("")}</ul>` : ""}
      ${r.concluidas.length ? `<h3>✅ Concluídas na semana</h3><ul>${r.concluidas.map(({ t }) => li(t, `· ${e(r.respsDe(t).map(r.nome).join(", "))}`)).join("")}</ul>` : ""}
      ${r.vencendo.length ? `<h3>⏳ Vencem nos próximos 7 dias</h3><ul>${r.vencendo.map(t => li(t, `· ${fmt(dataLocal(t.prazo))} · ${e(r.respsDe(t).map(r.nome).join(", ") || "sem responsável")}`)).join("")}</ul>` : ""}
      <h3>👥 Por pessoa</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="text-align:left;color:#6b6760"><th>Pessoa</th><th>Abertas</th><th>Atrasadas</th><th>Concluídas</th><th>Online</th><th>Reunião</th></tr>
      ${r.pessoas.map(x => `<tr style="border-top:1px solid #e4dfd5${x.sobrecarga ? ";background:#fff3f0" : ""}"><td style="padding:6px 4px"><b>${e(x.nome)}</b>${x.sobrecarga ? " ⚠" : ""}</td><td>${x.abertas}</td><td>${x.atrasadas}</td><td>${x.concluidas}</td><td>${x.minOnline ? horas(x.minOnline) : "—"}</td><td>${x.minReuniao ? horas(x.minReuniao) : "—"}</td></tr>`).join("")}</table>
      ${link ? `<p style="margin-top:20px"><a href="${e(link)}" style="background:#3d5afe;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Abrir o escritório</a></p>` : ""}
      <p style="color:#9a958c;font-size:11.5px;margin-top:18px">⚠ = muitas tarefas abertas em relação à equipe ou 3+ atrasadas. Presença conta só minutos online por estado, sem áudio, tela ou conversas.</p></div>`;
  }

  const api = { calcular, texto, html, horas, respsDe };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.RelatorioCore = api;
})(typeof window !== "undefined" ? window : globalThis);
