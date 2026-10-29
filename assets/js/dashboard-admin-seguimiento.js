/* KJA · Seguimiento diario. Piloto independiente; las dos vistas originales se conservan. */
(function(global){
  'use strict';
  const root=document.getElementById('admin-seguimiento-section');
  if(!root)return;
  const $s=id=>document.getElementById('seg-'+id);
  const icons={
    calendar:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 11h16m-8 4 2 2 3-3"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back:'<path d="M19 12H5m5-5-5 5 5 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    expand:'<path d="M14 3h7v7m0-7-9 9M10 21H3v-7m0 7 9-9"/>',
    refresh:'<path d="M20 10a8 8 0 1 0-2 8M20 3v7h-7"/>',
    chart:'<path d="M5 20V10m7 10V4m7 16v-8"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>'
  };
  const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.file)+'</svg>';
  const button=(action,label,kind='',extra='')=>'<button type="button" data-seg="'+action+'" class="seg-button '+kind+'" '+extra+'>'+label+'</button>';
  const pill=(label,tone='neutral')=>'<span class="seg-pill '+tone+'">'+esc(label)+'</span>';
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
  const isDirection=()=>APP.access?.rol==='direccion';
  const sessionKey=()=>[APP.sessionUid,APP.access?.rol,!!APP.access?.acceso_panel].join(':');
  const S={date:'',query:'',area:'',queue:'attention',segment:'',person:null,delivery:null,requirement:'',file:0,note:'',busy:false,loading:false,snapshot:null,generation:0,mediaGeneration:0,owner:'',signed:[],message:'',tone:'',scroll:0};
  const requests=new Map(),signedCache=new Map();
  let currentLoad=null;
  function mount(){
    root.innerHTML='<header class="seg-heading"><div class="seg-brand"><span class="seg-mark">'+icon('calendar')+'</span><div><div class="seg-eyebrow">OPERACIÓN DEL DÍA <span class="seg-pilot">En prueba</span></div><h2 id="seg-title">Seguimiento diario</h2><p id="seg-subtitle">El equipo, sus jornadas y sus entregas.</p></div></div><div class="seg-head-actions"><span id="seg-updated"></span>'+button('export',icon('download'),'seg-icon','id="seg-export" aria-label="Descargar CSV del día completo" title="Descargar CSV del día completo" disabled')+'<details class="seg-options"><summary aria-label="Más opciones">•••</summary><div>'+button('pause','Pausas activas')+'</div></details></div></header>'+
      '<div class="seg-toolbar"><div class="seg-date">'+button('prev','‹','seg-icon','aria-label="Día anterior"')+'<label><span class="sr-only">Fecha de seguimiento</span><input id="seg-date" type="date" min="2020-01-01"></label>'+button('next','›','seg-icon','aria-label="Día siguiente"')+button('today','Hoy')+'</div><label class="seg-search">'+icon('search')+'<span class="sr-only">Buscar persona o área</span><input id="seg-search" type="search" placeholder="Buscar persona o área" autocomplete="off"></label><label class="seg-area"><span class="sr-only">Filtrar por área</span><select id="seg-area"><option value="">Todas las áreas</option></select></label>'+button('clear','Limpiar','seg-clear','id="seg-clear" hidden')+'</div>'+
      '<p id="seg-message" class="seg-notice" role="status" aria-live="polite" hidden></p><div id="seg-summary" class="seg-summary"></div>'+
      '<div id="seg-workspace" class="seg-workspace" aria-busy="false"><div class="seg-empty">Selecciona una fecha para consultar.</div></div>'+
      '<details class="seg-panorama" id="seg-panorama"><summary>'+icon('chart')+'<span>Panorama del día por áreas</span>'+icon('down')+'</summary><div id="seg-areas" class="seg-area-grid"></div></details>';
    S.date=isoLima();$s('date').value=S.date;$s('date').max=isoLima();
  }
  function message(text='',tone=''){
    S.message=text;S.tone=tone;$s('message').hidden=!text;$s('message').textContent=text;$s('message').dataset.tone=tone;
  }
  function own(){return S.owner===sessionKey()&&APP.access?.acceso_panel}
  function current(){return own()&&S.snapshot?.date===S.date}
  function valid(){return current()&&!S.loading&&S.snapshot?.closeOk}
  function operationOpen(){return typeof ADMIN_EVIDENCE!=='undefined'&&ADMIN_EVIDENCE.context?.source==='seguimiento'&&!document.getElementById('admin-evidence-modal').hidden}
  function canLeave(){
    if(S.busy||operationOpen()){toast('Termina o cierra la operación antes de cambiar de vista.',true);return false}
    if(S.note.trim()&&!global.confirm('Tienes una observación sin guardar. ¿Descartarla y continuar?'))return false;
    S.note='';return true;
  }
  async function read(name,date,owner){
    const key=owner+':'+date+':'+name;
    if(requests.has(key))return requests.get(key);
    const promise=(async()=>{
      let timer;
      try{
        return await Promise.race([Promise.resolve().then(()=>db.rpc(name,{p_fecha:date})),new Promise(resolve=>{timer=setTimeout(()=>resolve({error:{message:'timeout'}}),20000)})]);
      }catch(error){return {error}}
      finally{clearTimeout(timer)}
    })();
    requests.set(key,promise);
    try{return await promise}finally{if(requests.get(key)===promise)requests.delete(key)}
  }
  function reviewRows(){return current()?S.snapshot.reviews:[]}
  function personReviews(id){return reviewRows().filter(d=>String(d.colaborador_id)===String(id))}
  function baseRows(){
    if(!current())return [];
    const q=normalize(S.query);
    return S.snapshot.rows.filter(row=>(!S.area||String(row.area_id??'__none')===S.area)&&(!q||normalize(row.colaborador+' '+(row.area||'')).includes(q)));
  }
  function queueMatches(row,queue){
    if(!isDirection()||!S.snapshot.controlOk)return true;
    return adminControlMatchesQueue(row,queue);
  }
  function rows(){
    return baseRows().filter(row=>queueMatches(row,S.queue)&&(!S.segment||adminControlAreaBucket(row)===S.segment))
      .sort((a,b)=>(S.snapshot.controlOk?adminControlPriority(a)-adminControlPriority(b):0)||String(a.colaborador).localeCompare(String(b.colaborador),'es'));
  }
  function selected(){return current()?S.snapshot.rows.find(row=>String(row.colaborador_id)===String(S.person)):null}
  function personRecord(row){return row?.person||{id:row?.colaborador_id,nombre:row?.colaborador,area:row?.area,labora:row?.labora,cierre:row?.cierre||{}}}
  function state(row){
    if(!row.person)return {label:'Detalle no disponible',tone:'neutral'};
    const p=personRecord(row),code=adminCloseResolvedState(p,adminCloseEvidenceProgress(p,personReviews(row.colaborador_id)),S.date);
    return {label:adminCloseStateLabel(code),tone:['completa','regularizada'].includes(code)?'success':['incompleta','sin_entrada'].includes(code)?'danger':['en_curso','lista_para_salir','pendiente'].includes(code)?'warning':'neutral'};
  }
  function pending(row){
    return S.snapshot.controlOk?adminControlPendingItems(row):[];
  }
  function deliveriesFor(row){
    const close=row.cierre||{},map=new Map(),reviews=personReviews(row.colaborador_id);
    const applicable=adminControlTasks(row)||[];
    const types=new Set(applicable.map(item=>item.tipo));
    const assignments=new Set(applicable.filter(item=>item.id!=null).map(item=>String(item.id)));
    const add=(key,title,item)=>{if(key&&!map.has(key))map.set(key,{key,title,item,versions:[]})};
    for(const item of close.requisitos||[])if(types.has(item.tipo))add(adminCloseEvidenceKey(item),item.titulo||({rpe:'RPE',comparticiones:'Facebook',salida:'Salida'}[item.tipo])||'Evidencia',item);
    for(const item of close.asignaciones||[])if(assignments.has(String(item.id)))add(adminCloseEvidenceKey(item,true),item.titulo||'Entregable',item);
    for(const delivery of reviews){
      const key=adminCloseEvidenceKey(delivery);
      add(key,adminReviewTitle(delivery),null);
      map.get(key)?.versions.push(delivery);
    }
    for(const entry of map.values()){
      entry.versions.sort((a,b)=>Number(b.id)-Number(a.id));
      entry.delivery=entry.versions[0]||null;
    }
    return [...map.values()];
  }
  function activeEntry(row){
    const entries=deliveriesFor(row);
    return entries.find(e=>e.key===S.requirement)||entries[0];
  }
  function activeDelivery(){
    const row=selected();if(!row)return null;
    const entry=activeEntry(row);return entry?.versions.find(d=>String(d.id)===String(S.delivery))||entry?.delivery||null;
  }
  async function load({quiet=false,afterSave=false}={}){
    if(!APP.access?.acceso_panel)return false;
    if(!afterSave&&(S.busy||operationOpen()))return false;
    if(!afterSave&&S.note.trim()&&(quiet||!canLeave()))return false;
    const owner=sessionKey(),date=S.date||isoLima(),key=owner+':'+date;
    if(currentLoad?.key===key)return currentLoad.promise;
    const promise=performLoad({quiet,owner,date});
    currentLoad={key,promise};
    try{return await promise}finally{if(currentLoad?.promise===promise)currentLoad=null}
  }
  async function performLoad({quiet,owner,date}){
    const generation=++S.generation;
    if(S.owner!==owner){S.snapshot=null;S.person=null;S.delivery=null;S.note='';signedCache.clear();S.signed=[]}
    S.owner=owner;S.loading=true;S.mediaGeneration++;S.signed=[];
    message();render();
    const dir=isDirection();
    const names=dir?['dash_admin_cierres','dash_admin_control_diario','dash_supervision_impedimentos','dash_admin_revision_entregas']:['dash_admin_cierres'];
    const responses=await Promise.all(names.map(name=>read(name,date,owner)));
    if(generation!==S.generation||sessionKey()!==owner||!APP.access?.acceso_panel)return false;
    const ok=index=>!!responses[index]?.data?.ok&&!responses[index]?.error;
    const close=ok(0)?responses[0].data:null,control=ok(1)?responses[1].data:null,issues=ok(2)?responses[2].data:null,review=ok(3)?responses[3].data:null;
    const datesMatch=responses.every(response=>!response?.data?.ok||!response.data.fecha||response.data.fecha===date);
    if(!datesMatch){S.loading=false;S.snapshot=null;message('La respuesta no corresponde a esta fecha. Vuelve a actualizar.','error');render();return false}
    const assignments=new Set((close?.asignaciones||[]).map(a=>String(a.id)));
    const reviews=(review?.entregas||[]).filter(d=>(!d.fecha||d.fecha===date)&&(d.requisito!=='asignado'||assignments.has(String(d.asignacion_id))));
    const byClose=new Map((close?.personas||[]).map(p=>[String(p.id),p]));
    const byIssue=new Map();
    for(const issue of issues?.impedimentos||[]){const id=String(issue.colaborador_id);if(!byIssue.has(id))byIssue.set(id,[]);byIssue.get(id).push(issue)}
    const combined=new Map((control?.filas||[]).map(row=>{
      const id=String(row.colaborador_id),person=byClose.get(id),cierre=person?.cierre||null;
      return [id,{...row,person,cierre,cierre_estado:cierre?.estado||row.cierre_estado,impedimentos:byIssue.get(id)||[],impedimentos_disponibles:!!issues}];
    }));
    for(const [id,p] of byClose)if(!combined.has(id)){
      const rs=reviews.filter(d=>String(d.colaborador_id)===id);
      combined.set(id,{colaborador_id:p.id,colaborador:p.nombre,area_id:p.area_id,area:p.area,labora:p.labora,person:p,cierre:p.cierre,cierre_estado:p.cierre?.estado,entrada_at:p.cierre?.entrada_at,salida_at:p.cierre?.salida_at,revision_pendiente:rs.filter(d=>d.revision_estado==='pendiente'&&d.estado==='completo').length,revision_observada:rs.filter(d=>d.revision_estado==='observada').length,impedimentos:byIssue.get(id)||[]});
    }
    S.snapshot={date,rows:[...combined.values()],exportIds:new Set((control?.filas||[]).map(r=>String(r.colaborador_id))),reviews,closeOk:!!close,controlOk:!!control,issueOk:!!issues,reviewOk:!!review,canReview:review?.puede_revisar===true,partial:dir?!(close&&control&&issues&&review):!close};
    S.loading=false;
    const warnings=[];
    if(!close)warnings.push('No se pudieron consultar los cierres y requisitos.');
    if(dir&&!control)warnings.push('Control diario no está disponible.');
    if(dir&&!issues)warnings.push('No se pudieron comprobar los impedimentos.');
    if(dir&&!review)warnings.push('Las revisiones no están disponibles.');
    if(warnings.length)message('Vista parcial. '+warnings.join(' ')+' Actualiza para comprobar el día completo.','error');
    $s('updated').textContent='Actualizado '+new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}).format(new Date());
    fillAreas();render();
    void hydratePhotos(S.snapshot,generation,owner);
    if(S.person&&selected())await renderDetail();
    return !!close;
  }
  function avatarContent(row){
    return esc(initials(row.colaborador))+(row.foto_url?'<img data-profile-photo src="'+esc(row.foto_url)+'" alt="" loading="lazy" decoding="async">':'');
  }
  async function hydratePhotos(snapshot,generation,owner){
    if(typeof hydrateProfilePhotos!=='function'||!snapshot.rows.length)return;
    try{
      const people=await hydrateProfilePhotos(snapshot.rows.map(row=>({...row.person,id:row.colaborador_id})));
      if(S.snapshot!==snapshot||S.generation!==generation||sessionKey()!==owner||!current())return;
      const urls=new Map(people.map(person=>[String(person.id),person.foto_url||'']));
      snapshot.rows.forEach(row=>{row.foto_url=urls.get(String(row.colaborador_id))||''});
      // Actualizar solo avatares: conservar la nota, el foco y el archivo en revisión.
      root.querySelectorAll('.seg-person[data-person]').forEach(element=>{
        const row=snapshot.rows.find(row=>String(row.colaborador_id)===element.dataset.person);
        const avatar=element.querySelector('.seg-avatar');
        if(row&&avatar)avatar.innerHTML=avatarContent(row);
      });
    }catch{
      // Una foto ausente o sin permiso conserva las iniciales y no bloquea la consulta.
    }
  }
  function fillAreas(){
    const areas=new Map();for(const row of S.snapshot?.rows||[])areas.set(String(row.area_id??'__none'),row.area||'Sin área');
    $s('area').innerHTML='<option value="">Todas las áreas</option>'+[...areas].sort((a,b)=>a[1].localeCompare(b[1],'es')).map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
    if(S.area&&!areas.has(S.area))S.area='';$s('area').value=S.area;
  }
  function render(){
    const has=current(),data=has?S.snapshot:null,base=baseRows();
    root.dataset.review=String(!!S.person);
    $s('workspace').setAttribute('aria-busy',String(S.loading));
    $s('export').hidden=!isDirection();
    $s('export').disabled=!data||data.partial||S.loading||!data.exportIds.size;
    $s('clear').hidden=!(S.query||S.area||S.segment);
    $s('date').disabled=S.busy;$s('date').max=isoLima();
    root.querySelector('[data-seg="next"]').disabled=S.date>=isoLima()||S.busy;
    root.querySelector('[data-seg="prev"]').disabled=S.date<='2020-01-01'||S.busy;
    const dateText=new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'long',timeZone:'America/Lima'}).format(new Date(S.date+'T12:00:00-05:00'));
    $s('subtitle').textContent=dateText+(data?' · '+base.length+' personas'+(S.area||S.query?' en esta consulta':' en el equipo'):'');
    if(!has||(!data.rows.length&&S.loading)){
      $s('summary').innerHTML=Array.from({length:4},()=>'<div class="seg-skeleton" aria-hidden="true"></div>').join('');
      $s('workspace').innerHTML='<div class="seg-empty">'+icon(S.loading?'refresh':'calendar')+'<h3>'+(S.loading?'Consultando el día…':'Información no disponible')+'</h3><p>'+(S.loading?'Entradas, entregas y jornadas.':'Actualiza para volver a consultar esta fecha.')+'</p>'+(!S.loading?button('reload',icon('refresh')+' Reintentar'):'')+'</div>';
      $s('areas').innerHTML='';return;
    }
    const group=new Set(base.map(row=>String(row.colaborador_id))),evidences=reviewRows().filter(d=>group.has(String(d.colaborador_id)));
    const metrics=[['Por revisar',evidences.filter(d=>d.revision_estado==='pendiente'&&d.estado==='completo').length,'pending'],['Aprobadas',evidences.filter(d=>d.revision_estado==='aprobada').length,'success'],['Con corrección',evidences.filter(d=>d.revision_estado==='observada').length,'danger']];
    const queues=[['attention','Por atender'],['review','Por revisar'],['done','Concluidas'],['all','Todo el equipo']];
    $s('summary').innerHTML='<section class="seg-people-metrics"><h3>Personas</h3><div class="seg-queues" role="group" aria-label="Bandejas de personas">'+(data.controlOk?queues:[['all','Todo el equipo']]).map(([key,label])=>button('queue',esc(label)+'<b>'+(data.controlOk?base.filter(r=>queueMatches(r,key)).length:base.length)+'</b>',S.queue===key||!data.controlOk?'is-active':'','data-queue="'+key+'" aria-pressed="'+String(S.queue===key||!data.controlOk)+'"')).join('')+'</div></section>'+
      (isDirection()?'<section class="seg-evidence-metrics"><h3>Evidencias <small>'+((S.query||S.area)?'de esta consulta':'del día')+'</small></h3><div>'+metrics.map(([label,num,tone])=>'<span><i class="seg-dot '+tone+'"></i>'+label+'<b>'+(data.reviewOk?num:'—')+'</b></span>').join('')+'</div></section>':'')+
      '<section class="seg-hours"><span>'+icon('clock')+'Horas válidas</span><strong>'+(data.controlOk?base.reduce((sum,r)=>sum+Number(r.horas_validas||0),0).toLocaleString('es-PE',{maximumFractionDigits:1})+'<small> h</small>':'—')+'</strong><small>'+(data.controlOk?base.filter(adminControlWork).length+' jornadas programadas':'Resumen de Control no disponible')+'</small></section>';
    if(!S.person)renderList();else if(!selected())$s('workspace').innerHTML='<div class="seg-empty"><h3>El caso ya no está disponible en esta fecha</h3>'+button('back','Volver al listado')+'</div>';
    renderAreas();
  }
  function rowHTML(row,compact=false){
    const id=String(row.colaborador_id),status=state(row),items=pending(row),reviews=personReviews(id);
    const count=Number(row.revision_pendiente||0),issues=row.impedimentos||[];
    const details=[...(count?[count+' por revisar']:[]),...items,...(Number(row.revision_observada)?[row.revision_observada+' con corrección']:[]),...(issues.length?['Impedimento informado']:[])];
    const canOpen=dataClosePerson(row);
    return '<article class="seg-person '+(String(S.person)===id?'is-selected':'')+'" data-person="'+esc(id)+'"><span class="seg-avatar" aria-hidden="true">'+avatarContent(row)+'</span><div class="seg-person-name"><b>'+esc(row.colaborador)+'</b><small>'+esc(row.area||'Sin área')+'</small>'+(compact?'<span class="seg-person-pending">'+(count?count+' por revisar':esc(details.join(' · ')||'Sin pendientes identificados'))+'</span>':'')+'</div><div class="seg-person-state">'+pill(status.label,status.tone)+(compact?'':'<small>'+esc(details.join(' · ')||'Sin pendientes identificados')+'</small>')+'</div>'+(!compact?'<div class="seg-times"><span><small>Entrada</small><b>'+esc(adminControlTime(row.entrada_at))+'</b></span><span><small>Salida</small><b>'+esc(adminControlTime(row.salida_at))+'</b></span></div>':'')+button('person',compact?icon('arrow'):(count?'Revisar':'Ver caso')+icon('arrow'),compact?'seg-icon':'seg-row-action','data-person="'+esc(id)+'" aria-label="Abrir caso de '+esc(row.colaborador)+'" '+(!canOpen?'disabled':''))+'</article>';
  }
  function dataClosePerson(row){return !!row.person&&S.snapshot.closeOk}
  function renderList(){
    const list=rows();
    $s('workspace').innerHTML='<div class="seg-list-heading"><div><span class="seg-eyebrow">EL EQUIPO, DE UN VISTAZO</span><h3>'+({attention:'Por atender',review:'Personas por revisar',done:'Jornadas concluidas',all:'Todo el equipo'}[S.snapshot.controlOk?S.queue:'all'])+' <span>'+list.length+'</span></h3></div><span>'+list.length+' de '+baseRows().length+' personas</span></div>'+
      (list.length?'<div class="seg-table-labels"><span>Colaborador / área</span><span>Jornada y pendientes</span><span>Entrada / salida</span><span>Acción</span></div><div class="seg-person-list">'+list.map(r=>rowHTML(r)).join('')+'</div>':'<div class="seg-empty">'+icon('check')+'<h3>No hay personas en esta consulta</h3><p>Consulta todo el equipo o cambia la búsqueda y el área.</p>'+button('all','Ver todo el equipo')+'</div>');
  }
  function renderAreas(){
    if(!S.snapshot.controlOk||S.snapshot.partial){$s('areas').innerHTML='<p>El panorama requiere los datos completos del día.</p>';return}
    const groups=new Map();
    for(const row of S.snapshot.rows){const id=String(row.area_id??'__none');if(!groups.has(id))groups.set(id,{name:row.area||'Sin área',rows:[]});groups.get(id).rows.push(row)}
    $s('areas').innerHTML=[...groups].map(([id,g])=>{
      const done=g.rows.filter(r=>['completa','justificado'].includes(adminControlState(r).key)).length;
      return '<article class="seg-area-card">'+button('area','<b>'+esc(g.name)+'</b><span>'+done+' de '+g.rows.length+' concluidas</span>','','data-area="'+esc(id)+'" aria-pressed="'+String(S.area===id)+'"')+'<div class="seg-area-track" aria-hidden="true"><i style="width:'+Math.round(done/g.rows.length*100)+'%"></i></div><div class="seg-segments">'+[['pending','Pendientes'],['review','Por revisar'],['done','Concluidas'],['clear','Sin pendientes']].map(([key,label])=>button('segment',label+' <b>'+g.rows.filter(r=>adminControlAreaBucket(r)===key).length+'</b>',S.area===id&&S.segment===key?'is-active':'','data-area="'+esc(id)+'" data-segment="'+key+'" aria-pressed="'+String(S.area===id&&S.segment===key)+'"')).join('')+'</div></article>';
    }).join('');
  }
  function entryState(entry){
    const d=entry.delivery;
    return d?{label:adminReviewStateLabel(d),tone:d.revision_estado==='aprobada'?'success':d.revision_estado==='observada'?'danger':'pending'}:{label:entry.item?.completo?'Registrada':'Sin entregar',tone:entry.item?.completo?'neutral':'pending'};
  }
  async function openPerson(id){
    if(!canLeave())return;
    const row=S.snapshot.rows.find(r=>String(r.colaborador_id)===String(id));if(!row?.person)return;
    S.scroll=root.scrollTop;S.person=String(id);S.delivery=null;S.requirement='';S.file=0;
    const entries=deliveriesFor(row),first=entries.find(e=>e.delivery?.revision_estado==='pendiente'&&e.delivery?.estado==='completo')||entries[0];
    if(first){S.requirement=first.key;S.delivery=first.delivery?.id||null}
    root.scrollTop=0;render();await renderDetail();$s('case-title')?.focus({preventScroll:true});
  }
  async function renderDetail(){
    const row=selected();if(!row)return;
    const entry=activeEntry(row),d=activeDelivery(),entries=deliveriesFor(row),person=personRecord(row),c=row.cierre||{},status=state(row);
    if(entry){S.requirement=entry.key;S.delivery=d?.id||null}
    const canDecide=valid()&&!S.snapshot.partial&&isDirection()&&S.snapshot.canReview&&String(entry?.delivery?.id)===String(d?.id)&&d?.estado==='completo'&&d?.revision_estado==='pendiente';
    const closed=!!d?.jornada_cerrada;
    const list=rows();
    $s('workspace').innerHTML='<div class="seg-review-layout"><aside class="seg-case-nav"><header><h3>Personas <span>'+list.length+'</span></h3>'+button('back',icon('back')+' Listado','seg-text')+'</header><div class="seg-mini-list">'+list.map(r=>rowHTML(r,true)).join('')+'</div></aside>'+
      '<section class="seg-viewer"><header class="seg-case-heading"><div><span class="seg-eyebrow">'+esc(row.area||'Sin área')+'</span><h3 id="seg-case-title" tabindex="-1">'+esc(row.colaborador)+'</h3></div>'+button('back',icon('back')+' Volver al listado','seg-text')+'</header>'+
      '<div class="seg-tabs" role="tablist" aria-label="Requisitos y entregables">'+entries.map(e=>{const st=entryState(e);return '<button type="button" role="tab" data-seg="tab" data-key="'+esc(e.key)+'" tabindex="'+(e.key===entry?.key?0:-1)+'" aria-selected="'+String(e.key===entry?.key)+'" aria-controls="seg-gallery"><b>'+esc(e.title)+'</b><small class="'+st.tone+'">'+esc(st.label)+'</small></button>'}).join('')+'</div>'+
      '<div class="seg-file-heading">'+icon('file')+'<span>'+esc(d?adminReviewTitle(d):entry?.title||'Requisitos de la fecha')+'</span>'+(entry?pill(entryState(entry).label,entryState(entry).tone):'')+'</div><div class="seg-gallery" id="seg-gallery" role="tabpanel" aria-label="Archivo de evidencia"></div><div id="seg-file-controls" class="seg-file-controls"></div>'+
      (entry?.versions.length>1?'<details class="seg-versions"><summary>Versiones y entregas anteriores</summary>'+entry.versions.map(v=>button('version',esc(adminReviewTitle(v))+' · '+esc(adminReviewStateLabel(v))+' · '+esc(adminReviewTime(v.completado_at)),'','data-delivery="'+esc(v.id)+'"')).join('')+'</details>':'')+'</section>'+
      '<aside class="seg-decision"><header><span class="seg-eyebrow">DETALLE DEL CASO</span><h3>Revisión de evidencia</h3></header><div class="seg-state-pair"><div><small>Jornada</small>'+pill(status.label,status.tone)+'</div><div><small>Evidencia</small>'+pill(d?adminReviewStateLabel(d):entry?'Sin entregar':'Sin requisitos',entry?entryState(entry).tone:'neutral')+'</div></div>'+
      '<dl class="seg-facts"><div><dt>Entrada</dt><dd>'+esc(adminControlTime(row.entrada_at))+'</dd></div><div><dt>Salida</dt><dd>'+esc(adminControlTime(row.salida_at))+'</dd></div><div><dt>Horas válidas</dt><dd>'+(row.horas_validas==null?'—':Number(row.horas_validas).toLocaleString('es-PE',{maximumFractionDigits:2})+' h')+'</dd></div><div><dt>Modalidad</dt><dd>'+esc(adminCloseMode(c).label)+'</dd></div><div class="seg-fact-wide"><dt>Horario</dt><dd>'+esc(adminCloseSchedule(person)||'Sin horario disponible')+'</dd></div></dl>'+
      '<div class="seg-comment"><h4>Comentario del colaborador</h4><p>'+esc(d?.detalle||'Sin comentario adicional.')+'</p></div>'+
      (d?.cargada_por_direccion?'<p class="seg-origin">Cargada por '+esc(d.cargada_por||'Dirección')+' en nombre del colaborador'+(d.salida_reportada_at?' · hora reportada '+esc(adminReviewTime(d.salida_reportada_at)):'')+'.</p>':'')+
      '<details class="seg-history"><summary>'+icon('clock')+'Última revisión'+icon('down')+'</summary><p>'+esc(d?.revision_estado==='observada'?d.revision_nota||'Corrección solicitada.':d?.revision_estado==='aprobada'?'Aprobada'+(d.revisor?' por '+d.revisor:'')+'. '+(d.revision_nota||''):'Sin revisión registrada.')+'</p></details>'+
      (canDecide?'<label class="seg-note-label" for="seg-note">Observación <span>(obligatoria al corregir)</span></label><textarea id="seg-note" rows="3" maxlength="700" placeholder="Escribe tu observación…" '+(S.busy?'disabled':'')+'>'+esc(S.note)+'</textarea><div class="seg-decision-buttons">'+button('observe','Solicitar corrección','seg-outline',(closed&&d.requisito!=='comparticiones'||S.busy?'disabled':'') )+button('approve',icon('check')+' Aprobar evidencia','seg-primary',S.busy?'disabled':'')+'</div>':'')+
      (closed&&canDecide&&d.requisito!=='comparticiones'?'<p class="seg-operational">Jornada cerrada: puedes aprobar; la evidencia ya no puede reemplazarse.</p>':'')+
      '<p id="seg-action-status" class="seg-action-status" role="status" aria-live="polite"></p>'+
      button('next-evidence','Siguiente evidencia pendiente '+icon('arrow'),'seg-next',nextDelivery()?'':'disabled')+
      (isDirection()?'<details class="seg-manage"><summary>Gestionar caso '+icon('down')+'</summary><div>'+(!S.snapshot.partial&&adminEvidenceAvailable(person,personReviews(row.colaborador_id)).length?button('upload',adminEvidenceAvailable(person,personReviews(row.colaborador_id)).every(i=>i.optional)?'Adjuntar salida':'Subir faltante'):'')+(!S.snapshot.partial&&adminCloseExitRecovery(person,personReviews(row.colaborador_id))?button('recover','Recuperar salida'):'')+button('message','Enviar mensaje')+'</div></details>':'')+
      ((row.impedimentos||[]).length?'<details class="seg-issues"><summary>Impedimentos informados · '+row.impedimentos.length+'</summary>'+row.impedimentos.map(i=>'<p>'+esc(i.detalle||'Sin detalle')+'</p>').join('')+'</details>':'')+'</aside></div>';
    S.signed=[];await renderMedia();
  }
  function nextDelivery(){
    const row=selected();if(!row)return null;
    return personReviews(row.colaborador_id).find(d=>String(d.id)!==String(S.delivery)&&d.revision_estado==='pendiente'&&d.estado==='completo');
  }
  async function renderMedia(){
    const gallery=$s('gallery');if(!gallery)return;
    const d=activeDelivery(),token=++S.mediaGeneration,owner=S.owner,generation=S.generation;
    if(!d){gallery.innerHTML='<div class="seg-empty">'+icon('file')+'<h4>Sin archivo entregado</h4><p>Este requisito todavía no tiene una entrega disponible.</p></div>';$s('file-controls').innerHTML='';return}
    gallery.innerHTML='<div class="seg-empty seg-media-loading">'+icon('file')+'<p>Preparando el archivo privado…</p></div>';
    const files=d.archivos||[];
    try{
      const signed=await Promise.all(files.map(async file=>{
        const key=owner+':'+d.id+':'+file.path,cached=signedCache.get(key);
        if(cached?.expires>Date.now())return cached.file;
        const {data,error}=await db.storage.from('asis-cierre-evidencias').createSignedUrl(file.path,900);
        if(error||!data?.signedUrl)throw new Error('signed');
        const result={...file,url:data.signedUrl};
        if(sessionKey()===owner)signedCache.set(key,{file:result,expires:Date.now()+14*60000});
        return result;
      }));
      if(token!==S.mediaGeneration||generation!==S.generation||owner!==sessionKey())return;
      S.signed=signed;S.file=Math.min(S.file,Math.max(0,signed.length-1));paintFile();
    }catch{
      if(token!==S.mediaGeneration||owner!==sessionKey())return;
      gallery.innerHTML='<div class="seg-empty"><h4>No se pudo abrir el archivo privado</h4><p>El permiso pudo vencer o la conexión no está disponible.</p>'+button('media-retry','Renovar acceso')+'</div>';$s('file-controls').innerHTML='';
    }
  }
  function paintFile(){
    const file=S.signed[S.file],gallery=$s('gallery'),controls=$s('file-controls');if(!gallery)return;
    if(!file){gallery.innerHTML='<div class="seg-empty">'+icon('file')+'<p>Esta entrega no contiene archivos disponibles.</p></div>';controls.innerHTML='';return}
    const mime=String(file.mime||''),isVideo=mime.startsWith('video/'),isDoc=mime.startsWith('application/')||/\.(pdf|docx?|pptx?)$/i.test(file.path||'');
    gallery.innerHTML=isVideo?'<video controls playsinline preload="metadata" src="'+esc(file.url)+'" aria-label="Video de evidencia"></video>':isDoc?'<div class="seg-document">'+icon('file')+'<h4>Documento adjunto</h4><p>'+esc((file.path||'').split('/').pop())+'</p><a class="seg-button" href="'+esc(file.url)+'" target="_blank" rel="noopener">Abrir documento '+icon('expand')+'</a></div>':'<img src="'+esc(file.url)+'" alt="Evidencia '+(S.file+1)+' de '+S.signed.length+' de '+esc(selected()?.colaborador)+'">';
    const media=gallery.querySelector('img,video');
    if(media)media.onerror=()=>{gallery.innerHTML='<div class="seg-empty"><p>No se pudo cargar el archivo.</p>'+button('media-retry','Renovar acceso')+'</div>'};
    controls.innerHTML=button('file-prev','‹','seg-icon','aria-label="Archivo anterior" '+(!S.file?'disabled':''))+'<div class="seg-thumbnails">'+S.signed.map((f,index)=>button('file',((String(f.mime||'').startsWith('image/')||/\\.(jpe?g|png|webp)$/i.test(f.path||''))?'<img src="'+esc(f.url)+'" alt="" loading="lazy">':icon('file'))+'<small>'+(index+1)+'</small>','seg-thumb '+(index===S.file?'is-active':''),'data-index="'+index+'" aria-label="Ver archivo '+(index+1)+'" aria-pressed="'+String(index===S.file)+'"')).join('')+'</div>'+button('file-next','›','seg-icon','aria-label="Archivo siguiente" '+(S.file===S.signed.length-1?'disabled':''))+'<div class="seg-file-index"><span>Archivo '+(S.file+1)+' de '+S.signed.length+'</span><a href="'+esc(file.url)+'" target="_blank" rel="noopener" class="seg-button">'+icon('expand')+' Ampliar archivo</a></div>';
  }
  async function decide(value){
    const d=activeDelivery(),person=selected(),owner=sessionKey();
    if(!valid()||S.snapshot.partial||S.busy||!isDirection()||!S.snapshot.canReview||!d||d.estado!=='completo'||d.revision_estado!=='pendiente')return;
    const entry=activeEntry(person);if(String(entry?.delivery?.id)!==String(d.id))return;
    const note=S.note.trim();
    if(value==='observada'&&(d.jornada_cerrada&&d.requisito!=='comparticiones'||note.length<3)){
      $s('action-status').textContent=note.length<3?'Explica qué debe corregir (al menos 3 caracteres).':'La jornada ya está cerrada.';$s('note')?.focus();return;
    }
    S.busy=true;root.querySelectorAll('[data-seg="approve"],[data-seg="observe"]').forEach(b=>b.disabled=true);
    $s('action-status').textContent=value==='aprobada'?'Guardando aprobación…':'Enviando corrección…';
    let saved=false,already=false;
    try{
      const {data,error}=await db.rpc('dash_admin_revisar_entrega',{p_entrega:Number(d.id),p_estado:value,p_nota:note||null});
      if(owner!==sessionKey())return;
      already=!error&&data?.motivo==='ya_revisada';
      if(error||(!data?.ok&&!already))throw new Error(data?.motivo||'network');
      saved=!!data?.ok;S.note='';S.busy=false;
      const refreshed=await load({quiet:true,afterSave:true});
      if(owner!==sessionKey())return;
      message(already?'La entrega ya estaba revisada. Se actualizó su estado.':(value==='aprobada'?'Evidencia aprobada.':'Corrección solicitada.')+(refreshed?'':' El guardado se confirmó; no se pudo actualizar el resumen.'),refreshed?'success':'error');
    }catch(error){
      if(owner!==sessionKey())return;
      const reasons={sin_permiso:'Tu cuenta no tiene permiso para revisar.',jornada_cerrada:'La jornada ya está cerrada. Actualiza el caso.',nota:'Revisa la observación antes de enviarla.'};
      $s('action-status').textContent=reasons[error.message]||'No se pudo confirmar el guardado. Actualiza el caso antes de reintentar.';
      S.snapshot.partial=true;
    }finally{
      S.busy=false;
      if(!saved&&!already&&own()){root.querySelectorAll('[data-seg="approve"],[data-seg="observe"]').forEach(b=>b.disabled=true);$s('export').disabled=true}
    }
  }
  function exportDay(){
    if(!current()||S.loading||S.snapshot.partial||!isDirection())return;
    const daily=S.snapshot.rows.filter(r=>S.snapshot.exportIds.has(String(r.colaborador_id)));
    if(!daily.length)return toast('No hay registros del día para exportar.',true);
    const header=['Fecha','Colaborador','Área','Programado','Entrada','Estado entrada','Evidencias pendientes','Impedimento informado','Detalle del impedimento','Por revisar','Observadas','Salida','Horas válidas','Estado jornada','Siguiente paso'];
    const csv=[header,...daily.map(r=>[S.date,r.colaborador,r.area,r.labora?'Sí':'No',adminControlTime(r.entrada_at),r.entrada_estado||'',adminControlPending(r),r.impedimentos.length?'Sí':'No',r.impedimentos.map(i=>i.detalle).join(' | '),r.revision_pendiente||0,r.revision_observada||0,adminControlTime(r.salida_at),Number(r.horas_validas||0).toFixed(2),adminControlState(r).label,adminControlNextStep(r).title])];
    const quote=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
    const blob=new Blob(['\ufeff'+csv.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='control-diario-'+S.date+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    toast('CSV del día completo preparado · '+daily.length+' personas.');
  }
  function context(){
    const row=selected(),owner=S.owner,date=S.date;
    return {source:'seguimiento',date,person:personRecord(row),reviews:personReviews(row.colaborador_id),isCurrent:()=>owner===sessionKey(),refresh:()=>load({quiet:true,afterSave:true})};
  }
  async function handle(event){
    const b=event.target.closest('[data-seg]');if(!b||b.disabled)return;
    if(S.owner&&!own()){reset();render();return}
    const action=b.dataset.seg;
    if(action==='export')return exportDay();
    if(action==='person')return openPerson(b.dataset.person);
    if(action==='reload')return load();
    if(action==='approve'||action==='observe')return decide(action==='approve'?'aprobada':'observada');
    if(action==='pause'){global.KJA_PAUSAS?.openAdmin();return}
    if(action==='file-prev'||action==='file-next'){S.file+=action==='file-prev'?-1:1;return paintFile()}
    if(action==='file'){S.file=Number(b.dataset.index);return paintFile()}
    if(action==='media-retry'){signedCache.clear();return renderMedia()}
    if(!canLeave())return;
    if(action==='back'){const previous=S.person;S.person=null;S.delivery=null;S.signed=[];S.mediaGeneration++;render();root.scrollTop=S.scroll;[...root.querySelectorAll('[data-seg="person"]')].find(el=>el.dataset.person===String(previous))?.focus({preventScroll:true});return}
    if(action==='tab'){S.requirement=b.dataset.key;S.delivery=null;S.file=0;return renderDetail()}
    if(action==='version'){S.delivery=Number(b.dataset.delivery);S.file=0;return renderDetail()}
    if(action==='next-evidence'){
      const d=nextDelivery();if(d){S.requirement=adminCloseEvidenceKey(d);S.delivery=d.id;S.file=0;return renderDetail()}return;
    }
    if(action==='upload'){if(valid()&&!S.snapshot.partial)openAdminMissingEvidence(S.person,b,context());return}
    if(action==='recover'){
      if(!valid()||S.snapshot.partial)return;
      const ctx=context();S.busy=true;
      try{await recoverAdminCloseExit(S.person,b,ctx)}finally{S.busy=false}
      return;
    }
    if(action==='message')return openAdminMessage(S.person,b);
    if(action==='queue'){S.queue=b.dataset.queue;S.segment='';S.person=null;S.mediaGeneration++;render();return}
    if(action==='clear'||action==='all'){S.query='';S.area='';S.segment='';$s('search').value='';$s('area').value='';if(action==='all')S.queue='all';S.person=null;render();return}
    if(action==='area'||action==='segment'){S.area=b.dataset.area;S.segment=action==='segment'?b.dataset.segment:'';S.queue='all';S.person=null;$s('area').value=S.area;render();return}
    if(['prev','next','today'].includes(action)){
      const date=action==='today'?isoLima():addIsoDays(S.date,action==='prev'?-1:1);
      if(date<'2020-01-01'||date>isoLima())return;
      S.date=date;$s('date').value=date;S.person=null;S.snapshot=null;return load();
    }
  }
  mount();
  root.addEventListener('click',event=>{void handle(event).catch(()=>message('No se pudo completar la acción. Actualiza e inténtalo nuevamente.','error'))});
  $s('search').addEventListener('input',()=>{
    if((S.person||S.busy)&&!canLeave()){$s('search').value=S.query;return}
    S.query=$s('search').value;S.person=null;S.segment='';S.mediaGeneration++;render();
  });
  $s('area').addEventListener('change',()=>{
    if(!canLeave()){$s('area').value=S.area;return}
    S.area=$s('area').value;S.segment='';S.person=null;S.mediaGeneration++;render();
  });
  $s('date').addEventListener('change',()=>{
    const date=$s('date').value;
    if(!date||date<'2020-01-01'||date>isoLima()||!canLeave()){$s('date').value=S.date;return}
    S.date=date;S.person=null;S.snapshot=null;void load();
  });
  root.addEventListener('input',event=>{if(event.target.id==='seg-note')S.note=event.target.value});
  root.addEventListener('keydown',event=>{
    const tab=event.target.closest('[role="tab"]');
    if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const tabs=[...root.querySelectorAll('[role="tab"]')],index=tabs.indexOf(tab);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].click();root.querySelector('[role="tab"][aria-selected="true"]')?.focus();
  });
  global.addEventListener('beforeunload',event=>{if(S.busy||S.note.trim()){event.preventDefault();event.returnValue=''}});
  const timer=setInterval(()=>{
    if(APP.view==='gestion'&&APP.adminSection==='seguimiento'&&!document.hidden&&!S.loading&&!S.busy&&!S.person&&!S.note.trim()&&!operationOpen())void load({quiet:true});
  },60000);
  function reset(){
    S.generation++;S.mediaGeneration++;S.owner='';S.snapshot=null;S.person=null;S.note='';S.signed=[];S.loading=false;
    signedCache.clear();requests.clear();currentLoad=null;
    $s('workspace').innerHTML='';$s('summary').innerHTML='';$s('areas').innerHTML='';$s('export').disabled=true;
  }
  global.KJASeguimiento={load,canLeave,reset};
})(window);
