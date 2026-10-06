-- Aplicar después de dashboard_95. Una solicitud agrupada, decisiones por fecha.
begin;
alter table public.asis_solicitudes_personales add column if not exists solicitud_grupo uuid;
create or replace function public.dash_solicitar_dias_libres(p_fechas date[],p_detalle text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_id bigint:=public.dash_colab();
  v_grupo uuid:=gen_random_uuid();
  v_saldo integer;
  v_fecha date;
  v_resultado jsonb;
  v_ids jsonb:='[]'::jsonb;
  v_cantidad integer:=cardinality(p_fechas);
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if v_cantidad is null or v_cantidad not between 1 and 365
    or exists(select 1 from unnest(p_fechas) f where f is null)
    or (select count(distinct f) from unnest(p_fechas) f)<>v_cantidad then
    return jsonb_build_object('ok',false,'motivo','fechas');
  end if;
  select dias_libres_saldo into v_saldo from public.asis_colaboradores where id=v_id and activo for update;
  if not found then return jsonb_build_object('ok',false,'motivo','colaborador'); end if;
  if v_saldo-public.asis_dias_libres_reservados(v_id)<v_cantidad then
    return jsonb_build_object('ok',false,'motivo','saldo_insuficiente');
  end if;
  -- El subbloque revierte todo el lote si falla cualquiera de las fechas.
  begin
    for v_fecha in select f from unnest(p_fechas) f order by f loop
      v_resultado:=public.dash_crear_solicitud('dia_libre',v_fecha,v_fecha,
        coalesce(nullif(btrim(p_detalle),''),'Solicitud de día libre para '||v_fecha::text),null);
      if not coalesce((v_resultado->>'ok')::boolean,false) then
        v_resultado:=v_resultado||jsonb_build_object('fecha',v_fecha);
        raise exception using errcode='P0095',message='lote_dias_libres_invalido';
      end if;
      update public.asis_solicitudes_personales set solicitud_grupo=v_grupo where id=(v_resultado->>'id')::bigint;
      v_ids:=v_ids||jsonb_build_array(v_resultado->'id');
    end loop;
  exception when sqlstate 'P0095' then return v_resultado;
  end;
  return jsonb_build_object('ok',true,'ids',v_ids,'cantidad',v_cantidad,'grupo',v_grupo);
end $$;
revoke all on function public.dash_solicitar_dias_libres(date[],text) from public,anon,authenticated;
grant execute on function public.dash_solicitar_dias_libres(date[],text) to authenticated;

-- Recupera lotes anteriores: las fechas del mismo envío comparten now() de la transacción.
with lotes as (
  select colaborador_id,creado_at,
    case when detalle='Solicitud de día libre para '||fecha_inicio::text then 'Solicitud de días libres' else detalle end detalle_grupo,
    gen_random_uuid() grupo
  from public.asis_solicitudes_personales
  where tipo='dia_libre' and descanso_programado and solicitud_grupo is null
  group by colaborador_id,creado_at,detalle_grupo
)
update public.asis_solicitudes_personales s set solicitud_grupo=l.grupo
from lotes l where s.colaborador_id=l.colaborador_id and s.creado_at=l.creado_at
  and (case when s.detalle='Solicitud de día libre para '||s.fecha_inicio::text then 'Solicitud de días libres' else s.detalle end)=l.detalle_grupo
  and s.tipo='dia_libre' and s.descanso_programado and s.solicitud_grupo is null;
create index if not exists asis_solicitudes_grupo_idx on public.asis_solicitudes_personales(solicitud_grupo)
  where solicitud_grupo is not null;

create or replace function public.dash_admin_solicitudes_agrupadas()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare items jsonb;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'solicitud_grupo',s.solicitud_grupo,'colaborador_id',s.colaborador_id,
    'nombre',c.nombre,'area',a.nombre,'tipo',s.tipo,'fecha_inicio',s.fecha_inicio,'fecha_fin',s.fecha_fin,
    'detalle',s.detalle,'evidencia_path',s.evidencia_path,'estado',s.estado,'respuesta',s.respuesta,
    'creado_at',s.creado_at,'descanso_programado',s.descanso_programado,
    'contra_fecha',s.contra_fecha,'contra_estado',s.contra_estado,'contra_motivo',s.contra_motivo
  ) order by s.creado_at desc,s.fecha_inicio,s.id),'[]'::jsonb) into items
  from public.asis_solicitudes_personales s
  join public.asis_colaboradores c on c.id=s.colaborador_id
  left join public.asis_areas a on a.id=c.area_id
  where s.estado='pendiente' or (s.solicitud_grupo is not null and exists(
    select 1 from public.asis_solicitudes_personales pendiente
    where pendiente.solicitud_grupo=s.solicitud_grupo and pendiente.colaborador_id=s.colaborador_id and pendiente.estado='pendiente'
  ));
  return jsonb_build_object('ok',true,'solicitudes',items);
end $$;
revoke all on function public.dash_admin_solicitudes_agrupadas() from public,anon,authenticated;
grant execute on function public.dash_admin_solicitudes_agrupadas() to authenticated;
notify pgrst,'reload schema';
commit;
