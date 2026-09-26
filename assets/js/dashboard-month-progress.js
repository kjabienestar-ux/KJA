(function(root){
  'use strict';
  function present(day){
    const sharing=day.aplica_comparticiones===true;
    if(!day.lab&&!sharing)return null;
    const prefix=day.lab?'':'No tenías jornada laboral. ';
    if(day.futuro)return {state:'future',alert:false,reason:sharing?'Comparticiones programadas para esta fecha.':'Jornada programada para esta fecha.'};
    if(sharing&&day.comparticiones_vencidas&&!day.comparticiones_completas){
      return {state:'incomplete',alert:true,reason:prefix+'Tenías comparticiones de Facebook asignadas y el plazo venció sin completar las evidencias.'};
    }
    if(day.cierre_estado==='incompleta')return {state:'incomplete',alert:true,reason:'Jornada incompleta: falta completar el cierre o sus evidencias. Consulta el detalle en Mi asistencia.'};
    const attendance=({P:'Presente.',T:'Entrada con tardanza.',J:'Jornada justificada.',NG:'No gestiona.'})[day.estado]||'Sin registro de entrada.';
    if(sharing){
      const reason=day.comparticiones_completas?'Comparticiones de Facebook entregadas.':'Comparticiones de Facebook pendientes; el plazo aún no vence.';
      return {state:day.lab?(day.estado||'pending').toLowerCase():day.comparticiones_completas?'p':'sharing-pending',alert:false,reason:(day.lab?attendance+' ':prefix)+reason};
    }
    return {state:(day.estado||'pending').toLowerCase(),alert:false,reason:attendance};
  }

  // Follow the visible center while swiping, without rotating the day labels.
  function curve(container){
    if(!container)return;
    if(container._updateMonthCurve){container._updateMonthCurve();return;}
    const win=container.ownerDocument.defaultView;
    const media=win.matchMedia('(max-width: 900px)');
    let frame=0;
    function update(){
      frame=0;
      const bounds=container.getBoundingClientRect();
      if(!bounds.width)return;
      const days=Array.from(container.querySelectorAll('.dashboard-month-day'));
      const positions=days.map(day=>{
        const rect=day.getBoundingClientRect();
        const distance=Math.min(1,Math.abs((rect.left+rect.width/2-bounds.left-bounds.width/2)/(bounds.width/2)));
        return media.matches?`${(26*distance*distance).toFixed(2)}px`:'0px';
      });
      days.forEach((day,index)=>day.style.setProperty('--day-arc-y',positions[index]));
    }
    const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(update);};
    container._updateMonthCurve=schedule;
    container.addEventListener('scroll',schedule,{passive:true});
    media.addEventListener('change',schedule);
    if(win.ResizeObserver)new win.ResizeObserver(schedule).observe(container);
    else win.addEventListener('resize',schedule);
    schedule();
  }

  function bind(container){
    if(!container||container.dataset.tooltipBound)return;
    container.dataset.tooltipBound='true';
    const doc=container.ownerDocument,win=doc.defaultView;
    const tip=doc.createElement('div');tip.id='dashboard-day-tooltip';tip.className='dashboard-day-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;doc.body.append(tip);
    let active=null,hovering=false,leaveTimer=null;
    let dayDialog=null;
    const mobile=()=>win.matchMedia?.('(max-width: 900px)').matches;
    function openDay(button){
      if(!button)return;
      hide();
      if(!dayDialog){
        dayDialog=doc.createElement('dialog');
        dayDialog.className='mobile-day-summary';
        dayDialog.setAttribute('aria-labelledby','mobile-day-summary-title');
        dayDialog.innerHTML='<button type="button" class="mobile-day-summary-close" aria-label="Cerrar detalle">×</button><svg class="mobile-day-summary-figure" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="9" y="15" width="39" height="42" rx="7" fill="#e4ece6"/><rect x="17" y="9" width="38" height="42" rx="7" fill="#fffdf8" stroke="#729182" stroke-width="1.5"/><path d="M26 6v8M45 6v8M18 22h36M26 31h6m7 0h6M26 39h6m7 0h6" stroke="#729182" stroke-width="2" stroke-linecap="round"/></svg><h2 id="mobile-day-summary-title"></h2><p class="mobile-day-summary-copy"></p><button type="button" class="mobile-day-summary-done">Entendido</button>';
        doc.body.append(dayDialog);
        dayDialog.querySelector('.mobile-day-summary-close').onclick=()=>dayDialog.close();
        dayDialog.querySelector('.mobile-day-summary-done').onclick=()=>dayDialog.close();
        dayDialog.addEventListener('click',event=>{
          const r=dayDialog.getBoundingClientRect();
          if(event.target===dayDialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dayDialog.close();
        });
      }
      const text=button.dataset.dayReason||'';
      const separator=text.indexOf(':');
      dayDialog.querySelector('h2').textContent=separator<0?'Tu jornada':text.slice(0,separator);
      dayDialog.querySelector('p').textContent=separator<0?text:text.slice(separator+1).trim();
      dayDialog.showModal();
    }
    function hide(){if(leaveTimer)win.clearTimeout(leaveTimer);leaveTimer=null;if(active)active.removeAttribute('aria-describedby');active=null;tip.hidden=true;}
    function show(button){
      if(mobile())return;
      if(!button)return;
      if(leaveTimer)win.clearTimeout(leaveTimer);leaveTimer=null;
      if(active&&active!==button)active.removeAttribute('aria-describedby');
      active=button;tip.textContent=button.dataset.dayReason;tip.hidden=false;button.setAttribute('aria-describedby',tip.id);
      const rect=button.getBoundingClientRect(),bounds=tip.getBoundingClientRect();
      tip.style.left=Math.max(8,Math.min(win.innerWidth-bounds.width-8,rect.left+rect.width/2-bounds.width/2))+'px';
      tip.style.top=(rect.bottom+bounds.height+16<=win.innerHeight?rect.bottom+8:Math.max(8,rect.top-bounds.height-8))+'px';
    }
    const target=event=>event.target.closest('[data-day-reason]');
    container.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const button=target(event);if(button){hovering=true;show(button);}});
    container.addEventListener('pointerout',event=>{
      const button=target(event);if(!button||button.contains(event.relatedTarget))return;
      hovering=false;if(tip.contains(event.relatedTarget)||doc.activeElement===button)return;leaveTimer=win.setTimeout(hide,150);
    });
    tip.addEventListener('pointerenter',()=>{if(leaveTimer)win.clearTimeout(leaveTimer);leaveTimer=null;});
    tip.addEventListener('pointerleave',()=>{if(!hovering&&doc.activeElement!==active)hide();});
    container.addEventListener('focusin',event=>show(target(event)));
    container.addEventListener('focusout',()=>hide());
    container.addEventListener('click',event=>mobile()?openDay(target(event)):show(target(event)));
    doc.addEventListener('pointerdown',event=>{if(!container.contains(event.target)&&!tip.contains(event.target))hide();});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
    container.addEventListener('scroll',hide);
    win.addEventListener('resize',hide);
    win.addEventListener('scroll',hide,true);
    return hide;
  }
  root.KJAMonthProgress={present,bind,curve};
  if(typeof module!=='undefined')module.exports={present,bind,curve};
})(typeof globalThis!=='undefined'?globalThis:this);
