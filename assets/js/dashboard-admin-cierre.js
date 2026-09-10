/* KJA · Administración de cierres y entregables diarios. */

let ADMIN_REVIEW={personId:null,deliveryId:null,trigger:null,busy:false,request:0};
let ADMIN_DRAW={key:'',selection:[]};
let ADMIN_EVIDENCE={personId:null,requirement:'',assignment:null,files:[],trigger:null,busy:false};
let ADMIN_MESSAGE={personId:null,trigger:null,busy:false};

function adminEvidenceIcon(kind){
  if(kind==='comparticiones')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V3h-3a5 5 0 0 0-5 5v3H6v5h3v5h5v-5h3l1-5h-4z"/></svg>';
  if(kind==='salida')return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="13" rx="3"/><path d="m8 6 1.5-2h5L16 6"/><circle cx="12" cy="12.5" r="3.25"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4V20H7z"/><path d="M14 3.5V8h4M10 12h5M10 15h5"/></svg>';
}

function adminEvidencePerson(personId){
  return (APP.adminClose?.personas||[]).find(person=>String(person.id)===String(personId));
}

function adminEvidenceMissing(person,reviews=null){
  const close=person?.cierre||{},hasEntry=!!close.entrada_at,personReviews=reviews||(APP.adminReview?.entregas||[]).filter(item=>String(item.colaborador_id)===String(person?.id));
  const globals=(close.requisitos||[]).filter(item=>!item.completo&&(item.tipo==='comparticiones'||hasEntry)).map(item=>({kind:item.tipo,assignment:null,title:item.titulo,copy:item.descripcion||'Evidencia requerida'}));
  const exitDelivered=personReviews.some(item=>item.requisito==='salida'&&item.estado==='completo');
  if(hasEntry&&!close.salida_at&&!exitDelivered&&!globals.some(item=>item.kind==='salida'))globals.push({kind:'salida',assignment:null,title:'Evidencia de hora de salida',copy:'Adjunta la foto recibida e indica la hora visible'});
  const assigned=hasEntry?(close.asignaciones||[]).filter(item=>!item.completo).map(item=>({kind:'asignado',assignment:Number(item.id),title:item.titulo,copy:item.instrucciones||'Entregable asignado'})):[];
  return [...globals,...assigned];
}

function adminCloseEvidenceKey(item,assignment=false){
  const type=assignment?'asignado':item?.requisito||item?.tipo;
  if(type==='asignado')return item?.asignacion_id||item?.id?`asignacion:${item.asignacion_id||item.id}`:'';
  return type?`requisito:${type}`:'';
}

function adminCloseEvidenceProgress(person,reviews=[]){
  const close=person?.cierre||{},expected=new Set(),complete=new Set(),latest=new Map();
  for(const item of close.requisitos||[]){const key=adminCloseEvidenceKey(item);if(!key)continue;expected.add(key);if(item.completo)complete.add(key)}
  for(const item of close.asignaciones||[]){const key=adminCloseEvidenceKey(item,true);if(!key)continue;expected.add(key);if(item.completo)complete.add(key)}
  if(person?.labora&&close.aplica_jornada!==false)expected.add('requisito:rpe');
  if(close.aplica_comparticiones===true)expected.add('requisito:comparticiones');
  if(close.entrada_at&&!close.salida_at&&close.aplica_jornada!==false)expected.add('requisito:salida');
  for(const item of reviews){
    const key=adminCloseEvidenceKey(item);if(!key)continue;expected.add(key);
    const current=latest.get(key),itemOrder=Number(item.id)||new Date(item.completado_at||0).getTime(),currentOrder=Number(current?.id)||new Date(current?.completado_at||0).getTime();
    if(!current||itemOrder>currentOrder)latest.set(key,item);
  }
  for(const [key,item] of latest){if(item.estado==='completo')complete.add(key);else complete.delete(key)}
  return {done:[...complete].filter(key=>expected.has(key)).length,total:expected.size};
}

function adminCloseMsg(text,type=''){
  const el=$('admin-close-message');if(!el)return;
  el.textContent=text||'';el.className='admin-list-message'+(text?' show':'')+(type?' '+type:'');
}

function adminCloseStateLabel(state){
  return CLOSE_MODEL.stateLabel(state);
}

function adminCloseResolvedState(person,progress,date){
  const close=person?.cierre||{};
  if(close.salida_at){
    if(close.estado==='incompleta')return 'incompleta';
    return close.estado==='regularizada'?'regularizada':'completa';
  }
  if(!person?.labora)return close.estado||'no_aplica';
  if(close.entrada_at){
    if(close.estado&&close.estado!=='pendiente'&&close.estado!=='sin_entrada')return close.estado;
    if(date<isoLima())return 'incompleta';
    return progress.total>0&&progress.done===progress.total?'lista_para_salir':'en_curso';
  }
  return close.estado||'sin_entrada';
}

function adminCloseTime(value){
  return value?new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'}).format(new Date(value)):'—';
}

function adminCloseClock(value){
  const match=String(value||'').match(/^(\d{1,2}):(\d{2})/);if(!match)return '';
  const hour=Number(match[1]),suffix=hour<12?'a. m.':'p. m.';
  return `${hour%12||12}:${match[2]} ${suffix}`;
}

function adminCloseSchedule(person){
  const close=person?.cierre||{},start=adminCloseClock(person?.hora_inicio_programada||close.hora_inicio_programada),end=adminCloseClock(person?.hora_salida_programada||close.hora_salida_programada);
  return start&&end?`${start} – ${end}`:'Horario no disponible';
}

function adminCloseSearchText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
}

function adminCloseAreaTone(value){
  const text=String(value||'');let hash=0;
  for(let index=0;index<text.length;index+=1)hash=(hash*31+text.charCodeAt(index))>>>0;
  return hash%8;
}

function adminReviewDate(value){
  if(!value)return 'Fecha no disponible';
  const parsed=new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())?'Fecha no disponible':new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Lima'}).format(parsed);
}

function adminReviewTime(value){
  if(!value)return 'Hora no disponible';
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?'Hora no disponible':new Intl.DateTimeFormat('es-PE',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'America/Lima'}).format(parsed);
}

function syncAdminCloseTargets(){
  const data=APP.adminClose;if(!data)return;
  const select=$('admin-close-target'),kind=$('admin-close-target-kind').value,current=select.value;
  const rows=kind==='area'||kind==='sorteo'?(data.areas||[]):(data.personas||[]);
  select.innerHTML='<option value="">Seleccionar…</option>'+rows.map(row=>`<option value="${esc(row.id)}">${esc(kind==='area'?row.nombre:`${row.nombre} · ${row.area}`)}</option>`).join('');
  if(kind==='sorteo')select.innerHTML='<option value="">Seleccionar área…</option>'+rows.map(row=>`<option value="${esc(row.id)}">${esc(row.nombre)}</option>`).join('');
  if(rows.some(row=>String(row.id)===current))select.value=current;
  $('admin-close-draw-count-wrap').hidden=kind!=='sorteo';
}

function adminDrawKey(){
  return [$('admin-close-date').value,$('admin-close-target').value,$('admin-close-draw-count').value,$('admin-close-type').value,$('admin-close-title').value.trim(),$('admin-close-instructions').value.trim()].join('|');
}

function clearAdminDrawPreview(){
  ADMIN_DRAW={key:'',selection:[]};const preview=$('admin-close-draw-preview');preview.hidden=true;preview.innerHTML='';
  $('admin-close-assign').textContent=$('admin-close-target-kind').value==='sorteo'?'Previsualizar sorteo':'Asignar entregable';
}

function renderAdminDrawPreview(data){
  ADMIN_DRAW={key:adminDrawKey(),selection:data.seleccion||[]};const preview=$('admin-close-draw-preview');preview.hidden=false;
  preview.innerHTML=`<header><span><b>Selección propuesta</b><small>Rotación equilibrada según asignaciones de los últimos 30 días.</small></span><em>${ADMIN_DRAW.selection.length} de ${data.disponibles} disponibles</em></header><div>${ADMIN_DRAW.selection.map(person=>`<span><i>${esc(initials(person.nombre))}</i><span><b>${esc(person.nombre)}</b><small>${Number(person.carga_30d)||0} asignaciones recientes</small></span></span>`).join('')}</div><p>La selección permanece igual mientras no cambies fecha, área, cantidad o tipo.</p>`;
  $('admin-close-assign').textContent=`Confirmar ${ADMIN_DRAW.selection.length} ${ADMIN_DRAW.selection.length===1?'asignación':'asignaciones'}`;
}

function renderAdminCloseAssignments(){
  const data=APP.adminClose,rows=data?.asignaciones||[];
  const presentations=rows.map(adminCloseAssignmentPresentation),concluded=presentations.filter(item=>['entregada','aprobada'].includes(item.state)).length;
  $('admin-close-assignment-count').textContent=rows.length?`${rows.length} ${rows.length===1?'asignación':'asignaciones'} · ${concluded} ${concluded===1?'concluida':'concluidas'}`:'Sin asignaciones';
  $('admin-close-assignment-list').innerHTML=rows.length?rows.map((item,index)=>{const status=presentations[index];return `<div class="admin-close-assignment-row is-${esc(status.state)}">
    <span class="admin-close-assignment-copy"><small>${esc((item.tipo||'otro').toUpperCase())}</small><b title="${esc(item.titulo)}">${esc(item.titulo)}</b><em>${esc(item.destino||'Destino no disponible')}</em></span>
    <span class="admin-close-assignment-progress"><strong class="admin-assignment-state ${esc(status.state)}"><i aria-hidden="true"></i>${esc(status.label)}</strong><em>${esc(status.copy)}</em></span>
    ${data.puede_editar&&item.cancelable!==false?`<button type="button" data-cancel-admin-close="${esc(item.id)}">Cancelar</button>`:''}
  </div>`}).join(''):'<p class="admin-empty">No hay entregables asignados para esta fecha.</p>';
}

function adminCloseAssignmentPresentation(item){
  const state=item.estado_asignacion||'pendiente',delivered=Number(item.entregados)||0,total=Number(item.destinatarios)||1;
  const labels={pendiente:'Pendiente',parcial:'En progreso',entregada:'Entregada',aprobada:'Concluida',observada:'Con corrección',sin_destinatarios:'Sin destinatarios'};
  const copy={
    pendiente:'Aún no registra una entrega',
    parcial:`${delivered} de ${total} personas entregaron`,
    entregada:'Entrega recibida · pendiente de revisión',
    aprobada:'Entrega revisada y aprobada',
    observada:'Debe enviar una nueva versión',
    sin_destinatarios:'No hay personas programadas'
  }[state]||'Estado por confirmar';
  return {state,label:labels[state]||'Pendiente',copy};
}

function renderAdminCloseStatus(){
  const data=APP.adminClose;if(!data)return;
  const reviews=APP.adminReview?.entregas||[],canReview=APP.access.rol==='direccion';
  const area=$('admin-close-area').value,query=adminCloseSearchText($('admin-close-search').value.trim());
  const people=(data.personas||[]).filter(person=>(!area||String(person.area_id)===area)&&(!query||adminCloseSearchText(person.nombre).includes(query)));
  const groups=new Map();
  people.forEach(person=>{if(!groups.has(String(person.area_id)))groups.set(String(person.area_id),{id:person.area_id,name:person.area,items:[]});groups.get(String(person.area_id)).items.push(person)});
  const selectedDate=$('admin-close-date').value||isoLima();
  let html='';
  for(const group of groups.values()){
    const complete=group.items.filter(person=>{const personReviews=reviews.filter(item=>String(item.colaborador_id)===String(person.id)),progress=adminCloseEvidenceProgress(person,personReviews);return ['completa','regularizada'].includes(adminCloseResolvedState(person,progress,selectedDate))}).length;
    html+=`<section class="admin-close-area area-tone-${adminCloseAreaTone(group.id)}"><header><span><b>${esc(group.name)}</b><small>${complete} de ${group.items.length} jornadas completas</small></span></header><div class="admin-close-table"><div class="admin-close-table-head"><span>Colaborador</span><span>Entrada</span><span>Evidencias</span><span>Salida</span><span>Jornada</span><span>Mensaje</span></div>`;
    for(const person of group.items){
      const close=person.cierre||{},personReviews=reviews.filter(item=>String(item.colaborador_id)===String(person.id)),progress=adminCloseEvidenceProgress(person,personReviews);
      const evidence=`${progress.done}/${progress.total}`,state=adminCloseResolvedState(person,progress,selectedDate),pending=personReviews.filter(item=>item.revision_estado==='pendiente'&&item.estado==='completo').length;
      const reviewAction=canReview&&personReviews.length?`<button type="button" class="admin-close-review-trigger ${pending?'has-pending':''}" data-admin-review-person="${esc(person.id)}">${pending?`${pending} por revisar`:'Ver evidencias'}</button>`:'';
      const missing=adminEvidenceMissing(person,personReviews),canUpload=canReview&&($('admin-close-date').value||isoLima())<=isoLima(),uploadAction=canUpload&&missing.length?`<button type="button" class="admin-close-upload-trigger" data-admin-upload-person="${esc(person.id)}">Subir faltante</button>`:'';
      const messageAction=canReview?`<button type="button" class="admin-close-message-trigger" data-admin-message-person="${esc(person.id)}" aria-label="Enviar mensaje a ${esc(person.nombre)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H8l-4 4zM8 9h8M8 13h5"/></svg><span>Mensaje</span></button>`:'';
      html+=`<div class="admin-close-person${person.labora?'':' is-off'}"><span data-label="Colaborador"><b>${esc(person.nombre)}</b><small class="admin-close-person-schedule">${esc(person.labora?adminCloseSchedule(person):'No labora')}</small></span><span data-label="Entrada">${esc(adminCloseTime(close.entrada_at))}</span><span data-label="Evidencias" class="admin-close-evidence-cell"><b>${esc(evidence)}</b><span class="admin-close-evidence-actions">${reviewAction}${uploadAction}</span></span><span data-label="Salida">${esc(adminCloseTime(close.salida_at))}</span><span data-label="Jornada" class="admin-close-status-pill ${esc(state)}">${esc(adminCloseStateLabel(state))}</span><span data-label="Mensaje" class="admin-close-message-cell">${messageAction||'—'}</span></div>`;
    }
    html+='</div></section>';
  }
  $('admin-close-status').innerHTML=html||'<p class="admin-empty">No hay colaboradores para el filtro seleccionado.</p>';
}

function renderAdminReviewSummary(){
  const wrap=$('admin-review-summary'),data=APP.adminReview;
  if(!wrap)return;
  if(APP.access.rol!=='direccion'){
    wrap.hidden=false;wrap.innerHTML='<span class="admin-review-readonly"><b>Vista de seguimiento</b><small>La apertura y validación de imágenes está reservada a Dirección.</small></span>';return;
  }
  if(!data?.ok){
    wrap.hidden=false;wrap.innerHTML='<span class="admin-review-readonly is-warning"><b>Revisión aún no instalada</b><small>Ejecuta dashboard_21_revision_evidencias.sql para abrir y validar las imágenes.</small></span>';return;
  }
  const rows=data.entregas||[],pending=rows.filter(item=>item.revision_estado==='pendiente'&&item.estado==='completo').length,approved=rows.filter(item=>item.revision_estado==='aprobada').length,observed=rows.filter(item=>item.revision_estado==='observada').length;
  wrap.hidden=false;wrap.innerHTML=`<span><i class="pending"></i><small>POR REVISAR</small><b>${pending}</b></span><span><i class="approved"></i><small>APROBADAS</small><b>${approved}</b></span><span><i class="observed"></i><small>CON CORRECCIÓN</small><b>${observed}</b></span><p>${pending?'Selecciona una persona para validar sus archivos privados.':'No quedan evidencias pendientes para esta fecha.'}</p>`;
}

function hydrateAdminCloseControls(){
  const data=APP.adminClose;if(!data)return;
  const drawOption=$('admin-close-draw-option');drawOption.hidden=APP.access.rol!=='direccion';drawOption.disabled=APP.access.rol!=='direccion';
  if(APP.access.rol!=='direccion'&&$('admin-close-target-kind').value==='sorteo')$('admin-close-target-kind').value='persona';
  const area=$('admin-close-area'),currentArea=area.value;
  area.innerHTML='<option value="">Todas las áreas</option>'+(data.areas||[]).map(item=>`<option value="${esc(item.id)}">${esc(item.nombre)}</option>`).join('');
  if((data.areas||[]).some(item=>String(item.id)===currentArea))area.value=currentArea;
  syncAdminCloseTargets();
  const canAssign=!!data.puede_editar&&($('admin-close-date').value||isoLima())>=isoLima();
  $('admin-close-assignment-form').hidden=!data.puede_editar;
  $('admin-close-assign').disabled=!canAssign;
}

let ADMIN_CLOSE_REQUEST=0;
async function loadAdminCloses({quiet=false}={}){
  if(!APP.access.acceso_panel)return;
  const request=++ADMIN_CLOSE_REQUEST,refresh=$('admin-close-assignments-refresh');
  const date=$('admin-close-date').value||isoLima();$('admin-close-date').value=date;
  if(refresh){refresh.disabled=true;refresh.setAttribute('aria-busy','true');refresh.querySelector('span').textContent='Actualizando';}
  adminCloseMsg('');if(!quiet)$('admin-close-status').innerHTML='<p class="admin-empty">Cargando cierres…</p>';
  const [{data,error},{data:reviewData,error:reviewError}]=await Promise.all([
    db.rpc('dash_admin_cierres',{p_fecha:date}),
    APP.access.rol==='direccion'?db.rpc('dash_admin_revision_entregas',{p_fecha:date}):Promise.resolve({data:null,error:null})
  ]);
  if(request!==ADMIN_CLOSE_REQUEST)return;
  if(refresh){refresh.disabled=false;refresh.removeAttribute('aria-busy');refresh.querySelector('span').textContent='Actualizar';}
  if(error||!data?.ok){
    APP.adminClose=null;
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_cierres'));
    adminCloseMsg(missing?'Ejecuta dashboard_19_cierre_jornada.sql para habilitar esta vista.':'No pudimos cargar los cierres. Actualiza e inténtalo nuevamente.','error');
    $('admin-close-status').innerHTML='<p class="admin-empty">La información no está disponible.</p>';return;
  }
  APP.adminClose=data;
  APP.adminReview=APP.access.rol==='direccion'&&!reviewError&&reviewData?.ok?reviewData:{ok:false,entregas:[]};
  hydrateAdminCloseControls();renderAdminCloseAssignments();renderAdminReviewSummary();renderAdminCloseStatus();
}

function adminReviewStateLabel(item){
  if(item.estado==='anulado')return 'Versión reemplazada';
  return item.revision_estado==='aprobada'?'Aprobada':item.revision_estado==='observada'?'Corrección solicitada':'Pendiente de revisión';
}

function adminReviewTitle(item){
  return item.requisito==='salida'?'Evidencia de hora de salida':item.titulo;
}

function adminReviewMessage(text,type=''){
  const element=$('admin-review-message');if(!element)return;
  element.textContent=text||'';element.className='admin-review-message'+(type?' '+type:'');
}

function adminReviewDeliveries(){
  return (APP.adminReview?.entregas||[]).filter(item=>String(item.colaborador_id)===String(ADMIN_REVIEW.personId));
}

function closeAdminReview({restoreFocus=true}={}){
  if(ADMIN_REVIEW.busy)return;
  $('admin-review-modal').hidden=true;document.body.classList.remove('admin-review-open');
  if(restoreFocus&&ADMIN_REVIEW.trigger)ADMIN_REVIEW.trigger.focus();
  ADMIN_REVIEW={personId:null,deliveryId:null,trigger:null,busy:false,request:ADMIN_REVIEW.request+1};
}

async function renderAdminReviewDelivery(id){
  const delivery=adminReviewDeliveries().find(item=>String(item.id)===String(id));if(!delivery)return;
  ADMIN_REVIEW.deliveryId=delivery.id;const request=++ADMIN_REVIEW.request;
  [...$('admin-review-tabs').querySelectorAll('button')].forEach(button=>{const selected=String(button.dataset.adminReviewDelivery)===String(id);button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1});
  $('admin-review-evidence-title').textContent=adminReviewTitle(delivery);
  $('admin-review-evidence-meta').textContent=`${(delivery.archivos||[]).length} ${(delivery.archivos||[]).length===1?'archivo':'archivos'} · ${delivery.modalidad==='collage'?'Collage':delivery.requisito==='comparticiones'?'Capturas individuales':delivery.requisito==='salida'?'Foto de cierre':'Evidencia del día'}`;
  $('admin-review-copy').textContent=`${delivery.area} · ${adminReviewDate(delivery.fecha)} · Enviado ${adminReviewTime(delivery.completado_at)}`;
  const state=$('admin-review-state');state.dataset.state=delivery.revision_estado;state.textContent=adminReviewStateLabel(delivery);
  $('admin-review-submitter-note').textContent=delivery.detalle||'Sin comentario adicional.';
  const origin=$('admin-review-origin');origin.hidden=!delivery.cargada_por_direccion;$('admin-review-origin-copy').textContent=delivery.cargada_por_direccion?`Cargada por ${delivery.cargada_por||'Dirección'} en nombre del colaborador${delivery.salida_reportada_at?` · hora reportada ${adminReviewTime(delivery.salida_reportada_at)}`:''}.`:'';
  const history=$('admin-review-history'),reviewNote=delivery.revision_nota?` Observación: ${delivery.revision_nota}`:'';history.hidden=delivery.revision_estado==='pendiente';history.querySelector('p').textContent=delivery.revision_estado==='observada'?delivery.revision_nota||'Se solicitó una corrección.':`Aprobada${delivery.revisor?` por ${delivery.revisor}`:''}.${reviewNote}`;
  $('admin-review-observation').value='';
  const canDecide=APP.access.rol==='direccion'&&APP.adminReview?.puede_revisar===true,reviewed=delivery.revision_estado!=='pendiente'||delivery.estado!=='completo',closed=!!delivery.jornada_cerrada;
  $('admin-review-modal').querySelector('.admin-review-decision').classList.toggle('is-readonly',!canDecide);
  $('admin-review-observation-wrap').hidden=reviewed||!canDecide;
  $('admin-review-observation').disabled=reviewed||!canDecide;
  $('admin-review-observe').hidden=reviewed||!canDecide;$('admin-review-approve').hidden=reviewed||!canDecide;
  $('admin-review-observe').disabled=closed;
  adminReviewMessage(!canDecide?'Consulta privada de tu área. Solo Dirección puede aprobar o solicitar correcciones.':closed&&!reviewed?'La jornada ya fue cerrada: puedes aprobar y guardar una observación, pero el colaborador ya no puede reemplazar archivos.':'');
  const gallery=$('admin-review-gallery');gallery.innerHTML='<p class="admin-review-loading">Generando vistas privadas…</p>';
  const files=delivery.archivos||[];
  try{
    const signed=await Promise.all(files.map(async file=>{
      const {data,error}=await db.storage.from('asis-cierre-evidencias').createSignedUrl(file.path,900);
      if(error||!data?.signedUrl)throw error||new Error('url');return {...file,url:data.signedUrl};
    }));
    if(request!==ADMIN_REVIEW.request)return;
    gallery.innerHTML=signed.length?signed.map((file,index)=>{const video=String(file.mime||'').startsWith('video/');return `<article class="admin-review-media${video?' is-video':''}">${video?`<video src="${esc(file.url)}" controls preload="metadata" playsinline aria-label="Video de ${esc(adminReviewTitle(delivery))}"></video>`:`<img src="${esc(file.url)}" alt="${esc(adminReviewTitle(delivery))}, imagen ${index+1}" loading="lazy" decoding="async">`}<span>${video?'VIDEO':`${index+1} de ${signed.length}`}</span><a href="${esc(file.url)}" target="_blank" rel="noopener" aria-label="Abrir ${video?'video':'imagen'} en una pestaña nueva"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-7 7M18 13v6H5V6h6"/></svg></a></article>`}).join(''):'<p class="admin-review-loading">Esta entrega no contiene archivos.</p>';
  }catch(error){if(request===ADMIN_REVIEW.request)gallery.innerHTML='<p class="admin-review-error">No pudimos abrir las imágenes privadas. Comprueba que tu sesión y el área asignada sigan vigentes.</p>'}
}

function openAdminReviewPerson(personId,trigger=null){
  const canOpen=APP.access.rol==='direccion'||(APP.identity.isLeader&&APP.adminReview?.solo_lectura===true);if(!canOpen)return;
  const deliveries=(APP.adminReview?.entregas||[]).filter(item=>String(item.colaborador_id)===String(personId));if(!deliveries.length)return;
  const first=deliveries.find(item=>item.revision_estado==='pendiente'&&item.estado==='completo')||deliveries[0],person=deliveries[0];
  ADMIN_REVIEW={personId:Number(personId),deliveryId:first.id,trigger:trigger||document.activeElement,busy:false,request:ADMIN_REVIEW.request+1};
  const readOnly=APP.access.rol!=='direccion';$('admin-review-access').hidden=!readOnly;
  $('admin-review-person-mark').textContent=initials(person.colaborador);$('admin-review-title').textContent=person.colaborador;$('admin-review-copy').textContent=`${person.area} · ${adminReviewDate(person.fecha)}`;
  $('admin-review-tabs').innerHTML=deliveries.map(item=>`<button type="button" role="tab" aria-selected="false" data-admin-review-delivery="${esc(item.id)}" data-state="${esc(item.revision_estado)}"><span>${esc(adminReviewTitle(item))}</span><small>${esc(adminReviewStateLabel(item))}</small></button>`).join('');
  $('admin-review-modal').hidden=false;document.body.classList.add('admin-review-open');
  renderAdminReviewDelivery(first.id);setTimeout(()=>$('admin-review-tabs').querySelector('button.active')?.focus(),0);
}

async function submitAdminReview(state){
  if(APP.access.rol!=='direccion'||APP.adminReview?.puede_revisar!==true)return adminReviewMessage('Esta vista es solo de consulta.','is-error');
  if(ADMIN_REVIEW.busy)return;const delivery=adminReviewDeliveries().find(item=>String(item.id)===String(ADMIN_REVIEW.deliveryId));if(!delivery)return;
  const note=$('admin-review-observation').value.trim();
  if(state==='observada'&&note.length<3)return adminReviewMessage('Explica qué debe corregir antes de enviar la observación.','is-error');
  const approve=$('admin-review-approve'),observe=$('admin-review-observe');ADMIN_REVIEW.busy=true;approve.disabled=true;observe.disabled=true;adminReviewMessage(state==='aprobada'?'Aprobando evidencia…':'Enviando solicitud de corrección…');
  const {data,error}=await db.rpc('dash_admin_revisar_entrega',{p_entrega:Number(delivery.id),p_estado:state,p_nota:note||null});
  ADMIN_REVIEW.busy=false;approve.disabled=false;observe.disabled=false;
  if(error||!data?.ok){
    const messages={nota:'Escribe una observación clara.',jornada_cerrada:'La jornada ya fue cerrada y no puede reabrirse. Solo puedes aprobar.',ya_revisada:'Otra persona ya revisó esta entrega. Actualiza la vista.',sin_permiso:'Solo Dirección puede revisar evidencias.'};
    return adminReviewMessage(messages[data?.motivo]||'No pudimos guardar la revisión. Revisa tu conexión e inténtalo nuevamente.','is-error');
  }
  const personId=ADMIN_REVIEW.personId;closeAdminReview({restoreFocus:false});await loadAdminCloses();toast(state==='aprobada'?'Evidencia aprobada.':'Corrección solicitada al colaborador.');
  const next=(APP.adminReview?.entregas||[]).find(item=>String(item.colaborador_id)===String(personId)&&item.revision_estado==='pendiente'&&item.estado==='completo');
  if(next)openAdminReviewPerson(personId,null);
}

function adminMessageStatus(text,type=''){
  const element=$('admin-message-status');if(!element)return;
  element.textContent=text||'';element.className='admin-message-status'+(type?' '+type:'');
}

function openAdminMessage(personId,trigger=null){
  if(APP.access.rol!=='direccion')return;
  const person=adminEvidencePerson(personId);if(!person)return;
  ADMIN_MESSAGE={personId:Number(person.id),trigger:trigger||document.activeElement,busy:false};
  $('admin-message-person-mark').textContent=initials(person.nombre);
  $('admin-message-recipient').textContent=person.nombre;
  $('admin-message-recipient-area').textContent=person.area||'Equipo KJA';
  $('admin-message-subject').value='';$('admin-message-body').value='';adminMessageStatus('');
  $('admin-message-modal').hidden=false;document.body.classList.add('admin-message-open');
  setTimeout(()=>$('admin-message-body').focus(),0);
}

function closeAdminMessage({restoreFocus=true}={}){
  if(ADMIN_MESSAGE.busy)return;
  $('admin-message-modal').hidden=true;document.body.classList.remove('admin-message-open');
  if(restoreFocus&&ADMIN_MESSAGE.trigger)ADMIN_MESSAGE.trigger.focus();
  ADMIN_MESSAGE={personId:null,trigger:null,busy:false};
}

async function submitAdminMessage(event){
  event.preventDefault();
  if(APP.access.rol!=='direccion'||ADMIN_MESSAGE.busy)return;
  const message=$('admin-message-body').value.trim(),subject=$('admin-message-subject').value.trim();
  if(message.length<3)return adminMessageStatus('Escribe un mensaje de al menos 3 caracteres.','is-error');
  const button=$('admin-message-submit');ADMIN_MESSAGE.busy=true;button.disabled=true;button.querySelector('span').textContent='Enviando…';adminMessageStatus('Enviando el mensaje privado…');
  const {data,error}=await db.rpc('dash_admin_enviar_mensaje',{p_colaborador:Number(ADMIN_MESSAGE.personId),p_mensaje:message,p_asunto:subject||null});
  ADMIN_MESSAGE.busy=false;button.disabled=false;button.querySelector('span').textContent='Enviar mensaje';
  if(error||!data?.ok){
    const missing=error?.code==='PGRST202'||String(error?.message||'').includes('dash_admin_enviar_mensaje');
    const messages={sin_permiso:'Solo Dirección puede enviar mensajes.',datos:'Revisa el contenido del mensaje.',colaborador:'El colaborador ya no está activo.',limite:'Alcanzaste el límite temporal de mensajes. Espera una hora antes de continuar.'};
    return adminMessageStatus(missing?'Falta activar dashboard_41_centro_notificaciones.sql en Supabase.':messages[data?.motivo]||'No pudimos enviar el mensaje. Revisa tu conexión e inténtalo nuevamente.','is-error');
  }
  closeAdminMessage();toast('Mensaje enviado al colaborador.');
}

function adminEvidenceMessage(text,type=''){
  const element=$('admin-evidence-message');if(!element)return;
  element.textContent=text||'';element.className='admin-evidence-message'+(type?' '+type:'');
}

function clearAdminEvidenceFiles(){
  (ADMIN_EVIDENCE.files||[]).forEach(file=>{if(file.url)URL.revokeObjectURL(file.url)});
  ADMIN_EVIDENCE.files=[];if($('admin-evidence-files'))$('admin-evidence-files').value='';
}

function currentAdminEvidenceRequirement(){
  const person=adminEvidencePerson(ADMIN_EVIDENCE.personId);
  return adminEvidenceMissing(person).find(item=>item.kind===ADMIN_EVIDENCE.requirement&&String(item.assignment||'')===String(ADMIN_EVIDENCE.assignment||''));
}

function adminEvidenceMode(){
  return document.querySelector('input[name="admin-evidence-mode"]:checked')?.value||'individuales';
}

function renderAdminEvidenceComposer(){
  const person=adminEvidencePerson(ADMIN_EVIDENCE.personId),items=adminEvidenceMissing(person),selected=currentAdminEvidenceRequirement();
  const selectedKey=selected?`${selected.kind}:${selected.assignment??''}`:'';
  $('admin-evidence-requirement-list').innerHTML=items.map(item=>{const active=`${item.kind}:${item.assignment??''}`===selectedKey;return `<button type="button" aria-pressed="${String(active)}" class="admin-evidence-requirement${active?' active':''}" data-admin-evidence-kind="${esc(item.kind)}" data-admin-evidence-assignment="${esc(item.assignment??'')}" data-kind="${esc(item.kind)}"><i>${adminEvidenceIcon(item.kind)}</i><span><b>${esc(item.title)}</b><small>${item.kind==='comparticiones'?'Facebook':item.kind==='salida'?'Cierre de jornada':item.kind==='asignado'?'Asignación':'Reporte diario'}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`}).join('');
  $('admin-evidence-kind-icon').innerHTML=selected?adminEvidenceIcon(selected.kind):'';
  $('admin-evidence-kind-title').textContent=selected?.title||'Selecciona una evidencia';
  $('admin-evidence-kind-copy').textContent=selected?.copy||'Verás aquí los archivos y datos necesarios.';
  const isFacebook=selected?.kind==='comparticiones',isExit=selected?.kind==='salida',collageInput=document.querySelector('input[name="admin-evidence-mode"][value="collage"]'),collageAllowed=person?.cierre?.collage_permitido!==false;
  collageInput.disabled=!collageAllowed;collageInput.closest('label').hidden=!collageAllowed;if(!collageAllowed&&collageInput.checked)document.querySelector('input[name="admin-evidence-mode"][value="individuales"]').checked=true;
  const mode=adminEvidenceMode();
  $('admin-evidence-format').hidden=!isFacebook;$('admin-evidence-exit-time-wrap').hidden=!isExit;
  $('admin-evidence-files').multiple=!(isExit||(isFacebook&&mode==='collage'));
  const max=isFacebook?(mode==='collage'?1:50):isExit?1:5;
  $('admin-evidence-picker-title').textContent=ADMIN_EVIDENCE.files.length?'Añadir más imágenes':'Seleccionar imágenes';
  $('admin-evidence-picker-copy').textContent=isFacebook&&mode==='individuales'?`De ${Number(person?.cierre?.comparticiones_min||1)} a 50 capturas · se optimizan antes de subir`:max===1?'Una imagen JPG, PNG o WebP':'De 1 a 5 imágenes · se optimizan antes de subir';
  $('admin-evidence-previews').innerHTML=ADMIN_EVIDENCE.files.map((file,index)=>`<article class="admin-evidence-preview"><img src="${esc(file.url)}" alt="Vista previa ${index+1}"><button type="button" data-remove-admin-evidence="${index}" aria-label="Quitar imagen ${index+1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></article>`).join('');
  const submit=$('admin-evidence-submit');submit.disabled=!selected||!ADMIN_EVIDENCE.files.length||ADMIN_EVIDENCE.busy;
}

function selectAdminEvidenceRequirement(kind,assignment=null){
  if(ADMIN_EVIDENCE.busy)return;
  clearAdminEvidenceFiles();ADMIN_EVIDENCE.requirement=kind;ADMIN_EVIDENCE.assignment=assignment?Number(assignment):null;
  document.querySelector('input[name="admin-evidence-mode"][value="individuales"]').checked=true;
  const person=adminEvidencePerson(ADMIN_EVIDENCE.personId);
  $('admin-evidence-exit-time').value='';
  adminEvidenceMessage('');renderAdminEvidenceComposer();
}

function openAdminMissingEvidence(personId,trigger=null){
  if(APP.access.rol!=='direccion')return;
  const person=adminEvidencePerson(personId),items=adminEvidenceMissing(person);if(!person||!items.length)return toast('Esta persona no tiene evidencias pendientes.',true);
  ADMIN_EVIDENCE={personId:Number(personId),requirement:items[0].kind,assignment:items[0].assignment,files:[],trigger:trigger||document.activeElement,busy:false};
  $('admin-evidence-person-mark').textContent=initials(person.nombre);$('admin-evidence-title').textContent=`Cargar evidencia de ${person.nombre}`;$('admin-evidence-copy').textContent=`${person.area} · ${adminReviewDate($('admin-close-date').value)} · carga por Dirección`;
  $('admin-evidence-note').value='Evidencia recibida por interno y registrada por Dirección.';
  document.querySelector('input[name="admin-evidence-mode"][value="individuales"]').checked=true;
  $('admin-evidence-exit-time').value='';
  adminEvidenceMessage('');renderAdminEvidenceComposer();$('admin-evidence-modal').hidden=false;document.body.classList.add('admin-evidence-open');
  requestAnimationFrame(()=>$('admin-evidence-requirement-list').querySelector('button')?.focus({preventScroll:true}));
}

function closeAdminEvidence({restoreFocus=true}={}){
  if(ADMIN_EVIDENCE.busy)return;
  $('admin-evidence-modal').hidden=true;document.body.classList.remove('admin-evidence-open');clearAdminEvidenceFiles();
  if(restoreFocus&&ADMIN_EVIDENCE.trigger)ADMIN_EVIDENCE.trigger.focus({preventScroll:true});
  ADMIN_EVIDENCE={personId:null,requirement:'',assignment:null,files:[],trigger:null,busy:false};
}

async function chooseAdminEvidenceFiles(files){
  const selected=currentAdminEvidenceRequirement();if(!selected||ADMIN_EVIDENCE.busy)return;
  const incoming=[...files],mode=adminEvidenceMode(),max=selected.kind==='comparticiones'?(mode==='collage'?1:50):selected.kind==='salida'?1:5;
  if(ADMIN_EVIDENCE.files.length+incoming.length>max)return adminEvidenceMessage(max===1?'Selecciona una sola imagen para este formato.':`Puedes adjuntar como máximo ${max} imágenes.`,'is-error');
  try{
    adminEvidenceMessage(`Preparando ${incoming.length} ${incoming.length===1?'imagen':'imágenes'}…`,'is-progress');
    for(const file of incoming){
      if(file.size>25*1024*1024)throw Object.assign(new Error('La imagen supera 25 MB.'),{friendly:true});
      const blob=await compressImage(file),url=URL.createObjectURL(blob);ADMIN_EVIDENCE.files.push({blob,url,name:file.name});
    }
    adminEvidenceMessage('');renderAdminEvidenceComposer();
  }catch(error){adminEvidenceMessage(error.friendly?error.message:'No pudimos preparar una de las imágenes. Usa JPG, PNG o WebP.','is-error')}
  finally{$('admin-evidence-files').value=''}
}

async function uploadAdminEvidenceFile(file,selected,person,date){
  const {data:{session}}=await db.auth.getSession();if(!session)throw Object.assign(new Error('sesion'),{motivo:'sesion'});
  const response=await fetch(SUPABASE_URL+'/functions/v1/dash-entrega',{
    method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({accion:'admin_cargar',colaborador:person.id,fecha:date,requisito:selected.kind,asignacion:selected.assignment,modalidad:selected.kind==='comparticiones'?adminEvidenceMode():null,ext:'jpg'})
  });
  const permit=await response.json().catch(()=>null);if(!response.ok||!permit?.ok)throw Object.assign(new Error(permit?.motivo||'permiso'),{motivo:permit?.motivo||'permiso'});
  const {error}=await db.storage.from(DAILY_EVIDENCE_BUCKET).uploadToSignedUrl(permit.ruta,permit.token,file.blob,{contentType:'image/jpeg'});
  if(error)throw Object.assign(new Error('subida'),{motivo:'subida'});return permit.ruta;
}

async function submitAdminEvidence(event){
  event.preventDefault();if(ADMIN_EVIDENCE.busy)return;
  const person=adminEvidencePerson(ADMIN_EVIDENCE.personId),selected=currentAdminEvidenceRequirement(),date=$('admin-close-date').value,files=ADMIN_EVIDENCE.files;
  if(!person||!selected)return adminEvidenceMessage('La evidencia cambió. Cierra esta ventana y vuelve a intentarlo.','is-error');
  const mode=adminEvidenceMode(),min=Number(person.cierre?.comparticiones_min||1),count=files.length;
  if(selected.kind==='comparticiones'&&mode==='individuales'&&count<min)return adminEvidenceMessage(`Adjunta al menos ${min} capturas para completar Comparticiones de Facebook.`,'is-error');
  if(!count)return adminEvidenceMessage('Selecciona al menos una imagen.','is-error');
  const exitTime=$('admin-evidence-exit-time').value;if(selected.kind==='salida'&&!exitTime)return adminEvidenceMessage('Indica la hora que se ve en la foto de salida.','is-error');
  const button=$('admin-evidence-submit'),paths=[];ADMIN_EVIDENCE.busy=true;button.disabled=true;button.querySelector('span').textContent='Preparando carga…';
  try{
    for(let index=0;index<files.length;index++){
      adminEvidenceMessage(`Subiendo ${index+1} de ${files.length}. Mantén esta ventana abierta.`,'is-progress');button.querySelector('span').textContent=`Subiendo ${index+1} de ${files.length}`;
      paths.push(await uploadAdminEvidenceFile(files[index],selected,person,date));
    }
    button.querySelector('span').textContent='Confirmando registro…';adminEvidenceMessage('Los archivos llegaron. Registrando la entrega y su auditoría…','is-progress');
    const note=$('admin-evidence-note').value.trim()||null,isLateExit=selected.kind==='salida';
    const rpc=isLateExit?'dash_admin_confirmar_salida_tardia':'dash_admin_confirmar_entrega';
    const params=isLateExit
      ?{p_colaborador:Number(person.id),p_fecha:date,p_paths:paths,p_detalle:note,p_hora_salida:exitTime}
      :{p_colaborador:Number(person.id),p_fecha:date,p_requisito:selected.kind,p_asignacion:selected.assignment,p_modalidad:selected.kind==='comparticiones'?mode:null,p_paths:paths,p_detalle:note,p_hora_salida:null};
    let {data,error}=await db.rpc(rpc,params);
    if(error||!data?.ok){const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes(rpc));throw Object.assign(new Error(data?.motivo||error?.message||'confirmar'),{motivo:missing&&isLateExit?'migracion_salida':data?.motivo||'confirmar'})}
    if(!isLateExit){
      const {data:regularization,error:regularizationError}=await db.rpc('dash_admin_regularizar_cierre',{p_colaborador:Number(person.id),p_fecha:date});
      if(!regularizationError&&regularization?.ok&&regularization.regularizada)data={...data,cierre_regularizado:true};
    }
    ADMIN_EVIDENCE.busy=false;closeAdminEvidence({restoreFocus:false});await loadAdminCloses();const status=$('admin-close-status');status.setAttribute('tabindex','-1');status.focus({preventScroll:true});toast(data.cierre_regularizado?'Evidencia registrada. La jornada quedó completa.':'Evidencia registrada por Dirección.');
  }catch(error){
    const messages={sin_permiso:'Solo Dirección puede realizar esta carga.',datos:'Revisa la persona, la fecha y la hora de salida.',no_programado:'Este requisito no corresponde al horario de la persona en esa fecha.',asignacion:'La asignación ya no está activa o no corresponde a esta persona.',no_habilitado:'Este tipo de evidencia no estaba habilitado en la fecha seleccionada.',collage_no_permitido:'El formato collage no está habilitado.',permiso:'La autorización privada de carga venció. Vuelve a seleccionar las imágenes.',detalle_salida:'Añade una nota que indique cómo recibiste esta foto de salida.',ya_completo:'La evidencia ya fue registrada desde otra sesión.',ya_cerrada:'La salida de esta jornada ya está registrada.',hora_salida:'Indica la hora visible en la foto.',hora_salida_invalida:'La hora indicada no puede ser anterior a la entrada ni posterior a la hora actual.',sin_entrada:'No existe una entrada para asociar esta evidencia.',migracion_salida:'Ejecuta dashboard_42_entrada_y_salida_tardia.sql en Supabase para habilitar esta regularización.',cantidad_comparticiones:`Adjunta al menos ${min} capturas o un collage.`,archivo_no_verificado:'Una imagen no llegó correctamente. Inténtalo otra vez.',cuota_diaria:'Se alcanzó el límite de cargas pendientes. Espera unos minutos e inténtalo nuevamente.',subida:'No pudimos subir una imagen. Revisa tu conexión.'};
    adminEvidenceMessage(messages[error.motivo]||'No pudimos registrar la evidencia. Actualiza el panel e inténtalo otra vez.','is-error');
  }finally{
    ADMIN_EVIDENCE.busy=false;button.disabled=!ADMIN_EVIDENCE.files.length;button.querySelector('span').textContent='Cargar en nombre del colaborador';
  }
}

async function submitAdminCloseAssignment(event){
  event.preventDefault();const data=APP.adminClose;if(!data?.puede_editar)return;
  const kind=$('admin-close-target-kind').value,target=Number($('admin-close-target').value),title=$('admin-close-title').value.trim();
  if(!target)return adminCloseMsg('Selecciona una persona o un área.','error');
  if(title.length<2)return adminCloseMsg('Escribe un título para el entregable.','error');
  if(kind==='sorteo'){
    const count=Number($('admin-close-draw-count').value),button=$('admin-close-assign');
    if(!Number.isInteger(count)||count<1||count>20)return adminCloseMsg('La cantidad del sorteo debe estar entre 1 y 20.','error');
    button.disabled=true;adminCloseMsg('');
    if(ADMIN_DRAW.key!==adminDrawKey()||!ADMIN_DRAW.selection.length){
      button.textContent='Preparando selección…';
      const {data:preview,error}=await db.rpc('dash_admin_previsualizar_sorteo',{p_fecha:$('admin-close-date').value,p_area:target,p_cantidad:count,p_tipo:$('admin-close-type').value});
      button.disabled=false;
      if(error||!preview?.ok){button.textContent='Previsualizar sorteo';const message=preview?.motivo==='insuficientes'?`Solo hay ${preview.disponibles||0} personas elegibles para ese sorteo.`:preview?.motivo==='sin_permiso'?'Solo Dirección puede realizar sorteos.':'No pudimos preparar el sorteo. Revisa la fecha y el área.';return adminCloseMsg(message,'error')}
      renderAdminDrawPreview(preview);return;
    }
    button.textContent='Creando asignaciones…';
    const {data:result,error}=await db.rpc('dash_admin_confirmar_sorteo',{p_fecha:$('admin-close-date').value,p_area:target,p_colaboradores:ADMIN_DRAW.selection.map(person=>Number(person.id)),p_tipo:$('admin-close-type').value,p_titulo:title,p_instrucciones:$('admin-close-instructions').value.trim()||null});
    button.disabled=false;
    if(error||!result?.ok){clearAdminDrawPreview();return adminCloseMsg(result?.motivo==='ya_asignado'?'Una de las personas ya recibió esta asignación. Previsualiza nuevamente.':'No pudimos confirmar el sorteo. Revisa los datos e inténtalo nuevamente.','error')}
    $('admin-close-title').value='';$('admin-close-instructions').value='';clearAdminDrawPreview();toast(`${result.cantidad} ${result.cantidad===1?'persona seleccionada':'personas seleccionadas'} por rotación justa.`);await loadAdminCloses();return;
  }
  const button=$('admin-close-assign');button.disabled=true;button.textContent='Asignando…';adminCloseMsg('');
  const {data:result,error}=await db.rpc('dash_admin_asignar_entregable',{
    p_fecha:$('admin-close-date').value,p_colaborador:kind==='persona'?target:null,p_area:kind==='area'?target:null,
    p_tipo:$('admin-close-type').value,p_titulo:title,p_instrucciones:$('admin-close-instructions').value.trim()||null
  });
  button.disabled=false;button.textContent='Asignar entregable';
  if(error||!result?.ok)return adminCloseMsg(result?.motivo==='datos'?'Revisa la fecha y los datos de la asignación.':'No pudimos crear la asignación.','error');
  $('admin-close-title').value='';$('admin-close-instructions').value='';toast('Entregable asignado correctamente.');await loadAdminCloses();
}

async function cancelAdminCloseAssignment(id){
  if(!APP.adminClose?.puede_editar||!confirm('¿Cancelar este entregable? Solo es posible si nadie lo completó.'))return;
  const {data,error}=await db.rpc('dash_admin_cancelar_entregable',{p_asignacion:Number(id)});
  if(error||!data?.ok)return adminCloseMsg(data?.motivo==='no_cancelable'?'No puede cancelarse porque ya existe una entrega.':'No pudimos cancelar la asignación.','error');
  toast('Asignación cancelada.');await loadAdminCloses();
}

$('admin-close-date').value=isoLima();
$('admin-close-date').min=addIsoDays(isoLima(),-90);
$('admin-close-date').max=addIsoDays(isoLima(),90);
$('admin-close-date').onchange=()=>{clearAdminDrawPreview();loadAdminCloses()};
$('admin-close-target-kind').onchange=()=>{syncAdminCloseTargets();clearAdminDrawPreview()};
$('admin-close-target').onchange=clearAdminDrawPreview;
$('admin-close-draw-count').oninput=clearAdminDrawPreview;
$('admin-close-type').onchange=clearAdminDrawPreview;
$('admin-close-title').oninput=clearAdminDrawPreview;
$('admin-close-instructions').oninput=clearAdminDrawPreview;
$('admin-close-search').oninput=renderAdminCloseStatus;
$('admin-close-area').onchange=renderAdminCloseStatus;
$('admin-close-assignment-form').onsubmit=submitAdminCloseAssignment;
$('admin-close-assignments-refresh').onclick=()=>loadAdminCloses({quiet:true});
$('admin-close-assignment-list').onclick=event=>{const button=event.target.closest('[data-cancel-admin-close]');if(button)cancelAdminCloseAssignment(button.dataset.cancelAdminClose)};
$('admin-close-status').onclick=event=>{const review=event.target.closest('[data-admin-review-person]'),upload=event.target.closest('[data-admin-upload-person]'),message=event.target.closest('[data-admin-message-person]');if(review)openAdminReviewPerson(review.dataset.adminReviewPerson,review);if(upload)openAdminMissingEvidence(upload.dataset.adminUploadPerson,upload);if(message)openAdminMessage(message.dataset.adminMessagePerson,message)};
$('admin-review-tabs').onclick=event=>{const button=event.target.closest('[data-admin-review-delivery]');if(button)renderAdminReviewDelivery(button.dataset.adminReviewDelivery)};
$('admin-review-approve').onclick=()=>submitAdminReview('aprobada');
$('admin-review-observe').onclick=()=>submitAdminReview('observada');
document.querySelectorAll('[data-close-admin-review]').forEach(button=>button.onclick=()=>closeAdminReview());
$('admin-message-form').onsubmit=submitAdminMessage;
document.querySelectorAll('[data-close-admin-message]').forEach(button=>button.onclick=()=>closeAdminMessage());
$('admin-evidence-requirement-list').onclick=event=>{const button=event.target.closest('[data-admin-evidence-kind]');if(button)selectAdminEvidenceRequirement(button.dataset.adminEvidenceKind,button.dataset.adminEvidenceAssignment||null)};
$('admin-evidence-files').onchange=event=>chooseAdminEvidenceFiles(event.target.files||[]);
$('admin-evidence-picker').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('admin-evidence-files').click()}};
$('admin-evidence-previews').onclick=event=>{const button=event.target.closest('[data-remove-admin-evidence]');if(!button||ADMIN_EVIDENCE.busy)return;const index=Number(button.dataset.removeAdminEvidence),file=ADMIN_EVIDENCE.files[index];if(file?.url)URL.revokeObjectURL(file.url);ADMIN_EVIDENCE.files.splice(index,1);renderAdminEvidenceComposer()};
document.querySelectorAll('input[name="admin-evidence-mode"]').forEach(input=>input.onchange=()=>{clearAdminEvidenceFiles();adminEvidenceMessage('Selecciona las imágenes correspondientes al nuevo formato.');renderAdminEvidenceComposer()});
$('admin-evidence-form').onsubmit=submitAdminEvidence;
setInterval(()=>{if(APP.adminSection==='cierres'&&!document.hidden&&$('admin-review-modal').hidden&&$('admin-evidence-modal').hidden)void loadAdminCloses({quiet:true})},30000);
document.querySelectorAll('[data-close-admin-evidence]').forEach(button=>button.onclick=()=>closeAdminEvidence());
$('admin-review-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeAdminReview();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('admin-review-modal').querySelectorAll('button:not(:disabled):not([hidden]),a[href],textarea:not(:disabled):not([hidden])')].filter(element=>element.offsetParent!==null);if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
$('admin-message-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeAdminMessage();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('admin-message-modal').querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled),textarea:not(:disabled)')].filter(element=>element.offsetParent!==null);if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
$('admin-evidence-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeAdminEvidence();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('admin-evidence-modal').querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled):not([hidden]),textarea:not(:disabled):not([hidden]),label[for]')].filter(element=>element.offsetParent!==null);if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
