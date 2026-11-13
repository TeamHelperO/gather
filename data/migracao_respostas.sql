-- Parte 5: respostas dos e-mails de prospecção (lidas do e-mail do cPanel) viram tarefa no telão.
-- Rode inteiro no Supabase → SQL Editor. Pode rodar mais de uma vez.

alter table public.prospects add column if not exists resposta     text;
alter table public.prospects add column if not exists respondeu_em timestamptz;
alter table public.prospects add column if not exists tarefa_id    text;
alter table public.prospects drop constraint if exists prospects_status_check;
alter table public.prospects add constraint prospects_status_check
  check (status in ('revisar','sem_email','enviado','respondeu','descartado','erro','descadastrado'));

-- quem já recebeu e-mail e ainda não respondeu (para o leitor de respostas)
create or replace function public.prospects_enviados(p_chave text)
returns table (id uuid, email text, dominio text, empresa text, enviado_em timestamptz, assunto text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  return query select p.id, lower(p.email), lower(p.dominio), p.empresa, p.enviado_em, p.assunto
    from public.prospects p where p.status = 'enviado' and p.email is not null and p.enviado_em > now() - interval '60 days';
end $$;
grant execute on function public.prospects_enviados(text) to anon, authenticated;

-- a empresa respondeu: guarda a resposta, cria a tarefa no telão para quem enviou e avisa essa pessoa
create or replace function public.prospect_respondeu(p_chave text, p_id uuid, p_texto text, p_quando timestamptz, p_remover boolean, p_de text)
returns text
language plpgsql security definer set search_path = public as $$
declare p public.prospects; resp text; tid text; venc date;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  select * into p from public.prospects where prospects.id = p_id for update;
  if not found or p.status <> 'enviado' then return null; end if;
  if p_remover then
    update public.prospects set status = 'descadastrado', resposta = left(p_texto, 4000), respondeu_em = coalesce(p_quando, now()) where prospects.id = p_id;
    return null;
  end if;
  select email into resp from public.perfis where perfis.id = p.enviado_por;
  tid := 't' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  venc := ((now() at time zone 'America/Sao_Paulo')::date + 1);
  insert into public.tarefas (id, titulo, descricao, responsavel, prazo, status, etapas, progresso_manual, ordem, historico, criado_por, sala)
  values (tid, left('📨 Responder ' || p.empresa, 120),
          left('A empresa respondeu o e-mail de prospecção' || coalesce(' (de ' || p_de || ')', '') || E':\n\n' || coalesce(p_texto, '') ||
               E'\n\n' || coalesce('Site: ' || p.site || E'\n', '') || coalesce('Telefone: ' || p.telefone, ''), 1000),
          resp, venc, 'a_fazer',
          jsonb_build_array(jsonb_build_object('id', 'e1', 'texto', 'Responder a empresa', 'feito', false),
                            jsonb_build_object('id', 'e2', 'texto', 'Marcar conversa / enviar proposta', 'feito', false)),
          null, 0,
          jsonb_build_array(jsonb_build_object('quando', now(), 'email', 'agente', 'acao', 'Criada pela resposta da prospecção')),
          p.enviado_por, null);
  update public.prospects set status = 'respondeu', resposta = left(p_texto, 4000), respondeu_em = coalesce(p_quando, now()), tarefa_id = tid where prospects.id = p_id;
  if p.enviado_por is not null then
    insert into public.avisos (para, de, tipo, texto, dados)
    values (p.enviado_por, null, 'tarefa', '📨 ' || p.empresa || ' respondeu seu e-mail. Virou tarefa no telão: “Responder ' || p.empresa || '”',
            jsonb_build_object('tarefa', tid, 'mapa', 'principal'));
  end if;
  return tid;
end $$;
grant execute on function public.prospect_respondeu(text, uuid, text, timestamptz, boolean, text) to anon, authenticated;
