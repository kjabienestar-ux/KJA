-- =====================================================================
--  KJA · Dashboard 128 — Documento del contrato en la ficha del colaborador
--  Aplicar después de dashboard_127. Aditiva: no borra datos ni cambia
--  dash_admin_guardar_ficha ni dash_admin_equipo.
--  Un documento vigente por persona (PDF o imagen escaneada, hasta 10 MB)
--  en el bucket privado asis-contratos. Solo editor y dirección
--  (asis_puede_editar) lo suben, lo ven o lo quitan.
--  El panel lo usa recién con window.KJA_CONTRATO_DOCUMENTO=true en dashboard.html.
-- =====================================================================
begin;

-- ── 1) BUCKET PRIVADO ────────────────────────────────────────────────
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('asis-contratos','asis-contratos',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- ── 2) DOCUMENTO VIGENTE POR COLABORADOR ─────────────────────────────
-- Tabla aparte: asis_colaboradores la leen todos los miembros y el contrato no.
create table if not exists public.asis_contrato_documentos (
  colaborador_id bigint primary key references public.asis_colaboradores(id) on delete cascade,
  path           text not null unique check (path ~ '^[0-9]+/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  nombre         text not null check (char_length(nombre) between 1 and 160),
  tipo           text not null check (tipo in ('application/pdf','image/jpeg','image/png','image/webp')),
  tamano         bigint not null check (tamano between 1 and 10485760),
  subido_por     uuid references public.asis_perfiles(id),
  subido_at      timestamptz not null default now(),
  check (split_part(path,'/',1)=colaborador_id::text)
);
alter table public.asis_contrato_documentos enable row level security;
-- Sin políticas: se lee y se escribe solo con las funciones dash_admin_* de abajo.
revoke all on table public.asis_contrato_documentos from public,anon,authenticated;

create or replace function public.dash_contrato_documento_en_uso(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.asis_contrato_documentos where path=p_path);
$$;
revoke all on function public.dash_contrato_documento_en_uso(text) from public,anon;
grant execute on function public.dash_contrato_documento_en_uso(text) to authenticated;

-- ── 3) POLÍTICAS DEL BUCKET ──────────────────────────────────────────
-- Ruta: <colaborador_id>/<uuid>.<ext>. Sin política de update: cada subida usa un nombre nuevo.
drop policy if exists "contratos documento: lectura editores" on storage.objects;
create policy "contratos documento: lectura editores"
  on storage.objects for select to authenticated
  using (bucket_id='asis-contratos' and public.asis_puede_editar());

drop policy if exists "contratos documento: subir editores" on storage.objects;
create policy "contratos documento: subir editores"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='asis-contratos'
    and public.asis_puede_editar()
    and name ~ '^[0-9]+/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'
    and exists(select 1 from public.asis_colaboradores c where c.id::text=split_part(name,'/',1))
  );

-- Solo se borra un archivo que ya no es el documento vigente de nadie.
drop policy if exists "contratos documento: borrar sin uso" on storage.objects;
create policy "contratos documento: borrar sin uso"
  on storage.objects for delete to authenticated
  using (
    bucket_id='asis-contratos'
    and public.asis_puede_editar()
    and not public.dash_contrato_documento_en_uso(name)
  );

-- ── 4) FUNCIONES DEL PANEL ───────────────────────────────────────────
create or replace function public.dash_admin_documentos_contrato()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  return jsonb_build_object('ok',true,'documentos',coalesce((
    select jsonb_agg(jsonb_build_object('colaborador_id',colaborador_id,'path',path,'nombre',nombre,
             'tipo',tipo,'tamano',tamano,'subido_at',subido_at) order by colaborador_id)
      from public.asis_contrato_documentos),'[]'::jsonb));
end $$;

-- Registra el archivo ya subido y devuelve la ruta anterior para que el panel la borre.
create or replace function public.dash_admin_registrar_documento_contrato(
  p_colab bigint,p_path text,p_nombre text,p_tipo text,p_tamano bigint,p_motivo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_nombre text:=left(btrim(coalesce(p_nombre,'')),160);
  v_motivo text:=nullif(left(btrim(coalesce(p_motivo,'')),140),'');
  v_anterior public.asis_contrato_documentos;
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if not exists(select 1 from public.asis_colaboradores where id=p_colab) then
    return jsonb_build_object('ok',false,'motivo','colaborador');
  end if;
  if p_path is null or p_path !~ ('^'||p_colab::text||'/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$')
     or v_nombre='' or p_tipo is null
     or p_tipo not in ('application/pdf','image/jpeg','image/png','image/webp')
     or p_tamano is null or p_tamano not between 1 and 10485760 then
    return jsonb_build_object('ok',false,'motivo','archivo');
  end if;
  if not exists(select 1 from storage.objects where bucket_id='asis-contratos' and name=p_path) then
    return jsonb_build_object('ok',false,'motivo','sin_archivo');
  end if;

  select * into v_anterior from public.asis_contrato_documentos where colaborador_id=p_colab for update;
  insert into public.asis_contrato_documentos(colaborador_id,path,nombre,tipo,tamano,subido_por,subido_at)
  values(p_colab,p_path,v_nombre,p_tipo,p_tamano,auth.uid(),now())
  on conflict (colaborador_id) do update set
    path=excluded.path,nombre=excluded.nombre,tipo=excluded.tipo,tamano=excluded.tamano,
    subido_por=excluded.subido_por,subido_at=excluded.subido_at;

  insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
  values(p_colab,'otro',
    case when v_anterior.path is null then null else jsonb_build_object('documento_contrato',v_anterior.nombre) end,
    jsonb_build_object('documento_contrato',v_nombre),
    (case when v_anterior.path is null then 'Documento del contrato adjuntado: ' else 'Documento del contrato reemplazado: ' end)
      ||v_nombre||coalesce(' · '||v_motivo,''),
    auth.uid());

  return jsonb_build_object('ok',true,'anterior',v_anterior.path);
end $$;

-- Quita el documento vigente y devuelve su ruta para que el panel borre el archivo.
create or replace function public.dash_admin_quitar_documento_contrato(p_colab bigint,p_motivo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_motivo text:=nullif(left(btrim(coalesce(p_motivo,'')),140),'');
  v_doc public.asis_contrato_documentos;
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  delete from public.asis_contrato_documentos where colaborador_id=p_colab returning * into v_doc;
  if v_doc.path is null then return jsonb_build_object('ok',true,'path',null); end if;

  insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
  values(p_colab,'otro',jsonb_build_object('documento_contrato',v_doc.nombre),null,
    'Documento del contrato quitado: '||v_doc.nombre||coalesce(' · '||v_motivo,''),auth.uid());

  return jsonb_build_object('ok',true,'path',v_doc.path);
end $$;

revoke all on function public.dash_admin_documentos_contrato(),
  public.dash_admin_registrar_documento_contrato(bigint,text,text,text,bigint,text),
  public.dash_admin_quitar_documento_contrato(bigint,text) from public,anon;
grant execute on function public.dash_admin_documentos_contrato(),
  public.dash_admin_registrar_documento_contrato(bigint,text,text,text,bigint,text),
  public.dash_admin_quitar_documento_contrato(bigint,text) to authenticated;

notify pgrst,'reload schema';
commit;

-- ── COMPROBACIONES rápidas (opcional) ────────────────────────────────
-- select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='asis-contratos';
-- select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'contratos documento:%';
-- select count(*) from public.asis_contrato_documentos;
