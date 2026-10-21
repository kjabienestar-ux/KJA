-- Solo lectura: ejecutar en SQL Editor y compartir el resultado de esta consulta.
-- Incluye todas las solicitudes pendientes, no solo el caso de la captura.
-- No modifica horarios, descansos, solicitudes ni saldos.
select s.id as solicitud_id, c.id as colaborador_id, c.nombre,
       s.fecha_inicio, s.fecha_fin, s.descanso_programado,
       c.activo, c.contrato_inicio, c.dias_libres_saldo as saldo,
       s.fecha_inicio < (now() at time zone 'America/Lima')::date as fecha_pasada,
       s.fecha_inicio < c.contrato_inicio as anterior_al_contrato,
       public.asis_labora(c,s.fecha_inicio) as labora_segun_servidor,
       c.horario_semanal -> extract(isodow from s.fecha_inicio)::text as horario_del_dia,
       c.dias_laborables,
       coalesce((select jsonb_agg(jsonb_build_object(
         'fecha',d.fecha,'fecha_presencial',d.fecha_presencial,'motivo',d.motivo))
         from public.asis_descansos_presenciales d
         where d.colaborador_id=c.id and d.fecha=s.fecha_inicio),'[]'::jsonb) as descansos_existentes,
       coalesce((select jsonb_agg(jsonb_build_object(
         'ambito',e.ambito,'tipo',e.tipo,'solo_comparticiones',e.solo_comparticiones))
         from public.asis_excepciones e where e.fecha=s.fecha_inicio
           and (e.ambito='empresa' or (e.ambito='colaborador' and e.colaborador_id=c.id))),
         '[]'::jsonb) as excepciones_del_dia,
       coalesce((select jsonb_agg(jsonb_build_object(
         'id',otra.id,'estado',otra.estado,'inicio',otra.fecha_inicio,
         'fin',otra.fecha_fin,'contra_fecha',otra.contra_fecha,'contra_estado',otra.contra_estado))
         from public.asis_solicitudes_personales otra where otra.colaborador_id=c.id
           and otra.id<>s.id and otra.tipo='dia_libre' and otra.estado in('pendiente','aprobada')
           and (s.fecha_inicio between otra.fecha_inicio and otra.fecha_fin
             or (otra.contra_estado='pendiente' and otra.contra_fecha=s.fecha_inicio))),
         '[]'::jsonb) as otras_solicitudes_en_fecha
from public.asis_solicitudes_personales s
join public.asis_colaboradores c on c.id=s.colaborador_id
where s.tipo='dia_libre' and s.estado='pendiente'
order by s.fecha_inicio,c.nombre,s.id;
