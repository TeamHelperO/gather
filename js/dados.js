/* ============================================================
   DADOS – Escritório Virtual Next Co.
   ------------------------------------------------------------
   ÚNICO arquivo do projeto que lê e grava dados.
   Hoje grava no navegador (localStorage), separado por e-mail.
   Para usar um banco (Supabase, MySQL...), troque só o
   "ADAPTADOR" no fim deste arquivo: as páginas continuam iguais,
   porque todas chamam apenas as funções de `Dados`.
   As tabelas equivalentes estão em data/schema.sql.

   Estrutura salva (espelha as tabelas do banco):
   {
     versao: 1,
     usuarios:   { "<email>": { email, nome, criadoEm, ultimoAcesso,
                                avatar: {...camadas...},
                                posicao: { mapa, x, y, direcao } } },
     atividades: { "<email>": [ { tipo, detalhe, sala, quando } ] },
     mapas:      { "<id>": { name, w, h, rooms:[...], items:[...], updatedAt, atualizadoPor } },
     tarefas:    { "<id>": { id, titulo, descricao, responsavel, prazo, status, etapas:[{id,texto,feito}],
                             progressoManual, ordem, criadoPor, criadoEm, atualizadoEm, historico:[...] } },
     mapaAtual:  "principal"
   }
   ============================================================ */
(function () {
  const CHAVE = "nextco_dados";
  const SESSAO = "nextco_sessao";
  const MAX_ATIVIDADES = 1000;

  /* ---------- ADAPTADOR: localStorage ---------- */
  const armazenamento = {
    ler() {
      try {
        const bruto = localStorage.getItem(CHAVE);
        if (bruto) return JSON.parse(bruto);
      } catch (e) {}
      return migrarAntigo({ versao: 1, usuarios: {}, atividades: {}, mapas: {}, tarefas: {}, mapaAtual: "principal" });
    },
    gravar(db) {
      try { localStorage.setItem(CHAVE, JSON.stringify(db)); return true; }
      catch (e) { console.warn("Não foi possível salvar:", e); return false; }
    },
  };

  // Traz mapas salvos pela versão anterior do editor (chaves nextco_map_*)
  function migrarAntigo(db) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("nextco_map_") && k !== "nextco_map_id") {
          db.mapas[k.slice(11)] = JSON.parse(localStorage.getItem(k));
        }
      }
      const atual = localStorage.getItem("nextco_map_id");
      if (atual) db.mapaAtual = atual;
    } catch (e) {}
    return db;
  }

  const limpaEmail = (e) => String(e || "").trim().toLowerCase();
  const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpaEmail(e));
  const agora = () => new Date().toISOString();

  const Dados = {
    emailValido,

    /* ---- sessão ---- */
    sessao() { try { return localStorage.getItem(SESSAO); } catch (e) { return null; } },
    exigirSessao(destino = "index.html") {
      const email = this.sessao();
      if (!email || !armazenamento.ler().usuarios[email]) { location.href = destino; return null; }
      return email;
    },
    async entrar(email, nome) {
      email = limpaEmail(email);
      if (!emailValido(email)) throw new Error("E-mail inválido");
      const db = armazenamento.ler();
      let u = db.usuarios[email];
      const novo = !u;
      if (!u) u = db.usuarios[email] = { email, nome: (nome || email.split("@")[0]).trim(), criadoEm: agora(), avatar: null, posicao: null };
      else if (nome && nome.trim()) u.nome = nome.trim();
      u.ultimoAcesso = agora();
      armazenamento.gravar(db);
      try { localStorage.setItem(SESSAO, email); } catch (e) {}
      await this.registrarAtividade(email, novo ? "cadastro" : "entrou", novo ? "Primeiro acesso" : "Entrou no escritório");
      return { ...u, novo };
    },
    async sair() {
      const email = this.sessao();
      if (email) await this.registrarAtividade(email, "saiu", "Saiu do escritório");
      try { localStorage.removeItem(SESSAO); } catch (e) {}
    },
    async usuarioExiste(email) { return !!armazenamento.ler().usuarios[limpaEmail(email)]; },

    /* ---- usuário ---- */
    async getUsuario(email) { return armazenamento.ler().usuarios[limpaEmail(email)] || null; },
    async listarUsuarios() { return Object.values(armazenamento.ler().usuarios); },
    async salvarAvatar(email, avatar) {
      const db = armazenamento.ler(); const u = db.usuarios[limpaEmail(email)]; if (!u) return false;
      const primeiro = !u.avatar;
      u.avatar = avatar; u.avatarAtualizadoEm = agora();
      armazenamento.gravar(db);
      await this.registrarAtividade(email, "avatar", primeiro ? "Criou o personagem" : "Mudou o personagem");
      return true;
    },
    async salvarPosicao(email, posicao) {
      const db = armazenamento.ler(); const u = db.usuarios[limpaEmail(email)]; if (!u) return false;
      u.posicao = { ...posicao, em: agora() };
      return armazenamento.gravar(db);
    },

    /* ---- preferências da pessoa (ex.: mostrar colegas de teste) ---- */
    getPref(email, chave, padrao) { const u = armazenamento.ler().usuarios[limpaEmail(email)]; return u && u.prefs && chave in u.prefs ? u.prefs[chave] : padrao; },
    async setPref(email, chave, valor) { const db = armazenamento.ler(); const u = db.usuarios[limpaEmail(email)]; if (!u) return false; (u.prefs || (u.prefs = {}))[chave] = valor; return armazenamento.gravar(db); },

    /* ---- atividades (tudo o que a pessoa fez) ---- */
    async registrarAtividade(email, tipo, detalhe, extra = {}) {
      const db = armazenamento.ler(); email = limpaEmail(email);
      const lista = db.atividades[email] || (db.atividades[email] = []);
      lista.push({ tipo, detalhe, ...extra, quando: agora() });
      if (lista.length > MAX_ATIVIDADES) lista.splice(0, lista.length - MAX_ATIVIDADES);
      return armazenamento.gravar(db);
    },
    async listarAtividades(email, limite = 100) {
      const lista = armazenamento.ler().atividades[limpaEmail(email)] || [];
      return lista.slice(-limite).reverse();
    },

    /* ---- mapas ---- */
    mapaAtualId() { return armazenamento.ler().mapaAtual || "principal"; },
    lerMapaLocal(id) { return armazenamento.ler().mapas[id] || null; },
    salvarMapaLocal(id, mapa, email) {
      const db = armazenamento.ler();
      db.mapas[id] = { ...mapa, atualizadoPor: email || this.sessao() || null };
      db.mapaAtual = id;
      return armazenamento.gravar(db);
    },
    async getMapa(id) { return this.lerMapaLocal(id || this.mapaAtualId()); },
    async listarMapas() { const m = armazenamento.ler().mapas; return Object.keys(m).map(id => ({ id, name: m[id].name, updatedAt: m[id].updatedAt })); },

    /* ---- tarefas do telão (compartilhadas pela equipe) ---- */
    async listarTarefas() { const t = armazenamento.ler().tarefas || {}; return Object.values(t).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)); },
    async salvarTarefa(tarefa, email, acao) {
      const db = armazenamento.ler(); db.tarefas = db.tarefas || {};
      const nova = !tarefa.id || !db.tarefas[tarefa.id];
      const t = { ...tarefa, id: tarefa.id || "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        atualizadoEm: agora(), criadoEm: tarefa.criadoEm || agora(), criadoPor: tarefa.criadoPor || email || null };
      t.historico = (t.historico || []).concat([{ quando: agora(), email: email || null, acao: acao || (nova ? "criou" : "editou") }]).slice(-50);
      db.tarefas[t.id] = t; armazenamento.gravar(db);
      if (email) await this.registrarAtividade(email, "tarefa", `${acao || (nova ? "Criou a tarefa" : "Editou a tarefa")}: ${t.titulo}`, { tarefa: t.id });
      return t;
    },
    async salvarOrdem(lista) { // [{id, status, ordem}]
      const db = armazenamento.ler(); db.tarefas = db.tarefas || {};
      for (const o of lista) if (db.tarefas[o.id]) { db.tarefas[o.id].status = o.status; db.tarefas[o.id].ordem = o.ordem; }
      return armazenamento.gravar(db);
    },
    async excluirTarefa(id, email) {
      const db = armazenamento.ler(); const t = db.tarefas && db.tarefas[id]; if (!t) return false;
      delete db.tarefas[id]; armazenamento.gravar(db);
      if (email) await this.registrarAtividade(email, "tarefa", `Excluiu a tarefa: ${t.titulo}`);
      return true;
    },

    /* ---- backup / migração para o banco ---- */
    async exportarTudo() { return JSON.stringify(armazenamento.ler(), null, 2); },
    async importarTudo(json) {
      const d = typeof json === "string" ? JSON.parse(json) : json;
      if (!d || !d.usuarios || !d.mapas) throw new Error("Arquivo inválido");
      return armazenamento.gravar(d);
    },
  };

  window.Dados = Dados;
})();
