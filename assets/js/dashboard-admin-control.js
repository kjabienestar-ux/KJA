/* KJA · Fase 3 — control diario de excepciones para Dirección. */

function adminControlMessage(text,type=''){
  const element=$('admin-control-message');
  element.textContent=text||'';
  element.className='admin-list-message'+(text?' show':'')+(type?' '+type:'');
}

function adminControlTime(value){
  return value?new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'}).format(new Date(value)):'—';
}

function adminControlState(row){
  if(!row.labora||row.cierre_estado==='no_aplica')return {key:'no_aplica',label:'No labora este día',tone:'neutral'};
  if(row.cierre_estado==='incompleta')return {key:'incompleta',label:'Jornada incompleta',tone:'danger'};
  if(row.cierre_estado==='sin_entrada')return {key:'sin_entrada',label:'Sin entrada',tone:'danger'};
  if(Number(row.revision_observada)>0)return {key:'observada',label:'Corrección pendiente',tone:'danger'};
  if((row.impedimentos||[]).length)return {key:'impedimento',label:'Impedimento informado',tone:'info'};
  if(Number(row.evidencias_pendientes)>0)return {key:'evidencias',label:'Faltan evidencias',tone:'warning'};
  if(row.entrada_at&&!row.salida_at)return {key:'sin_salida',label:row.cierre_estado==='lista_para_salir'?'Lista para salir':'Cierre pendiente',tone:'warning'};
  if(['completa','regularizada'].includes(row.cierre_estado))return {key:'completa',label:'Completa',tone:'success'};
  return {key:'neutral',label:'Sin novedad',tone:'neutral'};
}

function adminControlBaseRows(){
  const query=$('admin-control-search').value.trim().toLocaleLowerCase('es'),area=$('admin-control-area').value;
  return (APP.adminControl?.filas||[]).filter(row=>(!area||String(row.area_id)===area)&&(!query||`${row.colaborador} ${row.area}`.toLocaleLowerCase('es').includes(query)));
}

function adminControlRows(){
  const state=$('admin-control-state').value;
  return adminControlBaseRows().filter(row=>{
    if(!state)return true;
    if(state==='revision')return Number(row.revision_pendiente)>0;
    if(state==='observada')return Number(row.revision_observada)>0;
    if(state==='impedimento')return (row.impedimentos||[]).length>0;
    if(state==='evidencias')return Number(row.evidencias_pendientes)>0;
    if(state==='sin_salida')return !!row.entrada_at&&!row.salida_at&&row.labora;
    return adminControlState(row).key===state;
  });
}

function adminControlMissingDetail(row){
  if(adminControlState(row).key!=='incompleta')return '';
  const close={...row.cierre,estado:'incompleta',entrada_at:row.entrada_at,salida_at:row.salida_at};
  const reasons=CLOSE_MODEL.incompleteReasons(null,close);
  if(!row.cierre&&Number(row.evidencias_pendientes)>0)reasons.push('Detalle de evidencias no disponible; consulta Ver cierre');
  return reasons.length?'Faltó: '+reasons.join('; '):'No se dispone del detalle del cierre. Consulta Ver cierre.';
}

function renderAdminControl(){
  if(!APP.adminControl?.ok)return;
  const base=adminControlBaseRows(),rows=adminControlRows();
  const scheduled=base.filter(row=>row.labora&&row.cierre_estado!=='no_aplica'),withoutEntry=scheduled.filter(row=>row.cierre_estado==='sin_entrada').length,evidence=scheduled.filter(row=>Number(row.evidencias_pendientes)>0).length,issues=scheduled.filter(row=>(row.impedimentos||[]).length).length,withoutExit=scheduled.filter(row=>row.entrada_at&&!row.salida_at).length,incomplete=scheduled.filter(row=>row.cierre_estado==='incompleta').length,hours=base.reduce((total,row)=>total+Number(row.horas_validas||0),0);
  const kpis=[
    ['SIN ENTRADA',withoutEntry,'sin_entrada'],
    ['DEBEN EVIDENCIAS',evidence,'evidencias'],
    ['AVISARON IMPEDIMENTO',issues,'impedimento'],
    ['SIN SALIDA',withoutExit,'sin_salida'],
    ['INCOMPLETAS',incomplete,'incompleta'],
    ['HORAS VÁLIDAS',`${hours.toFixed(1)} h`,'']
  ];
  $('admin-control-kpis').innerHTML=kpis.map(([label,value,filter])=>`<button type="button" ${filter?`data-control-filter="${filter}"`:''} ${filter?'':'disabled'}><small>${label}</small><b>${value}</b>${filter?'<span>Filtrar</span>':''}</button>`).join('');
  $('admin-control-result-count').textContent=`${rows.length} ${rows.length===1?'persona':'personas'}`;
  let html='<div class="admin-control-table-head"><span>Colaborador</span><span>Entrada</span><span>Evidencias</span><span>Revisión</span><span>Salida</span><span>Horas</span><span>Jornada</span><span></span></div>';
  for(const row of rows){
    const state=adminControlState(row),pending=Number(row.evidencias_pendientes||0),reviewPending=Number(row.revision_pendiente||0),observed=Number(row.revision_observada||0),issue=(row.impedimentos||[])[0];
    const noWork=state.key==='no_aplica';
    const missingDetail=adminControlMissingDetail(row);
    const evidenceLabel=!row.labora?'No aplica':issue?'Aviso enviado':pending?`${pending} ${pending===1?'pendiente':'pendientes'}`:'Completo';
    const reviewLabel=observed?`${observed} ${observed===1?'observada':'observadas'}`:reviewPending?`${reviewPending} por revisar`:'Sin pendientes';
    html+=`<article class="admin-control-row" data-tone="${state.tone}" data-state="${state.key}">
      <span class="admin-control-person"><i>${esc(initials(row.colaborador))}</i><span><b>${esc(row.colaborador)}</b><small>${esc(row.area)}</small></span></span>
      <span data-label="Entrada"><b>${noWork&&!row.entrada_at?'No requiere':esc(adminControlTime(row.entrada_at))}</b><small>${noWork&&!row.entrada_at?'marcar entrada':esc(row.entrada_estado||'Sin marca')}</small></span>
      <div data-label="Evidencias" class="admin-control-evidence ${issue?'has-issue':pending?'needs-attention':'is-ok'}" ${issue?`title="${esc(issue.detalle)}"`:''}><b>${esc(evidenceLabel)}</b>${missingDetail?`<details class="admin-control-missing"><summary>Ver faltantes</summary><p>${esc(missingDetail)}</p></details>`:`<small>${issue?esc(issue.detalle):pending?'Bloquea la salida':'Requisitos del día'}</small>`}</div>
      <span data-label="Revisión" class="${observed?'needs-attention':reviewPending?'needs-review':''}"><b>${esc(reviewLabel)}</b><small>${observed?'Requiere corrección':reviewPending?'Dirección debe revisar':'Al día'}</small></span>
      <span data-label="Salida"><b>${noWork&&!row.salida_at?'No requiere':esc(adminControlTime(row.salida_at))}</b><small>${row.salida_at?'Registrada':noWork?'marcar salida':'Sin registro'}</small></span>
      <span data-label="Horas"><b>${Number(row.horas_validas||0).toFixed(2)} h</b><small>Válidas</small></span>
      <span data-label="Jornada"><em class="admin-control-state ${state.tone}">${esc(state.label)}</em></span>
      <button type="button" data-control-open-close="${row.colaborador_id}" data-area="${row.area_id}">Ver cierre</button>
    </article>`;
  }
  $('admin-control-table').innerHTML=rows.length?html:'<div class="admin-control-empty"><b>No hay personas en esta situación</b><p>Cambia el filtro o la fecha para continuar con el seguimiento.</p><button type="button" data-control-clear>Limpiar filtros</button></div>';
}

function fillAdminControlAreas(){
  const select=$('admin-control-area'),current=select.value,areas=APP.adminControl?.areas||[];
  select.innerHTML='<option value="">Todas las áreas</option>'+areas.map(area=>`<option value="${esc(area.id)}">${esc(area.nombre)}</option>`).join('');
  if(areas.some(area=>String(area.id)===current))select.value=current;
}

async function loadAdminControl(){
  if(APP.access.rol!=='direccion')return;
  const date=$('admin-control-date').value||isoLima(),request=++APP.adminControlRequest;
  $('admin-control-date').value=date;adminControlMessage('');$('admin-control-table').innerHTML='<div class="admin-control-loading"><i></i><span>Comprobando entradas, evidencias y cierres…</span></div>';
  const [{data,error},{data:issueData,error:issueError},{data:closeData,error:closeError}]=await Promise.all([db.rpc('dash_admin_control_diario',{p_fecha:date}),db.rpc('dash_supervision_impedimentos',{p_fecha:date}),db.rpc('dash_admin_cierres',{p_fecha:date})]);
  if(request!==APP.adminControlRequest)return;
  if(error||!data?.ok){
    APP.adminControl=null;
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_control_diario'));
    adminControlMessage(missing?'Ejecuta dashboard_23_control_diario.sql para habilitar esta vista.':'No pudimos cargar el control diario. Comprueba tu conexión e inténtalo nuevamente.','error');
    $('admin-control-kpis').innerHTML='';$('admin-control-table').innerHTML='<p class="admin-empty">El control diario no está disponible.</p>';return;
  }
  const byIssue=new Map();if(!issueError&&issueData?.ok)(issueData.impedimentos||[]).forEach(item=>{const key=String(item.colaborador_id);if(!byIssue.has(key))byIssue.set(key,[]);byIssue.get(key).push(item)});
  const byClose=new Map((!closeError&&closeData?.ok?closeData.personas||[]:[]).map(person=>[String(person.id),person.cierre]));
  data.filas=(data.filas||[]).map(row=>({...row,cierre:byClose.get(String(row.colaborador_id))||null,impedimentos:byIssue.get(String(row.colaborador_id))||[]}));APP.adminControl=data;fillAdminControlAreas();renderAdminControl();
}

function exportAdminControl(){
  const rows=adminControlRows();if(!rows.length)return toast('No hay filas para exportar.',true);
  const csvRows=[['Fecha','Colaborador','Área','Programado','Entrada','Estado entrada','Evidencias pendientes','Impedimento informado','Detalle del impedimento','Por revisar','Observadas','Salida','Horas válidas','Estado jornada'],...rows.map(row=>[$('admin-control-date').value,row.colaborador,row.area,row.labora?'Sí':'No',adminControlTime(row.entrada_at),row.entrada_estado||'',row.evidencias_pendientes||0,(row.impedimentos||[]).length?'Sí':'No',(row.impedimentos||[]).map(item=>item.detalle).join(' | '),row.revision_pendiente||0,row.revision_observada||0,adminControlTime(row.salida_at),Number(row.horas_validas||0).toFixed(2),adminControlState(row).label])];
  const quote=value=>`"${String(value??'').replaceAll('"','""')}"`,blob=new Blob(['\ufeff'+csvRows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`control-diario-${$('admin-control-date').value}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);toast('Reporte CSV preparado.');
}

async function openControlClose(button){
  $('admin-close-date').value=$('admin-control-date').value;await showAdminSection('cierres');
  const area=String(button.dataset.area||'');if([...$('admin-close-area').options].some(option=>option.value===area)){$('admin-close-area').value=area;renderAdminCloseStatus()}
}

$('admin-control-date').value=isoLima();$('admin-control-date').min=addIsoDays(isoLima(),-365);$('admin-control-date').max=isoLima();
$('admin-control-date').onchange=loadAdminControl;
$('admin-control-today').onclick=()=>{$('admin-control-date').value=isoLima();loadAdminControl()};
$('admin-control-export').onclick=exportAdminControl;
$('admin-control-search').oninput=renderAdminControl;$('admin-control-area').onchange=renderAdminControl;$('admin-control-state').onchange=renderAdminControl;
$('admin-control-kpis').onclick=event=>{const button=event.target.closest('[data-control-filter]');if(button){$('admin-control-state').value=button.dataset.controlFilter;renderAdminControl()}};
$('admin-control-table').onclick=event=>{const open=event.target.closest('[data-control-open-close]');if(open){openControlClose(open);return}if(event.target.closest('[data-control-clear]')){$('admin-control-search').value='';$('admin-control-area').value='';$('admin-control-state').value='';renderAdminControl()}};
