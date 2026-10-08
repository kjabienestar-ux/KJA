/* KJA · Fase 6 — Roles visibles y liderazgo seguro por área. */
let ROLE_CONFIRM={resolve:null,trigger:null};
const ROLE_COLEADER_OPEN=new Set();

function rolesMessage(text,bad=false){
  const el=$('admin-roles-message');el.textContent=text||'';el.classList.toggle('show',!!text);el.classList.toggle('bad',!!text&&bad);
}
function roleDate(value){
  return value?new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Lima'}).format(new Date(value+'T12:00:00-05:00')):'Sin fecha de término';
}
function roleContractStatus(person,{vacantLabel='Liderazgo vacante',vacantDetail='Designa a una persona con su cuenta activada.'}={}){
  if(!person)return {kind:'vacant',label:vacantLabel,detail:vacantDetail};
  if(!person.activo||!person.cuenta_activa)return {kind:'warning',label:'Requiere reemplazo',detail:'La persona o su cuenta ya no está activa.'};
  if(person.contrato_fin_referencia&&person.contrato_fin_referencia<isoLima())return {kind:'warning',label:'Contrato vencido',detail:`Terminó el ${roleDate(person.contrato_fin_referencia)}.`};
  return {kind:'ready',label:'Liderazgo activo',detail:person.contrato_fin_referencia?`Contrato hasta ${roleDate(person.contrato_fin_referencia)}.`:'Cuenta activa sin fecha de término.'};
}

async function loadAdminRoles(){
  if(!(APP.identity.isSystem&&APP.access.rol==='direccion'&&APP.access.acceso_panel))return;
  const request=++APP.adminRolesRequest,button=$('admin-refresh');button.disabled=true;rolesMessage('');
  $('admin-role-map').innerHTML='<p class="admin-empty">Cargando la estructura del equipo…</p>';
  const {data,error}=await db.rpc('dash_admin_roles');
  if(request!==APP.adminRolesRequest)return;button.disabled=false;
  if(error||!data?.ok){
    APP.adminRoles=null;
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_roles'));
    rolesMessage(missing?'La administración de co-líderes todavía no está instalada en Supabase. Ejecuta dashboard_51_colideres_tecnicos.sql.':'No se pudo cargar la administración de roles. Actualiza e inténtalo nuevamente.',true);
    $('admin-role-map').innerHTML='<p class="admin-empty">La estructura de roles no está disponible.</p>';return;
  }
  APP.adminRoles=data;
  if(Number(data.co_lideres_max)!==2)rolesMessage('Ejecuta dashboard_51_colideres_tecnicos.sql en Supabase para activar los dos cupos de co-líder.',true);
  renderAdminRoles();
}

function roleAreaIcon(name){
  const n=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(n.includes('salud')||n.includes('ocupacional'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';
  if(n.includes('psicolog')||n.includes('mente'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z"/></svg>';
  if(n.includes('recurso')||n.includes('humano')||n.includes('rrhh'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  if(n.includes('market')||n.includes('public'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';
  if(n.includes('ingenier')||n.includes('sistem')||n.includes('tech')||n.includes('desarroll'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
  if(n.includes('disen')||n.includes('grafic'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"/></svg>';
  if(n.includes('clinic'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
  if(n.includes('audio')||n.includes('video')||n.includes('visual'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>';
  if(n.includes('recluta')||n.includes('selecc'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><line x1="21" y1="21" x2="15" y2="15"/><circle cx="10" cy="8" r="2.5"/><path d="M6 13a4 4 0 0 1 8 0"/></svg>';
  if(n.includes('contab')||n.includes('finan'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>';
  if(n.includes('admin'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
  if(n.includes('voluntar'))
    return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  return '<svg viewBox="0 0 24 24" class="role-area-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
}

function renderAdminRoles(){
  const data=APP.adminRoles;if(!data)return;const summary=data.resumen||{},coLeadersEnabled=Number(data.co_lideres_max)===2;
  const kpis=[['Áreas activas',summary.areas||0],['Con líder',summary.con_lider||0],['Sin líder',summary.sin_lider||0],['Co-líderes',summary.colideres||0],['Por revisar',summary.roles_por_revisar??summary.lideres_por_revisar??0]];
  $('admin-roles-kpis').innerHTML=kpis.map((item,i)=>`<article class="admin-list-kpi kpi-${i}"><small>${item[0]}</small><b>${item[1]}</b></article>`).join('');
  const areas=data.areas||[];
  $('admin-role-map').innerHTML=areas.length?areas.map(area=>{
    const leader=area.lider,status=roleContractStatus(leader),coLeaders=(area.co_lideres||[]).slice(0,2),people=area.personas||[],assignable=people.filter(person=>person.asignable);
    const areaKey=String(area.id),coOpen=ROLE_COLEADER_OPEN.has(areaKey);
    const waiting=people.filter(person=>person.activo&&!person.tiene_cuenta).length;
    const selected=leader&&assignable.some(person=>String(person.id)===String(leader.id))?String(leader.id):'';
    const options=assignable.map(person=>`<option value="${person.id}" ${String(person.id)===selected?'selected':''}>${esc(person.nombre)}</option>`).join('');
    const coLeaderSlots=[0,1].map(slot=>{
      const coLeader=coLeaders[slot]||null;
      const coStatus=roleContractStatus(coLeader,{vacantLabel:'Cupo disponible',vacantDetail:'Puedes asignar a una persona con su cuenta activada.'});
      const coAssignable=assignable.filter(person=>String(person.id)!==String(leader?.id)&&(
        person.nivel!=='colider'||String(person.id)===String(coLeader?.id)
      ));
      const coOptions=coAssignable.map(person=>`<option value="${person.id}" ${String(person.id)===String(coLeader?.id)?'selected':''}>${esc(person.nombre)}</option>`).join('');
      return `<section class="admin-role-colider-slot ${coStatus.kind}" data-colider-slot="${slot}">
        <div class="admin-role-seat is-colider ${coLeader?'':'is-vacant'}">
          <span class="admin-role-seat-mark">${coLeader?initials(coLeader.nombre):'—'}</span>
          <span class="admin-role-seat-copy">
            <small class="role-seat-pill ${coLeader?'assigned':'vacant'}">CO-LÍDER TÉCNICO ${slot+1}</small>
            <b>${coLeader?esc(coLeader.nombre):'Sin co-líder asignado'}</b>
            <em class="${coStatus.kind}"><i class="role-status-dot"></i>${esc(coStatus.label)} · ${esc(coStatus.detail)}</em>
          </span>
          ${coLeader?`<button type="button" data-colider-remove="${area.id}" data-colider-index="${slot}" class="admin-role-remove-btn">Quitar acceso</button>`:''}
        </div>
        <div class="admin-role-assignment is-colider">
          <label>
            <span>${coLeader?'Reemplazar co-líder':'Asignar co-líder'}</span>
            <select data-colider-select="${area.id}" data-colider-index="${slot}" ${coLeadersEnabled&&coAssignable.length?'':'disabled'}><option value="">Selecciona una persona</option>${coOptions}</select>
          </label>
          <button class="admin-primary-action" type="button" data-colider-save="${area.id}" data-colider-index="${slot}" ${coLeadersEnabled&&coAssignable.length?'':'disabled'}>${coLeader?'Guardar reemplazo':'Asignar co-líder'}</button>
        </div>
      </section>`;
    }).join('');
    return `<article class="admin-role-area ${status.kind}" data-role-area="${area.id}" data-area-tone="${Math.abs(Number(area.id)||0)%6}">
      <header class="admin-role-area-head">
        <div class="admin-role-area-heading">
          <span class="admin-role-area-icon">${roleAreaIcon(area.nombre)}</span>
          <span><small>ÁREA</small><h3>${esc(area.nombre)}</h3></span>
        </div>
        <span class="admin-role-area-count">${area.personas_activas||0} persona${Number(area.personas_activas)===1?'':'s'}</span>
      </header>
      <div class="admin-role-seat ${leader?'':'is-vacant'}">
        <span class="admin-role-seat-mark">${leader?initials(leader.nombre):'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}</span>
        <span class="admin-role-seat-copy">
          <small class="role-seat-pill ${leader?'assigned':'vacant'}">${leader?'LÍDER TÉCNICO ACTUAL':'LIDERAZGO VACANTE'}</small>
          <b>${leader?esc(leader.nombre):'Sin líder asignado'}</b>
          <em class="${status.kind}"><i class="role-status-dot"></i>${esc(status.label)} · ${esc(status.detail)}</em>
        </span>
        ${leader?`<button type="button" data-role-remove="${area.id}" class="admin-role-remove-btn">Quitar acceso</button>`:''}
      </div>
      <div class="admin-role-assignment">
        <label>
          <span>Asignar o reemplazar</span>
          <select data-role-select="${area.id}" ${assignable.length?'':'disabled'}><option value="">Selecciona una persona</option>${options}</select>
        </label>
        <button class="admin-primary-action" type="button" data-role-save="${area.id}" ${assignable.length?'':'disabled'}>${leader?'Guardar reemplazo':'Asignar liderazgo'}</button>
      </div>
      <div class="admin-role-colider-group ${coOpen?'is-open':''}">
        <button class="admin-role-colider-toggle" type="button" data-colider-toggle="${area.id}" aria-expanded="${coOpen}" aria-controls="admin-role-colider-panel-${area.id}">
          <span class="admin-role-colider-summary">
            <b>Co-líderes técnicos</b>
            <small>${coLeaders.length?coLeaders.map(person=>esc(person.nombre)).join(' · '):'Dos cupos disponibles'}</small>
          </span>
          <span class="admin-role-colider-toggle-meta">
            <strong>${coLeaders.length} / 2</strong>
            <em data-colider-toggle-label>${coOpen?'Cerrar':coLeaders.length?'Gestionar':'Asignar'}</em>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5"/></svg>
          </span>
        </button>
        <div class="admin-role-colider-panel" id="admin-role-colider-panel-${area.id}" ${coOpen?'':'hidden'}>
          ${coLeaderSlots}
        </div>
      </div>
      <footer class="admin-role-area-foot">
        <span class="role-foot-accounts"><i class="role-dot-pulse"></i>${area.cuentas_activadas||0} cuentas activadas</span>
        <span class="${waiting?'waiting':'ready'}">${waiting?`${waiting} pendiente${waiting===1?'':'s'} de primer ingreso`:'Todo el equipo activo ya ingresó'}</span>
      </footer>
    </article>`;
  }).join(''):'<p class="admin-empty">No hay áreas activas para administrar.</p>';
  initRoleSelectPickers();
  renderRoleAudit();
}

function initRoleSelectPickers(){
  const map=$('admin-role-map');if(!map)return;
  map.querySelectorAll('select[data-role-select], select[data-colider-select]').forEach(initRoleCustomSelect);
}

function initRoleCustomSelect(select){
  if(!select||select.dataset.rolePickerInit)return;
  select.dataset.rolePickerInit='true';
  const wrap=document.createElement('div');wrap.className='role-custom-select';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='role-picker-trigger';
  trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  if(select.disabled)trigger.disabled=true;

  const popup=document.createElement('div');popup.className='role-picker-popup';popup.hidden=true;
  popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Seleccionar colaborador');

  const searchWrap=document.createElement('div');searchWrap.className='role-picker-search';
  searchWrap.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="text" placeholder="Buscar colaborador…" autocomplete="off">';
  const searchInput=searchWrap.querySelector('input');

  const list=document.createElement('div');list.className='role-picker-options';list.setAttribute('role','listbox');
  const empty=document.createElement('div');empty.className='role-picker-empty';empty.textContent='No hay coincidencias';empty.hidden=true;

  popup.append(searchWrap,list,empty);
  select.before(wrap);
  wrap.append(trigger,select);
  select.hidden=true;

  let opened=false;

  function getInitials(text){
    if(!text||text.toLowerCase().includes('selecciona'))return '';
    return text.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()).join('');
  }

  function syncTrigger(){
    const opt=select.selectedOptions[0]||select.options[0];
    const val=select.value;
    const txt=opt?opt.textContent:'Selecciona una persona';
    const inits=getInitials(txt);
    trigger.innerHTML=`<span class="role-trigger-content"><span class="role-trigger-mark ${val?'has-val':'empty'}">${inits?esc(inits):'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}</span><span class="role-trigger-text ${val?'':'empty'}">${esc(txt)}</span></span><svg class="role-trigger-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 10 5 5 5-5"/></svg>`;
    trigger.classList.toggle('has-selection',!!val);
    trigger.setAttribute('aria-label',`Seleccionar: ${txt}`);
  }

  function renderOptions(){
    const q=searchInput.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    list.replaceChildren();
    let count=0;
    [...select.options].forEach(o=>{
      const t=o.textContent;
      const normalized=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      if(q&&!normalized.includes(q))return;
      count++;
      const btn=document.createElement('button');btn.type='button';btn.className='role-picker-option';
      btn.setAttribute('role','option');
      const isSelected=String(o.value)===String(select.value);
      btn.setAttribute('aria-selected',String(isSelected));
      if(isSelected)btn.classList.add('is-selected');
      const inits=getInitials(t);
      btn.innerHTML=`<span class="role-opt-info"><span class="role-opt-avatar ${o.value?'has-val':'empty'}">${inits?esc(inits):'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}</span><span class="role-opt-name ${o.value?'':'empty'}">${esc(t)}</span></span>${isSelected?'<svg class="role-opt-check" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6"/></svg>':''}`;
      btn.addEventListener('click',()=>{
        select.value=o.value;
        syncTrigger();
        close(true);
        select.dispatchEvent(new Event('change',{bubbles:true}));
      });
      list.append(btn);
    });
    empty.hidden=count>0;
  }

  function position(){
    const r=trigger.getBoundingClientRect();
    const width=Math.min(Math.max(r.width,250),window.innerWidth-24);
    popup.style.position='fixed';popup.style.zIndex='2100';
    popup.style.width=`${width}px`;popup.style.left=`${Math.max(12,Math.min(r.left,window.innerWidth-width-12))}px`;
    const spaceBelow=window.innerHeight-r.bottom-12,spaceAbove=r.top-12,openUp=spaceBelow<220&&spaceAbove>spaceBelow;
    popup.style.maxHeight=`${Math.max(120,Math.min(320,openUp?spaceAbove:spaceBelow))}px`;
    popup.style.top=openUp?'auto':`${r.bottom+6}px`;popup.style.bottom=openUp?`${window.innerHeight-r.top+6}px`:'auto';
  }

  function close(focusTrigger=false){
    if(!opened)return;opened=false;
    popup.hidden=true;trigger.setAttribute('aria-expanded','false');
    if(popup.parentNode===document.body)document.body.removeChild(popup);
    if(focusTrigger)trigger.focus({preventScroll:true});
  }

  function open(){
    if(select.disabled||opened)return;
    document.querySelectorAll('.role-picker-popup:not([hidden])').forEach(p=>p.hidden=true);
    opened=true;
    if(!document.body.contains(popup))document.body.appendChild(popup);
    searchInput.value='';
    searchWrap.hidden=select.options.length<=5;
    popup.hidden=false;trigger.setAttribute('aria-expanded','true');
    renderOptions();
    position();
    if(!searchWrap.hidden)searchInput.focus({preventScroll:true});
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
  new MutationObserver(syncTrigger).observe(select,{childList:true,characterData:true});
  syncTrigger();
}

function renderRoleAudit(){
  const events=APP.adminRoles?.eventos||[],labels={asignar_lider:'Asignó un líder técnico',reemplazar_lider:'Reemplazó al líder técnico',retirar_lider:'Retiró el liderazgo',asignar_colider:'Asignó un co-líder técnico',reemplazar_colider:'Reemplazó a un co-líder técnico',retirar_colider:'Retiró un co-liderazgo'};
  $('admin-role-audit').innerHTML=events.length?events.map(event=>`<article><i class="${event.accion}"></i><span><b>${esc(labels[event.accion]||event.accion)}</b><small>${esc(event.area||'Área')} · ${esc(event.actor||'Administrador')}</small></span><span class="admin-role-audit-change">${event.lider_anterior?esc(event.lider_anterior)+' → ':''}${event.lider_nuevo?esc(event.lider_nuevo):'Sin líder'}</span><time>${new Date(event.created_at).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'})}</time></article>`).join(''):'<p class="admin-empty">Las próximas asignaciones quedarán registradas aquí.</p>';
}

function setRoleControlsBusy(busy){
  document.querySelectorAll('[data-role-save],[data-role-remove],[data-colider-save],[data-colider-remove]').forEach(button=>button.disabled=busy);
}

function toggleAreaCoLeaders(areaId){
  const areaKey=String(areaId),toggle=document.querySelector(`[data-colider-toggle="${CSS.escape(areaKey)}"]`),panel=$(`admin-role-colider-panel-${areaKey}`);
  if(!toggle||!panel)return;
  const open=toggle.getAttribute('aria-expanded')!=='true';
  if(open)ROLE_COLEADER_OPEN.add(areaKey);else ROLE_COLEADER_OPEN.delete(areaKey);
  toggle.setAttribute('aria-expanded',String(open));
  panel.hidden=!open;
  toggle.closest('.admin-role-colider-group')?.classList.toggle('is-open',open);
  const label=toggle.querySelector('[data-colider-toggle-label]');
  if(label)label.textContent=open?'Cerrar':Number(toggle.querySelector('strong')?.textContent?.split('/')[0])?'Gestionar':'Asignar';
}

function closeRoleConfirm(confirmed=false){
  const modal=$('admin-role-confirm-modal');if(modal.hidden)return false;
  const resolve=ROLE_CONFIRM.resolve,trigger=ROLE_CONFIRM.trigger;
  ROLE_CONFIRM={resolve:null,trigger:null};
  modal.hidden=true;document.body.classList.remove('admin-role-confirm-open');
  if(resolve)resolve(confirmed);
  if(!confirmed&&trigger?.isConnected)setTimeout(()=>trigger.focus(),0);
  return true;
}

function confirmRoleAction({tone='assign',title,copy,personLabel='Persona',person,area,impactTitle,impactCopy,actionLabel}){
  if(ROLE_CONFIRM.resolve)closeRoleConfirm(false);
  const modal=$('admin-role-confirm-modal');
  modal.dataset.tone=tone;
  $('admin-role-confirm-title').textContent=title;
  $('admin-role-confirm-copy').textContent=copy;
  $('admin-role-confirm-person-label').textContent=personLabel;
  $('admin-role-confirm-person').textContent=person;
  $('admin-role-confirm-area').textContent=area;
  $('admin-role-confirm-impact-title').textContent=impactTitle;
  $('admin-role-confirm-impact-copy').textContent=impactCopy;
  $('admin-role-confirm-submit').textContent=actionLabel;
  modal.hidden=false;document.body.classList.add('admin-role-confirm-open');
  return new Promise(resolve=>{
    ROLE_CONFIRM={resolve,trigger:document.activeElement};
    setTimeout(()=>(tone==='remove'?$('admin-role-confirm-cancel'):$('admin-role-confirm-submit')).focus(),0);
  });
}

async function saveAreaLeader(areaId){
  const area=(APP.adminRoles?.areas||[]).find(item=>String(item.id)===String(areaId)),select=document.querySelector(`[data-role-select="${CSS.escape(String(areaId))}"]`);
  if(!area||!select?.value)return rolesMessage('Selecciona primero a la persona que liderará el área.',true);
  const next=(area.personas||[]).find(person=>String(person.id)===select.value);if(!next)return;
  const action=area.lider&&String(area.lider.id)!==String(next.id)?'reemplazar':'asignar';
  if(action==='reemplazar'&&!await confirmRoleAction({tone:'replace',title:'Reemplazar líder técnico',copy:`El cambio se aplicará inmediatamente en ${area.nombre}.`,personLabel:'Cambio de liderazgo',person:`${area.lider.nombre} por ${next.nombre}`,area:area.nombre,impactTitle:'Información que se conserva',impactCopy:'Los contratos, PIN y registros de asistencia de ambas personas permanecerán intactos.',actionLabel:'Confirmar reemplazo'}))return;
  if(action==='asignar'&&!area.lider&&!await confirmRoleAction({title:'Asignar líder técnico',copy:`Confirma quién asumirá el liderazgo principal de ${area.nombre}.`,person:next.nombre,area:area.nombre,impactTitle:'Acceso que recibirá',impactCopy:'Podrá consultar perfiles, asistencia, impedimentos y evidencias de las personas del área.',actionLabel:'Asignar liderazgo'}))return;
  rolesMessage('Guardando el liderazgo…');setRoleControlsBusy(true);
  const {data,error}=await db.rpc('dash_admin_asignar_lider',{p_area:Number(areaId),p_colab:Number(next.id)});
  if(error||!data?.ok){
    const messages={sin_permiso:'Solo un administrador de sistemas puede cambiar líderes.',persona_area:'La persona ya no está activa en esa área.',sin_cuenta:'La persona debe ingresar al dashboard al menos una vez antes de ser líder.',area:'El área ya no está activa.'};
    rolesMessage(messages[data?.motivo]||'No se pudo guardar el liderazgo. No se realizó ningún cambio.',true);renderAdminRoles();return;
  }
  await loadAdminRoles();toast(data.sin_cambios?'El liderazgo ya estaba asignado.':action==='reemplazar'?'Líder técnico reemplazado.':'Líder técnico asignado.');
}

async function removeAreaLeader(areaId){
  const area=(APP.adminRoles?.areas||[]).find(item=>String(item.id)===String(areaId));if(!area?.lider)return;
  if(!await confirmRoleAction({tone:'remove',title:'Retirar líder técnico',copy:`${area.lider.nombre} dejará de consultar el equipo de ${area.nombre}.`,person:area.lider.nombre,area:area.nombre,impactTitle:'Qué cambiará',impactCopy:'El área quedará sin líder principal. Su cuenta personal y sus asistencias se conservarán.',actionLabel:'Retirar liderazgo'}))return;
  rolesMessage('Retirando el liderazgo…');setRoleControlsBusy(true);
  const {data,error}=await db.rpc('dash_admin_asignar_lider',{p_area:Number(areaId),p_colab:null});
  if(error||!data?.ok){rolesMessage('No se pudo retirar el liderazgo. El acceso actual se conserva.',true);renderAdminRoles();return;}
  await loadAdminRoles();toast('Liderazgo retirado; la cuenta personal se conserva.');
}

async function saveAreaCoLeader(areaId,slot){
  const area=(APP.adminRoles?.areas||[]).find(item=>String(item.id)===String(areaId));
  const select=document.querySelector(`[data-colider-select="${CSS.escape(String(areaId))}"][data-colider-index="${CSS.escape(String(slot))}"]`);
  if(!area||!select?.value)return rolesMessage('Selecciona primero a la persona que será co-líder técnico.',true);
  const current=(area.co_lideres||[])[Number(slot)]||null;
  const next=(area.personas||[]).find(person=>String(person.id)===select.value);if(!next)return;
  const action=current?'reemplazar':'asignar';
  if(current&&String(current.id)!==String(next.id)&&!await confirmRoleAction({tone:'replace',title:'Reemplazar co-líder técnico',copy:`El cambio se aplicará inmediatamente en ${area.nombre}.`,personLabel:'Cambio de co-liderazgo',person:`${current.nombre} por ${next.nombre}`,area:area.nombre,impactTitle:'Información que se conserva',impactCopy:'Los contratos, PIN y registros de asistencia de ambas personas permanecerán intactos.',actionLabel:'Confirmar reemplazo'}))return;
  if(!current&&!await confirmRoleAction({title:'Asignar co-líder técnico',copy:`Confirma que ${next.nombre} acompañará el liderazgo de ${area.nombre}.`,person:next.nombre,area:area.nombre,impactTitle:'Acceso que recibirá',impactCopy:'Tendrá el mismo alcance de consulta y seguimiento que el líder técnico dentro del área.',actionLabel:'Asignar co-líder'}))return;
  rolesMessage('Guardando el co-liderazgo…');setRoleControlsBusy(true);
  const {data,error}=await db.rpc('dash_admin_asignar_colider',{p_area:Number(areaId),p_colab:Number(next.id),p_anterior:current?Number(current.id):null});
  if(error||!data?.ok){
    const messages={sin_permiso:'Solo un administrador de sistemas puede cambiar co-líderes.',persona_area:'La persona ya no está activa en esa área.',sin_cuenta:'La persona debe ingresar al dashboard al menos una vez antes de ser co-líder.',area:'El área ya no está activa.',sin_cupo:'El área ya tiene sus dos co-líderes técnicos.',es_lider:'El líder técnico principal no puede ocupar también un cupo de co-líder.',ya_colider:'La persona ya es co-líder técnico de esta área.',colider_no_encontrado:'Ese cupo cambió mientras editabas. Actualiza e inténtalo nuevamente.'};
    rolesMessage(messages[data?.motivo]||'No se pudo guardar el co-liderazgo. No se realizó ningún cambio.',true);renderAdminRoles();return;
  }
  await loadAdminRoles();toast(data.sin_cambios?'El co-liderazgo ya estaba asignado.':action==='reemplazar'?'Co-líder técnico reemplazado.':'Co-líder técnico asignado.');
}

async function removeAreaCoLeader(areaId,slot){
  const area=(APP.adminRoles?.areas||[]).find(item=>String(item.id)===String(areaId)),current=(area?.co_lideres||[])[Number(slot)];if(!current)return;
  if(!await confirmRoleAction({tone:'remove',title:'Retirar co-líder técnico',copy:`${current.nombre} dejará de consultar el equipo de ${area.nombre}.`,person:current.nombre,area:area.nombre,impactTitle:'Qué cambiará',impactCopy:'Perderá el acceso al equipo del área, pero conservará su cuenta personal y sus asistencias.',actionLabel:'Retirar co-liderazgo'}))return;
  rolesMessage('Retirando el co-liderazgo…');setRoleControlsBusy(true);
  const {data,error}=await db.rpc('dash_admin_asignar_colider',{p_area:Number(areaId),p_colab:null,p_anterior:Number(current.id)});
  if(error||!data?.ok){rolesMessage('No se pudo retirar el co-liderazgo. El acceso actual se conserva.',true);renderAdminRoles();return;}
  await loadAdminRoles();toast('Co-liderazgo retirado; la cuenta personal se conserva.');
}

$('admin-role-map').onclick=event=>{
  const toggle=event.target.closest('[data-colider-toggle]'),save=event.target.closest('[data-role-save]'),remove=event.target.closest('[data-role-remove]'),coSave=event.target.closest('[data-colider-save]'),coRemove=event.target.closest('[data-colider-remove]');
  if(toggle)return toggleAreaCoLeaders(toggle.dataset.coliderToggle);
  if(save)return saveAreaLeader(save.dataset.roleSave);
  if(remove)return removeAreaLeader(remove.dataset.roleRemove);
  if(coSave)return saveAreaCoLeader(coSave.dataset.coliderSave,coSave.dataset.coliderIndex);
  if(coRemove)return removeAreaCoLeader(coRemove.dataset.coliderRemove,coRemove.dataset.coliderIndex);
};

document.querySelectorAll('[data-close-role-confirm]').forEach(button=>button.onclick=()=>closeRoleConfirm(false));
$('admin-role-confirm-submit').onclick=()=>closeRoleConfirm(true);
$('admin-role-confirm-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeRoleConfirm(false);return}
  if(event.key!=='Tab')return;
  const focusable=[...$('admin-role-confirm-modal').querySelectorAll('button:not(:disabled):not([hidden])')].filter(element=>element.offsetParent!==null);if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
