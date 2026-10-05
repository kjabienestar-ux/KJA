-- Aplicar después de dashboard_86. Descanso del 05/10 por asistencia del 02/10/2026.
begin;

create table if not exists public.asis_descansos_presenciales (
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha date not null,
  fecha_presencial date not null,
  creado_at timestamptz not null default now(),
  primary key(colaborador_id,fecha),
  check(fecha>fecha_presencial)
);
alter table public.asis_descansos_presenciales enable row level security;
revoke all on public.asis_descansos_presenciales from public,anon,authenticated;

create or replace function public.asis_otorgar_descanso_presencial(p_presencial date,p_descanso date)
returns integer language plpgsql security definer set search_path=public as $$
declare v_total integer;
begin
  if p_presencial is null or p_descanso is null or p_descanso<=p_presencial then
    raise exception 'Fechas de descanso inválidas';
  end if;
  insert into public.asis_descansos_presenciales(colaborador_id,fecha,fecha_presencial)
  select r.colaborador_id,p_descanso,p_presencial
  from public.asis_registros r join public.asis_colaboradores c on c.id=r.colaborador_id
  where c.activo and r.fecha=p_presencial and r.estado in ('P','T')
    and r.marcado_at is not null and r.modalidad_marcada='presencial'
  on conflict do nothing;
  get diagnostics v_total=row_count;
  return v_total;
end $$;
revoke all on function public.asis_otorgar_descanso_presencial(date,date) from public,anon,authenticated;

do $$ begin
  if to_regprocedure('public.asis_labora_base_87(public.asis_colaboradores,date)') is null then
    alter function public.asis_labora(public.asis_colaboradores,date) rename to asis_labora_base_87;
  end if;
  if to_regprocedure('public.asis_compartir_programado_base_87(bigint,date)') is null then
    alter function public.asis_compartir_programado(bigint,date) rename to asis_compartir_programado_base_87;
  end if;
  if to_regprocedure('public.dash_cierre_resumen_colab_base_87(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date) rename to dash_cierre_resumen_colab_base_87;
  end if;
end $$;
revoke all on function public.asis_labora_base_87(public.asis_colaboradores,date),
  public.asis_compartir_programado_base_87(bigint,date),
  public.dash_cierre_resumen_colab_base_87(bigint,date) from public,anon,authenticated;

create or replace function public.asis_labora(p_colab public.asis_colaboradores,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select not exists(select 1 from public.asis_descansos_presenciales
    where colaborador_id=p_colab.id and fecha=p_fecha)
    and public.asis_labora_base_87(p_colab,p_fecha)
$$;

-- Conserva también Facebook cuando su agenda hereda los días laborales.
create or replace function public.asis_compartir_programado(p_colab bigint,p_fecha date)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_colab public.asis_colaboradores;
begin
  select * into v_colab from public.asis_colaboradores where id=p_colab;
  if not coalesce(v_colab.comparticiones_horario_configurado,false)
    and exists(select 1 from public.asis_descansos_presenciales where colaborador_id=p_colab and fecha=p_fecha) then
    return coalesce(public.asis_labora_base_87(v_colab,p_fecha),false);
  end if;
  return public.asis_compartir_programado_base_87(p_colab,p_fecha);
end $$;

create or replace function public.dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_req jsonb; v_pending integer;
begin
  v_data:=public.dash_cierre_resumen_colab_base_87(p_colaborador,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) or not exists(
    select 1 from public.asis_descansos_presenciales where colaborador_id=p_colaborador and fecha=p_fecha
  ) then return v_data; end if;
  select coalesce(jsonb_agg(item order by orden),'[]'::jsonb),
    count(*) filter(where not coalesce((item->>'completo')::boolean,false))
  into v_req,v_pending from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb))
    with ordinality filas(item,orden) where item->>'tipo'='comparticiones';
  return v_data||jsonb_build_object(
    'dia_libre_presencial',true,'aplica',true,'aplica_jornada',false,'solo_comparticiones',true,
    'requiere_rpe',false,'requiere_salida',false,'puede_marcar_salida',false,
    'requisitos',v_req,'asignaciones','[]'::jsonb,
    'pendientes',v_pending,'pendientes_jornada',0,'pendientes_salida',0,
    'comparticiones_pendientes',v_pending>0,
    'estado',case when v_pending=0 then 'completa'
      when coalesce((v_data->>'comparticiones_vencidas')::boolean,false) then 'incompleta' else 'en_curso' end);
end $$;
revoke all on function public.asis_labora(public.asis_colaboradores,date),
  public.asis_compartir_programado(bigint,date),public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;
select public.asis_otorgar_descanso_presencial(date '2026-10-02',date '2026-10-05') as nuevos_beneficiarios;
notify pgrst,'reload schema';
commit;
