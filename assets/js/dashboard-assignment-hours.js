/* El permiso de actualización se valida con RLS en asis_cierre_config. */
let ASSIGNMENT_HOURS={current:null,busy:false};
function assignmentHoursValue(value){
  if(value==null||String(value).trim()==='')return null;
  const minutes=Number(value);
  return Number.isInteger(minutes)&&minutes>=0&&minutes<=720?minutes:null;
}
function previewAssignmentHours(){
  const minutes=assignmentHoursValue($('assignment-hours-minutes').value);
  $('assignment-hours-save').disabled=ASSIGNMENT_HOURS.busy||ASSIGNMENT_HOURS.current===null||minutes===null||minutes===ASSIGNMENT_HOURS.current;
  const example=minutes===null?'':`${String(Math.floor((1080+minutes)%1440/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  $('assignment-hours-preview').textContent=minutes===null?'Introduce un número entero entre 0 y 720 minutos.':`Ejemplo: salida a las 18:00 → cierre hasta las ${example}${1080+minutes>=1440?' del día siguiente':''} (hora de Perú). Las asignaciones deben enviarse antes de medianoche.`;
}
async function loadAssignmentHours(){
  if(APP.access.rol!=='direccion'||ASSIGNMENT_HOURS.busy)return;
  ASSIGNMENT_HOURS.busy=true;ASSIGNMENT_HOURS.current=null;
  $('assignment-hours-minutes').disabled=true;$('assignment-hours-save').disabled=true;
  $('assignment-hours-retry').hidden=true;
  $('assignment-hours-status').textContent='Consultando configuración…';
  try{
    const {data,error}=await db.from('asis_cierre_config').select('salida_gracia_min').eq('id',1).single();
    if(error||!data||assignmentHoursValue(data.salida_gracia_min)===null)throw new Error('config');
    ASSIGNMENT_HOURS.current=data.salida_gracia_min;
    $('assignment-hours-minutes').value=String(data.salida_gracia_min);
    $('assignment-hours-minutes').disabled=false;
    $('assignment-hours-status').textContent=`Margen actual: ${data.salida_gracia_min} minutos después de la salida.`;
  }catch{
    $('assignment-hours-status').textContent='No se pudo consultar el margen. Reintenta antes de guardar.';
    $('assignment-hours-retry').hidden=false;
  }finally{ASSIGNMENT_HOURS.busy=false;previewAssignmentHours()}
}
async function saveAssignmentHours(event){
  event.preventDefault();
  const minutes=assignmentHoursValue($('assignment-hours-minutes').value);
  if(APP.access.rol!=='direccion'||ASSIGNMENT_HOURS.busy||ASSIGNMENT_HOURS.current===null||minutes===null||minutes===ASSIGNMENT_HOURS.current)return;
  ASSIGNMENT_HOURS.busy=true;
  $('assignment-hours-minutes').disabled=true;$('assignment-hours-save').disabled=true;
  $('assignment-hours-save').textContent='Guardando…';
  try{
    const {data,error}=await db.from('asis_cierre_config').update({salida_gracia_min:minutes,actualizado_at:new Date().toISOString(),actualizado_por:APP.sessionUid})
      .eq('id',1).eq('salida_gracia_min',ASSIGNMENT_HOURS.current).select('salida_gracia_min');
    if(error)throw new Error('save');
    if(!data?.length){
      ASSIGNMENT_HOURS.current=null;
      $('assignment-hours-retry').hidden=false;
      $('assignment-hours-status').textContent='La configuración cambió o ya no tienes permiso. Recarga el margen y vuelve a intentarlo.';
      return;
    }
    ASSIGNMENT_HOURS.current=data[0].salida_gracia_min;
    $('assignment-hours-status').textContent=`Guardado: ${minutes} minutos de margen para todo el equipo. También se aplicará los próximos días.`;
  }catch{
    $('assignment-hours-status').textContent='No pudimos confirmar el cambio. Recarga el margen para comprobarlo antes de reintentar.';
    ASSIGNMENT_HOURS.current=null;$('assignment-hours-retry').hidden=false;
  }finally{
    ASSIGNMENT_HOURS.busy=false;$('assignment-hours-minutes').disabled=ASSIGNMENT_HOURS.current===null;
    $('assignment-hours-save').textContent='Guardar margen general';previewAssignmentHours();
  }
  if(ASSIGNMENT_HOURS.current!==null){
    try{await loadAdminCloses({quiet:true})}catch{/* El margen ya está guardado. */}
  }
}
$('assignment-hours').ontoggle=()=>{if($('assignment-hours').open)void loadAssignmentHours()};
$('assignment-hours-minutes').oninput=previewAssignmentHours;
$('assignment-hours-form').onsubmit=saveAssignmentHours;
$('assignment-hours-retry').onclick=loadAssignmentHours;
