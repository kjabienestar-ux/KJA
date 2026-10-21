/* Calendario administrativo de descansos. Las autorizaciones se validan en el RPC existente. */
(function(global){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const add=(value,n)=>{const date=new Date(value+'T12:00:00');date.setDate(date.getDate()+n);return iso(date)};
  const label=(value,options={day:'numeric',month:'long'})=>new Date(value+'T12:00:00').toLocaleDateString('es-PE',options);
  const arrow=right=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${right?'m9 6 6 6-6 6':'m15 6-6 6 6 6'}"/></svg>`;

  function mount(host,{data,month,personId='',date='',rpc,onChanged,isCurrent=()=>true}){
    let people=data.personas||[],selected=String(personId),anchor=date||`${month}-01`,view='month',query='',area='',busy=false,disposed=false,version=0,reason='';
    let dates=new Set(),cache=new Map([[month,data]]),loadError='',focusedDate=anchor,loading=false;
    const editable=!!data.puede_editar;
    if(date&&selected)dates.add(date);
    host.innerHTML=`<div class="leave-planner"><aside class="lp-people"><label for="lp-search">Buscar trabajador</label><input id="lp-search" type="search" placeholder="Nombre, DNI o área" autocomplete="off"><label class="lp-sr" for="lp-area">Filtrar área</label><select id="lp-area"><option value="">Todas las áreas</option>${[...new Set(people.map(p=>p.area||'Sin área'))].sort().map(a=>`<option>${escape(a)}</option>`).join('')}</select><div id="lp-people-count" class="lp-muted" role="status"></div><div id="lp-people-list" class="lp-people-list" role="group" aria-label="Trabajadores"></div></aside><main class="lp-main"><div class="lp-toolbar"><div class="lp-navigation"><button type="button" data-lp="prev" aria-label="Periodo anterior">${arrow(false)}</button><h3 id="lp-period"></h3><button type="button" data-lp="next" aria-label="Periodo siguiente">${arrow(true)}</button><button type="button" data-lp="today">Hoy</button></div><div class="lp-views" role="group" aria-label="Vista del calendario"><button type="button" data-view="month">Mes</button><button type="button" data-view="week">Semana</button></div></div><div class="lp-context" id="lp-context"></div><div id="lp-calendar" aria-label="Calendario de días libres"></div><section class="lp-assignment" ${editable?'':'hidden'}><form id="lp-form"><div class="lp-selection"><b id="lp-selection-count">Selecciona fechas en el calendario</b><button type="button" data-lp="clear">Limpiar selección</button></div><div id="lp-dates" class="lp-selected-dates"></div><div class="lp-range"><label>Desde<input id="lp-from" type="date" min="2020-01-01" max="2100-12-31"></label><label>Hasta<input id="lp-to" type="date" min="2020-01-01" max="2100-12-31"></label><button type="button" data-lp="range">Añadir rango</button></div><label for="lp-reason">Motivo del descanso</label><input id="lp-reason" minlength="3" maxlength="180" required placeholder="Ej. Reconocimiento por meta cumplida"><p class="lp-muted">No requiere entrada, salida ni RPE. Facebook conserva su horario. No se descuenta del saldo de días libres.</p><footer><span id="lp-target"></span><button class="admin-primary-action" id="lp-save" type="submit" disabled>Asignar días libres</button></footer></form></section><div id="lp-status" role="status" aria-live="polite"></div><section class="lp-agenda"><h3 id="lp-agenda-title">Descansos del periodo</h3><div id="lp-agenda"></div></section></main></div>`;
    const $=id=>host.querySelector('#'+id);
    const alive=()=>!disposed&&isCurrent();
    const person=()=>people.find(p=>String(p.id)===selected);
    const entries=()=>[...cache.values()].flatMap(d=>d.dias_libres||[]);
    const existing=(id,day)=>entries().some(d=>String(d.colaborador_id)===String(id)&&d.fecha===day);
    const available=day=>editable&&person()?.activo&&day>='2020-01-01'&&day<='2100-12-31'&&(!person().contrato_inicio||day>=person().contrato_inicio)&&!existing(selected,day);
    function period(){
      if(view==='week'){
        const day=new Date(anchor+'T12:00:00').getDay(),start=add(anchor,-((day+6)%7));
        return Array.from({length:7},(_,i)=>add(start,i));
      }
      const start=anchor.slice(0,7)+'-01',end=new Date(Number(start.slice(0,4)),Number(start.slice(5,7)),0).getDate();
      return Array.from({length:end},(_,i)=>add(start,i));
    }
    function message(text,error=false){$('lp-status').textContent=text;$('lp-status').classList.toggle('is-error',error)}
    function renderPeople(){
      const filtered=people.filter(p=>(!area||(p.area||'Sin área')===area)&&normalize(`${p.nombre} ${p.dni||''} ${p.area||''}`).includes(normalize(query)));
      $('lp-people-count').textContent=`${filtered.length} trabajadores`;
      $('lp-people-list').innerHTML=`<button type="button" data-lp="team" aria-pressed="${!selected}"><b>Ver todo el equipo</b></button>`+(filtered.map(p=>`<button type="button" data-person="${escape(p.id)}" aria-pressed="${String(p.id)===selected}"><span class="lp-avatar" aria-hidden="true">${escape(p.nombre.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join(''))}</span><span><b>${escape(p.nombre)}</b><small>${escape(p.area||'Sin área')}${p.activo?'':' · De baja'}</small></span></button>`).join('')||'<p class="lp-empty">No hay coincidencias. Prueba otro nombre o área.</p>');
    }
    function renderSelection(){
      const list=[...dates].sort();
      $('lp-selection-count').textContent=list.length?`${list.length} ${list.length===1?'día seleccionado':'días seleccionados'}`:'Selecciona fechas en el calendario';
      $('lp-dates').innerHTML=list.map(d=>`<button type="button" data-unselect="${d}" aria-label="Deseleccionar ${escape(label(d))}">${escape(label(d,{day:'numeric',month:'short'}))} <span aria-hidden="true">×</span></button>`).join('');
      $('lp-target').textContent=person()?`Para ${person().nombre}`:'Elige un trabajador para asignar descansos.';
      $('lp-save').disabled=busy||loading||!person()?.activo||!list.length||!!loadError;
      $('lp-save').textContent=busy?'Guardando…':`Asignar ${list.length||''} ${list.length===1?'día libre':'días libres'}`;
      $('lp-context').textContent=selected?`${person()?.nombre||'Trabajador'} · ${editable&&person()?.activo?'Haz clic en las fechas para seleccionarlas.':'Consulta de descansos.'}`:'Todo el equipo · Elige un trabajador para consultar o asignar sus descansos.';
    }
    function renderCalendar(){
      const days=period(),visible=entries().filter(d=>days.includes(d.fecha)&&(!selected||String(d.colaborador_id)===selected)&&(!area||(people.find(p=>String(p.id)===String(d.colaborador_id))?.area||'Sin área')===area));
      $('lp-period').textContent=view==='month'?label(anchor,{month:'long',year:'numeric'}):`${label(days[0])} – ${label(days[6])}`;
      host.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
      const offset=view==='month'?(new Date(days[0]+'T12:00:00').getDay()+6)%7:0;
      $('lp-calendar').innerHTML=`<div class="lp-weekdays">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<span>${d}</span>`).join('')}</div><div class="lp-calendar-grid ${view==='week'?'is-week':''}">${'<span class="lp-day-blank"></span>'.repeat(offset)}${days.map(day=>{
        const items=visible.filter(d=>d.fecha===day),chosen=dates.has(day),assigned=selected&&existing(selected,day);
        return `<button type="button" class="lp-day ${items.length?'has-leave':''} ${chosen?'is-selected':''}" data-day="${day}" aria-pressed="${chosen}" aria-label="${escape(label(day,{weekday:'long',day:'numeric',month:'long'}))}${assigned?', descanso asignado':items.length?`, ${items.length} descansos`:''}${chosen?', seleccionado':''}" ${busy||loadError?'disabled':''} ${day===data.hoy?'aria-current="date"':''}><span class="lp-day-number">${Number(day.slice(-2))}</span>${items.length?`<span class="lp-day-state">${selected?'Libre':`${items.length} libres`}</span>`:chosen?'<span class="lp-day-state">Elegido</span>':''}</button>`;
      }).join('')}</div><p class="lp-legend"><span>Libre: descanso asignado</span><span>Elegido: pendiente de guardar</span></p>${loadError?'<button type="button" data-lp="retry">Reintentar carga</button>':''}`;
      $('lp-agenda-title').textContent=`Descansos del periodo · ${visible.length}`;
      $('lp-agenda').innerHTML=visible.sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(item=>{
        const p=people.find(p=>String(p.id)===String(item.colaborador_id));
        return `<article class="lp-entry"><time datetime="${item.fecha}">${escape(label(item.fecha,{day:'numeric',month:'short'}))}</time><div><b>${escape(p?.nombre||'Colaborador')}</b><small>${escape(item.motivo||'Reconocimiento por asistencia presencial')}</small></div>${editable&&item.manual?`<button type="button" data-remove="${escape(item.colaborador_id)}" data-date="${item.fecha}" aria-label="Quitar descanso de ${escape(p?.nombre)} del ${escape(label(item.fecha))}">Quitar</button>`:'<span class="lp-muted">Beneficio presencial</span>'}</article>`;
      }).join('')||'<p class="lp-empty">No hay descansos asignados en este periodo para los filtros seleccionados.</p>';
      renderSelection();
    }
    async function load(){
      const token=++version,months=[...new Set(period().map(d=>d.slice(0,7)))];
      loadError='';loading=true;host.setAttribute('aria-busy','true');
      $('lp-calendar').innerHTML='<div class="lp-loading" role="status">Cargando calendario…</div>';
      $('lp-save').disabled=true;
      try{
        for(const key of months){
          if(cache.has(key))continue;
          const [year,m]=key.split('-').map(Number);
          const result=await rpc('dash_admin_mes',{p_anio:year,p_mes:m,p_incluir_inactivos:true});
          if(!alive()||token!==version)return;
          if(result.error||!result.data?.ok)throw new Error('No se pudo cargar el periodo. Reintenta para consultar y asignar descansos.');
          cache.set(key,result.data);
          for(const p of result.data.personas||[])if(!people.some(x=>String(x.id)===String(p.id)))people.push(p);
        }
      }catch(error){if(alive()&&token===version){loadError=error.message;message(loadError,true)}}
      finally{if(alive()&&token===version){loading=false;host.removeAttribute('aria-busy');renderCalendar();renderPeople()}}
    }
    function updateEntry(id,day,remove){
      const key=day.slice(0,7),record=cache.get(key)||{dias_libres:[]};
      record.dias_libres=(record.dias_libres||[]).filter(d=>!(String(d.colaborador_id)===String(id)&&d.fecha===day));
      if(!remove)record.dias_libres.push({colaborador_id:id,fecha:day,motivo:reason,manual:true});
      cache.set(key,record);
    }
    async function save(id,days,remove=false){
      if(busy||loading||!editable||!days.length)return;
      busy=true;host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);message(remove?'Quitando descanso…':`Guardando ${days.length} días…`);
      let completed=0,failure='';
      const errors={ya_asignado:'Esta fecha ya tiene un descanso. Actualiza el periodo.',sin_permiso:'No tienes permiso para gestionar descansos.',detalle:'Escribe un motivo de entre 3 y 180 caracteres.',colaborador:'El trabajador debe estar activo y la fecha debe ser posterior al inicio de su contrato.',beneficio_presencial:'Este beneficio presencial no se puede quitar.',fecha:'Selecciona una fecha válida.'};
      try{
        for(const day of days){
          const result=await rpc('dash_admin_dia_libre',{p_colab:Number(id),p_fecha:day,p_motivo:remove?null:reason,p_quitar:remove});
          if(result.error||!result.data?.ok)throw new Error(`${label(day)}: ${errors[result.data?.motivo]||'No se pudo confirmar el cambio. Reintenta para verificarlo.'}`);
          completed++;updateEntry(id,day,remove);if(!remove)dates.delete(day);
        }
      }catch(error){failure=error.message||'No se pudo confirmar el cambio. Revisa el calendario antes de reintentar.'}
      finally{
        // También refresca el libro si el usuario cerró la ventana durante la operación.
        busy=false;void onChanged();
        if(alive()){
          host.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);
          renderCalendar();
          message(`${completed?`${completed} ${remove?'descanso retirado':'día(s) asignado(s)'}. `:''}${failure||'Cambios guardados.'}${failure&&!remove?' Los días pendientes siguen seleccionados.':''}`,!!failure);
        }
      }
    }
    host.addEventListener('input',event=>{
      if(event.target.id==='lp-search'){query=event.target.value;renderPeople()}
      if(event.target.id==='lp-reason')reason=event.target.value.trim();
    });
    host.addEventListener('change',event=>{if(event.target.id==='lp-area'){area=event.target.value;renderPeople();renderCalendar()}});
    host.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button||busy||loading||button.disabled)return;
      if(button.dataset.person){selected=button.dataset.person;dates.clear();message('');renderPeople();renderCalendar();return}
      if(button.dataset.day){
        focusedDate=button.dataset.day;
        if(!selected){message('Selecciona primero un trabajador en el buscador.');$('lp-search').focus();return}
        if(!available(focusedDate)){message(existing(selected,focusedDate)?'Esta fecha ya tiene un descanso asignado. Puedes consultarlo abajo.':'No se puede asignar esta fecha al trabajador seleccionado.');return}
        dates.has(focusedDate)?dates.delete(focusedDate):dates.add(focusedDate);renderCalendar();host.querySelector(`[data-day="${focusedDate}"]`)?.focus();return;
      }
      if(button.dataset.unselect){dates.delete(button.dataset.unselect);renderCalendar();return}
      if(button.dataset.remove){await save(button.dataset.remove,[button.dataset.date],true);return}
      if(button.dataset.view){view=button.dataset.view;await load();return}
      const action=button.dataset.lp;
      if(action==='team'){selected='';dates.clear();message('');renderPeople();renderCalendar()}
      if(action==='clear'){dates.clear();renderCalendar()}
      if(action==='range'){
        const from=$('lp-from').value,to=$('lp-to').value;
        if(!selected||!from||!to||from>to){message('Elige un trabajador y un rango con fecha final igual o posterior a la inicial.',true);return}
        const count=Math.round((new Date(to+'T12:00:00')-new Date(from+'T12:00:00'))/86400000)+1;
        if(count>62){message('Selecciona como máximo 62 días por rango.',true);return}
        busy=true;host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
        try{
          const months=[...new Set(Array.from({length:count},(_,i)=>add(from,i).slice(0,7)))];
          for(const key of months){
            if(cache.has(key))continue;
            const [year,m]=key.split('-').map(Number),result=await rpc('dash_admin_mes',{p_anio:year,p_mes:m,p_incluir_inactivos:true});
            if(!alive())return;
            if(result.error||!result.data?.ok)throw new Error('No se pudo consultar el rango. Reintenta antes de añadir las fechas.');
            cache.set(key,result.data);
          }
        }catch(error){message(error.message,true);return}
        finally{busy=false;if(alive()){host.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);renderSelection()}}
        if(!alive())return;
        let added=0;for(let i=0;i<count;i++){const day=add(from,i);if(available(day)&&!dates.has(day)){dates.add(day);added++}}
        renderCalendar();message(`${added} fechas añadidas. Se omiten descansos ya asignados y fechas anteriores al contrato.`);
      }
      if(['prev','next','today','retry'].includes(action)){
        if(action==='today')anchor=data.hoy;
        else if(action!=='retry'){
          const direction=action==='prev'?-1:1;
          if(view==='week')anchor=add(anchor,direction*7);
          else{const d=new Date(anchor.slice(0,7)+'-01T12:00:00');d.setMonth(d.getMonth()+direction);anchor=iso(d)}
        }
        if(anchor<'2020-01-01'||anchor>'2100-12-31'){anchor=anchor<'2020-01-01'?'2020-01-01':'2100-12-31'}
        message('');await load();
      }
    });
    $('lp-form').addEventListener('submit',event=>{
      event.preventDefault();if(!person()?.activo||!dates.size||!$('lp-form').reportValidity()||loadError)return;
      reason=$('lp-reason').value.trim();if(reason.length<3){message('Escribe un motivo de al menos 3 caracteres.',true);return}
      void save(selected,[...dates].sort());
    });
    renderPeople();void load();
    return {dispose(){disposed=true;version++}};
  }
  global.KJADaysOffPlanner={mount};
})(window);
