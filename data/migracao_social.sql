-- Parte 2: chat (sala, geral e direto), agenda de reuniões, avisos (menções, convites) e comentários nas tarefas.
-- Rode inteiro no Supabase → SQL Editor. Pode rodar mais de uma vez.

-- ---------- chat ----------
-- canal: 'geral' (a sala virtual toda), 'sala:<id da sala interna>' ou 'dm:<uuid menor>:<uuid maior>' (conversa direta)
create table if not exists public.mensagens (
  id        uuid primary key default gen_random_uuid(),
  mapa_id   text not null,
  canal     text not null,
  autor     uuid not null references public.perfis(id) default auth.uid(),
  texto     text not null check (length(texto) between 1 and 2000),
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_canal on public.mensagens (mapa_id, canal, criado_em desc);
alter table public.mensagens enable row level security;
drop policy if exists "lê mensagens" on public.mensagens;
create policy "lê mensagens" on public.mensagens for select to authenticated
  using (canal not like 'dm:%' or canal like '%' || auth.uid()::text || '%');
drop policy if exists "envia mensagens" on public.mensagens;
create policy "envia mensagens" on public.mensagens for insert to authenticated
  with check (autor = auth.uid() and (canal not like 'dm:%' or canal like '%' || auth.uid()::text || '%'));
drop policy if exists "apaga a própria mensagem" on public.mensagens;
create policy "apaga a própria mensagem" on public.mensagens for delete to authenticated using (autor = auth.uid() or public.e_admin());

-- ---------- agenda ----------
create table if not exists public.reunioes (
  id         uuid primary key default gen_random_uuid(),
  mapa_id    text not null,
  sala_id    text,
  sala_nome  text,
  titulo     text not null check (length(titulo) between 1 and 160),
  pauta      text,
  inicio     timestamptz not null,
  fim        timestamptz not null,
  convidados uuid[] not null default '{}',
  criado_por uuid not null references public.perfis(id) default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index if not exists reunioes_inicio on public.reunioes (mapa_id, inicio);
alter table public.reunioes enable row level security;
drop policy if exists "vê reuniões" on public.reunioes;
create policy "vê reuniões" on public.reunioes for select to authenticated using (true);
drop policy if exists "marca reunião" on public.reunioes;
create policy "marca reunião" on public.reunioes for insert to authenticated with check (criado_por = auth.uid());
drop policy if exists "muda a própria reunião" on public.reunioes;
create policy "muda a própria reunião" on public.reunioes for update to authenticated using (criado_por = auth.uid() or public.e_admin());
drop policy if exists "cancela a própria reunião" on public.reunioes;
create policy "cancela a própria reunião" on public.reunioes for delete to authenticated using (criado_por = auth.uid() or public.e_admin());

-- ---------- avisos (menções, convites de reunião, tarefas atribuídas) ----------
create table if not exists public.avisos (
  id        uuid primary key default gen_random_uuid(),
  para      uuid not null references public.perfis(id) on delete cascade,
  de        uuid references public.perfis(id) default auth.uid(),
  tipo      text not null,               -- mencao | reuniao | tarefa
  texto     text not null,
  dados     jsonb not null default '{}', -- { mapa, tarefa, reuniao, sala }
  lido      boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_para on public.avisos (para, lido, criado_em desc);
alter table public.avisos enable row level security;
drop policy if exists "vê os próprios avisos" on public.avisos;
create policy "vê os próprios avisos" on public.avisos for select to authenticated using (para = auth.uid());
drop policy if exists "manda aviso" on public.avisos;
create policy "manda aviso" on public.avisos for insert to authenticated with check (de = auth.uid() and para <> auth.uid());
drop policy if exists "marca aviso como lido" on public.avisos;
create policy "marca aviso como lido" on public.avisos for update to authenticated using (para = auth.uid()) with check (para = auth.uid());
drop policy if exists "apaga o próprio aviso" on public.avisos;
create policy "apaga o próprio aviso" on public.avisos for delete to authenticated using (para = auth.uid());

-- ---------- comentários nas tarefas (gravados sem sobrescrever o resto da tarefa) ----------
alter table public.tarefas add column if not exists comentarios jsonb not null default '[]'::jsonb;
create or replace function public.comentar_tarefa(p_tarefa text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare novo jsonb; nome text;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  if length(coalesce(trim(p_texto), '')) = 0 then raise exception 'comentário vazio'; end if;
  select p.nome into nome from public.perfis p where p.id = auth.uid();
  novo := jsonb_build_object('id', substr(md5(random()::text), 1, 10), 'autor', auth.uid(), 'nome', nome,
                             'texto', left(trim(p_texto), 1500), 'quando', now());
  update public.tarefas set comentarios = coalesce(comentarios, '[]'::jsonb) || novo, atualizado_em = now() where id = p_tarefa;
  if not found then raise exception 'tarefa não encontrada'; end if;
  return novo;
end $$;
grant execute on function public.comentar_tarefa(text, text) to authenticated;

-- ---------- tempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.mensagens; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reunioes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.avisos; exception when duplicate_object then null; end;
end $$;
