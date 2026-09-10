-- DASHBOARD 45 · EXCLUIR EL 05 DE SEPTIEMBRE DE 2026
-- El portal todavia no estaba disponible ese dia. La fecha debe mostrarse como
-- no laborable para todo el equipo, nunca como una jornada incompleta.
--
-- Esta correccion conserva registros, horas y evidencias historicas. Solo
-- normaliza las excepciones de la fecha y evita que un horario independiente
-- de comparticiones vuelva a activarla.

begin;

delete from public.asis_excepciones
 where fecha=date '2026-09-05'
   and ambito='empresa';

-- Una excepcion personal de trabajo extra tiene prioridad sobre un feriado en
-- asis_labora(). Se retira solamente para esta fecha, pues el sistema no estuvo
-- disponible para ningun colaborador.
delete from public.asis_excepciones
 where fecha=date '2026-09-05'
   and ambito='colaborador'
   and tipo='laborable_extra';

insert into public.asis_excepciones(
  fecha,
  ambito,
  colaborador_id,
  tipo,
  nota,
  creado_por
)
values(
  date '2026-09-05',
  'empresa',
  null,
  'feriado',
  'Sistema de asistencia aun no disponible',
  null
);

-- Los horarios de Facebook pueden existir aunque una persona no tenga jornada.
-- Un cierre global de empresa, en cambio, tambien debe desactivar esa agenda.
create or replace function public.asis_compartir_programado(
  p_colab bigint,
  p_fecha date
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select case
    when exists(
      select 1
        from public.asis_excepciones e
       where e.fecha=p_fecha
         and e.ambito='empresa'
    ) then false
    when not coalesce((
      select c.comparticiones_horario_configurado
        from public.asis_colaboradores c
       where c.id=p_colab
    ),false) then coalesce((
      select public.asis_labora(c,p_fecha)
        from public.asis_colaboradores c
       where c.id=p_colab
    ),false)
    else exists(
      select 1
        from public.asis_comparticiones_horarios h
       where h.colaborador_id=p_colab
         and h.dia_semana=extract(isodow from p_fecha)::int
    )
  end
$$;

revoke all on function public.asis_compartir_programado(bigint,date)
  from public,anon;
grant execute on function public.asis_compartir_programado(bigint,date)
  to authenticated;

commit;

-- Verificacion: ambas cifras deben coincidir y el estado debe ser OK.
select
  case
    when count(*)=count(*) filter(
      where not public.asis_labora(c,date '2026-09-05')
        and not public.asis_compartir_programado(c.id,date '2026-09-05')
    ) then 'OK'
    else 'REVISAR'
  end as estado,
  count(*)::integer as colaboradores_activos,
  count(*) filter(
    where not public.asis_labora(c,date '2026-09-05')
      and not public.asis_compartir_programado(c.id,date '2026-09-05')
  )::integer as excluidos
from public.asis_colaboradores c
where c.activo;
