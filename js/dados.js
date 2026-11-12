/* ============================================================
   DADOS – Escritório Virtual Next Co.
   ------------------------------------------------------------
   ÚNICO arquivo do projeto que lê e grava dados.
   Grava no Supabase (projeto "escritorio-virtual"):
     perfis      – uma linha por pessoa (e-mail, nome, personagem, última posição, preferências)
     atividades  – tudo o que cada pessoa fez (só ela vê as próprias)
     mapas       – mapa do escritório (a equipe toda vê e edita)
     tarefas     – tarefas do telão (a equipe toda vê e edita)
   Login: link mágico enviado ao e-mail (Supabase Auth).
   As páginas só chamam as funções de `Dados`; o banco pode ser trocado aqui sem mexer nelas.
   ============================================================ */
(function () {
  const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const limpaEmail = (e) => String(e || "").trim().toLowerCase();
  const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpaEmail(e));
  const agora = () => new Date().toISOString();

  let usuarioAuth = null;   // auth.users
  let perfil = null;        // linha de perfis
  const mapas = {};         // cache dos mapas carregados

  const pronto = (async () => {
    const { data } = await sb.auth.getSession();
    usuarioAuth = data.session ? data.session.user : null;
    if (usuarioAuth) await carregarPerfil();
    return usuarioAuth;
  })();
  sb.auth.onAuthStateChange((_ev, sessao) => { usuarioAuth = sessao ? sessao.user : null; });

  async function carregarPerfil() {
    const { data } = await sb.from("perfis").select("*").eq("id", usuarioAuth.id).maybeSingle();
    perfil = data || null;
    return perfil;
  }
  const paraUsuario = (p) => p && ({ id: p.id, email: p.email, nome: p.nome, papel: p.papel || "usuario", avatar: p.avatar, posicao: p.posicao, prefs: p.prefs || {}, criadoEm: p.criado_em, ultimoAcesso: p.ultimo_acesso });
  const paraTarefa = (r) => ({ id: r.id, titulo: r.titulo, descricao: r.descricao || "", responsavel: r.responsavel || "", prazo: r.prazo || "", status: r.status,
    etapas: r.etapas || [], progressoManual: r.progresso_manual ?? 0, ordem: r.ordem, sala: r.sala ?? null, historico: r.historico || [], criadoPor: r.criado_por, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em });
  const daTarefa = (t) => ({ id: t.id, titulo: t.titulo, descricao: t.descricao || null, responsavel: t.responsavel || null, prazo: t.prazo || null, status: t.status || "a_fazer",
    etapas: t.etapas || [], progresso_manual: t.etapas && t.etapas.length ? null : (+t.progressoManual || 0), ordem: t.ordem ?? 0, historico: t.historico || [], atualizado_em: agora() });

  const Dados = {
    cliente: sb,
    pronto,
    emailValido,

    /* ---------- login ---------- */
    sessao() { return usuarioAuth ? limpaEmail(usuarioAuth.email) : null; },
    meuId() { return usuarioAuth ? usuarioAuth.id : null; },
    async enviarLink(email, nome) {
      email = limpaEmail(email);
      if (!emailValido(email)) throw new Error("E-mail inválido");
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/", data: nome ? { nome: nome.trim() } : {} } });
      if (error) throw error;
    },
    /* Garante que quem acabou de entrar tem perfil. Retorna o usuário (com .novo). */
    async garantirPerfil() {
      await pronto; if (!usuarioAuth) return null;
      if (!perfil) await carregarPerfil();
      let novo = false;
      if (!perfil) {
        const nome = (usuarioAuth.user_metadata && usuarioAuth.user_metadata.nome) || usuarioAuth.email.split("@")[0];
        const { data, error } = await sb.from("perfis").insert({ id: usuarioAuth.id, email: limpaEmail(usuarioAuth.email), nome, ultimo_acesso: agora() }).select().single();
        if (error) throw error;
        perfil = data; novo = true;
        await this.registrarAtividade(null, "cadastro", "Primeiro acesso");
      } else {
        await sb.from("perfis").update({ ultimo_acesso: agora() }).eq("id", usuarioAuth.id);
        if (!sessionStorage.getItem("nextco_entrou")) await this.registrarAtividade(null, "entrou", "Entrou no escritório");
      }
      sessionStorage.setItem("nextco_entrou", "1");
      return { ...paraUsuario(perfil), novo };
    },
    /* Usado no topo de cada página: sem login, volta para a entrada. */
    async exigirSessao(destino = "index.html") {
      await pronto;
      if (!usuarioAuth) { location.href = destino; return null; }
      if (!perfil) await this.garantirPerfil();
      return this.sessao();
    },
    async sair() {
      await this.registrarAtividade(null, "saiu", "Saiu do escritório");
      sessionStorage.removeItem("nextco_entrou");
      await sb.auth.signOut();
    },

    /* ---------- pessoas ---------- */
    async getUsuario(_email) { if (!perfil && usuarioAuth) await carregarPerfil(); return paraUsuario(perfil); },
    async listarUsuarios() { const { data } = await sb.from("perfis").select("id,email,nome,avatar,papel").order("nome"); return (data || []).map(paraUsuario); },
    ehAdmin() { return !!perfil && perfil.papel === "admin"; },
    async token() { const { data } = await sb.auth.getSession(); return data.session ? data.session.access_token : null; },
    async definirPapel(id, papel) { const { error } = await sb.rpc("definir_papel", { p_usuario: id, p_papel: papel }); if (error) throw error; },
    async salvarNome(nome) { const { data } = await sb.from("perfis").update({ nome }).eq("id", usuarioAuth.id).select().single(); if (data) perfil = data; },
    async salvarAvatar(_email, avatar) {
      const primeiro = !perfil.avatar;
      const { data, error } = await sb.from("perfis").update({ avatar, avatar_atualizado_em: agora() }).eq("id", usuarioAuth.id).select().single();
      if (error) throw error; perfil = data;
      await this.registrarAtividade(null, "avatar", primeiro ? "Criou o personagem" : "Mudou o personagem");
      return true;
    },
    async salvarPosicao(_email, posicao) {
      if (!usuarioAuth) return false;
      const { error } = await sb.from("perfis").update({ posicao: { ...posicao, em: agora() } }).eq("id", usuarioAuth.id);
      return !error;
    },
    getPref(_email, chave, padrao) { return perfil && perfil.prefs && chave in perfil.prefs ? perfil.prefs[chave] : padrao; },
    async setPref(_email, chave, valor) { const prefs = { ...(perfil.prefs || {}), [chave]: valor }; perfil.prefs = prefs; await sb.from("perfis").update({ prefs }).eq("id", usuarioAuth.id); },

    /* ---------- atividades ---------- */
    async registrarAtividade(_email, tipo, detalhe, extra = {}) {
      if (!usuarioAuth) return false;
      const { sala, ...resto } = extra || {};
      const { error } = await sb.from("atividades").insert({ user_id: usuarioAuth.id, tipo, detalhe, sala: sala || null, extra: resto });
      return !error;
    },
    async listarAtividades(_email, limite = 100) {
      const { data } = await sb.from("atividades").select("tipo,detalhe,sala,extra,quando").eq("user_id", usuarioAuth.id).order("quando", { ascending: false }).limit(limite);
      return data || [];
    },

    /* ---------- mapas ---------- */
    mapaAtualId() { try { return localStorage.getItem("nextco_map_id") || "principal"; } catch (e) { return "principal"; } },
    async carregarMapa(id) {
      const { data } = await sb.from("mapas").select("dados").eq("id", id).maybeSingle();
      mapas[id] = data ? data.dados : null; return mapas[id];
    },
    lerMapaLocal(id) { return mapas[id] || null; },
    salvarMapaLocal(id, mapa) {
      mapas[id] = mapa; try { localStorage.setItem("nextco_map_id", id); } catch (e) {}
      return sb.from("mapas").upsert({ id, dados: mapa, atualizado_em: agora(), atualizado_por: usuarioAuth ? usuarioAuth.id : null })
        .then(({ error }) => { if (error) console.warn(error); return !error; });
    },
    async getMapa(id) { return this.carregarMapa(id || this.mapaAtualId()); },
    async listarMapas() { const { data } = await sb.from("mapas").select("id,dados->>name,atualizado_em").order("atualizado_em", { ascending: false }); return (data || []).map(m => ({ id: m.id, name: m.name, updatedAt: m.atualizado_em })); },
    ouvirMapa(id, cb) {
      return sb.channel("mapa-" + id).on("postgres_changes", { event: "*", schema: "public", table: "mapas", filter: `id=eq.${id}` },
        (p) => { if (p.new && p.new.dados) { mapas[id] = p.new.dados; cb(p.new.dados, p.new.atualizado_por); } }).subscribe();
    },

    /* ---------- tarefas do telão ---------- */
    async listarTarefas() { const { data } = await sb.from("tarefas").select("*").order("ordem"); return (data || []).map(paraTarefa); },
    async salvarTarefa(tarefa, _email, acao) {
      const nova = !tarefa.id;
      const t = { ...tarefa, id: tarefa.id || "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
      t.historico = (t.historico || []).concat([{ quando: agora(), email: this.sessao(), acao: acao || (nova ? "criou" : "editou") }]).slice(-50);
      const linha = daTarefa(t); if (nova) linha.criado_por = usuarioAuth.id;
      if (t.sala !== undefined) linha.sala = t.sala || null;
      let { data, error } = await sb.from("tarefas").upsert(linha).select().single();
      if (error && /sala/.test(error.message || "")) { delete linha.sala; ({ data, error } = await sb.from("tarefas").upsert(linha).select().single()); } // banco ainda sem a coluna
      if (error) throw error;
      await this.registrarAtividade(null, "tarefa", `${acao || (nova ? "Criou a tarefa" : "Editou a tarefa")}: ${t.titulo}`, { tarefa: t.id });
      return paraTarefa(data);
    },
    async salvarOrdem(lista) {
      await Promise.all(lista.map(o => sb.from("tarefas").update({ status: o.status, ordem: o.ordem }).eq("id", o.id)));
      return true;
    },
    async excluirTarefa(id, _email) {
      const { data } = await sb.from("tarefas").delete().eq("id", id).select("titulo").maybeSingle();
      if (data) await this.registrarAtividade(null, "tarefa", `Excluiu a tarefa: ${data.titulo}`);
      return true;
    },
    ouvirTarefas(cb) { return sb.channel("tarefas-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, () => cb()).subscribe(); },

    /* ---------- regras de acesso das salas (só admin altera) ---------- */
    async listarRegras(mapaId = "principal") { const { data } = await sb.from("regras_salas").select("*").eq("mapa_id", mapaId); return data || []; },
    ouvirRegras(cb) { return sb.channel("regras-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "regras_salas" }, () => cb()).subscribe(); },
    async definirRegraSala({ mapaId = "principal", salaId, restrita, permitidos, senha, trocarSenha, palestrante }) {
      const args = { p_mapa: mapaId, p_sala: salaId, p_restrita: !!restrita, p_permitidos: permitidos || [], p_senha: senha || null, p_trocar_senha: !!trocarSenha, p_palestrante: palestrante || null };
      let { error } = await sb.rpc("definir_regra_sala", args);
      if (error && !palestrante && /function|schema cache/i.test(error.message || "")) { delete args.p_palestrante; ({ error } = await sb.rpc("definir_regra_sala", args)); }
      if (error) throw error;
      await this.registrarAtividade(null, "admin", `Mudou as regras de acesso de uma sala`, { sala: salaId });
    },
    async conferirSenhaSala(salaId, senha, mapaId = "principal") { const { data, error } = await sb.rpc("conferir_senha_sala", { p_mapa: mapaId, p_sala: salaId, p_senha: senha }); return !error && data === true; },

    /* ---------- tendências de mercado (sala de TI) ---------- */
    async listarTendencias(limite = 100) { const { data } = await sb.from("tendencias").select("*").order("criado_em", { ascending: false }).limit(limite); return data || []; },
    ouvirTendencias(cb) { return sb.channel("tend-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "tendencias" }, () => cb()).subscribe(); },
    async mexerTendencia(id, acao) { const { data, error } = await sb.rpc("mexer_tendencia", { p_id: id, p_acao: acao }); if (error) throw error; return data; },
    async criarTendencia(t) { const { error } = await sb.from("tendencias").insert({ titulo: t.titulo, resumo: t.resumo || null, fonte_url: t.fonte_url || null, categoria: t.categoria || null, relevancia: t.relevancia || null, agente: "manual" }); if (error) throw error; },
    async excluirTendencia(id) { const { error } = await sb.from("tendencias").delete().eq("id", id); if (error) throw error; },
    async listarAgentes() { const { data } = await sb.from("agentes").select("*").order("id"); return data || []; },
    ouvirAgentes(cb) { return sb.channel("agentes-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "agentes" }, () => cb()).subscribe(); },

    /* ---------- meus dados ---------- */
    async exportarTudo() {
      return JSON.stringify({ usuario: paraUsuario(perfil), atividades: await this.listarAtividades(null, 1000) }, null, 2);
    },
  };
  window.Dados = Dados;
})();
