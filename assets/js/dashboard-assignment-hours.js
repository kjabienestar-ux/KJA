/* El permiso de actualización se valida con RLS en asis_cierre_config. */
let ASSIGNMENT_HOURS={current:null,busy:false,failed:false,custom:false};
const ASSIGNMENT_HOURS_PRESETS=[0,30,60,120,180];
function assignmentHoursValue(value){
  if(value==null||String(value).trim()==='')return null;
  const minutes=Number(value);
  return Number.isInteger(minutes)&&minutes>=0&&minutes<=720?minutes:null;
}
function assignmentHoursText(minutes){
  if(!minutes)return 'sin margen';
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return `+${hours?`${hours} h`:''}${hours&&rest?' ':''}${rest?`${rest} min`:''}`;
}
function paintAssignmentHoursLabel(){
  const label=$('assignment-hours-label');if(!label)return;
  label.textContent=ASSIGNMENT_HOURS.current!==null?assignmentHoursText(ASSIGNMENT_HOURS.current):ASSIGNMENT_HOURS.failed?'sin datos':'…';
}
function previewAssignmentHours(){
  const minutes=assignmentHoursValue($('assignment-hours-minutes').value),ready=!ASSIGNMENT_HOURS.busy&&ASSIGNMENT_HOURS.current!==null;
  $('assignment-hours-save').disabled=!ready||minutes===null||minutes===ASSIGNMENT_HOURS.current;
  const custom=ASSIGNMENT_HOURS.custom||(minutes!==null&&!ASSIGNMENT_HOURS_PRESETS.includes(minutes));
  document.querySelectorAll('[data-hours-preset]').forEach(button=>{
    const value=button.dataset.hoursPreset,on=value==='otro'?custom:!custom&&Number(value)===minutes;
    button.setAttribute('aria-checked',String(on));button.disabled=!ready;
  });
  $('assignment-hours-custom').hidden=!custom;
  // Línea de tiempo con una salida de ejemplo a las 18:00 (hora de Perú).
  const end=minutes===null?null:1080+minutes;
  $('assignment-hours-close').textContent=end===null?'—':`${String(Math.floor(end%1440/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}${end>=1440?' (+1 día)':''}`;
  $('assignment-hours-bar').style.width=`${minutes===null?0:Math.max(4,minutes/720*100)}%`;
  $('assignment-hours-preview').textContent=minutes===null?'Introduce un número entero entre 0 y 720 minutos.':`Con salida a las 18:00, el cierre queda a las ${$('assignment-hours-close').textContent}.`;
}
async function loadAssignmentHours(){
  if(APP.access.rol!=='direccion'||ASSIGNMENT_HOURS.busy)return;
  ASSIGNMENT_HOURS.busy=true;ASSIGNMENT_HOURS.current=null;ASSIGNMENT_HOURS.failed=false;paintAssignmentHoursLabel();
  $('assignment-hours-minutes').disabled=true;$('assignment-hours-save').disabled=true;
  $('assignment-hours-retry').hidden=true;
  $('assignment-hours-status').textContent='Consultando configuración…';
  try{
    const {data,error}=await db.from('asis_cierre_config').select('salida_gracia_min').eq('id',1).single();
    if(error||!data||assignmentHoursValue(data.salida_gracia_min)===null)throw new Error('config');
    ASSIGNMENT_HOURS.current=data.salida_gracia_min;ASSIGNMENT_HOURS.custom=false;
    $('assignment-hours-minutes').value=String(data.salida_gracia_min);
    $('assignment-hours-minutes').disabled=false;
    $('assignment-hours-status').textContent=`Margen actual: ${assignmentHoursText(data.salida_gracia_min)}.`;
  }catch{
    ASSIGNMENT_HOURS.failed=true;
    $('assignment-hours-status').textContent='No se pudo consultar el margen.';
    $('assignment-hours-retry').hidden=false;
  }finally{ASSIGNMENT_HOURS.busy=false;paintAssignmentHoursLabel();previewAssignmentHours()}
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
      ASSIGNMENT_HOURS.current=null;ASSIGNMENT_HOURS.failed=true;
      $('assignment-hours-retry').hidden=false;
      $('assignment-hours-status').textContent='La configuración cambió o ya no tienes permiso. Recarga el margen.';
      return;
    }
    ASSIGNMENT_HOURS.current=data[0].salida_gracia_min;ASSIGNMENT_HOURS.custom=false;
    $('assignment-hours-status').textContent=`Guardado: ${assignmentHoursText(minutes)} para todo el equipo.`;
  }catch{
    $('assignment-hours-status').textContent='No pudimos confirmar el cambio. Recarga el margen antes de reintentar.';
    ASSIGNMENT_HOURS.current=null;ASSIGNMENT_HOURS.failed=true;$('assignment-hours-retry').hidden=false;
  }finally{
    ASSIGNMENT_HOURS.busy=false;$('assignment-hours-minutes').disabled=ASSIGNMENT_HOURS.current===null;
    $('assignment-hours-save').textContent='Guardar';paintAssignmentHoursLabel();previewAssignmentHours();
  }
  if(ASSIGNMENT_HOURS.current!==null){
    try{await loadAdminCloses({quiet:true})}catch{/* El margen ya está guardado. */}
  }
}
// Se consulta al entrar a la sección para que el botón de la cabecera muestre el plazo vigente.
function syncAssignmentHoursAccess(){
  const allowed=APP.access.rol==='direccion';
  $('assignment-hours-open').hidden=!allowed;
  if(allowed&&ASSIGNMENT_HOURS.current===null&&!ASSIGNMENT_HOURS.failed)void loadAssignmentHours();
}
// No depende de que terminen de cargar los cierres: basta con que la sección se muestre.
new MutationObserver(()=>{if(!$('admin-assignments-section').hidden)syncAssignmentHoursAccess()}).observe($('admin-assignments-section'),{attributes:true,attributeFilter:['hidden']});
if(!$('admin-assignments-section').hidden&&APP.access?.rol)syncAssignmentHoursAccess();
$('assignment-hours-open').onclick=()=>{
  const dialog=$('assignment-hours-dialog');
  if(!dialog.open)dialog.showModal();
  if(!ASSIGNMENT_HOURS.busy)void loadAssignmentHours();
};
$('assignment-hours-dialog').querySelector('[data-close-assignment-hours]').onclick=()=>$('assignment-hours-dialog').close();
$('assignment-hours-dialog').onclick=event=>{if(event.target===event.currentTarget)event.currentTarget.close()};
$('assignment-hours-presets').onclick=event=>{
  const button=event.target.closest('[data-hours-preset]');if(!button||button.disabled)return;
  const value=button.dataset.hoursPreset;
  ASSIGNMENT_HOURS.custom=value==='otro';
  if(value!=='otro')$('assignment-hours-minutes').value=value;
  previewAssignmentHours();
  if(value==='otro')$('assignment-hours-minutes').focus();
};
$('assignment-hours-minutes').oninput=previewAssignmentHours;
$('assignment-hours-form').onsubmit=saveAssignmentHours;
$('assignment-hours-retry').onclick=loadAssignmentHours;
