-- Vídeos salvos para aprovação (sala de Edição). Rode uma vez no Supabase → SQL Editor.

-- 1) campos do vídeo no roteiro + novo status "aguardando" (aguardando aprovação)
alter table public.roteiros add column if not exists video_path text;
alter table public.roteiros add column if not exists video_tipo text;
alter table public.roteiros add column if not exists video_em timestamptz;
alter table public.roteiros add column if not exists video_por uuid;
alter table public.roteiros add column if not exists substitui uuid references public.roteiros(id) on delete set null;
alter table public.roteiros drop constraint if exists roteiros_status_check;
alter table public.roteiros add constraint roteiros_status_check
  check (status in ('rascunho','aguardando','aprovado','gravando','publicado','descartado'));

-- 2) pasta (bucket) privada para os vídeos, até 50 MB cada
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipe vê vídeos" on storage.objects;
create policy "equipe vê vídeos" on storage.objects for select to authenticated using (bucket_id = 'videos');
drop policy if exists "equipe envia vídeos" on storage.objects;
create policy "equipe envia vídeos" on storage.objects for insert to authenticated with check (bucket_id = 'videos');
drop policy if exists "admin apaga vídeos" on storage.objects;
create policy "admin apaga vídeos" on storage.objects for delete to authenticated using (bucket_id = 'videos' and public.e_admin());

-- 3) guarda o vídeo no roteiro e coloca em "aguardando aprovação"
create or replace function public.salvar_video(p_id uuid, p_path text, p_tipo text) returns public.roteiros
language plpgsql security definer set search_path = public as $$
declare r public.roteiros;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  update public.roteiros set video_path = left(p_path, 300), video_tipo = left(p_tipo, 60), video_em = now(), video_por = auth.uid(),
    status = 'aguardando', status_por = auth.uid(), atualizado_em = now()
  where id = p_id returning * into r;
  return r;
end $$;
revoke execute on function public.salvar_video(uuid,text,text) from public, anon;
grant execute on function public.salvar_video(uuid,text,text) to authenticated;

-- 4) o roteirista pode registrar qual roteiro a nova versão substitui
create or replace function public.agente_roteiro(p_chave text, p_agente text, p_tendencia uuid, p_titulo text,
  p_gancho text, p_roteiro text, p_formato text, p_cenas jsonb, p_pedido_por uuid default null, p_substitui uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid;
begin
  if not public.chave_agente_ok(p_chave) then raise exception 'chave inválida'; end if;
  if nullif(trim(p_titulo),'') is null then raise exception 'título obrigatório'; end if;
  insert into public.roteiros (tendencia_id, titulo, gancho, roteiro, formato, cenas, agente, pedido_por, substitui)
  values (p_tendencia, left(trim(p_titulo), 200), left(p_gancho, 500), left(p_roteiro, 8000), left(p_formato, 60),
          coalesce(p_cenas, '[]'::jsonb), left(p_agente, 40), p_pedido_por, p_substitui)
  returning id into novo;
  -- a versão antiga sai de cena
  if p_substitui is not null then update public.roteiros set status = 'descartado', atualizado_em = now() where id = p_substitui; end if;
  update public.agentes set visto_em = now() where id = p_agente;
  return novo;
end $$;
drop function if exists public.agente_roteiro(text,text,uuid,text,text,text,text,jsonb,uuid);
grant execute on function public.agente_roteiro(text,text,uuid,text,text,text,text,jsonb,uuid,uuid) to anon, authenticated;
