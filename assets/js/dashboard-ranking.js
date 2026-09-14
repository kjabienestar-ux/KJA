/* Clasificación explicable. Ninguna simulación otorga premios ni cambia registros. */
(function(){'use strict';
  const get=id=>document.getElementById(id),model=window.KJARankingModel;
  const CRITERION_KEYS=['entrada','rpe','facebook','salida'];
  const labels={entrada:'Entrada puntual',rpe:'RPE en horario / Administración',facebook:'Comparticiones de Facebook',salida:'Salida en horario',penalizacion:'Descuento por asignación',tope:'Descuento máximo'};
  const SHORT_LABELS={entrada:'Entrada',rpe:'RPE',facebook:'Facebook',salida:'Salida'};
  const CRITERION_HELP={
    entrada:'Marca de entrada dentro de los minutos de tolerancia configurados por Dirección. Se compara con tus días laborables programados desde el día 1.',
    rpe:'RPE aprobado, con archivo, subido dentro de la jornada. También cuenta si Administración lo cargó para esa fecha (se reconoce aunque se registre después).',
    facebook:'Evidencias completas y aprobadas para cada día asignado en la agenda de comparticiones, trabajes o no ese día. Los pendientes de revisión y observados no suman aún.',
    salida:'Salida dentro de la ventana permitida (antes o después del horario programado según la política activa). Se evalúan solo las franjas ya terminadas.'
  };
  const CRITERION_ICONS={entrada:'🕐',rpe:'📄',facebook:'📘',salida:'🚪'};
  const CRITERION_COLORS={entrada:'#28649a',rpe:'#138574',facebook:'#7662a8',salida:'#a66a26'};

  let rows=[],weights={...model.defaults},request=0,stickyLeaderRow=null;

  /* ── HELPERS ──────────────────────────────────────────── */
  function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
  function bar(value,max,label,key){
    const track=el('div',undefined,'ranking-bar'),fill=el('i');
    track.setAttribute('role','img');track.setAttribute('aria-label',label);
    fill.style.width=`${max>0?Math.min(100,Math.max(0,(value||0)/max*100)):0}%`;fill.dataset.criterion=key;track.append(fill);return track;
  }
  function initials(name){return(name||'KJ').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();}
  const point=n=>n===null?'Sin evaluar':n.toFixed(2);
  const names=Object.keys(model.pairs);

  /* ── WEIGHTS FORM ─────────────────────────────────────── */
  for(const [key,value] of Object.entries(weights)){
    const lbl=el('label',labels[key]),inp=el('input');
    inp.type='number';inp.min='0';inp.max='100';inp.step='1';inp.required=true;inp.value=value;inp.name=key;
    lbl.append(inp);get('ranking-weights').append(lbl);
  }

  /* ── MONTH SETUP ──────────────────────────────────────── */
  const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit'}).format(new Date());
  get('ranking-month').value=now;get('ranking-month').max=now;

  function isCurrentMonth(){return get('ranking-month').value===now;}

  function updateMonthStatus(){
    const month=get('ranking-month').value;
    const isCurrent=month===now;
    const badge=get('ranking-month-badge');
    const desc=get('ranking-header-desc');
    const nextBtn=get('ranking-month-next');
    if(isCurrent){
      badge.textContent='BETA';badge.className='ranking-beta-badge';
      desc.innerHTML='Resultados provisionales · <strong>En desarrollo</strong>, los criterios pueden cambiar.';
    }else{
      const[y,m]=month.split('-');
      const monthName=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));
      badge.textContent='HISTÓRICO';badge.className='ranking-beta-badge ranking-hist-badge';
      desc.innerHTML=`Registro cerrado · <strong>${monthName}</strong> · Resultados finales.`;
    }
    // Next button state: disabled if selected month >= current month
    const[ny,nm]=now.split('-').map(Number);
    const[sy,sm]=(month||now).split('-').map(Number);
    nextBtn.disabled=(sy>ny)||(sy===ny&&sm>=nm);
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
    window.loadAdminRanking();
  }
  get('ranking-month-prev').addEventListener('click',()=>shiftMonth(-1));
  get('ranking-month-next').addEventListener('click',()=>shiftMonth(+1));
  get('ranking-month-today').addEventListener('click',()=>{if(!isCurrentMonth()){get('ranking-month').value=now;window.loadAdminRanking();}});

  /* ── MODAL DETAIL ─────────────────────────────────────── */
  function openRankingDetail(row){
    const m=row.metricas||{};
    const modal=get('ranking-detail-modal');
    // Header
    get('ranking-detail-avatar').textContent=initials(row.nombre);
    get('ranking-detail-name').textContent=row.nombre;
    get('ranking-detail-area').textContent=row.area||'Área no registrada';
    get('ranking-detail-rank').textContent=row.rank?`#${row.rank}`:'—';
    const scoreEl=get('ranking-detail-score');
    scoreEl.textContent=row.score!==null?point(row.score):'Sin evaluar';
    scoreEl.dataset.quality=row.score===null?'na':row.score>=85?'high':row.score>=65?'mid':'low';
    // Criteria
    const grid=get('ranking-detail-criteria-grid');grid.replaceChildren();
    for(const key of CRITERION_KEYS){
      const[num,den]=model.pairs[key];
      const earned=row.parts[key],max=weights[key],done=Number(m[num]||0),total=Number(m[den]||0);
      const card=el('div',undefined,'ranking-detail-criterion');
      card.style.setProperty('--criterion-color',CRITERION_COLORS[key]);
      const head=el('div',undefined,'ranking-detail-criterion-head');
      const tipEl=el('span','ⓘ','ranking-criterion-tip');
      tipEl.setAttribute('tabindex','0');tipEl.setAttribute('aria-label',CRITERION_HELP[key]);tipEl.dataset.tooltip=CRITERION_HELP[key];
      head.append(el('span',CRITERION_ICONS[key],'ranking-detail-criterion-icon'),el('span',labels[key],'ranking-detail-criterion-label'),tipEl);
      const scoreLine=el('div',undefined,'ranking-detail-criterion-score');
      scoreLine.append(el('strong',earned===null?'Sin programación':`${point(earned)} / ${max} pts`),el('small',`${done} de ${total} días`));
      const barEl=bar(earned,max,`${labels[key]}: ${point(earned)} de ${max}`,key);barEl.classList.add('ranking-detail-bar');
      card.append(head,scoreLine,barEl);grid.append(card);
    }
    // Evidence
    const evDl=get('ranking-detail-evidence-dl');evDl.replaceChildren();
    const req=Number(m.evidencias_requeridas||0),approved=Number(m.evidencias_aprobadas||0),uploaded=Number(m.evidencias_subidas||0),observed=Number(m.evidencias_observadas||0),pending=Number(m.revisiones_pendientes||0);
    const evItems=req?[['Aprobadas',`${approved} de ${req}`],['Subidas',`${uploaded}`],['Observadas',`${observed}`],['Pendientes de revisión',`${pending}`]]:[['Estado','Sin requisitos en los días evaluados']];
    for(const[dt,dd] of evItems){const d=el('div');d.append(el('dt',dt),el('dd',dd));evDl.append(d);}
    // Penalties
    const penDl=get('ranking-detail-penalties-dl');penDl.replaceChildren();
    const penItems=[['Asignaciones incumplidas',`${Number(m.asignaciones_incumplidas||0)}`],['Puntos descontados',`${row.penalty} (máx. ${weights.tope})`],['Penalización por tarea',`${weights.penalizacion} pts c/u`]];
    for(const[dt,dd] of penItems){const d=el('div');d.append(el('dt',dt),el('dd',dd));penDl.append(d);}
    // Footer
    get('ranking-detail-start').textContent=row.inicio||'Sin fecha registrada';
    get('ranking-detail-participation').textContent=`${Math.round(row.participation*100)}% (${m.dias||0} de ${m.dias_mes||0} días)`;
    get('ranking-detail-days').textContent=`${m.dias||0} trabajados · ${m.presentes||0} presencias`;
    modal.hidden=false;
    requestAnimationFrame(()=>modal.querySelector('.ranking-detail-sheet').focus());
  }
  function closeRankingDetail(){get('ranking-detail-modal').hidden=true;}
  document.addEventListener('click',e=>{if(e.target.closest('[data-close-ranking-detail]'))closeRankingDetail();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!get('ranking-detail-modal').hidden)closeRankingDetail();});

  /* ── STICKY BAR ───────────────────────────────────────── */
  function renderStickyBar(filtered,all){
    const stickyEl=get('ranking-sticky-bar');
    const indicators=get('ranking-sticky-indicators');
    const leaderBtn=get('ranking-sticky-leader');
    const areaLabel=get('ranking-sticky-area-label');
    const area=get('ranking-area').value;
    // 4 indicator chips
    indicators.replaceChildren();
    for(const key of CRITERION_KEYS){
      const[num,den]=model.pairs[key];
      const done=filtered.reduce((s,r)=>s+Number(r.metricas?.[num]||0),0);
      const expected=filtered.reduce((s,r)=>s+Number(r.metricas?.[den]||0),0);
      const pct=expected?Math.round(done/expected*100):null;
      const chip=el('div',undefined,'ranking-sticky-chip');
      chip.style.setProperty('--cc',CRITERION_COLORS[key]);
      const content=el('div',undefined,'rsc-content');
      const head=el('div',undefined,'rsc-head');
      head.append(el('span',SHORT_LABELS[key],'rsc-label'),el('strong',pct!==null?`${pct}%`:'—','rsc-pct'));
      content.append(head,el('small',pct!==null?`${done}/${expected} días`:'sin datos','rsc-days'));
      chip.append(el('span',CRITERION_ICONS[key],'rsc-icon'),content);
      indicators.append(chip);
    }
    // Leader chip
    const top=(area?filtered:all).find(r=>r.rank===1);
    stickyLeaderRow=top||null;
    if(top){
      leaderBtn.hidden=false;leaderBtn.replaceChildren();
      leaderBtn.append(el('span','🥇','rsl-medal'),el('b',top.nombre.split(' ').slice(0,2).join(' '),'rsl-name'),el('strong',`${point(top.score)} pts`,'rsl-score'));
    }else{leaderBtn.hidden=true;}
    // Area label
    if(area){
      const sel=get('ranking-area');
      const areaName=sel.options[sel.selectedIndex]?.text||area;
      areaLabel.textContent=`📍 ${areaName}`;areaLabel.hidden=false;
    }else{areaLabel.hidden=true;}
    stickyEl.hidden=false;
  }
  get('ranking-sticky-leader').addEventListener('click',()=>{if(stickyLeaderRow)openRankingDetail(stickyLeaderRow);});

  /* ── RENDER ───────────────────────────────────────────── */
  function render(){
    const all=model.evaluate(rows,weights),area=get('ranking-area').value;
    const filtered=area?model.evaluate(rows.filter(r=>String(r.area_id)===area),weights):all;
    // Sticky bar (replaces old stats cards)
    renderStickyBar(filtered,all);
    get('ranking-results').replaceChildren();get('ranking-leaders').replaceChildren();
    // Guide text
    get('ranking-guide').textContent=`Entrada puntual: ${weights.entrada} puntos. RPE en horario o cargado por Administración: ${weights.rpe}. Facebook en sus días asignados, trabajes o no: ${weights.facebook}. Salida en horario: ${weights.salida}. Se descuentan ${weights.penalizacion} puntos por asignación incumplida, hasta ${weights.tope}.`;
    // Chart (top 10) — clickable rows
    const chart=get('ranking-chart');
    const areaName=area?(get('ranking-area').options[get('ranking-area').selectedIndex]?.text||''):'';
    chart.replaceChildren(el('h3',area?`Comparación · ${areaName}`:'Comparación general'),el('p','Primeras 10 posiciones · Haz clic en cualquier persona para ver su desglose completo.'));
    for(const row of filtered.filter(r=>r.score!==null).slice(0,10)){
      const line=el('button',undefined,'ranking-chart-row');
      line.type='button';line.setAttribute('aria-label',`Ver desglose de ${row.nombre}`);
      line.append(el('span',`#${row.rank} ${row.nombre}`),bar(row.score,100,`${row.nombre}: ${point(row.score)} de 100 puntos`,'total'),el('b',point(row.score)));
      line.addEventListener('click',()=>openRankingDetail(row));chart.append(line);
    }
    if(!filtered.filter(r=>r.score!==null).length)chart.append(el('p','Sin datos evaluables en este período.'));
    // Leaders by area
    const groups=new Map([['General',all]]);
    for(const row of all)if(!groups.has(row.area))groups.set(row.area,model.evaluate(rows.filter(r=>r.area_id===row.area_id),weights));
    for(const[name,group] of groups){
      if(area&&name!=='General'&&name!==filtered[0]?.area)continue;
      const top=group.filter(r=>r.rank===1),card=el('article',undefined,'ranking-leader');
      card.setAttribute('role','button');card.setAttribute('tabindex','0');
      card.setAttribute('aria-label',`Ver desglose de ${top.map(r=>r.nombre).join(' y ')}`);
      card.append(el('small',name),el('h3',top.length?top.map(r=>r.nombre).join(' · '):'Sin datos evaluables'),el('p',top.length?`${point(top[0].score)} / 100 · ${top.length>1?'Empate provisional':'Primera posición provisional'}`:'Pendiente de registros'));
      if(top.length){
        card.addEventListener('click',()=>openRankingDetail(top[0]));
        card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRankingDetail(top[0]);}});
      }
      get('ranking-leaders').append(card);
    }
    // Full list — buttons with mini-bars
    if(!filtered.length){get('ranking-results').append(el('p','No hay colaboradores evaluables para este filtro.'));return}
    const loggedId=window.__kja_user_id;
    for(const row of filtered){
      const isMe=loggedId&&row.colaborador_id===loggedId;
      const btn=el('button',undefined,'ranking-person-btn'+(isMe?' ranking-person-btn--me':''));
      btn.type='button';btn.setAttribute('aria-label',`Ver desglose de ${row.nombre}`);
      const rankBadge=el('b',row.rank===null?'—':`#${row.rank}`,'ranking-person-rank');
      rankBadge.style.color=CRITERION_COLORS.entrada;
      const nameSpan=el('span',row.nombre+(isMe?' (yo)':''),'ranking-person-name');
      const areaSpan=el('small',row.area,'ranking-person-area');
      const scoreSpan=el('strong',row.score===null?'Sin evaluar':`${point(row.score)} pts`,'ranking-person-score');
      btn.append(rankBadge,el('span',undefined,'ranking-person-info'),nameSpan,areaSpan,scoreSpan);
      const miniBar=el('div',undefined,'ranking-person-minibars');
      for(const key of CRITERION_KEYS){const fill=bar(row.parts[key],weights[key],labels[key],key);fill.classList.add('ranking-mini-bar');miniBar.append(fill);}
      btn.append(miniBar);
      btn.addEventListener('click',()=>openRankingDetail(row));
      get('ranking-results').append(btn);
    }
  }

  /* ── LOAD DATA ────────────────────────────────────────── */
  window.loadAdminRanking=async()=>{
    const token=++request,month=get('ranking-month').value;
    updateMonthStatus();
    get('ranking-status').textContent='Calculando los días terminados del mes…';
    get('ranking-results').replaceChildren();get('ranking-leaders').replaceChildren();
    get('ranking-chart').replaceChildren();get('ranking-sticky-bar').hidden=true;
    rows=[];
    try{
      if(!/^\d{4}-\d{2}$/.test(month))throw Error('Selecciona un mes.');
      const{data,error}=await db.rpc('dash_ranking_mes',{p_mes:month+'-01'});if(token!==request)return;
      if(error)throw error;
      if(data.version!==3)throw Error('Actualiza la función ejecutando dashboard_54_ranking_cumplimiento.sql.');
      rows=data.filas||[];
      // Preserve selected area across month changes
      const previous=get('ranking-area').value;get('ranking-area').replaceChildren();
      const first=el('option','Todas las áreas');first.value='';get('ranking-area').append(first);
      for(const[id,name] of new Map(rows.map(r=>[String(r.area_id),r.area]))){const opt=el('option',name);opt.value=id;get('ranking-area').append(opt)}
      if(rows.some(r=>String(r.area_id)===previous))get('ranking-area').value=previous;
      // Status bar prefix differs for historical months
      const isCurrent=month===now;
      const prefix=isCurrent?'Datos hasta':'Registro cerrado al';
      const closedNote=isCurrent?' Las franjas aún abiertas quedan pendientes de evaluación.':'';
      get('ranking-status').textContent=`${prefix} ${data.hasta}. Entrada según estado puntual del sistema. Salida: ventana permitida desde ${data.salida_anticipacion_min} min antes hasta ${data.salida_gracia_min} min después del horario.${closedNote}`;
      render();
    }catch(error){
      if(token!==request)return;
      get('ranking-status').textContent=error.code==='PGRST202'
        ?'Falta ejecutar dashboard_54_ranking_cumplimiento.sql en Supabase.'
        :'No se pudo calcular el ranking. '+(error.message||'Intenta actualizar.');
    }
  };

  /* ── FORM & EVENTS ────────────────────────────────────── */
  get('ranking-form').onsubmit=event=>{
    event.preventDefault();
    try{
      const next={};
      for(const inp of get('ranking-weights').querySelectorAll('input'))next[inp.name]=Number(inp.value);
      model.evaluate([],next);weights=next;render();
      get('ranking-status').textContent='Simulación recalculada. Los pesos no se han aprobado ni guardado.';
    }catch(error){get('ranking-status').textContent=error.message;}
  };
  get('ranking-month').onchange=window.loadAdminRanking;
  get('ranking-refresh').onclick=window.loadAdminRanking;
  get('ranking-area').onchange=render;
})();
