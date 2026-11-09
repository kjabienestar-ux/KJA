-- Archivado conserva entregas, revisión, cantidades y referencias originales.
-- No elimina objetos. El operador registra respaldo verificado antes de retirarlos.
begin;
create table if not exists public.asis_archivos_archivados (
  bucket_id text not null check (bucket_id in ('asis-evidencias','asis-cierre-evidencias','solicitud-evidencias')),
  path text not null,
  objeto_id uuid not null,
  bytes bigint not null check (bytes >= 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  respaldo_id text not null,
  objeto_creado_at timestamptz not null,
  objeto_actualizado_at timestamptz not null,
  respaldado_at timestamptz not null default now(),
  retirado_at timestamptz,
  primary key(bucket_id,path)
);
alter table public.asis_archivos_archivados enable row level security;
revoke all on public.asis_archivos_archivados from public,anon,authenticated;
grant all on public.asis_archivos_archivados to service_role;

create or replace function public.asis_archivo_confirmar(p_bucket text,p_paths text[],p_respaldo text)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if exists(select 1 from storage.objects where bucket_id=p_bucket and name=any(p_paths)) then
    raise exception 'Hay archivos que todavía existen en Storage';
  end if;
  update public.asis_archivos_archivados set retirado_at=coalesce(retirado_at,now())
    where bucket_id=p_bucket and path=any(p_paths) and respaldo_id=p_respaldo;
  get diagnostics v_count = row_count;
  if v_count<>cardinality(p_paths) then raise exception 'Falta el respaldo registrado de algún archivo'; end if;
  return v_count;
end $$;
revoke all on function public.asis_archivo_confirmar(text,text[],text) from public,anon,authenticated;
grant execute on function public.asis_archivo_confirmar(text,text[],text) to service_role;

create or replace function public.dash_archivo_archivado(p_bucket text,p_path text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_permitido boolean := false; v_retirado timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('archivado',false); end if;
  -- Mismos permisos que las políticas de lectura de los tres buckets.
  if p_bucket='asis-evidencias' then
    v_permitido := public.asis_es_miembro() or (public.dash_sesion_vigente() and
      public.puede_ver_colab(case when split_part(p_path,'/',3) ~ '^[0-9]+$'
        then split_part(p_path,'/',3)::bigint else null end));
  elsif p_bucket='asis-cierre-evidencias' and
      p_path ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]+/[0-9a-f-]+\.(jpg|webp|mp4|webm|pdf|doc|docx|ppt|pptx)$' then
    v_permitido := public.asis_rol()='direccion' or (public.dash_sesion_vigente() and
      (public.dash_colab()=split_part(p_path,'/',4)::bigint or
       (public.dash_nivel() in ('lider','colider') and public.puede_ver_colab(split_part(p_path,'/',4)::bigint))));
  elsif p_bucket='solicitud-evidencias' and p_path ~ '^[0-9]+/[0-9a-f-]+\.(jpg|webp)$' then
    v_permitido := public.dash_sesion_vigente() and
      (public.dash_colab()=split_part(p_path,'/',1)::bigint or public.asis_rol()='direccion');
  end if;
  if not coalesce(v_permitido,false) then return jsonb_build_object('archivado',false); end if;
  select retirado_at into v_retirado from public.asis_archivos_archivados
    where bucket_id=p_bucket and path=p_path and retirado_at is not null;
  return jsonb_build_object('archivado',v_retirado is not null,'retirado_at',v_retirado);
end $$;
revoke all on function public.dash_archivo_archivado(text,text) from public,anon;
grant execute on function public.dash_archivo_archivado(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
