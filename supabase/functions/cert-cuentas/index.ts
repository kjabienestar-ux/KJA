import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido.'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const user=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
  const {data:identity,error:identityError}=await user.auth.getUser();
  if(identityError||!identity.user)return reply({error:'Vuelve a iniciar sesión.'},401);
  const {data:allowed,error:permissionError}=await user.rpc('dash_gestiona_certificados');
  if(permissionError||allowed!==true)return reply({error:'Solo Dirección con nivel Sistemas puede gestionar estas cuentas.'},403);
  const body=await req.json();
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='recovery'){
   const {data:profile,error:pe}=await admin.from('perfiles').select('id,activo').eq('id',body.id).maybeSingle();
   if(pe||!profile?.activo)return reply({error:'La cuenta no está activa.'},400);
   const {data:account,error:ae}=await admin.auth.admin.getUserById(profile.id);
   if(ae||!account.user?.email)return reply({error:'No se encontró el correo de la cuenta.'},400);
   const redirectTo=Deno.env.get('CERT_RECOVERY_URL');
   if(!redirectTo)return reply({error:'Falta configurar CERT_RECOVERY_URL en el servidor.'},503);
   const {error}=await user.auth.resetPasswordForEmail(account.user.email,{redirectTo});
   if(error)return reply({error:'No se pudo enviar el correo. Espera unos minutos y revisa la configuración de correo.'},400);
   return reply({ok:true});
  }
  if(body.action!=='create')return reply({error:'Acción no válida.'},400);
  const email=String(body.email||'').trim().toLowerCase(),name=String(body.nombre||'').trim();
  const serie=body.serie===null?null:Number(body.serie),rol=body.rol;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length<2||name.length>100||!['admin','colaborador'].includes(rol)
    ||(serie===null?rol!=='admin':!Number.isInteger(serie)||serie<1000||serie>2147482000||serie%1000!==0))return reply({error:'Revisa correo, nombre, rol y serie.'},400);
  // Buscar antes de crear permite vincular una cuenta existente sin cambiar su contraseña.
  const lookup=await user.rpc('dash_cert_buscar_email',{p_email:email});
  if(lookup.error)return reply({error:'No se pudo consultar la cuenta.'},400);
  let id=lookup.data,created=false;
  if(!id){
   if(typeof body.password!=='string'||body.password.length<12)return reply({error:'Usa una contraseña inicial de al menos 12 caracteres.'},400);
   const result=await admin.auth.admin.createUser({email,password:body.password,email_confirm:true});
   if(result.error||!result.data.user)return reply({error:'No se pudo crear la cuenta. Revisa el correo y los requisitos de contraseña.'},400);
   id=result.data.user.id;created=true;
  }else{
   const existing=await admin.from('perfiles').select('id').eq('id',id).maybeSingle();
   if(existing.error)return reply({error:'No se pudo comprobar el perfil.'},400);
   if(existing.data)return reply({error:'Esta cuenta ya tiene acceso registrado. Edítala desde la lista.'},409);
  }
  const saved=await user.rpc('dash_cert_guardar',{p_id:id,p_nombre:name,p_rol:rol,p_serie:serie,p_activo:true});
  if(saved.error)return reply({error:(created?'La cuenta se creó, pero su acceso aún no está configurado. Corrige los datos y repite el alta. ':'')+saved.error.message},400);
  return reply({ok:true,linked:!created});
 }catch{return reply({error:'No se pudo completar la operación. Actualiza la lista antes de reintentar.'},500);}
});
