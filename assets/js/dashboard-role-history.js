/* KJA-030 · Historial acotado, filtros sobre todos los eventos recibidos y páginas de seis. */
const ROLE_HISTORY={period:'all',query:'',order:'newest',page:0};
function roleHistoryDate(value){
  if(!value)return '';
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part=type=>parts.find(x=>x.type===type).value;return `${part('year')}-${part('month')}-${part('day')}`;
}
function roleHistoryResults(events,labels,today=isoLima()){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
  const query=normalize(ROLE_HISTORY.query.trim()),days={today:1,week:7,month:30}[ROLE_HISTORY.period];
  let from='';if(days){const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-days+1);from=date.toISOString().slice(0,10);}
  return events.map((event,index)=>({event,index,time:new Date(event.created_at).getTime()})).filter(({event})=>{
    const day=roleHistoryDate(event.created_at);return(!days||day&&day>=from&&day<=today)&&(!query||normalize([event.area,event.actor,event.lider_anterior,event.lider_nuevo,labels[event.accion]||event.accion].join(' ')).includes(query));
  }).sort((a,b)=>{const av=Number.isFinite(a.time)?a.time:(ROLE_HISTORY.order==='newest'?-Infinity:Infinity),bv=Number.isFinite(b.time)?b.time:(ROLE_HISTORY.order==='newest'?-Infinity:Infinity);return(av===bv?0:ROLE_HISTORY.order==='newest'?bv-av:av-bv)||a.index-b.index;}).map(x=>x.event);
}
function renderRoleAuditHistory(events,labels){
  if(!matchMedia('(min-width:901px)').matches)return false;
  const host=document.getElementById('admin-role-audit');if(!host)return false;
  if(!host.querySelector('.rh-workbench')){
    host.innerHTML='<div class="rh-workbench"><div class="rh-toolbar"><div class="rh-periods" role="group" aria-label="Período de cambios"></div><label class="rh-search"><span class="sr-only">Buscar cambios de liderazgo</span><input type="search" placeholder="Buscar área, persona o responsable…" aria-label="Buscar cambios de liderazgo"></label><button type="button" class="rh-order">Más recientes primero</button></div><p class="rh-scope">Se muestran hasta 30 cambios recientes. Los filtros se aplican a los registros disponibles.</p><div class="rh-results" role="status" aria-live="polite"></div><div class="rh-rows"></div><nav class="rh-pagination" aria-label="Páginas de cambios de liderazgo"></nav></div>';
  }
  const periods=[['all','Todos'],['today','Hoy'],['week','7 días'],['month','30 días']],results=roleHistoryResults(events,labels),pages=Math.max(1,Math.ceil(results.length/6));ROLE_HISTORY.page=Math.min(Math.max(0,ROLE_HISTORY.page),pages-1);
  const start=ROLE_HISTORY.page*6,visible=results.slice(start,start+6);
  host.querySelector('.rh-periods').innerHTML=periods.map(([key,label])=>`<button type="button" data-rh-period="${key}" aria-pressed="${ROLE_HISTORY.period===key}">${label}</button>`).join('');
  const search=host.querySelector('input');if(search.value!==ROLE_HISTORY.query)search.value=ROLE_HISTORY.query;
  host.querySelector('.rh-order').textContent=ROLE_HISTORY.order==='newest'?'Más recientes primero ↓':'Más antiguos primero ↑';
  host.querySelector('.rh-results').textContent=results.length?`${start+1}–${start+visible.length} de ${results.length} cambios${results.length!==events.length?` · ${events.length} disponibles`:''}`:`0 coincidencias · ${events.length} cambios disponibles`;
  host.querySelector('.rh-rows').innerHTML=visible.length?visible.map(event=>`<article><i class="${esc(event.accion)}" aria-hidden="true"></i><span><b>${esc(labels[event.accion]||event.accion)}</b><small>${esc(event.area||'Área')} · ${esc(event.actor||'Administrador')}</small></span><span class="admin-role-audit-change">${event.lider_anterior?esc(event.lider_anterior)+' → ':''}${esc(event.lider_nuevo||'Sin líder')}</span><time datetime="${esc(event.created_at||'')}">${roleHistoryDate(event.created_at)?new Date(event.created_at).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}):'Fecha no disponible'}</time></article>`).join(''):`<div class="rh-empty"><b>${events.length?'No hay cambios con estos filtros.':'Todavía no hay cambios de liderazgo.'}</b><p>${events.length?'Prueba otro período o limpia la búsqueda.':'Las próximas asignaciones aparecerán aquí.'}</p>${events.length?'<button type="button" data-rh-reset>Limpiar filtros</button>':''}</div>`;
  const pager=host.querySelector('.rh-pagination');pager.hidden=pages===1;pager.innerHTML=`<button type="button" data-rh-page="${ROLE_HISTORY.page-1}" ${ROLE_HISTORY.page===0?'disabled':''}>Anterior</button><span>Página ${ROLE_HISTORY.page+1} de ${pages}</span><button type="button" data-rh-page="${ROLE_HISTORY.page+1}" ${ROLE_HISTORY.page===pages-1?'disabled':''}>Siguiente</button>`;
  const refresh=()=>renderRoleAuditHistory(APP.adminRoles?.eventos||[],labels);
  search.oninput=()=>{ROLE_HISTORY.query=search.value;ROLE_HISTORY.page=0;refresh();};
  host.onclick=event=>{const period=event.target.closest('[data-rh-period]'),page=event.target.closest('[data-rh-page]');if(period){ROLE_HISTORY.period=period.dataset.rhPeriod;ROLE_HISTORY.page=0;refresh();host.querySelector(`[data-rh-period="${ROLE_HISTORY.period}"]`).focus({preventScroll:true});}else if(page&&!page.disabled){ROLE_HISTORY.page=Number(page.dataset.rhPage);const direction=page.textContent;refresh();([...pager.querySelectorAll('button')].find(x=>x.textContent===direction&&!x.disabled)||pager.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});}else if(event.target.closest('.rh-order')){ROLE_HISTORY.order=ROLE_HISTORY.order==='newest'?'oldest':'newest';ROLE_HISTORY.page=0;refresh();}else if(event.target.closest('[data-rh-reset]')){Object.assign(ROLE_HISTORY,{period:'all',query:'',page:0});refresh();search.focus({preventScroll:true});}};
  return true;
}
(()=>{const media=matchMedia('(min-width:901px)');media.addEventListener('change',()=>{if(typeof renderRoleAudit==='function')renderRoleAudit();});if(typeof APP!=='undefined'&&APP.adminRoles&&typeof renderRoleAudit==='function')renderRoleAudit();})();
