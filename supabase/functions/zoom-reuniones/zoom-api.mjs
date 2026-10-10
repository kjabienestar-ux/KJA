import {ZoomError} from './model.mjs';
// One token cache per warm Edge instance. Secrets never leave this module.
export function zoomClient(env,fetcher=fetch){
 let cached=null;
 const configured=()=>['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET'].every(k=>!!env(k));
 async function token(){
 if(cached&&cached.until>Date.now()+60000)return cached.value;
 if(!configured())throw new ZoomError('La conexión con Zoom está pendiente de configuración por Sistemas.',503);
 let response;
 try{response=await fetcher('https://zoom.us/oauth/token',{method:'POST',headers:{Authorization:'Basic '+btoa(env('ZOOM_CLIENT_ID')+':'+env('ZOOM_CLIENT_SECRET')),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'account_credentials',account_id:env('ZOOM_ACCOUNT_ID')}),signal:AbortSignal.timeout(15000)});}catch{throw new ZoomError('No se pudo conectar con Zoom. Inténtalo en unos minutos.',503);}
 if(!response.ok)throw new ZoomError('No se pudo autorizar la conexión. Sistemas debe revisar las credenciales y activar la aplicación de Zoom.',503);
 const data=await response.json();if(!data.access_token)throw new ZoomError('Zoom no devolvió autorización.',503);
 cached={value:data.access_token,until:Date.now()+Number(data.expires_in||3600)*1000};return cached.value;
 }
 async function request(path,method='GET',body){
 const access=await token();let response;
 try{response=await fetcher('https://api.zoom.us/v2'+path,{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{throw new ZoomError('No se recibió confirmación de Zoom. Actualiza la reunión antes de repetir el cambio.',502,method!=='GET');}
 if(response.status===401)cached=null;
 if(!response.ok){const messages={401:'Zoom rechazó la autorización. Revisa la conexión.',403:'La aplicación de Zoom no tiene los permisos necesarios.',404:'La reunión o el anfitrión ya no existe en Zoom.',429:'Zoom alcanzó su límite de solicitudes. Espera unos minutos.'};throw new ZoomError(messages[response.status]||'Zoom rechazó la operación. Revisa los datos y la configuración de la cuenta.',response.status>=500?502:response.status,method!=='GET'&&response.status>=500);}
 return response.status===204?null:response.json();
 }
 async function host(id){
 if(typeof id!=='string'||!id||id.length>150)throw new ZoomError('Selecciona un anfitrión de Zoom.');
 const user=await request('/users/'+encodeURIComponent(id));
 if(user.account_id!==env('ZOOM_ACCOUNT_ID')||user.status!=='active')throw new ZoomError('El anfitrión debe estar activo en la cuenta institucional de Zoom.',403);
 return user;
 }
 return {request,host,configured};
}
