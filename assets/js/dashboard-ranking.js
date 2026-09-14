/* Clasificación explicable. Ninguna simulación otorga premios ni cambia registros. */
(function(){
  'use strict';
  const get=id=>document.getElementById(id),model=window.KJARankingModel;
  const labels={entrada:'Entrada puntual',rpe:'RPE en horario / Administración',facebook:'Comparticiones de Facebook',salida:'Salida en horario',penalizacion:'Descuento por asignación',tope:'Descuento máximo'};
  let rows=[],weights={...model.defaults},request=0;
  function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
  for(const [key,value] of Object.entries(weights)){
    const label=el('label',labels[key]),input=el('input');input.type='number';input.min='0';input.max='100';input.step='1';input.required=true;input.value=value;input.name=key;label.append(input);get('ranking-weights').append(label);
  }
  const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit'}).format(new Date());
  get('ranking-month').value=now;get('ranking-month').max=now;
  const point=n=>n===null?'Sin evaluar':n.toFixed(2);
  const names=Object.keys(model.pairs);
  function bar(value,max,label,key){
    const track=el('div',undefined,'ranking-bar'),fill=el('i');
    track.setAttribute('role','img');track.setAttribute('aria-label',label);
    fill.style.width=`${max>0?Math.min(100,Math.max(0,(value||0)/max*100)):0}%`;fill.dataset.criterion=key;track.append(fill);return track;
  }
  function render(){
    const all=model.evaluate(rows,weights),area=get('ranking-area').value;
    const filtered=area?model.evaluate(rows.filter(r=>String(r.area_id)===area),weights):all;
    const stats=get('ranking-stats');stats.replaceChildren();
    for(const key of names){const [num,den]=model.pairs[key],done=filtered.reduce((sum,r)=>sum+Number(r.metricas?.[num]||0),0),expected=filtered.reduce((sum,r)=>sum+Number(r.metricas?.[den]||0),0),card=el('article');card.append(el('small',labels[key]),el('strong',expected?`${Math.round(done/expected*100)}%`:'Sin programación'),el('span',`${done} de ${expected} días cumplidos`));stats.append(card)}
    get('ranking-results').replaceChildren();get('ranking-leaders').replaceChildren();
    get('ranking-guide').textContent=`Entrada puntual: ${weights.entrada} puntos. RPE en horario o cargado por Administración: ${weights.rpe}. Facebook en sus días asignados, trabajes o no: ${weights.facebook}. Salida en horario: ${weights.salida}. Cada barra compara lo cumplido con lo programado desde el día 1. Se descuentan ${weights.penalizacion} puntos por asignación incumplida, hasta ${weights.tope}.`;
    const chart=get('ranking-chart');chart.replaceChildren(el('h3',area?'Comparación del área':'Comparación general'),el('p','Primeras 10 posiciones · Cada barra usa la misma escala de 0 a 100 puntos. Abre una persona abajo para ver qué suma y qué le falta.'));
    for(const row of filtered.filter(r=>r.score!==null).slice(0,10)){
      const line=el('div',undefined,'ranking-chart-row');line.append(el('span',`#${row.rank} ${row.nombre}`),bar(row.score,100,`${row.nombre}: ${point(row.score)} de 100 puntos`,'total'),el('b',point(row.score)));chart.append(line);
    }
    const groups=new Map([['General',all]]);
    for(const row of all)if(!groups.has(row.area))groups.set(row.area,model.evaluate(rows.filter(r=>r.area_id===row.area_id),weights));
    for(const [name,group] of groups){
      if(area&&name!=='General'&&name!==filtered[0]?.area)continue;
      const top=group.filter(r=>r.rank===1),card=el('article',undefined,'ranking-leader');
      card.append(el('small',name),el('h3',top.length?top.map(r=>r.nombre).join(' · '):'Sin datos evaluables'),el('p',top.length?`${point(top[0].score)} / 100 · ${top.length>1?'Empate provisional':'Primera posición provisional'}`:'Pendiente de registros'));
      get('ranking-leaders').append(card);
    }
    if(!filtered.length){get('ranking-results').append(el('p','No hay colaboradores evaluables para este filtro.'));return}
    for(const row of filtered){
      const card=el('details',undefined,'ranking-person'),summary=el('summary');
      summary.append(el('b',row.rank===null?'—':`#${row.rank}`),el('span',`${row.nombre} · ${row.area}`),el('strong',row.score===null?'Sin evaluar':`${point(row.score)} / 100`));card.append(summary);
      const detail=el('div',undefined,'ranking-breakdown');
      detail.append(el('p',`Participación en el mes: ${row.metricas?.dias||0} de ${row.metricas?.dias_mes||0} días laborables transcurridos (${Math.round(row.participation*100)}%). Inicio registrado: ${row.inicio||'sin fecha'}.`,'ranking-participation'));
      for(const key of names){const value=row.parts[key],item=el('div',undefined,'ranking-criterion'),[num,den]=model.pairs[key];item.append(el('span',labels[key]),el('b',value===null?'Sin programación':`${point(value)} / ${weights[key]}`),bar(value,weights[key],`${labels[key]}: ${point(value)}`,key),el('small',`${row.metricas?.[num]||0} de ${row.metricas?.[den]||0} días cumplidos desde el día 1`));detail.append(item)}
      const m=row.metricas||{},required=Number(m.evidencias_requeridas||0),uploaded=Number(m.evidencias_subidas||0);
      detail.append(el('p',required?`Evidencias: ${m.evidencias_aprobadas||0} aprobadas de ${required} requeridas. ${uploaded} subidas, ${Math.max(0,required-uploaded)} sin subir, ${m.evidencias_observadas||0} observadas y ${m.revisiones_pendientes||0} pendientes de revisión. Solo las aprobadas con archivo suman puntos.`:'Evidencias: no hay requisitos aplicables en los días evaluados. Este criterio no suma puntos.','ranking-evidence-summary'));
      detail.append(el('p',`RPE: ${m.rpe_administracion||0} válidos cargados por Administración; ${m.rpe_fuera_horario||0} aprobados pero subidos fuera de horario por el colaborador.`));
      detail.append(el('p',`Facebook sin jornada laboral: ${m.facebook_descanso_cumplidos||0} de ${m.facebook_descanso||0} días cumplidos. Total desde tu ingreso: ${m.facebook_cumplidos||0} de ${m.facebook_asignados||0}.`));
      detail.append(el('p',`Asignaciones incumplidas: ${row.metricas?.asignaciones_incumplidas||0} · Descuento: ${row.penalty}`));
      detail.append(el('p',`Días evaluados: ${row.metricas?.dias||0} · Presencias: ${row.metricas?.presentes||0} · Revisiones pendientes: ${row.metricas?.revisiones_pendientes||0}`));
      detail.append(el('p',`Criterios con datos: ${row.coverage} de 100 puntos. No se redistribuyen los puntos sin evaluar.`));
      if(!row.inicio_conocido)detail.append(el('p','Falta registrar el inicio del contrato; no se asigna una posición.'));
      card.open=row.rank===1;card.append(detail);get('ranking-results').append(card);
    }
  }
  window.loadAdminRanking=async()=>{
    const token=++request,month=get('ranking-month').value;
    get('ranking-status').textContent='Calculando los días terminados del mes…';get('ranking-results').replaceChildren();get('ranking-leaders').replaceChildren();get('ranking-chart').replaceChildren();get('ranking-stats').replaceChildren();rows=[];
    try{
      if(!/^\d{4}-\d{2}$/.test(month))throw Error('Selecciona un mes.');
      const {data,error}=await db.rpc('dash_ranking_mes',{p_mes:month+'-01'});if(token!==request)return;
      if(error)throw error;
      if(data.version!==3)throw Error('Actualiza la función ejecutando dashboard_54_ranking_cumplimiento.sql.');
      rows=data.filas||[];const previous=get('ranking-area').value;get('ranking-area').replaceChildren();
      const first=el('option','Todas las áreas');first.value='';get('ranking-area').append(first);
      for(const [id,name] of new Map(rows.map(r=>[String(r.area_id),r.area]))){const option=el('option',name);option.value=id;get('ranking-area').append(option)}
      if(rows.some(r=>String(r.area_id)===previous))get('ranking-area').value=previous;
      get('ranking-status').textContent=`Datos hasta ${data.hasta}. Entrada según estado puntual del sistema. Salida: ventana permitida desde ${data.salida_anticipacion_min} min antes hasta ${data.salida_gracia_min} min después del horario. Las franjas aún abiertas quedan pendientes de evaluación.`;render();
    }catch(error){if(token!==request)return;get('ranking-status').textContent=error.code==='PGRST202'?'Falta ejecutar dashboard_54_ranking_cumplimiento.sql en Supabase.':'No se pudo calcular el ranking. '+(error.message||'Intenta actualizar.');}
  };
  get('ranking-form').onsubmit=event=>{event.preventDefault();try{const next={};for(const input of get('ranking-weights').querySelectorAll('input'))next[input.name]=Number(input.value);model.evaluate([],next);weights=next;render();get('ranking-status').textContent='Simulación recalculada. Los pesos no se han aprobado ni guardado.'}catch(error){get('ranking-status').textContent=error.message}};
  get('ranking-month').onchange=window.loadAdminRanking;get('ranking-refresh').onclick=window.loadAdminRanking;get('ranking-area').onchange=render;
})();
