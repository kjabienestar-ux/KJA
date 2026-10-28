/* Lateral de Gestión en escritorio: agrupa las secciones en familias sin crear permisos nuevos.
   Cada destino se muestra solo si su pestaña de .admin-section-nav está visible; la barra de pestañas
   sigue siendo la navegación en móvil. */
(function(){
  const $=id=>document.getElementById(id);
  const portal=$('portal'),lateral=$('admin-lateral'),tabs=document.querySelector('#view-gestion .admin-section-nav');
  if(!portal||!lateral||!tabs)return;
  const desktop=window.matchMedia('(min-width:901px)');
  const FOLD_KEY='kja-admin-lateral-plegadas',RAIL_KEY='kja-admin-rail-abierta';
  const SLUGS={overview:'resumen',solicitudes:'solicitudes'};
  const FAMILY_NAMES={operacion:'Operación del día',asignaciones:'Asignaciones y entregas',personas:'Personas y acceso',incorporacion:'Incorporación y organización',resultados:'Resultados por período'};
  const items=[...lateral.querySelectorAll('[data-lateral-section]')];
  const families=[...lateral.querySelectorAll('.admin-lateral-family')];
  // Solicitudes navega a la vista de Reclutamiento; se recuerda si se abrió desde aquí.
  let recruitmentInGestion=false,syncing=false;

  const setHidden=(el,value)=>{if(el&&el.hidden!==value)el.hidden=value};
  const storageKey=base=>APP.sessionUid?`${base}:${APP.sessionUid}`:'';
  function readStore(base,fallback){const key=storageKey(base);if(!key)return fallback;try{const value=JSON.parse(localStorage.getItem(key));return value??fallback}catch(e){return fallback}}
  function writeStore(base,value){const key=storageKey(base);if(!key)return;try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}

  function sourceTab(section){
    return section==='solicitudes'?$('admin-recruitment-tab'):tabs.querySelector(`[data-admin-section="${section}"]`);
  }
  const visible=item=>{const tab=sourceTab(item.dataset.lateralSection);return !!tab&&!tab.hidden};
  const label=item=>item.querySelector('span')?.textContent.trim()||'';
  const pending=item=>Number(item.querySelector('[data-rec-pending-count]:not([hidden])')?.textContent)||0;

  function lateralActive(){return APP.access.acceso_panel&&(APP.view==='gestion'||(APP.view==='reclutamiento'&&recruitmentInGestion));}
  function currentSection(){return APP.view==='reclutamiento'?'solicitudes':APP.adminSection;}

  function renderBreadcrumb(item){
    const family=item?.closest('.admin-lateral-family')?.dataset.family;
    const crumbs=['Gestión de asistencia',FAMILY_NAMES[family],item&&label(item)].filter(Boolean);
    document.querySelectorAll('[data-admin-breadcrumb]').forEach(list=>{
      list.replaceChildren(...crumbs.map((text,index)=>{
        const li=document.createElement('li');li.textContent=text;li.title=text;
        if(index===crumbs.length-1)li.setAttribute('aria-current','page');
        return li;
      }));
    });
  }

  function syncFamilies(active){
    const folded=readStore(FOLD_KEY,[]);
    families.forEach(family=>{
      const own=[...family.querySelectorAll('[data-lateral-section]')],shown=own.filter(item=>!item.closest('li').hidden);
      setHidden(family,!shown.length);
      const isOpen=!folded.includes(family.dataset.family),head=family.querySelector('.admin-lateral-family-head'),meta=family.querySelector('.admin-lateral-family-meta');
      const containsActive=shown.includes(active);
      family.classList.toggle('is-current',containsActive);
      family.classList.toggle('is-folded',!isOpen);
      head.setAttribute('aria-expanded',String(isOpen));
      // Plegada, la familia conserva a la vista su destino activo.
      own.forEach(item=>item.closest('li').classList.toggle('is-tucked',!isOpen&&item!==active));
      const total=shown.reduce((sum,item)=>sum+pending(item),0);
      setHidden(meta,isOpen);
      meta.innerHTML=isOpen?'':`${shown.length}${total?` <b aria-label="${total} pendientes">${total}</b>`:''}`;
    });
  }

  function syncRailToggle(active){
    const toggle=$('admin-rail-toggle'),open=active&&readStore(RAIL_KEY,false)===true;
    if(active&&desktop.matches)portal.dataset.adminRail=open?'open':'icons';else delete portal.dataset.adminRail;
    if(!toggle)return;
    setHidden(toggle,!(active&&desktop.matches));
    const text=open?'Ocultar nombres':'Mostrar nombres';
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',`${text} de la navegación`);
    toggle.dataset.sidebarTooltip=text;
  }

  function syncMainNav(desk){
    const certs=$('nav-cert-cuentas'),zoom=$('nav-zoom'),divider=$('sys-nav-divider');
    setHidden(divider,!!certs?.hidden&&!!zoom?.hidden);
    // Publicaciones y Mi perfil cierran el menú; la línea solo aparece si hay destinos encima.
    const tools=$('tools-nav-divider');
    if(tools){
      const buttons=[...tools.parentElement.querySelectorAll(':scope > button')],at=buttons.findIndex(b=>b.compareDocumentPosition(tools)&Node.DOCUMENT_POSITION_PRECEDING);
      const above=buttons.slice(0,at<0?buttons.length:at),below=at<0?[]:buttons.slice(at);
      setHidden(tools,!(above.some(b=>!b.hidden)&&below.some(b=>!b.hidden)));
    }
    const recruit=$('nav-reclutamiento');
    if(recruit){
      const count=Number(recruit.querySelector('[data-rec-pending-count]:not([hidden])')?.textContent)||0;
      recruit.dataset.sidebarTooltip=count?`Reclutamiento · ${count} pendientes`:'Reclutamiento';
    }
    if(!(desk&&APP.view==='reclutamiento'))return;
    // Solicitudes abiertas desde el lateral siguen dentro de Gestión.
    recruit?.classList.remove('active');recruit?.removeAttribute('aria-current');
    const gestion=$('nav-gestion');gestion?.classList.add('active');gestion?.setAttribute('aria-current','page');
  }

  function syncHash(active){
    const current=location.hash;
    if(active){
      const section=currentSection(),hash=`#gestion/${SLUGS[section]||section}`;
      if(current!==hash)history[current.startsWith('#gestion/')?'pushState':'replaceState'](null,'',hash);
    }else if(current.startsWith('#gestion/')){
      history.replaceState(null,'',location.pathname+location.search);
    }
  }

  function sync(){
    if(syncing)return;syncing=true;
    try{
      if(APP.view!=='reclutamiento')recruitmentInGestion=false;
      const active=lateralActive(),desk=active&&desktop.matches;
      items.forEach(item=>setHidden(item.closest('li'),!visible(item)));
      const section=currentSection(),current=items.find(item=>item.dataset.lateralSection===section&&!item.closest('li').hidden);
      items.forEach(item=>{
        const on=item===current;
        item.classList.toggle('active',on);
        if(on)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
      });
      setHidden(lateral,!active);
      if(active)portal.dataset.adminLateral='true';else delete portal.dataset.adminLateral;
      syncFamilies(current);
      renderBreadcrumb(current);
      setHidden(tabs.querySelector('[data-admin-breadcrumb]'),!desk);
      const chip=$('admin-role-chip');setHidden(chip,!desk);
      setHidden($('rec-context-bar'),!(desk&&APP.view==='reclutamiento'));
      document.querySelectorAll('[data-admin-context-role]').forEach(el=>{el.textContent=chip?.textContent||''});
      syncRailToggle(active);
      syncMainNav(desk);
      if(APP.access.acceso_panel)syncHash(active);
      if(typeof syncSidebarCollapse==='function')syncSidebarCollapse();
    }finally{syncing=false}
  }

  function open(section){
    if(section==='solicitudes'){recruitmentInGestion=true;return goView('reclutamiento');}
    recruitmentInGestion=false;
    if(APP.view==='gestion')return showAdminSection(section);
    APP.adminSection=section;
    return goView('gestion');
  }

  items.forEach(item=>item.addEventListener('click',()=>open(item.dataset.lateralSection)));
  families.forEach(family=>family.querySelector('.admin-lateral-family-head').addEventListener('click',()=>{
    const id=family.dataset.family,folded=readStore(FOLD_KEY,[]);
    writeStore(FOLD_KEY,folded.includes(id)?folded.filter(value=>value!==id):[...folded,id]);
    sync();
  }));
  $('admin-rail-toggle')?.addEventListener('click',()=>{writeStore(RAIL_KEY,readStore(RAIL_KEY,false)!==true);sync();});
  // Reclutamiento abierto desde la barra principal se ve como hoy; desde Gestión conserva el lateral.
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('[data-view="reclutamiento"],[data-go="reclutamiento"]');
    if(link)recruitmentInGestion=!link.closest('#sidebar')&&APP.view==='gestion';
  },true);
  $('rec-context-refresh')?.addEventListener('click',()=>window.kjaRecruitment?.refresh?.());

  // Al entrar a una sección de una familia plegada, esa familia se abre sola.
  function unfoldFor(section){
    const family=items.find(item=>item.dataset.lateralSection===section)?.closest('.admin-lateral-family')?.dataset.family;
    const folded=readStore(FOLD_KEY,[]);
    if(family&&folded.includes(family))writeStore(FOLD_KEY,folded.filter(value=>value!==family));
  }
  let lastSection='';
  function onShellChange(){
    const section=lateralActive()?currentSection():'';
    if(section&&section!==lastSection)unfoldFor(section);
    lastSection=section;
    sync();
  }

  function fromHash(){
    const match=/^#gestion\/([a-z]+)$/.exec(location.hash);
    if(!match)return '';
    const slug=match[1];
    return Object.keys(SLUGS).find(key=>SLUGS[key]===slug)||slug;
  }
  // Un enlace directo elige la sección inicial antes de que el portal abra Gestión.
  const initial=fromHash();
  if(initial&&initial!=='solicitudes')APP.adminSection=initial;
  let pendingRecruitment=initial==='solicitudes';
  window.addEventListener('popstate',()=>{
    const section=fromHash();
    if(!section||!APP.access.acceso_panel)return;
    if(section===currentSection()&&lateralActive())return;
    open(section);
  });

  new MutationObserver(()=>{
    if(pendingRecruitment&&APP.view==='gestion'&&APP.access.acceso_panel&&!$('admin-recruitment-tab')?.hidden){pendingRecruitment=false;open('solicitudes');return;}
    onShellChange();
  }).observe(portal,{attributes:true,attributeFilter:['data-view','data-admin-section']});
  new MutationObserver(sync).observe(tabs,{subtree:true,attributes:true,attributeFilter:['hidden']});
  const watched=[$('nav-cert-cuentas'),$('nav-zoom'),$('nav-reclutamiento'),$('nav-marketing'),$('nav-inicio'),$('nav-equipo'),$('nav-gestion')].filter(Boolean);
  const mainObserver=new MutationObserver(sync);
  watched.forEach(el=>mainObserver.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']}));
  lateral.querySelectorAll('[data-rec-pending-count]').forEach(el=>mainObserver.observe(el,{childList:true,characterData:true,attributes:true,attributeFilter:['hidden']}));
  if(desktop.addEventListener)desktop.addEventListener('change',sync);else desktop.addListener?.(sync);
  sync();
  window.KJAAdminLateral={sync};
})();
