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

  function bind(container){
    if(!container||container.dataset.tooltipBound)return;
    container.dataset.tooltipBound='true';
    const doc=container.ownerDocument,win=doc.defaultView;
    const tip=doc.createElement('div');tip.id='dashboard-day-tooltip';tip.className='dashboard-day-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;doc.body.append(tip);
    let active=null,hovering=false,leaveTimer=null;
    function hide(){if(leaveTimer)win.clearTimeout(leaveTimer);leaveTimer=null;if(active)active.removeAttribute('aria-describedby');active=null;tip.hidden=true;}
    function show(button){
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
    container.addEventListener('click',event=>show(target(event)));
    doc.addEventListener('pointerdown',event=>{if(!container.contains(event.target)&&!tip.contains(event.target))hide();});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
    container.addEventListener('scroll',hide);
    win.addEventListener('resize',hide);
    win.addEventListener('scroll',hide,true);
    return hide;
  }
  root.KJAMonthProgress={present,bind};
  if(typeof module!=='undefined')module.exports={present,bind};
})(typeof globalThis!=='undefined'?globalThis:this);
