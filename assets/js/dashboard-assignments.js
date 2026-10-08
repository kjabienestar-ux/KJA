/* Exploración de asignaciones; las revisiones conservan los permisos del panel. */
let ASSIGNMENT_CALENDAR_REQUEST=0;
let ASSIGNMENT_SELECTED_DATE='';
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
    html+=`<button type="button" data-assignment-date="${date}" aria-pressed="${date===selected}" ${date===isoLima()?'aria-current="date"':''} aria-label="${date}: ${count} asignaciones" class="${count?'has-assignments':''}"><span>${day}</span>${count?`<small aria-hidden="true">${count}</small>`:''}</button>`;
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
$('assignment-create-toggle').onclick=()=>{
  const panel=$('assignment-create-panel'),button=$('assignment-create-toggle');
  panel.hidden=!panel.hidden;
  button.setAttribute('aria-expanded',String(!panel.hidden));
  button.textContent=panel.hidden?'Nueva asignación':'Cerrar formulario';
  if(!panel.hidden)$('admin-close-target-kind').focus({preventScroll:true});
};
$('assignment-work-date').onchange=()=>{
  if(!$('assignment-work-date').value)return;
  $('admin-close-date').value=$('assignment-work-date').value;
  clearAdminDrawPreview();void loadAdminCloses();
};
$('assignment-calendar-month').onchange=loadAssignmentCalendar;
function moveAssignmentMonth(offset){
  const month=$('assignment-calendar-month').value||isoLima().slice(0,7);
  const [year,number]=month.split('-').map(Number);
  const next=new Date(Date.UTC(year,number-1+offset,1));
  $('assignment-calendar-month').value=next.toISOString().slice(0,7);
  void loadAssignmentCalendar();
}
$('assignment-month-prev').onclick=()=>moveAssignmentMonth(-1);
$('assignment-month-next').onclick=()=>moveAssignmentMonth(1);
$('assignment-calendar-today').onclick=()=>{
  $('admin-close-date').value=isoLima();
  $('assignment-calendar-month').value=isoLima().slice(0,7);
  clearAdminDrawPreview();void loadAdminCloses();
};
$('assignment-calendar-days').onclick=event=>{
  const button=event.target.closest('[data-assignment-date]');if(!button)return;
  $('admin-close-date').value=button.dataset.assignmentDate;
  $('admin-close-assignment-list').innerHTML='<p class="admin-empty">Cargando asignaciones de la fecha seleccionada…</p>';
  clearAdminDrawPreview();void loadAdminCloses();
};
$('admin-close-assignment-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-assignment-review]');if(button)openAdminReviewPerson(button.dataset.assignmentPerson,button,button.dataset.assignmentReview);
});

function initAssignmentChipsAndTabs(){
  if(typeof document==='undefined')return;
  const chips=document.querySelectorAll('#assignment-type-chips .type-chip');
  const typeSelect=$('admin-close-type');
  if(chips.length&&typeSelect){
    chips.forEach(chip=>{
      chip.addEventListener('click',()=>{
        chips.forEach(c=>c.classList.remove('is-active'));
        chip.classList.add('is-active');
        typeSelect.value=chip.dataset.type;
        typeSelect.dispatchEvent(new Event('change',{bubbles:true}));
      });
    });
    typeSelect.addEventListener('change',()=>{
      chips.forEach(c=>c.classList.toggle('is-active',c.dataset.type===typeSelect.value));
    });
  }
  const tabs=document.querySelectorAll('#assignment-target-kind-tabs .target-kind-tab');
  const kindSelect=$('admin-close-target-kind');
  if(tabs.length&&kindSelect){
    tabs.forEach(tab=>{
      tab.addEventListener('click',()=>{
        tabs.forEach(t=>t.classList.remove('is-active'));
        tab.classList.add('is-active');
        kindSelect.value=tab.dataset.kind;
        kindSelect.dispatchEvent(new Event('change',{bubbles:true}));
      });
    });
    kindSelect.addEventListener('change',()=>{
      tabs.forEach(t=>t.classList.toggle('is-active',t.dataset.kind===kindSelect.value));
    });
  }
  initAssignmentTargetPicker();
}

function initAssignmentTargetPicker(){
  if(typeof document==='undefined')return;
  const select=$('admin-close-target');
  if(!select||select.dataset.asgPickerInit)return;
  select.dataset.asgPickerInit='true';

  const wrap=document.createElement('div');
  wrap.className='asg-custom-select';

  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='asg-picker-trigger';
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  if(select.disabled)trigger.disabled=true;

  const popup=document.createElement('div');
  popup.className='asg-picker-popup';
  popup.hidden=true;
  popup.setAttribute('role','dialog');
  popup.setAttribute('aria-label','Seleccionar destino');

  const searchWrap=document.createElement('div');
  searchWrap.className='asg-picker-search';
  searchWrap.innerHTML='<svg class="asg-picker-search-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="text" placeholder="Buscar colaborador o área…" autocomplete="off">';
  const searchInput=searchWrap.querySelector('input');

  const list=document.createElement('div');
  list.className='asg-picker-options';
  list.setAttribute('role','listbox');

  const empty=document.createElement('div');
  empty.className='asg-picker-empty';
  empty.textContent='No se encontraron coincidencias';
  empty.hidden=true;

  popup.append(searchWrap,list,empty);
  select.before(wrap);
  wrap.append(trigger,select);
  select.classList.add('asg-select-native-sr');

  let opened=false;

  function parseOptionText(text){
    if(!text||text.toLowerCase().includes('seleccionar'))return {name:'Seleccionar destino…',area:'',empty:true};
    const parts=text.split(' · ');
    return {name:parts[0].trim(),area:parts[1]?.trim()||'',empty:false};
  }

  function getToneClass(areaName){
    if(typeof adminCloseAreaSlug==='function')return adminCloseAreaSlug(areaName);
    const a=(areaName||'').toLowerCase();
    if(a.includes('salud')||a.includes('ocupacional'))return 'tone-salud';
    if(a.includes('diseno')||a.includes('grafic'))return 'tone-diseno';
    if(a.includes('market')||a.includes('publicidad'))return 'tone-marketing';
    if(a.includes('ingenier')||a.includes('sistema')||a.includes('desarroll'))return 'tone-ingenieria';
    if(a.includes('recurso')||a.includes('rrhh')||a.includes('humano'))return 'tone-rrhh';
    if(a.includes('recluta')||a.includes('seleccion'))return 'tone-reclutamiento';
    if(a.includes('finanz')||a.includes('contab'))return 'tone-finanzas';
    if(a.includes('operacion')||a.includes('logist'))return 'tone-operaciones';
    return 'tone-general';
  }

  function getInitials(name){
    if(!name||name.toLowerCase().includes('seleccionar'))return '';
    return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');
  }

  function syncTrigger(){
    const opt=select.selectedOptions[0]||select.options[0];
    const val=select.value;
    const {name,area,empty}=parseOptionText(opt?opt.textContent:'');
    const inits=empty?'':getInitials(name);
    const tone=getToneClass(area||name);
    const avatarHtml=empty
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      : (inits?esc(inits):'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>');

    trigger.innerHTML=`<span class="asg-trigger-main"><span class="asg-trigger-avatar ${empty?'empty':tone}">${avatarHtml}</span><span class="asg-trigger-copy"><strong class="asg-trigger-name ${empty?'empty':''}">${esc(name)}</strong>${area?`<span class="asg-trigger-sub">${esc(area)}</span>`:''}</span></span><svg class="asg-trigger-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 10 5 5 5-5"/></svg>`;
    trigger.classList.toggle('has-selection',!empty&&!!val);
    trigger.disabled=!!select.disabled;
  }

  function renderOptions(){
    const q=searchInput.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    list.replaceChildren();
    let count=0;
    [...select.options].forEach(o=>{
      const t=o.textContent;
      if(!o.value&&t.toLowerCase().includes('seleccionar'))return;
      const normalized=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      if(q&&!normalized.includes(q))return;
      count++;
      const {name,area}=parseOptionText(t);
      const inits=getInitials(name);
      const tone=getToneClass(area||name);
      const isSelected=String(o.value)===String(select.value);
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='asg-picker-opt'+(isSelected?' is-selected':'');
      btn.setAttribute('role','option');
      btn.setAttribute('aria-selected',String(isSelected));
      btn.innerHTML=`<span class="asg-opt-main"><span class="asg-opt-avatar ${tone}">${inits?esc(inits):'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>'}</span><span class="asg-opt-copy"><strong class="asg-opt-name">${esc(name)}</strong>${area?`<span class="asg-opt-area">${esc(area)}</span>`:''}</span></span>${isSelected?'<svg class="asg-opt-check" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6"/></svg>':''}`;
      btn.addEventListener('click',()=>{
        select.value=o.value;
        syncTrigger();
        close(true);
        if(typeof clearAdminDrawPreview==='function')clearAdminDrawPreview();
        select.dispatchEvent(new Event('change',{bubbles:true}));
      });
      list.append(btn);
    });
    empty.hidden=count>0;
  }

  function position(){
    const r=trigger.getBoundingClientRect();
    const width=Math.min(Math.max(r.width,280),window.innerWidth-24);
    popup.style.position='fixed';
    popup.style.zIndex='2600';
    popup.style.width=`${width}px`;
    popup.style.left=`${Math.max(12,Math.min(r.left,window.innerWidth-width-12))}px`;
    const spaceBelow=window.innerHeight-r.bottom-12;
    const spaceAbove=r.top-12;
    const openUp=spaceBelow<240&&spaceAbove>spaceBelow;
    popup.style.maxHeight=`${Math.max(160,Math.min(340,openUp?spaceAbove:spaceBelow))}px`;
    popup.style.top=openUp?'auto':`${r.bottom+6}px`;
    popup.style.bottom=openUp?`${window.innerHeight-r.top+6}px`:'auto';
  }

  function close(focusTrigger=false){
    if(!opened)return;
    opened=false;
    popup.hidden=true;
    trigger.setAttribute('aria-expanded','false');
    if(popup.parentNode===document.body)document.body.removeChild(popup);
    if(focusTrigger)trigger.focus({preventScroll:true});
  }

  function open(){
    if(select.disabled||opened)return;
    document.querySelectorAll('.asg-picker-popup:not([hidden]), .role-picker-popup:not([hidden])').forEach(p=>p.hidden=true);
    opened=true;
    if(!document.body.contains(popup))document.body.appendChild(popup);
    searchInput.value='';
    popup.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    renderOptions();
    position();
    searchInput.focus({preventScroll:true});
  }

  trigger.addEventListener('click',()=>opened?close():open());
  searchInput.addEventListener('input',renderOptions);

  const onPointerDown=e=>{if(opened&&!wrap.contains(e.target)&&!popup.contains(e.target))close();};
  const onScroll=e=>{if(opened&&!popup.contains(e.target))close();};
  const onResize=()=>{if(opened)position();};

  document.addEventListener('pointerdown',onPointerDown);
  document.addEventListener('scroll',onScroll,true);
  window.addEventListener('resize',onResize);

  wrap.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&opened){e.preventDefault();close(true);}
    if((e.key==='ArrowDown'||e.key==='Enter')&&!opened){e.preventDefault();open();}
  });

  select.addEventListener('change',syncTrigger);
  new MutationObserver(()=>{
    syncTrigger();
    if(opened)renderOptions();
  }).observe(select,{childList:true,characterData:true});

  const origFocus=select.focus.bind(select);
  select.focus=opts=>{
    try{origFocus(opts);}catch{}
    trigger.focus(opts);
  };

  syncTrigger();
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initAssignmentChipsAndTabs);
  }else{
    initAssignmentChipsAndTabs();
  }
}
