-- Assinaturas (Mercado Pago, cobrança por pessoa/mês) e teste grátis de 7 dias para até 10 pessoas.
-- Cada espaço (mapa) tem uma linha. O espaço da Next ("principal") não é cobrado.
-- Rode inteiro no Supabase → SQL Editor. Pode rodar mais de uma vez.

create table if not exists public.assinaturas (
  mapa_id      text primary key,
  status       text not null default 'teste' check (status in ('teste','pendente','ativa','pausada','cancelada')),
  plano        text check (plano in ('equipe','empresa')),
  pessoas      int  not null default 10,
  valor        numeric(10,2),
  teste_ate    timestamptz not null default now() + interval '7 days',
  mp_id        text,
  email        text,
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
-- ninguém lê ou escreve a tabela direto: só pelas funções abaixo

/* situação da assinatura de um espaço (qualquer pessoa logada que abre o espaço). Começa o teste na primeira vez. */
create or replace function public.assinatura_info(p_mapa text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.assinaturas;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  if p_mapa = 'principal' then return jsonb_build_object('status', 'ativa', 'isento', true); end if;
  if not exists (select 1 from public.mapas where id = p_mapa) then return null; end if;
  insert into public.assinaturas (mapa_id) values (p_mapa) on conflict do nothing;
  select * into a from public.assinaturas where mapa_id = p_mapa;
  return jsonb_build_object('status', a.status, 'plano', a.plano, 'pessoas', a.pessoas, 'valor', a.valor, 'teste_ate', a.teste_ate,
    'dias', greatest(0, ceil(extract(epoch from (a.teste_ate - now())) / 86400)),
    'liberado', a.status = 'ativa' or (a.status in ('teste','pendente') and a.teste_ate > now()),
    'dono', public.dono_da_sala(p_mapa));
end $$;
revoke execute on function public.assinatura_info(text) from public, anon;
grant execute on function public.assinatura_info(text) to authenticated;

/* o servidor (api/assinar e api/mp-webhook) grava o que o Mercado Pago informou. Exige a chave do servidor. */
create or replace function public.assinatura_registrar(p_chave text, p_mapa text, p_status text, p_plano text, p_pessoas int, p_valor numeric, p_mp_id text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  if p_status not in ('teste','pendente','ativa','pausada','cancelada') then raise exception 'status inválido'; end if;
  insert into public.assinaturas (mapa_id) values (p_mapa) on conflict do nothing;
  update public.assinaturas set
    status = p_status,
    plano = coalesce(p_plano, plano),
    pessoas = coalesce(p_pessoas, pessoas),
    valor = coalesce(p_valor, valor),
    mp_id = coalesce(p_mp_id, mp_id),
    email = coalesce(p_email, email),
    atualizado_em = now()
  where mapa_id = p_mapa
    -- uma assinatura ativa não volta para "pendente" por causa de um checkout abandonado
    and not (status = 'ativa' and p_status = 'pendente');
end $$;
revoke execute on function public.assinatura_registrar(text, text, text, text, int, numeric, text, text) from public, anon, authenticated;
grant execute on function public.assinatura_registrar(text, text, text, text, int, numeric, text, text) to anon, authenticated;
-- (a função confere a chave do servidor; sem ela não grava nada)
