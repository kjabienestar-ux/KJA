/* KJA · Fase 4 — Libro mensual y resumen administrativo. */
let ADMIN_MONTH_DIALOG=null;

function monthMessage(text){
  const id=APP.adminSection==='resumen'?'admin-summary-message':'admin-month-message';
  const el=$(id);el.textContent=text||'';el.classList.toggle('show',!!text);
}
function activeMonthPrefix(){return APP.adminSection==='resumen'?'admin-summary':'admin-month'}
function currentMonthValue(){return $(`${activeMonthPrefix()}-value`).value||isoLima().slice(0,7)}
function monthTitle(value){
  const [year,month]=String(value).split('-').map(Number);
  return `${monthNames[month-1]||''} ${year}`.replace(/^./,x=>x.toUpperCase());
}
function syncMonthInputs(value){
  $('admin-month-value').value=value;$('admin-summary-value').value=value;
  $('admin-month-stamp').textContent=monthTitle(value);$('admin-summary-stamp').textContent=monthTitle(value);
}
function shiftMonth(value,amount){
  const [year,month]=String(value).split('-').map(Number),date=new Date(year,month-1+amount,1);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function monthPeople(kind){
  if(!APP.adminMonth)return [];
  const summary=kind==='summary';
  const query=$(summary?'admin-summary-search':'admin-month-search').value.trim().toLocaleLowerCase('es');
  const area=$(summary?'admin-summary-area':'admin-month-area').value;
  return (APP.adminMonth.personas||[]).filter(person=>(!area||String(person.area_id)===area)
    &&(!query||person.nombre.toLocaleLowerCase('es').includes(query)));
}
function fillMonthFilters(){
  const areas=(APP.adminMonth?.areas||[]).filter(area=>area.activo);
  for(const id of ['admin-month-area','admin-summary-area']){
    const select=$(id),current=select.value;
    select.innerHTML='<option value="">Todas las áreas</option>'+areas.map(area=>`<option value="${area.id}">${esc(area.nombre)}</option>`).join('');
    if(areas.some(area=>String(area.id)===current))select.value=current;
  }
}
function sumMonth(people,key){return people.reduce((total,person)=>total+Number(person.resumen?.[key]||0),0)}
function monthRate(people){
  const p=sumMonth(people,'P'),t=sumMonth(people,'T'),j=sumMonth(people,'J'),base=p+t+j;
  return base?Math.round((p+t)*100/base):null;
}

async function loadAdminMonth(force=false){
  if(!APP.access.acceso_panel)return;
  const prefix=activeMonthPrefix(),value=currentMonthValue();syncMonthInputs(value);
  const include=$(`${prefix}-inactive`).checked,key=`${value}|${include}`;
  if(!force&&APP.adminMonth&&APP.adminMonthKey===key){renderAdminMonthViews();return}
  const [year,month]=value.split('-').map(Number),request=++APP.adminMonthRequest,button=$('admin-refresh');
  button.disabled=true;monthMessage('');
  const target=APP.adminSection==='resumen'?'admin-summary-table':'admin-month-ledger';
  $(target).innerHTML='<p class="admin-empty">Preparando el mes completo…</p>';
  const {data,error}=await db.rpc('dash_admin_mes',{p_anio:year,p_mes:month,p_incluir_inactivos:include});
  if(request!==APP.adminMonthRequest)return;
  button.disabled=false;
  if(error||!data?.ok){
    APP.adminMonth=null;APP.adminMonthKey='';
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_mes'));
    monthMessage(missing?'La fase 4 todavía no está instalada en Supabase. Ejecuta dashboard_07_admin_mes.sql.':'No se pudo cargar el mes. Actualiza e inténtalo nuevamente.');
    $(target).innerHTML='<p class="admin-empty">La información mensual no está disponible.</p>';return;
  }
  data.personas=await hydrateProfilePhotos(data.personas||[]);
  if(request!==APP.adminMonthRequest)return;
  APP.adminMonth=data;APP.adminMonthKey=key;fillMonthFilters();renderAdminMonthViews();
}

function renderAdminMonthViews(){
  if(!APP.adminMonth)return;
  renderAdminMonthLedger();renderAdminMonthSummary();
}
function statusText(state){return ({P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestiona'})[state]||'Sin registro'}
function monthCellClass(day){
  const classes=['admin-month-cell'];
  if(day.estado)classes.push(day.estado.toLowerCase());
  else if(!day.laborable)classes.push(day.motivo==='feriado'?'holiday':day.motivo==='preinicio'?'pre':'off');
  else classes.push('empty');
  if(day.futura)classes.push('future');if(day.evidencia)classes.push('has-evidence');if(day.excepcion_tipo)classes.push('exception');
  return classes.join(' ');
}
function renderAdminMonthLedger(){
  const data=APP.adminMonth,people=monthPeople('month');
  const p=sumMonth(people,'P'),t=sumMonth(people,'T'),j=sumMonth(people,'J'),pending=sumMonth(people,'pendientes');
  const kpis=[['PERSONAS',people.length],['REGISTROS',p+t+j+sumMonth(people,'NG')],['ASISTENCIA',monthRate(people)==null?'—':`${monthRate(people)}%`],['TARDANZAS',t],['PENDIENTES A HOY',pending]];
  $('admin-month-kpis').innerHTML=kpis.map(item=>`<article class="admin-list-kpi"><small>${item[0]}</small><b>${item[1]}</b></article>`).join('');
  const sample=people[0]?.dias||APP.adminMonth.personas?.[0]?.dias||[];
  const holidays=new Map((data.feriados||[]).map(item=>[item.fecha,item.nota||'Feriado']));
  let html='<table class="admin-month-table"><thead><tr><th class="person-col">Colaborador</th>';
  for(const day of sample){
    const date=new Date(day.fecha+'T12:00:00'),dow=['D','L','M','M','J','V','S'][date.getDay()],number=date.getDate(),holiday=holidays.get(day.fecha);
    html+=`<th class="day-col ${holiday?'holiday':''} ${day.fecha===data.hoy?'today':''}" title="${holiday?esc(holiday):''}"><span>${dow}</span><b>${number}</b>${holiday?'<i></i>':''}</th>`;
  }
  html+='</tr></thead><tbody>';
  if(!people.length)html+=`<tr><td class="admin-month-empty" colspan="${sample.length+1}">No hay colaboradores para los filtros seleccionados.</td></tr>`;
  let currentArea='';
  for(const person of people){
    if(person.area!==currentArea){currentArea=person.area;html+=`<tr class="admin-month-area-row"><td colspan="${sample.length+1}"><i></i><b>${esc(currentArea||'Sin área')}</b><span>${people.filter(x=>x.area===currentArea).length}</span></td></tr>`}
    html+=`<tr><th class="person-col">${profileAvatarMarkup(person)}<span><b>${esc(person.nombre)}</b><small>${person.activo?'Activo':'Dado de baja'}</small></span></th>`;
    for(const day of person.dias||[]){
      const content=day.estado||(!day.laborable?'—':'·'),detail=`${person.nombre} · ${day.fecha} · ${day.estado?statusText(day.estado):day.laborable?'Sin registro':day.motivo}`;
      html+=`<td><button type="button" class="${monthCellClass(day)}" data-month-person="${person.id}" data-month-date="${day.fecha}" aria-label="${esc(detail)}"><b>${content}</b>${day.nota?'<i class="note"></i>':''}${day.evidencia?'<i class="camera"></i>':''}</button></td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';$('admin-month-ledger').innerHTML=html;
  if(!data.puede_editar)monthMessage('Tu rol es de solo lectura. Puedes consultar celdas y exportar, pero no modificar el mes.');
}

function renderAdminMonthSummary(){
  const people=monthPeople('summary'),rate=monthRate(people),p=sumMonth(people,'P'),t=sumMonth(people,'T'),j=sumMonth(people,'J'),ng=sumMonth(people,'NG'),pending=sumMonth(people,'pendientes'),hours=sumMonth(people,'horas');
  const cards=[
    ['ASISTENCIA DEL MES',rate==null?'—':`${rate}%`,`${p+t} registros presentes o con tardanza`,'primary'],
    ['PUNTUALIDAD',p+t?`${Math.round(p*100/(p+t))}%`:'—',`${p} presentes · ${t} tardanzas`,''],
    ['PENDIENTES A HOY',pending,`${j} justificados · ${ng} no gestiona`,'warning'],
    ['HORAS REGISTRADAS',`${hours.toFixed(1)} h`,`${people.length} personas en la lectura`,'']
  ];
  $('admin-summary-kpis').innerHTML=cards.map(card=>`<article class="${card[3]}"><small>${card[0]}</small><b>${card[1]}</b><span>${card[2]}</span></article>`).join('');
  let html='<div class="admin-summary-head"><span>Colaborador</span><span>Estados del mes</span><span>Programados</span><span>Pendientes</span><span>Horas</span><span>Asistencia</span></div>';
  for(const person of people){
    const r=person.resumen||{},pct=r.porcentaje==null?null:Number(r.porcentaje),bar=pct==null?0:pct;
    html+=`<article class="admin-summary-row ${person.activo?'':'inactive'}">
      <span class="admin-summary-person">${profileAvatarMarkup(person,'i')}<span><b>${esc(person.nombre)}</b><small>${esc(person.area||'Sin área')} · ${person.activo?'Activo':'Dado de baja'}</small></span></span>
      <span class="admin-summary-states"><i class="p">P <b>${r.P||0}</b></i><i class="t">T <b>${r.T||0}</b></i><i class="j">J <b>${r.J||0}</b></i><i class="ng">NG <b>${r.NG||0}</b></i></span>
      <span><b>${r.programados||0}</b><small>${r.programados_transcurridos||0} transcurridos</small></span>
      <span class="${Number(r.pendientes)>0?'needs-review':''}"><b>${r.pendientes||0}</b><small>a la fecha</small></span>
      <span><b>${Number(r.horas||0).toFixed(1)} h</b><small>congeladas</small></span>
      <span class="admin-summary-rate"><b>${pct==null?'—':pct+'%'}</b><i><u style="width:${bar}%"></u></i></span>
    </article>`;
  }
  $('admin-summary-table').innerHTML=people.length?html:'<p class="admin-empty">No hay colaboradores para los filtros seleccionados.</p>';
}

function closeMonthModal(){
  $('admin-month-modal').hidden=true;document.body.style.overflow='';ADMIN_MONTH_DIALOG=null;
  $('admin-month-modal-message').textContent='';$('admin-month-modal-message').classList.remove('show');
}
function modalMonthMessage(text){const el=$('admin-month-modal-message');el.textContent=text||'';el.classList.toggle('show',!!text)}
function openMonthModal(eyebrow,title,copy,body){
  $('admin-month-modal-eyebrow').textContent=eyebrow;$('admin-month-modal-title').textContent=title;$('admin-month-modal-copy').textContent=copy||'';$('admin-month-modal-body').innerHTML=body;modalMonthMessage('');
  $('admin-month-modal').hidden=false;document.body.style.overflow='hidden';
}
function findMonthCell(personId,date){
  const person=(APP.adminMonth?.personas||[]).find(item=>String(item.id)===String(personId));
  return {person,day:(person?.dias||[]).find(item=>item.fecha===date)};
}
function openMonthCell(personId,date){
  const {person,day}=findMonthCell(personId,date);if(!person||!day)return;
  ADMIN_MONTH_DIALOG={kind:'cell',personId:String(personId),date};
  const dateText=new Date(date+'T12:00:00').toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const mark=day.estado?`<div class="month-day-current ${day.estado.toLowerCase()}"><span><small>ESTADO REGISTRADO</small><b>${statusText(day.estado)}</b></span><span>${day.marcado_at?new Date(day.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):'—'}${day.origen?' · '+esc(day.origen):''}</span></div>`:'';
  const evidence=day.evidencia_path?`<button type="button" class="admin-secondary-action" data-month-action="evidence">Ver evidencia privada</button>`:'';
  const canEdit=!!APP.adminMonth.puede_editar,isFuture=day.fecha>APP.adminMonth.hoy;
  let actions='';
  if(canEdit&&!isFuture&&day.laborable){actions+=`<div class="month-state-picker"><p>Registrar o corregir estado</p>${['P','T','J','NG'].map(state=>`<button type="button" class="${state.toLowerCase()} ${day.estado===state?'on':''}" data-month-state="${state}">${state}<small>${statusText(state)}</small></button>`).join('')}</div>`}
  if(canEdit&&day.estado)actions+='<button type="button" class="admin-danger-action" data-month-action="remove-mark">Quitar marca</button>';
  if(canEdit&&!isFuture&&day.motivo!=='preinicio'){
    if(day.excepcion_tipo)actions+=`<button type="button" class="admin-secondary-action" data-month-action="clear-exception">Restablecer horario normal</button>`;
    else if(!day.laborable)actions+=`<button type="button" class="admin-primary-action" data-month-action="extra">Habilitar como día trabajado</button>`;
    else actions+=`<button type="button" class="admin-secondary-action" data-month-action="off">Registrar permiso / no laborable</button>`;
  }
  const reason={preinicio:'Fecha anterior al inicio del contrato',extra:'Día adicional habilitado',feriado:`Feriado${day.feriado_nota?' · '+day.feriado_nota:''}`,permiso:`Permiso${day.excepcion_nota?' · '+day.excepcion_nota:''}`,horario:day.laborable?'Día programado por horario':'Día no programado'}[day.motivo]||day.motivo;
  openMonthModal('DETALLE DE ASISTENCIA',person.nombre,dateText,
    `<div class="month-day-facts"><span><small>CONDICIÓN</small><b>${esc(reason)}</b></span><span><small>MODALIDAD</small><b>${esc(cap(day.modalidad||'—'))}</b></span><span><small>HORAS</small><b>${day.horas==null?'—':Number(day.horas).toFixed(1)+' h'}</b></span></div>${mark}${day.nota?`<p class="month-day-note"><b>Nota:</b> ${esc(day.nota)}</p>`:''}<div class="month-modal-actions">${evidence}${actions||'<p class="admin-empty">No hay acciones disponibles para esta fecha.</p>'}</div>`);
}

async function openPrivateMonthEvidence(path){
  const popup=window.open('about:blank','_blank');
  try{const {data,error}=await db.storage.from('asis-evidencias').createSignedUrl(path,3600);if(error||!data?.signedUrl)throw error||new Error('url');if(popup){popup.opener=null;popup.location.replace(data.signedUrl)}else window.open(data.signedUrl,'_blank','noopener')}
  catch(error){if(popup)popup.close();modalMonthMessage('No se pudo abrir la evidencia. Inténtalo nuevamente.')}
}
async function changeMonthState(state){
  const dialog=ADMIN_MONTH_DIALOG,{person,day}=findMonthCell(dialog.personId,dialog.date);if(!person||!day)return;
  modalMonthMessage('Guardando…');
  const {data,error}=await db.rpc('dash_admin_guardar_estado',{p_colab:Number(person.id),p_fecha:day.fecha,p_estado:state});
  if(error||!data?.ok){const reason=data?.motivo||error?.message;return modalMonthMessage(({no_labora:'Primero habilita este día como laborable.',fecha:'No se puede marcar una fecha futura.',antes_contrato:'La fecha es anterior al contrato.',sin_permiso:'Tu rol no permite editar.'})[reason]||'No se pudo guardar el estado.')}
  closeMonthModal();await loadAdminMonth(true);toast('Estado mensual actualizado.');
}
async function removeMonthMark(){
  const dialog=ADMIN_MONTH_DIALOG,{person,day}=findMonthCell(dialog.personId,dialog.date);if(!person||!day)return;
  modalMonthMessage('Quitando marca…');
  let {data,error}=await db.rpc('dash_admin_quitar_estado',{p_colab:Number(person.id),p_fecha:day.fecha,p_evidencia_eliminada:false});
  if(error)return modalMonthMessage('No se pudo quitar la marca.');
  if(!data?.ok&&data?.motivo==='requiere_evidencia'){
    if(!confirm(`La marca de ${person.nombre} tiene una evidencia. ¿Quieres eliminar la marca y su imagen?`))return modalMonthMessage('');
    const removed=await db.storage.from('asis-evidencias').remove([data.ruta]);if(removed.error)return modalMonthMessage('No se pudo borrar la evidencia; la marca se conservó.');
    ({data,error}=await db.rpc('dash_admin_quitar_estado',{p_colab:Number(person.id),p_fecha:day.fecha,p_evidencia_eliminada:true}));
  }
  if(error||!data?.ok)return modalMonthMessage('No se pudo quitar la marca.');
  closeMonthModal();await loadAdminMonth(true);toast('Marca eliminada.');
}
async function changeMonthException(type){
  const dialog=ADMIN_MONTH_DIALOG,{person,day}=findMonthCell(dialog.personId,dialog.date);if(!person||!day)return;
  modalMonthMessage('Guardando excepción…');
  const call=type?db.rpc('dash_admin_guardar_excepcion',{p_colab:Number(person.id),p_fecha:day.fecha,p_tipo:type,p_nota:null}):db.rpc('dash_admin_quitar_excepcion',{p_colab:Number(person.id),p_fecha:day.fecha});
  const {data,error}=await call;
  if(error||!data?.ok)return modalMonthMessage('No se pudo actualizar la condición del día.');
  closeMonthModal();await loadAdminMonth(true);toast(type==='laborable_extra'?'Día habilitado.':type==='no_laborable'?'Permiso registrado.':'Horario restablecido.');
}

function openHolidayManager(){
  if(!APP.adminMonth)return;
  ADMIN_MONTH_DIALOG={kind:'holidays'};
  const canEdit=!!APP.adminMonth.puede_editar,items=(APP.adminMonth.feriados||[]).map(item=>`<li><span><b>${new Date(item.fecha+'T12:00:00').toLocaleDateString('es-PE',{day:'numeric',month:'long'})}</b><small>${esc(item.nota||'Feriado')}</small></span>${canEdit?`<button type="button" data-remove-holiday="${item.fecha}">Quitar</button>`:''}</li>`).join('');
  const form=canEdit?`<form class="month-holiday-form" id="month-holiday-form"><label>Fecha<input type="date" id="month-holiday-date" min="${APP.adminMonth.inicio}" max="${APP.adminMonth.fin}" required></label><label>Motivo<input id="month-holiday-note" maxlength="60" placeholder="Ej. Feriado nacional"></label><button class="admin-primary-action" type="submit">Agregar feriado</button></form>`:'<p class="admin-empty">Tu rol permite consultar, pero no editar feriados.</p>';
  openMonthModal('CALENDARIO LABORAL','Feriados del mes','Bloquean el día para todo el equipo; una excepción personal puede habilitar a quien sí trabaje.',`${form}<ul class="month-holiday-list">${items||'<li class="empty">No hay feriados registrados este mes.</li>'}</ul>`);
  if(canEdit)$('month-holiday-form').onsubmit=saveHoliday;
}
async function saveHoliday(event){
  event.preventDefault();const date=$('month-holiday-date').value,note=$('month-holiday-note').value.trim();modalMonthMessage('Guardando feriado…');
  const {data,error}=await db.rpc('dash_admin_guardar_feriado',{p_fecha:date,p_nota:note||null});
  if(error||!data?.ok)return modalMonthMessage(data?.motivo==='nota'?'El motivo admite hasta 60 caracteres.':'No se pudo guardar el feriado.');
  closeMonthModal();await loadAdminMonth(true);openHolidayManager();toast('Feriado guardado.');
}
async function removeHoliday(date){
  modalMonthMessage('Quitando feriado…');const {data,error}=await db.rpc('dash_admin_quitar_feriado',{p_fecha:date});
  if(error||!data?.ok)return modalMonthMessage('No se pudo quitar el feriado.');
  closeMonthModal();await loadAdminMonth(true);openHolidayManager();toast('Feriado retirado.');
}

function csvCell(value){const text=String(value??'');return /[;"\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
function downloadMonthCsv(kind){
  if(!APP.adminMonth)return;const people=monthPeople(kind),summary=kind==='summary';let rows;
  if(summary){rows=[['Colaborador','Área','Estado','P','T','J','NG','Programados','Transcurridos','Pendientes','Horas','Asistencia %'],...people.map(person=>{const r=person.resumen||{};return [person.nombre,person.area,person.activo?'Activo':'Baja',r.P||0,r.T||0,r.J||0,r.NG||0,r.programados||0,r.programados_transcurridos||0,r.pendientes||0,Number(r.horas||0).toFixed(1),r.porcentaje??'']})]}
  else{rows=[['Colaborador','Área','Estado persona','Fecha','Laborable','Motivo','Modalidad','Estado asistencia','Horas','Hora de marca','Origen','Nota','Evidencia'],...people.flatMap(person=>(person.dias||[]).map(day=>[person.nombre,person.area,person.activo?'Activo':'Baja',day.fecha,day.laborable?'Sí':'No',day.motivo,day.modalidad,day.estado||'',day.horas??'',day.marcado_at||'',day.origen||'',day.nota||day.excepcion_nota||day.feriado_nota||'',day.evidencia?'Sí':'No']))]}
  const content='\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n'),blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`KJA_${summary?'resumen':'asistencia'}_${currentMonthValue()}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);toast('Archivo CSV preparado.');
}

function setMonthFrom(prefix,value){syncMonthInputs(value);APP.adminMonthKey='';loadAdminMonth()}
const initialAdminMonth=isoLima().slice(0,7);syncMonthInputs(initialAdminMonth);
['admin-month','admin-summary'].forEach(prefix=>{
  $(`${prefix}-prev`).onclick=()=>setMonthFrom(prefix,shiftMonth($(`${prefix}-value`).value,-1));
  $(`${prefix}-next`).onclick=()=>setMonthFrom(prefix,shiftMonth($(`${prefix}-value`).value,1));
  $(`${prefix}-today`).onclick=()=>setMonthFrom(prefix,isoLima().slice(0,7));
  $(`${prefix}-value`).onchange=e=>setMonthFrom(prefix,e.target.value||isoLima().slice(0,7));
  $(`${prefix}-inactive`).onchange=()=>{APP.adminMonthKey='';loadAdminMonth()};
});
$('admin-month-search').oninput=renderAdminMonthLedger;$('admin-month-area').onchange=renderAdminMonthLedger;
$('admin-summary-search').oninput=renderAdminMonthSummary;$('admin-summary-area').onchange=renderAdminMonthSummary;
$('admin-month-export').onclick=()=>downloadMonthCsv('month');$('admin-summary-export').onclick=()=>downloadMonthCsv('summary');
$('admin-month-holidays').onclick=openHolidayManager;
$('admin-month-ledger').onclick=event=>{const cell=event.target.closest('[data-month-person]');if(cell)openMonthCell(cell.dataset.monthPerson,cell.dataset.monthDate)};
$('admin-month-modal-body').onclick=event=>{
  const state=event.target.closest('[data-month-state]');if(state)return changeMonthState(state.dataset.monthState);
  const removeHolidayButton=event.target.closest('[data-remove-holiday]');if(removeHolidayButton)return removeHoliday(removeHolidayButton.dataset.removeHoliday);
  const action=event.target.closest('[data-month-action]');if(!action||ADMIN_MONTH_DIALOG?.kind!=='cell')return;
  const {day}=findMonthCell(ADMIN_MONTH_DIALOG.personId,ADMIN_MONTH_DIALOG.date);
  if(action.dataset.monthAction==='evidence')return openPrivateMonthEvidence(day?.evidencia_path);
  if(action.dataset.monthAction==='remove-mark')return removeMonthMark();
  if(action.dataset.monthAction==='extra')return changeMonthException('laborable_extra');
  if(action.dataset.monthAction==='off')return changeMonthException('no_laborable');
  if(action.dataset.monthAction==='clear-exception')return changeMonthException(null);
};
document.querySelectorAll('[data-close-month-modal]').forEach(item=>item.onclick=closeMonthModal);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('admin-month-modal').hidden)closeMonthModal()});
