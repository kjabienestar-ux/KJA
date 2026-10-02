/* Detalle de un día: consulta autorizada y visor privado con URLs temporales. */
(function(root){
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time=value=>value?new Date(value).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'}):'Sin registro';
  const revision=value=>({pendiente:'Pendiente de revisión',aprobada:'Aprobada',observada:'Requiere corrección'})[value]||value;
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/></svg>';
  const glyph=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
  const activityIcon=key=>glyph(({entrada:'M14 4h5v16h-5M3 12h12M10 7l5 5-5 5',salida:'M10 4H5v16h5M9 12h12M16 7l5 5-5 5',comparticiones:'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 10l6-4M9 14l6 4'})[key]||'M8 3h8l4 4v14H4V3h4M8 11h8M8 15h6');
  function groupsFor(data,day){
    const close=data.cierre||{},justified=data.estado==='J'||close.justificado||close.estado==='justificado';
    return [{key:'entrada',titulo:'Registro de entrada',completo:!!data.entrada_at,fecha:data.entrada_at,files:data.entrada_archivos||[],entregas:[],waived:!day.laborable||justified||close.aplica_jornada===false},
      ...teamDayActivities(data).map(group=>({...group,
        waived:!day.laborable||(justified&&group.key!=='comparticiones')||(group.key==='salida'&&close.requiere_salida===false),
        entregas:(data.entregas||[]).filter(item=>(item.asignacion_id!=null?'asignado-'+item.asignacion_id:item.tipo)===group.key)
      }))];
  }
  function mount(host,{person,day,future=false,rpc=(name,args)=>db.rpc(name,args),storage=db.storage}){
    const session={groups:[],version:0,fileVersion:0,disposed:false};
    host._monthDayDetail=session;
    const live=()=>!session.disposed&&host.isConnected&&host._monthDayDetail===session;
    const button=(attrs,label)=>'<button type="button" '+attrs+'>'+label+'</button>';
    async function load(){
      const version=++session.version;++session.fileVersion;
      session.groups=[];
      host.setAttribute('aria-busy','true');
      host.innerHTML='<p class="md-loading" role="status">Consultando registros, entregas y evidencias…</p>';
      if(future){host.innerHTML='<p class="md-empty">Fecha futura. Todavía no corresponde evaluar las entregas de este día.</p>';host.removeAttribute('aria-busy');return;}
      try{
        const {data,error}=await rpc('dash_equipo_dia_detalle',{p_colaborador:Number(person.id),p_fecha:day.fecha});
        if(!live()||version!==session.version)return;
        if(error||!data?.ok)throw new Error(error?.code==='PGRST202'?'update':data?.motivo||'load');
        const close=data.cierre||{},justified=data.estado==='J'||close.justificado||close.estado==='justificado';
        const groups=groupsFor(data,day);session.groups=groups;
        const pending=groups.filter(g=>!g.completo&&!g.waived).map(g=>g.titulo);
        if(day.laborable&&!justified&&close.aplica_jornada&&close.requiere_salida!==false&&!data.salida_at)pending.push('Registro de salida');
        const fileCount=groups.reduce((n,g)=>n+g.files.length,0);
        const noMark=!day.laborable?'No corresponde':justified?'No requerida · justificado':'Sin registro';
        const entries=[['Entrada',data.entrada_at?time(data.entrada_at):noMark],['Salida',data.salida_at?time(data.salida_at):noMark],['Tiempo registrado',data.horas==null?'Sin horas registradas':Number(data.horas).toFixed(1)+' h']];
        host.innerHTML='<div class="md-record-summary"><dl class="md-timeline">'+entries.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl>'+
          '<div class="md-compliance '+(pending.length?'has-pending':'')+'"><strong>'+(!day.laborable?'Día sin jornada exigible':pending.length?'Pendientes de la jornada':'Requisitos aplicables registrados')+'</strong><p>'+escape(!day.laborable?'Se conservan las entregas y archivos registrados en esta fecha.':pending.length?[...new Set(pending)].join(' · '):'Una entrega registrada no implica que haya sido aprobada.')+'</p></div></div>'+
          '<div class="md-workspace"><section class="md-deliveries" aria-label="Entregas y requisitos"><header><h3>Entregas y evidencias</h3><span>'+fileCount+' '+(fileCount===1?'archivo':'archivos')+'</span></header><p class="md-help">Consulta cada actividad y selecciona sus archivos para revisarlos.</p>'+
          groups.map((g,i)=>'<details class="md-activity" data-md-group="'+i+'" open><summary><span class="md-activity-icon">'+activityIcon(g.key)+'</span><span class="md-activity-label"><b>'+escape(g.titulo)+'</b><small>'+g.files.length+' '+(g.files.length===1?'archivo':'archivos')+'</small></span><em class="'+(g.completo?'done':g.waived?'waived':'pending')+'">'+(g.completo?'Registrado':g.waived?'No exigible':'Sin entrega')+'</em></summary><div class="md-activity-body">'+
            (g.revision?'<p class="md-review">Revisión: <b>'+escape(revision(g.revision))+'</b></p>':'')+
            (g.detalle&&!g.entregas.length?'<p>'+escape(g.detalle)+'</p>':'')+
            (g.entregas.length?g.entregas.map(item=>'<div class="md-delivery-note"><small>Entrega registrada · '+escape(time(item.completado_at))+'</small>'+(item.detalle?'<p>'+escape(item.detalle)+'</p>':'')+'</div>').join(''):g.fecha?'<p>Registrado a las '+escape(time(g.fecha))+'</p>':'')+
            (g.files.length?'<div class="md-files">'+g.files.map((file,f)=>button('class="md-file" data-md-file="'+i+':'+f+'" aria-pressed="false"',icon+'<span>Archivo '+(f+1)+'<small>'+escape(file.mime?.startsWith('image/')?'Imagen':file.mime?.startsWith('video/')?'Video':file.mime==='application/pdf'?'PDF':'Documento')+'</small></span>')).join('')+'</div>':'<p class="md-help">'+(g.completo?'Registro sin archivos adjuntos.':g.waived?'Este requisito no se exige para esta jornada.':'No hay evidencia registrada para esta actividad.')+'</p>')+'</div></details>').join('')+'</section>'+
          '<section class="md-preview" data-md-preview aria-label="Visor de evidencia"><p class="md-empty">'+(fileCount?'Selecciona un archivo para ver su evidencia.':'No hay archivos adjuntos en esta fecha.')+'</p></section></div>';
        const first=groups.findIndex(g=>g.files.length);
        if(first>=0)void showFile(first+':0');
      }catch(error){
        if(!live()||version!==session.version)return;
        host.innerHTML='<div class="md-error" role="alert"><h3>Detalle no disponible</h3><p>'+escape(error.message==='sin_permiso'?'Tu rol no permite consultar estas evidencias.':error.message==='update'?'La consulta de evidencias requiere la migración 81.':'No se pudieron consultar las entregas. No es posible confirmar qué evidencias faltan.')+'</p>'+button('data-md-retry','Reintentar consulta')+(day.evidencia_path&&error.message!=='sin_permiso'?button('data-month-action="evidence"','Ver evidencia de entrada'):'')+'</div>';
      }finally{if(live()&&version===session.version)host.removeAttribute('aria-busy');}
    }
    async function showFile(value){
      const [gi,fi]=value.split(':').map(Number),group=session.groups[gi],file=group?.files[fi];
      if(!file||!live())return;
      const version=++session.fileVersion,preview=host.querySelector('[data-md-preview]');
      host.querySelectorAll('[data-md-file]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mdFile===value)));
      host.querySelectorAll('[data-md-group]').forEach(item=>item.dataset.active=String(Number(item.dataset.mdGroup)===gi));
      preview.setAttribute('aria-busy','true');preview.innerHTML='<p class="md-loading" role="status">Abriendo evidencia privada…</p>';
      try{
        const {data,error}=await storage.from(file.bucket).createSignedUrl(file.path,900);
        if(!live()||version!==session.fileVersion)return;
        if(error||!data?.signedUrl)throw new Error('file');
        const url=escape(data.signedUrl),label=escape(group.titulo+' · archivo '+(fi+1));
        const gallery=session.groups.flatMap((g,i)=>g.files.map((f,j)=>i+':'+j)),position=gallery.indexOf(value);
        preview.innerHTML='<header><span class="md-preview-icon">'+activityIcon(group.key)+'</span><div><h3>'+escape(group.titulo)+'</h3><small>Archivo '+(fi+1)+' de '+group.files.length+' en esta actividad</small></div><span class="md-gallery-count">'+(position+1)+' / '+gallery.length+'</span></header><div class="md-media">'+
          (file.mime?.startsWith('image/')?'<img src="'+url+'" alt="'+label+'">':file.mime?.startsWith('video/')?'<video controls playsinline preload="metadata" src="'+url+'"></video>':'<div class="md-document">'+icon+'<p>'+escape(file.mime==='application/pdf'?'Documento PDF':'Documento adjunto')+'</p><p>Abre el archivo completo para consultar su contenido.</p></div>')+'</div>'+
          '<div class="md-preview-footer"><nav class="md-file-nav" aria-label="Todas las evidencias del día">'+button('data-md-file="'+(gallery[position-1]||'')+'" '+(position===0?'disabled':''),glyph('m14 6-6 6 6 6')+'<span>Anterior</span>')+button('data-md-file="'+(gallery[position+1]||'')+'" '+(position===gallery.length-1?'disabled':''),'<span>Siguiente</span>'+glyph('m10 6 6 6-6 6'))+'</nav><a class="md-open-file" href="'+url+'" target="_blank" rel="noopener noreferrer">Abrir original '+glyph('M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7')+'</a></div><p class="md-private">'+glyph('M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4')+'Evidencia privada · acceso temporal de 15 minutos</p>';
      }catch{
        if(live()&&version===session.fileVersion)preview.innerHTML='<p role="alert">No se pudo abrir esta evidencia.</p>'+button('data-md-file="'+escape(value)+'"','Reintentar archivo');
      }finally{if(live()&&version===session.fileVersion)preview.removeAttribute('aria-busy');}
    }
    host.onclick=event=>{
      const b=event.target.closest('button');if(!b||b.disabled)return;
      if(b.hasAttribute('data-md-file')){
        void showFile(b.dataset.mdFile);
        if(host.ownerDocument?.defaultView?.matchMedia('(max-width:760px)').matches)host.querySelector('[data-md-preview]')?.scrollIntoView({block:'nearest'});
      }
      if(b.hasAttribute('data-md-retry'))void load();
    };
    return {ready:load(),dispose(){session.disposed=true;session.fileVersion++;session.version++;host._monthDayDetail=null;host.onclick=null;}};
  }
  root.KJAMonthDayDetail={mount,groupsFor};
})(globalThis);
