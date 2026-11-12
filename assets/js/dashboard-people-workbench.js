/* Colaboradores · escritorio. Consulta, informes y jornadas fechadas. */
const PEOPLE_WORKBENCH={tab:'equipo',metric:'all',collapsed:new Set(),profile:null,profileTab:'resumen',extra:{},request:0,origin:null,shift:null};
function peopleDesktop(){return typeof window!=='undefined'&&window.matchMedia('(min-width: 901px)').matches;}
function peopleToday(){return APP.adminTeam?.hoy||isoLima();}
function peopleNextDate(date){return new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
function peoplePeriods(person){return [...(person.jornadas||[])].sort((a,b)=>a.desde.localeCompare(b.desde)||Number(a.id)-Number(b.id));}
function peopleCurrentPeriod(person,date=peopleToday()){
  const list=peoplePeriods(person),temporary=list.find(j=>j.tipo==='temporal'&&j.desde<=date&&j.hasta>=date);
  return temporary||list.filter(j=>j.tipo==='principal'&&j.desde<=date).at(-1)||null;
}
function peopleUpcomingMarkup(person){
  const next=peoplePeriods(person).find(j=>j.desde>peopleToday());if(!next)return '';
  const label=next.tipo==='temporal'?'Horario temporal':'Jornada principal';
  return `<section class="pw-panel pw-upcoming" aria-label="Próximo cambio de jornada"><header><h3>Próximo cambio de jornada</h3>${peopleTag('Programada','warn')}</header><p><b>${esc(label)}: ${esc(adminDate(next.desde))} → ${next.hasta?esc(adminDate(next.hasta)):'Fin indeterminado'}</b></p><p>${next.desde===peopleNextDate(peopleToday())?'Empieza mañana.':'Se aplicará desde la fecha indicada.'} La tabla de jornada vigente corresponde a hoy, ${esc(adminDate(peopleToday()))}.</p>${peopleWeekTable(person,next.semana)}</section>`;
}
function peopleKind(person){
  if(!person.activo)return ['Dado de baja','neutral'];
  if(person.jornada_finalizada)return ['Jornada finalizada','neutral'];
  if(peopleCurrentPeriod(person)?.tipo==='temporal')return ['Temporal','warn'];
  if((person.semana_vigente||[]).some(d=>d.fecha===peopleToday()&&d.temporal))return ['Ajuste por fecha','warn'];
  if(person.contrato_pendiente)return ['Contrato pendiente','warn'];
  return ['Principal','good'];
}
function peopleTag(label,tone='neutral'){return `<span class="pw-tag pw-${tone}">${esc(label)}</span>`;}
function peopleButton(label,attr='',primary=false){return `<button type="button" class="pw-button${primary?' pw-primary':''}" ${attr}>${label}</button>`;}
function peopleEffectiveWeek(person){
  const dated=typeof adminScheduleWeek==='function'?adminScheduleWeek(person):null;
  if(!peopleCurrentPeriod(person)&&dated)return Object.fromEntries(dated.map(d=>[String(new Date(d.fecha+'T12:00:00Z').getUTCDay()||7),{mod:d.laborable?d.modalidad||'virtual':'no_gestiona',ini:d.entrada,fin:d.salida}]));
  return person.horario_vigente||person.horario_semanal||{};
}
function peopleWeekTable(person,week=peopleEffectiveWeek(person)){
  return `<table class="pw-week"><caption class="sr-only">Jornada semanal de ${esc(person.nombre)}</caption><thead><tr><th scope="col">Día</th><th scope="col">Modalidad</th><th scope="col">Entrada</th><th scope="col">Salida</th>${person.tipo_vinculo==='ambos'?'<th scope="col">Vínculo</th>':''}</tr></thead><tbody>${ADMIN_DAYS.map(([label,dow])=>{
    const day=week[String(dow)]||{},mode=day.mod||adminMode(person,dow),off=mode==='no_gestiona';
    return `<tr class="${off?'':'pw-working'}"><th scope="row">${esc(label)}</th><td>${esc(ADMIN_MODES[mode]?.[0]||'Sin gestión')}</td><td>${off?'—':esc(fmtTime(day.ini||person.hora_inicio))}</td><td>${off?'—':esc(fmtTime(day.fin||person.hora_fin))}</td>${person.tipo_vinculo==='ambos'?`<td>${off?'—':esc(ADMIN_LINKS[day.vinc||'practicas'])}</td>`:''}</tr>`;
  }).join('')}</tbody></table>`;
}
function peopleCard(person){
  const [kind,tone]=peopleKind(person),r=person.resumen||{},week=peopleEffectiveWeek(person),period=peopleCurrentPeriod(person);
  const days=ADMIN_DAYS.filter(([,d])=>(week[String(d)]?.mod||adminMode(person,d))!=='no_gestiona').map(([s])=>s).join(' · ')||'Sin jornada programada';
  const working=Object.values(week).filter(d=>d.mod!=='no_gestiona'),times=[...new Set(working.map(d=>`${fmtTime(d.ini||person.hora_inicio)}–${fmtTime(d.fin||person.hora_fin)}`))];
  const hours=times.length===1?times[0]:times.length?'Horario por día':'—';
  const pct=r.meta>0?Math.min(100,Math.round(Number(r.cumplidas||0)/Number(r.meta)*100)):null;
  const upcoming=peoplePeriods(person).find(j=>j.desde>peopleToday());
  const range=period?(period.hasta?`Hasta ${adminDate(period.hasta)}`:'Fin indeterminado'):'Horario habitual';
  return `<article class="pw-card${person.activo?'':' pw-inactive'}"><header>${profileAvatarMarkup(person)}<div class="pw-card-identity"><h3>${esc(person.nombre)}</h3><p>${esc(person.institucion||'Sin institución')} · ${esc(ADMIN_LINKS[person.tipo_vinculo]||person.tipo_vinculo)}</p></div>${peopleTag(kind,tone)}${APP.adminTeam?.puede_editar?`<button type="button" class="pw-card-edit" data-team-edit="${esc(person.id)}" aria-label="Editar datos y contrato de ${esc(person.nombre)}" title="Editar colaborador"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z"/></svg></button>`:''}</header><div class="pw-card-days">${esc(days)}<small>${esc(hours)}</small></div><dl class="pw-card-data"><div><dt>Vigencia</dt><dd>${esc(range)}</dd></div><div><dt>Avance principal</dt><dd>${r.pendiente?'Por confirmar':r.meta>0?`${esc(adminHours(r.cumplidas||0))} / ${esc(adminHours(r.meta))}`:'Sin meta'}</dd></div><div><dt>Acceso</dt><dd>${!person.activo?'Inactivo':person.tiene_pin?'PIN listo':'Sin PIN'}</dd></div></dl>${pct==null?'<p class="pw-no-meta">Meta pendiente de definir</p>':`<div class="pw-progress" role="progressbar" aria-label="Avance principal de ${esc(person.nombre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`}<footer><small>${upcoming?`<b class="pw-card-next">Nuevo ${upcoming.tipo==='temporal'?'horario temporal':'horario'} desde ${esc(adminDate(upcoming.desde))}</b>`:person.jornada_finalizada?'No se exigen nuevas jornadas':period?.tipo==='temporal'?`Retorno: ${esc(adminDate(peopleNextDate(period.hasta)))}`:person.activo?'Colaborador activo':'Historial conservado'}</small>${peopleButton('Ver ficha <span aria-hidden="true">↗</span>',`data-team-profile="${person.id}" aria-label="Ver ficha de ${esc(person.nombre)}"`)}</footer></article>`;
}
function initPeopleWorkbench(){
  const section=$('admin-people-section');if(!section||section.hasAttribute('data-workbench'))return;
  section.dataset.workbench='';section.classList.add('pw-workbench');
  section.querySelector('.admin-team-heading h2').textContent='Colaboradores';
  section.querySelector('.eyebrow').textContent='PERSONAS, IDENTIDAD Y JORNADA';
  const nav=document.createElement('nav');nav.className='pw-tabs';nav.setAttribute('aria-label','Vistas de Colaboradores');
  nav.innerHTML=['equipo','informes','areas'].map((id,i)=>`<button type="button" data-pw-tab="${id}" aria-pressed="${i===0}">${['Equipo','Informes','Áreas'][i]}</button>`).join('');
  section.querySelector('.admin-team-toolbar').after(nav);
  const toolbar=section.querySelector('.admin-team-toolbar'),actions=section.querySelector('.admin-team-actions');
  toolbar.append($('admin-new-person'));nav.after(actions);
  const more=document.createElement('details');more.className='pw-more-filters';more.innerHTML='<summary>Más filtros</summary><div></div>';
  more.querySelector('div').append($('admin-people-email'),$('admin-people-inactive').closest('label'));actions.append(more);
  const legend=document.createElement('p');legend.id='pw-result-count';legend.className='pw-results';legend.setAttribute('role','status');legend.setAttribute('aria-live','polite');
  $('admin-people-list').before(legend);
  const areasEmpty=document.createElement('p');areasEmpty.id='pw-areas-readonly';areasEmpty.className='pw-notice';areasEmpty.hidden=true;areasEmpty.textContent='Tu rol permite consultar el directorio. La gestión de áreas requiere permiso de edición.';$('admin-areas-panel').after(areasEmpty);
  nav.onclick=e=>{const b=e.target.closest('[data-pw-tab]');if(b)peopleSwitchTab(b.dataset.pwTab);};
  $('admin-people-kpis').onclick=e=>{const b=e.target.closest('[data-pw-metric]');if(!b)return;PEOPLE_WORKBENCH.metric=b.dataset.pwMetric;renderAdminPeople();$('admin-people-kpis').querySelector(`[data-pw-metric="${CSS.escape(b.dataset.pwMetric)}"]`)?.focus();};
  $('admin-people-list').addEventListener('click',e=>{
    const b=e.target.closest('[data-team-profile], [data-pw-collapse]');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(b.hasAttribute('data-team-profile'))return openPeopleProfile(b.dataset.teamProfile,b);
    const key=b.dataset.pwCollapse;PEOPLE_WORKBENCH.collapsed.has(key)?PEOPLE_WORKBENCH.collapsed.delete(key):PEOPLE_WORKBENCH.collapsed.add(key);
    renderAdminPeople();$('admin-people-list').querySelector(`[data-pw-collapse="${CSS.escape(key)}"]`)?.focus();
  },true);
  $('admin-areas-panel').addEventListener('click',e=>{if(e.target.closest('[data-area-action="people"]'))peopleSwitchTab('equipo');});
  $('admin-areas-close').addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();peopleSwitchTab('equipo');document.querySelector('[data-pw-tab="equipo"]').focus();},true);
  createPeopleDialogs();
}
function peopleSwitchTab(tab){PEOPLE_WORKBENCH.tab=tab;renderAdminPeople();}
function renderPeopleWorkbench(){
  if(!peopleDesktop())return false;
  initPeopleWorkbench();
  const state=PEOPLE_WORKBENCH,all=APP.adminTeam.personas||[],active=all.filter(p=>p.activo),canEdit=!!APP.adminTeam.puede_editar;
  const counts=[['all','Directorio',all.length,`${active.length} activos · ${all.length-active.length} bajas`],['dni','Sin DNI',active.filter(p=>!p.dni).length,`de ${active.length} activos`],['pin','Sin PIN',active.filter(p=>!p.tiene_pin).length,`de ${active.length} activos`],['pending','Contrato pendiente',active.filter(p=>p.contrato_pendiente).length,`de ${active.length} activos`]];
  $('admin-people-kpis').innerHTML=counts.map(([key,label,num,scope])=>`<button type="button" data-pw-metric="${key}" aria-pressed="${state.metric===key}"><small>${label}</small><span><b>${num}</b><small>${scope}</small></span></button>`).join('');
  const visible=filteredAdminPeople('people').filter(p=>state.metric==='all'||p.activo&&(state.metric==='dni'?!p.dni:state.metric==='pin'?!p.tiene_pin:p.contrato_pendiente));
  const groups=new Map();for(const p of visible){const key=String(p.area_id);if(!groups.has(key))groups.set(key,{name:p.area||'Sin área',people:[]});groups.get(key).people.push(p);}
  $('admin-people-list').innerHTML=[...groups].map(([key,g])=>{
    const collapsed=state.collapsed.has(key),id=`pw-area-${key}`,temp=g.people.filter(p=>peopleCurrentPeriod(p)?.tipo==='temporal').length;
    return `<section class="pw-area"><header><h3>${esc(g.name)}</h3><small>${g.people.length} ${g.people.length===1?'persona':'personas'}</small>${temp?peopleTag(`${temp} temporal${temp===1?'':'es'}`,'warn'):''}${peopleButton(collapsed?'Mostrar':'Contraer',`data-pw-collapse="${esc(key)}" aria-expanded="${!collapsed}" aria-controls="${esc(id)}"`)}</header><div id="${esc(id)}" class="pw-card-grid" ${collapsed?'hidden':''}>${g.people.map(peopleCard).join('')}</div></section>`;
  }).join('')||'<div class="pw-empty"><h3>Sin colaboradores para estos filtros</h3><p>Prueba otro nombre o cambia el área, la institución o el indicador seleccionado.</p><button type="button" class="pw-button" data-pw-clear>Limpiar filtros</button></div>';
  $('admin-people-list').querySelector('[data-pw-clear]')?.addEventListener('click',()=>{for(const id of ['admin-people-search','admin-people-area','admin-people-institution','admin-people-email'])$(id).value='';$('admin-people-inactive').checked=false;state.metric='all';renderAdminPeople();$('admin-people-search').focus();});
  $('pw-result-count').textContent=`${visible.length} resultados · Los indicadores muestran el directorio completo. ${$('admin-people-inactive').checked?'Incluye bajas.':'Solo activos.'}`;
  const filterCount=Number(!!$('admin-people-email').value)+Number($('admin-people-inactive').checked);
  document.querySelector('.pw-more-filters summary').textContent=`Más filtros${filterCount?' · '+filterCount:''}`;
  document.querySelectorAll('[data-pw-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pwTab===state.tab)));
  for(const id of ['admin-people-list','admin-people-kpis','pw-result-count'])$(id).hidden=state.tab!=='equipo';
  document.querySelector('#admin-people-section .admin-team-actions').hidden=state.tab!=='equipo';
  $('admin-new-person').hidden=!canEdit||state.tab!=='equipo';
  $('admin-attendance-export-card').hidden=state.tab!=='informes';
  const preview=$('attendance-report-preview');if(state.tab!=='informes'){if(!preview.hidden)preview.dataset.pwWasVisible='';preview.hidden=true;}else if(preview.hasAttribute('data-pw-was-visible'))preview.hidden=false;
  $('admin-areas-panel').hidden=state.tab!=='areas'||!canEdit;$('pw-areas-readonly').hidden=state.tab!=='areas'||canEdit;
  $('admin-manage-areas').hidden=true;
  if(typeof renderAttendanceExport==='function')renderAttendanceExport();
  return true;
}
function createPeopleDialogs(){
  if($('pw-profile-dialog'))return;
  for(const [id,label] of [['pw-profile-dialog','Ficha del colaborador'],['pw-shift-dialog','Programar jornada']]){
    const d=document.createElement('dialog');d.id=id;d.className='pw-modal';d.setAttribute('aria-label',label);document.body.append(d);
    d.addEventListener('cancel',e=>{if(id==='pw-shift-dialog'&&PEOPLE_WORKBENCH.shift?.busy)e.preventDefault();});
  }
  $('pw-profile-dialog').addEventListener('close',()=>{PEOPLE_WORKBENCH.request++;PEOPLE_WORKBENCH.profile=null;restorePeopleFocus();});
  $('pw-profile-dialog').addEventListener('click',handlePeopleProfileClick);
  $('pw-shift-dialog').addEventListener('close',()=>{PEOPLE_WORKBENCH.shift=null;});
  $('pw-shift-dialog').addEventListener('change',e=>{
    if(e.target.id==='pw-shift-indefinite'){const end=$('pw-shift-until');end.disabled=e.target.checked;end.required=!e.target.checked;}
    if(e.target.matches('[data-pw-day-mode]')){const row=e.target.closest('[data-pw-day]');row.querySelectorAll('input').forEach(x=>x.disabled=e.target.value==='no_gestiona');}
  });
  $('pw-shift-dialog').addEventListener('click',e=>{if(e.target.closest('[data-pw-shift-close]')&&!PEOPLE_WORKBENCH.shift?.busy)$('pw-shift-dialog').close();if(e.target.closest('[data-pw-shift-back]')){PEOPLE_WORKBENCH.shift.review=false;showPeopleShiftStep();}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&!$('pw-shift-dialog')?.open){
      const legacy=[$('admin-person-modal'),$('admin-days-off-modal')].find(el=>el&&!el.hidden&&(el.classList.contains('pw-legacy-editor')||el.classList.contains('pw-days-off')));
      if(legacy){const nodes=[...legacy.querySelectorAll('button,input:not([type=hidden]),select,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(first&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last)||!legacy.contains(document.activeElement))){e.preventDefault();(e.shiftKey?last:first).focus();}}
    }
    const tab=e.target.closest('[data-pw-profile-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();const tabs=[...$('pw-profile-dialog').querySelectorAll('[data-pw-profile-tab]')],i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();
  });
}
function resetPeopleWorkbench(){
  PEOPLE_WORKBENCH.request++;PEOPLE_WORKBENCH.origin=null;
  for(const id of ['pw-shift-dialog','pw-profile-dialog'])if($(id)?.open)$(id).close();
  PEOPLE_WORKBENCH.profile=null;PEOPLE_WORKBENCH.extra={};PEOPLE_WORKBENCH.shift=null;
  if(typeof ADMIN_EDITOR_REQUEST!=='undefined')ADMIN_EDITOR_REQUEST++;
  for(const [id,cls] of [['admin-person-modal','pw-legacy-editor'],['admin-days-off-modal','pw-days-off']])if($(id)?.classList.contains(cls))$(id).hidden=true;
  PEOPLE_WORKBENCH.editorOrigin=null;document.body.style.overflow='';
}
function restorePeopleFocus(){
  const state=PEOPLE_WORKBENCH;if(state.origin?.isConnected)return state.origin.focus();
  ($('admin-people-list')?.querySelector('[data-team-profile]')||$('admin-people-search'))?.focus();
}
async function openPeopleProfile(id,trigger,tab){
  if(!APP.access.acceso_panel)return;
  const state=PEOPLE_WORKBENCH,person=APP.adminTeam?.personas.find(p=>String(p.id)===String(id));if(!person)return;
  createPeopleDialogs();state.profile=person;state.profileTab=PEOPLE_PROFILE_TABS.some(([t])=>t===tab)?tab:'resumen';state.extra={loading:true};state.origin=trigger||document.activeElement;
  const request=++state.request;renderPeopleProfile();const dialog=$('pw-profile-dialog');if(!dialog.open)dialog.showModal();
  const results=await Promise.allSettled([db.rpc('dash_admin_horario_compartir',{p_colab:Number(id)}),Promise.resolve({data:null})]);
  if(request!==state.request||!dialog.open)return;
  const value=result=>result.status==='fulfilled'&&!result.value.error&&result.value.data?.ok?result.value.data:null;
  state.extra={facebook:value(results[0]),history:value(results[1]),loading:false};renderPeopleProfile();
}
// Ficha del colaborador: una tarjeta por pestaña y flechas para recorrerlas en orden.
const PEOPLE_PROFILE_TABS=[['resumen','Resumen'],['jornada','Jornada'],['facebook','Facebook'],['contrato','Contrato'],['historial','Historial']];
function peopleProfileBody(person,tab){
  const state=PEOPLE_WORKBENCH;
  if(tab==='historial')return '<div id="pw-history-page"><p class="pw-notice">Cargando historial…</p></div>';
  if(tab==='jornada'){
    const current=peopleCurrentPeriod(person),periods=peoplePeriods(person),next=periods.find(j=>j.desde>peopleToday()),canEdit=APP.adminTeam.puede_editar&&person.activo,enabled=APP.adminTeam.jornadas_disponibles;
    // Los cambios de horario se programan desde el editor (pantalla Jornada); aquí queda el acceso directo.
    const actions=canEdit?`<div class="pw-panel-actions">${peopleButton('Cambiar jornada','data-pw-edit-jornada title="Abre el editor en la pantalla Jornada para cambiar el horario"')}</div>`:'';
    const timeline=periods.length?`<details class="pw-periods"><summary>Períodos registrados · ${periods.length}</summary><details class="pw-baseline"><summary>Horario habitual anterior a las vigencias</summary><p>Referencia conservada; no reconstruye cambios antiguos que no se registraron por fecha.</p>${peopleWeekTable(person,person.horario_semanal||{})}</details>${periods.map(j=>`<article class="pw-timeline"><div>${peopleTag(j.tipo==='temporal'?'Temporal':'Principal',j.tipo==='temporal'?'warn':'neutral')}${j.desde>peopleToday()?peopleTag('Programada','warn'):''}<b>${esc(adminDate(j.desde))} → ${j.hasta?esc(adminDate(j.hasta)):'Fin indeterminado'}</b></div><p>${esc(j.motivo)}</p><details><summary>Ver semana de este período</summary>${peopleWeekTable(person,j.semana)}</details></article>`).join('')}</details>`:'';
    const adjustments=(person.horarios_temporales||[]).length?`<details class="pw-periods"><summary>Ajustes por fecha anteriores</summary>${adminTemporaryScheduleMarkup(person)}</details>`:'';
    return `<section class="pw-panel"><header><h3>Jornada vigente</h3>${peopleTag(...peopleKind(person))}${actions}</header>${next?`<p class="pw-notice" data-pw-current-note>Este horario corresponde a hoy. Tienes ${next.tipo==='temporal'?'un horario temporal':'una nueva jornada principal'} desde el <b>${esc(adminDate(next.desde))}</b>; ${next.desde===peopleNextDate(peopleToday())?'empieza mañana.':'puedes consultarla más abajo.'}</p>`:''}${peopleWeekTable(person)}<p class="pw-period">${current?`${adminDate(current.desde)} → ${current.hasta?adminDate(current.hasta):'Fin indeterminado'}`:'Horario habitual de referencia'}</p>${person.jornada_finalizada?'<p class="pw-notice">Terminó la vigencia principal. No hay nuevas jornadas exigibles hasta programar otra.</p>':''}${timeline}${adjustments}</section>${peopleUpcomingMarkup(person)}`;
  }
  const sections=adminProfileSections(person,state.extra);
  if(tab==='facebook')return profileSectionsMarkup(sections.filter(s=>s.title==='Horario de Facebook'));
  if(tab==='contrato'){
    // El documento solo aparece cuando existe; ya no se ocupa un bloque para decir que falta.
    const doc=typeof viewContractDocumentOf==='function'&&person.contrato_documento?`<div class="pw-doc-row"><span><b>Documento del contrato</b><small>Archivo registrado para esta persona.</small></span>${peopleButton('Ver documento','data-pw-contract-document')}</div>`:'';
    return profileSectionsMarkup(sections.filter(s=>['Contrato y avance','Voluntariado','Observaciones de seguimiento'].includes(s.title)))+doc;
  }
  return profileSectionsMarkup(sections.filter(s=>s.title==='Identidad y vínculo'));
}
function renderPeopleProfile(){
  const state=PEOPLE_WORKBENCH,p=state.profile;if(!p)return;
  const dialog=$('pw-profile-dialog'),focused=document.activeElement,oldTab=focused?.dataset?.pwProfileTab,oldStep=focused?.dataset?.pwProfileStep;
  const index=Math.max(0,PEOPLE_PROFILE_TABS.findIndex(([id])=>id===state.profileTab)),canEdit=APP.adminTeam.puede_editar;
  const step=dir=>`<button type="button" class="pw-step" data-pw-profile-step="${dir}" aria-label="${dir<0?'Sección anterior':'Sección siguiente'}" title="${dir<0?'Sección anterior':'Sección siguiente'}" ${(dir<0?index===0:index===PEOPLE_PROFILE_TABS.length-1)?'disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir<0?'m15 5-7 7 7 7':'m9 5 7 7-7 7'}"/></svg></button>`;
  const edit=canEdit?`<button type="button" class="pw-button pw-head-icon" data-pw-edit aria-label="Editar datos y contrato de ${esc(p.nombre)}" title="Editar datos y contrato"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z"/></svg></button>`:'';
  const more=canEdit?`<details class="pw-actions pw-more"><summary aria-label="Más acciones" title="Más acciones">•••</summary><div>${peopleButton(p.activo?'Dar de baja':'Reactivar','data-pw-status')}${!p.activo?peopleButton('Eliminar definitivamente','data-pw-delete'):''}</div></details>`:'';
  dialog.innerHTML=`<header class="pw-modal-head">${profileAvatarMarkup(p)}<div><p>FICHA DEL COLABORADOR</p><h2>${esc(p.nombre)}</h2><small>${esc(p.area||'Sin área')} · ${esc(ADMIN_LINKS[p.tipo_vinculo])} · DNI ${esc(p.dni||'sin registrar')}</small></div>${edit}${peopleButton('×','data-pw-profile-close aria-label="Cerrar ficha"')}</header><div class="pw-profile-nav">${step(-1)}<nav class="pw-profile-tabs" role="tablist" aria-label="Información de la persona">${PEOPLE_PROFILE_TABS.map(([id,label])=>`<button type="button" id="pw-tab-${id}" data-pw-profile-tab="${id}" role="tab" aria-selected="${state.profileTab===id}" aria-controls="pw-profile-content" tabindex="${state.profileTab===id?0:-1}">${label}</button>`).join('')}</nav>${step(1)}</div><div class="pw-modal-body" id="pw-profile-content" role="tabpanel" aria-labelledby="pw-tab-${state.profileTab}" tabindex="0">${peopleProfileBody(p,state.profileTab)}</div><footer class="pw-modal-foot"><div><button type="button" class="pw-button pw-soft" data-pw-attendance>Ver asistencias</button>${APP.access.rol==='direccion'?peopleButton(`Días libres${p.dias_libres_saldo==null?'':` · ${p.dias_libres_saldo}`}`,'data-pw-days-off'):''}</div><div>${peopleButton('Ficha PDF','data-pw-profile-pdf')}${more}</div></footer>`;
  if(oldTab)dialog.querySelector(`[data-pw-profile-tab="${CSS.escape(oldTab)}"]`)?.focus();
  else if(oldStep){const same=dialog.querySelector(`[data-pw-profile-step="${CSS.escape(oldStep)}"]`);(same&&!same.disabled?same:dialog.querySelector(`[data-pw-profile-tab="${CSS.escape(state.profileTab)}"]`))?.focus();}
  if(state.profileTab==='historial')loadPeopleHistoryPage(p,dialog);
}
function loadPeopleHistoryPage(person,dialog){
 const container=$('pw-history-page'),request=PEOPLE_WORKBENCH.request;
 return KJAHistoryPages.open({container,rpc:(name,args)=>db.rpc(name,args),name:'dash_admin_historial_colaborador_pagina',
  legacy:'dash_admin_historial_colaborador',id:person.id,key:'historial',scope:adminHistoryScope,
  isCurrent:()=>container.isConnected&&dialog.open&&PEOPLE_WORKBENCH.request===request&&PEOPLE_WORKBENCH.profile===person&&PEOPLE_WORKBENCH.profileTab==='historial',
  render:(items,data)=>{
   const extra={...PEOPLE_WORKBENCH.extra,history:{...data,historial:items}};
   container.innerHTML=(data.revisar_meta===true?'<p class="pw-notice">Revisar meta contractual: hubo cambios de horas junto con fechas u horarios. Compara la meta con el contrato.</p>':'')+profileSectionsMarkup(adminProfileSections(person,extra).filter(section=>section.title==='Historial de cambios'));
  }});
}
async function handlePeopleProfileClick(e){
  const b=e.target.closest('button');if(!b)return;
  const state=PEOPLE_WORKBENCH,p=state.profile;if(!p)return;
  if(b.hasAttribute('data-pw-profile-close'))return $('pw-profile-dialog').close();
  if(b.dataset.pwProfileTab){state.profileTab=b.dataset.pwProfileTab;renderPeopleProfile();$('pw-profile-dialog').querySelector(`[data-pw-profile-tab="${CSS.escape(state.profileTab)}"]`).focus();return;}
  if(b.dataset.pwProfileStep){const i=PEOPLE_PROFILE_TABS.findIndex(([id])=>id===state.profileTab)+Number(b.dataset.pwProfileStep);if(i<0||i>=PEOPLE_PROFILE_TABS.length)return;state.profileTab=PEOPLE_PROFILE_TABS[i][0];b.focus();renderPeopleProfile();return;}
  if(b.hasAttribute('data-pw-profile-retry'))return openPeopleProfile(p.id,state.origin);
  if(b.dataset.pwShift)return openPeopleShift(p,b.dataset.pwShift);
  if(b.hasAttribute('data-pw-contract-document'))return viewContractDocumentOf(p.id);
  if(b.hasAttribute('data-pw-profile-pdf')){
    b.disabled=true;b.textContent='Preparando…';
    const request=state.request,live=()=>request===state.request&&APP.access.acceso_panel;
    try{
      await KJAFacebookPDF.load();
      if(!live())return;
      const [attendance,activity,history]=await Promise.all([loadProfileAttendance(p,peopleToday(),live),APP.access.rol==='direccion'?db.rpc('dash_reporte_facebook',{p_desde:peopleToday().slice(0,7)+'-01',p_hasta:peopleToday()}):Promise.resolve({data:null}),db.rpc('dash_admin_historial_colaborador',{p_colab:Number(p.id)})]);
      if(!live())return;
      if(!attendance?.ok)throw Error('No se pudo cargar el historial de asistencia. Reintenta la descarga.');
      if(history.error||!history.data?.ok)throw Error('No se pudo cargar el historial de cambios. Reintenta la descarga.');
      buildAdminProfilePdf(p,adminProfileSections(p,{...state.extra,history:history.data,attendance,activity:activity.data})).save(`KJA_Ficha_${String(p.id)}.pdf`);
    }catch(error){toast(error.message||'No se pudo generar la ficha.',true);}finally{b.disabled=false;b.textContent='Ficha PDF';}return;
  }
  if(b.hasAttribute('data-pw-attendance')){
    if(typeof ATTENDANCE_EXPORT_IDS!=='undefined'&&ATTENDANCE_EXPORT_IDS.size>1&&!confirm(`Consultar solo a ${p.nombre} reemplazará la selección actual del informe. ¿Continuar?`))return;
    $('pw-profile-dialog').close();peopleSwitchTab('informes');return showAttendancePreview(p.id);
  }
  $('pw-profile-dialog').close();
  if(b.hasAttribute('data-pw-edit'))return openAdminPerson(p.id);
  if(b.hasAttribute('data-pw-edit-jornada')){const opened=openAdminPerson(p.id);window.showAdminEditorSection?.('.schedule-block');return opened;}
  if(b.hasAttribute('data-pw-days-off')){$('admin-days-off-modal').classList.add('pw-days-off');return openAdminDaysOff(p.id,state.origin);}
  if(b.hasAttribute('data-pw-status'))return changeAdminPersonStatus(p.id,!p.activo);
  if(b.hasAttribute('data-pw-delete')&&typeof deleteAdminInactivePerson==='function')return deleteAdminInactivePerson(p.id,b);
}
function openPeopleShift(person,type){
  if(!APP.adminTeam?.puede_editar||!APP.adminTeam.jornadas_disponibles||!person.activo)return;
  const state=PEOPLE_WORKBENCH;state.shift={person,type,busy:false,review:false,version:person.jornadas_version||0,payload:null};
  const tomorrow=peopleNextDate(peopleToday()),week=peopleEffectiveWeek(person),dialog=$('pw-shift-dialog');
  dialog.innerHTML=`<form id="pw-shift-form"><header class="pw-modal-head"><div><p>${type==='temporal'?'EXCEPCIÓN TEMPORAL':'JORNADA PRINCIPAL POR CONTRATO'}</p><h2>${type==='temporal'?'Crear horario temporal':'Actualizar jornada'}</h2><small>${esc(person.nombre)} · Hora de Lima</small></div>${peopleButton('×','data-pw-shift-close aria-label="Cerrar programación"')}</header><div class="pw-modal-body"><section id="pw-shift-config"><p class="pw-notice">Se programa desde mañana para conservar la jornada de hoy y las fechas anteriores. No se modifican metas, saldos, registros ni evidencias.</p><div class="pw-dates"><label>Desde<input type="date" id="pw-shift-from" required min="${tomorrow}" value="${tomorrow}"></label><label>Hasta<input type="date" id="pw-shift-until" required min="${tomorrow}"></label>${type==='principal'?'<label class="pw-check"><input type="checkbox" id="pw-shift-indefinite">Fin indeterminado</label>':''}</div><h3>¿Cuál será el nuevo horario?</h3><div class="pw-shift-week"><div class="pw-shift-head${person.tipo_vinculo==='ambos'?' pw-mixed':''}" aria-hidden="true"><span>Día</span><span>Modalidad</span><span>Entrada</span><span>Salida</span>${person.tipo_vinculo==='ambos'?'<span>Vínculo</span>':''}</div>${peopleShiftDayRows(person,week)}</div><label class="pw-reason">Motivo<textarea id="pw-shift-reason" required minlength="3" maxlength="180" rows="2"></textarea></label></section><section id="pw-shift-review" hidden></section><p id="pw-shift-message" class="pw-form-message" role="alert"></p></div><footer class="pw-modal-foot"><p id="pw-shift-step">1. Configurar · 2. Revisar y confirmar</p><div>${peopleButton('Cancelar','data-pw-shift-close')}${peopleButton('Volver y editar','data-pw-shift-back hidden')}<button type="submit" class="pw-button pw-primary" id="pw-shift-save">Revisar cambio</button></div></footer></form>`;
  $('pw-shift-form').onsubmit=submitPeopleShift;dialog.showModal();
}
function showPeopleShiftStep(){
  const s=PEOPLE_WORKBENCH.shift;$('pw-shift-config').hidden=s.review;$('pw-shift-review').hidden=!s.review;
  // Los campos de configuración ya validados no participan de la validación HTML del paso 2.
  $('pw-shift-config').querySelectorAll('input,select,textarea').forEach(el=>{if(s.review){el.dataset.pwDisabled=String(el.disabled);el.disabled=true;}else{el.disabled=el.dataset.pwDisabled==='true';}});
  $('pw-shift-dialog').querySelector('[data-pw-shift-back]').hidden=!s.review;$('pw-shift-save').textContent=s.review?'Confirmar y programar':'Revisar cambio';$('pw-shift-message').textContent='';
  $('pw-shift-dialog').querySelector('.pw-modal-body').scrollTop=0;
}
// Motivos con los que el servidor rechaza una jornada; se usan en la ventana de programar y en el editor.
const PEOPLE_SHIFT_MESSAGES={sin_permiso:'Tu sesión no permite programar jornadas.',fechas:'Revisa las fechas; el temporal admite hasta un año y el principal hasta diez.',conflicto:'Se cruza con otro período programado. Revisa las fechas.',desactualizado:'Otra persona actualizó esta ficha. Cierra y vuelve a abrirla para revisar la versión vigente.',registros_existentes:'Ya existen registros posteriores al inicio que el cambio podría afectar. Se conservaron; la jornada no se programó.',ajuste_puntual:'Hay un ajuste por fecha autorizado que el cambio podría afectar. Debe revisarse antes de programar otra jornada.',principal_finalizada:'El temporal abarca fechas sin un principal vigente. Actualiza primero la jornada principal.',temporal_fuera_contrato:'Un temporal existente termina después del nuevo principal. Revisa ambos períodos.',horario:'Hay un horario incompleto o inválido.',sin_dias:'Selecciona al menos un día de gestión.',motivo:'Escribe un motivo de 3 a 180 caracteres.',no_existe:'Esta persona ya no está activa.'};
function peopleShiftErrorText(result){return PEOPLE_SHIFT_MESSAGES[result?.data?.motivo]||(result?.error?.code==='PGRST202'?'La programación de jornadas todavía no está habilitada.':'No se pudo programar la jornada. Conservamos los datos para reintentar.');}
async function submitPeopleShift(event){
  event.preventDefault();const s=PEOPLE_WORKBENCH.shift;if(!s||s.busy)return;
  const msg=$('pw-shift-message');msg.textContent='';
  if(!s.review){
    const from=$('pw-shift-from').value,until=$('pw-shift-indefinite')?.checked?null:$('pw-shift-until').value,reason=$('pw-shift-reason').value.trim(),week={};let count=0;
    if(!from||from<=peopleToday()||until&&until<from||(!until&&!$('pw-shift-indefinite')?.checked)){msg.textContent='Revisa inicio y fin: deben ser futuros y estar en orden.';return;}
    for(const row of $('pw-shift-config').querySelectorAll('[data-pw-day]')){
      const mode=row.querySelector('[data-pw-day-mode]').value;if(mode==='no_gestiona'){week[row.dataset.pwDay]={mod:mode};continue;}
      const ini=row.querySelector('[data-pw-day-start]').value,fin=row.querySelector('[data-pw-day-end]').value;
      if(!ini||!fin||fin<=ini){msg.textContent=`Revisa entrada y salida de ${row.querySelector('b').textContent}.`;return;}
      week[row.dataset.pwDay]={mod:mode,ini,fin,vinc:row.querySelector('[data-pw-day-link]')?.value||s.person.tipo_vinculo};count++;
    }
    if(!count){msg.textContent='Selecciona al menos un día de gestión.';return;}
    if(reason.length<3){msg.textContent='Escribe un motivo de al menos tres caracteres.';return;}
    s.payload={p_colab:Number(s.person.id),p_tipo:s.type,p_desde:from,p_hasta:until||null,p_semana:week,p_motivo:reason,p_version:s.version};
    $('pw-shift-review').innerHTML=`<h3>Revisa antes de confirmar</h3><p><b>${esc(s.person.nombre)}</b> · ${s.type==='temporal'?'Horario temporal':'Jornada principal'}</p><p class="pw-period">${esc(adminDate(from))} → ${until?esc(adminDate(until)):'Fin indeterminado'}</p><div class="pw-profile-columns"><section class="pw-panel"><h3>Horario actual</h3>${peopleWeekTable(s.person)}</section><section class="pw-panel"><h3>Nuevo horario</h3>${peopleWeekTable(s.person,week)}</section></div><p class="pw-notice">${s.type==='temporal'?`Desde el ${esc(adminDate(peopleNextDate(until)))} vuelve al principal vigente. Si su principal ya finalizó, no se exigirá una jornada.`:until?'Al finalizar, sin otro período principal, no se exigen nuevas jornadas.':'Continúa vigente hasta programar otro principal.'} El pasado y las horas registradas se conservan.</p><p>Motivo: ${esc(reason)}</p>`;
    s.review=true;showPeopleShiftStep();$('pw-shift-review').setAttribute('tabindex','-1');$('pw-shift-review').focus({preventScroll:true});return;
  }
  s.busy=true;$('pw-shift-save').disabled=true;$('pw-shift-save').textContent='Programando…';
  const messages=PEOPLE_SHIFT_MESSAGES;
  try{
    const {data,error}=await db.rpc('dash_admin_guardar_jornada',s.payload);
    if(error||!data?.ok)throw Error(messages[data?.motivo]||(error?.code==='PGRST202'?'La programación de jornadas todavía no está habilitada.':'No se pudo programar. Conservamos los datos para reintentar.'));
    // Se cierra el editor, se actualiza el directorio y se resalta la tarjeta, que muestra el cambio programado.
    const id=s.person.id,from=s.payload.p_desde,kind=s.type;
    $('pw-shift-dialog').close();$('pw-profile-dialog').close();
    if(!$('admin-person-modal').hidden)closeAdminPerson();
    await loadAdminTeam();restorePeopleFocus();peopleHighlightCard(id);
    toast(`${kind==='temporal'?'Horario temporal programado':'Nueva jornada programada'} desde el ${adminDate(from)}. Su tarjeta lo indica; el historial y los registros se conservaron.`);
  }catch(error){msg.textContent=error.message;msg.scrollIntoView?.({block:'nearest'});}finally{s.busy=false;if($('pw-shift-save')){$('pw-shift-save').disabled=false;$('pw-shift-save').textContent='Confirmar y programar';}}
}
// Jornada editable en el editor: la semana se cambia en su tabla y, al guardar, se programa desde una fecha futura.
function peopleShiftDayRows(person,week){
  return ADMIN_DAYS.map(([label,d])=>{
    const day=week[d]||{},mode=day.mod||adminMode(person,d),off=mode==='no_gestiona';
    return `<div class="pw-shift-day" data-pw-day="${d}"><b>${esc(label)}</b><label><span class="sr-only">Modalidad de ${esc(label)}</span><select data-pw-day-mode>${Object.entries(ADMIN_MODES).map(([val,[name]])=>`<option value="${val}" ${mode===val?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label><span class="sr-only">Entrada de ${esc(label)}</span><input type="time" data-pw-day-start aria-label="Entrada de ${esc(label)}" value="${esc(String(day.ini||person.hora_inicio||'08:00').slice(0,5))}" ${off?'disabled':''}></label><label><span class="sr-only">Salida de ${esc(label)}</span><input type="time" data-pw-day-end aria-label="Salida de ${esc(label)}" value="${esc(String(day.fin||person.hora_fin||'13:00').slice(0,5))}" ${off?'disabled':''}></label>${person.tipo_vinculo==='ambos'?`<select data-pw-day-link aria-label="Vínculo de ${esc(label)}"><option value="practicas" ${day.vinc!=='voluntariado'?'selected':''}>Prácticas</option><option value="voluntariado" ${day.vinc==='voluntariado'?'selected':''}>Voluntariado</option></select>`:''}</div>`;
  }).join('');
}
// Las dos opciones para cambiar el horario, con los nombres que tenían en la ficha; se eligen con un selector de dos posiciones.
const PEOPLE_INLINE_MODES={
  principal:{title:'Actualizar jornada principal',text:'Define un horario por contrato y desde cuándo aplica. La meta de horas se conserva.'},
  temporal:{title:'Horario temporal',text:'Una excepción con inicio y fin. Al vencer vuelve al principal vigente.'}
};
function peopleInlineRender(person,editable,mode='principal'){
  const view=$('pw-editor-schedule-view');PEOPLE_WORKBENCH.inline=null;if(!view)return;
  view.classList.remove('pw-inline-editing');view.closest('.schedule-block')?.classList.remove('pw-schedule-scrolled');view.scrollTop=0;
  if(!person){view.innerHTML='';return;}
  const current=peopleCurrentPeriod(person),next=peoplePeriods(person).find(j=>j.desde>peopleToday()),mixed=person.tipo_vinculo==='ambos';
  const head=`<header><b>Jornada vigente</b>${peopleTag(...peopleKind(person))}${next?`<span class="pw-editor-next" title="${next.tipo==='temporal'?'Horario temporal':'Nueva jornada principal'} programada${next.hasta?` hasta el ${esc(adminDate(next.hasta))}`:''}. Se ve en la ficha y en su tarjeta.">Próximo cambio: ${next.tipo==='temporal'?'horario temporal':'nueva jornada'} desde el ${esc(adminDate(next.desde))}</span>`:''}<span class="pw-editor-period">${current?`Desde ${esc(adminDate(current.desde))} · ${current.hasta?`hasta ${esc(adminDate(current.hasta))}`:'fin indeterminado'}`:'Horario habitual de referencia'}</span></header>`;
  if(!editable){view.innerHTML=head+peopleWeekTable(person);return;}
  if(!PEOPLE_INLINE_MODES[mode])mode='principal';
  const tomorrow=peopleNextDate(peopleToday());
  // Sin la línea de «Jornada vigente»: solo se avisa cuando hay algo que tener en cuenta antes de programar.
  const notices=[];
  if(current?.tipo==='temporal')notices.push(`Hoy rige un horario temporal${current.hasta?` hasta el ${esc(adminDate(current.hasta))}`:''}; la tabla parte de él.`);
  if(next)notices.push(`Ya hay ${next.tipo==='temporal'?'un horario temporal programado':'una nueva jornada principal programada'} desde el ${esc(adminDate(next.desde))}${next.hasta?` hasta el ${esc(adminDate(next.hasta))}`:''}.`);
  // Mismo formato que «Programar jornada»: fechas arriba, la semana fila por fila y el motivo al final.
  view.classList.add('pw-inline-editing');view.setAttribute('data-calendar-floating','');
  view.innerHTML=`<div class="pw-inline-switch"><div class="pw-segmented" role="radiogroup" aria-label="Tipo de cambio de jornada">${Object.entries(PEOPLE_INLINE_MODES).map(([key,m])=>`<button type="button" role="radio" data-pw-inline-mode="${key}" aria-checked="${key===mode}" tabindex="${key===mode?0:-1}" title="${m.text}">${m.title}</button>`).join('')}</div></div>
    <section class="pw-inline-form" id="pw-inline-change" aria-label="Nuevo horario">
      <p class="pw-inline-mode-text" id="pw-inline-mode-text"></p>${notices.length?`<p class="pw-inline-notice" role="note">${notices.join(' ')}</p>`:''}
      <div class="pw-dates"><label>Desde<input type="date" id="pw-inline-from" aria-label="Desde" min="${tomorrow}" value="${tomorrow}"></label><label>Hasta<input type="date" id="pw-inline-until" aria-label="Hasta" min="${tomorrow}"></label><label class="pw-check" id="pw-inline-indefinite-wrap"><input type="checkbox" id="pw-inline-indefinite">Fin indeterminado</label></div>
      <h3 class="pw-inline-title">¿Cuál será el nuevo horario?</h3>
      <div class="pw-shift-week pw-inline-week"><div class="pw-shift-head${mixed?' pw-mixed':''}" aria-hidden="true"><span>Día</span><span>Modalidad</span><span>Entrada</span><span>Salida</span>${mixed?'<span>Vínculo</span>':''}</div>${peopleShiftDayRows(person,peopleEffectiveWeek(person))}</div>
      <label class="pw-reason">Motivo<textarea id="pw-inline-reason" maxlength="180" rows="2" placeholder="Ej. nuevo horario acordado con la universidad"></textarea></label>
      <div class="pw-inline-foot"><p class="pw-inline-summary" id="pw-inline-summary" role="status"></p><button type="button" class="pw-button" data-pw-inline-reset>Deshacer cambios</button></div>
    </section>`;
  // Punto de partida: la semana completa (para saber si cambió) y cada día (para marcar los días modificados).
  const state=PEOPLE_WORKBENCH.inline={person,mode,baseline:'',base:{}};state.base=peopleInlineRead().week;state.baseline=JSON.stringify(state.base);
  globalThis.KJAEditorCalendar?.enhance?.([$('pw-inline-from'),$('pw-inline-until')]);
  peopleInlineSync();
}
// Pasar de principal a temporal (o al revés) conserva lo ya editado en la tabla y en las fechas.
function peopleInlineSetMode(mode,focus=false){
  const s=PEOPLE_WORKBENCH.inline;if(!s?.mode||!PEOPLE_INLINE_MODES[mode])return;
  s.mode=mode;peopleInlineSync();
  if(focus)$('pw-editor-schedule-view').querySelector(`[data-pw-inline-mode="${mode}"]`)?.focus();
}
function peopleInlineRead(){
  const week={};let count=0,error='';
  for(const row of document.querySelectorAll('#pw-editor-schedule-view [data-pw-day]')){
    const mode=row.querySelector('[data-pw-day-mode]').value;if(mode==='no_gestiona'){week[row.dataset.pwDay]={mod:mode};continue;}
    const ini=row.querySelector('[data-pw-day-start]').value,fin=row.querySelector('[data-pw-day-end]').value;
    if(!error&&(!ini||!fin||fin<=ini))error=`Revisa entrada y salida de ${row.querySelector('b').textContent}: la salida debe ser posterior a la entrada.`;
    week[row.dataset.pwDay]={mod:mode,ini,fin,vinc:row.querySelector('[data-pw-day-link]')?.value||PEOPLE_WORKBENCH.inline?.person.tipo_vinculo};count++;
  }
  return {week,count,error};
}
function peopleInlineKey(){return JSON.stringify(peopleInlineRead().week);}
// Fin de la vigencia elegida: null con «Fin indeterminado» (solo en la jornada principal).
function peopleInlineUntil(){const s=PEOPLE_WORKBENCH.inline;return s?.mode==='principal'&&$('pw-inline-indefinite')?.checked?null:($('pw-inline-until')?.value||null);}
// Algo escrito en fechas o motivo (además de la semana), para no ignorarlo en silencio.
function peopleInlineTouched(){return !!($('pw-inline-until')?.value||$('pw-inline-indefinite')?.checked||$('pw-inline-reason')?.value.trim()||($('pw-inline-from')&&$('pw-inline-from').value!==peopleNextDate(peopleToday())));}
function peopleInlineSync(){
  const s=PEOPLE_WORKBENCH.inline,panel=$('pw-inline-change'),view=$('pw-editor-schedule-view');if(!s?.mode||!panel||!view)return;
  const now=peopleInlineRead().week,temporal=s.mode==='temporal',changed=JSON.stringify(now)!==s.baseline,from=$('pw-inline-from').value;
  for(const b of view.querySelectorAll('[data-pw-inline-mode]')){const on=b.dataset.pwInlineMode===s.mode;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;}
  for(const day of view.querySelectorAll('[data-pw-day]')){const d=day.dataset.pwDay;day.classList.toggle('is-edited',JSON.stringify(now[d])!==JSON.stringify(s.base?.[d]));}
  $('pw-inline-mode-text').textContent=PEOPLE_INLINE_MODES[s.mode].text;
  // «Fin indeterminado» solo existe para la jornada principal; el temporal siempre tiene fecha de fin.
  const indefinite=$('pw-inline-indefinite');$('pw-inline-indefinite-wrap').hidden=temporal;if(temporal)indefinite.checked=false;
  const untilInput=$('pw-inline-until');untilInput.disabled=!temporal&&indefinite.checked;
  const until=peopleInlineUntil();
  view.classList.toggle('is-changed',changed);
  panel.querySelector('[data-pw-inline-reset]').disabled=!changed&&!peopleInlineTouched();
  $('pw-inline-summary').textContent=!changed?'Cambia en la tabla los días u horas que serán distintos; parte del horario vigente.':!from?'Elige desde qué fecha aplica el nuevo horario.':`Al guardar se programará ${temporal?'un horario temporal':'una nueva jornada principal'} desde el ${adminDate(from)}${until?` hasta el ${adminDate(until)}`:temporal?' (falta la fecha «Hasta»)':indefinite.checked?', con fin indeterminado':' (elige «Hasta» o marca «Fin indeterminado»)'}. Hasta entonces sigue el horario actual.`;
}
// Lo usa «Guardar cambios»: null si la semana no cambió, {error} si falta algo, o los datos para programar la jornada.
function peopleEditorJornadaChange(){
  const s=PEOPLE_WORKBENCH.inline;if(!s?.mode||!$('pw-inline-change')||$('admin-person-modal').hidden)return null;
  // Sin cambios en la semana no se programa nada; si ya escribió fechas o motivo, se avisa en vez de ignorarlo.
  if(peopleInlineKey()===s.baseline)return peopleInlineTouched()?{error:'Cambia en la tabla los días u horas del nuevo horario, o pulsa «Deshacer cambios» si no quieres programar un cambio.'}:null;
  const {week,count,error}=peopleInlineRead();if(error)return {error};if(!count)return {error:'Deja al menos un día de gestión en la jornada.'};
  const type=s.mode,from=$('pw-inline-from').value,until=peopleInlineUntil(),reason=$('pw-inline-reason').value.trim();
  if(!from||from<=peopleToday())return {error:'El nuevo horario debe empezar desde mañana. Elige la fecha en «Desde».'};
  if(type==='temporal'&&!until)return {error:'Un horario temporal necesita fecha de fin en «Hasta».'};
  if(type==='principal'&&!until&&!$('pw-inline-indefinite').checked)return {error:'Elige la fecha «Hasta» o marca «Fin indeterminado».'};
  if(until&&until<from)return {error:'La fecha «Hasta» no puede ser anterior a «Desde».'};
  if(reason.length<3)return {error:'Escribe el motivo del cambio de horario (al menos 3 caracteres).'};
  return {payload:{p_colab:Number(s.person.id),p_tipo:type,p_desde:from,p_hasta:until,p_semana:week,p_motivo:reason,p_version:s.person.jornadas_version||0},label:`${type==='temporal'?'Horario temporal':'Nueva jornada'} desde el ${adminDate(from)}${until?` hasta el ${adminDate(until)}`:''}`};
}
// Tras programar la jornada, la tabla vuelve a su punto de partida: si la ficha falla, reintentar no la programa dos veces.
function peopleEditorJornadaSaved(){const s=PEOPLE_WORKBENCH.inline;if(s)peopleInlineRender(s.person,true,s.mode);}
// «Ver ficha» del editor: pasa a la ficha de la misma persona, en la sección equivalente a la pantalla abierta.
const PEOPLE_EDITOR_TO_PROFILE={'.editor-identity':'resumen','.editor-contract':'contrato','.schedule-block':'jornada','.facebook-schedule-block':'facebook','#admin-history-block':'historial'};
function peopleEditorValues(){
  const skip='#admin-facebook-schedule-grid,#admin-schedule-grid,#pw-editor-schedule-view,#admin-history-list';
  return JSON.stringify([...$('admin-person-form').querySelectorAll('input,select,textarea')].filter(el=>(el.id||el.name)&&el.type!=='hidden'&&!el.closest(skip)).map(el=>[el.id||el.name,el.type==='checkbox'||el.type==='radio'?el.checked:el.value]));
}
function peopleEditorHasChanges(){
  const s=PEOPLE_WORKBENCH.inline,facebook=typeof ADMIN_FACEBOOK_DIRTY!=='undefined'&&ADMIN_FACEBOOK_DIRTY;
  return facebook||peopleEditorValues()!==PEOPLE_WORKBENCH.editorBaseline||!!(s?.mode&&$('pw-inline-change')&&peopleInlineKey()!==s.baseline);
}
function peopleEditorToProfile(){
  const id=$('admin-person-id').value;if(!id||$('admin-person-save').disabled)return;
  if(peopleEditorHasChanges()&&!confirm('Tienes cambios sin guardar en el editor. ¿Ir a la ficha sin guardarlos?'))return;
  const jump=$('admin-editor-nav')?.querySelector('[data-editor-jump][aria-selected="true"]')?.dataset.editorJump,origin=PEOPLE_WORKBENCH.editorOrigin;
  closeAdminPerson();
  return openPeopleProfile(id,origin?.isConnected?origin:null,PEOPLE_EDITOR_TO_PROFILE[jump]);
}
// Lleva la vista a la tarjeta de la persona y la resalta un momento.
function peopleHighlightCard(id){
  const card=$('admin-people-list')?.querySelector(`[data-team-profile="${CSS.escape(String(id))}"]`)?.closest('.pw-card');if(!card)return;
  card.scrollIntoView({block:'center',behavior:'smooth'});card.classList.remove('pw-card-updated');void card.offsetWidth;card.classList.add('pw-card-updated');
  setTimeout(()=>card.classList.remove('pw-card-updated'),2600);
}
// Condiciones del editor existente: el principal se cambia únicamente mediante vigencias.
function configurePeopleEditor(person){
  if(!peopleDesktop())return;
  const sheet=$('admin-person-modal');sheet.classList.add('pw-legacy-editor');
  const opening=sheet.hidden;if(opening)PEOPLE_WORKBENCH.editorOrigin=document.activeElement;
  const protectedIds=['admin-person-link','admin-contract-start','admin-general-start','admin-general-end'];
  for(const id of protectedIds)$(id).disabled=!!person;
  $('admin-schedule-grid').querySelectorAll('input,select').forEach(el=>{if(person)el.disabled=true;});
  let note=$('pw-editor-schedule-note');if(!note){note=document.createElement('p');note.id='pw-editor-schedule-note';note.className='pw-notice';($('admin-person-modal').querySelector('.admin-general-hours')||$('admin-schedule-grid')).before(note);}
  note.hidden=!person;
  const canShift=!!person&&person.activo&&APP.adminTeam?.puede_editar,enabled=!!APP.adminTeam?.jornadas_disponibles;
  note.textContent=!person?'':!person.activo?'El horario principal, el vínculo y el inicio histórico se conservan. Reactiva a la persona para cambiar su horario.':!(canShift&&enabled)?'El horario principal, el vínculo y el inicio histórico se conservan. La programación de jornadas aún no está habilitada para este equipo.':'Cambia los días directamente en la tabla. Al guardar, el nuevo horario empieza en la fecha que elijas y el actual queda en el historial.';
  // Con una persona registrada, la semana se edita aquí; la tabla original sigue oculta y se guarda sin cambios.
  const block=sheet.querySelector('.schedule-block');block.classList.toggle('pw-schedule-readonly',!!person);
  let view=$('pw-editor-schedule-view');
  if(!view){
    view=document.createElement('div');view.id='pw-editor-schedule-view';view.className='pw-editor-schedule-view';block.append(view);
    view.addEventListener('change',e=>{
      if(e.target.matches('[data-pw-day-mode]')){const day=e.target.closest('[data-pw-day]'),off=e.target.value==='no_gestiona';day.querySelectorAll('input').forEach(x=>{x.disabled=off;});day.classList.toggle('is-off',off);day.dataset.mode=e.target.value;}
      peopleInlineSync();
    });
    view.addEventListener('input',()=>peopleInlineSync());
    // Al bajar, el título de la pantalla se oculta para dejarle el alto a la edición; vuelve al regresar arriba.
    // Solo si sobra bastante contenido, para que ocultarlo no cambie el alto y lo vuelva a mostrar en bucle.
    view.addEventListener('scroll',()=>{
      const block=view.closest('.schedule-block');if(!block||!view.classList.contains('pw-inline-editing'))return;
      const top=view.scrollTop,hidden=block.classList.contains('pw-schedule-scrolled');
      if(!hidden&&top>40&&view.scrollHeight-view.clientHeight>160)block.classList.add('pw-schedule-scrolled');
      else if(hidden&&top<8)block.classList.remove('pw-schedule-scrolled');
    },{passive:true});
    view.addEventListener('click',e=>{
      const pick=e.target.closest('[data-pw-inline-mode]');if(pick)return peopleInlineSetMode(pick.dataset.pwInlineMode);
      if(e.target.closest('[data-pw-inline-reset]')){const s=PEOPLE_WORKBENCH.inline;peopleInlineRender(s?.person||null,true,s?.mode);$('pw-editor-schedule-view').querySelector('[data-pw-inline-mode][aria-checked="true"]')?.focus();}
    });
    // Flechas en el selector de dos posiciones, como en un grupo de opciones.
    view.addEventListener('keydown',e=>{
      const b=e.target.closest('[data-pw-inline-mode]');if(!b||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();peopleInlineSetMode(b.dataset.pwInlineMode==='principal'?'temporal':'principal',true);
    });
  }
  // Solo se dibuja al abrir: las demás llamadas (al cambiar otros campos) no deben borrar lo que se está editando.
  if(opening||!person)peopleInlineRender(person,canShift&&enabled);
  // Acceso directo a la ficha desde la cabecera del editor (solo con una persona registrada).
  let toProfile=$('pw-editor-profile');const head=sheet.querySelector('.admin-editor-head');
  if(!toProfile&&head){
    toProfile=document.createElement('button');toProfile.type='button';toProfile.id='pw-editor-profile';toProfile.className='pw-editor-profile';
    toProfile.title='Abre la ficha de esta persona sin cerrar y volver a entrar';
    toProfile.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.6-1.3 1.4-2 2.5-2s1.9.7 2.5 2M14 10h4M14 14h3"/></svg><span>Ver ficha</span>';
    toProfile.addEventListener('click',peopleEditorToProfile);const close=head.querySelector('.modal-close');if(close)close.before(toProfile);else head.append(toProfile);
  }
  if(toProfile)toProfile.hidden=!person||!APP.access?.acceso_panel;
  if(opening)PEOPLE_WORKBENCH.editorBaseline=peopleEditorValues();
  // En modo editable, el aviso largo se reemplaza por una frase junto al título para dejarle el alto a la semana.
  const editable=!!person&&canShift&&enabled;block.classList.toggle('pw-schedule-editable',editable);
  const desc=block.querySelector('.admin-editor-label>span');if(desc){if(desc.dataset.base===undefined)desc.dataset.base=desc.textContent;desc.textContent=editable?'Elige qué cambio hacer; se programa desde la fecha que indiques al guardar.':desc.dataset.base;}
}
