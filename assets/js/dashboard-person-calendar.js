(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateLabel=value=>new Date(value+'T12:00:00Z').toLocaleDateString('es-PE',{timeZone:'America/Lima',day:'numeric',month:'long',year:'numeric'});
  const clock=value=>value?new Date(value).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}):'Sin registro';
  function shift(month,amount){
    const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+amount,1));
    return d.toISOString().slice(0,7);
  }
  function daysView(days,today,person={}){
    return days.map(day=>{
      const future=day.futuro||day.fecha>today;
      const before=!!person.contrato_inicio&&day.fecha<person.contrato_inicio;
      const after=!!person.contrato_fin_referencia&&day.fecha>person.contrato_fin_referencia;
      // lab comes from the server: weekly schedule, holidays and individual exceptions.
      const scheduled=day.lab===true&&!before&&!after;
      const personal=KJAAttendanceCalendar.present({...day,futuro:future});
      const view=scheduled?personal:{tone:'off',label:before||after?'Fuera del contrato':'No laborable',
        reason:before?'Esta fecha es anterior al inicio del contrato.':after?'Esta fecha es posterior al fin de referencia del contrato.':'Este día no tiene jornada asignada en el horario de esta persona.',
        sharing:day.comparticiones_completas?'Hay comparticiones registradas; puedes consultar sus evidencias.':'Las comparticiones de esta fecha no se cuentan como incidencia en este calendario laboral.'};
      return {...day,view,future,scheduled,alert:scheduled&&!future&&['missing','incomplete'].includes(view.tone)};
    });
  }
  function mount({host,person,month,onBack,today=isoLima(),rpc=(name,args)=>db.rpc(name,args),storage=db.storage}){
    const initialMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')&&month>='2020-01'&&month<=today.slice(0,7)?month:today.slice(0,7);
    const session={month:initialMonth,days:[],selected:null,version:0,dayVersion:0,fileVersion:0};
    host._personCalendar=session;
    host.hidden=false;
    host.classList.add('person-calendar');
    const live=()=>host.isConnected&&host._personCalendar===session;
    const button=(attr,label,disabled=false)=>'<button type="button" '+attr+(disabled?' disabled':'')+'>'+label+'</button>';
    const chevron=side=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(side==='left'?'m14 6-6 6 6 6':'m10 6 6 6-6 6')+'"/></svg>';
    host.innerHTML=(onBack?'<div class="pc-back">'+button('data-pc-back',chevron('left')+' Volver a Mes completo')+'</div>':'')+'<header class="pc-header"><div><h3 tabindex="-1">'+escape(person.nombre)+'</h3><p>Asistencia y evidencias · según el contrato y horario de cada persona</p></div></header>'+
      '<dl class="pc-person">'+[['Área',person.area||person.asis_areas?.nombre||'Sin área'],['DNI',person.dni||'No registrado'],['Ingreso',person.contrato_inicio?dateLabel(person.contrato_inicio):'No registrado']].map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+escape(v)+'</dd></div>').join('')+'</dl>'+
      '<nav class="pc-toolbar" aria-label="Mes del colaborador">'+button('data-pc-shift="-1" aria-label="Mes anterior"',chevron('left'))+
      '<label>Mes<input type="month" data-pc-month min="2020-01" max="'+today.slice(0,7)+'" value="'+session.month+'"></label>'+
      button('data-pc-shift="1" aria-label="Mes siguiente"',chevron('right'))+button('data-pc-current','Mes actual')+'</nav>'+
      '<div data-pc-content aria-live="polite"></div>';
    const content=host.querySelector('[data-pc-content]');
    async function load(){
      const version=++session.version;++session.dayVersion;++session.fileVersion;
      session.days=[];session.selected=null;
      host.querySelector('[data-pc-month]').value=session.month;
      host.querySelector('[data-pc-shift="-1"]').disabled=session.month<='2020-01';
      host.querySelector('[data-pc-shift="1"]').disabled=session.month>=today.slice(0,7);
      content.setAttribute('aria-busy','true');
      content.innerHTML='<p class="pc-message" role="status">Cargando calendario de '+escape(person.nombre)+'…</p>';
      try{
        const [year,monthNumber]=session.month.split('-').map(Number);
        const {data,error}=await rpc('dash_historial',{p_anio:year,p_mes:monthNumber,p_colab:Number(person.id)});
        if(!live()||version!==session.version)return;
        if(error||!data?.ok)throw new Error(data?.motivo||'load');
        session.days=daysView(data.dias||[],today,{...person,...data.calendario_contrato});
        const alerts=session.days.filter(d=>d.alert);
        const total=state=>session.days.filter(d=>d.scheduled&&!d.future&&d.estado===state&&(state==='J'||!['incompleta','en_curso','lista_para_salir'].includes(d.cierre_estado))).length;
        const shared=session.days.filter(d=>d.scheduled&&!d.future&&d.aplica_comparticiones&&d.comparticiones_completas).length;
        const unavailable=session.days.some(d=>!Object.hasOwn(d,'aplica_comparticiones'));
        const offset=(new Date(session.month+'-01T12:00:00Z').getUTCDay()+6)%7;
        const cells='<span aria-hidden="true"></span>'.repeat(offset)+session.days.map(d=>
          button('data-pc-day="'+escape(d.fecha)+'" class="pc-day '+escape(d.view.tone)+'" aria-pressed="false" aria-label="'+escape(dateLabel(d.fecha)+': '+d.view.label)+ '"',
            '<b>'+Number(d.d||d.fecha.slice(-2))+'</b><span>'+escape(({missing:'Sin FB',incomplete:'Incompl.',j:'Justif.',p:'P',t:'T',shared:'FB',future:'Próximo',off:'—',pending:'Sin entrada','sharing-pending':'Por subir',ng:'NG'})[d.view.tone]||d.view.label)+'</span>',d.future)).join('');
        content.innerHTML='<div class="pc-summary"><span><b>'+alerts.length+'</b> días con incidencias</span><span><b>'+shared+'</b> días laborables con Facebook entregado</span><span><b>'+Number(data.horas||0).toFixed(1)+'</b> horas acumuladas registradas</span></div>'+
          '<p class="pc-attendance-totals">'+total('P')+' presentes · '+total('T')+' tardanzas · '+total('J')+' justificados</p>'+
          (unavailable?'<p class="pc-message">No hay información de Facebook para todas las fechas. No se puede confirmar su cumplimiento.</p>':'')+
          '<div class="pc-workspace"><section class="pc-month" aria-label="Calendario de '+escape(session.month)+'"><div class="pc-week" aria-hidden="true">'+['L','M','M','J','V','S','D'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="pc-grid">'+cells+'</div>'+
          '<p class="pc-legend"><span class="pc-red">Rojo: Facebook vencido o cierre incompleto</span><span>Azul: justificado</span><span>Verde: presente o compartido</span><span>Gris: sin jornada o fuera del contrato</span></p>'+
          '<details class="pc-alerts" '+(alerts.length?'open':'')+'><summary>Fechas para revisar ('+alerts.length+')</summary>'+
          (alerts.length?alerts.map(d=>button('data-pc-day="'+escape(d.fecha)+'"', '<b>'+escape(dateLabel(d.fecha))+'</b><span>'+escape(d.view.label)+'</span>')).join(''):'<p>No hay incidencias marcadas en este mes.</p>')+'</details></section>'+
          '<section class="pc-detail" data-pc-detail aria-label="Detalle de asistencia y evidencias"><p>Selecciona una fecha para consultar sus actividades.</p></section></div>';
        const initial=alerts[alerts.length-1]||session.days.find(d=>d.fecha===today)||session.days.filter(d=>!d.future).at(-1);
        if(initial)await selectDay(initial.fecha);
      }catch(error){
        if(!live()||version!==session.version)return;
        content.innerHTML='<p class="pc-message" role="alert">'+(error.message==='sin_permiso'?'No tienes permiso para consultar a esta persona.':'No se pudo cargar el calendario. Inténtalo nuevamente.')+'</p>'+button('data-pc-retry','Reintentar');
      }finally{if(live()&&version===session.version)content.removeAttribute('aria-busy');}
    }
    async function selectDay(date){
      const day=session.days.find(d=>d.fecha===date);if(!day||day.future)return;
      const version=++session.dayVersion;++session.fileVersion;session.selected=date;
      const detail=host.querySelector('[data-pc-detail]');session.groups=[];
      host.querySelectorAll('[data-pc-day]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pcDay===date)));
      const intro='<h4>'+escape(dateLabel(date))+'</h4><p class="pc-state '+escape(day.view.tone)+'">'+escape(day.view.label)+'</p><p>'+escape(day.view.reason)+'</p><p>'+escape(day.view.sharing)+'</p>';
      detail.innerHTML=intro+'<p role="status">Consultando entregas y archivos…</p>';detail.setAttribute('aria-busy','true');
      try{
        const {data,error}=await rpc('dash_equipo_dia_detalle',{p_colaborador:Number(person.id),p_fecha:date});
        if(!live()||version!==session.dayVersion)return;
        if(error||!data?.ok)throw new Error(data?.motivo||'load');
        const close=data.cierre||{};
        const justified=data.estado==='J'||close.justificado||close.estado==='justificado';
        const groups=teamDayActivities(data).filter(g=>day.scheduled?(!justified||g.key==='comparticiones'||g.completo):g.completo);
        session.groups=groups;
        const missing=groups.filter(g=>!g.completo).map(g=>g.titulo);
        if(day.scheduled&&close.aplica_jornada&&!justified&&!data.entrada_at)missing.unshift('Registro de entrada');
        if(day.scheduled&&close.aplica_jornada&&!justified&&close.requiere_salida!==false&&!data.salida_at)missing.push('Registro de salida');
        const absenceText=!day.scheduled?'No corresponde':justified?'No requerida · justificado':close.aplica_jornada?'Sin registro':'No corresponde';
        const notes=[day.nota,day.excepcion_nota,day.feriado_nota].filter(Boolean);
        const entryFiles=data.entrada_archivos||[];
        if(entryFiles.length)session.groups=[{titulo:'Evidencia de entrada',completo:true,files:entryFiles},...groups];
        detail.innerHTML=intro+
          '<dl class="pc-times">'+[['Entrada',data.entrada_at?clock(data.entrada_at):absenceText],['Salida',data.salida_at?clock(data.salida_at):absenceText],['Modalidad',({virtual:'Virtual',presencial:'Presencial'})[close.modalidad]||'No registrada'],['Horas',Number(data.horas||0).toFixed(1)+' h']].map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+escape(v)+'</dd></div>').join('')+'</dl>'+
          (notes.length?'<p class="pc-note">'+escape(notes.join(' · '))+'</p>':'')+
          '<div class="pc-pending"><b>'+ (!day.scheduled?'Sin jornada exigible':missing.length?'Falta registrar':'Sin evidencias pendientes')+'</b><p>'+escape(!day.scheduled?'Esta fecha no se evalúa como jornada laboral. Se conservan las evidencias que se hayan entregado.':missing.length?[...new Set(missing)].join(' · '):'Las entregas aplicables están registradas. Una entrega no implica que esté aprobada.')+'</p></div>'+
          '<div class="pc-activities">'+session.groups.map((g,i)=>'<details '+(!g.completo?'open':'')+'><summary><span>'+escape(g.titulo)+'</span><strong class="'+(g.completo?'pc-done':'pc-missing')+'">'+(g.completo?'Entregado':'Sin entrega')+'</strong></summary>'+
            (g.detalle?'<p>'+escape(g.detalle)+'</p>':'')+(g.fecha?'<p>Registrado: '+escape(clock(g.fecha))+'</p>':'')+
            (g.revision?'<p>Revisión: '+escape(({pendiente:'Pendiente de revisión',aprobada:'Aprobada',observada:'Requiere corrección'})[g.revision]||g.revision)+'</p>':'')+
            (g.files.length?button('data-pc-file="'+i+':0"','Ver archivos ('+g.files.length+')'):'<p>'+ (g.completo?'Registro sin archivos adjuntos.':'No hay evidencia subida para este requisito.')+'</p>')+'</details>').join('')+'</div>'+
          '<div data-pc-preview class="pc-preview" hidden></div>';
      }catch(error){
        if(!live()||version!==session.dayVersion)return;
        detail.innerHTML=intro+'<p role="alert">'+(error.message==='sin_permiso'?'No tienes permiso para consultar estas evidencias.':'No se pudo consultar el detalle. No es posible confirmar qué evidencias faltan.')+'</p>'+button('data-pc-day="'+escape(date)+'"','Reintentar detalle');
      }finally{if(live()&&version===session.dayVersion)detail.removeAttribute('aria-busy');}
    }
    async function showFile(value){
      const [gi,fi]=value.split(':').map(Number),group=session.groups?.[gi],file=group?.files?.[fi];
      if(!file)return;
      const version=++session.fileVersion,preview=host.querySelector('[data-pc-preview]');
      preview.hidden=false;preview.innerHTML='<p role="status">Abriendo evidencia…</p>';
      try{
        const {data,error}=await storage.from(file.bucket).createSignedUrl(file.path,900);
        if(!live()||version!==session.fileVersion)return;
        if(error||!data?.signedUrl)throw new Error('file');
        const url=escape(data.signedUrl),label=escape(group.titulo+' · archivo '+(fi+1));
        preview.innerHTML='<h5>'+label+'</h5>'+(file.mime?.startsWith('image/')?'<img src="'+url+'" alt="'+label+'">':file.mime?.startsWith('video/')?'<video controls playsinline src="'+url+'"></video>':'<p>Documento disponible para abrir o descargar.</p>')+
          '<a href="'+url+'" target="_blank" rel="noopener noreferrer">Abrir archivo completo</a><nav aria-label="Archivos de la entrega">'+
          button('data-pc-file="'+gi+':'+(fi-1)+'" aria-label="Archivo anterior"',chevron('left'),fi===0)+'<span>'+(fi+1)+' de '+group.files.length+'</span>'+
          button('data-pc-file="'+gi+':'+(fi+1)+'" aria-label="Archivo siguiente"',chevron('right'),fi===group.files.length-1)+'</nav>';
      }catch{
        if(live()&&version===session.fileVersion)preview.innerHTML='<p role="alert">No se pudo abrir el archivo.</p>'+button('data-pc-file="'+escape(value)+'"','Reintentar archivo');
      }
    }
    host.onclick=event=>{
      const b=event.target.closest('button');if(!b||b.disabled)return;
      if(b.hasAttribute('data-pc-back')){onBack?.();return;}
      if(b.hasAttribute('data-pc-day')){selectDay(b.dataset.pcDay);return;}
      if(b.hasAttribute('data-pc-file')){showFile(b.dataset.pcFile);return;}
      if(b.hasAttribute('data-pc-retry')){load();return;}
      if(b.hasAttribute('data-pc-current')){session.month=today.slice(0,7);load();return;}
      if(b.hasAttribute('data-pc-shift')){session.month=shift(session.month,Number(b.dataset.pcShift));load();}
    };
    host.onchange=event=>{
      if(!event.target.matches('[data-pc-month]'))return;
      const value=event.target.value;
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||value<'2020-01'||value>today.slice(0,7)){event.target.value=session.month;return;}
      session.month=value;load();
    };
    return load();
  }
  root.KJAPersonCalendar={mount,daysView,shift};
})(typeof globalThis==='undefined'?window:globalThis);
