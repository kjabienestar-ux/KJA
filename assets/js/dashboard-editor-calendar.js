/* Local date picker; original ISO date inputs remain the source for saving. */
(()=>{
  const modal=document.getElementById('admin-person-modal');
  if(!modal)return;
  const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const parse=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return match?new Date(+match[1],+match[2]-1,+match[3],12):new Date();};
  const longDate=date=>new Intl.DateTimeFormat('es-PE',{dateStyle:'long'}).format(date);
  let active=null;
  const pickers=[];
  function close(restore=false){if(!active)return;const current=active;active=null;current.panel.hidden=true;current.trigger.setAttribute('aria-expanded','false');if(restore)current.trigger.focus();}
  for(const id of ['admin-contract-start','admin-contract-end']){
    const input=document.getElementById(id);if(!input)continue;
    const field=input.closest('label'),name=id.endsWith('start')?'Inicio del contrato':'Fin según documento';
    const wrap=document.createElement('span');wrap.className='editor-date-control';
    input.after(wrap);input.hidden=true;
    // Keep the field label associated with the visible trigger.
    const trigger=document.createElement('button');trigger.type='button';trigger.id=id+'-trigger';trigger.className='editor-date-trigger';
    trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
    if(field)field.htmlFor=trigger.id;
    const panel=document.createElement('span');panel.id=id+'-calendar';panel.className='editor-calendar';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',name);
    trigger.setAttribute('aria-controls',panel.id);
    wrap.append(trigger,panel);
    const picker={input,trigger,panel,wrap,month:parse(input.value)};pickers.push(picker);
    const sync=()=>{trigger.textContent=input.value?longDate(parse(input.value)):'Seleccionar fecha';trigger.setAttribute('aria-label',`${name}: ${trigger.textContent}`);trigger.disabled=input.disabled;};
    picker.sync=sync;
    function choose(value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);}
    function render(focusDate){
      panel.replaceChildren();
      const head=document.createElement('span');head.className='editor-calendar-head';
      const button=(label,text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.addEventListener('click',fn);return b;};
      const move=n=>{picker.month=new Date(picker.month.getFullYear(),picker.month.getMonth()+n,1,12);render();panel.querySelector(n<0?'[aria-label="Mes anterior"]':'[aria-label="Mes siguiente"]').focus();};
      const month=document.createElement('select');month.setAttribute('aria-label','Mes');
      for(let m=0;m<12;m++){const o=document.createElement('option');o.value=m;o.textContent=new Intl.DateTimeFormat('es-PE',{month:'long'}).format(new Date(2026,m,1));month.append(o);}month.value=picker.month.getMonth();
      const year=document.createElement('input');year.type='number';year.min='1900';year.max='9999';year.value=picker.month.getFullYear();year.setAttribute('aria-label','Año');
      month.onchange=()=>{picker.month=new Date(picker.month.getFullYear(),+month.value,1,12);render();panel.querySelector('select').focus();};
      year.onchange=()=>{if(!year.checkValidity()||!year.value)return;picker.month=new Date(+year.value,picker.month.getMonth(),1,12);render();panel.querySelector('input').focus();};
      year.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();year.onchange();}};
      head.append(button('Mes anterior','‹',()=>move(-1)),month,year,button('Mes siguiente','›',()=>move(1)));panel.append(head);
      const grid=document.createElement('span');grid.className='editor-calendar-days';grid.setAttribute('role','group');grid.setAttribute('aria-label',new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(picker.month));
      for(const day of ['Lu','Ma','Mi','Ju','Vi','Sá','Do']){const label=document.createElement('span');label.textContent=day;label.setAttribute('aria-hidden','true');grid.append(label);}
      const first=new Date(picker.month.getFullYear(),picker.month.getMonth(),1,12),offset=(first.getDay()+6)%7;
      const count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
      for(let i=0;i<offset;i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');grid.append(blank);}
      for(let d=1;d<=count;d++){
        const date=new Date(first.getFullYear(),first.getMonth(),d,12),value=iso(date);
        const b=button(longDate(date),d,()=>choose(value));b.dataset.date=value;
        b.setAttribute('aria-pressed',String(value===input.value));if(value===iso(new Date()))b.setAttribute('aria-current','date');
        b.disabled=!!((input.min&&value<input.min)||(input.max&&value>input.max));
        b.onkeydown=event=>{const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(!(event.key in steps))return;event.preventDefault();const next=new Date(date);next.setDate(next.getDate()+steps[event.key]);picker.month=new Date(next.getFullYear(),next.getMonth(),1,12);render(iso(next));};grid.append(b);
      }
      panel.append(grid);
      const foot=document.createElement('span');foot.className='editor-calendar-foot';
      const today=iso(new Date()),todayButton=button('Seleccionar hoy','Hoy',()=>choose(today));todayButton.disabled=!!((input.min&&today<input.min)||(input.max&&today>input.max));
      foot.append(button('Borrar fecha','Sin fecha',()=>choose('')),todayButton,button('Cerrar calendario','Cerrar',()=>close(true)));panel.append(foot);
      if(focusDate)panel.querySelector(`[data-date="${focusDate}"]:not(:disabled)`)?.focus();
    }
    trigger.onclick=()=>{if(active===picker){close();return;}close();active=picker;picker.month=parse(input.value);render();panel.hidden=false;trigger.setAttribute('aria-expanded','true');(panel.querySelector('[aria-pressed="true"]:not(:disabled)')||panel.querySelector('[data-date]:not(:disabled)'))?.focus();};
    panel.addEventListener('click',event=>event.stopPropagation());
    input.addEventListener('change',sync);sync();
  }
  modal.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}},true);
  document.addEventListener('pointerdown',event=>{if(active&&!active.wrap.contains(event.target))close();});
  document.addEventListener('focusin',event=>{if(active&&!active.wrap.contains(event.target))close();});
  new MutationObserver(()=>{close();pickers.forEach(p=>p.sync());}).observe(modal,{attributes:true,attributeFilter:['hidden']});
})();
