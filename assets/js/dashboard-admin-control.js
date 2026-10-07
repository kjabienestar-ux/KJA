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
    if(!groups.has(id))groups.set(id,{id,name:row.area||'Sin área',total:0,pending:0,review:0,done:0,clear:0,collaborators:[]});
    const group=groups.get(id);group.total++;group[adminControlAreaBucket(row)]++;
    group.collaborators.push(row);
  }
  return [...groups.values()].sort((a,b)=>(b.pending+b.review)-(a.pending+a.review)||a.name.localeCompare(b.name,'es'));
}
function adminControlAreaIcon(name){
  const slug=adminControlAreaSlug(name);
  switch(slug){
    case 'diseno':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L19 9L13.5 14.5L6.5 7.5L12 2Z"/><path d="M6.5 7.5L3 17.5L13 14"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/><circle cx="18" cy="18" r="2.5"/><path d="M15.5 18H14"/></svg>';
    case 'ingenieria':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" fill-opacity="0.12"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/></svg>';
    case 'rrhh':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="6" r="3.5"/><path d="M6 18.5v-.5a6 6 0 0 1 12 0v.5"/><circle cx="19" cy="9" r="2.5"/><path d="M18.5 17a4.5 4.5 0 0 1 3.5 1.5"/><circle cx="5" cy="9" r="2.5"/><path d="M5.5 17A4.5 4.5 0 0 0 2 18.5"/></svg>';
    case 'salud':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L4 5.5v6.2c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8V5.5L12 2Z"/><path d="M12 8v6M9 11h6"/></svg>';
    case 'admin':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M4 18h16M6 18V9M10 18V9M14 18V9M18 18V9M3 9l9-5 9 5"/></svg>';
    case 'conta':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v17M8 20h8M3 7h18"/><path d="M6 7l-2.5 5.5a2.5 2.5 0 0 0 5 0L6 7zM18 7l-2.5 5.5a2.5 2.5 0 0 0 5 0L18 7z"/></svg>';
    case 'marketing':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14V9a1 1 0 0 1 1-1h3l6-4v14l-6-4H5a1 1 0 0 1-1-1z"/><path d="M7 14v4a2 2 0 0 0 2 2h1"/><path d="M17.5 8.5a4.5 4.5 0 0 1 0 7"/><path d="M20 6a8 8 0 0 1 0 12"/></svg>';
    case 'recluta':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><circle cx="11" cy="9" r="2.2"/><path d="M7.5 14.5a3.5 3.5 0 0 1 7 0"/></svg>';
    case 'voluntariado':
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><circle cx="12" cy="11" r="2.5" fill="currentColor" fill-opacity="0.2"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>';
  }
}

function adminControlAreaSlug(name){
  const n=String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(n.includes('diseno')||n.includes('grafic')) return 'diseno';
  if(n.includes('ingenier')) return 'ingenieria';
  if(n.includes('recurso')||n.includes('humano')||n.includes('rrhh')) return 'rrhh';
  if(n.includes('salud')||n.includes('ocupacional')) return 'salud';
  if(n.includes('admin')) return 'admin';
  if(n.includes('conta')) return 'conta';
  if(n.includes('market')) return 'marketing';
  if(n.includes('recluta')||n.includes('selecc')) return 'recluta';
  if(n.includes('voluntar')) return 'voluntariado';
  return 'general';
}

function adminControlAreaWatermarkSvg(slug){
  switch(slug){
    case 'diseno':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="75" cy="75" r="28" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".10"/><path d="M10 90 Q 50 10 90 50" fill="none" stroke="currentColor" stroke-width="2" opacity=".10"/><polygon points="45,25 75,55 55,75 25,45" fill="currentColor" opacity=".06"/><circle cx="50" cy="50" r="3" fill="currentColor" opacity=".12"/></svg>';
    case 'ingenieria':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><rect x="35" y="35" width="48" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="2" opacity=".10"/><circle cx="59" cy="59" r="10" fill="currentColor" opacity=".06"/><path d="M15 35 h20 M15 59 h20 M15 83 h20 M59 15 v20 M83 15 v20" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".10"/><circle cx="15" cy="35" r="3" fill="currentColor" opacity=".12"/><circle cx="15" cy="59" r="3" fill="currentColor" opacity=".12"/><circle cx="59" cy="15" r="3" fill="currentColor" opacity=".12"/></svg>';
    case 'rrhh':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="65" cy="40" r="14" fill="currentColor" opacity=".06"/><circle cx="35" cy="65" r="10" fill="currentColor" opacity=".06"/><circle cx="75" cy="75" r="8" fill="currentColor" opacity=".06"/><path d="M65 40 L 35 65 M65 40 L 75 75 M35 65 L 75 75" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3" opacity=".10"/><circle cx="65" cy="40" r="24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".08"/></svg>';
    case 'salud':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><path d="M60 20 L 85 32 v22 c0 18 -11 32 -25 38 c-14 -6 -25 -20 -25 -38 V 32 Z" fill="currentColor" opacity=".05"/><path d="M15 65 L 35 65 L 45 42 L 55 82 L 65 52 L 75 68 L 92 68" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".11"/></svg>';
    case 'admin':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><polygon points="20,38 55,20 90,38" fill="none" stroke="currentColor" stroke-width="2" opacity=".10"/><rect x="26" y="44" width="8" height="42" rx="2" fill="currentColor" opacity=".07"/><rect x="51" y="44" width="8" height="42" rx="2" fill="currentColor" opacity=".07"/><rect x="76" y="44" width="8" height="42" rx="2" fill="currentColor" opacity=".07"/><line x1="18" y1="90" x2="92" y2="90" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".10"/></svg>';
    case 'conta':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><line x1="25" y1="36" x2="85" y2="36" stroke="currentColor" stroke-width="2.5" opacity=".10"/><circle cx="55" cy="36" r="4" fill="currentColor" opacity=".12"/><path d="M25 36 L 15 58 L 35 58 Z" fill="currentColor" opacity=".06"/><path d="M85 36 L 75 58 L 95 58 Z" fill="currentColor" opacity=".06"/><line x1="55" y1="36" x2="55" y88 stroke="currentColor" stroke-width="2" opacity=".08"/><line x1="42" y1="88" x2="68" y2="88" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".10"/></svg>';
    case 'marketing':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><path d="M25 55 L 55 35 L 55 75 L 25 55 Z" fill="currentColor" opacity=".06"/><path d="M63 42 A 18 18 0 0 1 63 68" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".11"/><path d="M72 32 A 32 32 0 0 1 72 78" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".10"/><path d="M81 22 A 46 46 0 0 1 81 88" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".08"/></svg>';
    case 'recluta':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="55" cy="55" r="32" fill="none" stroke="currentColor" stroke-width="2" opacity=".09"/><circle cx="55" cy="55" r="18" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".10"/><circle cx="55" cy="55" r="6" fill="currentColor" opacity=".12"/><line x1="55" y1="15" x2="55" y2="95" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" opacity=".09"/><line x1="15" y1="55" x2="95" y2="55" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" opacity=".09"/></svg>';
    case 'voluntariado':
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><path d="M55 45 C 55 30 35 30 35 48 C 35 66 55 78 55 86 C 55 78 75 66 75 48 C 75 30 55 30 55 45 Z" fill="currentColor" opacity=".07"/><circle cx="55" cy="55" r="36" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="6 4" opacity=".09"/></svg>';
    default:
      return '<svg class="control-area-watermark" viewBox="0 0 100 100" aria-hidden="true"><rect x="25" y="25" width="50" height="50" rx="8" fill="none" stroke="currentColor" stroke-width="2" opacity=".08"/><circle cx="50" cy="50" r="16" fill="currentColor" opacity=".05"/></svg>';
  }
}

function adminControlDonutSvg(group){
  const total = Math.max(1, group.total || 0);
  const pending = group.pending || 0;
  const review = group.review || 0;
  const done = group.done || 0;
  const clear = group.clear || 0;
  const r = 15.9155;
  let offset = 25;
  const segments = [
    { key: 'pending', color: '#f43f5e', count: pending },
    { key: 'review', color: '#f59e0b', count: review },
    { key: 'done', color: '#10b981', count: done },
    { key: 'clear', color: '#cbd5e1', count: clear }
  ];
  let circles = '<circle cx="18" cy="18" r="'+r+'" fill="none" stroke="#f1f5f9" stroke-width="4.2"/>';
  for(const seg of segments){
    if(!seg.count) continue;
    const pct = (seg.count / total) * 100;
    circles += '<circle cx="18" cy="18" r="'+r+'" fill="none" stroke="'+seg.color+'" stroke-width="4.2" stroke-dasharray="'+pct.toFixed(2)+' '+(100 - pct).toFixed(2)+'" stroke-dashoffset="'+offset.toFixed(2)+'" stroke-linecap="round"/>';
    offset -= pct;
  }
  const attention = pending + review;
  const centerText = attention > 0 
    ? '<text x="18" y="21.5" text-anchor="middle" font-size="10" font-weight="700" fill="#e11d48">'+attention+'</text>'
    : '<text x="18" y="21" text-anchor="middle" font-size="10" font-weight="700" fill="#10b981">✓</text>';
  return '<svg class="control-area-donut" viewBox="0 0 36 36" width="46" height="46" aria-hidden="true">'+circles+centerText+'</svg>';
}

function adminControlCollaboratorAvatarUrl(c){
  if(c?.foto_url) return c.foto_url;
  const seed = encodeURIComponent(c?.colaborador_id || c?.id || c?.colaborador || 'colaborador');
  return 'https://i.pravatar.cc/100?u=' + seed;
}

function adminControlAreaAvatars(group){
  const people = group.collaborators || [];
  const maxVisible = 5;
  const count = Math.min(group.total || people.length, maxVisible);
  if(count <= 0) return '';
  let avatarsHtml = '';
  for(let i = 0; i < count; i++){
    const person = people[i] || { colaborador: 'Persona ' + (i + 1), colaborador_id: group.id + '_' + i };
    const name = person.colaborador || 'Colaborador';
    const photoUrl = adminControlCollaboratorAvatarUrl(person);
    const inis = (typeof initials === 'function' ? initials(name) : name.slice(0, 2)).toUpperCase();
    avatarsHtml += '<span class="control-avatar-item" title="' + esc(name) + '">' +
      '<img src="' + esc(photoUrl) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
      '<span class="control-avatar-fallback">' + esc(inis) + '</span>' +
    '</span>';
  }
  const remaining = (group.total || people.length) - count;
  const moreHtml = remaining > 0 ? '<span class="control-avatar-more" title="' + remaining + ' personas más">+' + remaining + '</span>' : '';
  return '<div class="control-area-avatars" aria-hidden="true"><div class="control-avatar-list">' + avatarsHtml + '</div>' + moreHtml + '</div>';
}

function adminControlPersonFigures(group){
  return adminControlAreaAvatars(group);
}

function renderAdminControlAreas(){
  const host=$('admin-control-areas');if(!host)return;
  if(APP.adminControl?.partial){host.innerHTML='<p class="control-area-empty">Resumen por área no disponible: faltan datos por comprobar. Actualiza para ver la distribución completa.</p>';$('admin-control-chart-selection').textContent='Datos parciales';$('admin-control-chart-reset').hidden=true;return;}
  const groups=adminControlAreaGroups(),selected=$('admin-control-area').value;
  const signature=JSON.stringify([APP.adminControl.fecha,groups]);
  const animate=signature!==ADMIN_CONTROL_AREA_SIGNATURE;
  ADMIN_CONTROL_AREA_SIGNATURE=signature;
  host.innerHTML=groups.length?groups.map(group=>{
    const attention=group.pending+group.review;
    const slug=adminControlAreaSlug(group.name);
    return '<div class="control-area-row area-theme-'+slug+(animate?' is-arriving':'')+(selected===group.id?' is-selected':'')+'" data-control-chart-area="'+esc(group.id)+'" role="button" tabindex="0" aria-pressed="'+(selected===group.id)+'">'+
      adminControlAreaWatermarkSvg(slug)+
      '<div class="control-area-top">'+
        '<div class="control-area-brand">'+
          '<span class="control-area-icon">'+adminControlAreaIcon(group.name)+'</span>'+
          '<button type="button" class="control-area-name" data-control-chart-area="'+esc(group.id)+'" aria-pressed="'+(selected===group.id)+'">'+
            '<strong>'+esc(group.name)+'</strong><small>'+group.total+' personas</small>'+
          '</button>'+
        '</div>'+
        '<div class="control-area-chart-wrap" title="Donut de cumplimiento">'+
          adminControlDonutSvg(group)+
          '<span class="control-area-count" title="Personas con pendientes o entregas por revisar"><b>'+attention+'</b><small>por atender</small></span>'+
          '<svg class="control-area-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'+
        '</div>'+
      '</div>'+
      adminControlAreaAvatars(group)+
      '<div class="control-area-bar" role="group" aria-label="'+esc(group.name)+'">'+
        CONTROL_AREA_STATES.filter(([key])=>group[key]).map(([key,label])=>{
          return '<button type="button" class="control-area-segment '+key+'" style="flex-grow:'+group[key]+'" data-control-chart-area="'+esc(group.id)+'" data-control-chart-state="'+key+'" aria-pressed="'+(selected===group.id&&ADMIN_CONTROL_CHART===key)+'" aria-label="'+esc(group.name)+': '+group[key]+' '+label.toLowerCase()+' de '+group.total+' personas" title="'+group[key]+' '+label.toLowerCase()+' · '+Math.round(group[key]*100/group.total)+'%"><span class="control-seg-dot"></span><span>'+group[key]+' '+label+'</span></button>';
        }).join('')+
      '</div>'+
    '</div>';
  }).join(''):'<p class="control-area-empty">No hay áreas registradas para esta fecha.</p>';
  const active=CONTROL_AREA_STATES.find(([key])=>key===ADMIN_CONTROL_CHART);
  $('admin-control-chart-reset').hidden=!selected&&!active;
  $('admin-control-chart-selection').textContent=active?'Filtro: '+active[1]:(selected?'Selecciona un área para filtrar':'Pulsa una tarjeta para ver sus personas en 2 columnas');
}
function selectAdminControlArea(area,state=''){
  $('admin-control-search').value='';$('admin-control-state').value='';$('admin-control-area').value=area;
  ADMIN_CONTROL_CHART=state;ADMIN_CONTROL_QUEUE='all';ADMIN_CONTROL_EXPANDED=null;renderAdminControl();
  $('admin-control-result-count').setAttribute('tabindex','-1');$('admin-control-result-count').focus({preventScroll:true});
  if(area && typeof window !== 'undefined'){
    const wrap=$('control-split-wrap');
    if(wrap && typeof wrap.getBoundingClientRect === 'function'){
      const rect=wrap.getBoundingClientRect();
      if(rect.top < 0 || rect.top > 120){
        wrap.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }
  }
}

function renderAdminControl(){
  if(!APP.adminControl?.ok)return;
  renderAdminControlAreas();
  const base=adminControlBaseRows(),rows=adminControlRows();
  const selectedArea=$('admin-control-area')?.value||'';
  const splitWrap=$('control-split-wrap');
  if(splitWrap){
    if(splitWrap.classList?.toggle)splitWrap.classList.toggle('is-split',!!selectedArea);
    if(splitWrap.setAttribute)splitWrap.setAttribute('data-split',selectedArea?'true':'false');
  }
  const backBtn=$('control-back-areas-btn');
  if(backBtn)backBtn.hidden=!selectedArea;
  const banner=$('control-selected-area-banner');
  if(banner){
    if(selectedArea){
      banner.hidden=false;
      const groups=adminControlAreaGroups();
      const currentGroup=groups.find(g=>g.id===selectedArea)||{name:'Área seleccionada',total:base.length,pending:0,review:0,done:0,clear:0};
      const slug=adminControlAreaSlug(currentGroup.name);
      if(banner.setAttribute)banner.setAttribute('class','control-selected-area-banner area-theme-'+slug);
      else banner.className='control-selected-area-banner area-theme-'+slug;
      const iconEl=$('control-selected-area-icon');
      if(iconEl)iconEl.innerHTML=adminControlAreaIcon(currentGroup.name);
      const titleEl=$('control-selected-area-title');
      if(titleEl)titleEl.textContent=currentGroup.name;
      const subEl=$('control-selected-area-sub');
      if(subEl)subEl.textContent=currentGroup.total+(currentGroup.total===1?' persona en total':' personas en total');
      const badgesEl=$('control-selected-area-badges');
      if(badgesEl){
        const att=currentGroup.pending+currentGroup.review;
        badgesEl.innerHTML=
          '<span class="control-banner-badge is-pending">🔴 '+att+' por atender</span>'+
          '<span class="control-banner-badge is-done">🟢 '+currentGroup.done+' concluidas</span>'+
          (currentGroup.clear?'<span class="control-banner-badge is-clear">⚪ '+currentGroup.clear+' sin pendientes</span>':'');
      }
    }else{
      banner.hidden=true;
    }
  }
  const queues=[['attention','Por atender'],['review','Por revisar'],['done','Concluidas'],['all','Todo el equipo']];
  $('admin-control-kpis').innerHTML=queues.map(([key,label])=>'<button type="button" data-control-queue="'+key+'" aria-pressed="'+(ADMIN_CONTROL_QUEUE===key)+'">'+label+'<span>'+base.filter(row=>adminControlMatchesQueue(row,key)).length+'</span></button>').join('');
  const scheduled=base.filter(adminControlWork).length,hours=base.reduce((sum,row)=>sum+Number(row.horas_validas||0),0);
  $('admin-control-summary').textContent=scheduled+' jornadas programadas · '+hours.toFixed(1)+' h válidas';
  const attCount=base.filter(row=>adminControlMatchesQueue(row,'attention')).length;
  const revCount=base.filter(row=>adminControlMatchesQueue(row,'review')).length;
  const doneCount=base.filter(row=>adminControlMatchesQueue(row,'done')).length;
  const attVal=$('control-stat-attention-val');
  if(attVal){attVal.textContent=attCount;const sub=$('control-stat-attention-sub');if(sub)sub.textContent='de '+base.length+' personas';}
  const revVal=$('control-stat-review-val');
  if(revVal){revVal.textContent=revCount;const sub=$('control-stat-review-sub');if(sub)sub.textContent=revCount===1?'entrega pendiente':'entregas pendientes';}
  const doneVal=$('control-stat-done-val');
  if(doneVal){doneVal.textContent=doneCount;const sub=$('control-stat-done-sub');if(sub)sub.textContent=doneCount===1?'jornada completa':'jornadas completadas';}
  const hoursVal=$('control-stat-hours-val');
  if(hoursVal){hoursVal.textContent=hours.toFixed(1)+' h';const sub=$('control-stat-hours-sub');if(sub)sub.textContent=scheduled+' programadas';}
  if(typeof document!=='undefined'&&document.querySelectorAll){
    document.querySelectorAll('.control-stat-card').forEach(card=>{
      card.classList.toggle('is-active',card.dataset?.controlQueue===ADMIN_CONTROL_QUEUE);
    });
  }
  $('admin-control-result-count').textContent=rows.length+' de '+base.length+' personas'+(ADMIN_CONTROL_QUEUE==='attention'?' requieren seguimiento':'');
  $('admin-control-clear').hidden=!($('admin-control-search').value||$('admin-control-area').value||$('admin-control-state').value);
  $('admin-control-export').disabled=!rows.length||!!APP.adminControlLoading;
  let html='';
  for(const row of rows){
    const state=adminControlState(row),step=adminControlNextStep(row),id=String(row.colaborador_id),expanded=ADMIN_CONTROL_EXPANDED===id;
    const review=Number(row.revision_pendiente)>0;
    const isPending=adminControlNeedsAttention(row)||review;
    const isDone=['completa','justificado'].includes(state.key);
    const groupKey=isPending?(review?'review':'pending'):isDone?'done':'clear';
    const groupLabel=groupKey==='review'
      ?'Entrega por revisar'
      :groupKey==='pending'
      ?'Pendiente de atención'
      :groupKey==='done'
      ?'Jornada concluida'
      :'Sin jornada programada';

    html+='<article class="control-case situation-'+groupKey+'" data-person="'+esc(id)+'">'+
      '<div class="control-case-situation-bar '+groupKey+'" title="Situación: '+groupLabel+'">'+
        '<span class="control-situation-dot"></span>'+
        '<span class="control-situation-text">'+groupLabel+'</span>'+
      '</div>'+
      '<div class="control-case-row">'+
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
    if(typeof hydrateProfilePhotos==='function'&&Array.isArray(data.filas)&&data.filas.length){
      try{
        const peopleList=data.filas.map(r=>({id:r.colaborador_id,nombre:r.colaborador}));
        const hydrated=await hydrateProfilePhotos(peopleList);
        const map=new Map(hydrated.map(p=>[String(p.id),p.foto_url]));
        data.filas.forEach(r=>{r.foto_url=map.get(String(r.colaborador_id))||'';});
      }catch(_e){}
    }
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
const backAreasBtn=$('control-back-areas-btn');
if(backAreasBtn)backAreasBtn.onclick=()=>selectAdminControlArea('');
const statsGrid=$('control-stats-grid');
if(statsGrid){
  statsGrid.onclick=event=>{
    const card=event.target.closest?.('[data-control-queue]');
    if(!card)return;
    ADMIN_CONTROL_CHART='';
    ADMIN_CONTROL_QUEUE=card.dataset.controlQueue;
    const stateEl=$('admin-control-state');
    if(stateEl)stateEl.value='';
    ADMIN_CONTROL_EXPANDED=null;
    renderAdminControl();
  };
}

