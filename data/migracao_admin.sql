-- Painel administrativo da plataforma (admin.html): espaços, testes, assinaturas e ajustes manuais.
-- Só quem é admin geral (perfis.papel = 'admin', função e_admin) consegue usar. Pode rodar mais de uma vez.

/* visão geral: todos os espaços com dono, pessoas, teste e assinatura */
create or replace function public.admin_painel() returns jsonb
language plpgsql security definer set search_path = public as $$
declare espacos jsonb;
begin
  if not public.e_admin() then raise exception 'só para administradores'; end if;
  select coalesce(jsonb_agg(e order by e->>'atualizado_em' desc), '[]'::jsonb) into espacos from (
    select jsonb_build_object(
      'id', m.id,
      'nome', coalesce(m.dados->'espaco'->>'nome', m.dados->>'name', m.id),
      'atualizado_em', m.atualizado_em,
      'dono_nome', d.nome, 'dono_email', d.email,
      'pessoas_7d', (select count(*) from public.perfis p where p.posicao->>'mapa' = m.id and p.ultimo_acesso > now() - interval '7 days'),
      'pessoas_hoje', (select count(*) from public.perfis p where p.posicao->>'mapa' = m.id and p.ultimo_acesso > now() - interval '1 day'),
      'isento', m.id = 'principal',
      'status', a.status, 'plano', a.plano, 'pessoas', a.pessoas, 'valor', a.valor, 'teste_ate', a.teste_ate,
      'dias', case when a.teste_ate is null then null else greatest(0, ceil(extract(epoch from (a.teste_ate - now())) / 86400)) end,
      'mp_id', a.mp_id, 'email_cobranca', a.email, 'assinatura_atualizada', a.atualizado_em
    ) as e
    from public.mapas m
    left join public.assinaturas a on a.mapa_id = m.id
    left join public.perfis d on d.id::text = m.dados->'espaco'->>'dono'
  ) x;
  return jsonb_build_object('espacos', espacos, 'agora', now(),
    'usuarios', (select count(*) from public.perfis),
    'usuarios_7d', (select count(*) from public.perfis where ultimo_acesso > now() - interval '7 days'));
end $$;
revoke execute on function public.admin_painel() from public, anon;
grant execute on function public.admin_painel() to authenticated;

/* ajustes manuais: estender o teste, liberar (cortesia/pagou por fora) ou cancelar */
create or replace function public.admin_assinatura_ajustar(p_mapa text, p_acao text, p_dias int default 7) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'só para administradores'; end if;
  if not exists (select 1 from public.mapas where id = p_mapa) then raise exception 'espaço não existe'; end if;
  insert into public.assinaturas (mapa_id) values (p_mapa) on conflict do nothing;
  if p_acao = 'estender' then
    update public.assinaturas set teste_ate = greatest(teste_ate, now()) + make_interval(days => greatest(1, least(p_dias, 365))),
      status = case when status in ('cancelada', 'pausada') then 'teste' else status end, atualizado_em = now() where mapa_id = p_mapa;
  elsif p_acao = 'liberar' then
    update public.assinaturas set status = 'ativa', atualizado_em = now() where mapa_id = p_mapa;
  elsif p_acao = 'cancelar' then
    update public.assinaturas set status = 'cancelada', atualizado_em = now() where mapa_id = p_mapa;
  else raise exception 'ação inválida';
  end if;
end $$;
revoke execute on function public.admin_assinatura_ajustar(text, text, int) from public, anon;
grant execute on function public.admin_assinatura_ajustar(text, text, int) to authenticated;
