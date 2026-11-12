/* Regras de acesso das salas e painel do administrador.
   Papéis: "admin" (define regras e papéis) e "usuario".
   Cada sala pode ter:
     – senha: quem souber a senha entra (vale até fechar o navegador);
     – restrita + lista de pessoas: só essas pessoas entram (se também tiver senha, quem souber a senha entra).
   Admin entra em qualquer sala. As regras ficam no banco (regras_salas); a senha só em hash, conferida pelo banco. */
window.Acesso = (function () {
  let regras = new Map(), opt = null, usuarios = [], ultimaTentativa = 0, modal = null;
  const CHAVE_LIB = "nextco_salas_liberadas";
  const liberadas = new Set((() => { try { return JSON.parse(sessionStorage.getItem(CHAVE_LIB) || "[]"); } catch (e) { return []; } })());
  const guardar = () => { try { sessionStorage.setItem(CHAVE_LIB, JSON.stringify([...liberadas])); } catch (e) {} };

  async function iniciar(o) {
    opt = o;
    try { usuarios = await Dados.listarUsuarios(); } catch (e) {}
    await recarregar();
    Dados.ouvirRegras(recarregar);
  }
  async function recarregar() {
    const lista = await Dados.listarRegras(opt.mapaId);
    regras = new Map(lista.map(r => [r.sala_id, r]));
    opt.aoMudar && opt.aoMudar();
  }
  const admin = () => Dados.ehAdmin();
  const regraDe = sala => sala && regras.get(sala.id);
  const temRegra = r => r && (r.tem_senha || r.restrita);  // (palestrante não bloqueia a entrada)

  function podeEntrar(sala) {
    const r = regraDe(sala);
    if (!temRegra(r) || admin()) return true;
    const eu = Dados.meuId();
    if ((r.permitidos || []).includes(eu)) return true;
    if (r.tem_senha && liberadas.has(sala.id)) return true;
    return false;
  }
  /* palestrante fixo (priorizar): só essa pessoa usa o palco do auditório. null = qualquer um no palco */
  function palestranteDe(sala) { const r = sala && regras.get(sala.id || sala); return (r && r.palestrante) || null; }
  function podePalestrar(ator, sala) { const p = palestranteDe(sala); return !p || (ator && ator.id === p); }
  function nomeDe(id) { const u = usuarios.find(u => u.id === id); return u ? u.nome : "o palestrante"; }
  /* estado para mostrar no mapa: null | "senha" | "restrita" */
  function selo(sala) { const r = regraDe(sala); if (!temRegra(r)) return null; return r.tem_senha ? "senha" : "restrita"; }

  /* alguém bateu na porta de uma sala bloqueada */
  function tentou(sala) {
    const agora = performance.now(); if (modal || agora - ultimaTentativa < 1500) return; ultimaTentativa = agora;
    const r = regraDe(sala); if (!r) return;
    if (r.tem_senha) pedirSenha(sala);
    else opt.toast(`🔒 ${sala.name} é restrita: só pessoas liberadas pelo administrador`);
  }
  function pedirSenha(sala) {
    fechar();
    modal = document.createElement("div"); modal.className = "acc-bg";
    modal.innerHTML = `<form class="acc-win"><h3>🔑 ${esc(sala.name)}</h3>
      <p class="acc-mut">Esta sala tem senha. Digite para entrar.</p>
      <input type="password" name="s" placeholder="Senha da sala" autocomplete="off" required>
      <div class="acc-err"></div>
      <div class="acc-row"><button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Entrar</button></div></form>`;
    document.body.appendChild(modal);
    const f = modal.querySelector("form"), inp = f.querySelector("input");
    setTimeout(() => inp.focus(), 30);
    modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-x]")) fechar(); });
    f.addEventListener("submit", async e => {
      e.preventDefault(); const b = f.querySelector(".pri"); b.disabled = true; b.textContent = "Conferindo…";
      const ok = await Dados.conferirSenhaSala(sala.id, inp.value, opt.mapaId);
      if (ok) { liberadas.add(sala.id); guardar(); fechar(); opt.toast(`✅ Liberado: ${sala.name}`); Dados.registrarAtividade(null, "sala", `Entrou com senha em ${sala.name}`, { sala: sala.name }); }
      else { f.querySelector(".acc-err").textContent = "Senha errada"; b.disabled = false; b.textContent = "Entrar"; inp.select(); }
    });
  }
  function fechar() { if (modal) { modal.remove(); modal = null; } }

  /* ---------------- painel do administrador ---------------- */
  async function abrirAdmin() {
    if (!admin()) { opt.toast("Só administradores"); return; }
    usuarios = await Dados.listarUsuarios();
    fechar();
    modal = document.createElement("div"); modal.className = "acc-bg";
    modal.innerHTML = `<div class="acc-win larga"><h3>🛡️ Administração <button class="x" data-x aria-label="Fechar">×</button></h3><div class="acc-corpo"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", aoClicarAdmin);
    renderAdmin();
  }
  function renderAdmin(editando) {
    const corpo = modal && modal.querySelector(".acc-corpo"); if (!corpo) return;
    const salas = opt.salas().filter(s => s.type !== "corredor");
    const estado = s => { const r = regraDe(s); const pal = r && r.palestrante ? `<span class="st senha">🎤 ${esc(nomeDe(r.palestrante))}</span>` : "";
      if (!temRegra(r)) return pal || `<span class="st livre">🔓 Livre</span>`;
      const quem = (r.permitidos || []).length; return `<span class="st ${r.restrita ? "rest" : "senha"}">${r.restrita ? `🔒 Restrita · ${quem} pessoa${quem === 1 ? "" : "s"}` : ""}${r.restrita && r.tem_senha ? " + " : ""}${r.tem_senha ? "🔑 Senha" : ""}</span>${pal}`; };
    corpo.innerHTML = `
      <div class="acc-sec">Salas <small>(admin entra em todas)</small></div>
      ${salas.map(s => editando === s.id ? formSala(s) : `<div class="acc-sala"><b>${esc(s.name)}</b><small>${esc((TYPES[s.type] || {}).label || s.type)}</small>${estado(s)}<button class="btn" data-editar="${esc(s.id)}">Editar</button></div>`).join("")}
      <div class="acc-sec">Pessoas e papéis</div>
      ${usuarios.map(u => `<div class="acc-sala"><b>${esc(u.nome)}</b><small>${esc(u.email)}</small>
        <select data-papel="${esc(u.id)}"><option value="usuario"${u.papel !== "admin" ? " selected" : ""}>Usuário</option><option value="admin"${u.papel === "admin" ? " selected" : ""}>Administrador</option></select></div>`).join("")}`;
  }
  function formSala(s) {
    const r = regraDe(s) || { restrita: false, permitidos: [], tem_senha: false };
    return `<form class="acc-form" data-sala="${esc(s.id)}"><b>${esc(s.name)}</b>
      <label class="ck"><input type="checkbox" name="restrita" ${r.restrita ? "checked" : ""}> Restringir: só estas pessoas entram</label>
      <div class="acc-pessoas">${usuarios.map(u => `<label class="ck"><input type="checkbox" name="p" value="${esc(u.id)}" ${(r.permitidos || []).includes(u.id) ? "checked" : ""}> ${esc(u.nome)}${u.papel === "admin" ? " <small>(admin)</small>" : ""}</label>`).join("")}</div>
      <div class="acc-sec2">Senha ${r.tem_senha ? `<span class="st senha">🔑 tem senha</span>` : `<span class="st livre">sem senha</span>`}</div>
      <input type="password" name="senha" placeholder="${r.tem_senha ? "Nova senha (deixe vazio para manter)" : "Definir senha (opcional)"}" autocomplete="new-password">
      ${r.tem_senha ? `<label class="ck"><input type="checkbox" name="tirar"> Remover a senha</label>` : ""}
      <div class="acc-mut">Com senha, quem souber a senha também entra. Pessoas marcadas entram sem senha.</div>
      ${s.type === "auditorio" ? `<div class="acc-sec2">🎤 Priorizar palestrante</div>
        <select name="palestrante" class="acc-sel"><option value="">Qualquer pessoa que subir no palco</option>${usuarios.map(u => `<option value="${esc(u.id)}" ${r.palestrante === u.id ? "selected" : ""}>Só ${esc(u.nome)}</option>`).join("")}</select>
        <div class="acc-mut">Com um palestrante definido, outras pessoas podem subir no palco, mas não compartilham a tela nem controlam os microfones.</div>` : ""}
      <div class="acc-row"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`;
  }
  async function aoClicarAdmin(e) {
    if (e.target === modal || e.target.closest("[data-x]")) return fechar();
    const ed = e.target.closest("[data-editar]"); if (ed) return renderAdmin(ed.dataset.editar);
    if (e.target.closest("[data-cancelar]")) return renderAdmin();
  }
  document.addEventListener("submit", async e => {
    const f = e.target.closest && e.target.closest(".acc-form"); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f), senha = fd.get("senha") || "", tirar = !!fd.get("tirar");
    try {
      await Dados.definirRegraSala({ mapaId: opt.mapaId, salaId: f.dataset.sala, restrita: !!fd.get("restrita"), permitidos: fd.getAll("p"), senha: tirar ? "" : senha, trocarSenha: tirar || !!senha, palestrante: fd.get("palestrante") || null });
      await recarregar(); renderAdmin(); opt.toast("Regras da sala salvas");
    } catch (err) { opt.toast("Não foi possível salvar: " + (err.message || err)); }
  });
  document.addEventListener("change", async e => {
    const s = e.target.closest && e.target.closest("[data-papel]"); if (!s) return;
    try { await Dados.definirPapel(s.dataset.papel, s.value); usuarios = await Dados.listarUsuarios(); opt.toast("Papel atualizado"); }
    catch (err) { opt.toast(err.message && /pelo menos um/.test(err.message) ? "Precisa existir pelo menos um administrador" : "Não foi possível mudar o papel"); usuarios = await Dados.listarUsuarios(); renderAdmin(); }
  });

  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  return { iniciar, podeEntrar, tentou, selo, abrirAdmin, recarregar, palestranteDe, podePalestrar, nomeDe, get aberto() { return !!modal; } };
})();
