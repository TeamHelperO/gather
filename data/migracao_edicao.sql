-- Sala de Edição: agentes roteirista, diretor de cenas e editor + tabela de roteiros.
-- Rode uma vez no Supabase → SQL Editor.

insert into public.agentes (id, nome) values
  ('agente6','Pena'),('agente7','Claquete'),('agente8','Corte')
on conflict (id) do nothing;

create table if not exists public.roteiros (
  id uuid primary key default gen_random_uuid(),
  tendencia_id uuid references public.tendencias(id) on delete set null,
  titulo text not null,
  gancho text,
  roteiro text,
  formato text,
  cenas jsonb not null default '[]'::jsonb,   -- [{n, duracao, visual, fala, texto_tela, audio}]
  status text not null default 'rascunho' check (status in ('rascunho','aprovado','gravando','publicado','descartado')),
  agente text,
  pedido_por uuid,
  status_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists roteiros_criado on public.roteiros (criado_em desc);
alter table public.roteiros enable row level security;
drop policy if exists "equipe vê roteiros" on public.roteiros;
create policy "equipe vê roteiros" on public.roteiros for select to authenticated using (true);
drop policy if exists "admin exclui roteiros" on public.roteiros;
create policy "admin exclui roteiros" on public.roteiros for delete to authenticated using (public.e_admin());

-- mudar o status (qualquer pessoa da equipe)
create or replace function public.mexer_roteiro(p_id uuid, p_status text) returns public.roteiros
language plpgsql security definer set search_path = public as $$
declare r public.roteiros;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  update public.roteiros set status = p_status, status_por = auth.uid(), atualizado_em = now() where id = p_id returning * into r;
  return r;
end $$;
revoke execute on function public.mexer_roteiro(uuid,text) from public, anon;
grant execute on function public.mexer_roteiro(uuid,text) to authenticated;

-- o agente roteirista publica (chamado pelo servidor com a chave dos agentes)
create or replace function public.agente_roteiro(p_chave text, p_agente text, p_tendencia uuid, p_titulo text,
  p_gancho text, p_roteiro text, p_formato text, p_cenas jsonb, p_pedido_por uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  if nullif(trim(p_titulo),'') is null then raise exception 'título obrigatório'; end if;
  insert into public.roteiros (tendencia_id, titulo, gancho, roteiro, formato, cenas, agente, pedido_por)
  values (p_tendencia, left(trim(p_titulo), 200), left(p_gancho, 500), left(p_roteiro, 8000), left(p_formato, 60),
          coalesce(p_cenas, '[]'::jsonb), left(p_agente, 40), p_pedido_por)
  returning id into novo;
  update public.agentes set visto_em = now() where id = p_agente;
  return novo;
end $$;
grant execute on function public.agente_roteiro(text,text,uuid,text,text,text,text,jsonb,uuid) to anon, authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.roteiros; exception when duplicate_object then null; end;
end $$;
