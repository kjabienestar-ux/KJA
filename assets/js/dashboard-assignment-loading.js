/* Neutro con contexto, optativo para Asignaciones en escritorio. */
(() => {
  const S={scope:'',snapshot:null,review:null,shown:false,busy:false,stale:false};
  const enabled=()=>APP.adminSection==='asignaciones'&&typeof DashboardSkeleton!=='undefined'&&matchMedia('(min-width:901px)').matches;
  const root=()=>$('admin-assignments-section');
  const shape=cls=>S.shown?DashboardSkeleton.block(cls):`<span class="asg-loading-space ${cls}" aria-hidden="true"></span>`;
  let formInert=false;
  function clearFormSkeleton(){
    const form=$('admin-close-assignment-form');
    if(!form?.classList.contains('asg-form-pending'))return;
    form.querySelector('.asg-form-skeleton')?.remove();form.classList.remove('asg-form-pending');form.inert=formInert;
  }
  function showFormSkeleton(){
    const form=$('admin-close-assignment-form');if(!form||form.hidden||form.classList.contains('asg-form-pending'))return;
    formInert=form.inert===true||form.hasAttribute('inert');form.inert=true;form.classList.add('asg-form-pending');
    const layer=document.createElement('div');layer.className='asg-form-skeleton';layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');
    const head=form.querySelector('header');layer.style.top=(head?head.offsetTop+head.offsetHeight+24:24)+'px';
    const block=cls=>DashboardSkeleton.block(cls);
    layer.innerHTML=`<div class="asg-form-skeleton-body"><div>${block('asg-form-skeleton-label')}<div class="asg-form-skeleton-types">${Array.from({length:4},()=>block('asg-form-skeleton-type')).join('')}</div></div>`+
      block('asg-form-skeleton-tabs')+`<div class="asg-form-skeleton-fields">`+Array.from({length:3},()=>`<div>${block('asg-form-skeleton-label')}${block('asg-form-skeleton-input')}</div>`).join('')+
      `<div>${block('asg-form-skeleton-label')}${block('asg-form-skeleton-textarea')}</div></div>${block('asg-form-skeleton-guide')}</div>`+block('asg-form-skeleton-submit');
    form.append(layer);
  }
  function controls(){
    const valid=!!APP.adminClose&&S.scope===adminCloseReadScope($('admin-close-date').value||isoLima());
    const blocked=S.busy||S.stale||!valid;
    root().dataset.asgDestinationsPending=String(!valid);
    const canEdit=valid?!!APP.adminClose.puede_editar:['direccion','editor'].includes(APP.access.rol);
    if(!canEdit)$('assignment-create-panel').hidden=true;
    else if(root().dataset.asgReadOnly==='true')$('assignment-create-panel').hidden=false;
    root().dataset.asgReadOnly=String(!canEdit);
    $('admin-close-assignment-form').hidden=!canEdit;
    $('assignment-create-toggle').hidden=!canEdit;
    for(const node of root().querySelectorAll('#admin-close-target,.asg-picker-trigger,#admin-close-assign,#admin-close-draw-preview button,[data-cancel-admin-close],[data-assignment-review]'))node.disabled=blocked||!canEdit;
    $('admin-close-assign').disabled=blocked||!canEdit||$('admin-close-date').value<isoLima();
    $('admin-close-assignments-refresh').disabled=S.busy;
    if(APP.adminSection==='asignaciones')$('admin-refresh').disabled=S.busy;
  }
  function pending(){
    $('admin-close-assignment-count').innerHTML=shape('asg-loading-count');
    $('assignment-day-summary-stats').innerHTML=['Asignadas','Pendientes','Por revisar','Concluidas'].map(label=>`<div><dt>${label}</dt><dd>${shape('asg-loading-number')}</dd></div>`).join('');
    const available=innerHeight-$('admin-close-assignment-list').getBoundingClientRect().top;
    const count=Math.max(1,Math.min(3,Math.floor(available/150)));
    $('admin-close-assignment-list').innerHTML=Array.from({length:count},()=>`<div class="admin-close-assignment-row asg-loading-row" aria-hidden="true" inert><span class="admin-close-assignment-copy">${shape('asg-loading-type')}${shape('asg-loading-title')}${shape('asg-loading-destination')}</span><span class="admin-close-assignment-progress">${shape('asg-loading-state')}${shape('asg-loading-detail')}</span><div class="assignment-deliveries">${shape('asg-loading-evidence')}</div></div>`).join('');
  }
  function notice(){
    adminCloseMsg(APP.adminClose?'No se pudo actualizar. Se conservan los datos anteriores de esta fecha.':'No se pudieron cargar las asignaciones de esta fecha.','error');
    const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar';retry.className='asg-loading-retry';
    retry.onclick=()=>loadAdminCloses();$('admin-assignment-message').append(' ',retry);
    if(!APP.adminClose){
      $('admin-close-assignment-list').innerHTML='<p class="admin-empty">Información no disponible.</p>';
      $('admin-close-assignment-count').textContent='Sin consultar';
      $('assignment-day-summary-stats').innerHTML=['Asignadas','Pendientes','Por revisar','Concluidas'].map(label=>`<div><dt>${label}</dt><dd>—</dd></div>`).join('');
    }
  }
  async function run(scope,fetch,current){
    const previous=S.scope===scope?S.snapshot:null,review=previous?S.review:null;
    if(!previous){APP.adminClose=null;APP.adminReview=null;S.snapshot=null;S.scope=scope;$('admin-close-target').innerHTML='<option value="">Cargando destinos…</option>';$('assignment-target-matches').replaceChildren();$('admin-close-target-results').textContent='Consultando destinos…';}
    S.busy=true;S.shown=false;S.stale=false;root().classList.add('kja-context-view');
    if(typeof syncAssignmentCalendar==='function')syncAssignmentCalendar();
    let ok=false;
    return DashboardSkeleton.withSkeleton(root(),'asignaciones',async()=>{
      if(!previous)pending();controls();
      try{ok=await fetch();return ok;}catch{return false;}
    },{presentation:'regions-context',contextLabel:'asignaciones',preserveContent:!!previous,handlesErrors:true,
    onShow:()=>{if(current()){S.shown=true;pending();showFormSkeleton();}},
      onCleanup:()=>{
        if(!current())return;clearFormSkeleton();S.busy=false;S.shown=false;
        if(ok){S.scope=scope;S.snapshot=APP.adminClose;S.review=APP.adminReview;renderAdminCloseAssignments();}
        else{APP.adminClose=previous;APP.adminReview=review;S.stale=!!previous;if(previous)renderAdminCloseAssignments();notice();}
        controls();
      }
    });
  }
  function reset(){if(typeof ADMIN_CLOSE_FLIGHT!=='undefined'){ADMIN_CLOSE_FLIGHT=null;ADMIN_CLOSE_REQUEST++;}clearFormSkeleton();S.scope='';S.snapshot=null;S.review=null;S.shown=false;S.busy=false;S.stale=false;APP.adminClose=null;APP.adminReview=null;if(typeof DashboardSkeleton!=='undefined')DashboardSkeleton.cancel(root());['admin-close-assignment-list','admin-close-assignment-count','assignment-day-summary-stats','assignment-target-matches'].forEach(id=>$(id)?.replaceChildren());if(typeof resetAssignmentCalendar==='function')resetAssignmentCalendar();}
  globalThis.KJAAssignmentLoading={enabled,run,pending,controls,isPending:()=>enabled()&&S.shown,canWrite:()=>!S.busy&&!S.stale&&!!APP.adminClose?.puede_editar&&S.scope===adminCloseReadScope($('admin-close-date').value||isoLima()),reset};
})();
