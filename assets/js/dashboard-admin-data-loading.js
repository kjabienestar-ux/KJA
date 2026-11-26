/* KJA-048 · Carga por regiones para Gestión del equipo y reportes. */
(() => {
  const configs=new Map(),records=new Map(),running=new Map(),inertDefaults=new WeakMap(),disabledDefaults=new WeakMap();
  const $=id=>document.getElementById(id);
  const enabled=kind=>configs.has(kind)&&matchMedia('(min-width:901px)').matches;
  const scope=kind=>{
    const ids={mes:['admin-month-value','admin-month-inactive'],facebook:['fb-report-from','fb-report-to','fb-report-kind','fb-report-reference'],ranking:['ranking-month']}[kind]||[];
    return [APP.sessionUid,APP.access.rol,APP.access.acceso_panel,APP.identity?.isSystem,APP.access.area_id,APP.inicio?.colaborador?.area_id,isoLima(),kind,...ids.map(id=>$(id)?.type==='checkbox'?$(id).checked:$(id)?.value)].join('|');
  };
  const rows=(columns=4,avatar=false,{count=3,compact=false}={})=>`<div class="adc-rows${compact?' adc-compact':''}">${Array.from({length:count},()=>`<div class="adc-row" style="--adc-columns:${columns}">${avatar?DashboardSkeleton.block('adc-avatar'):''}${Array.from({length:columns},(_,i)=>`<div>${DashboardSkeleton.block(i?'adc-line':'adc-title')}${DashboardSkeleton.block('adc-detail')}</div>`).join('')}</div>`).join('')}</div>`;
  const metrics=labels=>`<div class="adc-metrics" style="--adc-columns:${labels.length}">${labels.map(label=>`<div><span>${label}</span>${DashboardSkeleton.block('adc-number')}</div>`).join('')}</div>`;
  function register(kind,config){configs.set(kind,config);}
  function busy(kind){return running.has(kind);}
  function refreshing(kind){return !!running.get(kind)?.previous;}
  function shouldWrap(kind){return enabled(kind)&&APP.adminSection===kind&&!running.get(kind)?.invoking;}
  function run(kind,host,fetch,options={}){
    const config=configs.get(kind),key=scope(kind),flight=running.get(kind);
    if(flight?.key===key)return flight.promise;
    if(flight){flight.cancelled=true;DashboardSkeleton.cancel(host);}
    const cached=records.get(kind),previous=cached?.key===key?(config.currentSnapshot?.(cached.data)||cached.data):null;
    config.prepare?.(previous);
    const state={key,previous,host,promise:null};running.set(kind,state);
    const inert=new Map(),disabled=new Map(),draft=new Map(),resolvedDisabled=new Map();let observer,showing=false,success=false,settled=false;
    const notice=host.querySelector(':scope > .adc-notice')||document.createElement('p');
    notice.className='adc-notice';notice.removeAttribute('role');notice.textContent='';host.prepend(notice);
    host.classList.add('kja-context-data');host.dataset.adcPending='true';host.dataset.adcStale='false';
    const regions=config.regions.map(r=>({...r,node:$(r.id)})).filter(r=>r.node);
    for(const {node} of regions){if(!inertDefaults.has(node))inertDefaults.set(node,node.inert);inert.set(node,inertDefaults.get(node));node.inert=true;}
    // Los filtros locales conservan foco; las escrituras/exportaciones esperan la consulta.
    for(const node of host.querySelectorAll('[data-adc-dependent],button[type="submit"],#fb-report-export,#fb-report-pdf,#fb-report-download,#admin-month-export,#admin-access-save,#admin-access-open,#admin-access-rotate,[data-copy-access="activation"],#admin-new-person')){
      if(!disabledDefaults.has(node))disabledDefaults.set(node,node.disabled);
      disabled.set(node,disabledDefaults.get(node));node.disabled=true;
    }
    if(kind==='colaboradores'&&!previous)for(const node of host.querySelectorAll('[data-pw-tab]')){
      if(!disabledDefaults.has(node))disabledDefaults.set(node,node.disabled);
      disabled.set(node,disabledDefaults.get(node));node.disabled=true;
    }
    if(kind==='marcado')for(const node of host.querySelectorAll('#admin-access-settings input,#admin-access-settings button')){
      if(previous&&node.dataset.adcDirty==='true')draft.set(node,{value:node.value,checked:node.checked});
      if(!disabledDefaults.has(node))disabledDefaults.set(node,node.disabled);
      disabled.set(node,disabledDefaults.get(node));node.disabled=true;
      if(!previous)node.dataset.adcControlPending='true';
    }
    if(!previous){
      config.restore(null);
      for(const region of regions){region.clear?region.clear():region.node.replaceChildren();region.node.dataset.adcPreparing='true';}
    }
    const mount=()=>{
      if(!showing)return;
      config.reveal?.();
      for(const r of regions){
        if(!r.node.querySelector(':scope > .kja-context-layer'))DashboardSkeleton.setContextRegion(r.node,r.markup());
      }
    };
    state.promise=DashboardSkeleton.withSkeleton(host,kind,async()=>{
      try{
        let operation;state.invoking=true;
        try{operation=fetch();}finally{state.invoking=false;}
        const result=await operation;
        if(running.get(kind)!==state)return result;
        // Los lectores existentes devuelven undefined al descartar una respuesta
        // sustituida: no debe borrar la instantánea de otra vista que comparte datos.
        if(result===undefined){state.cancelled=true;DashboardSkeleton.cancel(host);return result;}
        if(scope(kind)!==key)throw new Error('Cambió el contexto de la consulta.');
        if(result!==true)throw new Error('No se pudo actualizar esta sección.');
        settled=true;success=true;records.set(kind,{key,data:config.capture()});
        for(const node of disabled.keys())if(['fb-report-export','fb-report-pdf','fb-report-download'].includes(node.id)){resolvedDisabled.set(node,node.disabled);node.disabled=true;}
        return true;
      }catch(error){
        settled=true;
        if(running.get(kind)===state){
          if(previous&&scope(kind)===key){config.restore(previous);config.render();host.dataset.adcStale='true';}
          else{config.restore(null);for(const region of regions)region.clear?region.clear():region.node.replaceChildren();}
          notice.textContent=previous?'No se pudo actualizar. Se muestran los datos anteriores.':'Información no disponible.';
        }
        throw error;
      }
    },{...options,presentation:'regions-context',contextLabel:config.label,preserveContent:!!previous,handlesErrors:true,
      onShow:()=>{showing=true;mount();observer=new MutationObserver(mount);observer.observe(host,{childList:true,subtree:true});},
      onCleanup:()=>{
        showing=false;observer?.disconnect();
        for(const {node} of regions){delete node.dataset.adcPreparing;DashboardSkeleton.setContextRegion(node,null);node.inert=inert.get(node)||(!success&&settled);if(success)inertDefaults.delete(node);}
        for(const [node,value] of disabled){node.disabled=(success&&resolvedDisabled.has(node)?resolvedDisabled.get(node):value)||(!success&&settled);if(success)disabledDefaults.delete(node);}
        for(const node of disabled.keys())delete node.dataset.adcControlPending;
        for(const [node,value] of draft){node.value=value.value;node.checked=value.checked;}
        if(kind==='marcado'&&(draft.has($('admin-office-lat'))||draft.has($('admin-office-lon')))){
          const point=readOfficePoint();
          if(point)paintOfficeMapPoint(point);else clearOfficeMapPoint();
          syncOfficeSelection();
        }
        host.dataset.adcPending='false';
        if(success||state.cancelled)notice.textContent='';
        else if(settled&&!state.cancelled){
          notice.setAttribute('role','alert');
          config.onError?.(!!previous);
          const retry=document.createElement('button');retry.type='button';retry.className='adc-retry';retry.textContent='Reintentar';
          retry.onclick=()=>run(kind,host,fetch,options);notice.append(' ',retry);
        }
        if(running.get(kind)===state)running.delete(kind);
      }
    });
    return state.promise;
  }
  const team=kind=>({label:kind==='colaboradores'?'colaboradores':'contratos',prepare:previous=>{
    if(kind!=='colaboradores'||typeof initPeopleWorkbench!=='function')return;
    initPeopleWorkbench();
    if(!previous){
      PEOPLE_WORKBENCH.tab='equipo';
      $('admin-new-person').hidden=!['direccion','editor'].includes(APP.access.rol);
      for(const id of ['admin-attendance-export-card','attendance-report-preview','admin-areas-panel','pw-areas-readonly','admin-manage-areas'])if($(id))$(id).hidden=true;
      for(const id of ['admin-people-list','admin-people-kpis'])$(id).hidden=false;
    }
  },capture:()=>APP.adminTeam,restore:data=>{APP.adminTeam=data;},render:()=>kind==='colaboradores'?renderAdminPeople():renderAdminContracts(),regions:kind==='colaboradores'?[
    {id:'admin-people-kpis',markup:()=>metrics(['Directorio','Sin DNI','Sin PIN','Contrato pendiente'])},
    {id:'admin-people-list',markup:()=>rows(4,true)}
  ]:[
    {id:'admin-contract-kpis',markup:()=>metrics(['Activos','Pendientes','Completados','Con alertas','Sin meta'])},
    {id:'admin-contract-count',markup:()=>DashboardSkeleton.block('adc-line')},
    {id:'admin-contract-list',markup:()=>rows(5,true)}
  ]});
  register('colaboradores',team('colaboradores'));register('contratos',team('contratos'));
  register('roles',{label:'roles y equipos',prepare:previous=>{
    if(!previous&&typeof ROLE_FILTERS!=='undefined')$('admin-role-filters').innerHTML=ROLE_FILTERS.map(([key,label])=>`<button type="button" disabled data-role-filter="${key}" aria-pressed="${ROLE_FILTER===key}">${label}</button>`).join('');
  },capture:()=>APP.adminRoles,restore:data=>{APP.adminRoles=data;},render:()=>renderAdminRoles(),regions:[
    {id:'admin-roles-kpis',markup:()=>metrics(['Áreas activas','Con líder','Sin líder','Co-líderes','Por revisar'])},
    {id:'admin-role-map',markup:()=>`<div class="adc-role-cards">${Array.from({length:2},()=>`<article>${DashboardSkeleton.block('adc-title')}<div><section><span>Líder técnico</span>${DashboardSkeleton.lines(2)}</section><section><span>Co-líderes</span>${DashboardSkeleton.lines(2)}</section></div>${DashboardSkeleton.block('adc-line')}</article>`).join('')}</div>`},
    {id:'admin-role-audit',markup:()=>rows(3,false,{compact:true})}
  ]});
  register('mes',{label:'mes completo',capture:()=>APP.adminMonth?({data:APP.adminMonth,key:APP.adminMonthKey}):null,restore:snapshot=>{APP.adminMonth=snapshot?.data||null;APP.adminMonthKey=snapshot?.key||'';},render:()=>renderAdminMonthViews(),regions:[
    {id:'admin-month-kpis',markup:()=>metrics(['Personas','Jornadas válidas','Asistencia','Incompletas','Sin entrada'])},
    {id:'admin-month-ledger',markup:()=>`<div class="adc-ledger-head">Colaborador <span>Días del mes</span></div>${rows(8,true)}`},
    {id:'admin-month-pagination',markup:()=>DashboardSkeleton.block('adc-line')}
  ]});
  const clearAccessFields=()=>{
    if($('admin-activation-url'))$('admin-activation-url').value='';
    if($('admin-access-updated'))$('admin-access-updated').textContent='';
    for(const node of document.querySelectorAll('#admin-access-settings input')){
      if(node.id==='admin-access-evidence')continue;
      if(node.type==='checkbox')node.checked=false;else node.value='';
      delete node.dataset.adcDirty;
    }
  };
  register('marcado',{label:'acceso y marcado',prepare:previous=>{if(!previous)clearAccessFields();},onReset:clearAccessFields,capture:()=>APP.adminAccess,restore:data=>{APP.adminAccess=data;},render:()=>renderAdminAccess(),regions:[
    {id:'admin-access-kpis',markup:()=>metrics(['Personas activas','Con PIN','Sin PIN','Bloqueados','Sin DNI'])},
    {id:'admin-access-health',markup:()=>DashboardSkeleton.block('adc-title')},
    {id:'admin-access-request-count',markup:()=>DashboardSkeleton.block('adc-line')},
    {id:'admin-access-requests',markup:()=>rows(3,true,{compact:true})},
    {id:'admin-access-list',markup:()=>rows(3,true,{count:4,compact:true})},
    {id:'admin-access-audit',markup:()=>rows(3,false,{compact:true})}
  ]});
  function reset(){
    for(const state of running.values()){state.cancelled=true;DashboardSkeleton.cancel(state.host);}
    running.clear();records.clear();
    for(const field of ['adminTeamRequest','adminRolesRequest','adminMonthRequest','adminAccessRequest'])APP[field]=(APP[field]||0)+1;
    for(const config of configs.values()){
      config.invalidate?.();config.restore(null);config.onReset?.();
      for(const region of config.regions){const node=$(region.id);if(!node)continue;region.clear?region.clear():node.replaceChildren();delete node.dataset.adcPreparing;DashboardSkeleton.setContextRegion(node,null);node.inert=inertDefaults.get(node)||false;inertDefaults.delete(node);}
    }
    document.querySelectorAll('.kja-context-data').forEach(host=>{
      host.querySelector('.adc-notice')?.remove();host.dataset.adcPending='false';host.dataset.adcStale='false';
      for(const node of host.querySelectorAll('button,input,select'))if(disabledDefaults.has(node)){node.disabled=disabledDefaults.get(node);disabledDefaults.delete(node);delete node.dataset.adcControlPending;}
    });
  }
  globalThis.AdminDataLoading={enabled,run,register,busy,refreshing,shouldWrap,rows,metrics,reset};
  document.addEventListener('input',event=>{if(event.target.closest('#admin-access-settings'))event.target.dataset.adcDirty='true';});
})();
