const fields=['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje','facebook_url'];
const options=['certificado','material','peru','vacantes'];
export function partialDraft(data,copy){
  if(!data||typeof data!=='object'||Array.isArray(data)||fields.some(key=>typeof data[key]!=='string'||data[key].length>6000))throw new Error('Revisa los campos del borrador.');
  if(typeof copy!=='string'||copy.length>20000)throw new Error('El texto admite hasta 20 000 caracteres.');
  const flags=data.opciones||{};
  if(typeof flags!=='object'||Array.isArray(flags)||Object.keys(flags).some(key=>!options.includes(key)||typeof flags[key]!=='boolean'))throw new Error('Revisa las opciones de la campaña.');
  return {datos:{...Object.fromEntries(fields.map(key=>[key,data[key]])),guardado_parcial:true,opciones:Object.fromEntries(options.map(key=>[key,flags[key]===true]))},copy,enlace:''};
}
