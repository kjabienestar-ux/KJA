/* KJA · Bandeja de seguimiento diario para Dirección. */
let ADMIN_CONTROL_QUEUE='attention';
let ADMIN_CONTROL_EXPANDED=null;
let ADMIN_CONTROL_CHART='';
let ADMIN_CONTROL_AREA_SIGNATURE='';

function adminControlMessage(text,type=''){
  const el=$('admin-control-message');
  el.textContent=text||'';el.className='admin-list-message'+(text?' show':'')+(type?' '+type:'');
}
function adminControlTime(value){
  return value?new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'}).format(new Date(value)):'—';
}
function adminControlText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
}
function adminControlWork(row){
  return row.entrada_estado!=='J'&&!row.cierre?.justificado&&row.cierre_estado!=='justificado'
    &&(row.cierre?.aplica_jornada??(row.labora&&row.cierre_estado!=='no_aplica'));
}
function adminControlTasks(row){
  if(!row.cierre)return null;
  const labels={rpe:'RPE',salida:'Evidencia de salida',comparticiones:'Facebook'};
  return [...(row.cierre.requisitos||[]).filter(item=>
    !(item.tipo==='rpe'&&(row.cierre.requiere_rpe===false||row.cierre.rpe_exento_presencial))
    &&(adminControlWork(row)||item.tipo==='comparticiones')),
    ...(adminControlWork(row)?row.cierre.asignaciones||[]:[]).filter(item=>item.estado!=='cancelada')]
    .map(item=>({...item,label:item.titulo||labels[item.tipo]||'Entregable asignado'}));
}
function adminControlPending(row){
  const tasks=adminControlTasks(row);
  return tasks?tasks.filter(item=>!item.completo).length:adminControlWork(row)?Number(row.evidencias_pendientes||0):0;
}
function adminControlState(row){
  if(row.entrada_estado==='J'||row.cierre?.justificado||row.cierre_estado==='justificado')return {key:'justificado',label:'Justificada',tone:'neutral'};
  if(!adminControlWork(row))return {key:'no_aplica',label:'No labora',tone:'neutral'};
  if(row.cierre_estado==='incompleta')return {key:'incompleta',label:'Incompleta',tone:'danger'};
  if(row.cierre_estado==='sin_entrada')return {key:'sin_entrada',label:'Sin entrada',tone:'danger'};
  if(Number(row.revision_observada)>0)return {key:'observada',label:'Con correcciones',tone:'danger'};
  if((row.impedimentos||[]).length)return {key:'impedimento',label:'Con impedimento',tone:'info'};
  if(['completa','regularizada'].includes(row.cierre_estado))return {key:'completa',label:'Completa',tone:'success'};
  if(adminControlPending(row)>0)return {key:'evidencias',label:'En seguimiento',tone:'warning'};
  if(row.entrada_at&&!row.salida_at&&row.cierre?.requiere_salida!==false)return {key:'sin_salida',label:row.cierre_estado==='lista_para_salir'?'Lista para salir':'En curso',tone:'warning'};
  return {key:'neutral',label:'Sin novedad',tone:'neutral'};
}
function adminControlNeedsAttention(row){
  return Number(row.revision_observada)>0||Number(row.revision_pendiente)>0
    ||(row.impedimentos||[]).length>0||adminControlPending(row)>0
    ||(adminControlWork(row)&&['sin_entrada','incompleta','sin_salida'].includes(adminControlState(row).key));
}
function adminControlMatchesQueue(row,queue=ADMIN_CONTROL_QUEUE){
  if(queue==='attention')return adminControlNeedsAttention(row);
  if(queue==='review')return Number(row.revision_pendiente)>0;
  if(queue==='done')return ['completa','justificado'].includes(adminControlState(row).key);
  return true;
}
function adminControlBaseRows(){
  const query=adminControlText($('admin-control-search').value.trim()),area=$('admin-control-area').value;
  return (APP.adminControl?.filas||[]).filter(row=>(!area||(area==='__none'?row.area_id==null:String(row.area_id)===area))
    &&(!query||adminControlText(row.colaborador+' '+row.area).includes(query)));
}
function adminControlPriority(row){
  if(Number(row.revision_observada)>0)return 0;
  if((row.impedimentos||[]).length)return 1;
  if(Number(row.revision_pendiente)>0)return 2;
  if(adminControlState(row).key==='incompleta')return 3;
  if(adminControlState(row).key==='sin_entrada')return 4;
  if(adminControlNeedsAttention(row))return 5;
  if(adminControlState(row).key==='completa')return 6;
  return 7;
}
function adminControlRows(){
  const state=$('admin-control-state').value,sort=$('admin-control-sort').value;
  return adminControlBaseRows().filter(row=>{
    if(!adminControlMatchesQueue(row))return false;
    if(ADMIN_CONTROL_CHART&&adminControlAreaBucket(row)!==ADMIN_CONTROL_CHART)return false;
    if(!state)return true;
    if(state==='revision')return Number(row.revision_pendiente)>0;
    if(state==='observada')return Number(row.revision_observada)>0;
    if(state==='impedimento')return (row.impedimentos||[]).length>0;
    if(state==='evidencias')return adminControlPending(row)>0;
    if(state==='sin_salida')return !!row.entrada_at&&!row.salida_at&&adminControlWork(row)&&row.cierre?.requiere_salida!==false;
    return adminControlState(row).key===state;
  }).sort((a,b)=>{
    const first=sort==='priority'?adminControlPriority(a)-adminControlPriority(b):sort==='area'?String(a.area||'').localeCompare(String(b.area||''),'es'):0;
    return first||String(a.colaborador).localeCompare(String(b.colaborador),'es');
  });
}
function adminControlPendingDetail(row){
  const parts=[],tasks=adminControlTasks(row);
  if(adminControlWork(row)&&!row.entrada_at)parts.push('Entrada sin registrar');
  if(tasks)parts.push(...tasks.filter(item=>!item.completo).map(item=>item.label));
  else if(adminControlPending(row))parts.push(adminControlPending(row)+' evidencias pendientes');
  if(adminControlWork(row)&&row.entrada_at&&!row.salida_at&&row.cierre?.requiere_salida!==false)parts.push('Salida sin registrar');
  return [...new Set(parts)].join(' · ');
}
function adminControlMissingDetail(row){
  if(adminControlState(row).key!=='incompleta')return '';
  const close={...row.cierre,estado:'incompleta',entrada_at:row.entrada_at,salida_at:row.salida_at};
  const reasons=CLOSE_MODEL.incompleteReasons(null,close);
  if(!row.cierre&&Number(row.evidencias_pendientes)>0)reasons.push('Detalle de evidencias no disponible; consulta Ver cierre');
  return reasons.length?'Faltó: '+reasons.join('; '):'No se dispone del detalle del cierre. Consulta Ver cierre.';
}
function adminControlNextStep(row){
  const observed=Number(row.revision_observada||0),reviews=Number(row.revision_pendiente||0),issues=row.impedimentos||[];
  if(observed)return {title:observed+' '+(observed===1?'evidencia con corrección':'evidencias con corrección'),copy:'Comprueba las observaciones y la nueva entrega.'};
  if(issues.length)return {title:'Impedimento informado',copy:issues[0].detalle||'Consulta el aviso antes de gestionar la jornada.'};
  if(reviews)return {title:reviews+' '+(reviews===1?'entrega por revisar':'entregas por revisar'),copy:'Abre los archivos para aprobar u observar.'};
  const detail=adminControlPendingDetail(row);
  if(detail)return {title:detail,copy:adminControlTasks(row)?'Consulta los requisitos y el registro de esta fecha.':'El detalle no está disponible. Abre el caso para comprobarlo.'};
  const state=adminControlState(row);
  if(state.key==='justificado')return {title:'Jornada justificada',copy:'No se exige entrada, RPE ni salida.'};
  if(state.key==='no_aplica')return {title:'Sin jornada programada',copy:'No requiere entrada ni salida.'};
  if(state.key==='completa')return {title:'Jornada completa',copy:'Sin pendientes de jornada registrados.'};
  return {title:'Sin pendientes identificados',copy:'Abre el caso para consultar el estado completo.'};
}
function adminControlDetail(row){
  const tasks=adminControlTasks(row),issues=row.impedimentos||[];
  let content='<div class="control-detail-column"><h3>Requisitos de esta fecha</h3>';
  content+=tasks?.length?'<ul>'+tasks.map(item=>'<li><span class="control-task-dot '+(item.completo?'done':'pending')+'" aria-hidden="true"></span><span>'+esc(item.label)+'</span><b>'+(item.completo?'Registrado':item.bloqueado?'Pendiente · fuera de ventana':'Pendiente')+'</b></li>').join('')+'</ul>':'<p>'+(tasks?'No hay evidencias exigibles para esta jornada.':'No se pudo consultar el detalle de requisitos. Abre el caso o actualiza la vista.')+'</p>';
  content+='</div><div class="control-detail-column"><h3>Seguimiento</h3>';
  content+=issues.length?issues.map(item=>'<p class="control-issue"><b>Aviso del colaborador</b>'+esc(item.detalle||'Sin detalle')+'</p>').join(''):'<p>'+(row.impedimentos_disponibles===false?'No se pudieron consultar los impedimentos. Actualiza para comprobarlos.':'No hay impedimentos informados.')+'</p>';
  content+='<p>Horas válidas: <strong>'+Number(row.horas_validas||0).toFixed(2)+' h</strong></p>';
  if(row.cierre?.rpe_exento_presencial)content+='<p>RPE no requerido por modalidad presencial.</p>';
  content+='<p class="control-detail-note">Una evidencia registrada aún puede estar pendiente de aprobación.</p></div>';
  return content;
}

const CONTROL_AREA_STATES=[['pending','Pendientes'],['review','Por revisar'],['done','Concluidas'],['clear','Sin pendientes']];
function adminControlAreaBucket(row){
  if(Number(row.revision_pendiente)>0)return 'review';
  if(adminControlNeedsAttention(row))return 'pending';
  if(['completa','justificado'].includes(adminControlState(row).key))return 'done';
  return 'clear';
}
function adminControlAreaGroups(){
  const groups=new Map();
  for(const row of APP.adminControl?.filas||[]){
    const id=String(row.area_id??'__none');
    if(!groups.has(id))groups.set(id,{id,name:row.area||'Sin área',total:0,pending:0,review:0,done:0,clear:0});
    const group=groups.get(id);group.total++;group[adminControlAreaBucket(row)]++;
  }
  return [...groups.values()].sort((a,b)=>(b.pending+b.review)-(a.pending+a.review)||a.name.localeCompare(b.name,'es'));
}
function renderAdminControlAreas(){
  const host=$('admin-control-areas');if(!host)return;
  if(APP.adminControl?.partial){host.innerHTML='<p class="control-area-empty">Resumen por área no disponible: faltan datos por comprobar. Actualiza para ver la distribución completa.</p>';$('admin-control-chart-selection').textContent='Datos parciales';$('admin-control-chart-reset').hidden=true;return;}
  const groups=adminControlAreaGroups(),selected=$('admin-control-area').value;
  const signature=JSON.stringify([APP.adminControl.fecha,groups]);
  const animate=signature!==ADMIN_CONTROL_AREA_SIGNATURE;
  ADMIN_CONTROL_AREA_SIGNATURE=signature;
  host.innerHTML=groups.length?groups.map(group=>'<div class="control-area-row'+(animate?' is-arriving':'')+(selected===group.id?' is-selected':'')+'"><button type="button" class="control-area-name" data-control-chart-area="'+esc(group.id)+'" aria-pressed="'+(selected===group.id)+'">'+esc(group.name)+'<small>'+group.total+' personas</small></button><div class="control-area-bar" role="group" aria-label="'+esc(group.name)+'">'+CONTROL_AREA_STATES.filter(([key])=>group[key]).map(([key,label])=>'<button type="button" class="control-area-segment '+key+'" style="flex-grow:'+group[key]+'" data-control-chart-area="'+esc(group.id)+'" data-control-chart-state="'+key+'" aria-pressed="'+(selected===group.id&&ADMIN_CONTROL_CHART===key)+'" aria-label="'+esc(group.name)+': '+group[key]+' '+label.toLowerCase()+' de '+group.total+' personas" title="'+group[key]+' '+label.toLowerCase()+' · '+Math.round(group[key]*100/group.total)+'%"><span>'+group[key]+'</span></button>').join('')+'</div><span class="control-area-count" title="Personas con pendientes o entregas por revisar">'+(group.pending+group.review)+'<small>por atender</small></span></div>').join(''):'<p class="control-area-empty">No hay áreas registradas para esta fecha.</p>';
  const active=CONTROL_AREA_STATES.find(([key])=>key===ADMIN_CONTROL_CHART);
  $('admin-control-chart-reset').hidden=!selected&&!active;
  $('admin-control-chart-selection').textContent=active?'Filtro: '+active[1]:'Pulsa una barra para ver sus personas';
}
function selectAdminControlArea(area,state=''){
  $('admin-control-search').value='';$('admin-control-state').value='';$('admin-control-area').value=area;
  ADMIN_CONTROL_CHART=state;ADMIN_CONTROL_QUEUE='all';ADMIN_CONTROL_EXPANDED=null;renderAdminControl();
  $('admin-control-result-count').setAttribute('tabindex','-1');$('admin-control-result-count').focus({preventScroll:true});
}

function renderAdminControl(){
  if(!APP.adminControl?.ok)return;
  renderAdminControlAreas();
  const base=adminControlBaseRows(),rows=adminControlRows();
  const queues=[['attention','Por atender'],['review','Por revisar'],['done','Concluidas'],['all','Todo el equipo']];
  $('admin-control-kpis').innerHTML=queues.map(([key,label])=>'<button type="button" data-control-queue="'+key+'" aria-pressed="'+(ADMIN_CONTROL_QUEUE===key)+'">'+label+'<span>'+base.filter(row=>adminControlMatchesQueue(row,key)).length+'</span></button>').join('');
  const scheduled=base.filter(adminControlWork).length,hours=base.reduce((sum,row)=>sum+Number(row.horas_validas||0),0);
  $('admin-control-summary').textContent=scheduled+' jornadas programadas · '+hours.toFixed(1)+' h válidas';
  $('admin-control-result-count').textContent=rows.length+' de '+base.length+' personas'+(ADMIN_CONTROL_QUEUE==='attention'?' requieren seguimiento':'');
  $('admin-control-clear').hidden=!($('admin-control-search').value||$('admin-control-area').value||$('admin-control-state').value);
  $('admin-control-export').disabled=!rows.length||!!APP.adminControlLoading;
  let html='';
  for(const row of rows){
    const state=adminControlState(row),step=adminControlNextStep(row),id=String(row.colaborador_id),expanded=ADMIN_CONTROL_EXPANDED===id;
    const review=Number(row.revision_pendiente)>0;
    html+='<article class="control-case" data-person="'+esc(id)+'"><div class="control-case-row">'+
      '<div class="control-person"><span class="control-avatar" aria-hidden="true">'+esc(initials(row.colaborador))+'</span><div><h3>'+esc(row.colaborador)+'</h3><p>'+esc(row.area||'Sin área')+(row.cierre?.modalidad?' · '+esc(cap(row.cierre.modalidad)):'')+'</p></div></div>'+
      '<div class="control-status"><span class="control-status-label '+state.tone+'"><i aria-hidden="true"></i>'+esc(state.label)+'</span></div>'+
      '<div class="control-next-step"><b>'+esc(step.title)+'</b><p>'+esc(step.copy)+'</p></div>'+
      '<div class="control-times"><span><small>Entrada</small><b>'+esc(adminControlTime(row.entrada_at))+'</b></span><span><small>Salida</small><b>'+esc(adminControlTime(row.salida_at))+'</b></span></div>'+
      '<div class="control-row-actions"><button type="button" class="control-primary" data-control-open-close="'+esc(id)+'" data-area="'+esc(row.area_id||'')+'" data-action="'+(review?'review':'case')+'" aria-label="'+(review?'Revisar evidencias de ':'Abrir caso de ')+esc(row.colaborador)+'">'+(review?'Revisar':'Abrir caso')+'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>'+
      '<button type="button" class="control-detail-toggle" data-control-detail="'+esc(id)+'" aria-expanded="'+expanded+'" aria-controls="control-detail-'+esc(id)+'">'+(expanded?'Ocultar detalle':'Ver detalle')+'</button></div></div>'+
      '<div class="control-detail" id="control-detail-'+esc(id)+'" '+(expanded?'':'hidden')+'>'+ (expanded?adminControlDetail(row):'')+'</div></article>';
  }
  $('admin-control-table').innerHTML=rows.length?html:'<div class="control-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg><h3>'+(base.length&&ADMIN_CONTROL_QUEUE==='attention'&&!$('admin-control-state').value?'No hay pendientes por atender':'No hay personas en esta vista')+'</h3><p>Consulta todo el equipo o cambia los filtros para continuar.</p><button type="button" data-control-clear>Ver todo el equipo</button></div>';
}
function fillAdminControlAreas(){
  const select=$('admin-control-area'),current=select.value,areas=APP.adminControl?.areas||[];
  select.innerHTML='<option value="">Todas las áreas</option>'+areas.map(area=>'<option value="'+esc(area.id)+'">'+esc(area.nombre)+'</option>').join('');
  if((APP.adminControl?.filas||[]).some(row=>row.area_id==null))select.innerHTML+='<option value="__none">Sin área</option>';
  if(current==='__none'||areas.some(area=>String(area.id)===current))select.value=current;
}
function adminControlDateButtons(){
  const date=$('admin-control-date');
  $('admin-control-prev').disabled=date.value<=date.min;
  $('admin-control-next').disabled=date.value>=isoLima();
}
async function loadAdminControl(){
  if(APP.access.rol!=='direccion')return;
  const date=$('admin-control-date').value||isoLima(),request=++APP.adminControlRequest;
  $('admin-control-date').value=date;adminControlDateButtons();
  APP.adminControlLoading=true;APP.adminControl=null;ADMIN_CONTROL_EXPANDED=null;
  $('admin-control-export').disabled=true;
  $('admin-control-kpis').innerHTML='';$('admin-control-result-count').textContent='Consultando…';
  $('admin-control-summary').textContent='Consultando la jornada…';
  $('admin-control-areas').innerHTML='<p class="control-area-empty">Consultando las áreas…</p>';
  $('admin-control-chart-selection').textContent='';
  adminControlMessage('');$('admin-control-table').setAttribute('aria-busy','true');
  $('admin-control-table').innerHTML='<div class="admin-control-loading"><i aria-hidden="true"></i><span>Comprobando entradas, evidencias y cierres…</span></div>';
  try{
    const [{data,error},{data:issueData,error:issueError},{data:closeData,error:closeError}]=await Promise.all([
      db.rpc('dash_admin_control_diario',{p_fecha:date}),db.rpc('dash_supervision_impedimentos',{p_fecha:date}),db.rpc('dash_admin_cierres',{p_fecha:date})
    ]);
    if(request!==APP.adminControlRequest)return;
    if(error||!data?.ok)throw new Error('control_unavailable');
    const byIssue=new Map();
    if(!issueError&&issueData?.ok)(issueData.impedimentos||[]).forEach(item=>{const key=String(item.colaborador_id);if(!byIssue.has(key))byIssue.set(key,[]);byIssue.get(key).push(item)});
    const byClose=new Map((!closeError&&closeData?.ok?closeData.personas||[]:[]).map(person=>[String(person.id),person.cierre]));
    data.filas=(data.filas||[]).map(row=>{
      const cierre=byClose.get(String(row.colaborador_id))||null;
      return {...row,cierre,cierre_estado:cierre?.estado||row.cierre_estado,impedimentos_disponibles:!issueError&&!!issueData?.ok,impedimentos:byIssue.get(String(row.colaborador_id))||[]};
    });
    data.partial=!!(issueError||!issueData?.ok||closeError||!closeData?.ok);
    if(data.partial){ADMIN_CONTROL_CHART='';ADMIN_CONTROL_QUEUE='all';$('admin-control-state').value='';}
    APP.adminControl=data;APP.adminControlLoading=false;fillAdminControlAreas();renderAdminControl();
    if(issueError||!issueData?.ok||closeError||!closeData?.ok)adminControlMessage('Vista parcial: no pudimos comprobar todos los avisos o requisitos. Actualiza antes de tomar una decisión.','error');
  }catch(error){
    if(request!==APP.adminControlRequest)return;
    APP.adminControl=null;
    $('admin-control-areas').innerHTML='<p class="control-area-empty">No se pudieron consultar las áreas.</p>';
    adminControlMessage('No pudimos cargar el control diario. Comprueba tu conexión y vuelve a intentarlo.','error');
    $('admin-control-summary').textContent='Datos no disponibles';$('admin-control-result-count').textContent='Sin datos';
    $('admin-control-table').innerHTML='<div class="control-empty"><h3>No se pudo consultar esta fecha</h3><p>Tus registros se conservan. Intenta cargar la vista nuevamente.</p><button type="button" data-control-retry>Reintentar</button></div>';
  }finally{
    if(request===APP.adminControlRequest){APP.adminControlLoading=false;$('admin-control-table').setAttribute('aria-busy','false');}
  }
}
function exportAdminControl(){
  if(APP.adminControlLoading||!APP.adminControl?.ok)return;
  const rows=adminControlRows();if(!rows.length)return toast('No hay filas para exportar.',true);
  const csvRows=[['Fecha','Colaborador','Área','Programado','Entrada','Estado entrada','Evidencias pendientes','Impedimento informado','Detalle del impedimento','Por revisar','Observadas','Salida','Horas válidas','Estado jornada','Siguiente paso'],
    ...rows.map(row=>[APP.adminControl.fecha||$('admin-control-date').value,row.colaborador,row.area,row.labora?'Sí':'No',adminControlTime(row.entrada_at),row.entrada_estado||'',adminControlPending(row),(row.impedimentos||[]).length?'Sí':'No',(row.impedimentos||[]).map(item=>item.detalle).join(' | '),row.revision_pendiente||0,row.revision_observada||0,adminControlTime(row.salida_at),Number(row.horas_validas||0).toFixed(2),adminControlState(row).label,adminControlNextStep(row).title])];
  // Spreadsheet programs must not evaluate collaborator text as a formula.
  const quote=value=>'"'+String(value??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
  const blob=new Blob(['\ufeff'+csvRows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='control-diario-'+$('admin-control-date').value+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);toast('Reporte CSV preparado.');
}
async function openControlClose(button){
  if(APP.adminControlLoading||APP.access.rol!=='direccion'||button.disabled)return;
  const row=(APP.adminControl?.filas||[]).find(item=>String(item.colaborador_id)===button.dataset.controlOpenClose);
  if(!row)return;
  button.disabled=true;
  const date=APP.adminControl.fecha||$('admin-control-date').value;
  try{
    $('admin-close-date').value=date;
    $('admin-close-search').value=row.colaborador;
    $('admin-close-area').value='';
    await showAdminSection('cierres');
    if(APP.adminSection!=='cierres'||$('admin-close-date').value!==date)return;
    if(!APP.adminClose?.ok)return toast('No se pudo abrir el caso. Actualiza los cierres.',true);
    const area=String(row.area_id||'');
    if([...$('admin-close-area').options].some(option=>option.value===area))$('admin-close-area').value=area;
    renderAdminCloseStatus();
    const status=$('admin-close-status');status.setAttribute('tabindex','-1');status.focus({preventScroll:true});
    if(button.dataset.action==='review'){
      const deliveries=(APP.adminReview?.entregas||[]).filter(item=>String(item.colaborador_id)===String(row.colaborador_id));
      if(deliveries.length)openAdminReviewPerson(row.colaborador_id,status);
      else toast('No hay evidencias disponibles para revisar. Consulta el caso actualizado.');
    }
  }catch(error){toast('No se pudo abrir el caso. Inténtalo nuevamente.',true);}
  finally{button.disabled=false;}
}
function clearAdminControlFilters(all=false){
  ADMIN_CONTROL_CHART='';
  $('admin-control-search').value='';$('admin-control-area').value='';$('admin-control-state').value='';
  if(all)ADMIN_CONTROL_QUEUE='all';
  ADMIN_CONTROL_EXPANDED=null;renderAdminControl();$('admin-control-search').focus();
}
$('admin-control-date').value=isoLima();$('admin-control-date').min=addIsoDays(isoLima(),-365);$('admin-control-date').max=isoLima();
adminControlDateButtons();
$('admin-control-date').onchange=loadAdminControl;
$('admin-control-today').onclick=()=>{$('admin-control-date').value=isoLima();loadAdminControl()};
for(const [id,delta] of [['admin-control-prev',-1],['admin-control-next',1]])$(id).onclick=()=>{
  const input=$('admin-control-date'),next=addIsoDays(input.value,delta);
  if(next>=input.min&&next<=isoLima()){input.value=next;loadAdminControl();}
};
$('admin-control-export').onclick=exportAdminControl;
$('admin-control-clear').onclick=()=>clearAdminControlFilters();
$('admin-control-search').oninput=renderAdminControl;$('admin-control-area').onchange=()=>{ADMIN_CONTROL_CHART='';renderAdminControl()};
$('admin-control-state').onchange=()=>{ADMIN_CONTROL_CHART='';ADMIN_CONTROL_QUEUE='all';renderAdminControl()};
$('admin-control-sort').onchange=renderAdminControl;
$('admin-control-kpis').onclick=event=>{
  const button=event.target.closest('[data-control-queue]');if(!button)return;
  ADMIN_CONTROL_CHART='';ADMIN_CONTROL_QUEUE=button.dataset.controlQueue;$('admin-control-state').value='';ADMIN_CONTROL_EXPANDED=null;renderAdminControl();
  $('admin-control-kpis').querySelector('[data-control-queue="'+ADMIN_CONTROL_QUEUE+'"]')?.focus();
};
$('admin-control-table').onclick=event=>{
  const open=event.target.closest('[data-control-open-close]');if(open){void openControlClose(open);return;}
  const detail=event.target.closest('[data-control-detail]');
  if(detail){
    ADMIN_CONTROL_EXPANDED=ADMIN_CONTROL_EXPANDED===detail.dataset.controlDetail?null:detail.dataset.controlDetail;
    const id=detail.dataset.controlDetail;renderAdminControl();
    $('admin-control-table').querySelector('[data-control-detail="'+id+'"]')?.focus({preventScroll:true});return;
  }
  if(event.target.closest('[data-control-clear]'))clearAdminControlFilters(true);
  if(event.target.closest('[data-control-retry]'))void loadAdminControl();
};

$('admin-control-areas').onclick=event=>{const button=event.target.closest('[data-control-chart-area]');if(button)selectAdminControlArea(button.dataset.controlChartArea,button.dataset.controlChartState||'');};
$('admin-control-chart-reset').onclick=()=>selectAdminControlArea('');
