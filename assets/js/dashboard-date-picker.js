/* Selector de fecha morado (mismo estilo que Cierres y entregables).
   El input date original sigue siendo la fuente de verdad: conserva value, min, max y change. */
const KJA_DATE_MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const KJA_DATE_SYNCS=[];
const kjaDatePad=n=>String(n).padStart(2,'0');
const kjaDateIso=(year,month,day)=>`${year}-${kjaDatePad(month)}-${kjaDatePad(day)}`;
const kjaDateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const kjaDateDisplay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'dd/mm/aaaa';

function syncKjaDatePickers(){KJA_DATE_SYNCS.forEach(sync=>sync());}

// Límites efectivos: los atributos min/max del input y, si hay pareja, la otra fecha del rango.
function kjaDateBounds(input,partner,role){
  let min=input.min||'',max=input.max||'';
  const other=partner?.value||'';
  if(other&&role==='from'&&(!max||other<max))max=other;
  if(other&&role==='to'&&(!min||other>min))min=other;
  return {min,max};
}

function initKjaDatePicker(input,{label,partner=null,role='',popupId}){
  if(!input)return;
  const wrap=document.createElement('div');wrap.className='kja-date-picker';
  wrap.innerHTML=`<button type="button" class="kja-date-trigger" aria-haspopup="dialog" aria-expanded="false" aria-controls="${popupId}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span class="kja-date-text">dd/mm/aaaa</span><svg class="kja-date-chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>
    <div id="${popupId}" class="kja-date-popup" role="dialog" aria-label="${label}" hidden>
      <header class="kja-date-head"><button type="button" class="kja-date-nav" data-nav="-1" aria-label="Mes anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><strong class="kja-date-title"></strong><button type="button" class="kja-date-nav" data-nav="1" aria-label="Mes siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></header>
      <div class="kja-date-weekdays" aria-hidden="true"><span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sá</span><span>Do</span></div>
      <div class="kja-date-grid"></div>
      <footer class="kja-date-foot"><button type="button" class="kja-date-today">Hoy</button><button type="button" class="kja-date-close">Cerrar</button></footer>
    </div>`;
  input.before(wrap);
  input.classList.add('sr-only');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
  input.style.pointerEvents='none';
  const trigger=wrap.querySelector('.kja-date-trigger'),
        text=wrap.querySelector('.kja-date-text'),
        popup=wrap.querySelector('.kja-date-popup'),
        title=wrap.querySelector('.kja-date-title')||popup.querySelector('.kja-date-title'),
        grid=wrap.querySelector('.kja-date-grid')||popup.querySelector('.kja-date-grid'),
        todayButton=wrap.querySelector('.kja-date-today')||popup.querySelector('.kja-date-today'),
        prev=wrap.querySelector('[data-nav="-1"]')||popup.querySelector('[data-nav="-1"]'),
        next=wrap.querySelector('[data-nav="1"]')||popup.querySelector('[data-nav="1"]'),
        closeBtn=wrap.querySelector('.kja-date-close')||popup.querySelector('.kja-date-close');

  if(typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function'){
    document.body.appendChild(popup);
  }
  let opened=false,year=0,month=0;

  function isInside(target){
    if(!target)return false;
    return Boolean(
      wrap.contains(target)||
      popup.contains(target)||
      target===input||
      target===wrap||
      target===popup||
      (trigger&&(target===trigger||trigger.contains(target)))
    );
  }
  function sync(){
    text.textContent=kjaDateDisplay(input.value);
    trigger.setAttribute('aria-label',`${label}: ${text.textContent}`);
    trigger.disabled=input.disabled;
    if(opened)render();
  }
  function render(){
    const {min,max}=kjaDateBounds(input,partner,role),today=kjaDateToday(),selected=input.value;
    title.textContent=`${KJA_DATE_MONTHS[month-1]} ${year}`;
    const lastPrev=new Date(year,month-1,0),prevEnd=kjaDateIso(lastPrev.getFullYear(),lastPrev.getMonth()+1,lastPrev.getDate());
    const systemMin=input.min||'2020-01-01',systemMax=input.max||today;
    prev.disabled=!!systemMin&&prevEnd<systemMin;
    next.disabled=!!systemMax&&kjaDateIso(month===12?year+1:year,month===12?1:month+1,1)>systemMax;
    const offset=(new Date(year,month-1,1).getDay()+6)%7,count=new Date(year,month,0).getDate();
    let html='<span class="kja-date-empty" aria-hidden="true"></span>'.repeat(offset);
    for(let d=1;d<=count;d++){
      const value=kjaDateIso(year,month,d),off=(min&&value<min)||(max&&value>max);
      html+=`<button type="button" class="kja-date-day${value===selected?' is-selected':''}${value===today?' is-today':''}" data-date="${value}" ${off?'disabled':''} aria-pressed="${value===selected}" aria-label="${d} de ${KJA_DATE_MONTHS[month-1]} de ${year}${value===today?' (Hoy)':''}">${d}</button>`;
    }
    grid.innerHTML=html;
    todayButton.disabled=(min&&today<min)||(max&&today>max)||false;
  }
  function position(){
    const r=trigger.getBoundingClientRect();
    if(r.bottom<0||r.top>window.innerHeight){
      close();
      return;
    }
    const width=Math.min(290,window.innerWidth-24);
    popup.style.width=`${width}px`;
    popup.style.left=`${Math.max(12,Math.min(r.left,window.innerWidth-width-12))}px`;
    popup.style.right='auto';
    const below=window.innerHeight-r.bottom,up=below<360&&r.top>below;
    popup.style.top=up?'auto':`${r.bottom+8}px`;
    popup.style.bottom=up?`${window.innerHeight-r.top+8}px`:'auto';
  }
  function close(focus=false){
    if(!opened)return;opened=false;
    try{if(popup.hidePopover)popup.hidePopover();}catch(_){}
    popup.hidden=true;trigger.setAttribute('aria-expanded','false');
    if(focus)trigger.focus({preventScroll:true});
  }
  function open(){
    try{
      document.querySelectorAll?.('.kja-date-popup:not([hidden])').forEach(p=>{
        if(p!==popup)p.hidden=true;
      });
      document.querySelectorAll?.('.kja-date-trigger[aria-expanded="true"]').forEach(t=>{
        if(t!==trigger)t.setAttribute('aria-expanded','false');
      });
    }catch(_){}
    const base=/^\d{4}-\d{2}-\d{2}$/.test(input.value)?input.value:kjaDateToday();
    [year,month]=base.split('-').map(Number);
    opened=true;popup.hidden=false;
    try{if(popup.showPopover)popup.showPopover();}catch(_){}
    trigger.setAttribute('aria-expanded','true');
    render();
    position();
  }
  function choose(value){
    close(true);input.value=value;sync();
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function move(delta){
    month+=delta;if(month<1){month=12;year--;}else if(month>12){month=1;year++;}
    render();
    position();
  }
  let lastTouchTime = 0;
  function bindAction(btn, action){
    if(!btn)return;
    btn.addEventListener('touchend', e => {
      lastTouchTime = Date.now();
      if(e.cancelable) e.preventDefault();
      e.stopPropagation();
      action();
    }, { passive: false });
    btn.addEventListener('click', e => {
      if(Date.now() - lastTouchTime < 450){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      action();
    });
  }
  trigger.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(opened)close();else open();
  });
  trigger.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();}});
  bindAction(prev, () => move(-1));
  bindAction(next, () => move(1));
  bindAction(closeBtn, () => close(true));
  bindAction(todayButton, () => choose(kjaDateToday()));
  popup.addEventListener('click',e=>e.stopPropagation());
  popup.addEventListener('pointerdown',e=>e.stopPropagation());
  const parentLabel=input.closest?.('label');
  if(parentLabel){
    parentLabel.addEventListener('click',e=>{
      if(isInside(e.target))e.preventDefault();
    });
  }
  grid.addEventListener('click',e=>{
    const day=e.target.closest?.('[data-date]');
    if(day&&!day.disabled){
      e.preventDefault();e.stopPropagation();
      choose(day.dataset.date);
    }
  });
  grid.addEventListener('keydown',e=>{
    const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if(!(e.key in steps))return;
    const days=[...grid.querySelectorAll('.kja-date-day')],index=days.indexOf(document.activeElement),target=days[index+steps[e.key]];
    if(index<0)return;e.preventDefault();
    if(target&&!target.disabled)target.focus({preventScroll:true});
  });
  const onEscape=e=>{
    if(e.key==='Escape'&&opened){
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };
  wrap.addEventListener('keydown',onEscape);
  popup.addEventListener('keydown',onEscape);
  document.addEventListener('pointerdown',e=>{if(opened&&!isInside(e.target))close();});
  document.addEventListener('focusin',e=>{if(opened&&!isInside(e.target))close();});
  window.addEventListener('resize',()=>{if(opened)position();});
  window.addEventListener('scroll',()=>{if(opened)position();},{passive:true,capture:true});
  document.addEventListener('scroll',()=>{if(opened)position();},{passive:true,capture:true});
  input.addEventListener('change',sync);
  KJA_DATE_SYNCS.push(sync);
  sync();
}

(()=>{
  const from=document.getElementById('attendance-export-from'),to=document.getElementById('attendance-export-to');
  if(!from||!to)return;
  initKjaDatePicker(from,{label:'Desde',partner:to,role:'from',popupId:'attendance-export-from-popup'});
  initKjaDatePicker(to,{label:'Hasta',partner:from,role:'to',popupId:'attendance-export-to-popup'});
})();
