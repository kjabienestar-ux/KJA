import {sdkAction} from './sdk.mjs';
import {ZoomError,uuid,meetingId,meetingInput,audienceInput,snapshot,safeZoomUrl} from './model.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
export function handler({createClient,env,zoom}){
 return async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido.'},405);
 let admin,locked=null,operation=null,eventId=null;
 const save=async(values)=>{
 const result=await admin.from('zoom_reuniones').update({...values,operation_id:null,busy_until:null,updated_at:new Date().toISOString()}).eq('id',locked.id).eq('operation_id',operation).select('id').maybeSingle();
 if(result.error||!result.data)throw new ZoomError('El cambio no pudo confirmarse en el portal. Usa Actualizar desde Zoom para recuperar la reunión.',502);
 locked=null;
 };
 try{
 const user=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
 const identity=await user.auth.getUser();if(identity.error||!identity.data.user)return reply({error:'Vuelve a iniciar sesión.'},401);
 let body;try{const text=await req.text();if(text.length>20000)throw Error();body=JSON.parse(text);if(!body||Array.isArray(body))throw Error();}catch{return reply({error:'Solicitud no válida.'},400);}
 const action=body.action;
 if(action==='sdk-list'||action==='sdk-start'){
 const service=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
 return reply(await sdkAction({action,body,user,identity:identity.data.user,admin:service,env,zoom}));
 }
 if(!['status','hosts','create','import','update','sync','cancel','archive','join','start'].includes(action))throw new ZoomError('Acción no válida.');
 if(action!=='join'){
 const allowed=await user.rpc('dash_zoom_gestiona');
 if(allowed.error)throw new ZoomError('Falta activar la integración de Zoom en la base de datos.',503);
 if(allowed.data!==true)throw new ZoomError('Solo Dirección con nivel Sistemas puede gestionar reuniones.',403);
 }else{
 if(!uuid(body.id))throw new ZoomError('Reunión no válida.');
 const allowed=await user.rpc('dash_zoom_puede_unirse',{p_id:body.id});
 if(allowed.error||allowed.data!==true)throw new ZoomError('Esta reunión no está disponible para tu cuenta. Actualiza la lista.',403);
 }
 if(action==='status')return reply({ok:true,configured:zoom.configured()});
 admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
 if(action==='hosts'){
 const page=typeof body.next_page_token==='string'?body.next_page_token:'';
 if(page.length>1000)throw new ZoomError('Paginación no válida.');
 const data=await zoom.request('/users?status=active&page_size=100'+(page?'&next_page_token='+encodeURIComponent(page):''));
 return reply({ok:true,hosts:(data.users||[]).map(u=>({id:u.id,email:u.email,name:[u.first_name,u.last_name].filter(Boolean).join(' '),type:u.type})),next_page_token:data.next_page_token||''});
 }
 if(!uuid(body.id))throw new ZoomError('Reunión no válida.');
 let row=null;
 const found=await admin.from('zoom_reuniones').select('*').eq('id',body.id).maybeSingle();
 if(found.error)throw new ZoomError('No se pudo consultar la reunión.',503);
 row=found.data;
 if(action==='join'||action==='start'){
 if(!row||row.status!=='ready')throw new ZoomError('Esta reunión ya no está disponible.',409);
 let url=row.join_url;
 if(action==='start'){
 const meeting=await zoom.request('/meetings/'+meetingId(row.zoom_id));await zoom.host(meeting.host_id);url=meeting.start_url;
 }
 url=safeZoomUrl(url);if(!url)throw new ZoomError('No se encontró un acceso válido. Actualiza la reunión.',409);
 return reply({ok:true,url});
 }
 let audience,meeting;
 if(['create','import','update'].includes(action)){
 audience=audienceInput(body);
 for(const [table,ids] of [['asis_areas',audience.area_ids],['asis_colaboradores',audience.person_ids]]){
 if(!ids.length)continue;
 const valid=await admin.from(table).select('id').in('id',ids).eq('activo',true);
 if(valid.error||valid.data.length!==ids.length)throw new ZoomError('Hay destinatarios inactivos o eliminados. Actualiza la lista.',409);
 }
 }
 if(action==='create'||action==='update')meeting=meetingInput(body,Date.now(),action==='update');
 if(action==='create')await zoom.host(body.host_id);
 if(action==='import'){
 const existing=await admin.from('zoom_reuniones').select('id').eq('zoom_id',meetingId(body.zoom_id)).maybeSingle();
 if(existing.error)throw new ZoomError('No se pudo comprobar si la sala ya está vinculada.',503);
 if(existing.data)throw new ZoomError('Esta sala ya está vinculada. Búscala en la lista para editar sus destinatarios o actualizarla.',409);
 }
 if(action==='create'&&row)throw new ZoomError('Esta solicitud ya fue recibida. Actualiza la lista antes de crear otra reunión.',409);
 if(!row&&!['create','import'].includes(action))throw new ZoomError('No se encontró la reunión.',404);
 if(action==='archive'&&(!row||row.zoom_id))throw new ZoomError('Solo se pueden archivar solicitudes sin una sala vinculada.',409);
 if(row&&row.status==='cancelled')throw new ZoomError('Esta reunión está cancelada.',409);
 if(row&&action==='import'&&row.zoom_id)throw new ZoomError('Esta sala ya está vinculada. Usa Actualizar desde Zoom.',409);
 if(row&&Number(body.revision)!==row.revision)throw new ZoomError('Otro administrador cambió la reunión. Actualiza la lista antes de continuar.',409);
 if(row&&row.busy_until&&Date.parse(row.busy_until)>Date.now())throw new ZoomError('Hay una operación en curso. Espera dos minutos y actualiza la lista.',409);
 if(row&&row.status!=='ready'&&action==='update')throw new ZoomError('Primero recupera la reunión con Actualizar desde Zoom.',409);
 if(['sync','cancel'].includes(action)&&!row.zoom_id)throw new ZoomError('Vincula el ID de la reunión para recuperar esta solicitud.',409);
 operation=crypto.randomUUID();
 const claim={status:'pending',operation_id:operation,busy_until:new Date(Date.now()+120000).toISOString(),updated_at:new Date().toISOString()};
 const claimed=row?await admin.from('zoom_reuniones').update({...claim,revision:row.revision+1}).eq('id',body.id).eq('revision',row.revision).select('*').maybeSingle():await admin.from('zoom_reuniones').insert({id:body.id,...claim,...audience,topic:meeting?.topic||'Vinculación pendiente',created_by:identity.data.user.id}).select('*').single();
 if(claimed.error||!claimed.data)throw new ZoomError('La solicitud ya existe o cambió. Actualiza la lista.',409);
 locked=claimed.data;
 const audit=await admin.from('zoom_eventos').insert({reunion_id:body.id,actor_id:identity.data.user.id,action,result:'requested'}).select('id').single();
 if(audit.error)throw new ZoomError('No se pudo registrar la operación. Actualiza la reunión antes de continuar.',503);
 eventId=audit.data.id;
 let remote;
 if(action==='create'){
 remote=await zoom.request('/users/'+encodeURIComponent(body.host_id)+'/meetings','POST',{...meeting,settings:{use_pmi:false,waiting_room:true,join_before_host:false}});
 // Persist the remote ID before fetching occurrences, so a read failure can be recovered.
 const savedId=await admin.from('zoom_reuniones').update({zoom_id:meetingId(remote.id)}).eq('id',body.id).eq('operation_id',operation);
 if(savedId.error)throw new ZoomError('Zoom creó la reunión '+meetingId(remote.id)+', pero falta vincularla al portal. Usa ese ID para recuperar la solicitud.',502,true);
 locked.zoom_id=meetingId(remote.id);
 remote=await zoom.request('/meetings/'+locked.zoom_id);
 }else if(action==='import'){
 remote=await zoom.request('/meetings/'+meetingId(body.zoom_id));await zoom.host(remote.host_id);
 }else if(action==='archive'){
 await save({status:'cancelled',join_url:null,last_error:null});
 }else if(action==='cancel'){
 try{await zoom.request('/meetings/'+meetingId(row.zoom_id),'DELETE');}catch(error){if(error.status!==404)throw error;}
 await save({status:'cancelled',join_url:null,last_error:null});
 }else{
 if(action==='update')await zoom.request('/meetings/'+meetingId(row.zoom_id),'PATCH',meeting);
 try{remote=await zoom.request('/meetings/'+meetingId(row.zoom_id));}catch(error){
 if(action==='sync'&&error.status===404){await save({status:'cancelled',join_url:null,last_error:null});}
 else throw error;
 }
 }
 if(remote)await save({...snapshot(remote),...(audience||{})});
 if(eventId)await admin.from('zoom_eventos').update({result:'completed'}).eq('id',eventId);
 return reply({ok:true});
 }catch(error){
 const message=error instanceof ZoomError?error.message:'No se pudo confirmar la operación. Actualiza la lista y recupera la reunión antes de repetir el cambio.';
 if(locked&&admin){
 await admin.from('zoom_reuniones').update({status:'error',last_error:message,operation_id:null,busy_until:null,updated_at:new Date().toISOString()}).eq('id',locked.id).eq('operation_id',operation);
 }
 if(eventId&&admin)await admin.from('zoom_eventos').update({result:'needs_review'}).eq('id',eventId);
 return reply({error:message},error instanceof ZoomError?error.status:500);
 }
 };
}
