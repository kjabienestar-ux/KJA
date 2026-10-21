-- Solo lectura. Ejecutar en SQL Editor del proyecto xadxmfgdxwplmhijagix.
-- No aprueba, rechaza ni modifica solicitudes o saldos.
select (now() at time zone 'America/Lima')::date as hoy_lima;

select p.proname, pg_get_functiondef(p.oid) as definicion_instalada
from pg_proc p
where p.oid in (
  to_regprocedure('public.dash_admin_resolver_solicitud(bigint,boolean,text)'),
  to_regprocedure('public.asis_validar_resolucion_libre()'),
  to_regprocedure('public.asis_validar_fecha_libre(bigint,date,bigint)'),
  to_regprocedure('public.asis_validar_aprobacion_libre(bigint,date,bigint)'),
  to_regprocedure('public.asis_descontar_dia_libre_aprobado()'),
  to_regprocedure('public.asis_programar_dia_libre_aprobado()')
);

select t.tgname, pg_get_triggerdef(t.oid) as trigger_instalado
from pg_trigger t
where t.tgrelid=to_regclass('public.asis_solicitudes_personales')
  and not t.tgisinternal;

select r.rolname,
  case when to_regprocedure('public.dash_admin_resolver_solicitud(bigint,boolean,text)') is not null
  then has_function_privilege(r.oid,
    to_regprocedure('public.dash_admin_resolver_solicitud(bigint,boolean,text)'), 'EXECUTE') end as puede_ejecutar
from pg_roles r where r.rolname in ('anon','authenticated');

-- Identificar las solicitudes pendientes para la fecha de la captura.
-- Se omiten nombres, comentarios, contacto y rutas de comprobantes.
select s.id, s.fecha_inicio, s.fecha_fin, s.estado, s.descanso_programado,
       c.dias_libres_saldo as saldo_actual,
       s.fecha_inicio <= (now() at time zone 'America/Lima')::date as bloqueada_por_regla_anterior,
       s.fecha_inicio < (now() at time zone 'America/Lima')::date as fecha_pasada
from public.asis_solicitudes_personales s
join public.asis_colaboradores c on c.id=s.colaborador_id
where s.tipo='dia_libre' and s.estado='pendiente'
  and s.fecha_inicio='2026-10-21'::date
order by s.id;
