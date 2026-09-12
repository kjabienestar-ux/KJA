-- DASHBOARD 50 · MENSAJES DE DIRECCION VISIBLES
-- Ejecutar despues de dashboard_49_vencimiento_comparticiones.sql.
--
-- Recupera notas de revision que no se copiaron a la bandeja, conserva siempre
-- el mensaje al crear nuevas notificaciones y expone el nombre del remitente.

begin;

update public.asis_notificaciones notificacion
   set mensaje=coalesce(
     nullif(btrim(notificacion.mensaje),''),
     nullif(btrim(revision.nota),''),
     nullif(btrim(entrega.revision_nota),'')
   )
  from public.asis_entrega_revisiones revision
  join public.asis_entregas_diarias entrega on entrega.id=revision.entrega_id
 where notificacion.dedupe_key='revision:'||revision.id::text
   and notificacion.tipo in ('revision_aprobada','revision_observada')
   and nullif(btrim(notificacion.mensaje),'') is null
   and coalesce(nullif(btrim(revision.nota),''),nullif(btrim(entrega.revision_nota),'')) is not null;

create or replace function public.dash_notificar_revision_trg()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_entrega public.asis_entregas_diarias;
  v_titulo text;
  v_mensaje text;
begin
  select * into v_entrega
    from public.asis_entregas_diarias
   where id=new.entrega_id;
  if v_entrega.id is null then return new; end if;

  select case v_entrega.requisito
           when 'comparticiones' then 'Comparticiones de Facebook'
           when 'rpe' then 'RPE y evidencias del día'
           when 'salida' then 'Evidencia de hora de salida'
           else coalesce(asignacion.titulo,'Entregable asignado')
         end
    into v_titulo
    from (select 1) base
    left join public.asis_asignaciones_diarias asignacion
      on asignacion.id=v_entrega.asignacion_id;

  v_mensaje:=coalesce(
    nullif(btrim(new.nota),''),
    nullif(btrim(v_entrega.revision_nota),'')
  );

  insert into public.asis_notificaciones(
    colaborador_id,tipo,titulo,mensaje,fecha,entrega_id,actor_id,
    creado_at,dedupe_key
  ) values (
    v_entrega.colaborador_id,
    case new.estado_nuevo when 'observada' then 'revision_observada' else 'revision_aprobada' end,
    v_titulo,v_mensaje,v_entrega.fecha,v_entrega.id,new.actor_id,
    new.creado_at,'revision:'||new.id::text
  )
  on conflict(dedupe_key) where dedupe_key is not null do update
    set mensaje=coalesce(excluded.mensaje,asis_notificaciones.mensaje),
        actor_id=coalesce(excluded.actor_id,asis_notificaciones.actor_id);

  return new;
end;
$$;

create or replace function public.dash_mis_notificaciones_revision(
  p_limite integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_colaborador bigint:=public.dash_colab();
  v_limite integer:=greatest(1,least(coalesce(p_limite,24),50));
  v_no_leidas integer:=0;
  v_notificaciones jsonb:='[]'::jsonb;
begin
  if not public.dash_sesion_vigente() or v_colaborador is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;

  select count(*)::integer into v_no_leidas
    from public.asis_notificaciones notificacion
   where notificacion.colaborador_id=v_colaborador
     and notificacion.leida_at is null
     and notificacion.ocultada_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',item.id,
           'tipo',item.tipo,
           'estado',case item.tipo
             when 'revision_observada' then 'observada'
             when 'revision_aprobada' then 'aprobada'
             else item.tipo
           end,
           'nota',item.mensaje,
           'titulo',item.titulo,
           'fecha',item.fecha,
           'creado_at',item.creado_at,
           'leida',item.leida_at is not null,
           'entrega_id',item.entrega_id,
           'asignacion_id',item.asignacion_id,
           'remitente',item.remitente,
           'meta',item.datos
         ) order by item.creado_at desc,item.id desc),'[]'::jsonb)
    into v_notificaciones
    from (
      select notificacion.*,perfil.nombre as remitente
        from public.asis_notificaciones notificacion
        left join public.asis_perfiles perfil on perfil.id=notificacion.actor_id
       where notificacion.colaborador_id=v_colaborador
         and notificacion.ocultada_at is null
       order by notificacion.creado_at desc,notificacion.id desc
       limit v_limite
    ) item;

  return jsonb_build_object(
    'ok',true,
    'no_leidas',v_no_leidas,
    'notificaciones',v_notificaciones
  );
end;
$$;

revoke all on function public.dash_mis_notificaciones_revision(integer) from public,anon;
grant execute on function public.dash_mis_notificaciones_revision(integer) to authenticated;

notify pgrst,'reload schema';
commit;

-- Verificacion: muestra los mensajes recientes y el nombre que recibira el
-- colaborador como remitente. No expone notificaciones a otros usuarios.
select notificacion.id,notificacion.tipo,notificacion.titulo,
       left(notificacion.mensaje,80) as mensaje,
       perfil.nombre as remitente,notificacion.creado_at
  from public.asis_notificaciones notificacion
  left join public.asis_perfiles perfil on perfil.id=notificacion.actor_id
 order by notificacion.creado_at desc
 limit 20;
