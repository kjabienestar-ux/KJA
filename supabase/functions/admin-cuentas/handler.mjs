// Dependency injection keeps the same production handler executable in Node tests.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function sessionId(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;}catch{return null;}}
export function createHandler({createClient,env}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 return async req=>{
  if(req.method==='OPTIONS')return reply({ok:true});
  if(req.method!=='POST')return reply({error:'Método no permitido.'},405);
  let proof;
  try{
   if(Number(req.headers.get('content-length')||0)>8192)return reply({error:'Solicitud demasiado extensa.'},413);
   const token=(req.headers.get('Authorization')||'').replace(/^Bearer /i,'');
   const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY');
   const user=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
   const identity=await user.auth.getUser();
   const actor=identity.data?.user,sid=sessionId(token);
   if(identity.error||!actor||!UUID.test(sid||''))return reply({error:'Vuelve a iniciar sesión.'},401);
   const allowed=await user.rpc('dash_es_superadmin');
   if(allowed.error||allowed.data!==true)return reply({error:'Solo los dos superadministradores pueden gestionar estas cuentas.'},403);
   const raw=await req.text();if(raw.length>8192)return reply({error:'Solicitud demasiado extensa.'},413);
   let body;try{body=JSON.parse(raw);}catch{return reply({error:'Solicitud no válida.'},400);}
   if(!body||typeof body!=='object')return reply({error:'Solicitud no válida.'},400);
   const action=body.action,operation=body.operation;
   const admin=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
   const recordFailure=async(action,target)=>{
    try{await admin.rpc('dash_admin_cuenta_fallo',{p_actor:actor.id,p_sesion:sid,p_accion:action,
     p_cuenta:UUID.test(target||'')?target:null,p_operacion:UUID.test(operation||'')?operation:null,
     p_motivo:typeof body.motivo==='string'?body.motivo.slice(0,300):'Operación no completada'});}catch{}
   };
   const run=async(accion,datos)=>{
    const r=await admin.rpc('dash_admin_cuenta_operar',{p_actor:actor.id,p_sesion:sid,p_accion:accion,p_datos:datos,p_operacion:operation});
    if(r.error){await recordFailure(accion,datos.id);throw Object.assign(Error(r.error.message||'No se pudo completar la operación.'),{status:r.error.code==='42501'?403:409});}
    return r.data;
   };
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const lookup=async()=>{
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Object.assign(Error('Revisa el correo.'),{status:400});
    const r=await admin.rpc('dash_admin_buscar_identidad',{p_actor:actor.id,p_sesion:sid,p_email:email});
    if(r.error)throw Object.assign(Error('No se pudo comprobar la identidad.'),{status:403});return r.data;
   };
   if(action==='buscar')return reply(await lookup());
   if(!UUID.test(operation||''))return reply({error:'Actualiza el formulario antes de guardar.'},400);
   const motivo=typeof body.motivo==='string'?body.motivo.trim():'';
   if(motivo.length<3||motivo.length>300)return reply({error:'Indica un motivo de 3 a 300 caracteres.'},400);
   const password=body.password;
   const passwordValid=typeof password==='string'&&password.length>=12&&new TextEncoder().encode(password).length<=72;
   // Only explicitly selected fields reach SQL/audit; passwords never do.
   if(action==='crear'){
    if(typeof body.nombre!=='string'||body.nombre.trim().length<2||body.nombre.trim().length>100||!['visor','editor','direccion'].includes(body.rol))return reply({error:'Revisa el nombre y el permiso.'},400);
    const existing=await lookup();let id;
    if(existing.existe){
     if(existing.tiene_perfil||existing.tecnica||!existing.confirmada)return reply({error:'Esta identidad ya tiene perfil o no admite incorporación administrativa. No se modificó su contraseña.'},409);
     if(body.confirm_existing!==existing.id)return reply({error:'Confirma que la identidad existente pertenece a la persona seleccionada.',identity:existing},409);
     id=existing.id;
    }else{
     if(!passwordValid)return reply({error:'Usa al menos 12 caracteres y como máximo 72 bytes para la contraseña.'},400);
     const result=await admin.auth.admin.createUser({email,password,email_confirm:true});
     if(result.error||!result.data?.user){await recordFailure(action,null);return reply({error:'No se pudo crear la cuenta. Revisa el correo y los requisitos de contraseña; actualiza antes de reintentar.'},409);}
     id=result.data.user.id;
    }
    try{return reply(await run('crear',{id,email,nombre:body.nombre,rol:body.rol,motivo}));}
    catch(error){return reply({error:'La identidad existe, pero el acceso administrativo no quedó confirmado. Busca el correo, comprueba la identidad y repite el alta. '+error.message},error.status||409);}
   }
   if(!UUID.test(body.id||''))return reply({error:'Selecciona una cuenta válida.'},400);
   const data={id:body.id,motivo};
   if(action==='editar')return reply(await run(action,{...data,nombre:body.nombre,rol:body.rol}));
   if(['suspender','reactivar','archivar','restaurar'].includes(action))return reply(await run(action,{...data,confirmar_email:body.confirmar_email}));
   if(action==='delegar'){
    if(typeof body.current_password!=='string'||!body.current_password)return reply({error:'Confirma tu contraseña actual.'},400);
    proof=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const verification=await proof.auth.signInWithPassword({email:actor.email,password:body.current_password});
    if(verification.error||verification.data?.user?.id!==actor.id)return reply({error:'No se pudo confirmar tu identidad. Revisa tu contraseña.'},403);
    const proofSid=sessionId(verification.data.session?.access_token||'');
    if(!UUID.test(proofSid||''))return reply({error:'No se pudo verificar la sesión de confirmación.'},403);
    return reply(await run(action,{...data,sesion_prueba:proofSid}));
   }
   if(action==='restablecer'){
    if(!passwordValid)return reply({error:'Usa al menos 12 caracteres y como máximo 72 bytes para la contraseña.'},400);
    const begin=await run(action,data);if(begin?.repetida)return reply(begin);
    let changed;
    try{changed=await admin.auth.admin.updateUserById(body.id,{password});}
    catch{return reply({error:'No se pudo confirmar el cambio de contraseña. El acceso queda protegido; otro superadministrador puede reintentarlo después de tres minutos.'},503);}
    const result=changed.error?'fallida':'completada';
    try{await run('clave_fin',{resultado:result});}
    catch{return reply({error:'El resultado de Auth requiere conciliación. No repitas inmediatamente: actualiza y solicita revisión al otro superadministrador.'},503);}
    if(changed.error)return reply({error:'Auth rechazó la nueva contraseña. Revisa sus requisitos de seguridad.'},400);
    return reply({ok:true,sign_out:actor.id===body.id});
   }
   return reply({error:'Acción no válida.'},400);
  }catch(error){return reply({error:error.status?error.message:'No se pudo completar la operación. Actualiza la lista antes de reintentar.'},error.status||500);}
  finally{if(proof)await proof.auth.signOut({scope:'local'}).catch(()=>{});}
 };
}
