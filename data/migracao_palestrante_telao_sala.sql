-- Palestrante fixo do auditório (priorizar) e telão de tarefas separado por sala.
alter table public.regras_salas add column if not exists palestrante uuid references public.perfis(id) on delete set null;
alter table public.tarefas add column if not exists sala text;
-- tarefas que já existiam ficam no telão da Área de trabalho
update public.tarefas set sala = (select r->>'id' from public.mapas m, jsonb_array_elements(m.dados->'rooms') r
  where m.id = 'principal' and r->>'type' = 'trabalho' limit 1) where sala is null;

drop function if exists public.definir_regra_sala(text,text,boolean,uuid[],text,boolean);
create or replace function public.definir_regra_sala(p_mapa text, p_sala text, p_restrita boolean, p_permitidos uuid[], p_senha text, p_trocar_senha boolean, p_palestrante uuid default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.e_admin() then raise exception 'só administradores'; end if;
  if p_trocar_senha then
    delete from public.senhas_salas where mapa_id = p_mapa and sala_id = p_sala;
    if nullif(p_senha,'') is not null then
      insert into public.senhas_salas values (p_mapa, p_sala, extensions.crypt(p_senha, extensions.gen_salt('bf')));
    end if;
  end if;
  insert into public.regras_salas (mapa_id, sala_id, restrita, permitidos, tem_senha, palestrante, atualizado_por, atualizado_em)
  values (p_mapa, p_sala, coalesce(p_restrita,false), coalesce(p_permitidos,'{}'),
          exists (select 1 from public.senhas_salas where mapa_id = p_mapa and sala_id = p_sala), p_palestrante, auth.uid(), now())
  on conflict (mapa_id, sala_id) do update set
    restrita = excluded.restrita, permitidos = excluded.permitidos, tem_senha = excluded.tem_senha, palestrante = excluded.palestrante,
    atualizado_por = auth.uid(), atualizado_em = now();
end $$;
revoke execute on function public.definir_regra_sala(text,text,boolean,uuid[],text,boolean,uuid) from public, anon;
grant execute on function public.definir_regra_sala(text,text,boolean,uuid[],text,boolean,uuid) to authenticated;
