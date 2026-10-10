import {ZoomError,uuid,meetingId} from './model.mjs';
const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export async function sdkSignature(key,secret,number,now=Date.now()){
 const iat=Math.floor(now/1000)-30,exp=iat+1800;
 const payload=encode({alg:'HS256',typ:'JWT'})+'.'+encode({appKey:key,sdkKey:key,mn:number,role:1,iat,exp,tokenExp:exp});
 const signingKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(payload)));
 return payload+'.'+btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
export async function sdkAction({action,body,user,identity,admin,env,zoom}){
 if(action==='sdk-list'){
 const {data,error}=await user.rpc('dash_zoom_operaciones');
 if(error||!data?.ok)throw new ZoomError('Falta activar la migración 110 de operadores Zoom.',503);
 return {...data,configured:!!env('ZOOM_MEETING_SDK_KEY')&&!!env('ZOOM_MEETING_SDK_SECRET')&&!!env('ZOOM_SDK_TEST_MEETING_ID'),
 meetings:data.meetings.map(r=>({...r,pilot:r.zoom_id===env('ZOOM_SDK_TEST_MEETING_ID')}))};
 }
 if(!uuid(body.id))throw new ZoomError('Reunión no válida.');
 const permit=await user.rpc('dash_zoom_opera',{p_id:body.id});
 if(permit.error||permit.data!==true)throw new ZoomError('No tienes permiso para administrar esta reunión.',403);
 const {data:row,error}=await admin.from('zoom_reuniones').select('*').eq('id',body.id).maybeSingle();
 if(error||!row||row.status!=='ready')throw new ZoomError('Reunión no disponible.',409);
 if(!env('ZOOM_SDK_TEST_MEETING_ID')||row.zoom_id!==env('ZOOM_SDK_TEST_MEETING_ID'))throw new ZoomError('El piloto solo permite la reunión de ensayo configurada por Sistemas.',403);
 const key=env('ZOOM_MEETING_SDK_KEY'),secret=env('ZOOM_MEETING_SDK_SECRET');
 if(!key||!secret)throw new ZoomError('Faltan las credenciales de Meeting SDK en Supabase.',503);
 const number=meetingId(row.zoom_id);
 const meeting=await zoom.request('/meetings/'+number);
 if(String(meeting.id)!==number)throw new ZoomError('Zoom devolvió otra reunión.',502);
 await zoom.host(meeting.host_id);
 const token=await zoom.request('/users/'+encodeURIComponent(meeting.host_id)+'/token?type=zak');
 if(!token?.token)throw new ZoomError('Zoom no devolvió autorización de anfitrión.',502);
 // Recheck after remote calls: a permission may have been revoked while waiting.
 const recheck=await user.rpc('dash_zoom_opera',{p_id:body.id});
 if(recheck.error||recheck.data!==true)throw new ZoomError('El permiso fue retirado.',403);
 const audit=await admin.from('zoom_eventos').insert({reunion_id:body.id,actor_id:identity.id,action:'sdk_authorize',result:'issued'});
 if(audit.error)throw new ZoomError('No se pudo registrar la autorización.',503);
 return {ok:true,meetingNumber:number,signature:await sdkSignature(key,secret,number),zak:token.token,
 passWord:meeting.password||'',userName:'Responsable KJA',topic:meeting.topic};
}
