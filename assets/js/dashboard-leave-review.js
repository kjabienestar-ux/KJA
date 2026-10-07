/* Solicitudes agrupadas; la aprobación sigue siendo individual por fecha. */
let ADMIN_LEAVE_REVIEW={key:null,items:[],trigger:null};

function groupAdminLeaveRequests(items){
  const groups=new Map();
  for(const item of items){
    const key=item.tipo==='dia_libre'&&item.solicitud_grupo
      ?`leave:${item.colaborador_id}:${item.solicitud_grupo}`:`request:${item.id}`;
    if(!groups.has(key))groups.set(key,{key,items:[]});
    groups.get(key).items.push(item);
  }
  return [...groups.values()].filter(group=>group.items.some(item=>item.estado==='pendiente'));
}

function renderAdminRequestGroup(group,index){
  const first=group.items[0];
  if(first.tipo!=='dia_libre'||!first.descanso_programado)return adminPersonalRequestMarkup(first);
  const pending=group.items.filter(item=>item.estado==='pendiente').length;
  const dates=group.items.map(item=>formatRequestDate(item.fecha_inicio)).join(' · ');
  return `<button class="leave-request-summary" type="button" data-leave-review="${index}" aria-haspopup="dialog" aria-controls="admin-leave-review"><span class="leave-request-summary-main"><b>${esc(first.nombre||'Colaborador')}</b><span>${group.items.length} ${group.items.length===1?'día libre solicitado':'días libres solicitados'} · ${pending} por revisar</span><small>${esc(dates)}</small></span><span class="leave-request-summary-action">Revisar<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span></button>`;
}

function openAdminLeaveReview(index,trigger){
  if(APP.access.rol!=='direccion')return;
  const group=APP.adminRequestGroups?.[index];if(!group)return;
  ADMIN_LEAVE_REVIEW={key:group.key,items:group.items.map(item=>({...item})),trigger};
  $('admin-leave-review-days').replaceChildren();
  $('admin-leave-review-message').hidden=true;
  renderAdminLeaveReview();$('admin-leave-review').showModal();
}

function renderAdminLeaveReview(){
  const items=ADMIN_LEAVE_REVIEW.items,first=items[0];if(!first)return;
  const host=$('admin-leave-review-days'),active=document.activeElement;
  const drafts=new Map([...host.querySelectorAll('[data-admin-personal-request]')].map(row=>[row.dataset.adminPersonalRequest,{
    values:[...row.querySelectorAll('input')].map(input=>input.value),
    proposalDate:row.querySelector('[data-leave-proposal-date]')?.value||'',
    open:!!row.querySelector('details')?.open
  }]));
  const focusedRow=active?.closest('[data-admin-personal-request]');
  const focusedId=focusedRow?.dataset.adminPersonalRequest;
  const focusedIndex=focusedRow?[...focusedRow.querySelectorAll('button,input,summary')].indexOf(active):-1;
  const focusWasInside=host.contains(active);
  const pending=items.filter(item=>item.estado==='pendiente').length;
  $('admin-leave-review-person').textContent=first.nombre||'Colaborador';
  $('admin-leave-review-copy').textContent=`${items.length} ${items.length===1?'día solicitado':'días solicitados'} · ${pending?`${pending} por revisar`:'Revisión completada'}`;
  const badge=$('admin-leave-review-badge');if(badge)badge.textContent=pending?`${pending} por revisar`:'Revisión completada';
  const commentBox=$('admin-leave-comment-box'),commentText=(first.detalle||'').trim();
  if(commentBox)commentBox.hidden=!commentText;
  $('admin-leave-review-note').textContent=commentText||'Sin comentario';
  const evidence=items.find(item=>item.evidencia_path);
  $('admin-leave-evidence-open').hidden=!evidence;
  $('admin-leave-evidence-open').dataset.path=evidence?.evidencia_path||'';
  $('admin-leave-review-days').innerHTML=[...items].sort((a,b)=>a.fecha_inicio.localeCompare(b.fecha_inicio)).map(item=>adminPersonalRequestMarkup(item,true)).join('');
  host.querySelectorAll('[data-admin-personal-request]').forEach(row=>{
    const draft=drafts.get(row.dataset.adminPersonalRequest);if(!draft)return;
    row.querySelectorAll('input').forEach((input,index)=>input.value=draft.values[index]||'');
    const details=row.querySelector('details');if(details)details.open=draft.open;
    if(draft.proposalDate){
      const hiddenInput=row.querySelector('[data-leave-proposal-date]');
      if(hiddenInput)hiddenInput.value=draft.proposalDate;
      const widget=row.querySelector('.proposal-calendar-widget');
      if(widget&&typeof renderProposalCalendarHtml==='function'){
        widget.dataset.selected=draft.proposalDate;
        const year=Number(widget.dataset.year),month=Number(widget.dataset.month);
        widget.innerHTML=renderProposalCalendarHtml(year,month,draft.proposalDate,widget.dataset.original||'',widget.dataset.min,widget.dataset.max);
      }
      const pill=row.querySelector('[data-proposal-display]');
      if(pill){
        pill.classList.remove('empty');pill.classList.add('active');
        const small=pill.querySelector('small'),b=pill.querySelector('[data-proposal-label]');
        if(small)small.textContent='Fecha propuesta elegida:';
        if(b&&typeof formatRequestDate==='function')b.textContent=formatRequestDate(draft.proposalDate);
      }
    }
  });
  if(focusWasInside){
    const row=[...host.querySelectorAll('[data-admin-personal-request]')].find(row=>row.dataset.adminPersonalRequest===focusedId);
    const control=row?.querySelectorAll('button,input,summary')[focusedIndex];
    (control&&!control.disabled?control:host.querySelector('button:not(:disabled),input:not(:disabled)')||$('admin-leave-review').querySelector('[data-close-leave-review]'))?.focus();
  }
}

function syncAdminLeaveReview(groups){
  if(!$('admin-leave-review')?.open)return;
  const group=groups.find(item=>item.key===ADMIN_LEAVE_REVIEW.key);
  if(group)ADMIN_LEAVE_REVIEW.items=group.items.map(item=>({...item}));
  renderAdminLeaveReview();
}

function updateAdminLeaveDecision(id,approved,response){
  const item=ADMIN_LEAVE_REVIEW.items.find(item=>String(item.id)===String(id));
  if(item){item.estado=approved?'aprobada':'rechazada';item.respuesta=response;}
}

function handleAdminRequestClick(event){
  if(typeof handleProposalCalendarClick==='function'&&handleProposalCalendarClick(event))return;
  const group=event.target.closest('[data-leave-review]');if(group)return openAdminLeaveReview(Number(group.dataset.leaveReview),group);
  const proposal=event.target.closest('[data-leave-propose]');if(proposal&&!proposal.disabled)return proposeLeaveCounteroffer(proposal);
  const evidence=event.target.closest('[data-request-evidence]');if(evidence)return $('admin-leave-review').open?openLeaveEvidence(evidence.dataset.requestEvidence):openAdminStoredEvidence(evidence.dataset.requestEvidence,REQUEST_BUCKET);
  const action=event.target.closest('[data-admin-personal-action]');
  if(action&&!action.disabled)return resolveAdminPersonalRequest(action.dataset.requestId,action.dataset.adminPersonalAction==='approve');
}

$('admin-request-list').onclick=handleAdminRequestClick;
$('admin-leave-review-days').onclick=handleAdminRequestClick;
document.querySelectorAll('[data-close-leave-review]').forEach(button=>button.onclick=()=>$('admin-leave-review').close());
$('admin-leave-review').addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
$('admin-leave-review').addEventListener('close',()=>{
  const trigger=ADMIN_LEAVE_REVIEW.trigger;
  ADMIN_LEAVE_REVIEW={key:null,items:[],trigger:null};
  if(trigger?.isConnected)trigger.focus();else $('admin-request-refresh')?.focus();
});

let LEAVE_EVIDENCE_GENERATION=0;
async function openLeaveEvidence(path){
  const generation=++LEAVE_EVIDENCE_GENERATION,dialog=$('leave-evidence-viewer'),img=$('leave-evidence-image'),message=$('leave-evidence-message'),loader=$('leave-evidence-loading-state'),link=$('leave-evidence-link');
  img.hidden=true;img.removeAttribute('src');
  if(link){link.hidden=true;link.removeAttribute('href');}
  if(loader)loader.hidden=false;
  message.textContent='Cargando comprobante…';
  if(!dialog.open)dialog.showModal();
  try{
    const {data,error}=await db.storage.from(REQUEST_BUCKET).createSignedUrl(path,3600);
    if(generation!==LEAVE_EVIDENCE_GENERATION||!dialog.open)return;
    if(error||!data?.signedUrl)throw new Error('evidencia');
    if(link){link.href=data.signedUrl;link.hidden=false;}
    img.onload=()=>{
      if(generation===LEAVE_EVIDENCE_GENERATION){
        img.hidden=false;
        if(loader)loader.hidden=true;
        message.textContent='';
      }
    };
    img.onerror=()=>{
      if(generation===LEAVE_EVIDENCE_GENERATION){
        if(loader)loader.hidden=false;
        message.textContent='No se pudo cargar la imagen. Cierra y vuelve a abrir el comprobante.';
      }
    };
    img.src=data.signedUrl;
  }catch{
    if(generation===LEAVE_EVIDENCE_GENERATION){
      if(loader)loader.hidden=false;
      message.textContent='No se pudo abrir el comprobante. Cierra e inténtalo nuevamente.';
    }
  }
}
$('admin-leave-evidence-open').onclick=event=>openLeaveEvidence(event.currentTarget.dataset.path);
document.addEventListener('click',event=>{if(event.target.closest('[data-open-leave-history]')){$('personal-leave-history-message').hidden=true;$('personal-leave-history').showModal();}});
document.querySelectorAll('[data-close-personal-leave-history]').forEach(button=>button.onclick=()=>$('personal-leave-history').close());
document.querySelectorAll('[data-close-leave-evidence]').forEach(button=>button.onclick=()=>$('leave-evidence-viewer').close());
$('leave-evidence-viewer').addEventListener('close',()=>{
  LEAVE_EVIDENCE_GENERATION++;
  $('leave-evidence-image').removeAttribute('src');
  $('leave-evidence-image').hidden=true;
  if($('leave-evidence-link'))$('leave-evidence-link').hidden=true;
  if($('leave-evidence-loading-state'))$('leave-evidence-loading-state').hidden=false;
});
for(const id of ['personal-leave-history','leave-evidence-viewer'])$(id).addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
$('personal-leave-history').addEventListener('close',()=>document.querySelector('[data-open-leave-history]')?.focus());
