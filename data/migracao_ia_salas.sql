-- IA no modelo SaaS: cada sala virtual tem os próprios agentes e tendências, e usa a IA do próprio cliente
-- (chave de API compatível com OpenAI e/ou a IA dele conectada por MCP). A sala da Next ("principal") continua
-- com a IA da Next (NVIDIA), e ninguém de outra sala vê ou mexe nessa configuração.
-- Rode inteiro no Supabase → SQL Editor. Pode rodar mais de uma vez.

alter table public.tendencias add column if not exists mapa_id text not null default 'principal';
alter table public.agentes    add column if not exists mapa_id text not null default 'principal';
create index if not exists tendencias_mapa on public.tendencias (mapa_id, criado_em desc);
create index if not exists agentes_mapa on public.agentes (mapa_id);

-- dono da sala virtual (quem criou) ou administrador geral
create or replace function public.dono_da_sala(p_mapa text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.e_admin() or exists (select 1 from public.mapas m where m.id = p_mapa and m.dados->'espaco'->>'dono' = auth.uid()::text);
$$;
grant execute on function public.dono_da_sala(text) to authenticated;

-- configuração de IA de cada sala: sem nenhuma política de leitura (a chave nunca volta para o navegador)
create table if not exists public.ia_salas (
  mapa_id        text primary key,
  base_url       text,
  modelo         text,
  chave          text,
  mcp_hash       text,
  mcp_final      text,
  atualizado_por uuid references public.perfis(id),
  atualizado_em  timestamptz not null default now(),
  ultima_rodada  timestamptz,
  ultimo_erro    text
);
alter table public.ia_salas enable row level security;
create unique index if not exists ia_salas_mcp on public.ia_salas (mcp_hash) where mcp_hash is not null;

-- o que o dono vê (sem a chave, só os 4 últimos caracteres)
create or replace function public.ia_sala_info(p_mapa text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.ia_salas;
begin
  if p_mapa = 'principal' or not public.dono_da_sala(p_mapa) then raise exception 'sem permissão'; end if;
  select * into r from public.ia_salas where mapa_id = p_mapa;
  return jsonb_build_object('base_url', r.base_url, 'modelo', r.modelo, 'tem_chave', r.chave is not null, 'chave_fim', right(coalesce(r.chave, ''), 4),
    'tem_mcp', r.mcp_hash is not null, 'mcp_fim', r.mcp_final, 'ultima_rodada', r.ultima_rodada, 'ultimo_erro', r.ultimo_erro);
end $$;
grant execute on function public.ia_sala_info(text) to authenticated;

-- salvar provedor/modelo/chave (chave vazia = mantém a atual; p_apagar_chave = tira)
create or replace function public.ia_sala_salvar(p_mapa text, p_base text, p_modelo text, p_chave text, p_apagar_chave boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_mapa = 'principal' or not public.dono_da_sala(p_mapa) then raise exception 'sem permissão'; end if;
  insert into public.ia_salas (mapa_id) values (p_mapa) on conflict do nothing;
  update public.ia_salas set base_url = nullif(trim(left(p_base, 300)), ''), modelo = nullif(trim(left(p_modelo, 120)), ''),
    chave = case when p_apagar_chave then null when nullif(trim(p_chave), '') is not null then trim(left(p_chave, 400)) else chave end,
    atualizado_por = auth.uid(), atualizado_em = now()
  where mapa_id = p_mapa;
end $$;
grant execute on function public.ia_sala_salvar(text, text, text, text, boolean) to authenticated;

-- token do MCP: o navegador gera, mostra uma vez e guarda só o hash (sha256 hex) e o final
create or replace function public.ia_sala_mcp(p_mapa text, p_hash text, p_final text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_mapa = 'principal' or not public.dono_da_sala(p_mapa) then raise exception 'sem permissão'; end if;
  insert into public.ia_salas (mapa_id) values (p_mapa) on conflict do nothing;
  update public.ia_salas set mcp_hash = nullif(p_hash, ''), mcp_final = nullif(left(p_final, 8), ''), atualizado_por = auth.uid(), atualizado_em = now() where mapa_id = p_mapa;
end $$;
grant execute on function public.ia_sala_mcp(text, text, text) to authenticated;

-- agentes de pesquisa da sala (cria os 5 padrão na primeira vez)
create or replace function public.agentes_sala_criar(p_mapa text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_mapa = 'principal' or not public.dono_da_sala(p_mapa) then raise exception 'sem permissão'; end if;
  select count(*) into n from public.agentes where mapa_id = p_mapa; if n > 0 then return n; end if;
  insert into public.agentes (id, nome, status, mapa_id, tipo, foco, categoria, ativo)
  select p_mapa || ':agente' || i, nome, 'parado', p_mapa, 'pesquisa', foco, cat, true
  from (values (1, 'Radar', 'redes sociais e anúncios', 'Social/Ads'), (2, 'Faro', 'mercado e concorrentes do seu segmento', 'Mercado'),
               (3, 'Lupa', 'conteúdo e formatos que estão engajando', 'Conteúdo'), (4, 'Pulso', 'inteligência artificial e ferramentas', 'IA/Tech'),
               (5, 'Bússola', 'oportunidades de negócio e clientes', 'Negócios')) v(i, nome, foco, cat);
  return 5;
end $$;
grant execute on function public.agentes_sala_criar(text) to authenticated;

create or replace function public.salvar_agente_sala(p_id text, p_campos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m text;
begin
  select mapa_id into m from public.agentes where id = p_id;
  if m is null or m = 'principal' or not public.dono_da_sala(m) then raise exception 'sem permissão'; end if;
  update public.agentes set
    nome = coalesce(nullif(trim(left(p_campos->>'nome', 30)), ''), nome),
    foco = left(p_campos->>'foco', 600), prompt = left(p_campos->>'prompt', 1500), categoria = left(p_campos->>'categoria', 40),
    ativo = coalesce((p_campos->>'ativo')::boolean, ativo)
  where id = p_id;
end $$;
grant execute on function public.salvar_agente_sala(text, jsonb) to authenticated;

-- tendências manuais: na sala da Next só admin (como antes); numa sala de cliente, o dono dela
drop policy if exists "admin cria tendências" on public.tendencias;
create policy "admin cria tendências" on public.tendencias for insert to authenticated
  with check (public.e_admin() or (mapa_id <> 'principal' and public.dono_da_sala(mapa_id)));
drop policy if exists "admin exclui tendências" on public.tendencias;
create policy "admin exclui tendências" on public.tendencias for delete to authenticated
  using (public.e_admin() or (mapa_id <> 'principal' and public.dono_da_sala(mapa_id)));
-- os agentes da Next só são editados por admin (política antiga); os de cliente, só pela função salvar_agente_sala

-- a IA da Next (NVIDIA) só enxerga os agentes da Next
create or replace function public.agentes_config(p_chave text) returns setof public.agentes
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  return query select * from public.agentes where mapa_id = 'principal' order by id;
end $$;

/* ---------- funções do servidor (chamadas com a chave dos agentes, AGENTES_CHAVE) ---------- */
create or replace function public.ia_sala_config(p_chave text, p_mapa text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.ia_salas;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  select * into r from public.ia_salas where mapa_id = p_mapa;
  return jsonb_build_object('base_url', r.base_url, 'modelo', r.modelo, 'chave', r.chave,
    'agentes', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.agentes a where a.mapa_id = p_mapa), '[]'::jsonb));
end $$;
grant execute on function public.ia_sala_config(text, text) to anon, authenticated;

create or replace function public.ia_salas_ativas(p_chave text) returns setof text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  return query select mapa_id from public.ia_salas where chave is not null and base_url is not null and modelo is not null and mapa_id <> 'principal';
end $$;
grant execute on function public.ia_salas_ativas(text) to anon, authenticated;

create or replace function public.ia_sala_registrar(p_chave text, p_mapa text, p_erro text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  update public.ia_salas set ultima_rodada = now(), ultimo_erro = left(p_erro, 500) where mapa_id = p_mapa;
end $$;
grant execute on function public.ia_sala_registrar(text, text, text) to anon, authenticated;

create or replace function public.ia_sala_do_token(p_chave text, p_hash text) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  return (select mapa_id from public.ia_salas where mcp_hash = p_hash and mapa_id <> 'principal');
end $$;
grant execute on function public.ia_sala_do_token(text, text) to anon, authenticated;

create or replace function public.agente_publicar_sala(p_chave text, p_mapa text, p_agente text, p_titulo text, p_resumo text default null,
  p_fonte_url text default null, p_categoria text default null, p_relevancia int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare novo uuid; ag text;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  if p_mapa = 'principal' then raise exception 'use agente_publicar'; end if;
  if nullif(trim(p_titulo), '') is null then raise exception 'título obrigatório'; end if;
  select id into ag from public.agentes where mapa_id = p_mapa and (id = p_agente or id = p_mapa || ':' || p_agente or lower(nome) = lower(p_agente)) limit 1;
  select id into novo from public.tendencias where mapa_id = p_mapa and lower(titulo) = lower(trim(p_titulo)) and criado_em > now() - interval '1 day' limit 1;
  if novo is not null then return novo; end if;
  insert into public.tendencias (titulo, resumo, fonte_url, categoria, relevancia, agente, mapa_id)
  values (left(trim(p_titulo), 200), left(p_resumo, 2000), left(p_fonte_url, 500), left(p_categoria, 60),
          case when p_relevancia between 1 and 5 then p_relevancia end, coalesce(ag, left(p_agente, 40)), p_mapa)
  returning id into novo;
  if ag is not null then update public.agentes set visto_em = now() where id = ag; end if;
  return novo;
end $$;
grant execute on function public.agente_publicar_sala(text, text, text, text, text, text, text, int) to anon, authenticated;

create or replace function public.agente_status_sala(p_chave text, p_mapa text, p_agente text, p_status text, p_detalhe text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  update public.agentes set status = left(p_status, 40), detalhe = left(p_detalhe, 200), visto_em = now()
  where mapa_id = p_mapa and mapa_id <> 'principal' and (id = p_agente or id = p_mapa || ':' || p_agente or lower(nome) = lower(p_agente));
end $$;
grant execute on function public.agente_status_sala(text, text, text, text, text) to anon, authenticated;

-- MCP: tendências e tarefas da sala
create or replace function public.mcp_dados(p_chave text, p_mapa text, p_limite int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare salas jsonb;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  select coalesce(m.dados->'rooms', '[]'::jsonb) into salas from public.mapas m where m.id = p_mapa;
  return jsonb_build_object(
    'salas', (select coalesce(jsonb_agg(jsonb_build_object('id', r->>'id', 'nome', r->>'name', 'tipo', r->>'type')), '[]'::jsonb) from jsonb_array_elements(salas) r),
    'tendencias', coalesce((select jsonb_agg(x) from (select id, titulo, resumo, categoria, relevancia, agente, decisao, criado_em from public.tendencias where mapa_id = p_mapa order by criado_em desc limit greatest(1, least(p_limite, 100))) x), '[]'::jsonb),
    'tarefas', coalesce((select jsonb_agg(x) from (select id, titulo, descricao, responsavel, prazo, status, sala from public.tarefas t
       where t.sala in (select r->>'id' from jsonb_array_elements(salas) r) order by t.atualizado_em desc limit 100) x), '[]'::jsonb));
end $$;
grant execute on function public.mcp_dados(text, text, int) to anon, authenticated;

create or replace function public.mcp_criar_tarefa(p_chave text, p_mapa text, p_titulo text, p_descricao text, p_prazo date, p_sala text) returns text
language plpgsql security definer set search_path = public as $$
declare salas jsonb; sid text; tid text;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  if nullif(trim(p_titulo), '') is null then raise exception 'título obrigatório'; end if;
  select coalesce(m.dados->'rooms', '[]'::jsonb) into salas from public.mapas m where m.id = p_mapa;
  select r->>'id' into sid from jsonb_array_elements(salas) r where lower(r->>'name') = lower(coalesce(p_sala, '')) or r->>'id' = p_sala limit 1;
  if sid is null then select r->>'id' into sid from jsonb_array_elements(salas) r where r->>'type' = 'trabalho' limit 1; end if;
  if sid is null then select r->>'id' into sid from jsonb_array_elements(salas) r where r->>'type' <> 'corredor' limit 1; end if;
  if sid is null then raise exception 'a sala não tem ambientes'; end if;
  tid := 't' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  insert into public.tarefas (id, titulo, descricao, prazo, status, etapas, ordem, historico, criado_por, sala)
  values (tid, left(trim(p_titulo), 120), left(p_descricao, 1000), p_prazo, 'a_fazer', '[]'::jsonb, 0,
          jsonb_build_array(jsonb_build_object('quando', now(), 'email', 'ia', 'acao', 'Criada pela IA (MCP)')), null, sid);
  return tid;
end $$;
grant execute on function public.mcp_criar_tarefa(text, text, text, text, date, text) to anon, authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.tendencias; exception when duplicate_object then null; end;
end $$;
