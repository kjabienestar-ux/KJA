/* KJA · Administración de cierres y entregables diarios. */

let ADMIN_REVIEW={personId:null,deliveryId:null,trigger:null,busy:false,request:0};
let ADMIN_DRAW={key:'',selection:[]};

function adminCloseMsg(text,type=''){
  const el=$('admin-close-message');if(!el)return;
  el.textContent=text||'';el.className='admin-list-message'+(text?' show':'')+(type?' '+type:'');
}

function adminCloseStateLabel(state){
  return CLOSE_MODEL.stateLabel(state);
}

function adminCloseTime(value){
  return value?new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'}).format(new Date(value)):'—';
}

function adminReviewDate(value){
  if(!value)return 'Fecha no disponible';
  const parsed=new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())?'Fecha no disponible':new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Lima'}).format(parsed);
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
  $('admin-close-assignment-count').textContent=rows.length?`${rows.length} ${rows.length===1?'asignación':'asignaciones'}`:'Sin asignaciones';
  $('admin-close-assignment-list').innerHTML=rows.length?rows.map(item=>`<div class="admin-close-assignment-row">
    <span><small>${esc((item.tipo||'otro').toUpperCase())}</small><b>${esc(item.titulo)}</b><em>${esc(item.destino||'Destino no disponible')}</em></span>
    ${data.puede_editar?`<button type="button" data-cancel-admin-close="${esc(item.id)}">Cancelar</button>`:''}
  </div>`).join(''):'<p class="admin-empty">No hay entregables asignados para esta fecha.</p>';
}

function renderAdminCloseStatus(){
  const data=APP.adminClose;if(!data)return;
  const reviews=APP.adminReview?.entregas||[],canReview=APP.access.rol==='direccion';
  const area=$('admin-close-area').value,people=(data.personas||[]).filter(person=>!area||String(person.area_id)===area);
  const groups=new Map();
  people.forEach(person=>{if(!groups.has(String(person.area_id)))groups.set(String(person.area_id),{name:person.area,items:[]});groups.get(String(person.area_id)).items.push(person)});
  let html='';
  for(const group of groups.values()){
    const complete=group.items.filter(person=>['completa','regularizada'].includes(person.cierre?.estado)).length;
    html+=`<section class="admin-close-area"><header><span><b>${esc(group.name)}</b><small>${complete} de ${group.items.length} jornadas completas</small></span></header><div class="admin-close-table"><div class="admin-close-table-head"><span>Colaborador</span><span>Entrada</span><span>Evidencias</span><span>Salida</span><span>Jornada</span></div>`;
    for(const person of group.items){
      const close=person.cierre||{},globalDone=(close.requisitos||[]).filter(item=>item.completo).length,globalTotal=(close.requisitos||[]).length,assignedDone=(close.asignaciones||[]).filter(item=>item.completo).length,assignedTotal=(close.asignaciones||[]).length;
      const evidence=`${globalDone+assignedDone}/${globalTotal+assignedTotal}`;
      const personReviews=reviews.filter(item=>String(item.colaborador_id)===String(person.id)),pending=personReviews.filter(item=>item.revision_estado==='pendiente'&&item.estado==='completo').length;
      const reviewAction=canReview&&personReviews.length?`<button type="button" class="admin-close-review-trigger ${pending?'has-pending':''}" data-admin-review-person="${esc(person.id)}">${pending?`${pending} por revisar`:'Ver evidencias'}</button>`:'';
      html+=`<div class="admin-close-person"><span data-label="Colaborador"><b>${esc(person.nombre)}</b><small>${person.labora?'Jornada programada':'No labora'}</small></span><span data-label="Entrada">${esc(adminCloseTime(close.entrada_at))}</span><span data-label="Evidencias" class="admin-close-evidence-cell"><b>${esc(evidence)}</b>${reviewAction}</span><span data-label="Salida">${esc(adminCloseTime(close.salida_at))}</span><span data-label="Jornada" class="admin-close-status-pill ${esc(close.estado||'pendiente')}">${esc(adminCloseStateLabel(close.estado))}</span></div>`;
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

async function loadAdminCloses(){
  if(!APP.access.acceso_panel)return;
  const date=$('admin-close-date').value||isoLima();$('admin-close-date').value=date;
  adminCloseMsg('');$('admin-close-status').innerHTML='<p class="admin-empty">Cargando cierres…</p>';
  const [{data,error},{data:reviewData,error:reviewError}]=await Promise.all([
    db.rpc('dash_admin_cierres',{p_fecha:date}),
    APP.access.rol==='direccion'?db.rpc('dash_admin_revision_entregas',{p_fecha:date}):Promise.resolve({data:null,error:null})
  ]);
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
  const state=$('admin-review-state');state.dataset.state=delivery.revision_estado;state.textContent=adminReviewStateLabel(delivery);
  $('admin-review-submitter-note').textContent=delivery.detalle||'Sin comentario adicional.';
  const history=$('admin-review-history');history.hidden=delivery.revision_estado==='pendiente';history.querySelector('p').textContent=delivery.revision_estado==='observada'?delivery.revision_nota||'Se solicitó una corrección.':`Aprobada${delivery.revisor?` por ${delivery.revisor}`:''}.`;
  $('admin-review-observation').value='';
  const canDecide=APP.access.rol==='direccion'&&APP.adminReview?.puede_revisar===true,reviewed=delivery.revision_estado!=='pendiente'||delivery.estado!=='completo',closed=!!delivery.jornada_cerrada;
  $('admin-review-modal').querySelector('.admin-review-decision').classList.toggle('is-readonly',!canDecide);
  $('admin-review-observation-wrap').hidden=reviewed||!canDecide;
  $('admin-review-observation').disabled=reviewed||closed||!canDecide;
  $('admin-review-observe').hidden=reviewed||!canDecide;$('admin-review-approve').hidden=reviewed||!canDecide;
  $('admin-review-observe').disabled=closed;
  adminReviewMessage(!canDecide?'Consulta privada de tu área. Solo Dirección puede aprobar o solicitar correcciones.':closed&&!reviewed?'La jornada ya fue cerrada: puedes aprobar la evidencia, pero no solicitar una corrección.':'');
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
  const {data,error}=await db.rpc('dash_admin_revisar_entrega',{p_entrega:Number(delivery.id),p_estado:state,p_nota:state==='observada'?note:null});
  ADMIN_REVIEW.busy=false;approve.disabled=false;observe.disabled=false;
  if(error||!data?.ok){
    const messages={nota:'Escribe una observación clara.',jornada_cerrada:'La jornada ya fue cerrada y no puede reabrirse. Solo puedes aprobar.',ya_revisada:'Otra persona ya revisó esta entrega. Actualiza la vista.',sin_permiso:'Solo Dirección puede revisar evidencias.'};
    return adminReviewMessage(messages[data?.motivo]||'No pudimos guardar la revisión. Revisa tu conexión e inténtalo nuevamente.','is-error');
  }
  const personId=ADMIN_REVIEW.personId;closeAdminReview({restoreFocus:false});await loadAdminCloses();toast(state==='aprobada'?'Evidencia aprobada.':'Corrección solicitada al colaborador.');
  const next=(APP.adminReview?.entregas||[]).find(item=>String(item.colaborador_id)===String(personId)&&item.revision_estado==='pendiente'&&item.estado==='completo');
  if(next)openAdminReviewPerson(personId,null);
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
$('admin-close-area').onchange=renderAdminCloseStatus;
$('admin-close-assignment-form').onsubmit=submitAdminCloseAssignment;
$('admin-close-assignment-list').onclick=event=>{const button=event.target.closest('[data-cancel-admin-close]');if(button)cancelAdminCloseAssignment(button.dataset.cancelAdminClose)};
$('admin-close-status').onclick=event=>{const button=event.target.closest('[data-admin-review-person]');if(button)openAdminReviewPerson(button.dataset.adminReviewPerson,button)};
$('admin-review-tabs').onclick=event=>{const button=event.target.closest('[data-admin-review-delivery]');if(button)renderAdminReviewDelivery(button.dataset.adminReviewDelivery)};
$('admin-review-approve').onclick=()=>submitAdminReview('aprobada');
$('admin-review-observe').onclick=()=>submitAdminReview('observada');
document.querySelectorAll('[data-close-admin-review]').forEach(button=>button.onclick=()=>closeAdminReview());
$('admin-review-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeAdminReview();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('admin-review-modal').querySelectorAll('button:not(:disabled):not([hidden]),a[href],textarea:not(:disabled):not([hidden])')].filter(element=>element.offsetParent!==null);if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
