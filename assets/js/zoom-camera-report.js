/* Reusable, read-only report for the dashboard and the standalone Zoom lobby. */
(function(root){
 const M=root.KJAZoomCameraModel;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(host,db){
  if(!host||!M)return null;
  let meeting=null,data=null,request=0,controller=null,trigger=null,refreshTimer=null,loading=false;
  let searchQuery='',filterValue='all',sortColumn='name',sortDirection='asc';

  host.classList.add('zoom-camera-report');
  host.innerHTML='<header class="zoom-camera-report-head"><div><h2 tabindex="-1">Reporte de cámaras</h2><p data-report-topic></p></div><button type="button" data-report-close>Cerrar reporte</button></header>'+
   '<p class="zoom-camera-explainer">Se confirman las cámaras de participantes en la misma sala que el observador. Las personas en otras salas y los tramos sin conexión quedan sin información. Mantén esta pestaña abierta para continuar el seguimiento.</p>'+
   '<div class="zoom-camera-report-tools"><label>Sesión de observación<select data-report-session aria-label="Sesión de observación"></select></label><button type="button" data-report-refresh>Actualizar reporte</button><button type="button" data-report-export disabled>Descargar CSV</button></div>'+
   '<div class="zoom-camera-report-filter-bar" data-report-filter-bar hidden>'+
    '<div class="zoom-camera-filter-group">'+
     '<div class="zoom-camera-search-box">'+
      '<span class="zoom-camera-field-icon" aria-hidden="true">'+
       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>'+
      '</span>'+
      '<input type="search" data-report-search placeholder="Buscar por nombre o ID…" aria-label="Buscar por nombre o ID">'+
     '</div>'+
     '<div class="zoom-camera-select-box">'+
      '<span class="zoom-camera-field-icon" aria-hidden="true">'+
       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>'+
      '</span>'+
      '<select data-report-filter aria-label="Filtrar por cumplimiento">'+
       '<option value="all">Todos los participantes</option>'+
       '<option value="high">Cumplimiento alto (≥ 75%)</option>'+
       '<option value="low">Cumplimiento bajo (&lt; 50%)</option>'+
       '<option value="on">Cámara encendida actualmente</option>'+
       '<option value="off">Cámara apagada actualmente</option>'+
       '<option value="unknown">Sin información actualmente</option>'+
      '</select>'+
      '<span class="zoom-camera-chevron" aria-hidden="true">'+
       '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'+
      '</span>'+
     '</div>'+
    '</div>'+
    '<div class="zoom-camera-count-badge" data-report-count role="status" aria-live="polite"></div>'+
   '</div>'+
   '<p data-report-status role="status" aria-live="polite"></p><p data-report-coverage></p><div data-report-results></div>'+
   '<p class="zoom-camera-footnote">Horarios en Lima. Los nombres son los elegidos en Zoom; no acreditan identidad ni atención. Cada observador conserva una sesión independiente.</p>';

  const $=selector=>host.querySelector(selector);
  const status=$('[data-report-status]'),results=$('[data-report-results]'),select=$('[data-report-session]'),download=$('[data-report-export]');
  const filterBar=$('[data-report-filter-bar]'),searchInput=$('[data-report-search]'),filterSelect=$('[data-report-filter]'),countDisplay=$('[data-report-count]');

  function getVisiblePeople(){
   if(!data?.people)return [];
   const q=searchQuery.toLowerCase().trim();
   const list=data.people.filter(p=>{
    if(q&&!p.name.toLowerCase().includes(q)&&!p.id.toLowerCase().includes(q))return false;
    if(filterValue==='on')return p.state==='on';
    if(filterValue==='off')return p.state==='off';
    if(filterValue==='unknown')return p.state==='unknown';
    if(filterValue==='high')return p.percentage!=null&&p.percentage>=75;
    if(filterValue==='low')return p.percentage!=null&&p.percentage<50;
    return true;
   });
   list.sort((a,b)=>{
    let diff=0;
    if(sortColumn==='name')diff=a.name.localeCompare(b.name,'es',{sensitivity:'base'})||a.id.localeCompare(b.id);
    else if(sortColumn==='state')diff=(a.state||'').localeCompare(b.state||'');
    else if(sortColumn==='on')diff=(a.on_seconds||0)-(b.on_seconds||0);
    else if(sortColumn==='off')diff=(a.off_seconds||0)-(b.off_seconds||0);
    else if(sortColumn==='unknown')diff=(a.unknown_seconds||0)-(b.unknown_seconds||0);
    else if(sortColumn==='percentage')diff=(a.percentage??-1)-(b.percentage??-1);
    else if(sortColumn==='first_seen')diff=(Date.parse(a.first_seen)||0)-(Date.parse(b.first_seen)||0);
    else if(sortColumn==='last_seen')diff=(Date.parse(a.last_seen)||0)-(Date.parse(b.last_seen)||0);
    return sortDirection==='desc'?-diff:diff;
   });
   return list;
  }

  function pctCell(percentage){
   if(percentage==null)return '<span class="zoom-camera-pct-empty">—</span>';
   const val=Math.min(100,Math.max(0,Number(percentage)));
   const tone=val>=75?'is-high':val<50?'is-low':'is-mid';
   return '<div class="zoom-camera-pct"><span class="zoom-camera-pct-bar" aria-hidden="true"><span class="zoom-camera-pct-fill '+tone+'" style="width:'+val+'%"></span></span><strong>'+val.toLocaleString('es-PE')+'%</strong></div>';
  }

  const sortAria=col=>sortColumn===col?(sortDirection==='asc'?'ascending':'descending'):'none';
  const sortIcon=col=>sortColumn===col?(sortDirection==='asc'?' ↑':' ↓'):' ↕';
  const sortBtn=(col,label)=>'<button type="button" class="zoom-camera-sort-btn" data-sort="'+col+'" aria-label="Ordenar por '+label+'">'+label+'<span class="zoom-camera-sort-icon" aria-hidden="true">'+sortIcon(col)+'</span></button>';

  function renderTable(){
   if(!data?.session||!data.people.length)return;
   const visible=getVisiblePeople();
   if(filterBar)filterBar.hidden=false;
   if(countDisplay){
    const text=(searchQuery.trim()||filterValue!=='all')
     ?'Mostrando '+visible.length+' de '+data.people.length+' participantes'
     :data.people.length+' participante'+(data.people.length===1?'':'s')+' en esta sesión';
    countDisplay.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>'+text+'</span>';
   }
   if(!visible.length){
    results.innerHTML='<div class="zoom-camera-empty-state"><p>Ningún participante coincide con el filtro o búsqueda actual.</p><button type="button" data-report-clear-filter>Restablecer filtros</button></div>';
    return;
   }
   results.innerHTML='<div class="zoom-camera-table-scroll" role="region" aria-label="Detalle de cámaras por participante" tabindex="0"><table><caption>Uso de cámara · '+escape(meeting.topic)+'</caption><thead><tr>'+
    '<th scope="col" aria-sort="'+sortAria('name')+'">'+sortBtn('name','Participante')+'</th>'+
    '<th scope="col" aria-sort="'+sortAria('state')+'">'+sortBtn('state','Estado actual')+'</th>'+
    '<th scope="col" aria-sort="'+sortAria('on')+'">'+sortBtn('on','Encendida')+'</th>'+
    '<th scope="col" aria-sort="'+sortAria('off')+'">'+sortBtn('off','Apagada')+'</th>'+
    '<th scope="col" aria-sort="'+sortAria('unknown')+'">'+sortBtn('unknown','Sin información')+'</th>'+
    '<th scope="col" aria-sort="'+sortAria('percentage')+'">'+sortBtn('percentage','% confirmado')+'</th>'+
    '<th scope="col" aria-sort="'+sortAria('first_seen')+'">'+sortBtn('first_seen','Primera observación')+'</th>'+
    '<th scope="col" aria-sort="'+sortAria('last_seen')+'">'+sortBtn('last_seen','Última presencia')+'</th>'+
    '</tr></thead><tbody>'+
    visible.map(p=>'<tr><th scope="row"><strong>'+escape(p.name)+'</strong><small>'+escape(p.id)+'</small></th><td><span class="zoom-camera-state is-'+(['on','off'].includes(p.state)?p.state:'unknown')+'">'+escape(M.labels[p.state]||M.labels.unknown)+'</span></td><td>'+M.duration(p.on_seconds)+'</td><td>'+M.duration(p.off_seconds)+'</td><td>'+M.duration(p.unknown_seconds)+'</td><td>'+pctCell(p.percentage)+'</td><td>'+M.time(p.first_seen)+'</td><td>'+M.time(p.last_seen)+'</td></tr>').join('')+
    '</tbody></table></div>';
  }

  function render(){
   select.replaceChildren();
   for(const session of data.sessions){
    const option=document.createElement('option');option.value=session.id;
    option.textContent=M.date(session.started_at)+' · '+session.id.slice(0,8);select.append(option);
   }
   if(data.session)select.value=data.session.id;
   select.disabled=!data.sessions.length;download.disabled=!data.people.length;
   if(!data.session){
    if(filterBar)filterBar.hidden=true;
    status.textContent='Todavía no hay observaciones guardadas. Inicia la reunión desde el portal y mantén el panel conectado.';
    results.replaceChildren();
    return;
   }
   const stale=Date.parse(data.now)-Date.parse(data.session.last_seen_at)>40000;
   status.textContent=(data.session.ended_at?'Observación finalizada.':stale?'Observación interrumpida: vuelve al panel de Zoom y comprueba la conexión del observador.':'Observación en curso. El reporte se actualiza cada 15 segundos.')+' Última señal: '+M.time(data.session.last_seen_at)+'. No incluye períodos anteriores a su inicio.';
   $('[data-report-coverage]').textContent=data.scope==='breakout'?'Estas muestras fueron registradas por la versión anterior, que no confirmaba cámaras al abrir las salas. Los tiempos anteriores no se pueden reconstruir.':data.scope==='unknown'?'Zoom no confirmó la sala del observador. Comprueba su conexión y rol en Control KJA.':data.scope==='local'?'Cobertura parcial: se confirman las cámaras de esta sala. Para observar otra sala, el responsable debe entrar a ella.':'';
   if(!data.people.length){
    if(filterBar)filterBar.hidden=true;
    results.innerHTML='<p>No se han observado participantes en esta sesión.</p>';
    return;
   }
   renderTable();
  }

  async function load(session=null,silent=false){
   if(!meeting)return;
   const current=++request;controller?.abort();controller=new AbortController();const own=controller;
   let timer;loading=true;host.setAttribute('aria-busy','true');
   if(!silent){download.disabled=true;results.replaceChildren();select.disabled=true;$('[data-report-coverage]').textContent='';status.textContent='Consultando las observaciones guardadas…';if(filterBar)filterBar.hidden=true;}
   try{
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{own.abort();reject(Error('La consulta tardó demasiado. Pulsa Actualizar reporte para reintentar.'));},15000);});
    const response=await Promise.race([db.rpc('dash_zoom_camera_report',{p_id:meeting.id,p_session:session}).abortSignal(own.signal),deadline]);
    if(current!==request)return;
    if(response.error||!response.data?.ok)throw Error(response.error?.code==='PGRST202'?'El reporte está pendiente de activación por Sistemas (migración 118).':response.error?.message||'No se pudo consultar el reporte. Pulsa Actualizar reporte para reintentar.');
    data=response.data;render();
   }catch(error){if(current===request){data=null;status.textContent=error.message;if(filterBar)filterBar.hidden=true;}}
   finally{clearTimeout(timer);if(current===request){loading=false;host.setAttribute('aria-busy','false');select.disabled=!data?.sessions?.length;download.disabled=!data?.people?.length;}}
  }

  function close(){
   request++;controller?.abort();clearInterval(refreshTimer);refreshTimer=null;loading=false;data=null;meeting=null;
   searchQuery='';filterValue='all';sortColumn='name';sortDirection='asc';
   if(searchInput)searchInput.value='';
   if(filterSelect)filterSelect.value='all';
   if(filterBar)filterBar.hidden=true;
   results.replaceChildren();select.replaceChildren();$('[data-report-coverage]').textContent='';host.hidden=true;host.setAttribute('aria-busy','false');
   if(trigger?.isConnected)trigger.focus({preventScroll:true});
   trigger=null;
  }

  $('[data-report-close]').onclick=close;
  $('[data-report-refresh]').onclick=()=>void load(select.value||null);
  select.onchange=()=>{
   searchQuery='';if(searchInput)searchInput.value='';
   filterValue='all';if(filterSelect)filterSelect.value='all';
   void load(select.value||null);
  };

  if(searchInput)searchInput.oninput=()=>{searchQuery=searchInput.value;renderTable();};
  if(filterSelect)filterSelect.onchange=()=>{filterValue=filterSelect.value;renderTable();};

  results.onclick=event=>{
   const sortBtn=event.target.closest('[data-sort]');
   if(sortBtn){
    const col=sortBtn.getAttribute('data-sort');
    if(sortColumn===col){
     sortDirection=sortDirection==='asc'?'desc':'asc';
    }else{
     sortColumn=col;
     sortDirection=(col==='percentage'||col==='on')?'desc':'asc';
    }
    renderTable();
    return;
   }
   const clearBtn=event.target.closest('[data-report-clear-filter]');
   if(clearBtn){
    searchQuery='';if(searchInput)searchInput.value='';
    filterValue='all';if(filterSelect)filterSelect.value='all';
    renderTable();
   }
  };

  download.onclick=()=>{
   if(!data?.session||!data.people.length)return;
   const url=URL.createObjectURL(new Blob([M.csv(data,meeting.topic)],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download='camaras-zoom-'+data.session.id+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return {
   open(row){
    trigger=document.activeElement;meeting=row;host.hidden=false;$('[data-report-topic]').textContent=row.topic;
    $('h2').focus({preventScroll:true});
    host.scrollIntoView({block:'nearest',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'});
    clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{if(!document.hidden&&!loading&&meeting)void load(select.value||null,true);},15000);
    return load();
   },
   close
  };
 }
 root.KJAZoomCameraReport={mount};
})(window);
