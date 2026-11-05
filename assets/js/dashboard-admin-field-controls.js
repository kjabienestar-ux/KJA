/* Controles visuales de escritorio. Los campos originales conservan valores, eventos y validación. */
(()=>{
  const desktop=matchMedia('(min-width:901px)'),controls=new Map();let active=null,sequence=0,disposed=false;
  const scope='#admin-access-section,#admin-person-modal,#pw-shift-dialog';
  const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  const clock='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>';
  const nameOf=input=>input.getAttribute('aria-label')||input.closest('label')?.querySelector('.sr-only')?.textContent||input.closest('label')?.childNodes[0]?.textContent?.trim()||'Seleccionar';
  const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;};
  function close(restore=false){if(!active)return;const current=active;active=null;try{current.popup.hidePopover?.();}catch(_){}current.popup.hidden=true;current.trigger.setAttribute('aria-expanded','false');if(restore&&current.trigger.isConnected)current.trigger.focus({preventScroll:true});}
  function emit(input,value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  function position(control){
    const r=control.trigger.getBoundingClientRect(),p=control.popup,width=Math.min(control.time?280:Math.max(220,r.width),innerWidth-24);
    p.style.width=width+'px';p.style.left=Math.max(12,Math.min(r.left,innerWidth-width-12))+'px';
    const height=p.getBoundingClientRect().height;p.style.top=Math.max(12,Math.min(r.bottom+6,innerHeight-height-12))+'px';
  }
  function renderSelect(c){
    const list=document.createElement('div');list.className='af-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',c.name);
    [...c.input.options].forEach(option=>{
      const b=button(option.textContent,()=>{if(option.disabled)return;emit(c.input,option.value);c.sync();close(true);});b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));b.disabled=option.disabled;b.tabIndex=option.selected?0:-1;
      const check=document.createElement('span');check.textContent=option.selected?'✓':'';check.setAttribute('aria-hidden','true');b.prepend(check);list.append(b);
    });c.popup.replaceChildren(list);
  }
  function renderTime(c){
    let [hour,minute]=(c.input.value||'08:00').slice(0,5).split(':');
    const head=document.createElement('header');head.textContent=c.name+' · 24 horas';
    const columns=document.createElement('div');columns.className='af-clock-columns';
    [['Hora',24,hour],['Minuto',60,minute]].forEach(([label,count,selected],column)=>{
      const group=document.createElement('section'),title=document.createElement('b');title.textContent=label;group.append(title);
      const list=document.createElement('div');list.className='af-clock-list';list.setAttribute('role','group');list.setAttribute('aria-label',label);
      for(let i=0;i<count;i++){const value=String(i).padStart(2,'0'),b=button(value,()=>{if(column===0)hour=value;else minute=value;list.querySelectorAll('button').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.tabIndex=x===b?0:-1;});});b.setAttribute('aria-pressed',String(value===selected));b.setAttribute('aria-label',label+' '+value);b.tabIndex=value===selected?0:-1;list.append(b);}group.append(list);columns.append(group);
    });
    const foot=document.createElement('footer');foot.append(button('Sin hora',()=>{emit(c.input,'');c.sync();close(true);}),button('Cancelar',()=>close(true)),button('Aplicar hora',()=>{emit(c.input,hour+':'+minute);c.sync();close(true);}));c.popup.replaceChildren(head,columns,foot);
  }
  function enhance(input){
    if(controls.has(input)||input.hidden||input.closest('.editor-calendar,.af-popup')||input.multiple)return;
    const time=input.type==='time';if(!time&&input.tagName!=='SELECT')return;
    // Los selectores de área ya personalizados se conservan.
    if(!time&&input.closest('.area-picker,.role-custom-select'))return;
    const wrap=document.createElement('span');wrap.className='af-control';input.after(wrap);
    const trigger=document.createElement('button');trigger.type='button';trigger.className='af-trigger';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
    const text=document.createElement('span');trigger.append(text);trigger.insertAdjacentHTML('beforeend',time?clock:icon);wrap.append(trigger);
    const popup=document.createElement('div');popup.id='af-popup-'+(++sequence);popup.className='af-popup'+(time?' af-time-popup':'');popup.setAttribute('popover','manual');popup.setAttribute('role','dialog');popup.hidden=true;
    // El menú queda dentro del diálogo para conservar su foco y su capa modal.
    (input.closest('dialog')||input.closest('#admin-person-modal')||document.body).append(popup);
    const c={input,wrap,trigger,popup,time,name:nameOf(input),wasHidden:input.hidden};popup.setAttribute('aria-label',c.name);trigger.setAttribute('aria-controls',popup.id);
    c.sync=()=>{text.textContent=time?(input.value||'Elegir hora'):(input.selectedOptions[0]?.textContent||'Seleccionar');trigger.disabled=input.disabled;trigger.setAttribute('aria-label',c.name+': '+text.textContent);};
    c.open=()=>{if(trigger.disabled)return;if(active===c)return close();close();globalThis.KJAEditorCalendar?.close();active=c;time?renderTime(c):renderSelect(c);popup.hidden=false;try{popup.showPopover?.();}catch(_){}position(c);trigger.setAttribute('aria-expanded','true');const selected=popup.querySelector('[aria-selected=true],[aria-pressed=true]')||popup.querySelector('button:not(:disabled)');selected?.focus({preventScroll:true});popup.querySelectorAll('.af-clock-list,.af-options').forEach(list=>{const chosen=list.querySelector('[aria-pressed=true],[aria-selected=true]');if(chosen)list.scrollTop=Math.max(0,chosen.offsetTop-list.offsetTop-60);});};
    trigger.onclick=c.open;trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();c.open();}};
    popup.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const group=e.target.closest('.af-clock-list,.af-options');if(!group)return;const buttons=[...group.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;buttons[n]?.focus();});
    input.hidden=true;input.addEventListener('change',c.sync);c.invalid=event=>{event.preventDefault();trigger.focus();c.open();};input.addEventListener('invalid',c.invalid);const observer=new MutationObserver(()=>{c.sync();if(active===c&&input.disabled)close();});observer.observe(input,{attributes:true,attributeFilter:['disabled','value'],childList:true});c.observer=observer;controls.set(input,c);c.sync();
  }
  function refresh(){
    if(disposed)return;
    for(const [input,c] of controls)if(!input.isConnected||!desktop.matches){if(active===c)close();c.observer.disconnect();input.removeEventListener('change',c.sync);input.removeEventListener('invalid',c.invalid);input.hidden=c.wasHidden;c.wrap.remove();c.popup.remove();controls.delete(input);}
    if(!desktop.matches)return;
    document.querySelectorAll(scope).forEach(root=>{root.querySelectorAll('select,input[type=time]').forEach(enhance);});
    globalThis.KJAEditorCalendar?.enhance([...document.querySelectorAll('#pw-shift-dialog input[type=date]')]);
  }
  document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);}},true);
  document.addEventListener('pointerdown',e=>{if(active&&!active.wrap.contains(e.target)&&!active.popup.contains(e.target))close();});
  document.addEventListener('focusin',e=>{if(active&&!active.wrap.contains(e.target)&&!active.popup.contains(e.target))close();});
  document.addEventListener('scroll',e=>{if(active&&!active.popup.contains(e.target))close();},true);window.addEventListener('resize',()=>close());
  document.addEventListener('close',e=>{if(active&&e.target.contains(active.input))close();},true);
  let queued=false;const observer=new MutationObserver(()=>{if(!queued&&!disposed){queued=true;queueMicrotask(()=>{queued=false;refresh();});}});observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>{disposed=true;observer.disconnect();close();controls.forEach(c=>c.observer.disconnect());});
  window.addEventListener('pageshow',()=>{if(disposed){disposed=false;observer.observe(document.body,{childList:true,subtree:true});controls.forEach(c=>c.observer.observe(c.input,{attributes:true,attributeFilter:['disabled','value'],childList:true}));refresh();}});
  desktop.addEventListener('change',refresh);refresh();
})();
