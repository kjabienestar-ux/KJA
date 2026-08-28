/* KJA · Fase 3 — Colaboradores y contratos dentro del dashboard. */
const ADMIN_DAYS=[['Lun',1],['Mar',2],['Mié',3],['Jue',4],['Vie',5],['Sáb',6],['Dom',7]];
const ADMIN_MODES={virtual:['Virtual','Virt'],presencial:['Presencial','Pres'],opcional:['Opcional','Opc'],no_gestiona:['No gestiona','—']};
const ADMIN_LINKS={practicas:'Prácticas',voluntariado:'Voluntariado',ambos:'Mixto'};

function teamMsg(text){
  const el=$(APP.adminSection==='contratos'?'admin-contract-message':'admin-team-message');
  el.textContent=text||'';el.classList.toggle('show',!!text);
}
function editorMsg(text){
  const el=$('admin-editor-message');
  el.textContent=text||'';el.classList.toggle('show',!!text);
}
function adminDate(value){
  if(!value)return '—';
  const d=new Date(String(value).slice(0,10)+'T12:00:00');
  return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'});
}
function adminHours(value){return value==null?'—':`${Number(value).toFixed(Number(value)%1?1:0)} h`}
function adminMode(person,dow){
  const day=(person.horario_semanal||{})[String(dow)]||{};
  return day.mod||((person.dias_laborables||[]).map(Number).includes(dow)?'virtual':'no_gestiona');
}

async function loadAdminTeam(){
  if(!APP.access.acceso_panel)return;
  const request=++APP.adminTeamRequest,btn=$('admin-refresh');
  btn.disabled=true;teamMsg('');
  const target=APP.adminSection==='contratos'?'admin-contract-list':'admin-people-list';
  $(target).innerHTML='<p class="admin-empty">Cargando información del equipo…</p>';
  const {data,error}=await db.rpc('dash_admin_equipo',{p_incluir_inactivos:true});
  if(request!==APP.adminTeamRequest)return;
  btn.disabled=false;
  if(error||!data?.ok){
    APP.adminTeam=null;
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_equipo'));
    teamMsg(missing?'La fase 3 todavía no está instalada en Supabase. Ejecuta dashboard_06_admin_equipo.sql.':'No se pudo cargar colaboradores y contratos. Actualiza nuevamente.');
    $(target).innerHTML='<p class="admin-empty">La información del equipo no está disponible.</p>';
    return;
  }
  APP.adminTeam=data;
  fillAdminTeamFilters();
  $('admin-new-person').hidden=!data.puede_editar;
  renderAdminPeople();renderAdminContracts();
}

function fillAdminTeamFilters(){
  const areas=(APP.adminTeam?.areas||[]).filter(a=>a.activo);
  for(const id of ['admin-people-area','admin-contract-area']){
    const select=$(id),current=select.value;
    select.innerHTML='<option value="">Todas las áreas</option>'+areas.map(a=>`<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
    if(areas.some(a=>String(a.id)===current))select.value=current;
  }
}

function filteredAdminPeople(kind){
  const data=APP.adminTeam;if(!data)return [];
  const contracts=kind==='contracts';
  const query=$(contracts?'admin-contract-search':'admin-people-search').value.trim().toLocaleLowerCase('es');
  const area=$(contracts?'admin-contract-area':'admin-people-area').value;
  const include=$(contracts?'admin-contract-inactive':'admin-people-inactive').checked;
  const onlyPending=contracts&&$('admin-contract-pending').checked;
  return (data.personas||[]).filter(p=>(include||p.activo)&&(!area||String(p.area_id)===area)
    &&(!query||`${p.nombre} ${p.dni||''}`.toLocaleLowerCase('es').includes(query))
    &&(!onlyPending||p.contrato_pendiente));
}

function renderAdminPeople(){
  if(!APP.adminTeam)return;
  const all=APP.adminTeam.personas||[],visible=filteredAdminPeople('people'),canEdit=!!APP.adminTeam.puede_editar;
  const active=all.filter(p=>p.activo),inactive=all.length-active.length,noDni=active.filter(p=>!p.dni).length,noPin=active.filter(p=>!p.tiene_pin).length,pending=active.filter(p=>p.contrato_pendiente).length;
  const kpis=[['ACTIVOS',active.length],['DADOS DE BAJA',inactive],['SIN DNI',noDni],['SIN PIN',noPin],['CONTRATO PENDIENTE',pending]];
  $('admin-people-kpis').innerHTML=kpis.map(x=>`<article class="admin-list-kpi"><small>${x[0]}</small><b>${x[1]}</b></article>`).join('');
  const groups=new Map();
  visible.forEach(p=>{const key=String(p.area_id);if(!groups.has(key))groups.set(key,{name:p.area||'Sin área',items:[]});groups.get(key).items.push(p)});
  let html='';
  for(const group of groups.values()){
    html+=`<section class="admin-people-group"><header><span><i></i><b>${esc(group.name)}</b></span><small>${group.items.length} persona${group.items.length===1?'':'s'}</small></header><div class="admin-person-card-grid">`;
    for(const p of group.items){
      const days=ADMIN_DAYS.map(([label,dow])=>{const mode=adminMode(p,dow),day=(p.horario_semanal||{})[String(dow)]||{},time=mode==='no_gestiona'?'':`${fmtTime(day.ini||p.hora_inicio)}–${fmtTime(day.fin||p.hora_fin)}`;return `<span class="admin-day-chip ${mode}"><b>${label}</b><i>${ADMIN_MODES[mode]?.[1]||'—'}</i><small>${esc(time)}</small></span>`}).join('');
      const summary=p.resumen||{},pct=summary.meta>0?Math.min(100,Math.round(Number(summary.cumplidas||0)/Number(summary.meta)*100)):0;
      const contract=summary.pendiente?'Contrato por confirmar':summary.meta>0?`${adminHours(summary.cumplidas)} de ${adminHours(summary.meta)} · ${pct}%`:'Contrato sin meta';
      html+=`<article class="admin-person-card ${p.activo?'':'inactive'}">
        <div class="admin-person-card-head"><span class="avatar">${initials(p.nombre)}</span><span><b>${esc(p.nombre)}</b><small>${esc(ADMIN_LINKS[p.tipo_vinculo]||p.tipo_vinculo)} · ${p.activo?'Activo':'Dado de baja'}</small></span><div>${canEdit?`<button type="button" data-team-edit="${p.id}" aria-label="Editar ${esc(p.nombre)}">Editar</button><button type="button" class="${p.activo?'danger':''}" data-team-status="${p.id}" data-next-active="${!p.activo}">${p.activo?'Dar de baja':'Reactivar'}</button>`:''}</div></div>
        <div class="admin-identity-line"><span>DNI <b>${esc(p.dni||'Sin registrar')}</b></span><span class="${p.tiene_pin?'ready':'missing'}">${p.tiene_pin?'PIN configurado':'Sin PIN'}</span><span>${p.tiene_cuenta?'Portal activado':'Aún no ingresó'}</span></div>
        <div class="admin-week-ledger">${days}</div>
        <div class="admin-person-contract ${summary.pendiente?'pending':''}"><span><small>SEGUIMIENTO</small><b>${esc(contract)}</b></span><i style="--contract-progress:${pct}%"></i></div>
      </article>`;
    }
    html+='</div></section>';
  }
  $('admin-people-list').innerHTML=html||'<p class="admin-empty">No hay colaboradores para los filtros seleccionados.</p>';
}

function contractState(person){
  const r=person.resumen||{};
  if(r.pendiente)return ['Pendiente','pending'];
  if(r.completado)return ['Completado','complete'];
  if((r.alertas||[]).length)return ['Requiere revisión','warning'];
  return ['En curso','active'];
}
function renderAdminContracts(){
  if(!APP.adminTeam)return;
  const all=(APP.adminTeam.personas||[]).filter(p=>p.activo),visible=filteredAdminPeople('contracts'),canEdit=!!APP.adminTeam.puede_editar;
  const pending=all.filter(p=>p.resumen?.pendiente).length,complete=all.filter(p=>p.resumen?.completado).length,alerts=all.filter(p=>(p.resumen?.alertas||[]).length&&!p.resumen?.pendiente).length,noMeta=all.filter(p=>!(Number(p.resumen?.meta)>0)).length;
  const kpis=[['CONTRATOS ACTIVOS',all.length],['PENDIENTES',pending],['COMPLETADOS',complete],['CON ALERTAS',alerts],['SIN META',noMeta]];
  $('admin-contract-kpis').innerHTML=kpis.map(x=>`<article class="admin-list-kpi"><small>${x[0]}</small><b>${x[1]}</b></article>`).join('');
  let html='<div class="admin-contract-head"><span>Colaborador</span><span>Avance principal</span><span>Jornada</span><span>Término estimado</span><span>Estado</span><span></span></div>';
  for(const p of visible){
    const r=p.resumen||{},meta=Number(r.meta)||0,done=Number(r.cumplidas)||0,pct=meta?Math.min(100,Math.round(done/meta*100)):0,[state,stateClass]=contractState(p);
    const projected=r.pendiente?'Por definir':r.completado?'Completado':adminDate(r.fecha_fin_estimada);
    const alerts=(r.alertas||[]).slice(0,2).map(x=>`<small>${esc(x)}</small>`).join('');
    const vol=r.voluntariado?`<div class="admin-vol-progress"><span>Voluntariado</span><b>${adminHours(r.voluntariado.cumplidas)} / ${adminHours(r.voluntariado.meta)}</b></div>`:'';
    html+=`<article class="admin-contract-row ${p.activo?'':'inactive'}">
      <span class="admin-contract-person"><i class="avatar">${initials(p.nombre)}</i><span><b>${esc(p.nombre)}</b><small>${esc(p.area||'Sin área')} · ${esc(ADMIN_LINKS[p.tipo_vinculo]||p.tipo_vinculo)}</small></span></span>
      <span class="admin-contract-progress"><span><b>${adminHours(done)} / ${adminHours(meta||null)}</b><small>${pct}% completado</small></span><i><u style="width:${pct}%"></u></i>${vol}</span>
      <span class="admin-contract-week"><b>${adminHours(r.semana_horas)}</b><small>por semana</small></span>
      <span class="admin-contract-date"><b>${esc(projected)}</b><small>${p.contrato_fin_referencia?'Documento: '+adminDate(p.contrato_fin_referencia):'Sin fecha de referencia'}</small></span>
      <span class="admin-contract-status"><b class="${stateClass}">${state}</b>${alerts}</span>
      <span class="admin-contract-action">${canEdit?`<button type="button" data-team-edit="${p.id}">Editar</button>`:''}</span>
    </article>`;
  }
  $('admin-contract-list').innerHTML=visible.length?html:'<p class="admin-empty">No hay contratos para los filtros seleccionados.</p>';
}

function scheduleRows(person){
  const generalStart=person?.hora_inicio?fmtTime(person.hora_inicio):'08:00',generalEnd=person?.hora_fin?fmtTime(person.hora_fin):'13:00',mixed=person?.tipo_vinculo==='ambos';
  return ADMIN_DAYS.map(([label,dow])=>{
    const day=(person?.horario_semanal||{})[String(dow)]||{},mode=person?adminMode(person,dow):(dow<=5?'virtual':'no_gestiona'),off=mode==='no_gestiona';
    const start=fmtTime(day.ini||generalStart),end=fmtTime(day.fin||generalEnd),link=day.vinc==='voluntariado'?'voluntariado':'practicas';
    return `<div class="admin-schedule-row ${off?'off':''}" data-schedule-day="${dow}"><b>${label}</b><select class="schedule-mode"><option value="no_gestiona" ${off?'selected':''}>No gestiona</option><option value="virtual" ${mode==='virtual'?'selected':''}>Virtual</option><option value="presencial" ${mode==='presencial'?'selected':''}>Presencial</option><option value="opcional" ${mode==='opcional'?'selected':''}>Opcional</option></select><input class="schedule-start" type="time" value="${start}" ${off?'disabled':''}><input class="schedule-end" type="time" value="${end}" ${off?'disabled':''}><select class="schedule-link" ${off||!mixed?'disabled':''}><option value="practicas" ${link==='practicas'?'selected':''}>Prácticas</option><option value="voluntariado" ${link==='voluntariado'?'selected':''}>Voluntariado</option></select></div>`;
  }).join('');
}

async function openAdminPerson(id){
  if(!APP.adminTeam?.puede_editar)return teamMsg('Tu rol permite consultar, pero no editar colaboradores.');
  const person=id?(APP.adminTeam.personas||[]).find(x=>String(x.id)===String(id)):null;
  $('admin-person-title').textContent=person?'Editar colaborador':'Nuevo colaborador';
  $('admin-person-id').value=person?.id||'';
  $('admin-person-name').value=person?.nombre||'';
  $('admin-person-dni').value=String(person?.dni||'').replace(/\D/g,'').slice(0,8);
  $('admin-person-link').value=person?.tipo_vinculo||'practicas';
  const areas=(APP.adminTeam.areas||[]).filter(a=>a.activo||String(a.id)===String(person?.area_id));
  $('admin-person-area').innerHTML=areas.map(a=>`<option value="${a.id}" ${String(a.id)===String(person?.area_id)?'selected':''}>${esc(a.nombre)}</option>`).join('');
  $('admin-area-create').hidden=true;$('admin-area-name').value='';
  $('admin-contract-is-pending').checked=!!person?.contrato_pendiente;
  $('admin-contract-note').value=person?.contrato_nota||'';
  $('admin-contract-start').value=String(person?.contrato_inicio||'').slice(0,10);
  $('admin-contract-end').value=String(person?.contrato_fin_referencia||'').slice(0,10);
  $('admin-contract-hours').value=person?.contrato_horas??'';
  $('admin-contract-previous').value=person?.horas_previas??0;
  $('admin-volunteer-hours').value=person?.contrato_horas_voluntariado??'';
  $('admin-general-start').value=fmtTime(person?.hora_inicio)==='—'?'08:00':fmtTime(person?.hora_inicio);
  $('admin-general-end').value=fmtTime(person?.hora_fin)==='—'?'13:00':fmtTime(person?.hora_fin);
  $('admin-schedule-grid').innerHTML=scheduleRows(person);
  $('admin-history-block').hidden=!person;
  $('admin-change-reason').value='';
  $('admin-history-list').innerHTML=person?'<p>Cargando historial…</p>':'';
  editorMsg('');updateAdminEditorConditions();
  $('admin-person-modal').hidden=false;document.body.style.overflow='hidden';
  setTimeout(()=>$('admin-person-name').focus(),30);
  if(person)loadAdminPersonHistory(person.id);
}

function closeAdminPerson(){
  if($('admin-person-save').disabled)return;
  $('admin-person-modal').hidden=true;document.body.style.overflow='';
}
function updateAdminEditorConditions(){
  const mixed=$('admin-person-link').value==='ambos',pending=$('admin-contract-is-pending').checked;
  $('admin-volunteer-hours-wrap').hidden=!mixed;
  $('admin-contract-note-wrap').hidden=!pending;
  $('admin-schedule-grid').classList.toggle('mixed',mixed);
  document.querySelectorAll('.admin-schedule-row').forEach(row=>{
    const off=row.querySelector('.schedule-mode').value==='no_gestiona';
    row.classList.toggle('off',off);
    row.querySelector('.schedule-start').disabled=off;
    row.querySelector('.schedule-end').disabled=off;
    row.querySelector('.schedule-link').disabled=off||!mixed;
  });
}

async function loadAdminPersonHistory(id){
  const {data,error}=await db.rpc('dash_admin_historial_colaborador',{p_colab:Number(id)});
  if(error||!data?.ok){$('admin-history-list').innerHTML='<p>No se pudo cargar el historial.</p>';return}
  const labels={horario:'Horario y modalidad',horas_contrato:'Meta de horas',fechas:'Fechas y datos del contrato',otro:'Identidad o estado'};
  $('admin-history-list').innerHTML=(data.historial||[]).length?(data.historial||[]).slice(0,12).map(h=>`<article><time>${adminDate(h.fecha)}</time><span><b>${esc(labels[h.tipo]||h.tipo)}</b><small>${esc(h.nota||'Sin motivo registrado')}${h.creado_por?' · '+esc(h.creado_por):''}</small></span></article>`).join(''):'<p>Sin cambios registrados.</p>';
}

async function createAdminArea(){
  const name=$('admin-area-name').value.trim();if(!name)return editorMsg('Escribe el nombre de la nueva área.');
  const button=$('admin-area-save');button.disabled=true;
  const {data,error}=await db.rpc('dash_admin_crear_area',{p_nombre:name});button.disabled=false;
  if(error||!data?.ok){const m={duplicada:'Ya existe un área con ese nombre.',nombre:'Escribe un nombre de 2 a 60 caracteres.',sin_permiso:'Tu rol no permite crear áreas.'};return editorMsg(m[data?.motivo]||'No se pudo crear el área.');}
  APP.adminTeam.areas.push(data.area);APP.adminTeam.areas.sort((a,b)=>(a.orden||0)-(b.orden||0)||a.nombre.localeCompare(b.nombre,'es'));
  $('admin-person-area').insertAdjacentHTML('beforeend',`<option value="${data.area.id}">${esc(data.area.nombre)}</option>`);
  $('admin-person-area').value=String(data.area.id);$('admin-area-create').hidden=true;$('admin-area-name').value='';
  fillAdminTeamFilters();editorMsg('');toast('Área creada.');
}

function collectAdminPerson(){
  const schedule={};let problem='';
  document.querySelectorAll('[data-schedule-day]').forEach(row=>{
    if(problem)return;
    const mod=row.querySelector('.schedule-mode').value;if(mod==='no_gestiona')return;
    const ini=row.querySelector('.schedule-start').value,fin=row.querySelector('.schedule-end').value;
    if(!ini||!fin||fin<=ini){problem=`Revisa el horario de ${row.querySelector('b').textContent}: la salida debe ser posterior a la entrada.`;return}
    schedule[row.dataset.scheduleDay]={mod,ini,fin,vinc:row.querySelector('.schedule-link').value};
  });
  if(problem)throw new Error(problem);
  const id=$('admin-person-id').value,person=id?(APP.adminTeam.personas||[]).find(x=>String(x.id)===id):null;
  return {id:id?Number(id):null,area_id:Number($('admin-person-area').value),nombre:$('admin-person-name').value.trim(),dni:$('admin-person-dni').value.trim()||null,tipo_vinculo:$('admin-person-link').value,activo:person?.activo??true,hora_inicio:$('admin-general-start').value||null,hora_fin:$('admin-general-end').value||null,horario_semanal:schedule,contrato_inicio:$('admin-contract-start').value||null,contrato_fin_referencia:$('admin-contract-end').value||null,contrato_horas:$('admin-contract-hours').value===''?null:Number($('admin-contract-hours').value),horas_previas:$('admin-contract-previous').value===''?0:Number($('admin-contract-previous').value),contrato_horas_voluntariado:$('admin-volunteer-hours').value===''?null:Number($('admin-volunteer-hours').value),contrato_pendiente:$('admin-contract-is-pending').checked,contrato_nota:$('admin-contract-note').value.trim()||null};
}

async function saveAdminPerson(event){
  event.preventDefault();editorMsg('');
  const name=$('admin-person-name').value.trim(),dni=$('admin-person-dni').value.trim();
  if(name.length<2)return editorMsg('Escribe el nombre completo.');
  if(dni&&!/^\d{8}$/.test(dni))return editorMsg('El DNI debe tener exactamente 8 dígitos.');
  if($('admin-contract-start').value&&$('admin-contract-end').value&&$('admin-contract-end').value<$('admin-contract-start').value)return editorMsg('La fecha final no puede ser anterior al inicio del contrato.');
  let payload;try{payload=collectAdminPerson()}catch(e){return editorMsg(e.message)}
  const button=$('admin-person-save');button.disabled=true;button.textContent='Guardando…';
  const {data,error}=await db.rpc('dash_admin_guardar_colaborador',{p_datos:payload,p_motivo:$('admin-change-reason').value.trim()||null});
  button.disabled=false;button.textContent='Guardar cambios';
  if(error||!data?.ok){
    const messages={sin_permiso:'Tu rol no permite editar.',nombre:'Revisa el nombre completo.',dni:'El DNI debe tener 8 dígitos.',dni_duplicado:'Ese DNI ya pertenece a otro colaborador.',area:'Selecciona un área activa.',horario:'Hay un día con horario incompleto o incoherente.',horario_general:'La salida general debe ser posterior a la entrada.',fechas:'La fecha final no puede ser anterior al inicio.',horas:'Las horas no pueden ser negativas.',duplicado:'Ya existe un registro con uno de estos datos.'};
    return editorMsg(messages[data?.motivo]||error?.message||'No se pudo guardar la ficha.');
  }
  closeAdminPerson();await loadAdminTeam();toast(data.nuevo?'Colaborador creado.':'Cambios guardados en el historial.');
}

async function changeAdminPersonStatus(id,next){
  const person=(APP.adminTeam?.personas||[]).find(x=>String(x.id)===String(id));if(!person)return;
  if(!confirm(next?`¿Reactivar a ${person.nombre}?`:`¿Dar de baja a ${person.nombre}? Su asistencia e historial se conservarán.`))return;
  const {data,error}=await db.rpc('dash_admin_estado_colaborador',{p_colab:Number(id),p_activo:next});
  if(error||!data?.ok)return teamMsg('No se pudo cambiar el estado del colaborador.');
  await loadAdminTeam();toast(next?'Colaborador reactivado.':'Colaborador dado de baja; su historial se conserva.');
}

['admin-people-search','admin-contract-search'].forEach(id=>$(id).addEventListener('input',()=>id.includes('contract')?renderAdminContracts():renderAdminPeople()));
['admin-people-area','admin-people-inactive'].forEach(id=>$(id).addEventListener('change',renderAdminPeople));
['admin-contract-area','admin-contract-inactive','admin-contract-pending'].forEach(id=>$(id).addEventListener('change',renderAdminContracts));
$('admin-new-person').onclick=()=>openAdminPerson();
$('admin-people-list').onclick=e=>{const edit=e.target.closest('[data-team-edit]'),status=e.target.closest('[data-team-status]');if(edit)return openAdminPerson(edit.dataset.teamEdit);if(status)return changeAdminPersonStatus(status.dataset.teamStatus,status.dataset.nextActive==='true')};
$('admin-contract-list').onclick=e=>{const edit=e.target.closest('[data-team-edit]');if(edit)openAdminPerson(edit.dataset.teamEdit)};
document.querySelectorAll('[data-close-person]').forEach(x=>x.onclick=closeAdminPerson);
$('admin-person-form').addEventListener('submit',saveAdminPerson);
$('admin-person-dni').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,8));
$('admin-person-link').addEventListener('change',updateAdminEditorConditions);
$('admin-contract-is-pending').addEventListener('change',updateAdminEditorConditions);
$('admin-schedule-grid').addEventListener('change',e=>{if(e.target.classList.contains('schedule-mode'))updateAdminEditorConditions()});
$('admin-area-reveal').onclick=()=>{$('admin-area-create').hidden=!$('admin-area-create').hidden;if(!$('admin-area-create').hidden)$('admin-area-name').focus()};
$('admin-area-save').onclick=createAdminArea;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('admin-person-modal').hidden)closeAdminPerson()});
