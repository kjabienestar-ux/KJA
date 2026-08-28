-- =====================================================================
-- KJA · Dashboard — Fase 2: Pasar lista administrativo
--
-- REQUIERE
--   · migraciones de asistencia 1–14
--   · dashboard_01, dashboard_03 y dashboard_04
--
-- AÑADE
--   · una consulta de lista que aplica reglas laborales en el servidor;
--   · guardado/corrección de P, T, J y NG con horas y vínculo congelados;
--   · eliminación controlada, incluyendo coordinación con evidencia privada.
--   · borrado de evidencias restringido a editor y Dirección.
--
-- NO MODIFICA FILAS EXISTENTES al ejecutar esta migración.
-- =====================================================================

begin;

-- ── 1) LISTA DE UNA FECHA ────────────────────────────────────────────
create or replace function public.dash_admin_lista(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_personas jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',c.id,
      'nombre',c.nombre,
      'area_id',c.area_id,
      'area',a.nombre,
      'modalidad',case
        when hm.base_mod='no_gestiona' and exists(
          select 1 from public.asis_excepciones x
           where x.fecha=p_fecha and x.ambito='colaborador'
             and x.colaborador_id=c.id and x.tipo='laborable_extra'
        ) then 'presencial'
        else hm.base_mod
      end,
      'hora_entrada',public.asis_hora_entrada(c,p_fecha),
      'hora_salida',public.asis_hora_salida(c,p_fecha),
      'horas',public.asis_horas_dia(c,p_fecha),
      'estado',r.estado,
      'nota',r.nota,
      'marcado_at',r.marcado_at,
      'marcado_por',r.marcado_por,
      'origen',r.origen,
      'evidencia_path',r.evidencia_path
    ) order by a.orden,c.orden,c.nombre
  ) into v_personas
  from public.asis_colaboradores c
  join public.asis_areas a on a.id=c.area_id
  left join public.asis_registros r
    on r.colaborador_id=c.id and r.fecha=p_fecha
  cross join lateral (
    select coalesce(
      nullif(c.horario_semanal -> extract(isodow from p_fecha)::text ->> 'mod',''),
      case when extract(isodow from p_fecha)::int=any(c.dias_laborables)
           then 'virtual' else 'no_gestiona' end
    ) base_mod
  ) hm
  where c.activo=true
    and (c.contrato_inicio is null or p_fecha>=c.contrato_inicio)
    and public.asis_labora(c,p_fecha);

  return jsonb_build_object(
    'ok',true,
    'fecha',p_fecha,
    'rol',public.asis_rol(),
    'puede_editar',public.asis_puede_editar(),
    'personas',coalesce(v_personas,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.dash_admin_lista(date) from public,anon;
grant execute on function public.dash_admin_lista(date) to authenticated;


-- ── 2) CREAR O CORREGIR UNA MARCA ───────────────────────────────────
create or replace function public.dash_admin_guardar_estado(
  p_colab bigint,
  p_fecha date,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab public.asis_colaboradores;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_ini time;
  v_limite time;
  v_marca time;
  v_tol int;
  v_at timestamptz;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or p_fecha>v_hoy then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  if p_estado not in ('P','T','J','NG') then
    return jsonb_build_object('ok',false,'motivo','estado');
  end if;

  select * into v_colab
    from public.asis_colaboradores
   where id=p_colab and activo=true;
  if v_colab is null then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;
  if v_colab.contrato_inicio is not null and p_fecha<v_colab.contrato_inicio then
    return jsonb_build_object('ok',false,'motivo','antes_contrato');
  end if;
  if not public.asis_labora(v_colab,p_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_labora');
  end if;

  select coalesce(tolerancia_min,15) into v_tol
    from public.asis_portal_config where id=1;
  v_ini := public.asis_hora_entrada(v_colab,p_fecha);
  v_limite := case when v_ini is null then null
                   else v_ini+make_interval(mins=>coalesce(v_tol,15)) end;

  if p_estado='P' and v_limite is not null then
    v_marca := case when p_fecha=v_hoy then least(v_ahora,v_limite) else v_limite end;
  elsif p_estado='T' and v_limite is not null then
    v_marca := case when p_fecha=v_hoy then greatest(v_ahora,v_limite+interval '1 minute')
                    else v_limite+interval '1 minute' end;
  else
    v_marca := v_ahora;
  end if;
  v_at := (p_fecha+v_marca) at time zone 'America/Lima';

  insert into public.asis_registros
    (colaborador_id,fecha,estado,marcado_por,marcado_at,origen,dispositivo,horas,vinculo)
  values
    (v_colab.id,p_fecha,p_estado,auth.uid(),v_at,'panel',null,
     case when p_estado='NG' then 0 else public.asis_horas_dia(v_colab,p_fecha) end,
     public.asis_vinc_dia(v_colab,p_fecha))
  on conflict (colaborador_id,fecha) do update set
    estado=excluded.estado,
    marcado_por=excluded.marcado_por,
    marcado_at=excluded.marcado_at,
    origen='panel',
    dispositivo=null,
    horas=excluded.horas,
    vinculo=excluded.vinculo;

  return jsonb_build_object('ok',true,'estado',p_estado,'marcado_at',v_at);
end;
$$;

revoke all on function public.dash_admin_guardar_estado(bigint,date,text) from public,anon;
grant execute on function public.dash_admin_guardar_estado(bigint,date,text) to authenticated;


-- ── 3) QUITAR UNA MARCA ─────────────────────────────────────────────
-- Si existe evidencia, la primera llamada devuelve la ruta sin borrar la fila.
-- El navegador elimina el objeto privado y repite con p_evidencia_eliminada.
create or replace function public.dash_admin_quitar_estado(
  p_colab bigint,
  p_fecha date,
  p_evidencia_eliminada boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.asis_registros;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  select * into v_reg from public.asis_registros
   where colaborador_id=p_colab and fecha=p_fecha;
  if v_reg.id is null then
    return jsonb_build_object('ok',true,'ya_eliminada',true);
  end if;
  if v_reg.evidencia_path is not null and not p_evidencia_eliminada then
    return jsonb_build_object('ok',false,'motivo','requiere_evidencia',
                              'ruta',v_reg.evidencia_path);
  end if;

  delete from public.asis_registros where id=v_reg.id;
  return jsonb_build_object('ok',true,'eliminada',true);
end;
$$;

revoke all on function public.dash_admin_quitar_estado(bigint,date,boolean) from public,anon;
grant execute on function public.dash_admin_quitar_estado(bigint,date,boolean) to authenticated;


-- 4) EL VISOR CONSULTA EVIDENCIAS, PERO NO LAS ELIMINA
-- La migracion 12 permitia borrar a cualquier miembro del panel. La interfaz
-- ya lo impedia, pero esta policy lleva la misma restriccion hasta Storage.
drop policy if exists "asis evidencias: borrar miembros" on storage.objects;
create policy "asis evidencias: borrar miembros"
  on storage.objects for delete to authenticated
  using (bucket_id='asis-evidencias' and public.asis_puede_editar());

notify pgrst,'reload schema';

-- COMPROBACIÓN: las cuatro filas deben decir OK.
select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,
       pieza,encontrado,esperado
from (
  select p.proname pieza,count(*)::int encontrado,1 esperado
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('dash_admin_lista','dash_admin_guardar_estado','dash_admin_quitar_estado')
  group by p.proname
  union all
  select 'policy borrar evidencia solo editores',count(*)::int,1
  from pg_policies
  where schemaname='storage' and tablename='objects'
    and policyname='asis evidencias: borrar miembros'
    and cmd='DELETE' and coalesce(qual,'') like '%asis_puede_editar%'
) comprobacion
order by pieza;

commit;
