/* Exploración de asignaciones; las revisiones conservan los permisos del panel. */
let ASSIGNMENT_CALENDAR_REQUEST=0;
let ASSIGNMENT_SELECTED_DATE='';
let ASSIGNMENT_PAGE=0;
let ASSIGNMENT_PAGE_KEY='';
function paginateAssignments(rows){
  const key=[$('admin-close-date').value,$('admin-assignment-search').value].join('|');
  if(key!==ASSIGNMENT_PAGE_KEY){ASSIGNMENT_PAGE=0;ASSIGNMENT_PAGE_KEY=key;}
  const pages=Math.max(1,Math.ceil(rows.length/3));
  ASSIGNMENT_PAGE=Math.max(0,Math.min(ASSIGNMENT_PAGE,pages-1));
  $('assignment-prev').disabled=ASSIGNMENT_PAGE===0;
  $('assignment-next').disabled=ASSIGNMENT_PAGE>=pages-1;
  $('assignment-page').textContent=`Página ${ASSIGNMENT_PAGE+1} de ${pages} · ${rows.length} asignaciones`;
  return rows.slice(ASSIGNMENT_PAGE*3,ASSIGNMENT_PAGE*3+3);
}
function adminAssignmentEvidence(id){
  if(!APP.adminReview?.ok)return '<p>No se pudo consultar la evidencia. Pulsa Actualizar para reintentar.</p>';
  const deliveries=(APP.adminReview.entregas||[]).filter(item=>item.requisito==='asignado'&&String(item.asignacion_id)===String(id)&&item.estado==='completo');
  return deliveries.length?deliveries.map(item=>`<button type="button" class="assignment-evidence-link" data-assignment-review="${esc(id)}" data-assignment-person="${esc(item.colaborador_id)}">${esc(item.colaborador)} · Ver ${(item.archivos||[]).length} archivos <small>${esc(adminReviewStateLabel(item))}</small></button>`).join(''):'<p class="assignment-no-files">Sin evidencias de esta asignación todavía.</p>';
}
function assignmentCalendarMarkup(month,days,selected){
  const [year,number]=month.split('-').map(Number),first=new Date(Date.UTC(year,number-1,1)),length=new Date(Date.UTC(year,number,0)).getUTCDate();
  const counts=new Map(days.map(item=>[item.fecha,Number(item.total)||0]));
  let html=['L','M','M','J','V','S','D'].map(day=>`<span aria-hidden="true">${day}</span>`).join('');
  for(let i=0;i<(first.getUTCDay()+6)%7;i++)html+='<span></span>';
  for(let day=1;day<=length;day++){
    const date=`${month}-${String(day).padStart(2,'0')}`,count=counts.get(date)||0;
    html+=`<button type="button" data-assignment-date="${date}" aria-pressed="${date===selected}" aria-label="${date}: ${count} asignaciones" class="${count?'has-assignments':''}">${day}${count?'<i aria-hidden="true"></i>':''}</button>`;
  }
  return html;
}
async function loadAssignmentCalendar(){
  const month=$('assignment-calendar-month').value;if(!/^\d{4}-\d{2}$/.test(month))return;
  const request=++ASSIGNMENT_CALENDAR_REQUEST;
  $('assignment-calendar-message').textContent='Consultando fechas…';
  $('assignment-calendar-days').innerHTML='';
  try{
    const {data,error}=await db.rpc('dash_admin_asignaciones_calendario',{p_mes:month+'-01'});
    if(request!==ASSIGNMENT_CALENDAR_REQUEST)return;
    if(error||!data?.ok)throw new Error('consulta');
    $('assignment-calendar-days').innerHTML=assignmentCalendarMarkup(month,data.dias||[],$('admin-close-date').value);
    $('assignment-calendar-message').textContent=(data.dias||[]).length?'Selecciona una fecha para ver sus asignaciones.':'No hay asignaciones registradas en este mes.';
  }catch{
    if(request!==ASSIGNMENT_CALENDAR_REQUEST)return;
    $('assignment-calendar-message').textContent='No se pudo cargar el calendario. Pulsa Actualizar para reintentar.';
  }
}
function syncAssignmentCalendar(){
  const date=$('admin-close-date').value||isoLima();
  if(ASSIGNMENT_SELECTED_DATE!==date||!$('assignment-calendar-month').value)$('assignment-calendar-month').value=date.slice(0,7);
  ASSIGNMENT_SELECTED_DATE=date;
  $('assignment-work-date').value=date;
  $('admin-assignment-date-note').textContent=`Fecha seleccionada: ${adminReviewDate(date)}.${date<isoLima()?' Solo consulta: no puedes crear asignaciones en fechas pasadas.':''}`;
  void loadAssignmentCalendar();
}
$('admin-close-target-search').oninput=()=>{syncAdminCloseTargets();clearAdminDrawPreview()};
$('assignment-target-matches').onclick=event=>{
  const button=event.target.closest('[data-assignment-target]');if(!button)return;
  const id=button.dataset.assignmentTarget;
  $('admin-close-target-search').value='';syncAdminCloseTargets();
  $('admin-close-target').value=id;
  clearAdminDrawPreview();
  $('admin-close-target-results').textContent=`Seleccionado: ${button.querySelector('strong').textContent}`;
  $('admin-close-target').focus({preventScroll:true});
};
$('admin-assignment-search').oninput=renderAdminCloseAssignments;
$('assignment-work-date').onchange=()=>{
  if(!$('assignment-work-date').value)return;
  $('admin-close-date').value=$('assignment-work-date').value;
  clearAdminDrawPreview();void loadAdminCloses();
};
$('assignment-prev').onclick=()=>{ASSIGNMENT_PAGE--;renderAdminCloseAssignments()};
$('assignment-next').onclick=()=>{ASSIGNMENT_PAGE++;renderAdminCloseAssignments()};
$('assignment-calendar-month').onchange=loadAssignmentCalendar;
$('assignment-calendar-days').onclick=event=>{
  const button=event.target.closest('[data-assignment-date]');if(!button)return;
  $('admin-close-date').value=button.dataset.assignmentDate;
  $('admin-close-assignment-list').innerHTML='<p class="admin-empty">Cargando asignaciones de la fecha seleccionada…</p>';
  clearAdminDrawPreview();void loadAdminCloses();
};
$('admin-close-assignment-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-assignment-review]');if(button)openAdminReviewPerson(button.dataset.assignmentPerson,button,button.dataset.assignmentReview);
});
