/* Clasificación explicable. Ninguna simulación otorga premios ni cambia registros. */
(function(){'use strict';
  const get=id=>document.getElementById(id),model=window.KJARankingModel;
  const CRITERION_KEYS=['entrada','rpe','facebook','salida'];
  const labels={entrada:'Entrada puntual',rpe:'RPE en jornadas virtuales',facebook:'Comparticiones de Facebook',salida:'Salida en horario',penalizacion:'Descuento por asignación',tope:'Descuento máximo'};
  const SHORT_LABELS={entrada:'Entrada',rpe:'RPE',facebook:'Facebook',salida:'Salida'};
  const MODAL_LABELS={entrada:'Entrada puntual',rpe:'RPE virtual',facebook:'Facebook',salida:'Salida en horario'};
  const INPUT_LABELS={entrada:'Entrada',rpe:'RPE',facebook:'Facebook',salida:'Salida',penalizacion:'Por tarea',tope:'Máximo'};
  const CRITERION_HELP={
    entrada:'Marca de entrada dentro de los minutos de tolerancia configurados por Dirección. Se compara con tus días laborables programados desde el día 1.',
    rpe:'Se evalúa únicamente en jornadas virtuales. Debe estar aprobado, tener archivo y haberse subido dentro de la jornada; también cuenta una carga auditada de Administración. Si todo el periodo fue presencial, recibe crédito neutral.',
    facebook:'Evidencias completas y aprobadas para cada día asignado en la agenda de comparticiones, trabajes o no ese día. Los pendientes de revisión y observados no suman aún.',
    salida:'Salida dentro de la ventana permitida (antes o después del horario programado según la política activa). Se evalúan solo las franjas ya terminadas.'
  };
  const RULE_TEXT={
    entrada:()=>'Marca dentro de la tolerancia configurada por Dirección.',
    rpe:()=>'Aprobado, con archivo y subido dentro de la jornada, o cargado por Administración. Un periodo solo presencial recibe crédito neutral.',
    facebook:()=>'Evidencias completas y aprobadas en cada día asignado, aunque no trabajes ese día. Lo pendiente u observado aún no suma.',
    salida:()=>exitPolicy?`Entre ${exitPolicy.before} min antes y ${exitPolicy.after} min después del fin del horario. Solo franjas ya terminadas.`:'Dentro de la ventana permitida alrededor del fin del horario. Solo franjas ya terminadas.'
  };
  const ICONS={
    entrada:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    rpe:'<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4"/><path d="m9.5 14 2 2 3.5-4"/>',
    facebook:'<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
    salida:'<path d="M13 4H6.5a.5.5 0 0 0-.5.5v15a.5.5 0 0 0 .5.5H13"/><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5"/>',
    trophy:'<path d="M8 3.5h8V9a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5a3 3 0 0 0 3 4M16 5.5h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5"/>',
    crown:'<path d="m4 8 4 4 4-6 4 6 4-4-1.5 10h-13Z"/>',
    chart:'<path d="M4 20h16"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.5a3 3 0 0 1 0 5.5M17 14a5.5 5.5 0 0 1 3.5 5"/>',
    areas:'<path d="M3.5 20.5h17"/><path d="M5 20.5V9l5-3v14.5M10 20.5V4.5l9 4v12"/><path d="M13 11h3M13 14h3M13 17h3"/>',
    alert:'<path d="M12 4 3 19.5h18Z"/><path d="M12 10v4.5M12 17v.01"/>',
    minus:'<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
    cal:'<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    chev:'<path d="m9.5 6 6 6-6 6"/>',
    check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    chevl:'<path d="m14.5 6-6 6 6 6"/>',
    refresh:'<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'
  };
  const AVATAR_TONES=[['#F2E2D5','#8E4630'],['#EFE6DA','#6B4E2E'],['#F6E7DF','#A9583E'],['#ECE4DD','#5A4636'],['#F3E9D6','#94590A'],['#EDE3E0','#7A4A3E']];
  const LEVEL={hi:'Alto',mid:'Medio',lo:'Bajo',na:'Sin evaluar'};
  const PAGE_SIZE=10;

  let rows=[],weights={...model.defaults},request=0,exitPolicy=null,view=[],page=0,listFilter='all',search='',selectedArea=null,lastFocus=null;

  /* ── HELPERS ──────────────────────────────────────────── */
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon=(key,cls='')=>`<svg class="rk-ic${cls?' '+cls:''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key]||''}</svg>`;
  const point=n=>n===null?'Sin evaluar':n.toFixed(2);
  const scoreTone=s=>s===null||s===undefined?'na':s>=85?'hi':s>=65?'mid':'lo';
  const rateTone=r=>r===null||r===undefined?'na':r>=75?'hi':r>=50?'mid':'lo';
  const pct=(value,max)=>value===null||!max?0:Math.min(100,Math.max(0,value/max*100));
  const plain=text=>String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const personKey=row=>String(row.colaborador_id??row.id??row.nombre);
  function initials(name){return(name||'KJ').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();}
  function avatar(row,size='',medal=0){
    const name=row.nombre||'',hash=[...name].reduce((n,ch)=>n+ch.charCodeAt(0),0),[bg,fg]=AVATAR_TONES[hash%AVATAR_TONES.length];
    const photo=row.foto_url?`<img class="rk-photo" src="${esc(row.foto_url)}" alt="" decoding="async" loading="lazy">`:'';
    const badge=medal&&(size==='xl'||size==='lg')?`<span class="rk-medal">${medal}</span>`:'';
    return `<span class="rk-av${size?' rk-av-'+size:''}"${medal?` data-medal="${medal}"`:''} style="--av-bg:${bg};--av-fg:${fg}">${esc(initials(name))}${photo}${badge}</span>`;
  }
  const neutralRpe=(row,key)=>key==='rpe'&&Number(row.metricas?.rpe_mes||0)===0&&Number(row.metricas?.rpe_exentos_presencial||0)>0;
  function fmtDate(value,withYear=false){
    if(!/^\d{4}-\d{2}-\d{2}/.test(String(value||'')))return value||'—';
    const [y,m,d]=String(value).slice(0,10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'short',...(withYear?{year:'numeric'}:{})}).format(new Date(y,m-1,d)).replace('.','');
  }
  function areaName(){const sel=get('ranking-area');return sel.value?(sel.options[sel.selectedIndex]?.text||''):'';}
  function rankCounts(list){const counts=new Map();list.forEach(r=>{if(r.rank!==null)counts.set(r.rank,(counts.get(r.rank)||0)+1)});return counts;}
  function indexOfPerson(row){const key=personKey(row);return view.findIndex(r=>personKey(r)===key);}
  /* Las fotos que no cargan dejan visibles las iniciales. */
  get('admin-ranking-section').addEventListener('error',event=>{if(event.target?.matches?.('img.rk-photo'))event.target.remove()},true);
  get('ranking-detail-modal').addEventListener('error',event=>{if(event.target?.matches?.('img.rk-photo'))event.target.remove()},true);

  /* ── WEIGHTS FORM ─────────────────────────────────────── */
  for(const key of Object.keys(model.defaults)){
    const field=document.createElement('label');field.className='rk-inp';
    field.innerHTML=`<small>${INPUT_LABELS[key]}</small><span><button type="button" data-step="-1" aria-label="Restar 1 a ${esc(labels[key])}">−</button><input type="number" name="${key}" min="0" max="100" step="1" required aria-label="${esc(labels[key])}"><button type="button" data-step="1" aria-label="Sumar 1 a ${esc(labels[key])}">+</button></span>`;
    field.querySelector('input').value=weights[key];
    get('ranking-weights').append(field);
  }
  function syncWeightTotal(){
    const sum=CRITERION_KEYS.reduce((n,key)=>n+Number(get('ranking-weights').querySelector(`[name="${key}"]`).value||0),0);
    const total=get('ranking-weight-total');
    total.textContent=`Suma ${sum} de 100`;total.className=`rk-tag rk-tag-${sum===100?'hi':'lo'}`;
  }
  function setWeightInputs(values){for(const [key,value] of Object.entries(values)){const input=get('ranking-weights').querySelector(`[name="${key}"]`);if(input)input.value=value}syncWeightTotal();}
  get('ranking-weights').addEventListener('click',event=>{
    const button=event.target.closest('[data-step]');if(!button)return;
    const input=button.parentElement.querySelector('input');
    input.value=Math.min(100,Math.max(0,Number(input.value||0)+Number(button.dataset.step)));
    syncWeightTotal();
  });
  get('ranking-weights').addEventListener('input',syncWeightTotal);
  syncWeightTotal();

  /* ── MONTH SETUP ──────────────────────────────────────── */
  const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit'}).format(new Date());
  get('ranking-month').value=now;get('ranking-month').max=now;

  function isCurrentMonth(){return get('ranking-month').value===now;}
  let pickerYear=Number(now.slice(0,4));
  const monthLabels=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function updateMonthPicker(){
    const value=get('ranking-month').value;
    get('ranking-month-label').textContent=`${monthLabels[Number(value.slice(5))-1]} ${value.slice(0,4)}`;
    get('ranking-picker-year').textContent=pickerYear;
    get('ranking-year-next').disabled=pickerYear>=Number(now.slice(0,4));
    const options=get('ranking-month-options');options.replaceChildren();
    monthLabels.forEach((label,index)=>{
      const target=`${pickerYear}-${String(index+1).padStart(2,'0')}`,button=document.createElement('button');
      button.textContent=label;button.type='button';button.disabled=target>now;button.setAttribute('aria-pressed',String(target===value));
      button.onclick=()=>{get('ranking-month').value=target;get('ranking-month-picker').open=false;get('ranking-month-picker').querySelector('summary').focus();withAdminSkeleton('ranking',()=>window.loadAdminRanking())};options.append(button);
    });
  }
  get('ranking-year-prev').onclick=()=>{pickerYear--;updateMonthPicker()};
  get('ranking-year-next').onclick=()=>{pickerYear++;updateMonthPicker()};
  get('ranking-month-picker').addEventListener('toggle',()=>{if(get('ranking-month-picker').open){pickerYear=Number(get('ranking-month').value.slice(0,4));updateMonthPicker()}});
  document.addEventListener('click',event=>{if(!get('ranking-month-picker').contains(event.target))get('ranking-month-picker').open=false});
  get('ranking-month-picker').addEventListener('keydown',event=>{if(event.key==='Escape'){get('ranking-month-picker').open=false;get('ranking-month-picker').querySelector('summary').focus()}});

  function updateMonthStatus(){
    updateMonthPicker();
    const month=get('ranking-month').value;
    const isCurrent=month===now;
    const badge=get('ranking-month-badge');
    const desc=get('ranking-header-desc');
    const nextBtn=get('ranking-month-next');
    if(isCurrent){
      badge.textContent='BETA';badge.className='rk-badge';
      desc.innerHTML='Resultados provisionales · <strong>en desarrollo</strong>';
      get('ranking-podium-title').textContent='Podio provisional';
      get('ranking-podium-tag').textContent='Se confirma al cerrar el mes';
    }else{
      const[y,m]=month.split('-');
      const monthName=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));
      badge.textContent='HISTÓRICO';badge.className='rk-badge rk-badge-hist';
      desc.innerHTML=`Registro cerrado · <strong>${esc(monthName)}</strong> · resultados finales`;
      get('ranking-podium-title').textContent='Resultado del mes';
      get('ranking-podium-tag').textContent='Mes cerrado';
    }
    const[ny,nm]=now.split('-').map(Number);
    const[sy,sm]=(month||now).split('-').map(Number);
    nextBtn.disabled=(sy>ny)||(sy===ny&&sm>=nm);
    get('ranking-month-today').hidden=isCurrent;
  }

  /* ── MONTH NAV ────────────────────────────────────────── */
  function shiftMonth(delta){
    const val=get('ranking-month').value||now;
    const[y,m]=val.split('-').map(Number);
    const d=new Date(y,m-1+delta,1);
    const next=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit'}).format(d);
    const[ny,nm]=now.split('-').map(Number);
    const[ry,rm]=next.split('-').map(Number);
    if(ry>ny||(ry===ny&&rm>nm))return;
    get('ranking-month').value=next;
    withAdminSkeleton('ranking',()=>window.loadAdminRanking());
  }
  get('ranking-month-prev').addEventListener('click',()=>shiftMonth(-1));
  get('ranking-month-next').addEventListener('click',()=>shiftMonth(+1));
  get('ranking-month-today').addEventListener('click',()=>{if(!isCurrentMonth()){get('ranking-month').value=now;withAdminSkeleton('ranking',()=>window.loadAdminRanking());}});

  /* ── DETALLE DE UNA PERSONA ───────────────────────────── */
  function openRankingDetail(row){
    if(!row)return;
    const m=row.metricas||{},tone=scoreTone(row.score);
    const modal=get('ranking-detail-modal');
    lastFocus=document.activeElement;
    const tied=row.rank!==null&&view.filter(r=>r.rank===row.rank).length>1;
    const avatarHost=get('ranking-detail-avatar'),medal=row.rank&&row.rank<=3?row.rank:0;
    avatarHost.outerHTML=avatar(row,'xl',medal).replace('<span class="rk-av','<span id="ranking-detail-avatar" class="rk-av');
    get('ranking-detail-name').textContent=row.nombre;
    get('ranking-detail-area').textContent=`${row.area||'Área no registrada'} · ${get('ranking-month-label').textContent}${isCurrentMonth()?' · provisional':''}`;
    get('ranking-detail-rank').textContent=row.rank?`${row.rank}.º lugar${tied?' · empate':''}`:'Sin posición';
    const scoreEl=get('ranking-detail-score');
    scoreEl.textContent=row.score!==null?point(row.score):'Sin evaluar';
    scoreEl.dataset.quality=row.score===null?'na':row.score>=85?'high':row.score>=65?'mid':'low';
    scoreEl.className=`rk-tone-${tone}`;
    const level=get('ranking-detail-level');level.textContent=LEVEL[tone];level.className=`rk-tag rk-tag-${tone}`;
    // Criterios
    const grid=get('ranking-detail-criteria-grid');
    grid.innerHTML=CRITERION_KEYS.map(key=>{
      const[num,den]=model.pairs[key];
      const earned=row.parts[key],max=weights[key],done=Number(m[num]||0),total=Number(m[den]||0),neutral=key==='rpe'&&total===0&&Number(m.rpe_exentos_presencial||0)>0;
      let help=CRITERION_HELP[key];
      if(key==='salida'&&exitPolicy)help=`Cuenta con estado Presente o Tardanza y salida entre ${exitPolicy.before} min antes y ${exitPolicy.after} min después del fin del horario. Puntos = salidas válidas ÷ días evaluados × ${max}.`;
      const rate=total?Math.min(100,Math.round(done/total*100)):null,ringTone=neutral?'na':rateTone(rate);
      const missing=Math.max(0,total-done);
      let explanation=neutral?'Exento por presencial: no se solicitó evidencia RPE.':!total?'Sin días programados.':missing?`${missing} ${missing===1?'día no suma':'días no suman'} puntos.`:'Cumplimiento completo.';
      if(key==='salida'&&total)explanation=missing?`${missing} ${missing===1?'día sin salida válida':'días sin salida válida'}.`:'Todas las salidas evaluadas son válidas.';
      const ringLabel=`${SHORT_LABELS[key]}: ${neutral?'exento por presencial':rate===null?'sin programación':rate+'% de cumplimiento'}`;
      const points=neutral?`${point(earned)} <em>/ ${max} pts</em>`:earned===null?'Sin programación':`${point(earned)} <em>/ ${max} pts</em>`;
      const days=neutral?`Crédito neutral · ${Number(m.rpe_exentos_presencial)} días presenciales exentos`:`${done} de ${total} días`;
      return `<article class="rk-m-crit"><header>${icon(key)}<span>${MODAL_LABELS[key]}</span><span class="rk-tip" tabindex="0" role="img" aria-label="${esc(help)}" data-tooltip="${esc(help)}">i</span></header>
        <div class="rk-m-crit-row"><span class="rk-ring rk-tone-${ringTone}" style="--p:${neutral?100:rate||0}" role="img" aria-label="${esc(ringLabel)}"><b>${neutral?'Exento':rate===null?'—':rate+'%'}</b></span><span><b class="rk-m-pts">${points}</b><small>${days}</small></span></div>
        <p>${explanation}</p></article>`;
    }).join('');
    // Suma completa
    const eq=get('ranking-detail-equation');
    if(row.score===null){eq.textContent='Aún no tiene días evaluados en este período: no ocupa posición.';}
    else{
      const raw=CRITERION_KEYS.reduce((n,key)=>n+(row.parts[key]||0),0)-row.penalty;
      eq.innerHTML=`<span>Cómo se llega al puntaje:</span>${CRITERION_KEYS.map((key,i)=>`${i?'<i>+</i>':''}<b title="${SHORT_LABELS[key]}">${row.parts[key]===null?'—':point(row.parts[key])}</b>`).join('')}<i>−</i><b>${point(row.penalty)}</b><span>descuentos</span><b class="rk-eq-total">= ${point(row.score)}</b>${raw<0?'<small>El puntaje no baja de 0.</small>':''}`;
    }
    // Evidencias
    const req=Number(m.evidencias_requeridas||0),approved=Number(m.evidencias_aprobadas||0),uploaded=Number(m.evidencias_subidas||0),observed=Number(m.evidencias_observadas||0),pending=Number(m.revisiones_pendientes||0);
    const stat=(label,value,tone='')=>`<div class="rk-stat${tone?' rk-stat-'+tone:''}"><dt>${label}</dt><dd>${value}</dd></div>`;
    get('ranking-detail-evidence-dl').innerHTML=req
      ?stat('Aprobadas',`${approved} de ${req}`,'hi')+stat('Subidas',uploaded)+stat('Observadas',observed,observed?'lo':'')+stat('Pendientes de revisión',pending,pending?'mid':'')
      :stat('Estado','Sin requisitos en los días evaluados');
    // Descuentos
    const unmet=Number(m.asignaciones_incumplidas||0);
    get('ranking-detail-penalties-dl').innerHTML=stat('Asignaciones incumplidas',unmet,unmet?'lo':'')+stat('Puntos descontados',point(row.penalty),row.penalty?'lo':'')+stat('Penalización por tarea',`${weights.penalizacion} pts`)+stat('Descuento máximo',`${weights.tope} pts`);
    // Datos de participación
    get('ranking-detail-start').textContent=row.inicio?fmtDate(row.inicio,true):'Sin fecha registrada';
    get('ranking-detail-participation').textContent=`${Math.round(row.participation*100)} % · ${m.dias||0} de ${m.dias_mes||0} días`;
    get('ranking-detail-days').textContent=`${m.dias||0} trabajados · ${m.presentes||0} presencias`;
    modal.hidden=false;
    requestAnimationFrame(()=>modal.querySelector('.rk-modal-sheet').focus());
  }
  function closeRankingDetail(){
    if(get('ranking-detail-modal').hidden)return;
    get('ranking-detail-modal').hidden=true;
    if(lastFocus?.isConnected)lastFocus.focus();
  }

  /* ── CÓMO SE CALCULA ──────────────────────────────────── */
  function openHelp(){lastFocus=document.activeElement;get('ranking-form-error').textContent='';setWeightInputs(weights);get('ranking-help').hidden=false;requestAnimationFrame(()=>get('ranking-help').querySelector('.rk-drawer-panel').focus());}
  function closeHelp(){if(get('ranking-help').hidden)return;get('ranking-help').hidden=true;if(lastFocus?.isConnected)lastFocus.focus();}
  get('ranking-help-open').addEventListener('click',openHelp);
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-close-ranking-detail]'))closeRankingDetail();
    if(event.target.closest('[data-close-ranking-help]'))closeHelp();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeRankingDetail();closeHelp();}});
  function renderGuide(){
    const tones=['#8E4630','#A9583E','#C0704F','#C98063'];
    get('ranking-weight-bar').innerHTML=CRITERION_KEYS.map((key,i)=>`<span style="flex:${weights[key]||0} 1 0;background:${tones[i]}"${weights[key]?'':' hidden'}>${SHORT_LABELS[key]}<small>${weights[key]} pts</small></span>`).join('');
    get('ranking-guide').innerHTML=CRITERION_KEYS.map(key=>`<div class="rk-rule"><span class="rk-icon-tile">${icon(key)}</span><span><b>${labels[key]}</b><small>${RULE_TEXT[key]()}</small></span><em>${weights[key]}</em></div>`).join('')
      +`<div class="rk-rule rk-rule-lo"><span class="rk-icon-tile">${icon('minus')}</span><span><b>Descuentos</b><small>${weights.penalizacion} puntos por asignación incumplida, hasta ${weights.tope} puntos. Restan del total, no de un criterio.</small></span><em>−${weights.tope}</em></div>`;
  }

  /* ── RESUMEN DEL MES ──────────────────────────────────── */
  function areaGroups(list){
    const groups=new Map();
    list.forEach(row=>{const key=String(row.area_id);if(!groups.has(key))groups.set(key,{key,name:row.area||'Sin área',rows:[]});groups.get(key).rows.push(row)});
    return [...groups.values()].map(group=>{
      const ranked=model.evaluate(rows.filter(r=>String(r.area_id)===group.key),weights);
      return {...group,...model.summarize(group.rows),ranked,leaders:ranked.filter(r=>r.rank===1)};
    }).sort((a,b)=>(b.average??-1)-(a.average??-1)||a.name.localeCompare(b.name,'es'));
  }
  function renderKpis(list,summary,areas){
    const best=areas.find(a=>a.average!==null),unmet=list.reduce((n,r)=>n+Number(r.metricas?.asignaciones_incumplidas||0),0);
    const avg=summary.average;
    get('ranking-kpis').innerHTML=`
      <article class="rk-card rk-kpi"><small>${icon('chart')}Promedio del mes</small><b>${avg===null?'—':point(avg)}<em>/ 100</em></b><span class="rk-mini"><i style="width:${avg===null?0:Math.min(100,avg)}%"></i></span></article>
      <article class="rk-card rk-kpi"><small>${icon('users')}Participantes</small><b>${summary.count}</b><span><strong>${summary.evaluated}</strong> evaluables · ${summary.count-summary.evaluated} sin evaluar</span></article>
      <article class="rk-card rk-kpi"><small>${icon('areas')}${get('ranking-area').value?'Área':'Mejor área'}</small><b class="rk-kpi-text" title="${esc(best?.name||'')}">${best?esc(best.name):'Sin datos'}</b><span>${best?`<strong>${point(best.average)}</strong> pts de promedio · `:''}${areas.length} ${areas.length===1?'área':'áreas'}</span></article>
      <article class="rk-card rk-kpi${summary.pending?' rk-kpi-warn':''}"><small>${icon('alert')}Revisiones pendientes</small><b>${summary.pending}</b><span>${summary.pending?'Revísalas antes de reconocer':'No hay evidencias por revisar'}</span></article>
      <article class="rk-card rk-kpi"><small>${icon('minus')}Descuentos</small><b>${point(summary.penalty)}<em>pts</em></b><span><strong>${unmet}</strong> ${unmet===1?'asignación incumplida':'asignaciones incumplidas'}</span></article>`;
  }
  function renderPodium(list){
    const host=get('ranking-podium'),scored=list.filter(r=>r.score!==null);
    if(!scored.length){
      host.innerHTML=`<div class="rk-empty"><span class="rk-icon-tile">${icon('trophy')}</span><b>Sin datos evaluables</b><p>${isCurrentMonth()?'El podio aparece cuando termina el primer día evaluable del mes: solo cuentan los días hasta ayer y las franjas ya terminadas.':'No hubo jornadas evaluables en este período.'}</p></div>`;
      return;
    }
    const slot=rank=>{
      const group=scored.filter(r=>r.rank===rank),medal=['','g','s','b'][rank];
      if(!group.length){
        const covered=scored.some(r=>r.rank<rank&&r.rank+scored.filter(x=>x.rank===r.rank).length>rank);
        return `<div class="rk-pd rk-pd-${medal} rk-pd-empty"><div class="rk-pd-card"><p>${covered?'Lugar ocupado por un empate':'Sin participante'}</p></div><div class="rk-pd-base">${rank}</div></div>`;
      }
      const lead=group[0],tone=scoreTone(lead.score);
      if(group.length===1){
        const index=indexOfPerson(lead);
        return `<div class="rk-pd rk-pd-${medal}"><button type="button" class="rk-pd-card" data-person="${index}" aria-label="Ver desglose de ${esc(lead.nombre)}">${rank===1?`<span class="rk-crown">${icon('crown')}</span>`:''}${avatar(lead,'xl',rank)}<b class="rk-pd-name">${esc(lead.nombre)}</b><small class="rk-pd-area">${esc(lead.area||'Sin área')}</small><span class="rk-pd-score rk-tone-${tone}">${point(lead.score)}<em>/ 100</em></span><span class="rk-pd-link">Ver desglose${icon('chev')}</span></button><div class="rk-pd-base">${rank}</div></div>`;
      }
      const shown=group.slice(0,3);
      return `<div class="rk-pd rk-pd-${medal}"><div class="rk-pd-card rk-pd-tie">${rank===1?`<span class="rk-crown">${icon('crown')}</span>`:''}<span class="rk-tag rk-tag-medal">Empate · ${group.length} personas</span><span class="rk-pd-people">${shown.map(r=>`<button type="button" data-person="${indexOfPerson(r)}" aria-label="Ver desglose de ${esc(r.nombre)}">${avatar(r,'md',rank)}<span><b>${esc(r.nombre)}</b><small>${esc(r.area||'Sin área')}</small></span>${icon('chev')}</button>`).join('')}</span>${group.length>3?`<small class="rk-pd-more">y ${group.length-3} más en la clasificación</small>`:''}<span class="rk-pd-score rk-tone-${tone}">${point(lead.score)}<em>/ 100</em></span></div><div class="rk-pd-base">${rank}</div></div>`;
    };
    host.innerHTML=slot(2)+slot(1)+slot(3);
  }
  function renderCriteria(summary){
    const valid=summary.criteria.filter(c=>c.rate!==null),lowest=valid.length>1?[...valid].sort((a,b)=>a.rate-b.rate)[0].key:null;
    get('ranking-criteria').innerHTML=summary.criteria.map(c=>{
      const rate=c.rate===null?null:Math.round(c.rate),tone=rateTone(rate);
      return `<div class="rk-crow"><span class="rk-icon-tile">${icon(c.key)}</span><span class="rk-crow-text"><b>${labels[c.key]}</b><small>${weights[c.key]} pts · ${c.expected?`${c.done} de ${c.expected} días`:'Sin días programados'}${c.key===lowest?' <span class="rk-tag rk-tag-lo">Más bajo</span>':''}</small></span><strong class="rk-tone-${tone}">${rate===null?'—':rate+'%'}</strong><span class="rk-bar rk-tone-${tone}" role="img" aria-label="${esc(SHORT_LABELS[c.key])}: ${rate===null?'sin programación':rate+'% de cumplimiento'}"><i style="width:${rate||0}%"></i></span></div>`;
    }).join('')+'<p class="rk-crit-note">El RPE se evalúa solo en jornadas virtuales.</p>';
  }

  /* ── CLASIFICACIÓN ────────────────────────────────────── */
  const LIST_FILTERS={all:{label:'Todos',test:()=>true},pending:{label:'Con revisiones pendientes',test:r=>Number(r.metricas?.revisiones_pendientes||0)>0},penalty:{label:'Con descuentos',test:r=>r.penalty>0}};
  function renderTable(){
    const counts=rankCounts(view),query=plain(search.trim());
    get('ranking-filters').innerHTML=Object.entries(LIST_FILTERS).map(([key,f])=>`<button type="button" data-rk-filter="${key}" aria-pressed="${listFilter===key}">${f.label}<em>${view.filter(f.test).length}</em></button>`).join('');
    const list=view.map((row,index)=>({row,index})).filter(({row})=>LIST_FILTERS[listFilter].test(row)&&(!query||plain(row.nombre).includes(query)));
    const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));page=Math.min(Math.max(0,page),pages-1);
    const area=areaName(),filtered=list.length!==view.length;
    get('ranking-table-sub').textContent=`${filtered?`${list.length} de `:''}${view.length} ${view.length===1?'colaborador':'colaboradores'}${area?` de ${area}`:''} · pulsa una fila para ver el desglose`;
    const loggedId=window.__kja_user_id;
    const head=`<thead><tr><th scope="col" class="rk-col-pos">#</th><th scope="col">Colaborador</th>${CRITERION_KEYS.map(key=>`<th scope="col" class="rk-col-crit">${icon(key)}${SHORT_LABELS[key]} <em>/${weights[key]}</em></th>`).join('')}<th scope="col" class="rk-col-tag">Revisiones</th><th scope="col" class="rk-col-tag">Descuentos</th><th scope="col" class="rk-col-score">Puntaje</th><th scope="col" class="rk-col-go"><span class="sr-only">Abrir</span></th></tr></thead>`;
    if(!list.length){
      get('ranking-results').innerHTML=`${head}<tbody><tr class="rk-row-empty"><td colspan="10"><div class="rk-empty rk-empty-row"><b>${view.length?'Ningún colaborador coincide':'No hay colaboradores evaluables para este filtro.'}</b>${view.length?'<button type="button" class="rk-btn rk-btn-sm" data-rk-reset>Quitar búsqueda y filtros</button>':''}</div></td></tr></tbody>`;
    }else{
      const body=list.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(({row,index})=>{
        const isMe=loggedId&&row.colaborador_id===loggedId,medal=row.rank&&row.rank<=3?row.rank:0,tie=row.rank!==null&&counts.get(row.rank)>1;
        const crit=CRITERION_KEYS.map(key=>{
          const value=row.parts[key],neutral=neutralRpe(row,key);
          if(value===null)return '<td><span class="rk-dash">—</span></td>';
          return `<td><span class="rk-cv"><span>${point(value)}${neutral?'<em>exento</em>':''}</span><span class="rk-bar rk-bar-thin rk-tone-${neutral?'na':rateTone(pct(value,weights[key]))}"><i style="width:${neutral?100:pct(value,weights[key])}%"></i></span></span></td>`;
        }).join('');
        const pending=Number(row.metricas?.revisiones_pendientes||0);
        return `<tr data-person="${index}"${isMe?' class="is-me"':''}><td><span class="rk-pos"${medal?` data-medal="${medal}"`:''}>${row.rank??'—'}</span>${tie?'<small class="rk-tie">empate</small>':''}</td>
          <td><button type="button" class="rk-who" data-person="${index}" aria-label="Ver desglose de ${esc(row.nombre)}">${avatar(row,'sm',medal)}<span><b>${esc(row.nombre)}${isMe?' <em class="rk-me">Tú</em>':''}</b><small>${esc(row.area||'Sin área')}</small></span></button></td>
          ${crit}<td>${pending?`<span class="rk-tag rk-tag-mid">${pending} pend.</span>`:'<span class="rk-dash">—</span>'}</td><td>${row.penalty>0?`<span class="rk-tag rk-tag-lo">−${point(row.penalty)}</span>`:'<span class="rk-dash">—</span>'}</td>
          <td><span class="rk-score rk-tone-${scoreTone(row.score)}">${row.score===null?'Sin evaluar':`${point(row.score)}<em>/100</em>`}</span></td><td class="rk-col-go">${icon('chev')}</td></tr>`;
      }).join('');
      get('ranking-results').innerHTML=`${head}<tbody>${body}</tbody>`;
    }
    // Paginación
    const nav=get('ranking-pagination');
    if(list.length<=PAGE_SIZE){nav.innerHTML=list.length?`<span class="rk-pager-info">${list.length} de ${list.length}</span>`:'';return;}
    const numbers=[];for(let i=0;i<pages;i++){if(pages<=7||i===0||i===pages-1||Math.abs(i-page)<=1)numbers.push(i);else if(numbers[numbers.length-1]!=='…')numbers.push('…');}
    nav.innerHTML=`<button type="button" data-rk-page="${page-1}" aria-label="Página anterior"${page===0?' disabled':''}>${icon('chevl')}</button>${numbers.map(n=>n==='…'?'<span class="rk-pager-gap">…</span>':`<button type="button" data-rk-page="${n}"${n===page?' aria-current="page"':''} aria-label="Página ${n+1}">${n+1}</button>`).join('')}<button type="button" data-rk-page="${page+1}" aria-label="Página siguiente"${page>=pages-1?' disabled':''}>${icon('chev')}</button><span class="rk-pager-info">${page*PAGE_SIZE+1}–${Math.min(list.length,(page+1)*PAGE_SIZE)} de ${list.length}</span>`;
  }

  /* ── LECTURA DEL MES Y ÁREAS ──────────────────────────── */
  function renderInsights(summary){
    const weak=summary.criteria.filter(c=>c.rate!==null).sort((a,b)=>a.rate-b.rate)[0];
    get('ranking-insights').innerHTML=`
      <article class="rk-card rk-in"><span class="rk-icon-tile">${icon('chart')}</span><div><small>Lectura del mes</small><strong>${summary.average===null?'Sin evaluar':`${point(summary.average)} <em>/ 100</em>`}</strong><p>Promedio de ${summary.evaluated} colaboradores evaluables de ${summary.count}. Las áreas se comparan por promedio, no por tamaño.</p></div></article>
      <article class="rk-card rk-in rk-in-lo"><span class="rk-icon-tile">${icon(weak?.key||'alert')}</span><div><small>Qué limita el cumplimiento</small><strong>${weak?`${SHORT_LABELS[weak.key]} · ${Math.round(weak.rate)} %`:'Sin programación'}</strong><p>${weak?`${weak.done} de ${weak.expected} días cumplidos. Es el criterio con menor cumplimiento: revisa su desglose antes de atribuir causas.`:'No hay días programados evaluables.'}</p></div></article>
      <article class="rk-card rk-in rk-in-mid"><span class="rk-icon-tile">${icon('alert')}</span><div><small>Antes de reconocer al equipo</small><strong>${summary.pending} ${summary.pending===1?'revisión pendiente':'revisiones pendientes'}</strong><p>${point(summary.penalty)} puntos descontados por asignaciones incumplidas entre personas evaluables. Las evidencias sin aprobar pueden afectar RPE y Facebook.</p></div></article>`;
  }
  function renderAreas(areas){
    get('ranking-areas-count').textContent=`${areas.length} ${areas.length===1?'área':'áreas'}`;
    if(!areas.length){get('ranking-area-analytics').innerHTML='<p class="rk-empty-text">Sin áreas para este filtro.</p>';get('ranking-area-detail').innerHTML='';return;}
    if(!areas.some(a=>a.key===selectedArea))selectedArea=areas[0].key;
    get('ranking-area-analytics').innerHTML=areas.map((area,i)=>{
      const tone=scoreTone(area.average),leader=area.leaders[0];
      const leaderText=leader?`${avatar(leader,'xs')}Líder: ${esc(leader.nombre.split(' ').slice(0,2).join(' '))}${area.leaders.length>1?` y ${area.leaders.length-1} más`:''}`:'Sin líder evaluable';
      return `<button type="button" class="rk-arow" data-area-key="${esc(area.key)}" aria-pressed="${area.key===selectedArea}"><span class="rk-arow-num">${i+1}</span><span class="rk-arow-name"><b>${esc(area.name)}</b><small>${area.count} ${area.count===1?'persona':'personas'} · <span class="rk-lead">${leaderText}</span></small></span><span class="rk-bar rk-tone-${tone}"><i style="width:${area.average===null?0:Math.min(100,area.average)}%"></i></span><span class="rk-arow-val rk-tone-${tone}">${area.average===null?'—':point(area.average)}<em>${area.average===null?'sin evaluar':'pts'}</em></span></button>`;
    }).join('');
    const index=areas.findIndex(a=>a.key===selectedArea),area=areas[index],tone=scoreTone(area.average);
    const valid=area.criteria.filter(c=>c.rate!==null),lowest=valid.length?[...valid].sort((a,b)=>a.rate-b.rate)[0]:null;
    const top=area.ranked.filter(r=>r.score!==null).slice(0,3),counts=rankCounts(area.ranked);
    get('ranking-area-detail').innerHTML=`
      <header class="rk-card-head rk-card-head-line rk-ad-head"><div class="rk-ad-title"><span class="rk-icon-tile">${icon('areas')}</span><div><p class="rk-eyebrow">Área seleccionada</p><h3>${esc(area.name)}</h3><p>${area.evaluated} de ${area.count} ${area.count===1?'persona evaluable':'personas evaluables'}</p></div></div><div class="rk-ad-score"><span class="rk-score rk-score-lg rk-tone-${tone}">${area.average===null?'Sin evaluar':`${point(area.average)}<em>/ 100</em>`}</span><small>${index+1}.º de ${areas.length} ${areas.length===1?'área':'áreas'} · promedio</small></div></header>
      <div class="rk-ad-crit">${area.criteria.map(c=>{const rate=c.rate===null?null:Math.round(c.rate),t=rateTone(rate);return `<div class="rk-crow rk-crow-compact"><span class="rk-icon-tile">${icon(c.key)}</span><span class="rk-crow-text"><b>${SHORT_LABELS[c.key]}${valid.length>1&&c.key===lowest?.key?' <span class="rk-tag rk-tag-lo">Más bajo</span>':''}</b><small>${weights[c.key]} pts · ${c.expected?`${c.done} de ${c.expected} días`:'Sin días programados'}</small></span><strong class="rk-tone-${t}">${rate===null?'—':rate+'%'}</strong><span class="rk-bar rk-tone-${t}"><i style="width:${rate||0}%"></i></span></div>`}).join('')}</div>
      <div class="rk-ad-audit"><div class="rk-stat${area.pending?' rk-stat-mid':''}"><dt>Revisiones pendientes</dt><dd>${area.pending}</dd></div><div class="rk-stat${area.penalty?' rk-stat-lo':''}"><dt>Descuento total</dt><dd>${point(area.penalty)} pts</dd></div></div>
      <p class="rk-banner rk-banner-mid rk-ad-note">${icon('alert')}<span>${lowest?`<b>Menor cumplimiento: ${SHORT_LABELS[lowest.key]} (${Math.round(lowest.rate)} %).</b> Consulta las evidencias y los días programados para revisar el resultado.`:'No hay días programados para comparar los criterios.'}</span></p>
      <div class="rk-ad-top"><p class="rk-sec">Mejores del área</p>${top.length?`<div class="rk-ad-people">${top.map(r=>{const medal=r.rank<=3?r.rank:0,global=indexOfPerson(r);return `<button type="button" class="rk-ad-person" data-medal="${medal}" data-person="${global}" aria-label="Ver desglose de ${esc(r.nombre)}">${avatar(r,'lg',medal)}<b>${esc(r.nombre.split(' ').slice(0,2).join(' '))}</b><span class="rk-score rk-tone-${scoreTone(r.score)}">${point(r.score)}<em>/100</em></span><small>${r.rank}.º del área${counts.get(r.rank)>1?' · empate':''}</small></button>`}).join('')}</div>`:'<p class="rk-empty-text">Aún no hay personas evaluables en esta área.</p>'}</div>`;
  }

  /* ── SELECTOR DE ÁREA ─────────────────────────────────── */
  /* Lista propia con los colores del panel. El <select> oculto sigue guardando el valor. */
  const areaTrigger=get('ranking-area-trigger'),areaMenu=get('ranking-area-menu');
  function syncAreaSelect(){
    const select=get('ranking-area'),value=select.value,current=[...select.options].find(o=>o.value===value)||select.options[0];
    const counts=new Map();rows.forEach(r=>{const key=String(r.area_id);counts.set(key,(counts.get(key)||0)+1)});
    get('ranking-area-label').textContent=current?.textContent||'Todas las áreas';
    areaTrigger.setAttribute('aria-label',`Filtrar por área: ${current?.textContent||'Todas las áreas'}`);
    areaTrigger.classList.toggle('is-filtered',!!value);
    areaMenu.innerHTML=[...select.options].map((opt,i)=>{
      const selected=opt.value===value,count=opt.value?counts.get(opt.value)||0:rows.length;
      return `${i===1?'<span class="rk-select-sep" role="presentation"></span>':''}<button type="button" class="rk-select-option" role="option" id="ranking-area-opt-${i}" tabindex="-1" aria-selected="${selected}" data-area-value="${esc(opt.value)}"><span>${esc(opt.textContent)}</span><em>${count}</em>${selected?icon('check'):''}</button>`;
    }).join('');
  }
  function areaOptions(){return [...areaMenu.querySelectorAll('.rk-select-option')];}
  function openAreaMenu(focusLast=false){
    syncAreaSelect();areaMenu.hidden=false;areaTrigger.setAttribute('aria-expanded','true');
    const options=areaOptions();(options.find(o=>o.getAttribute('aria-selected')==='true')||options[focusLast?options.length-1:0])?.focus();
  }
  function closeAreaMenu(returnFocus=false){
    if(areaMenu.hidden)return;
    areaMenu.hidden=true;areaTrigger.setAttribute('aria-expanded','false');
    if(returnFocus)areaTrigger.focus();
  }
  function chooseArea(value){
    const select=get('ranking-area');closeAreaMenu(true);
    if(select.value===value)return;
    select.value=value;select.dispatchEvent(new Event('change'));
  }
  areaTrigger.addEventListener('click',()=>areaMenu.hidden?openAreaMenu():closeAreaMenu());
  areaTrigger.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openAreaMenu(event.key==='ArrowUp');}
  });
  areaMenu.addEventListener('click',event=>{const option=event.target.closest('[data-area-value]');if(option)chooseArea(option.dataset.areaValue);});
  areaMenu.addEventListener('keydown',event=>{
    const options=areaOptions(),index=options.indexOf(document.activeElement);
    const move=to=>{event.preventDefault();options[Math.max(0,Math.min(options.length-1,to))]?.focus();};
    if(event.key==='ArrowDown')move(index+1);
    else if(event.key==='ArrowUp')move(index-1);
    else if(event.key==='Home')move(0);
    else if(event.key==='End')move(options.length-1);
    else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAreaMenu(true);}
    else if(event.key==='Tab')closeAreaMenu();
    else if(event.key.length===1&&/\S/.test(event.key)){
      // Saltar a la primera área que empieza con la letra pulsada
      const letter=plain(event.key),start=index+1;
      const found=[...options.slice(start),...options.slice(0,start)].find(o=>plain(o.textContent).startsWith(letter));
      if(found){event.preventDefault();found.focus();}
    }
  });
  document.addEventListener('click',event=>{if(!get('ranking-area-select').contains(event.target))closeAreaMenu();});
  syncAreaSelect();

  /* ── RENDER ───────────────────────────────────────────── */
  function render(){
    const all=model.evaluate(rows,weights),area=get('ranking-area').value;
    view=area?model.evaluate(rows.filter(r=>String(r.area_id)===area),weights):all;
    const summary=model.summarize(view),areas=areaGroups(view);
    renderKpis(view,summary,areas);
    renderPodium(view);
    renderCriteria(summary);
    renderTable();
    renderInsights(summary);
    renderAreas(areas);
    renderGuide();
  }
  function setStatus(message,tone='info',retry=false){
    const status=get('ranking-status');
    status.className=`rk-banner rk-banner-${tone}`;
    status.innerHTML=message?`${icon(tone==='error'?'alert':'clock')}<div>${esc(message)}</div>${retry?`<button type="button" class="rk-btn rk-btn-sm" data-rk-retry>${icon('refresh')}Reintentar</button>`:''}`:'';
  }
  function renderInfos(data,isCurrent){
    const chips=[
      `${icon('cal')}${isCurrent?'Datos hasta el':'Registro cerrado al'} <b>${esc(fmtDate(data.hasta))}</b>`,
      `${icon('salida')}Salida válida: <b>${esc(data.salida_anticipacion_min)} min antes</b> a <b>${esc(data.salida_gracia_min)} min después</b>`,
      ...(isCurrent?[`${icon('clock')}Franjas abiertas: <b>pendientes de evaluación</b>`]:[]),
      `${icon('entrada')}Entrada según el estado puntual del sistema`
    ];
    get('ranking-infos').innerHTML=chips.map(chip=>`<span class="rk-info">${chip}</span>`).join('');
  }
  function syncSimBanner(){
    const simulated=Object.keys(model.defaults).some(key=>Number(weights[key])!==Number(model.defaults[key]));
    get('ranking-sim-banner').hidden=!simulated;
    get('ranking-sim-text').textContent=`Entrada ${weights.entrada} · RPE ${weights.rpe} · Facebook ${weights.facebook} · Salida ${weights.salida} · ${weights.penalizacion} pts por tarea, máximo ${weights.tope}.`;
  }

  /* ── LOAD DATA ────────────────────────────────────────── */
  window.loadAdminRanking=async()=>{
    const token=++request,month=get('ranking-month').value,section=get('admin-ranking-section');
    updateMonthStatus();
    section.dataset.state='loading';
    setStatus('Calculando los días terminados del mes…');
    get('ranking-infos').replaceChildren();
    for(const id of ['ranking-kpis','ranking-podium','ranking-criteria','ranking-results','ranking-pagination','ranking-insights','ranking-area-analytics','ranking-area-detail','ranking-filters'])get(id).replaceChildren();
    rows=[];view=[];page=0;
    try{
      if(!/^\d{4}-\d{2}$/.test(month))throw Error('Selecciona un mes.');
      const{data,error}=await db.rpc('dash_ranking_mes',{p_mes:month+'-01'});if(token!==request)return;
      if(error)throw error;
      if(data.version!==4)throw Error('Actualiza la función ejecutando dashboard_70_rpe_presencial.sql.');
      rows=data.filas||[];
      exitPolicy={before:Number(data.salida_anticipacion_min),after:Number(data.salida_gracia_min)};
      if(typeof hydrateProfilePhotos==='function'){
        try{rows=await hydrateProfilePhotos(rows)}catch{}
        if(token!==request)return;
      }
      // Conserva el área elegida al cambiar de mes
      const previous=get('ranking-area').value;get('ranking-area').replaceChildren();
      const first=document.createElement('option');first.textContent='Todas las áreas';first.value='';get('ranking-area').append(first);
      const areaList=[...new Map(rows.map(r=>[String(r.area_id),r.area||'Sin área']))].sort((a,b)=>a[1].localeCompare(b[1],'es',{sensitivity:'base'}));
      for(const[id,name] of areaList){const opt=document.createElement('option');opt.textContent=name;opt.value=id;get('ranking-area').append(opt)}
      if(rows.some(r=>String(r.area_id)===previous))get('ranking-area').value=previous;
      syncAreaSelect();
      renderInfos(data,month===now);
      setStatus('');
      section.dataset.state='ready';
      render();
      syncSimBanner();
      return true;
    }catch(error){
      if(token!==request)return;
      section.dataset.state='error';
      setStatus(error.code==='PGRST202'
        ?'Falta ejecutar dashboard_70_rpe_presencial.sql en Supabase.'
        :'No se pudo calcular el ranking. '+(error.message||'Intenta actualizar.'),'error',true);
      return false;
    }
  };

  /* ── FORM & EVENTS ────────────────────────────────────── */
  get('ranking-form').onsubmit=event=>{
    event.preventDefault();
    try{
      const next={};
      for(const inp of get('ranking-weights').querySelectorAll('input'))next[inp.name]=Number(inp.value);
      model.evaluate([],next);weights=next;
      get('ranking-form-error').textContent='';
      render();syncSimBanner();closeHelp();
    }catch(error){get('ranking-form-error').textContent=error.message;}
  };
  get('ranking-sim-reset').addEventListener('click',()=>{weights={...model.defaults};setWeightInputs(weights);render();syncSimBanner();});
  get('ranking-month').onchange=()=>withAdminSkeleton('ranking',()=>window.loadAdminRanking());
  get('ranking-area').onchange=()=>{page=0;selectedArea=null;syncAreaSelect();render();};
  get('ranking-search').addEventListener('input',event=>{search=event.target.value;page=0;renderTable();});
  get('admin-ranking-section').addEventListener('click',event=>{
    const target=event.target;
    const retry=target.closest('[data-rk-retry]');if(retry){withAdminSkeleton('ranking',()=>window.loadAdminRanking());return;}
    const filter=target.closest('[data-rk-filter]');if(filter){listFilter=filter.dataset.rkFilter;page=0;renderTable();return;}
    const pager=target.closest('[data-rk-page]');
    if(pager){
      page=Number(pager.dataset.rkPage);renderTable();
      const card=get('ranking-results').closest('.rk-table-card'),top=card.getBoundingClientRect().top;
      if(top<0)card.scrollIntoView({block:'start',behavior:'smooth'});
      return;
    }
    if(target.closest('[data-rk-reset]')){listFilter='all';search='';get('ranking-search').value='';page=0;renderTable();return;}
    const areaButton=target.closest('[data-area-key]');if(areaButton){selectedArea=areaButton.dataset.areaKey;renderAreas(areaGroups(view));return;}
    const person=target.closest('[data-person]');
    if(person&&Number(person.dataset.person)>=0)openRankingDetail(view[Number(person.dataset.person)]);
  });
})();
