export function kjaLinkKey(url){
  return /^(?:https:\/\/www\.kjadmb\.com\/w\.html\?k=|https:\/\/wa\.kjadmb\.com\/)((?:[A-Za-z0-9_-]{6}|[A-Za-z0-9_-]{8}|[A-Za-z0-9_-]{16}))$/.exec(String(url||''))?.[1]||'';
}
export function kjaLink(key,domain=''){
  if(!/^(?:[A-Za-z0-9_-]{6}|[A-Za-z0-9_-]{8}|[A-Za-z0-9_-]{16})$/.test(key))throw new Error('El código del enlace no es válido.');
  // Activar únicamente después de configurar y verificar DNS y HTTPS.
  return domain==='https://wa.kjadmb.com'?'https://wa.kjadmb.com/'+key:'https://www.kjadmb.com/w.html?k='+key;
}
const KEY_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function newCampaignKey(){
  let key = '';
  while(key.length < 6){
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    for(let i = 0; i < bytes.length && key.length < 6; i++){
      if(bytes[i] < 248) key += KEY_ALPHABET[bytes[i] % 62];
    }
  }
  return key;
}
export async function storeCampaignLink(admin,record,generate=newCampaignKey){
  for(let attempt=0;attempt<5;attempt++){
    const clave=generate();
    const {error}=await admin.from('marketing_whatsapp_enlaces').upsert({...record,clave},{onConflict:'publicacion_id,firma',ignoreDuplicates:true});
    if(error?.code==='23505')continue;
    if(error)throw new Error('No se pudo guardar el enlace corto. Revisa la migración marketing_07_enlaces_cortos.sql.');
    const {data,error:readError}=await admin.from('marketing_whatsapp_enlaces').select('clave').eq('publicacion_id',record.publicacion_id).eq('firma',record.firma).single();
    if(readError||!data)throw new Error('No se pudo recuperar el enlace corto.');
    return data.clave;
  }
  throw new Error('No se pudo generar un código único. Vuelve a intentarlo.');
}
