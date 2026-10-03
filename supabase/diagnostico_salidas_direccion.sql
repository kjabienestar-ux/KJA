-- SOLO LECTURA. Ejecutar en el editor SQL de Supabase con acceso administrativo.
-- Devuelve un informe único para compartir completo. No regulariza ni modifica datos.
-- Cambiar desde/hasta para revisar otros días. Incluye a todo el equipo.
with parametros as (
  select date '2026-10-02' desde, date '2026-10-02' hasta
), casos as materialized (
  select c.id colaborador_id,c.nombre,r.id registro_id,e.fecha,
    r.estado estado_asistencia,r.marcado_at,r.salida_at,
    r.cierre_regularizado,e.id entrega_id,e.estado estado_entrega,
    e.revision_estado,e.completado_at,a.salida_reportada_at,a.creado_at carga_direccion_at,
    (select count(*) from public.asis_entrega_archivos f where f.entrega_id=e.id) archivos,
    public.dash_cierre_resumen_colab(c.id,e.fecha) resumen
  from public.asis_entregas_diarias e
  join public.asis_entregas_direccion a
    on a.entrega_id=e.id and a.colaborador_id=e.colaborador_id and a.fecha=e.fecha
  join public.asis_colaboradores c on c.id=e.colaborador_id
  left join public.asis_registros r on r.colaborador_id=e.colaborador_id and r.fecha=e.fecha
  cross join parametros p
  where e.fecha between p.desde and p.hasta
    and e.requisito='salida' and e.estado='completo'
), informe as (
  select colaborador_id,nombre,fecha,registro_id,entrega_id,
    estado_asistencia,estado_entrega,revision_estado,archivos,
    marcado_at at time zone 'America/Lima' entrada_lima,
    salida_at at time zone 'America/Lima' salida_registrada_lima,
    salida_reportada_at at time zone 'America/Lima' salida_reportada_lima,
    carga_direccion_at at time zone 'America/Lima' carga_direccion_lima,
    completado_at at time zone 'America/Lima' evidencia_completada_lima,
    cierre_regularizado,
    case
      when registro_id is null then 'Sin registro de asistencia'
      when salida_at is not null then 'Salida guardada: revisar pendientes del resumen si figura incompleta'
      when estado_asistencia in ('J','NG') then 'Estado de asistencia especial: revisar antes de regularizar'
      when archivos=0 then 'Evidencia sin archivos vinculados'
      when salida_reportada_at is null then 'Auditoría sin hora reportada'
      when marcado_at is null then 'Entrada sin hora'
      when salida_reportada_at<marcado_at then 'Hora reportada anterior a la entrada'
      when salida_reportada_at>now()+interval '5 minutes' then 'Hora reportada futura'
      when resumen is null or not coalesce((resumen->>'ok')::boolean,false) then 'Resumen no disponible'
      when not coalesce((resumen->>'aplica_jornada')::boolean,false) then 'El resumen no aplica jornada: bloquea la copia administrativa'
      when coalesce((resumen->>'pendientes_salida')::integer,1)>0 then 'Pendientes del resumen bloquean la copia administrativa'
      else 'Hora reportada y evidencia presentes, pero salida sin copiar: revisar funciones instaladas y condiciones al cargar'
    end diagnostico,
    resumen
  from casos
), funciones as (
  select p.proname nombre,pg_get_function_identity_arguments(p.oid) argumentos,
    md5(p.prosrc) huella,
    position('pendientes_salida' in p.prosrc)>0 consulta_pendientes_salida,
    position('asis_rpe_exento_presencial' in p.prosrc)>0 contempla_exencion_rpe,
    pg_get_functiondef(p.oid) definicion
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'dash_admin_confirmar_entrega','dash_admin_confirmar_entrega_base_70',
    'dash_admin_regularizar_cierre_impl'
  )
)
select jsonb_pretty(jsonb_build_object(
  'periodo',(select to_jsonb(p) from parametros p),
  'salidas_direccion',(select coalesce(jsonb_agg(to_jsonb(i) order by i.nombre,i.fecha),'[]'::jsonb) from informe i),
  'funciones_instaladas',(select coalesce(jsonb_agg(to_jsonb(f) order by f.nombre),'[]'::jsonb) from funciones f)
)) diagnostico;
