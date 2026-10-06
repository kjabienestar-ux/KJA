/* Preserve the original 24-hour inputs used by schedule validation and saving. */
(()=>{
  function normalize(value){
    const match=/^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value||'');
    if(!match||+match[1]>23||+match[2]>59)return '';
    return `${match[1]}:${match[2]}`;
  }
  globalThis.KJAEditorTime={normalize};
  if(typeof document==='undefined')return;
  const modal=document.getElementById('admin-person-modal');if(!modal)return;
  const enhanced=new WeakMap();
  function enhance(){
    modal.querySelectorAll('input[type="time"]').forEach(input=>{
      if(enhanced.has(input)){enhanced.get(input)();return;}
      const wrap=document.createElement('span');wrap.className='editor-time-control';
      const clock=document.createElement('select');
      clock.className='editor-clock-select';
      const day=input.closest('.admin-schedule-row')?.querySelector('b')?.textContent||'';
      const name=input.getAttribute('aria-label')||`${input.classList.contains('schedule-end')||input.id==='admin-general-end'?'Salida':'Entrada'} ${day||'general'}`;
      clock.setAttribute('aria-label',`Hora de ${name} (24 horas)`);
      const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
      clock.append(option('','Hora'));
      for(let h=0;h<24;h++)for(let m=0;m<60;m+=15){const value=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;clock.append(option(value,value));}
      wrap.append(clock);input.after(wrap);input.hidden=true;
      const sync=()=>{
        const value=normalize(input.value);
        if(value&&!Array.from(clock.options).some(o=>o.value===value)){
          const next=Array.from(clock.options).find(o=>o.value>value);
          clock.insertBefore(option(value,value),next||null);
        }
        clock.value=value;clock.disabled=input.disabled;
      };
      const change=()=>{input.value=normalize(clock.value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
      clock.addEventListener('change',change);input.addEventListener('change',sync);
      new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled']});
      enhanced.set(input,sync);sync();
    });
  }
  for(const id of ['admin-schedule-grid','admin-facebook-schedule-grid']){
    const grid=document.getElementById(id);if(grid)new MutationObserver(enhance).observe(grid,{childList:true});
  }
  new MutationObserver(()=>{if(!modal.hidden)enhance();}).observe(modal,{attributes:true,attributeFilter:['hidden']});
  enhance();
})();
