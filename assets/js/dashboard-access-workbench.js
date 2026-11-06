/* KJA-029 · Organización visual de escritorio; conserva los controles y sus handlers. */
(()=>{
  const host=document.getElementById('admin-access-section');
  if(!host)return;
  const desktop=matchMedia('(min-width:901px)'),placements=[];
  let nav,panels,history,pager,options,notices,secondary;
  const icons={equipo:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5.7"/>',enlaces:'<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',reglas:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>'};
  function move(node,parent){const marker=document.createComment('access-original');node.before(marker);placements.push([node,marker]);parent.append(node);}
  function select(name,{focus=false}={}){
    nav.querySelectorAll('button').forEach(button=>{const active=button.dataset.accessView===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus();});
    Object.entries(panels).forEach(([key,panel])=>panel.hidden=key!==name);
    host.scrollTop=0;
    if(name==='reglas'&&typeof prepareOfficeMap==='function')requestAnimationFrame(()=>prepareOfficeMap());
  }
  function mount(){
    if(nav)return;
    host.classList.add('aw-workbench');
    nav=document.createElement('div');nav.className='aw-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Acceso y marcado');
    panels={};
    [['equipo','Equipo'],['enlaces','Enlaces de ingreso'],['reglas','Reglas de marcado']].forEach(([key,label])=>{
      const button=document.createElement('button');button.type='button';button.id='aw-tab-'+key;button.dataset.accessView=key;button.setAttribute('role','tab');button.setAttribute('aria-controls','aw-panel-'+key);button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg><span>${label}</span>`;button.onclick=()=>select(key);nav.append(button);
      const panel=document.createElement('div');panel.id='aw-panel-'+key;panel.className='aw-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;host.append(panel);panels[key]=panel;
    });
    host.querySelector('.admin-access-toolbar').after(nav);
    nav.onkeydown=event=>{const buttons=[...nav.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(index<0)return;let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();select(buttons[next].dataset.accessView,{focus:true});};
    move(document.getElementById('admin-access-kpis'),panels.equipo);
    move(host.querySelector('.admin-access-directory'),panels.equipo);
    pager=document.createElement('nav');pager.id='admin-access-pagination';pager.className='aw-pagination';pager.setAttribute('aria-label','Páginas del equipo');host.querySelector('.admin-access-directory').append(pager);
    secondary=document.createElement('div');secondary.className='aw-secondary';panels.equipo.append(secondary);
    notices=document.createElement('details');notices.className='aw-notices';notices.innerHTML='<summary>Avisos de horario <span id="aw-notice-count">0</span></summary>';secondary.append(notices);
    move(document.getElementById('admin-access-requests-wrap'),notices);
    history=document.createElement('details');history.className='aw-history';history.innerHTML='<summary>Historial de actividad</summary>';secondary.append(history);
    move(host.querySelector('.admin-access-audit'),history);
    move(host.querySelector('.admin-route-card'),panels.enlaces);
    move(host.querySelector('.admin-policy-card'),panels.reglas);
    const form=document.getElementById('admin-access-settings');options=document.createElement('div');options.className='aw-rule-options';form.prepend(options);
    ['.admin-policy-number','.admin-policy-toggle.fixed','.admin-policy-toggle.legacy','.admin-link-security','.admin-policy-updated','#admin-access-save'].forEach(selector=>move(host.querySelector(selector),options));
    move(host.querySelector('.admin-legacy-link'),panels.enlaces);
    select('equipo');
    if(typeof renderAccessPeople==='function')renderAccessPeople();
    const updateCount=()=>{const count=document.getElementById('admin-access-request-count');document.getElementById('aw-notice-count').textContent=count.textContent;};
    const countObserver=new MutationObserver(updateCount);countObserver.observe(document.getElementById('admin-access-request-count'),{childList:true,subtree:true});notices._observer=countObserver;updateCount();
  }
  function unmount(){
    if(!nav)return;
    placements.forEach(([node,marker])=>marker.replaceWith(node));placements.length=0;
    notices._observer.disconnect();pager.remove();options.remove();nav.remove();Object.values(panels).forEach(panel=>panel.remove());nav=null;host.classList.remove('aw-workbench');
    if(typeof renderAccessPeople==='function')renderAccessPeople();
    if(typeof prepareOfficeMap==='function')requestAnimationFrame(()=>prepareOfficeMap());
  }
  desktop.addEventListener('change',()=>desktop.matches?mount():unmount());if(desktop.matches)mount();
})();
