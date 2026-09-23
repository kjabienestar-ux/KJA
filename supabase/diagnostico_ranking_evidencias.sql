-- SOLO LECTURA: ejecutar en el editor SQL de Supabase con acceso administrativo.
-- No modifica entregas, aprobaciones ni puntos. Replica los criterios de SQL 70.
-- Revisa septiembre de 2026 hasta ayer (igual que el ranking).
-- Devuelve cada fecha evaluada, su motivo y los totales para contrastar la captura.
with parametros as (
  select date '2026-09-01' mes, '%Yeiser%Jamber%Avila%Medina%'::text nombre
), calendario as materialized (
  select c.id, c.nombre, c.contrato_inicio, d::date fecha,
    d::date >= c.contrato_inicio incorporado,
    public.asis_labora(c,d::date) and coalesce(r.estado,'') not in ('J','NG') laboral,
    (d::date + public.asis_hora_entrada(c,d::date)) at time zone 'America/Lima' inicio_at,
    public.asis_cierre_fin_at(c.id,d::date) fin_at,
    public.asis_compartir_fin_at(c.id,d::date) compartir_fin,
    public.dash_cierre_resumen_colab(c.id,d::date) cierre,
    cfg.salida_gracia_min
  from public.asis_colaboradores c
  join public.asis_areas a on a.id=c.area_id
  cross join parametros p
  cross join lateral generate_series(p.mes::timestamp,
    least((p.mes+interval '1 month - 1 day')::date,
      (now() at time zone 'America/Lima')::date-1)::timestamp,interval '1 day') d
  cross join public.asis_cierre_config cfg
  left join public.asis_registros r on r.colaborador_id=c.id and r.fecha=d::date
  where c.nombre ilike p.nombre and c.activo and a.activo
    and c.contrato_inicio is not null and cfg.id=1
), requisitos as (
  select cal.*, req
  from calendario cal
  cross join lateral jsonb_array_elements(coalesce(cal.cierre->'requisitos','[]')) req
  where (req->>'tipo'='rpe' and laboral and fin_at is not null
      and now()>fin_at+make_interval(mins=>salida_gracia_min))
    or (req->>'tipo'='comparticiones'
      and coalesce((cierre->>'aplica_comparticiones')::boolean,false)
      and compartir_fin is not null and now()>compartir_fin)
), entregas as (
  select r.*, e.id entrega_id, e.estado entrega_estado, e.revision_estado,
    e.completado_at,
    (select count(*) from public.asis_entrega_archivos f where f.entrega_id=e.id) archivos,
    exists(select 1 from public.asis_entregas_direccion au
      where au.entrega_id=e.id and au.colaborador_id=r.id and au.fecha=r.fecha) carga_administrativa,
    (select count(*) from public.asis_entregas_diarias prev
      where prev.colaborador_id=r.id and prev.fecha=r.fecha
        and prev.requisito=r.req->>'tipo' and prev.asignacion_id is null) numero_entregas
  from requisitos r
  left join lateral (
    select e.id,e.estado,e.revision_estado,e.completado_at
    from public.asis_entregas_diarias e
    where e.colaborador_id=r.id and e.fecha=r.fecha
      and e.requisito=r.req->>'tipo' and e.asignacion_id is null
    order by e.creado_at desc,e.id desc limit 1
  ) e on true
), evaluados as (
  select *, case
    when not incorporado then 'Antes del ingreso: cuenta en el denominador'
    when entrega_id is null then 'No hay entrega vinculada a esta fecha'
    when entrega_estado is distinct from 'completo' then 'La última entrega no está completa'
    when archivos=0 then 'La última entrega no tiene archivos vinculados'
    when revision_estado='pendiente' then 'Subida, pero pendiente de aprobación'
    when revision_estado='observada' then 'Subida, pero observada'
    when revision_estado is distinct from 'aprobada' then 'Sin aprobación válida'
    when not coalesce((req->>'completo')::boolean,false) then 'El cierre no considera completo el requisito'
    when req->>'tipo'='rpe' and not carga_administrativa and completado_at is null
      then 'RPE sin hora de finalización de carga'
    when req->>'tipo'='rpe' and not carga_administrativa
      and not coalesce(completado_at between inicio_at and fin_at,false)
      then 'RPE aprobado, pero cargado fuera del horario laboral'
    else 'Suma'
  end motivo
  from entregas
)
select nombre,fecha,req->>'tipo' criterio,motivo,
  count(*) over(partition by id,req->>'tipo') dias_evaluados,
  count(*) filter(where motivo='Suma') over(partition by id,req->>'tipo') dias_que_suman,
  entrega_id,entrega_estado,revision_estado,archivos,numero_entregas,
  coalesce((req->>'completo')::boolean,false) requisito_completo,
  carga_administrativa,
  completado_at at time zone 'America/Lima' carga_finalizada_lima,
  inicio_at at time zone 'America/Lima' inicio_laboral_lima,
  fin_at at time zone 'America/Lima' fin_laboral_lima,
  cierre->>'estado' estado_cierre,
  coalesce(cierre->>'ok','false') resumen_disponible
from evaluados
order by (motivo='Suma'),fecha,criterio;
