/* Selector visual de áreas (directorio y contratos); conserva el select como fuente del filtro. */
let syncAdminAreaPicker=()=>{};
let syncAdminContractAreaPicker=()=>{};
let syncAdminInstitutionPicker=()=>{};

const AREA_PICKER_TEXT={icon:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',label:'Todas las áreas',filter:'Filtrar por área',search:'Buscar un área…',searchLabel:'Buscar un área',list:'Áreas',empty:'No se encontraron áreas.'};

function initAreaPickerElement(select, popupId, optionsId, footerText, setSyncCallback, text=AREA_PICKER_TEXT){
  if(!select)return;
  const wrap=document.createElement('div');wrap.className='area-picker';
  wrap.innerHTML=`<button type="button" class="area-picker-trigger" aria-haspopup="dialog" aria-expanded="false" aria-controls="${popupId}"><svg viewBox="0 0 24 24" aria-hidden="true">${text.icon}</svg><span>${text.label}</span><svg class="area-picker-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button>
    <div id="${popupId}" class="area-picker-popup" popover="manual" role="dialog" aria-label="${text.filter}" hidden>
      <label class="area-picker-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="text" placeholder="${text.search}" aria-label="${text.searchLabel}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${optionsId}" autocomplete="off"></label>
      <div id="${optionsId}" role="listbox" aria-label="${text.list}"></div><p class="area-picker-empty" role="status" hidden>${text.empty}</p>
      <footer>${footerText}</footer>
    </div>`;
  select.before(wrap);select.hidden=true;
  const trigger=wrap.querySelector('button'),label=trigger.querySelector('span'),popup=wrap.querySelector('.area-picker-popup'),input=wrap.querySelector('input'),list=wrap.querySelector('[role="listbox"]'),empty=wrap.querySelector('.area-picker-empty');
  let opened=false,items=[],active=0;
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
  function highlight(){
    const options=[...list.children];
    options.forEach((el,i)=>el.classList.toggle('is-focused',i===active));
    if(options[active]){
      const option=options[active];input.setAttribute('aria-activedescendant',option.id);
      // Desplazar solo la lista: scrollIntoView podía mover el dashboard y cerrar el menú.
      if(option.offsetTop<list.scrollTop)list.scrollTop=option.offsetTop;
      else if(option.offsetTop+option.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=option.offsetTop+option.offsetHeight-list.clientHeight;
    }
    else input.removeAttribute('aria-activedescendant');
  }
  function render(){
    items=[...select.options].filter(o=>!o.disabled&&normalize(o.textContent).includes(normalize(input.value.trim())));
    list.replaceChildren();
    items.forEach((o,i)=>{
      const option=document.createElement('button');option.type='button';option.tabIndex=-1;
      option.id=popupId==='area-picker-popup'?`area-picker-option-${i}`:`${popupId}-option-${i}`;
      option.setAttribute('role','option');option.setAttribute('aria-selected',String(o.value===select.value));option.className='area-picker-option';
      const text=document.createElement('span');text.textContent=o.textContent;option.append(text);
      if(o.value===select.value){const mark=document.createElementNS('http://www.w3.org/2000/svg','svg');mark.setAttribute('viewBox','0 0 24 24');mark.setAttribute('aria-hidden','true');mark.innerHTML='<path d="m5 12 4 4L19 6"/>';option.append(mark);}
      option.addEventListener('click',()=>choose(i));list.append(option);
    });
    active=Math.max(0,items.findIndex(o=>o.value===select.value));empty.hidden=items.length>0;highlight();
  }
  function position(){
    const r=trigger.getBoundingClientRect(),width=Math.min(Math.max(r.width,290),window.innerWidth-24);
    popup.style.width=`${width}px`;popup.style.left=`${Math.max(12,Math.min(r.left,window.innerWidth-width-12))}px`;
    const below=window.innerHeight-r.bottom-16,above=r.top-16,up=below<240&&above>below;
    popup.style.maxHeight=`${Math.max(100,Math.min(440,up?above:below))}px`;
    popup.style.top=up?'auto':`${r.bottom+8}px`;popup.style.bottom=up?`${window.innerHeight-r.top+8}px`:'auto';
  }
  function close(focus=false){
    if(!opened)return;opened=false;
    if(popup.matches(':popover-open'))popup.hidePopover();
    popup.hidden=true;trigger.setAttribute('aria-expanded','false');input.setAttribute('aria-expanded','false');
    if(focus)trigger.focus({preventScroll:true});
  }
  function open(){
    opened=true;input.value='';popup.hidden=false;
    if(popup.showPopover)popup.showPopover();
    trigger.setAttribute('aria-expanded','true');input.setAttribute('aria-expanded','true');position();render();input.focus({preventScroll:true});
  }
  function choose(i){
    if(!items[i])return;
    const value=items[i].value;
    close(true);select.value=value;sync();select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function sync(){
    label.textContent=select.selectedOptions[0]?.textContent||text.label;trigger.setAttribute('aria-label',`${text.filter}: ${label.textContent}`);
    trigger.classList.toggle('has-selection',!!select.value);if(opened)render();
  }
  if(setSyncCallback)setSyncCallback(sync);
  trigger.addEventListener('click',()=>opened?close():open());
  trigger.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open();}});
  input.addEventListener('input',render);
  // Mantener el foco en el buscador hasta que el clic haya elegido la opción.
  list.addEventListener('mousedown',e=>{if(e.button===0)e.preventDefault();});
  input.addEventListener('keydown',e=>{
    if(['ArrowDown','ArrowUp','Enter'].includes(e.key))e.preventDefault();
    if(e.key==='ArrowDown'){active=Math.min(active+1,items.length-1);highlight();}
    if(e.key==='ArrowUp'){active=Math.max(active-1,0);highlight();}
    if(e.key==='Enter')choose(active);
  });
  wrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();e.stopPropagation();close(true);}});
  document.addEventListener('pointerdown',e=>{if(opened&&!wrap.contains(e.target))close();});
  document.addEventListener('focusin',e=>{if(opened&&!wrap.contains(e.target))close();});
  window.addEventListener('resize',()=>{if(opened)position();});
  document.addEventListener('scroll',e=>{if(opened&&!popup.contains(e.target))close();},true);
  select.addEventListener('change',sync);
  new MutationObserver(sync).observe(select,{childList:true,subtree:true,characterData:true});
  sync();
}

(()=>{
  const peopleSelect=document.getElementById('admin-people-area');
  if(peopleSelect){
    initAreaPickerElement(peopleSelect,'area-picker-popup','area-picker-options','Filtra el directorio por equipo',fn=>syncAdminAreaPicker=fn);
  }
  const contractSelect=document.getElementById('admin-contract-area');
  if(contractSelect&&contractSelect!==peopleSelect){
    initAreaPickerElement(contractSelect,'contract-area-picker-popup','contract-area-picker-options','Filtra contratos por equipo',fn=>syncAdminContractAreaPicker=fn);
  }
  const institutionSelect=document.getElementById('admin-people-institution');
  if(institutionSelect&&institutionSelect!==peopleSelect){
    initAreaPickerElement(institutionSelect,'institution-picker-popup','institution-picker-options','Filtra el directorio por institución',fn=>syncAdminInstitutionPicker=fn,{icon:'<path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2 2 7h20L12 2z"/>',label:'Todas las instituciones',filter:'Filtrar por institución',search:'Buscar institución…',searchLabel:'Buscar una institución',list:'Instituciones',empty:'No se encontraron instituciones.'});
  }
  // Filtro temporal por correo: mismo selector visual que el de áreas.
  const emailSelect=document.getElementById('admin-people-email');
  if(emailSelect&&emailSelect!==peopleSelect){
    initAreaPickerElement(emailSelect,'email-picker-popup','email-picker-options','Filtra el directorio por correo',null,{icon:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',label:'Todos los correos',filter:'Filtrar por correo',search:'Buscar…',searchLabel:'Buscar una opción',list:'Correo',empty:'Sin resultados.'});
  }
})();
