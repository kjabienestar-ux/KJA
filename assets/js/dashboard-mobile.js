/* Adaptación del viewport y navegación móvil; reutiliza las acciones autorizadas. */
(function(){
  'use strict';
  const root=document.documentElement;
  function viewport(){
    const view=window.visualViewport;
    root.style.setProperty('--mobile-visible-height',Math.round(view?.height||window.innerHeight)+'px');
    root.style.setProperty('--mobile-visible-top',Math.round(view?.offsetTop||0)+'px');
  }
  viewport();window.addEventListener('resize',viewport,{passive:true});
  window.visualViewport?.addEventListener('resize',viewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',viewport,{passive:true});

  const nav=document.querySelector('.admin-section-nav'),section=document.getElementById('view-gestion');
  if(nav&&section){
    const label=document.createElement('details'),title=document.createElement('summary'),caption=document.createElement('span'),current=document.createElement('strong'),options=document.createElement('div');
    label.className='mobile-admin-navigation';caption.textContent='Administración';options.className='mobile-admin-options';
    title.append(caption,current);label.append(title,options);nav.before(label);
    const available=b=>!b.hidden&&!b.disabled&&b.getAttribute('aria-hidden')!=='true';
    function close(){label.open=false;title.focus()}
    label.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
    let signature='';
    function sync(){
      const buttons=[...nav.querySelectorAll('button[data-admin-section]')].filter(available);
      const key=buttons.map(b=>[b.dataset.adminSection,b.textContent,b.classList.contains('active')].join(':')).join('|');if(key===signature)return;signature=key;
      current.textContent=buttons.find(b=>b.classList.contains('active'))?.textContent||'Elegir sección';
      options.replaceChildren();
      for(const b of buttons){
        const option=document.createElement('button');option.type='button';option.value=b.dataset.adminSection;option.textContent=b.textContent;
        option.setAttribute('aria-pressed',String(b.classList.contains('active')));
        option.addEventListener('click',()=>{if(available(b)){b.click();close()}else sync()});options.append(option);
      }
      label.hidden=!buttons.length;
    }
    new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:['hidden','disabled','class','aria-hidden'],childList:true});sync();section.classList.add('has-mobile-admin-nav');
  }
  const ledger=document.getElementById('admin-month-ledger');
  if(ledger){
    ledger.tabIndex=0;ledger.setAttribute('role','region');ledger.setAttribute('aria-label','Asistencia mensual: desliza horizontalmente para ver todos los días');
    const hint=document.createElement('p');hint.className='mobile-scroll-hint';hint.textContent='Desliza la tabla para ver los días del mes. Toca un día para consultar o editar su registro.';ledger.before(hint);
  }
  const layers=[...document.querySelectorAll('.modal,.review-notification-layer')];
  function dialogs(){document.body.dataset.mobileDialogOpen=String(layers.some(el=>!el.hidden&&getComputedStyle(el).display!=='none'))}
  const observer=new MutationObserver(dialogs);layers.forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['hidden','class','style']}));dialogs();
  const sidebar=document.getElementById('sidebar');
  if(sidebar){
    function menu(){document.body.dataset.mobileMenuOpen=String(sidebar.classList.contains('open'))}
    new MutationObserver(menu).observe(sidebar,{attributes:true,attributeFilter:['class']});menu();
  }
})();
