-- DASHBOARD 51 · CO-LÍDERES TÉCNICOS
-- Ejecutar después de dashboard_50_mensajes_direccion_visibles.sql.
--
-- Conserva un líder técnico principal por área y añade hasta dos co-líderes.
-- Los co-líderes reciben el mismo alcance de consulta y seguimiento de su área,
-- sin obtener permisos de Dirección ni alterar contratos, PIN o asistencias.

begin;

-- 1) NIVEL Y LÍMITES GARANTIZADOS EN LA BASE -------------------------
alter table public.asis_perfiles
  drop constraint if exists asis_perfiles_nivel_check;
alter table public.asis_perfiles
  add constraint asis_perfiles_nivel_check
  check (nivel in ('sistemas','lider','colider','miembro'));

comment on column public.asis_perfiles.nivel is
  'Alcance del dashboard: sistemas ve todo; lider y colider ven su área; miembro ve lo suyo. Cada área admite un líder y hasta dos co-líderes.';

create or replace function public.dash_un_lider_por_area()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_area bigint;
  v_actuales integer;
  v_limite integer;
begin
  if new.nivel not in ('lider','colider') or new.colaborador_id is null then
    return new;
  end if;

  select area_id into v_area
    from public.asis_colaboradores
   where id=new.colaborador_id;
  if v_area is null then
    raise exception 'La persona debe pertenecer a un área antes de recibir un rol técnico.';
  end if;

  perform pg_advisory_xact_lock(v_area);
  v_limite:=case when new.nivel='lider' then 1 else 2 end;

  select count(*) into v_actuales
    from public.asis_perfiles perfil
    join public.asis_colaboradores colaborador
      on colaborador.id=perfil.colaborador_id
   where colaborador.area_id=v_area
     and perfil.nivel=new.nivel
     and perfil.id<>new.id;

  if v_actuales>=v_limite then
    if new.nivel='lider' then
      raise exception 'Esa área ya tiene un líder técnico. Usa la administración de roles para reemplazarlo.';
    end if;
    raise exception 'Esa área ya tiene dos co-líderes técnicos. Retira o reemplaza uno de los cupos.';
  end if;
  return new;
end;
$$;

revoke all on function public.dash_un_lider_por_area()
  from public,anon,authenticated;

-- La bitácora existente también registra los tres movimientos de co-liderazgo.
alter table public.asis_roles_eventos
  drop constraint if exists asis_roles_eventos_accion_check;
alter table public.asis_roles_eventos
  add constraint asis_roles_eventos_accion_check check (accion in (
    'asignar_lider','reemplazar_lider','retirar_lider',
    'asignar_colider','reemplazar_colider','retirar_colider'
  ));


-- 2) MAPA ADMINISTRATIVO DE LOS TRES CUPOS ---------------------------
create or replace function public.dash_admin_roles()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_areas jsonb;
  v_eventos jsonb;
  v_resumen jsonb;
begin
  if not public.asis_es_miembro()
     or public.dash_nivel() is distinct from 'sistemas'
     or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id',area.id,
    'nombre',area.nombre,
    'activo',area.activo,
    'personas_activas',(
      select count(*) from public.asis_colaboradores colaborador
       where colaborador.area_id=area.id and colaborador.activo=true
    ),
    'cuentas_activadas',(
      select count(*)
        from public.asis_colaboradores colaborador
        join public.asis_perfiles perfil
          on perfil.colaborador_id=colaborador.id
       where colaborador.area_id=area.id and colaborador.activo=true
         and perfil.activo=true and perfil.acceso_panel=false
    ),
    'lider',(
      select jsonb_build_object(
        'id',colaborador.id,'nombre',colaborador.nombre,
        'activo',colaborador.activo,'cuenta_activa',perfil.activo,
        'contrato_fin_referencia',colaborador.contrato_fin_referencia,
        'tipo_vinculo',colaborador.tipo_vinculo
      )
        from public.asis_perfiles perfil
        join public.asis_colaboradores colaborador
          on colaborador.id=perfil.colaborador_id
       where colaborador.area_id=area.id and perfil.nivel='lider'
       order by perfil.activo desc,colaborador.activo desc,colaborador.nombre
       limit 1
    ),
    'co_lideres',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',colaborador.id,'nombre',colaborador.nombre,
        'activo',colaborador.activo,'cuenta_activa',perfil.activo,
        'contrato_fin_referencia',colaborador.contrato_fin_referencia,
        'tipo_vinculo',colaborador.tipo_vinculo
      ) order by perfil.activo desc,colaborador.activo desc,colaborador.nombre)
        from public.asis_perfiles perfil
        join public.asis_colaboradores colaborador
          on colaborador.id=perfil.colaborador_id
       where colaborador.area_id=area.id and perfil.nivel='colider'
    ),'[]'::jsonb),
    'personas',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',colaborador.id,'nombre',colaborador.nombre,
        'activo',colaborador.activo,
        'nivel',coalesce(perfil.nivel,'miembro'),
        'tiene_cuenta',perfil.id is not null,
        'cuenta_activa',coalesce(perfil.activo,false),
        'es_administrador',coalesce(perfil.acceso_panel,false),
        'asignable',perfil.id is not null and perfil.activo=true
                     and perfil.acceso_panel=false and colaborador.activo=true,
        'contrato_fin_referencia',colaborador.contrato_fin_referencia,
        'tipo_vinculo',colaborador.tipo_vinculo
      ) order by colaborador.activo desc,colaborador.orden,colaborador.nombre)
        from public.asis_colaboradores colaborador
        left join public.asis_perfiles perfil
          on perfil.colaborador_id=colaborador.id
       where colaborador.area_id=area.id
    ),'[]'::jsonb)
  ) order by area.orden,area.nombre) into v_areas
  from public.asis_areas area
  where area.activo=true;

  select jsonb_build_object(
    'areas',count(*),
    'con_lider',count(*) filter(where exists(
      select 1
        from public.asis_perfiles perfil
        join public.asis_colaboradores colaborador
          on colaborador.id=perfil.colaborador_id
       where colaborador.area_id=area.id and perfil.nivel='lider'
    )),
    'sin_lider',count(*) filter(where not exists(
      select 1
        from public.asis_perfiles perfil
        join public.asis_colaboradores colaborador
          on colaborador.id=perfil.colaborador_id
       where colaborador.area_id=area.id and perfil.nivel='lider'
    )),
    'colideres',(
      select count(*)
        from public.asis_perfiles perfil
        join public.asis_colaboradores colaborador
          on colaborador.id=perfil.colaborador_id
        join public.asis_areas area_activa
          on area_activa.id=colaborador.area_id and area_activa.activo=true
       where perfil.nivel='colider'
    ),
    'roles_por_revisar',(
      select count(*)
        from public.asis_perfiles perfil
        join public.asis_colaboradores colaborador
          on colaborador.id=perfil.colaborador_id
        join public.asis_areas area_activa
          on area_activa.id=colaborador.area_id and area_activa.activo=true
       where perfil.nivel in ('lider','colider')
         and (not colaborador.activo or not perfil.activo
              or (colaborador.contrato_fin_referencia is not null
                  and colaborador.contrato_fin_referencia<current_date))
    )
  ) into v_resumen
  from public.asis_areas area where area.activo=true;

  select jsonb_agg(jsonb_build_object(
    'id',evento.id,'accion',evento.accion,'created_at',evento.created_at,
    'actor',actor.nombre,'area',area.nombre,
    'lider_anterior',anterior.nombre,'lider_nuevo',nuevo.nombre
  ) order by evento.created_at desc) into v_eventos
  from (
    select * from public.asis_roles_eventos order by created_at desc limit 30
  ) evento
  left join public.asis_perfiles actor on actor.id=evento.actor_id
  left join public.asis_areas area on area.id=evento.area_id
  left join public.asis_colaboradores anterior
    on anterior.id=evento.lider_anterior_id
  left join public.asis_colaboradores nuevo
    on nuevo.id=evento.lider_nuevo_id;

  return jsonb_build_object(
    'ok',true,
    'co_lideres_max',2,
    'resumen',coalesce(v_resumen,'{}'::jsonb),
    'areas',coalesce(v_areas,'[]'::jsonb),
    'eventos',coalesce(v_eventos,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.dash_admin_roles() from public,anon;
grant execute on function public.dash_admin_roles() to authenticated;


-- 3) ALTA, REEMPLAZO Y RETIRO ATÓMICOS DE CO-LÍDERES ----------------
create or replace function public.dash_admin_asignar_colider(
  p_area bigint,
  p_colab bigint default null,
  p_anterior bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_area_nombre text;
  v_anterior_nombre text;
  v_nuevo_nombre text;
  v_perfil uuid;
  v_nivel text;
  v_cantidad integer;
  v_accion text;
begin
  if not public.asis_es_miembro()
     or public.dash_nivel() is distinct from 'sistemas'
     or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_colab is null and p_anterior is null then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;

  select nombre into v_area_nombre
    from public.asis_areas
   where id=p_area and activo=true
   for update;
  if not found then
    return jsonb_build_object('ok',false,'motivo','area');
  end if;

  if p_anterior is not null then
    select colaborador.nombre into v_anterior_nombre
      from public.asis_perfiles perfil
      join public.asis_colaboradores colaborador
        on colaborador.id=perfil.colaborador_id
     where colaborador.id=p_anterior and colaborador.area_id=p_area
       and perfil.nivel='colider';
    if not found then
      return jsonb_build_object('ok',false,'motivo','colider_no_encontrado');
    end if;
  end if;

  if p_colab is not null then
    select colaborador.nombre into v_nuevo_nombre
      from public.asis_colaboradores colaborador
     where colaborador.id=p_colab and colaborador.area_id=p_area
       and colaborador.activo=true;
    if not found then
      return jsonb_build_object('ok',false,'motivo','persona_area');
    end if;

    select perfil.id,perfil.nivel into v_perfil,v_nivel
      from public.asis_perfiles perfil
     where perfil.colaborador_id=p_colab and perfil.activo=true
       and perfil.acceso_panel=false;
    if not found then
      return jsonb_build_object('ok',false,'motivo','sin_cuenta');
    end if;
    if v_nivel='lider' then
      return jsonb_build_object('ok',false,'motivo','es_lider');
    end if;
    if v_nivel='colider' then
      if p_colab=p_anterior then
        return jsonb_build_object('ok',true,'sin_cambios',true,
          'colider',v_nuevo_nombre,'area',v_area_nombre);
      end if;
      return jsonb_build_object('ok',false,'motivo','ya_colider');
    end if;
  end if;

  if p_anterior is null then
    select count(*) into v_cantidad
      from public.asis_perfiles perfil
      join public.asis_colaboradores colaborador
        on colaborador.id=perfil.colaborador_id
     where colaborador.area_id=p_area and perfil.nivel='colider';
    if v_cantidad>=2 then
      return jsonb_build_object('ok',false,'motivo','sin_cupo');
    end if;
  else
    update public.asis_perfiles perfil set nivel='miembro'
     where perfil.colaborador_id=p_anterior and perfil.nivel='colider';
  end if;

  if p_colab is null then
    v_accion:='retirar_colider';
  else
    update public.asis_perfiles set nivel='colider' where id=v_perfil;
    v_accion:=case when p_anterior is null then 'asignar_colider'
                   else 'reemplazar_colider' end;
  end if;

  insert into public.asis_roles_eventos(
    actor_id,accion,area_id,lider_anterior_id,lider_nuevo_id,detalle
  ) values (
    auth.uid(),v_accion,p_area,p_anterior,p_colab,
    jsonb_build_object('area',v_area_nombre,'tipo','colider')
  );

  return jsonb_build_object(
    'ok',true,'accion',v_accion,'area',v_area_nombre,
    'colider_anterior',v_anterior_nombre,'colider_nuevo',v_nuevo_nombre
  );
end;
$$;

revoke all on function public.dash_admin_asignar_colider(bigint,bigint,bigint)
  from public,anon;
grant execute on function public.dash_admin_asignar_colider(bigint,bigint,bigint)
  to authenticated;


-- 4) MISMAS FUNCIONES DE ÁREA PARA LÍDER Y CO-LÍDER ------------------
create or replace function public.puede_ver_colab(p_colab bigint)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.dash_sesion_vigente() and case
    when p_colab is null then false
    when public.dash_nivel()='sistemas' then true
    when p_colab=public.dash_colab() then true
    when public.dash_nivel() in ('lider','colider') then exists (
      select 1 from public.asis_colaboradores colaborador
       where colaborador.id=p_colab
         and colaborador.area_id=public.dash_area()
    )
    else false
  end;
$$;

comment on function public.puede_ver_colab(bigint) is
  'Sistemas ve todo; líder y co-líder ven su área; cualquier colaborador ve sus propios datos.';

revoke all on function public.puede_ver_colab(bigint) from public,anon;
grant execute on function public.puede_ver_colab(bigint) to authenticated;

create or replace function public.dash_equipo_cierres_hoy()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_personas jsonb;
begin
  if not public.dash_sesion_vigente()
     or public.dash_nivel() not in ('lider','colider','sistemas') then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',colaborador.id,
           'cierre',public.dash_cierre_resumen_colab(colaborador.id,v_hoy)
         ) order by colaborador.orden,colaborador.nombre),'[]'::jsonb)
    into v_personas
    from public.asis_colaboradores colaborador
   where colaborador.activo and public.puede_ver_colab(colaborador.id);

  return jsonb_build_object(
    'ok',true,'fecha',v_hoy,'personas',v_personas
  );
end;
$$;

revoke all on function public.dash_equipo_cierres_hoy() from public,anon;
grant execute on function public.dash_equipo_cierres_hoy() to authenticated;

create or replace function public.dash_admin_revision_entregas(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_es_direccion boolean := coalesce(public.asis_rol()='direccion',false);
  v_es_lider boolean := coalesce(
    public.dash_sesion_vigente()
    and public.dash_nivel() in ('lider','colider'),false
  );
  v_area bigint := public.dash_area();
  v_entregas jsonb;
begin
  if not v_es_direccion and not v_es_lider then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if v_es_lider and v_area is null then
    return jsonb_build_object('ok',false,'motivo','sin_area');
  end if;
  if p_fecha is null or p_fecha<date '2020-01-01' or p_fecha>v_hoy+90 then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',entrega.id,
           'colaborador_id',entrega.colaborador_id,
           'colaborador',colaborador.nombre,
           'area_id',colaborador.area_id,
           'area',area.nombre,
           'fecha',entrega.fecha,
           'requisito',entrega.requisito,
           'asignacion_id',entrega.asignacion_id,
           'titulo',case entrega.requisito
             when 'comparticiones' then 'Comparticiones de Facebook'
             when 'rpe' then 'RPE y evidencias del día'
             when 'salida' then 'Evidencia de hora de salida'
             else coalesce(asignacion.titulo,'Entregable asignado') end,
           'modalidad',entrega.modalidad,
           'detalle',entrega.detalle,
           'estado',entrega.estado,
           'revision_estado',entrega.revision_estado,
           'revision_nota',entrega.revision_nota,
           'completado_at',entrega.completado_at,
           'revisado_at',entrega.revisado_at,
           'revisor',revisor.nombre,
           'jornada_cerrada',registro.salida_at is not null,
           'cargada_por_direccion',carga.id is not null,
           'cargada_por',cargador.nombre,
           'salida_reportada_at',carga.salida_reportada_at,
           'archivos',coalesce((
             select jsonb_agg(jsonb_build_object(
                      'path',archivo.path,'mime',archivo.mime,
                      'bytes',archivo.bytes,'orden',archivo.orden
                    ) order by archivo.orden)
               from public.asis_entrega_archivos archivo
              where archivo.entrega_id=entrega.id
           ),'[]'::jsonb)
         ) order by
           case entrega.revision_estado
             when 'pendiente' then 0 when 'observada' then 1 else 2 end,
           entrega.completado_at desc),'[]'::jsonb)
    into v_entregas
    from public.asis_entregas_diarias entrega
    join public.asis_colaboradores colaborador
      on colaborador.id=entrega.colaborador_id
    join public.asis_areas area on area.id=colaborador.area_id
    left join public.asis_asignaciones_diarias asignacion
      on asignacion.id=entrega.asignacion_id
    left join public.asis_perfiles revisor on revisor.id=entrega.revisado_por
    left join public.asis_registros registro
      on registro.colaborador_id=entrega.colaborador_id
     and registro.fecha=entrega.fecha
    left join public.asis_entregas_direccion carga
      on carga.entrega_id=entrega.id
    left join public.asis_perfiles cargador on cargador.id=carga.actor_id
   where entrega.fecha=p_fecha
     and (v_es_direccion or colaborador.area_id=v_area);

  return jsonb_build_object(
    'ok',true,
    'fecha',p_fecha,
    'area_id',case when v_es_lider then v_area else null end,
    'puede_revisar',v_es_direccion,
    'solo_lectura',v_es_lider,
    'entregas',v_entregas
  );
end;
$$;

revoke all on function public.dash_admin_revision_entregas(date)
  from public,anon;
grant execute on function public.dash_admin_revision_entregas(date)
  to authenticated;

create or replace function public.dash_supervision_impedimentos(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_direccion boolean := coalesce(public.asis_rol()='direccion',false);
  v_lider boolean := coalesce(
    public.dash_sesion_vigente()
    and public.dash_nivel() in ('lider','colider'),false
  );
  v_items jsonb;
begin
  if not v_direccion and not v_lider then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or p_fecha<date '2020-01-01' or p_fecha>v_hoy then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',impedimento.id,
           'colaborador_id',impedimento.colaborador_id,
           'colaborador',colaborador.nombre,
           'area_id',colaborador.area_id,
           'area',area.nombre,
           'requisito',impedimento.requisito,
           'asignacion_id',impedimento.asignacion_id,
           'detalle',impedimento.detalle,
           'estado',impedimento.estado,
           'actualizado_at',impedimento.actualizado_at
         ) order by impedimento.actualizado_at desc),'[]'::jsonb)
    into v_items
    from public.asis_cierre_impedimentos impedimento
    join public.asis_colaboradores colaborador
      on colaborador.id=impedimento.colaborador_id
    join public.asis_areas area on area.id=colaborador.area_id
   where impedimento.fecha=p_fecha and impedimento.estado='abierto'
     and (v_direccion or colaborador.area_id=public.dash_area());

  return jsonb_build_object(
    'ok',true,'fecha',p_fecha,'solo_lectura',v_lider,
    'impedimentos',v_items
  );
end;
$$;

revoke all on function public.dash_supervision_impedimentos(date)
  from public,anon;
grant execute on function public.dash_supervision_impedimentos(date)
  to authenticated;

-- La política vigente conserva imágenes y video, y amplía la lectura al
-- co-líder únicamente cuando puede_ver_colab confirma que es su misma área.
drop policy if exists "cierre evidencias: lectura autorizada" on storage.objects;
create policy "cierre evidencias: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id='asis-cierre-evidencias'
    and name ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]+/[0-9a-f-]+\.(jpg|webp|mp4|webm)$'
    and (
      public.asis_rol()='direccion'
      or (
        public.dash_sesion_vigente()
        and (
          public.dash_colab()=split_part(name,'/',4)::bigint
          or (
            public.dash_nivel() in ('lider','colider')
            and public.puede_ver_colab(split_part(name,'/',4)::bigint)
          )
        )
      )
    )
  );

notify pgrst,'reload schema';
commit;


-- 5) VERIFICACIÓN ----------------------------------------------------
select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,
       pieza,encontrado,esperado
from (
  select 'nivel colider permitido'::text pieza,
         count(*)::int encontrado,1 esperado
    from pg_constraint restriccion
   where restriccion.conname='asis_perfiles_nivel_check'
     and pg_get_constraintdef(restriccion.oid) like '%colider%'
  union all
  select 'RPC administrar co-lideres',count(*)::int,1
    from pg_proc funcion
    join pg_namespace esquema on esquema.oid=funcion.pronamespace
   where esquema.nspname='public'
     and funcion.proname='dash_admin_asignar_colider'
  union all
  select 'acciones auditables de co-lider',count(*)::int,1
    from pg_constraint restriccion
   where restriccion.conname='asis_roles_eventos_accion_check'
     and pg_get_constraintdef(restriccion.oid) like '%asignar_colider%'
  union all
  select 'lectura privada de evidencias',count(*)::int,1
    from pg_policies
   where schemaname='storage' and tablename='objects'
     and policyname='cierre evidencias: lectura autorizada'
) verificacion
order by pieza;

-- Resultado funcional: cada área devuelve un líder y entre cero y dos
-- co-líderes. Los cupos restantes se completan desde la interfaz.
select area.id,area.nombre,
       count(*) filter(where perfil.nivel='lider') as lideres,
       count(*) filter(where perfil.nivel='colider') as colideres
  from public.asis_areas area
  left join public.asis_colaboradores colaborador on colaborador.area_id=area.id
  left join public.asis_perfiles perfil on perfil.colaborador_id=colaborador.id
 where area.activo=true
 group by area.id,area.nombre
 order by area.nombre;
