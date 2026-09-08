-- DASHBOARD 36 - CIERRE AUTOMATICO Y RECUPERACION POR EVIDENCIA DE SALIDA
-- Ejecutar despues de dashboard_35_comparticiones_hasta_50.sql.
-- Corrige jornadas con todas las evidencias completas que quedaron abiertas
-- porque la hora de salida dependia de un segundo clic.

begin;

create table if not exists public.asis_cierre_regularizaciones_auto (
  id                    bigint generated always as identity primary key,
  registro_id           bigint not null unique
                          references public.asis_registros(id) on delete cascade,
  entrega_salida_id     bigint not null
                          references public.asis_entregas_diarias(id),
  salida_recuperada_at  timestamptz not null,
  motivo                text not null,
  creado_at             timestamptz not null default now()
);

alter table public.asis_cierre_regularizaciones_auto enable row level security;
revoke all on public.asis_cierre_regularizaciones_auto from anon,authenticated;

-- Conserva dashboard_35 como base. La autoridad para cerrar sigue siendo
-- dash_marcar_salida, que revalida horario, entrada y requisitos en el servidor.
do $$
begin
  if to_regprocedure('public.dash_confirmar_entrega_base_36(text,bigint,text,text[],text)') is null then
    alter function public.dash_confirmar_entrega(text,bigint,text,text[],text)
      rename to dash_confirmar_entrega_base_36;
  end if;
end;
$$;

revoke all on function public.dash_confirmar_entrega_base_36(text,bigint,text,text[],text)
  from public,anon,authenticated;

create or replace function public.dash_confirmar_entrega(
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_paths text[] default '{}',
  p_detalle text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_resultado jsonb;
  v_salida jsonb;
  v_colab bigint:=public.dash_colab();
  v_fecha date;
begin
  v_resultado:=public.dash_confirmar_entrega_base_36(
    p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle
  );
  if not coalesce((v_resultado->>'ok')::boolean,false) then
    return v_resultado;
  end if;

  begin
    v_fecha:=nullif(v_resultado->'resumen'->>'fecha','')::date;
  exception when others then
    v_fecha:=null;
  end;
  v_fecha:=coalesce(v_fecha,public.asis_cierre_fecha_activa(v_colab));

  if v_colab is not null
     and exists(
       select 1 from public.asis_registros r
        where r.colaborador_id=v_colab and r.fecha=v_fecha
          and r.salida_at is null
     )
     and exists(
       select 1 from public.asis_entregas_diarias e
        where e.colaborador_id=v_colab and e.fecha=v_fecha
          and e.requisito='salida' and e.estado='completo'
          and exists(select 1 from public.asis_entrega_archivos f where f.entrega_id=e.id)
     ) then
    v_salida:=public.dash_marcar_salida('cierre_automatico_por_evidencia');

    if coalesce((v_salida->>'ok')::boolean,false) then
      return v_resultado||jsonb_build_object(
        'salida_registrada',true,
        'salida_at',v_salida->'salida_at',
        'resumen',v_salida->'resumen'
      );
    end if;

    -- No revierte una evidencia valida cuando aun falta otro requisito.
    -- Al guardar el ultimo pendiente se intentara cerrar nuevamente.
    v_resultado:=v_resultado||jsonb_build_object(
      'salida_registrada',false,
      'salida_motivo',v_salida->>'motivo',
      'resumen',public.dash_cierre_resumen_colab(v_colab,v_fecha)
    );
  end if;

  return v_resultado;
end;
$$;

revoke all on function public.dash_confirmar_entrega(text,bigint,text,text[],text)
  from public,anon;
grant execute on function public.dash_confirmar_entrega(text,bigint,text,text[],text)
  to authenticated;

-- Recupera solo casos pasados equivalentes: entrada valida, foto de salida
-- con archivo y cero requisitos pendientes segun la configuracion de ese dia.
with candidatas as (
  select r.id as registro_id,
         e.id as entrega_salida_id,
         e.completado_at as salida_recuperada_at
    from public.asis_registros r
    join lateral (
      select entrega.id,entrega.completado_at
        from public.asis_entregas_diarias entrega
       where entrega.colaborador_id=r.colaborador_id
         and entrega.fecha=r.fecha
         and entrega.requisito='salida'
         and entrega.estado='completo'
         and exists(
           select 1 from public.asis_entrega_archivos archivo
            where archivo.entrega_id=entrega.id
         )
       order by entrega.completado_at desc,entrega.id desc
       limit 1
    ) e on true
    cross join lateral (
      select public.dash_cierre_resumen_colab(r.colaborador_id,r.fecha) as resumen
    ) cierre
   where r.salida_at is null
     and r.estado in ('P','T')
     and r.fecha<(now() at time zone 'America/Lima')::date
     and e.completado_at>=r.marcado_at
     and coalesce((cierre.resumen->>'ok')::boolean,false)
     and coalesce((cierre.resumen->>'aplica_jornada')::boolean,false)
     and coalesce((cierre.resumen->>'pendientes_salida')::integer,1)=0
)
insert into public.asis_cierre_regularizaciones_auto(
  registro_id,entrega_salida_id,salida_recuperada_at,motivo
)
select registro_id,entrega_salida_id,salida_recuperada_at,
       'Todos los requisitos estaban completos; faltaba el segundo clic de salida.'
  from candidatas
on conflict(registro_id) do nothing;

update public.asis_registros r
   set salida_at=a.salida_recuperada_at,
       salida_dispositivo='recuperada:evidencia_salida',
       salida_origen='dashboard',
       salida_por=null,
       horas_efectivas=round(greatest(0,
         extract(epoch from(a.salida_recuperada_at-r.marcado_at))/3600)::numeric,2),
       horas=round(greatest(0,
         extract(epoch from(a.salida_recuperada_at-r.marcado_at))/3600)::numeric,2),
       cierre_regularizado=true,
       cierre_nota=concat_ws(E'\n',nullif(btrim(r.cierre_nota),''),
         'Cierre recuperado automaticamente desde la evidencia de salida (dashboard_36).'),
       cierre_actualizado_at=now()
  from public.asis_cierre_regularizaciones_auto a
 where a.registro_id=r.id
   and r.salida_at is null;

notify pgrst,'reload schema';
commit;

select c.nombre,r.fecha,r.marcado_at,r.salida_at,
       r.horas_efectivas,r.cierre_regularizado
  from public.asis_cierre_regularizaciones_auto a
  join public.asis_registros r on r.id=a.registro_id
  join public.asis_colaboradores c on c.id=r.colaborador_id
 order by r.fecha desc,c.nombre;
