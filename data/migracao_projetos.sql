-- Projetos no telão: cada projeto tem responsável e prazo próprios, e dentro dele um Kanban de tarefas
-- (cada tarefa com o seu responsável e prazo). Pode rodar mais de uma vez.

create table if not exists public.projetos (
  id text primary key,
  titulo text not null,
  descricao text,
  responsavel text,               -- e-mail (ou nome) do responsável pelo projeto
  prazo date,                     -- entrega do projeto
  cor text default '#1a7f4b',
  sala text,                      -- telão (sala) onde o projeto aparece
  status text not null default 'ativo',   -- ativo | concluido | arquivado
  ordem integer default 0,
  historico jsonb default '[]'::jsonb,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
alter table public.projetos enable row level security;
drop policy if exists "equipe vê projetos" on public.projetos;
drop policy if exists "equipe cria projetos" on public.projetos;
drop policy if exists "equipe edita projetos" on public.projetos;
drop policy if exists "equipe exclui projetos" on public.projetos;
create policy "equipe vê projetos" on public.projetos for select to authenticated using (true);
create policy "equipe cria projetos" on public.projetos for insert to authenticated with check (true);
create policy "equipe edita projetos" on public.projetos for update to authenticated using (true) with check (true);
create policy "equipe exclui projetos" on public.projetos for delete to authenticated using (true);

-- tarefa ligada a um projeto (sem projeto = "tarefas avulsas", como era antes)
alter table public.tarefas add column if not exists projeto text references public.projetos(id) on delete set null;
create index if not exists tarefas_projeto_idx on public.tarefas (projeto);

-- atualização ao vivo do telão quando alguém mexe num projeto
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'projetos') then
    alter publication supabase_realtime add table public.projetos;
  end if;
end $$;
