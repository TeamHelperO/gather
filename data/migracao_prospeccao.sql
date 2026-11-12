-- Sala de Pesquisa: agentes configuráveis pelo painel + agente de prospecção (empresas do Google Maps → e-mail para aprovar)
-- Rode inteiro no Supabase → SQL Editor. Pode rodar mais de uma vez.

-- ---------- configuração dos agentes (nome, foco, instruções) ----------
alter table public.agentes add column if not exists tipo      text not null default 'pesquisa';
alter table public.agentes add column if not exists foco      text;
alter table public.agentes add column if not exists categoria text;
alter table public.agentes add column if not exists prompt    text;
alter table public.agentes add column if not exists ativo     boolean not null default true;
alter table public.agentes add column if not exists config    jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.agentes add constraint agentes_tipo_ck check (tipo in ('pesquisa','prospeccao','edicao'));
exception when duplicate_object then null; end $$;

update public.agentes set foco = coalesce(foco, 'redes sociais, Meta Ads, TikTok e marketing de performance'), categoria = coalesce(categoria, 'Social/Ads') where id = 'agente1';
update public.agentes set foco = coalesce(foco, 'e-commerce, varejo online, marketplaces e comportamento de compra'), categoria = coalesce(categoria, 'E-commerce') where id = 'agente2';
update public.agentes set foco = coalesce(foco, 'conteúdo, SEO, criadores e formatos que estão engajando'), categoria = coalesce(categoria, 'Conteúdo') where id = 'agente3';
update public.agentes set foco = coalesce(foco, 'inteligência artificial, ferramentas e automação para negócios'), categoria = coalesce(categoria, 'IA/Tech') where id = 'agente4';
update public.agentes set tipo = 'edicao' where id in ('agente6','agente7','agente8');

-- o agente 5 vira o prospectador (só na primeira vez; depois vale o que estiver no painel)
update public.agentes set
  tipo = 'prospeccao', categoria = 'Prospecção',
  foco = 'empresas que precisam de marketing digital, site, sistemas e automação',
  prompt = 'Escreva como a Next Co. falando com o dono da empresa: direto, cordial, sem exageros. Cite algo específico do site ou do negócio dela para mostrar que não é e-mail em massa. Termine com uma pergunta simples (ex.: posso te mandar uma proposta?).',
  config = jsonb_build_object(
    'segmentos', jsonb_build_array('clínicas de estética', 'clínicas odontológicas', 'academias', 'imobiliárias', 'escritórios de advocacia', 'restaurantes'),
    'cidades',   jsonb_build_array('São Paulo SP'),
    'por_rodada', 5,
    'oferta', 'A Next Co. é uma agência completa de marketing digital e tecnologia: gestão de tráfego pago (Meta Ads e Google), criação de sites e landing pages, sistemas sob medida, automação de WhatsApp e atendimento com IA, produção de conteúdo e vídeos para redes sociais, e relatórios claros de resultado. Cuidamos de tudo em um lugar só.',
    'assinatura', E'Equipe Next Co.\nMarketing digital e tecnologia')
where id = 'agente5' and tipo = 'pesquisa' and (config = '{}'::jsonb);

-- os agentes leem a própria configuração com a chave deles (o cron não tem login)
create or replace function public.agentes_config(p_chave text) returns setof public.agentes
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  return query select * from public.agentes order by id;
end $$;
grant execute on function public.agentes_config(text) to anon, authenticated;

-- ---------- empresas prospectadas ----------
create table if not exists public.prospects (
  id           uuid primary key default gen_random_uuid(),
  agente       text,
  place_id     text unique,
  empresa      text not null,
  segmento     text,
  cidade       text,
  endereco     text,
  site         text,
  dominio      text,
  telefone     text,
  maps_url     text,
  avaliacao    numeric,
  avaliacoes   int,
  email        text,
  emails       text[],
  analise      text,
  assunto      text,
  corpo        text,
  status       text not null default 'revisar' check (status in ('revisar','sem_email','enviado','descartado','erro','descadastrado')),
  erro         text,
  criado_em    timestamptz not null default now(),
  editado_por  uuid references public.perfis(id),
  enviado_por  uuid references public.perfis(id),
  enviado_em   timestamptz
);
create index if not exists prospects_criado on public.prospects (criado_em desc);
create index if not exists prospects_dominio on public.prospects (lower(dominio));
create index if not exists prospects_email on public.prospects (lower(email));
alter table public.prospects enable row level security;
drop policy if exists "equipe vê prospects" on public.prospects;
create policy "equipe vê prospects" on public.prospects for select to authenticated using (true);
drop policy if exists "admin edita prospects" on public.prospects;
create policy "admin edita prospects" on public.prospects for update to authenticated using (public.e_admin()) with check (public.e_admin());
drop policy if exists "admin exclui prospects" on public.prospects;
create policy "admin exclui prospects" on public.prospects for delete to authenticated using (public.e_admin());

-- o que já foi visto (para não repetir empresa nem mandar 2 e-mails para o mesmo lugar)
create or replace function public.prospects_conhecidos(p_chave text) returns table (place_id text, dominio text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  return query select p.place_id, lower(p.dominio), lower(p.email) from public.prospects p;
end $$;
grant execute on function public.prospects_conhecidos(text) to anon, authenticated;

-- o agente salva uma empresa encontrada (com o rascunho do e-mail)
create or replace function public.agente_prospect(p_chave text, p_agente text, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare novo uuid; em text := nullif(lower(trim(p->>'email')), '');
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  if nullif(trim(p->>'empresa'), '') is null then raise exception 'empresa obrigatória'; end if;
  if exists (select 1 from public.prospects x where x.place_id = p->>'place_id'
             or (em is not null and lower(x.email) = em)
             or (nullif(p->>'dominio','') is not null and lower(x.dominio) = lower(p->>'dominio'))) then return null; end if;
  insert into public.prospects (agente, place_id, empresa, segmento, cidade, endereco, site, dominio, telefone, maps_url, avaliacao, avaliacoes,
                                email, emails, analise, assunto, corpo, status)
  values (left(p_agente, 40), left(p->>'place_id', 200), left(p->>'empresa', 200), left(p->>'segmento', 120), left(p->>'cidade', 120),
          left(p->>'endereco', 300), left(p->>'site', 500), left(lower(p->>'dominio'), 200), left(p->>'telefone', 40), left(p->>'maps_url', 500),
          nullif(p->>'avaliacao','')::numeric, nullif(p->>'avaliacoes','')::int,
          em, array(select left(lower(jsonb_array_elements_text(coalesce(p->'emails','[]'::jsonb))), 200) limit 8),
          left(p->>'analise', 2000), left(p->>'assunto', 300), left(p->>'corpo', 6000),
          case when em is null then 'sem_email' else 'revisar' end)
  returning id into novo;
  update public.agentes set visto_em = now() where id = p_agente;
  return novo;
end $$;
grant execute on function public.agente_prospect(text,text,jsonb) to anon, authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.prospects; exception when duplicate_object then null; end;
end $$;
