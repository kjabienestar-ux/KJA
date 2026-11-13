-- KJA-037. Instalación aditiva; NO designa personas ni activa el módulo.
-- Activación y emergencia: docs/cuentas-administrativas.md.
begin;
create schema if not exists kja_admin;
revoke all on schema kja_admin from public,anon,authenticated;
create table kja_admin.config(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into kja_admin.config values(true,false);
create table kja_admin.estados(
 id uuid primary key references public.asis_perfiles(id) on delete restrict,
 estado text not null default 'activa' check(estado in ('activa','suspendida','archivada')),
 revocada_antes timestamptz not null default '-infinity',
 clave_operacion uuid, actualizado_at timestamptz not null default now()
);
create table kja_admin.puestos(
 puesto smallint primary key check(puesto in (1,2)),
 cuenta uuid not null unique references public.asis_perfiles(id) on delete restrict
);
create table kja_admin.operaciones(
 id uuid primary key, actor uuid, sesion uuid,
 cuenta uuid, accion text not null, resultado text not null default 'pendiente',
 antes jsonb, despues jsonb, motivo text not null, creado_at timestamptz not null default now(), terminado_at timestamptz
);
create index on kja_admin.operaciones(creado_at desc);
alter table kja_admin.config enable row level security;
alter table kja_admin.estados enable row level security;
alter table kja_admin.puestos enable row level security;
alter table kja_admin.operaciones enable row level security;
revoke all on all tables in schema kja_admin from public,anon,authenticated;

-- Estado de negocio y sesión real: los JWT revocados no conservan privilegios.
create function kja_admin.sesion(p_uid uuid,p_sid uuid) returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.id=p_sid and s.user_id=p_uid
   and (s.not_after is null or s.not_after>now())
   and s.created_at>coalesce((select revocada_antes from kja_admin.estados where id=p_uid),'-infinity'));
$$;
create function kja_admin.activa(p_uid uuid) returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from public.asis_perfiles p join auth.users u on u.id=p.id
  left join kja_admin.estados e on e.id=p.id
  where p.id=p_uid and p.activo and p.acceso_panel and coalesce(e.estado,'activa')='activa'
  and e.clave_operacion is null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()));
$$;
create function kja_admin.autorizado(p_uid uuid,p_sid uuid) returns boolean language sql stable security definer
set search_path='' as $$
 select coalesce((select habilitado from kja_admin.config where id),false)
  and kja_admin.activa(p_uid) and kja_admin.sesion(p_uid,p_sid)
  and exists(select 1 from kja_admin.puestos where cuenta=p_uid);
$$;
create function public.dash_es_superadmin() returns boolean language sql stable security definer set search_path='' as $$
 select kja_admin.autorizado(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
$$;
revoke all on function public.dash_es_superadmin() from public,anon;
grant execute on function public.dash_es_superadmin() to authenticated;

create function kja_admin.dos_puestos() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select habilitado from kja_admin.config where id) and
   ((select count(*) from kja_admin.puestos)<>2 or exists(
    select 1 from kja_admin.puestos s join public.asis_perfiles p on p.id=s.cuenta
    left join kja_admin.estados e on e.id=p.id join auth.users u on u.id=p.id
    where not p.activo or not p.acceso_panel or coalesce(e.estado,'activa')<>'activa'
      or u.email_confirmed_at is null or u.deleted_at is not null or u.banned_until>now())) then
  raise exception 'Deben permanecer dos superadministradores activos. Primero delega el rol.' using errcode='23514';
 end if;
 return null;
end;$$;
create constraint trigger dos_superadmins after insert or update or delete on kja_admin.puestos
 deferrable initially deferred for each row execute function kja_admin.dos_puestos();
create constraint trigger activar_dos_superadmins after insert or update on kja_admin.config
 deferrable initially deferred for each row execute function kja_admin.dos_puestos();
create constraint trigger estados_dos_superadmins after insert or update or delete on kja_admin.estados
 deferrable initially deferred for each row execute function kja_admin.dos_puestos();
create constraint trigger perfiles_dos_superadmins after update or delete on public.asis_perfiles
 deferrable initially deferred for each row execute function kja_admin.dos_puestos();
create constraint trigger auth_dos_superadmins after update or delete on auth.users
 deferrable initially deferred for each row execute function kja_admin.dos_puestos();

-- Sin escrituras directas: tampoco las RPC antiguas pueden modificar un admin.
revoke insert,update,delete on public.asis_perfiles from anon,authenticated;
create function kja_admin.proteger_perfil() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (case when tg_op='INSERT' then new.acceso_panel when tg_op='DELETE' then old.acceso_panel
     else old.acceso_panel or new.acceso_panel end)
    and coalesce(auth.jwt()->>'role','')<>'service_role' and session_user not in ('postgres','supabase_admin') then
   raise exception 'Gestiona las cuentas administrativas desde su sección autorizada.' using errcode='42501';
 end if;
 -- Authenticated SECURITY DEFINER RPCs still carry the caller JWT.
 if auth.uid() is not null and coalesce(auth.jwt()->>'role','')<>'service_role'
    and (case when tg_op='INSERT' then new.acceso_panel when tg_op='DELETE' then old.acceso_panel
      else old.acceso_panel or new.acceso_panel end) then
   raise exception 'Gestiona las cuentas administrativas desde su sección autorizada.' using errcode='42501';
 end if;
 if tg_op='DELETE' then
   if old.acceso_panel then raise exception 'Las cuentas administrativas se archivan, no se eliminan.';end if;
   return old;
 end if;
 if tg_op='UPDATE' and old.acceso_panel and not new.acceso_panel then
   raise exception 'Conserva la identidad administrativa; suspende o archiva su acceso.';
 end if;
 return new;
end;$$;
create trigger proteger_cuenta_admin before insert or update or delete on public.asis_perfiles
 for each row execute function kja_admin.proteger_perfil();

create or replace function public.asis_es_miembro() returns boolean language sql stable security definer set search_path='' as $$
 select kja_admin.activa(auth.uid()) and kja_admin.sesion(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
$$;
create or replace function public.asis_rol() returns text language sql stable security definer set search_path='' as $$
 select rol from public.asis_perfiles where id=auth.uid() and public.asis_es_miembro();
$$;
create or replace function public.dash_sesion_vigente() returns boolean language plpgsql stable security definer set search_path='' as $$
declare p public.asis_perfiles; sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
 select * into p from public.asis_perfiles where id=auth.uid() and activo;
 if not found then return false;end if;
 if p.acceso_panel then
   if not kja_admin.sesion(p.id,sid) then return false;end if;
   return kja_admin.activa(p.id) or p.colaborador_id is not null;
 end if;
 return exists(select 1 from public.dash_sesiones s where s.session_id::text=sid::text and s.perfil_id=p.id
  and s.revocada_at is null and s.vence_at>now());
end;$$;
create or replace function public.dash_nivel() returns text language sql stable security definer set search_path='' as $$
 select case when acceso_panel and not public.asis_es_miembro() then 'miembro' else nivel end
 from public.asis_perfiles where id=auth.uid() and activo and public.dash_sesion_vigente();
$$;

-- Conserva el dash_inicio vigente (incluidas jornadas 132) sin copiar su lógica.
alter function public.dash_inicio(bigint) rename to dash_inicio_base_037;
revoke all on function public.dash_inicio_base_037(bigint) from public,anon,authenticated;
create function public.dash_inicio(p_colab bigint default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 r:=public.dash_inicio_base_037(p_colab);
 if coalesce((r->>'ok')::boolean,false) then
  r:=jsonb_set(r,'{perfil,nivel}',to_jsonb(public.dash_nivel()));
 end if;
 return r;
end;$$;
revoke all on function public.dash_inicio(bigint) from public,anon;
grant execute on function public.dash_inicio(bigint) to authenticated;
create or replace function public.dash_arranque() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 r:=public.dash_inicio();
 return jsonb_build_object('inicio',r,'acceso',case when coalesce((r->>'ok')::boolean,false) then
 jsonb_build_object('rol',coalesce(public.asis_rol(),'visor'),'acceso_panel',public.asis_es_miembro(),
  'superadmin',public.dash_es_superadmin()) else null end);
end;$$;

create function public.dash_admin_cuentas() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cuentas jsonb; historial jsonb;
begin
 if not public.dash_es_superadmin() then raise exception 'Solo los dos superadministradores pueden acceder.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'email',u.email,'rol',p.rol,
 'estado',coalesce(e.estado,case when p.activo then 'activa' else 'suspendida' end),
 'superadmin',s.puesto is not null,'puesto',s.puesto,'clave_pendiente',e.clave_operacion is not null)
 order by s.puesto nulls last,p.nombre),'[]') into cuentas
 from public.asis_perfiles p join auth.users u on u.id=p.id
 left join kja_admin.estados e on e.id=p.id left join kja_admin.puestos s on s.cuenta=p.id where p.acceso_panel;
 select coalesce(jsonb_agg(x order by x.creado_at desc),'[]') into historial from (
  select o.id,o.accion,o.resultado,o.motivo,o.creado_at,o.terminado_at,
   coalesce(a.nombre,'Custodio de Supabase') actor,coalesce(t.nombre,o.despues->>'email','Cuenta nueva') cuenta
  from kja_admin.operaciones o left join public.asis_perfiles a on a.id=o.actor
   left join public.asis_perfiles t on t.id=o.cuenta order by o.creado_at desc limit 50
 ) x;
 return jsonb_build_object('ok',true,'cuentas',cuentas,'historial',historial);
end;$$;
revoke all on function public.dash_admin_cuentas() from public,anon;
grant execute on function public.dash_admin_cuentas() to authenticated;

-- Solo Edge service_role. Actor y sesión se obtienen del token verificado, nunca del body.
create function public.dash_admin_cuenta_operar(p_actor uuid,p_sesion uuid,p_accion text,p_datos jsonb,p_operacion uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid:=nullif(p_datos->>'id','')::uuid; p public.asis_perfiles; u auth.users;
 op kja_admin.operaciones; st text; anterior jsonb; v_nombre text; permiso text; prueba uuid;
begin
 perform 1 from kja_admin.config where id for update;
 -- Finalizar una reserva conserva su autoridad si el cambio de clave revocó la sesión del actor.
 if p_accion='clave_fin' then
  select * into op from kja_admin.operaciones where id=p_operacion and actor=p_actor and sesion=p_sesion and accion='restablecer' for update;
  if not found then raise exception 'Operación no encontrada.';end if;
  if op.resultado<>'pendiente' then return jsonb_build_object('ok',op.resultado='completada');end if;
  if p_datos->>'resultado' not in ('completada','fallida') then raise exception 'Resultado no válido.';end if;
  update kja_admin.estados set clave_operacion=null,actualizado_at=now(),
    revocada_antes=case when p_datos->>'resultado'='completada' then clock_timestamp() else revocada_antes end
   where id=op.cuenta and clave_operacion=p_operacion;
  update kja_admin.operaciones set resultado=p_datos->>'resultado',terminado_at=clock_timestamp() where id=op.id;
  return jsonb_build_object('ok',true);
 end if;
 if not kja_admin.autorizado(p_actor,p_sesion) then raise exception 'Solo los dos superadministradores pueden gestionar cuentas.' using errcode='42501';end if;
 select * into op from kja_admin.operaciones where id=p_operacion for update;
 if found then
  if op.actor<>p_actor or op.accion<>p_accion or op.cuenta is distinct from target then raise exception 'Identificador de operación en uso.';end if;
  if op.resultado='completada' then return jsonb_build_object('ok',true,'repetida',true);end if;
 end if;
 if length(btrim(coalesce(p_datos->>'motivo','')))<3 or length(p_datos->>'motivo')>300 then raise exception 'Indica un motivo de 3 a 300 caracteres.';end if;
 if p_accion in ('crear','editar') then
  v_nombre:=btrim(p_datos->>'nombre');permiso:=p_datos->>'rol';
  if v_nombre is null or length(v_nombre) not between 2 and 100 or permiso is null or permiso not in ('visor','editor','direccion') then raise exception 'Revisa nombre y permiso.';end if;
 end if;
 if p_accion='crear' then
  select * into u from auth.users where id=target and deleted_at is null and email_confirmed_at is not null;
  if not found or lower(u.email)<>lower(btrim(p_datos->>'email')) or lower(u.email) like '%@interno.kja' then raise exception 'Identidad no válida para acceso administrativo.';end if;
  select * into p from public.asis_perfiles where id=target for update;
  if found then raise exception 'La identidad ya tiene perfil. No se convierte ni reemplaza.';end if;
  insert into public.asis_perfiles(id,nombre,rol,nivel,activo,acceso_panel) values(target,v_nombre,permiso,'sistemas',true,true);
  insert into kja_admin.estados(id) values(target);
 elsif p_accion in ('editar','suspender','reactivar','archivar','restaurar','delegar','restablecer') then
  select * into p from public.asis_perfiles where id=target and acceso_panel for update;
  if not found then raise exception 'No se encontró la cuenta administrativa.';end if;
  insert into kja_admin.estados(id,estado) values(target,case when p.activo then 'activa' else 'suspendida' end) on conflict do nothing;
  select estado into st from kja_admin.estados where id=target for update;
  anterior:=jsonb_build_object('nombre',p.nombre,'rol',p.rol,'estado',st);
  if p_accion in ('suspender','archivar','restaurar','reactivar') and exists(select 1 from kja_admin.puestos where cuenta=target) then
   raise exception 'Primero debe delegar su rol de superadministrador.';
  end if;
  if p_accion='editar' then
   if st<>'activa' then raise exception 'Reactiva la cuenta antes de editarla.';end if;
   update public.asis_perfiles set nombre=v_nombre,rol=permiso where id=target;
  elsif p_accion='delegar' then
   if not kja_admin.activa(target) or exists(select 1 from kja_admin.puestos where cuenta=target) then raise exception 'Selecciona otro administrador activo.';end if;
   prueba:=nullif(p_datos->>'sesion_prueba','')::uuid;
   if not exists(select 1 from auth.sessions where id=prueba and user_id=p_actor and created_at>now()-interval '2 minutes') then raise exception 'Confirma nuevamente tu contraseña.';end if;
   update kja_admin.puestos set cuenta=target where cuenta=p_actor;
   if not found then raise exception 'Tu designación cambió. Actualiza la página.';end if;
  elsif p_accion='restablecer' then
   if st<>'activa' then raise exception 'Reactiva la cuenta antes de restablecer su contraseña.';end if;
   if exists(select 1 from kja_admin.estados where id=target and clave_operacion is not null and actualizado_at>now()-interval '3 minutes') then raise exception 'Ya hay un restablecimiento en curso. Espera y actualiza.';end if;
   update kja_admin.estados set clave_operacion=p_operacion,actualizado_at=clock_timestamp() where id=target;
  else
   if (p_accion='suspender' and st<>'activa') or (p_accion in ('reactivar','archivar') and st<>'suspendida') or (p_accion='restaurar' and st<>'archivada') then raise exception 'El estado cambió. Actualiza la lista.';end if;
   if p_accion='archivar' and lower(btrim(p_datos->>'confirmar_email')) is distinct from (select lower(email) from auth.users where id=target) then raise exception 'Escribe el correo de la cuenta para archivar.';end if;
   update kja_admin.estados set estado=case p_accion when 'suspender' then 'suspendida' when 'archivar' then 'archivada' when 'restaurar' then 'suspendida' else 'activa' end,
    revocada_antes=clock_timestamp(),actualizado_at=clock_timestamp() where id=target;
   -- Para cuentas heredadas inactivas la reactivación requiere actuación del custodio.
   if p_accion='reactivar' and not p.activo then raise exception 'El perfil está dado de baja fuera de este módulo. Requiere revisión del custodio.';end if;
  end if;
 else raise exception 'Acción no válida.';
 end if;
 insert into kja_admin.operaciones(id,actor,sesion,cuenta,accion,motivo,antes,despues,resultado,terminado_at)
 values(p_operacion,p_actor,p_sesion,target,p_accion,btrim(p_datos->>'motivo'),anterior,
  case when p_accion in ('crear','editar') then jsonb_build_object('nombre',v_nombre,'rol',permiso) else jsonb_build_object('estado',(select estado from kja_admin.estados where id=target)) end,
  case when p_accion='restablecer' then 'pendiente' else 'completada' end,
  case when p_accion='restablecer' then null else clock_timestamp() end);
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.dash_admin_cuenta_operar(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.dash_admin_cuenta_operar(uuid,uuid,text,jsonb,uuid) to service_role;

create function public.dash_admin_buscar_identidad(p_actor uuid,p_sesion uuid,p_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users; p public.asis_perfiles;
begin
 if not kja_admin.autorizado(p_actor,p_sesion) then raise exception 'Sin permiso' using errcode='42501';end if;
 if (select count(*) from auth.users where lower(email)=lower(btrim(p_email)) and deleted_at is null)>1 then
  raise exception 'Hay varias identidades con este correo. Requiere revisión del custodio.';
 end if;
 select * into u from auth.users where lower(email)=lower(btrim(p_email)) and deleted_at is null;
 if not found then return jsonb_build_object('ok',true,'existe',false);end if;
 select * into p from public.asis_perfiles where id=u.id;
 return jsonb_build_object('ok',true,'existe',true,'id',u.id,'email',u.email,'nombre',p.nombre,
  'tiene_perfil',p.id is not null,'tecnica',lower(u.email) like '%@interno.kja','confirmada',u.email_confirmed_at is not null);
end;$$;
revoke all on function public.dash_admin_buscar_identidad(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.dash_admin_buscar_identidad(uuid,uuid,text) to service_role;
revoke all on all functions in schema kja_admin from public,anon,authenticated;
create function public.dash_admin_cuenta_fallo(p_actor uuid,p_sesion uuid,p_accion text,p_cuenta uuid,p_operacion uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not kja_admin.autorizado(p_actor,p_sesion) then raise exception 'Sin permiso' using errcode='42501';end if;
 if p_accion not in ('crear','editar','suspender','reactivar','archivar','restaurar','delegar','restablecer') then return;end if;
 insert into kja_admin.operaciones(id,actor,sesion,cuenta,accion,motivo,despues,resultado,terminado_at)
 values(gen_random_uuid(),p_actor,p_sesion,p_cuenta,p_accion,left(coalesce(p_motivo,'Operación no completada'),300),
  jsonb_build_object('operacion_solicitada',p_operacion),'fallida',clock_timestamp());
end;$$;
revoke all on function public.dash_admin_cuenta_fallo(uuid,uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.dash_admin_cuenta_fallo(uuid,uuid,text,uuid,uuid,text) to service_role;
create or replace function public.dash_gestiona_certificados() returns boolean language sql stable security definer set search_path='' as $$
 select public.asis_es_miembro() and public.asis_rol()='direccion' and public.dash_nivel()='sistemas';
$$;
create or replace function public.dash_zoom_gestiona() returns boolean language sql stable security definer set search_path='' as $$
 select public.asis_es_miembro() and public.asis_rol()='direccion' and public.dash_nivel()='sistemas'
 and exists(select 1 from public.asis_perfiles p where p.id=auth.uid() and (p.colaborador_id is null or
  exists(select 1 from public.asis_colaboradores c where c.id=p.colaborador_id and c.activo)));
$$;
create or replace function public.rec_es_admin() returns boolean language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.asis_perfiles where id=auth.uid() and acceso_panel)
 then public.asis_es_miembro() and public.asis_rol()='direccion'
 else exists(select 1 from public.perfiles where id=auth.uid() and rol='admin' and activo) end;
$$;
-- Una suspensión no quita certificados; una sesión revocada por cambio de clave sí debe reautenticarse.
create or replace function public.cert_es_miembro() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.perfiles where id=auth.uid() and activo)
 and (not exists(select 1 from public.asis_perfiles where id=auth.uid() and acceso_panel)
  or kja_admin.sesion(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid));
$$;
create or replace function public.cert_es_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.cert_es_miembro() and exists(select 1 from public.perfiles where id=auth.uid() and rol='admin');
$$;
-- Consultas antiguas que leen el rol directamente: conservar sus cálculos en privado
-- y añadir la misma comprobación efectiva antes de ejecutarlas.
alter function public.dash_ranking_mes(date) set schema kja_admin;
revoke all on function kja_admin.dash_ranking_mes(date) from public,anon,authenticated;
create function public.dash_ranking_mes(p_mes date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.asis_rol() is distinct from 'direccion' then raise exception 'Solo Dirección activa puede consultar el ranking.' using errcode='42501';end if;
 return kja_admin.dash_ranking_mes(p_mes);
end;$$;
alter function public.dash_reporte_facebook(date,date) set schema kja_admin;
revoke all on function kja_admin.dash_reporte_facebook(date,date) from public,anon,authenticated;
create function public.dash_reporte_facebook(p_desde date,p_hasta date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.asis_rol() is distinct from 'direccion' then raise exception 'Solo Dirección activa puede consultar reportes.' using errcode='42501';end if;
 return kja_admin.dash_reporte_facebook(p_desde,p_hasta);
end;$$;
alter function public.dash_admin_asignaciones_calendario(date) set schema kja_admin;
revoke all on function kja_admin.dash_admin_asignaciones_calendario(date) from public,anon,authenticated;
create function public.dash_admin_asignaciones_calendario(p_mes date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.asis_rol() is distinct from 'direccion' then raise exception 'Solo Dirección activa puede consultar asignaciones.' using errcode='42501';end if;
 return kja_admin.dash_admin_asignaciones_calendario(p_mes);
end;$$;
alter function public.marketing_gestion_accesos() set schema kja_admin;
revoke all on function kja_admin.marketing_gestion_accesos() from public,anon,authenticated;
create function public.marketing_gestion_accesos() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if public.dash_nivel() is distinct from 'sistemas' then raise exception 'Sin permiso para gestionar Marketing.' using errcode='42501';end if;
 return kja_admin.marketing_gestion_accesos();
end;$$;
alter function public.marketing_guardar_accesos(bigint,bigint[]) set schema kja_admin;
revoke all on function kja_admin.marketing_guardar_accesos(bigint,bigint[]) from public,anon,authenticated;
create function public.marketing_guardar_accesos(p_area bigint,p_colaboradores bigint[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.dash_nivel() is distinct from 'sistemas' then raise exception 'Sin permiso para gestionar Marketing.' using errcode='42501';end if;
 perform kja_admin.marketing_guardar_accesos(p_area,p_colaboradores);
end;$$;
revoke all on function public.dash_ranking_mes(date),public.dash_reporte_facebook(date,date),public.dash_admin_asignaciones_calendario(date),public.marketing_gestion_accesos(),public.marketing_guardar_accesos(bigint,bigint[]) from public,anon;
grant execute on function public.dash_ranking_mes(date),public.dash_reporte_facebook(date,date),public.dash_admin_asignaciones_calendario(date),public.marketing_gestion_accesos(),public.marketing_guardar_accesos(bigint,bigint[]) to authenticated;
create or replace function public.marketing_permiso() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'administrar',coalesce(p.nivel='sistemas',false),
  'acceso',coalesce(p.nivel='sistemas' or exists(select 1 from public.marketing_accesos a where a.usuario_id=p.id)
   or exists(select 1 from public.marketing_colaboradores_acceso a join public.asis_colaboradores c on c.id=a.colaborador_id
    join public.asis_areas ar on ar.id=c.area_id where c.id=p.colaborador_id and c.activo and ar.activo and a.area_id=c.area_id),false),
  'publicar',coalesce(p.nivel='sistemas' or exists(select 1 from public.marketing_accesos a where a.usuario_id=p.id and a.puede_publicar),false)
 ) from (select 1) base left join public.asis_perfiles p on p.id=auth.uid() and p.activo
  and public.dash_sesion_vigente() and (not p.acceso_panel or public.asis_es_miembro());
$$;
notify pgrst,'reload schema';
commit;
