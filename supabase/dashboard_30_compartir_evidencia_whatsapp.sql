-- DASHBOARD 30 · COMPROBANTE PRIVADO PARA COMPARTIR
-- Entrega al colaborador únicamente su evidencia activa de Facebook y los
-- metadatos necesarios para preparar un envío verificable desde el portal.

begin;

create or replace function public.dash_mi_comprobante_comparticiones()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_colab_id bigint:=public.dash_colab();
  v_fecha date;
  v_colab public.asis_colaboradores;
  v_entrega public.asis_entregas_diarias;
  v_area text;
  v_archivos jsonb;
  v_dni text;
begin
  if not public.dash_sesion_vigente() or v_colab_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;

  v_fecha:=public.asis_cierre_fecha_activa(v_colab_id);
  select * into v_colab
    from public.asis_colaboradores c
   where c.id=v_colab_id and c.activo;
  if v_colab.id is null then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;

  select a.nombre into v_area
    from public.asis_areas a
   where a.id=v_colab.area_id;

  select * into v_entrega
    from public.asis_entregas_diarias e
   where e.colaborador_id=v_colab_id
     and e.fecha=v_fecha
     and e.requisito='comparticiones'
     and e.estado='completo'
   order by e.completado_at desc,e.id desc
   limit 1;
  if v_entrega.id is null then
    return jsonb_build_object('ok',false,'motivo','sin_entrega');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'path',f.path,
           'mime',f.mime,
           'bytes',f.bytes,
           'orden',f.orden
         ) order by f.orden),'[]'::jsonb)
    into v_archivos
    from public.asis_entrega_archivos f
   where f.entrega_id=v_entrega.id
     and f.mime in ('image/jpeg','image/webp');

  v_dni:=regexp_replace(coalesce(v_colab.dni,''),'[^0-9]','','g');

  return jsonb_build_object(
    'ok',true,
    'entrega_id',v_entrega.id,
    'fecha',v_fecha,
    'colaborador',v_colab.nombre,
    'dni',case when length(v_dni)>=4 then '••••'||right(v_dni,4) else '—' end,
    'area',coalesce(v_area,'Sin área'),
    'tipo_vinculo',v_colab.tipo_vinculo,
    'jornada_inicio',public.asis_hora_entrada(v_colab,v_fecha),
    'jornada_fin',public.asis_hora_salida(v_colab,v_fecha),
    'modalidad',v_entrega.modalidad,
    'detalle',v_entrega.detalle,
    'revision_estado',v_entrega.revision_estado,
    'registrado_at',v_entrega.completado_at,
    'archivos',v_archivos
  );
end $$;

revoke all on function public.dash_mi_comprobante_comparticiones()
  from public,anon;
grant execute on function public.dash_mi_comprobante_comparticiones()
  to authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,
       pieza,encontrado,esperado
from (
  select 'RPC de comprobante compartible'::text pieza,count(*)::int encontrado,1 esperado
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='dash_mi_comprobante_comparticiones'
  union all
  select 'ejecución privada autenticada',count(*)::int,1
    from information_schema.routine_privileges
   where specific_schema='public'
     and routine_name='dash_mi_comprobante_comparticiones'
     and grantee='authenticated'
     and privilege_type='EXECUTE'
) q;
