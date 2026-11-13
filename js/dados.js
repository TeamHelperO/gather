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
    etapas: r.etapas || [], progressoManual: r.progresso_manual ?? 0, ordem: r.ordem, sala: r.sala ?? null, historico: r.historico || [], comentarios: r.comentarios || [], criadoPor: r.criado_por, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em });
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

    /* ---------- chat ---------- */
    canalDM(outro) { const eu = this.meuId(); return "dm:" + [eu, outro].sort().join(":"); },
    async listarMensagens(mapa, canal, n = 60) {
      const { data, error } = await sb.from("mensagens").select("*").eq("mapa_id", mapa).eq("canal", canal).order("criado_em", { ascending: false }).limit(n);
      if (error) return null; return (data || []).reverse();
    },
    // últimas mensagens diretas (para a lista de conversas e contagem de não lidas)
    async listarDMs(mapa, n = 200) {
      const { data, error } = await sb.from("mensagens").select("*").eq("mapa_id", mapa).like("canal", "dm:%").order("criado_em", { ascending: false }).limit(n);
      if (error) return null; return data || [];
    },
    async enviarMensagem(mapa, canal, texto) {
      const { data, error } = await sb.from("mensagens").insert({ mapa_id: mapa, canal, texto }).select().single();
      if (error) throw error; return data;
    },
    async apagarMensagem(id) { const { error } = await sb.from("mensagens").delete().eq("id", id); if (error) throw error; },
    ouvirMensagens(mapa, cb) { return sb.channel("msg-" + mapa + "-" + Math.random().toString(36).slice(2, 6)).on("postgres_changes", { event: "*", schema: "public", table: "mensagens", filter: `mapa_id=eq.${mapa}` }, p => cb(p)).subscribe(); },

    /* ---------- agenda ---------- */
    async listarReunioes(mapa, desde) {
      const { data, error } = await sb.from("reunioes").select("*").eq("mapa_id", mapa).gte("fim", desde || new Date(Date.now() - 6 * 3600e3).toISOString()).order("inicio").limit(200);
      if (error) return null; return data || [];
    },
    async salvarReuniao(r) {
      const q = r.id ? sb.from("reunioes").update(r).eq("id", r.id) : sb.from("reunioes").insert(r);
      const { data, error } = await q.select().single(); if (error) throw error; return data;
    },
    async excluirReuniao(id) { const { error } = await sb.from("reunioes").delete().eq("id", id); if (error) throw error; },
    ouvirReunioes(mapa, cb) { return sb.channel("reun-" + mapa + "-" + Math.random().toString(36).slice(2, 6)).on("postgres_changes", { event: "*", schema: "public", table: "reunioes", filter: `mapa_id=eq.${mapa}` }, () => cb()).subscribe(); },

    /* ---------- avisos (menções, convites, tarefas) ---------- */
    async listarAvisos(n = 40) { const { data, error } = await sb.from("avisos").select("*").eq("para", this.meuId()).order("criado_em", { ascending: false }).limit(n); if (error) return null; return data || []; },
    async criarAvisos(lista) { const l = lista.filter(a => a.para && a.para !== this.meuId()); if (!l.length) return; const { error } = await sb.from("avisos").insert(l); if (error) console.warn("avisos:", error.message); },
    async marcarAvisosLidos(ids) { if (!ids.length) return; await sb.from("avisos").update({ lido: true }).in("id", ids); },
    ouvirAvisos(cb) { const eu = this.meuId(); return sb.channel("avisos-" + eu).on("postgres_changes", { event: "INSERT", schema: "public", table: "avisos", filter: `para=eq.${eu}` }, p => cb(p.new)).subscribe(); },
    async comentarTarefa(id, texto) { const { data, error } = await sb.rpc("comentar_tarefa", { p_tarefa: id, p_texto: texto }); if (error) throw error; return data; },

    /* ---------- presença (minutos por estado, por dia) ---------- */
    async registrarPresenca(mapa, estado) { const { error } = await sb.rpc("registrar_presenca", { p_mapa: mapa, p_estado: estado }); return !error; },
    async listarPresenca(mapa, desdeDia) { const { data, error } = await sb.from("presenca_dia").select("*").eq("mapa_id", mapa).gte("dia", desdeDia).order("dia"); if (error) return null; return data || []; },

    /* ---------- salas virtuais: cada uma é um mapa com um ID curto (o mapa "principal" é o escritório da Next Co.) ---------- */
    normalizarSala(id) {
      id = String(id || "").trim().toLowerCase().replace(/^.*[?&]sala=/, "").replace(/[^a-z0-9_-]/g, "");
      return id === "nextco" || id === "next" ? "principal" : id;
    },
    salaDaUrl() { try { const q = new URLSearchParams(location.search).get("sala"); return q ? this.normalizarSala(q) : null; } catch (e) { return null; } },
    ultimaSala() { try { return localStorage.getItem("nextco_sala") || null; } catch (e) { return null; } },
    lembrarSala(id, nome) {
      try {
        localStorage.setItem("nextco_sala", id);
        const l = this.salasRecentes().filter(x => x.id !== id); l.unshift({ id, nome: nome || id, em: Date.now() });
        localStorage.setItem("nextco_salas_recentes", JSON.stringify(l.slice(0, 12)));
      } catch (e) {}
    },
    esquecerSala(id) { try { localStorage.setItem("nextco_salas_recentes", JSON.stringify(this.salasRecentes().filter(x => x.id !== id))); if (this.ultimaSala() === id) localStorage.removeItem("nextco_sala"); } catch (e) {} },
    salasRecentes() { try { return JSON.parse(localStorage.getItem("nextco_salas_recentes") || "[]"); } catch (e) { return []; } },
    async minhasSalas() {
      const eu = this.meuId(); if (!eu) return [];
      const { data } = await sb.from("mapas").select("id,espaco:dados->espaco,atualizado_em").eq("dados->espaco->>dono", eu).order("atualizado_em", { ascending: false });
      return (data || []).map(m => ({ id: m.id, ...(m.espaco || {}) }));
    },
    async infoSala(id) {
      const { data } = await sb.from("mapas").select("id,espaco:dados->espaco,nome:dados->>name").eq("id", id).maybeSingle();
      if (!data) return null;
      const e = data.espaco || {};
      return { ...e, id: data.id, nome: e.nome || data.nome || id, modo: e.modo || "ambos" };
    },
    async criarSala({ nome, modo, mapa }) {
      const letras = "abcdefghjkmnpqrstuvwxyz23456789";
      for (let t = 0; t < 6; t++) {
        const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => letras[b % letras.length]).join("");
        const { data: ja } = await sb.from("mapas").select("id").eq("id", id).maybeSingle(); if (ja) continue;
        const dados = { ...mapa, name: nome, espaco: { nome, modo, dono: this.meuId(), dono_nome: perfil ? perfil.nome : "", criado_em: agora() } };
        const { error } = await sb.from("mapas").insert({ id, dados, atualizado_em: agora(), atualizado_por: this.meuId() });
        if (error) throw error;
        mapas[id] = dados; return id;
      }
      throw new Error("Não consegui gerar um ID livre, tente de novo");
    },
    async configurarSala(id, campos) {
      const m = await this.carregarMapa(id); if (!m) throw new Error("Sala não encontrada");
      m.espaco = { ...(m.espaco || {}), ...campos }; if (campos.nome) m.name = campos.nome;
      const { error } = await sb.from("mapas").update({ dados: m, atualizado_em: agora(), atualizado_por: this.meuId() }).eq("id", id);
      if (error) throw error;
      mapas[id] = m; return m;
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
    async listarTendencias(limite = 100) { let q = sb.from("tendencias").select("*"); const m = (window.mapaIdAtual || "principal"); q = m === "principal" ? q.or("mapa_id.eq.principal,mapa_id.is.null") : q.eq("mapa_id", m); const { data } = await q.order("criado_em", { ascending: false }).limit(limite); return data || []; },
    ouvirTendencias(cb) { return sb.channel("tend-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "tendencias" }, () => cb()).subscribe(); },
    async mexerTendencia(id, acao) { const { data, error } = await sb.rpc("mexer_tendencia", { p_id: id, p_acao: acao }); if (error) throw error; return data; },
    async criarTendencia(t) { const { error } = await sb.from("tendencias").insert({ titulo: t.titulo, resumo: t.resumo || null, fonte_url: t.fonte_url || null, categoria: t.categoria || null, relevancia: t.relevancia || null, agente: "manual", ...((window.mapaIdAtual || "principal") !== "principal" ? { mapa_id: (window.mapaIdAtual || "principal") } : {}) }); if (error) throw error; },
    async excluirTendencia(id) { const { error } = await sb.from("tendencias").delete().eq("id", id); if (error) throw error; },
    async listarRoteiros(limite = 100) { const { data } = await sb.from("roteiros").select("*").order("criado_em", { ascending: false }).limit(limite); return data || []; },
    ouvirRoteiros(cb) { return sb.channel("rot-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "roteiros" }, () => cb()).subscribe(); },
    async mexerRoteiro(id, status) { const { data, error } = await sb.rpc("mexer_roteiro", { p_id: id, p_status: status }); if (error) throw error; return data; },
    // vídeo do roteiro: sobe para o Storage (bucket "videos") e deixa o roteiro "aguardando aprovação"
    async salvarVideo(id, blob, ext) {
      const caminho = `${id}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("videos").upload(caminho, blob, { contentType: blob.type || ("video/" + ext), upsert: false });
      if (error) throw error;
      const { data, error: e2 } = await sb.rpc("salvar_video", { p_id: id, p_path: caminho, p_tipo: blob.type || ext });
      if (e2) throw e2; return data;
    },
    async urlVideo(caminho) { const { data, error } = await sb.storage.from("videos").createSignedUrl(caminho, 3600); if (error) throw error; return data.signedUrl; },
    async excluirRoteiro(id) { const { error } = await sb.from("roteiros").delete().eq("id", id); if (error) throw error; },
    async listarAgentes() { const m = (window.mapaIdAtual || "principal"); let q = sb.from("agentes").select("*"); q = m === "principal" ? q.or("mapa_id.eq.principal,mapa_id.is.null") : q.eq("mapa_id", m); const { data, error } = await q.order("id"); if (error && m === "principal") { const r = await sb.from("agentes").select("*").order("id"); return r.data || []; } return data || []; },
    // IA da sala virtual (modelo SaaS): a sala da Next não passa por aqui
    async iaSalaInfo(m) { const { data, error } = await sb.rpc("ia_sala_info", { p_mapa: m }); if (error) throw error; return data; },
    async iaSalaSalvar(m, c) { const { error } = await sb.rpc("ia_sala_salvar", { p_mapa: m, p_base: c.base_url || "", p_modelo: c.modelo || "", p_chave: c.chave || "", p_apagar_chave: !!c.apagar }); if (error) throw error; },
    async iaSalaMcp(m, hash, fim) { const { error } = await sb.rpc("ia_sala_mcp", { p_mapa: m, p_hash: hash || "", p_final: fim || "" }); if (error) throw error; },
    async agentesSalaCriar(m) { const { data, error } = await sb.rpc("agentes_sala_criar", { p_mapa: m }); if (error) throw error; return data; },
    async salvarAgenteSala(id, campos) { const { error } = await sb.rpc("salvar_agente_sala", { p_id: id, p_campos: campos }); if (error) throw error; },
    async tokenAtual() { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; },
    async salvarAgente(id, campos) { const { error } = await sb.from("agentes").update(campos).eq("id", id); if (error) throw error; },
    async listarProspects(n = 400) { const { data, error } = await sb.from("prospects").select("*").order("criado_em", { ascending: false }).limit(n); if (error) return null; return data || []; },
    ouvirProspects(cb) { return sb.channel("prosp-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => cb()).subscribe(); },
    async mexerProspect(id, campos) { const { error } = await sb.from("prospects").update(campos).eq("id", id); if (error) throw error; },
    async excluirProspect(id) { const { error } = await sb.from("prospects").delete().eq("id", id); if (error) throw error; },
    ouvirAgentes(cb) { return sb.channel("agentes-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", { event: "*", schema: "public", table: "agentes" }, () => cb()).subscribe(); },

    /* ---------- meus dados ---------- */
    async exportarTudo() {
      return JSON.stringify({ usuario: paraUsuario(perfil), atividades: await this.listarAtividades(null, 1000) }, null, 2);
    },
  };
  window.Dados = Dados;
})();
