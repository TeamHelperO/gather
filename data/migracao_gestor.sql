-- Parte 3: presença por dia (tempo online, em reunião, ocupado/foco, ausente) e dados do relatório semanal.
-- Rode inteiro no Supabase → SQL Editor. Pode rodar mais de uma vez.
-- Não grava áudio, tela, conversas nem posição: só minutos por estado, por dia.

create table if not exists public.presenca_dia (
  usuario     uuid not null references public.perfis(id) on delete cascade,
  mapa_id     text not null,
  dia         date not null,
  min_online  int  not null default 0,
  min_reuniao int  not null default 0,
  min_ocupado int  not null default 0,
  min_ausente int  not null default 0,
  primeira    timestamptz,
  ultima      timestamptz,
  primary key (usuario, mapa_id, dia)
);
create index if not exists presenca_dia_mapa on public.presenca_dia (mapa_id, dia);
alter table public.presenca_dia enable row level security;
-- cada um vê o seu; administradores e o dono da sala virtual veem a equipe daquela sala
drop policy if exists "vê presença" on public.presenca_dia;
create policy "vê presença" on public.presenca_dia for select to authenticated using (
  usuario = auth.uid() or public.e_admin()
  or exists (select 1 from public.mapas m where m.id = presenca_dia.mapa_id and m.dados->'espaco'->>'dono' = auth.uid()::text));
-- ninguém escreve direto: só pela função abaixo (hora do servidor, no máximo 1 minuto por minuto)

create or replace function public.registrar_presenca(p_mapa text, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Sao_Paulo')::date; ult timestamptz;
begin
  if auth.uid() is null or coalesce(p_mapa, '') = '' then return; end if;
  insert into public.presenca_dia (usuario, mapa_id, dia, primeira) values (auth.uid(), left(p_mapa, 80), d, now())
  on conflict (usuario, mapa_id, dia) do nothing;
  select ultima into ult from public.presenca_dia where usuario = auth.uid() and mapa_id = left(p_mapa, 80) and dia = d for update;
  if ult is not null and now() - ult < interval '50 seconds' then return; end if;
  update public.presenca_dia set
    min_online  = min_online + 1,
    min_reuniao = min_reuniao + case when p_estado = 'reuniao' then 1 else 0 end,
    min_ocupado = min_ocupado + case when p_estado = 'ocupado' then 1 else 0 end,
    min_ausente = min_ausente + case when p_estado = 'ausente' then 1 else 0 end,
    ultima = now()
  where usuario = auth.uid() and mapa_id = left(p_mapa, 80) and dia = d;
end $$;
revoke execute on function public.registrar_presenca(text, text) from public, anon;
grant execute on function public.registrar_presenca(text, text) to authenticated;

-- dados do relatório semanal (para o e-mail automático da segunda-feira; usa a chave dos agentes)
create or replace function public.relatorio_semana(p_chave text, p_mapa text default 'principal') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  return jsonb_build_object(
    'tarefas',  coalesce((select jsonb_agg(to_jsonb(t) - 'historico' || jsonb_build_object('historico', coalesce(t.historico, '[]'::jsonb))) from public.tarefas t), '[]'::jsonb),
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'email', p.email, 'papel', p.papel)) from public.perfis p), '[]'::jsonb),
    'presenca', coalesce((select jsonb_agg(to_jsonb(x)) from public.presenca_dia x where x.mapa_id = p_mapa and x.dia >= (now() at time zone 'America/Sao_Paulo')::date - 7), '[]'::jsonb),
    'salas',    coalesce((select m.dados->'rooms' from public.mapas m where m.id = p_mapa), '[]'::jsonb));
end $$;
revoke execute on function public.relatorio_semana(text, text) from public;
grant execute on function public.relatorio_semana(text, text) to anon, authenticated;
