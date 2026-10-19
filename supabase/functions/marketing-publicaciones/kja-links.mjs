export function kjaLinkKey(url){
  return /^(?:https:\/\/www\.kjadmb\.com\/w\.html\?k=|https:\/\/wa\.kjadmb\.com\/)([A-Za-z0-9_-]{16})$/.exec(String(url||''))?.[1]||'';
}
export function kjaLink(key,domain=''){
  if(!/^[A-Za-z0-9_-]{16}$/.test(key))throw new Error('El código del enlace no es válido.');
  // Activar únicamente después de configurar y verificar DNS y HTTPS.
  return domain==='https://wa.kjadmb.com'?'https://wa.kjadmb.com/'+key:'https://www.kjadmb.com/w.html?k='+key;
}
