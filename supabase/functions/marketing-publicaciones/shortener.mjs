export function isWalink(value){return typeof value==='string'&&/^https:\/\/wa\.link\/[A-Za-z0-9_-]{1,100}$/.test(value);}
export function shortenerData(data){
  const acortador=data.acortador||'kja';
  const walink=data.walink||'',walink_firma=data.walink_firma||'';
  if(!['kja','walink'].includes(acortador)||typeof walink!=='string'||walink.length>200||typeof walink_firma!=='string'||walink_firma.length>6100)throw new Error('Revisa la configuración del acortador.');
  return {acortador,walink,walink_firma};
}
export function validateWalink(data,url,phone){
  const settings=shortenerData(data);
  if(settings.acortador!=='walink'||!isWalink(url)||settings.walink!==url||settings.walink_firma!==phone+'\n'+data.mensaje.trim())throw new Error('Confirma el contacto y mensaje en Walink y vuelve a aplicar el enlace.');
  return url;
}
