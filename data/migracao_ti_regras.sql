-- Papéis (admin/usuário), regras de acesso das salas, tendências de mercado e agentes da sala de TI.

-- ---------- papéis ----------
alter table public.perfis add column if not exists papel text not null default 'usuario' check (papel in ('admin','usuario'));

create or replace function public.e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin');
$$;

-- ninguém muda o próprio papel pelo update comum: só admin, pela função definir_papel
create or replace function public.protege_papel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.papel is distinct from old.papel and not coalesce(current_setting('app.troca_papel', true), '') = 'sim' then
    new.papel := old.papel;
  end if;
  return new;
end $$;
drop trigger if exists protege_papel on public.perfis;
create trigger protege_papel before update on public.perfis for each row execute function public.protege_papel();
-- perfil novo sempre entra como usuário
create or replace function public.papel_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.papel := 'usuario'; return new; end $$;
drop trigger if exists papel_inicial on public.perfis;
create trigger papel_inicial before insert on public.perfis for each row execute function public.papel_inicial();

create or replace function public.definir_papel(p_usuario uuid, p_papel text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'só administradores'; end if;
  if p_papel not in ('admin','usuario') then raise exception 'papel inválido'; end if;
  if p_usuario = auth.uid() and p_papel <> 'admin' and (select count(*) from public.perfis where papel = 'admin') <= 1 then
    raise exception 'precisa existir pelo menos um administrador';
  end if;
  perform set_config('app.troca_papel', 'sim', true);
  update public.perfis set papel = p_papel where id = p_usuario;
end $$;

-- perfis criados antes de alguém virar admin: o dono do escritório
select set_config('app.troca_papel', 'sim', true);
update public.perfis set papel = 'admin' where email = 'rojersidney@gmail.com';

-- ---------- regras das salas ----------
create table if not exists public.regras_salas (
  mapa_id       text not null default 'principal',
  sala_id       text not null,
  tem_senha     boolean not null default false,
  restrita      boolean not null default false,
  permitidos    uuid[] not null default '{}',
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  primary key (mapa_id, sala_id)
);
alter table public.regras_salas enable row level security;
drop policy if exists "equipe vê regras" on public.regras_salas;
create policy "equipe vê regras" on public.regras_salas for select to authenticated using (true);
-- a senha (em hash) fica numa tabela que ninguém lê pela API
create table if not exists public.senhas_salas (
  mapa_id text not null, sala_id text not null, senha_hash text not null, primary key (mapa_id, sala_id)
);
alter table public.senhas_salas enable row level security;

create or replace function public.definir_regra_sala(p_mapa text, p_sala text, p_restrita boolean, p_permitidos uuid[], p_senha text, p_trocar_senha boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.e_admin() then raise exception 'só administradores'; end if;
  if p_trocar_senha then
    delete from public.senhas_salas where mapa_id = p_mapa and sala_id = p_sala;
    if nullif(p_senha,'') is not null then
      insert into public.senhas_salas values (p_mapa, p_sala, extensions.crypt(p_senha, extensions.gen_salt('bf')));
    end if;
  end if;
  insert into public.regras_salas (mapa_id, sala_id, restrita, permitidos, tem_senha, atualizado_por, atualizado_em)
  values (p_mapa, p_sala, coalesce(p_restrita,false), coalesce(p_permitidos,'{}'),
          exists (select 1 from public.senhas_salas where mapa_id = p_mapa and sala_id = p_sala), auth.uid(), now())
  on conflict (mapa_id, sala_id) do update set
    restrita = excluded.restrita, permitidos = excluded.permitidos, tem_senha = excluded.tem_senha,
    atualizado_por = auth.uid(), atualizado_em = now();
end $$;

create or replace function public.conferir_senha_sala(p_mapa text, p_sala text, p_senha text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select senha_hash = extensions.crypt(p_senha, senha_hash) from public.senhas_salas
                   where mapa_id = p_mapa and sala_id = p_sala), false);
$$;

-- ---------- tendências de mercado ----------
create table if not exists public.tendencias (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  resumo        text,
  fonte_url     text,
  categoria     text,
  relevancia    smallint check (relevancia between 1 and 5),
  agente        text,
  criado_em     timestamptz not null default now(),
  travada       boolean not null default false,
  travada_por   uuid references public.perfis(id),
  travada_em    timestamptz,
  decisao       text not null default 'pendente' check (decisao in ('pendente','pega','nao_pega')),
  decidido_por  uuid references public.perfis(id),
  decidido_em   timestamptz
);
create index if not exists tendencias_criado on public.tendencias (criado_em desc);
alter table public.tendencias enable row level security;
drop policy if exists "equipe vê tendências" on public.tendencias;
create policy "equipe vê tendências" on public.tendencias for select to authenticated using (true);
drop policy if exists "admin cria tendências" on public.tendencias;
create policy "admin cria tendências" on public.tendencias for insert to authenticated with check (public.e_admin());
drop policy if exists "admin exclui tendências" on public.tendencias;
create policy "admin exclui tendências" on public.tendencias for delete to authenticated using (public.e_admin());
-- mudanças só pela função (garante quem travou / quem decidiu)
create or replace function public.mexer_tendencia(p_id uuid, p_acao text) returns public.tendencias
language plpgsql security definer set search_path = public as $$
declare t public.tendencias; adm boolean := public.e_admin();
begin
  if auth.uid() is null then raise exception 'precisa entrar'; end if;
  select * into t from public.tendencias where id = p_id for update;
  if not found then raise exception 'tendência não existe'; end if;
  if p_acao = 'travar' then
    if t.travada and t.travada_por <> auth.uid() and not adm then raise exception 'já está travada por outra pessoa'; end if;
    update public.tendencias set travada = true, travada_por = auth.uid(), travada_em = now() where id = p_id returning * into t;
  elsif p_acao = 'destravar' then
    if t.travada and t.travada_por <> auth.uid() and not adm then raise exception 'só quem travou (ou um admin) destrava'; end if;
    update public.tendencias set travada = false, travada_por = null, travada_em = null where id = p_id returning * into t;
  elsif p_acao in ('pega','nao_pega','pendente') then
    if t.travada and t.travada_por <> auth.uid() and not adm then raise exception 'travada por outra pessoa'; end if;
    update public.tendencias set decisao = p_acao,
      decidido_por = case when p_acao = 'pendente' then null else auth.uid() end,
      decidido_em = case when p_acao = 'pendente' then null else now() end
    where id = p_id returning * into t;
  else raise exception 'ação inválida';
  end if;
  return t;
end $$;

-- ---------- agentes da sala de TI ----------
create table if not exists public.agentes (
  id            text primary key,              -- agente1 … agente5
  nome          text not null,
  status        text not null default 'parado',
  detalhe       text,
  visto_em      timestamptz
);
alter table public.agentes enable row level security;
drop policy if exists "equipe vê agentes" on public.agentes;
create policy "equipe vê agentes" on public.agentes for select to authenticated using (true);
drop policy if exists "admin edita agentes" on public.agentes;
create policy "admin edita agentes" on public.agentes for update to authenticated using (public.e_admin()) with check (public.e_admin());
insert into public.agentes (id, nome) values
  ('agente1','Radar'),('agente2','Faro'),('agente3','Lupa'),('agente4','Pulso'),('agente5','Bússola')
on conflict (id) do nothing;

-- chave dos agentes (só o hash fica no banco)
create table if not exists public.chaves_agentes (id text primary key, chave_hash text not null, criado_em timestamptz not null default now());
alter table public.chaves_agentes enable row level security;  -- sem políticas: ninguém lê pela API
insert into public.chaves_agentes (id, chave_hash) values ('principal', extensions.crypt('<CHAVE_DO_AGENTE>', extensions.gen_salt('bf')))
on conflict (id) do update set chave_hash = excluded.chave_hash;

create or replace function public.chave_agente_ok(p_chave text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.chaves_agentes where chave_hash = extensions.crypt(p_chave, chave_hash));
$$;
revoke execute on function public.chave_agente_ok(text) from public, anon, authenticated;

-- o agente publica uma tendência (chamada com a chave publicável + a chave do agente)
create or replace function public.agente_publicar(p_chave text, p_agente text, p_titulo text, p_resumo text default null,
  p_fonte_url text default null, p_categoria text default null, p_relevancia int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  if nullif(trim(p_titulo),'') is null then raise exception 'título obrigatório'; end if;
  -- evita repetir a mesma tendência no mesmo dia
  select id into novo from public.tendencias where lower(titulo) = lower(trim(p_titulo)) and criado_em > now() - interval '1 day' limit 1;
  if novo is not null then return novo; end if;
  insert into public.tendencias (titulo, resumo, fonte_url, categoria, relevancia, agente)
  values (left(trim(p_titulo), 200), left(p_resumo, 2000), left(p_fonte_url, 500), left(p_categoria, 60),
          case when p_relevancia between 1 and 5 then p_relevancia end, left(p_agente, 40))
  returning id into novo;
  update public.agentes set visto_em = now() where id = p_agente or nome = p_agente;
  return novo;
end $$;

-- o agente avisa o que está fazendo (aparece em cima dele no mapa)
create or replace function public.agente_status(p_chave text, p_agente text, p_status text, p_detalhe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  update public.agentes set status = left(p_status, 40), detalhe = left(p_detalhe, 200), visto_em = now()
  where id = p_agente or nome = p_agente;
end $$;
grant execute on function public.agente_publicar(text,text,text,text,text,text,int) to anon, authenticated;
grant execute on function public.agente_status(text,text,text,text) to anon, authenticated;

-- tempo real
do $$ begin
  begin alter publication supabase_realtime add table public.tendencias; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.agentes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.regras_salas; exception when duplicate_object then null; end;
end $$;
