/* Reusable, read-only report for the dashboard and the standalone Zoom lobby. */
(function(root){
 const M=root.KJAZoomCameraModel;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(host,db){
  if(!host||!M)return null;
  let meeting=null,data=null,request=0,controller=null,trigger=null,refreshTimer=null,loading=false;
  host.classList.add('zoom-camera-report');
  host.innerHTML='<header class="zoom-camera-report-head"><div><h2 tabindex="-1">Reporte de cámaras</h2><p data-report-topic></p></div><button type="button" data-report-close>Cerrar reporte</button></header>'+
   '<p class="zoom-camera-explainer">Se confirman las cámaras de participantes en la misma sala que el observador. Las personas en otras salas y los tramos sin conexión quedan sin información. Mantén esta pestaña abierta para continuar el seguimiento.</p>'+
   '<div class="zoom-camera-report-tools"><label>Sesión de observación<select data-report-session aria-label="Sesión de observación"></select></label><button type="button" data-report-refresh>Actualizar reporte</button><button type="button" data-report-export disabled>Descargar CSV</button></div>'+
   '<p data-report-status role="status" aria-live="polite"></p><p data-report-coverage></p><div data-report-results></div>'+
   '<p class="zoom-camera-footnote">Horarios en Lima. Los nombres son los elegidos en Zoom; no acreditan identidad ni atención. Cada observador conserva una sesión independiente.</p>';
  const $=selector=>host.querySelector(selector),status=$('[data-report-status]'),results=$('[data-report-results]'),select=$('[data-report-session]'),download=$('[data-report-export]');
  function render(){
   select.replaceChildren();
   for(const session of data.sessions){
    const option=document.createElement('option');option.value=session.id;
    option.textContent=M.date(session.started_at)+' · '+session.id.slice(0,8);select.append(option);
   }
   if(data.session)select.value=data.session.id;
   select.disabled=!data.sessions.length;download.disabled=!data.people.length;
   if(!data.session){status.textContent='Todavía no hay observaciones guardadas. Inicia la reunión desde el portal y mantén el panel conectado.';results.replaceChildren();return;}
   const stale=Date.parse(data.now)-Date.parse(data.session.last_seen_at)>40000;
   status.textContent=(data.session.ended_at?'Observación finalizada.':stale?'Observación interrumpida: vuelve al panel de Zoom y comprueba la conexión del observador.':'Observación en curso. El reporte se actualiza cada 15 segundos.')+' Última señal: '+M.time(data.session.last_seen_at)+'. No incluye períodos anteriores a su inicio.';
   $('[data-report-coverage]').textContent=data.scope==='breakout'?'Estas muestras fueron registradas por la versión anterior, que no confirmaba cámaras al abrir las salas. Los tiempos anteriores no se pueden reconstruir.':data.scope==='unknown'?'Zoom no confirmó la sala del observador. Comprueba su conexión y rol en Control KJA.':data.scope==='local'?'Cobertura parcial: se confirman las cámaras de esta sala. Para observar otra sala, el responsable debe entrar a ella.':'';
   if(!data.people.length){results.innerHTML='<p>No se han observado participantes en esta sesión.</p>';return;}
   results.innerHTML='<div class="zoom-camera-table-scroll" role="region" aria-label="Detalle de cámaras por participante" tabindex="0"><table><caption>Uso de cámara · '+escape(meeting.topic)+'</caption><thead><tr><th scope="col">Participante</th><th scope="col">Estado actual</th><th scope="col">Encendida</th><th scope="col">Apagada</th><th scope="col">Sin información</th><th scope="col">% confirmado</th><th scope="col">Primera observación</th><th scope="col">Última presencia</th></tr></thead><tbody>'+
    data.people.map(p=>'<tr><th scope="row"><strong>'+escape(p.name)+'</strong><small>'+escape(p.id)+'</small></th><td><span class="zoom-camera-state is-'+(['on','off'].includes(p.state)?p.state:'unknown')+'">'+escape(M.labels[p.state]||M.labels.unknown)+'</span></td><td>'+M.duration(p.on_seconds)+'</td><td>'+M.duration(p.off_seconds)+'</td><td>'+M.duration(p.unknown_seconds)+'</td><td>'+(p.percentage==null?'—':Number(p.percentage).toLocaleString('es-PE')+'%')+'</td><td>'+M.time(p.first_seen)+'</td><td>'+M.time(p.last_seen)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  async function load(session=null,silent=false){
   if(!meeting)return;
   const current=++request;controller?.abort();controller=new AbortController();const own=controller;
   let timer;loading=true;host.setAttribute('aria-busy','true');
   if(!silent){download.disabled=true;results.replaceChildren();select.disabled=true;$('[data-report-coverage]').textContent='';status.textContent='Consultando las observaciones guardadas…';}
   try{
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{own.abort();reject(Error('La consulta tardó demasiado. Pulsa Actualizar reporte para reintentar.'));},15000);});
    const response=await Promise.race([db.rpc('dash_zoom_camera_report',{p_id:meeting.id,p_session:session}).abortSignal(own.signal),deadline]);
    if(current!==request)return;
    if(response.error||!response.data?.ok)throw Error(response.error?.code==='PGRST202'?'El reporte está pendiente de activación por Sistemas (migración 118).':response.error?.message||'No se pudo consultar el reporte. Pulsa Actualizar reporte para reintentar.');
    data=response.data;render();
   }catch(error){if(current===request){data=null;status.textContent=error.message;}}
   finally{clearTimeout(timer);if(current===request){loading=false;host.setAttribute('aria-busy','false');select.disabled=!data?.sessions?.length;download.disabled=!data?.people?.length;}}
  }
  function close(){request++;controller?.abort();clearInterval(refreshTimer);refreshTimer=null;loading=false;data=null;meeting=null;results.replaceChildren();select.replaceChildren();$('[data-report-coverage]').textContent='';host.hidden=true;host.setAttribute('aria-busy','false');if(trigger?.isConnected)trigger.focus({preventScroll:true});trigger=null;}
  $('[data-report-close]').onclick=close;
  $('[data-report-refresh]').onclick=()=>void load(select.value||null);
  select.onchange=()=>void load(select.value||null);
  download.onclick=()=>{
   if(!data?.session||!data.people.length)return;
   const url=URL.createObjectURL(new Blob([M.csv(data,meeting.topic)],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download='camaras-zoom-'+data.session.id+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return {open(row){trigger=document.activeElement;meeting=row;host.hidden=false;$('[data-report-topic]').textContent=row.topic;$('h2').focus({preventScroll:true});host.scrollIntoView({block:'nearest',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'});clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(!document.hidden&&!loading&&meeting)void load(select.value||null,true);},15000);return load();},close};
 }
 root.KJAZoomCameraReport={mount};
})(window);
