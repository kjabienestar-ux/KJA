-- Requiere certificados_hardening_roles_y_consistencia.sql y el dashboard vigente.
-- Gestión de accesos de certificados; conserva usuarios y documentos emitidos.
begin;
alter table public.perfiles add column if not exists activo boolean not null default true;

create or replace function public.dash_gestiona_certificados()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and coalesce(public.dash_sesion_vigente(),false) and exists(
   select 1 from public.asis_perfiles where id=auth.uid() and activo
   and acceso_panel and rol='direccion' and nivel='sistemas');
$$;
revoke all on function public.dash_gestiona_certificados() from public,anon;
grant execute on function public.dash_gestiona_certificados() to authenticated;

create table if not exists public.cert_cuentas_eventos(
 id bigint generated always as identity primary key,
 actor uuid not null,cuenta uuid not null,accion text not null,
 antes jsonb,despues jsonb,creado_at timestamptz not null default now()
);
alter table public.cert_cuentas_eventos enable row level security;
revoke all on public.cert_cuentas_eventos from public,anon,authenticated;

create or replace function public.dash_cert_cuentas()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.dash_gestiona_certificados() then raise exception 'Sin permiso' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'cuentas',coalesce((select jsonb_agg(jsonb_build_object(
 'id',p.id,'nombre',p.nombre,'email',u.email,'rol',p.rol,'serie',p.serie,'activo',p.activo
 ) order by p.nombre) from public.perfiles p join auth.users u on u.id=p.id),'[]'::jsonb));
end;$$;

create or replace function public.dash_cert_buscar_email(p_email text)
returns uuid language plpgsql security definer set search_path=public as $$
begin
 if not public.dash_gestiona_certificados() then raise exception 'Sin permiso' using errcode='42501'; end if;
 return (select id from auth.users where lower(email)=lower(btrim(p_email)) limit 1);
end;$$;

create or replace function public.dash_cert_guardar(p_id uuid,p_nombre text,p_rol text,p_serie integer,p_activo boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_old public.perfiles;v_new public.perfiles;v_exist boolean;
begin
 if not public.dash_gestiona_certificados() then raise exception 'Sin permiso' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_nombre,''))) not between 2 and 100 or p_rol is null or p_rol not in('admin','colaborador') or p_activo is null then
   raise exception 'Revisa el nombre y el rol.' using errcode='22023'; end if;
 if (p_serie is null and p_rol='colaborador') or (p_serie is not null and (p_serie<1000 or p_serie>2147482000 or p_serie%1000<>0)) then
   raise exception 'La serie debe ser un múltiplo de 1000, desde 1000.' using errcode='22023'; end if;
 lock table public.perfiles in share row exclusive mode;
 select * into v_old from public.perfiles where id=p_id;v_exist:=found;
 if not exists(select 1 from auth.users where id=p_id) then raise exception 'La cuenta no existe.'; end if;
 if exists(select 1 from public.perfiles where serie=p_serie and id<>p_id) then raise exception 'La serie ya está asignada a otra cuenta.' using errcode='23505'; end if;
 if v_exist and p_id=auth.uid() and (not p_activo or p_rol<>v_old.rol) then raise exception 'No puedes retirar tu propio acceso o cambiar tu propio rol.'; end if;
 if v_exist and v_old.rol='admin' and v_old.activo and (not p_activo or p_rol<>'admin')
   and not exists(select 1 from public.perfiles where id<>p_id and rol='admin' and activo) then
   raise exception 'Debe quedar al menos un administrador de certificados activo.'; end if;
 if v_exist and v_old.serie is distinct from p_serie and exists(select 1 from public.certificados where creado_por=p_id) then
   raise exception 'La serie ya tiene certificados emitidos y debe conservarse.'; end if;
 insert into public.perfiles(id,nombre,rol,serie,activo) values(p_id,btrim(p_nombre),p_rol,p_serie,p_activo)
 on conflict(id) do update set nombre=excluded.nombre,rol=excluded.rol,serie=excluded.serie,activo=excluded.activo returning * into v_new;
 insert into public.cert_cuentas_eventos(actor,cuenta,accion,antes,despues)
 values(auth.uid(),p_id,case when v_exist then 'editar' else 'crear' end,to_jsonb(v_old),to_jsonb(v_new));
 return jsonb_build_object('ok',true);
end;$$;

revoke all on function public.dash_cert_cuentas() from public,anon;
revoke all on function public.dash_cert_buscar_email(text) from public,anon;
revoke all on function public.dash_cert_guardar(uuid,text,text,integer,boolean) from public,anon;
grant execute on function public.dash_cert_cuentas() to authenticated;
grant execute on function public.dash_cert_buscar_email(text) to authenticated;
grant execute on function public.dash_cert_guardar(uuid,text,text,integer,boolean) to authenticated;
-- Los perfiles se administran exclusivamente con la RPC autorizada.
revoke insert,update,delete on public.perfiles from anon,authenticated;

create or replace function public.cert_es_miembro()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.perfiles where id=auth.uid() and activo);
$$;
create or replace function public.cert_es_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.perfiles where id=auth.uid() and rol='admin' and activo);
$$;

-- Restrictivas: complementan las políticas vigentes, no amplían sus permisos.
do $$ declare t text;begin
 foreach t in array array['certificados','clientes','bitacora'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop policy if exists cert_cuenta_activa on public.%I',t);
   execute format('create policy cert_cuenta_activa on public.%I as restrictive for all to authenticated using (public.cert_es_miembro()) with check (public.cert_es_miembro())',t);
  end if;
 end loop;
end;$$;
-- También bloquea escrituras de RPC heredadas SECURITY DEFINER con sesiones suspendidas.
create or replace function public.cert_validar_escritura_activa()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not public.cert_es_miembro() then raise exception 'El acceso a certificados está suspendido.' using errcode='42501';end if;
 if tg_op='DELETE' then return old; end if;return new;
end;$$;
drop trigger if exists cert_cuenta_activa_trg on public.certificados;
create trigger cert_cuenta_activa_trg before insert or update or delete on public.certificados for each row execute function public.cert_validar_escritura_activa();
drop trigger if exists cert_cuenta_activa_trg on public.clientes;
create trigger cert_cuenta_activa_trg before insert or update or delete on public.clientes for each row execute function public.cert_validar_escritura_activa();
notify pgrst,'reload schema';
commit;
