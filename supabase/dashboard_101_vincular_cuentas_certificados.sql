-- Ejecutar después de dashboard_100. Vincula identidades sin alterar el acceso DNI/PIN.
begin;
alter table public.perfiles add column if not exists colaborador_id bigint references public.asis_colaboradores(id) on delete set null;
create unique index if not exists cert_perfil_colaborador_unico on public.perfiles(colaborador_id) where colaborador_id is not null;

create or replace function public.dash_cert_colaboradores()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.dash_gestiona_certificados() then raise exception 'Sin permiso' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'colaboradores',coalesce((select jsonb_agg(jsonb_build_object(
 'id',c.id,'nombre',c.nombre,'dni',c.dni,'area',a.nombre,'activo',c.activo,'cuenta_id',p.id
 ) order by a.nombre,c.nombre) from public.asis_colaboradores c left join public.asis_areas a on a.id=c.area_id
 left join public.perfiles p on p.colaborador_id=c.id),'[]'::jsonb));
end;$$;

create or replace function public.dash_cert_cuentas()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.dash_gestiona_certificados() then raise exception 'Sin permiso' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'cuentas',coalesce((select jsonb_agg(jsonb_build_object(
 'id',p.id,'nombre',p.nombre,'email',u.email,'rol',p.rol,'serie',p.serie,'activo',p.activo,
 'colaborador_id',p.colaborador_id,'dni',c.dni,'area',a.nombre
 ) order by p.nombre) from public.perfiles p join auth.users u on u.id=p.id
 left join public.asis_colaboradores c on c.id=p.colaborador_id left join public.asis_areas a on a.id=c.area_id),'[]'::jsonb));
end;$$;

create or replace function public.dash_cert_guardar_vinculado(p_id uuid,p_nombre text,p_rol text,p_serie integer,p_activo boolean,p_colaborador bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_nombre text:=p_nombre;v_old bigint;v_result jsonb;v_active boolean;
begin
 if not public.dash_gestiona_certificados() then raise exception 'Sin permiso' using errcode='42501'; end if;
 lock table public.perfiles in share row exclusive mode;
 select colaborador_id into v_old from public.perfiles where id=p_id;
 if p_colaborador is not null then
  select nombre,activo into v_nombre,v_active from public.asis_colaboradores where id=p_colaborador for update;
  if not found then raise exception 'El colaborador ya no existe.'; end if;
  if not v_active and v_old is distinct from p_colaborador then raise exception 'Selecciona un colaborador activo.'; end if;
  if exists(select 1 from public.perfiles where colaborador_id=p_colaborador and id<>p_id) then
   raise exception 'El colaborador ya tiene una cuenta de certificados vinculada.' using errcode='23505'; end if;
  if exists(select 1 from public.asis_perfiles where id=p_id and colaborador_id is not null and colaborador_id<>p_colaborador) then
   raise exception 'Este correo pertenece a otro colaborador. Usa el correo correcto.'; end if;
 end if;
 v_result:=public.dash_cert_guardar(p_id,v_nombre,p_rol,p_serie,p_activo);
 update public.perfiles set colaborador_id=p_colaborador where id=p_id;
 if v_old is distinct from p_colaborador then
  insert into public.cert_cuentas_eventos(actor,cuenta,accion,antes,despues)
  values(auth.uid(),p_id,'vincular_colaborador',jsonb_build_object('colaborador_id',v_old),jsonb_build_object('colaborador_id',p_colaborador));
 end if;
 return v_result;
end;$$;
revoke all on function public.dash_cert_colaboradores() from public,anon;
revoke all on function public.dash_cert_guardar_vinculado(uuid,text,text,integer,boolean,bigint) from public,anon;
grant execute on function public.dash_cert_colaboradores() to authenticated;
grant execute on function public.dash_cert_guardar_vinculado(uuid,text,text,integer,boolean,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
