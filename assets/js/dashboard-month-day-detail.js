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
  async function facebookRequest(body){
    const {data:{session}}=await db.auth.getSession();
    if(!session)throw new Error('sesion');
    const response=await fetch(SUPABASE_URL+'/functions/v1/dash-entrega',{method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok||!result?.ok)throw new Error(result?.motivo||'conexion');
    return result;
  }
  function mount(host,{person,day,future=false,canManageFacebook=false,facebookOnly=false,rpc=(name,args)=>db.rpc(name,args),storage=db.storage,request=facebookRequest,prepare=file=>compressImage(file),managementHtml=''}){
    const session={groups:[],version:0,fileVersion:0,disposed:false,managementHtml};
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
        let groups=groupsFor(data,day);
        if(facebookOnly){
          groups=groups.filter(g=>g.key==='comparticiones');
          if(!groups.length)groups=[{key:'comparticiones',titulo:'Facebook',completo:false,files:[],entregas:[]}];
        }
        session.groups=groups;session.close=close;
        const pending=groups.filter(g=>!g.completo&&!g.waived).map(g=>g.titulo);
        if(day.laborable&&!justified&&close.aplica_jornada&&close.requiere_salida!==false&&!data.salida_at)pending.push('Registro de salida');
        const fileCount=groups.reduce((n,g)=>n+g.files.length,0);
        const noMark=!day.laborable?'No corresponde':justified?'No requerida · justificado':'Sin registro';
        const entries=[['Entrada',data.entrada_at?time(data.entrada_at):noMark],['Salida',data.salida_at?time(data.salida_at):noMark],['Tiempo registrado',data.horas==null?'Sin horas registradas':Number(data.horas).toFixed(1)+' h']];
        host.innerHTML=(facebookOnly?'':'<div class="md-record-summary"><dl class="md-timeline">'+entries.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl>'+
          '<div class="md-compliance '+(pending.length?'has-pending':'')+'"><strong>'+(!day.laborable?'Día sin jornada exigible':pending.length?'Pendientes de la jornada':'Requisitos aplicables registrados')+'</strong><p>'+escape(!day.laborable?'Se conservan las entregas y archivos registrados en esta fecha.':pending.length?[...new Set(pending)].join(' · '):'Una entrega registrada no implica que haya sido aprobada.')+'</p></div></div>')+
          '<div class="md-workspace"><section class="md-deliveries" aria-label="Entregas y requisitos"><header><h3>Entregas y evidencias</h3><span>'+fileCount+' '+(fileCount===1?'archivo':'archivos')+'</span></header><p class="md-help">Consulta cada actividad y selecciona sus archivos para revisarlos.</p>'+
          groups.map((g,i)=>'<details class="md-activity" data-md-group="'+i+'" open><summary><span class="md-activity-icon">'+activityIcon(g.key)+'</span><span class="md-activity-label"><b>'+escape(g.titulo)+'</b><small>'+g.files.length+' '+(g.files.length===1?'archivo':'archivos')+'</small></span><em class="'+(g.completo?'done':g.waived?'waived':'pending')+'">'+(g.completo?'Registrado':g.waived?'No exigible':'Sin entrega')+'</em></summary><div class="md-activity-body">'+
            (g.revision?'<p class="md-review">Revisión: <b>'+escape(revision(g.revision))+'</b></p>':'')+
            (g.detalle&&!g.entregas.length?'<p>'+escape(g.detalle)+'</p>':'')+
            (g.entregas.length?g.entregas.map(item=>'<div class="md-delivery-note"><small>Entrega registrada · '+escape(time(item.completado_at))+'</small>'+(item.detalle?'<p>'+escape(item.detalle)+'</p>':'')+'</div>').join(''):g.fecha?'<p>Registrado a las '+escape(time(g.fecha))+'</p>':'')+
            (g.files.length?'<div class="md-files">'+g.files.map((file,f)=>{
              const isFb=canManageFacebook&&g.key==='comparticiones';
              const fileBtn=button('class="md-file '+(isFb?'has-remove':'')+'" data-md-file="'+i+':'+f+'" aria-pressed="false"',icon+'<span>Archivo '+(f+1)+'<small>'+escape(file.mime?.startsWith('image/')?'Imagen':file.mime?.startsWith('video/')?'Video':file.mime==='application/pdf'?'PDF':'Documento')+'</small></span>');
              if(!isFb)return fileBtn;
              return '<div class="md-file-chip">'+fileBtn+button('class="md-file-remove-btn md-remove-facebook" data-md-remove="'+i+':'+f+'" title="Quitar imagen '+(f+1)+'" aria-label="Quitar imagen '+(f+1)+'"',glyph('M18 6 6 18M6 6l12 12'))+'</div>';
            }).join('')+'</div>':'<p class="md-help">'+(g.completo?'Registro sin archivos adjuntos.':g.waived?'Este requisito no se exige para esta jornada.':'No hay evidencia registrada para esta actividad.')+'</p>')+'</div></details>').join('')+'</section>'+
          '<div class="md-side-pane"><section class="md-preview" data-md-preview aria-label="Visor de evidencia"><p class="md-empty">'+(fileCount?'Selecciona un archivo para ver su evidencia.':'No hay archivos adjuntos en esta fecha.')+'</p></section>'+
          (session.managementHtml?'<section class="md-management">'+session.managementHtml+'</section>':'')+'</div></div>';
        const first=groups.findIndex(g=>g.files.length);
        if(canManageFacebook){
          const gi=groups.findIndex(g=>g.key==='comparticiones'),group=groups[gi];
          const body=host.querySelector('[data-md-group="'+gi+'"] .md-activity-body');
          if(body&&group){
            body.insertAdjacentHTML('beforeend','<div class="md-facebook-actions">'+
              (group.files.length?'<div class="md-facebook-fallback-actions" style="display:none">'+group.files.map((file,index)=>button('class="md-remove-facebook" data-md-remove="'+gi+':'+index+'"','Quitar imagen '+(index+1))).join('')+'</div>':
                '<label class="md-upload-label">Subir nuevas evidencias<input type="file" data-md-upload accept="image/jpeg,image/png,image/webp" multiple></label><p class="md-upload-help">Selecciona las capturas (hasta 50). La carga comienza al seleccionarlas.</p>')+
              '<div data-md-confirm hidden class="md-confirm-box" role="alert"><div class="md-confirm-header"><span class="md-confirm-icon">⚠️</span><strong>¿Quitar esta imagen?</strong></div><p data-md-confirm-copy>¿Deseas quitar esta imagen? Se eliminará permanentemente. Al quitar la última se anula la entrega.</p><div class="md-confirm-actions">'+button('data-md-confirm-delete class="md-confirm-btn"','Sí, quitar imagen')+button('data-md-cancel-delete class="md-cancel-btn"','Cancelar')+'</div></div><p data-md-status role="status"></p></div>');
          }
        }
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
    const status=text=>{if(live()){const node=host.querySelector('[data-md-status]');if(node)node.textContent=text;}};
    const busy=value=>{
      session.busy=value;
      host.querySelectorAll('.md-facebook-actions button,.md-facebook-actions input').forEach(node=>node.disabled=value);
    };
    const failure=error=>({limpieza_pendiente:'La imagen fue retirada, pero falta borrar el archivo. Pulsa Eliminar imagen para reintentar.',migracion_eliminar:'Falta aplicar la migración 102 y actualizar dash-entrega.',sin_permiso:'Tu sesión no permite modificar estas evidencias.',ya_completo:'Ya existe una entrega. Vuelve a abrir este día para consultar sus evidencias.',sesion:'Tu sesión venció. Vuelve a iniciar sesión.',datos:'La carga solo admite fechas dentro de los últimos 180 días.',colaborador:'La carga requiere un colaborador activo.',no_programado:'Facebook no está programado para esta persona en esta fecha.',no_habilitado:'La carga de evidencias no está habilitada para esta fecha.'})[error.message]||'No se pudo completar la operación. Inténtalo nuevamente.';
    async function remove(){
      if(!canManageFacebook||session.busy||!session.target)return;
      const {file,delivery}=session.target;busy(true);status('Eliminando imagen…');
      try{
        await request({accion:'admin_eliminar_imagen_facebook',entrega:delivery.id,path:file.path});
        if(live()){session.target=null;await load();status('Imagen eliminada.');}
      }catch(error){
        if(live()&&['archivo_ajeno','sin_entrega'].includes(error.message)){
          session.target=null;await load();status('La evidencia cambió o ya fue retirada. Se actualizó el detalle del día.');
        }else status(failure(error));
      }finally{if(live())busy(false);}
    }
    host.onchange=async event=>{
      if(!event.target.matches('[data-md-upload]')||!canManageFacebook||session.busy)return;
      const files=Array.from(event.target.files||[]),min=Number(session.close?.comparticiones_min||1);
      if(!files.length)return;
      if(files.length<min||files.length>50||files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>25*1024*1024)){
        status('Selecciona entre '+min+' y 50 imágenes JPG, PNG o WebP, de hasta 25 MB cada una.');event.target.value='';return;
      }
      busy(true);
      try{
        const paths=[];
        for(const [index,file] of files.entries()){
          if(!live())return;
          status('Subiendo imagen '+(index+1)+' de '+files.length+'…');
          const blob=await prepare(file);
          if(!live())return;
          const permit=await request({accion:'admin_cargar',colaborador:Number(person.id),fecha:day.fecha,requisito:'comparticiones',asignacion:null,modalidad:'individuales',ext:'jpg'});
          const {error}=await storage.from('asis-cierre-evidencias').uploadToSignedUrl(permit.ruta,permit.token,blob,{contentType:'image/jpeg'});
          if(error)throw error;
          paths.push(permit.ruta);
        }
        if(!live())return;
        const {data,error}=await rpc('dash_admin_confirmar_entrega',{p_colaborador:Number(person.id),p_fecha:day.fecha,p_requisito:'comparticiones',p_asignacion:null,p_modalidad:'individuales',p_paths:paths,p_detalle:'Evidencias de Facebook actualizadas por Dirección.',p_hora_salida:null});
        if(error||!data?.ok)throw new Error(data?.motivo||'registro');
        if(live()){await load();status('Nuevas evidencias guardadas.');}
      }catch(error){status(failure(error));}finally{if(live()){busy(false);const input=host.querySelector('[data-md-upload]');if(input)input.value='';}}
    };
    host.onclick=event=>{
      const b=event.target.closest('button');if(!b||b.disabled)return;
      if(canManageFacebook&&!session.busy&&b.hasAttribute('data-md-remove')){
        const [gi,fi]=b.dataset.mdRemove.split(':').map(Number),group=session.groups[gi],file=group?.files[fi];
        const delivery=group?.entregas.find(item=>item.archivos?.some(saved=>saved.path===file?.path));
        if(delivery&&file){
          session.target={file,delivery};
          host.querySelectorAll?.('.md-file-chip')?.forEach(c=>c.removeAttribute('data-target-delete'));
          const targetChip=b.closest?.('.md-file-chip');
          if(targetChip)targetChip.setAttribute('data-target-delete','true');
          host.querySelector('[data-md-confirm-copy]').textContent='¿Deseas quitar la imagen '+(fi+1)+'? Se eliminará permanentemente. Al quitar la última se anula la entrega. Solo podrás subir reemplazos si este día admite nuevas cargas.';
          host.querySelector('[data-md-confirm]').hidden=false;
          host.querySelector('[data-md-cancel-delete]').focus();
        }
      }
      if(b.hasAttribute('data-md-cancel-delete')){
        session.target=null;
        host.querySelectorAll?.('.md-file-chip')?.forEach(c=>c.removeAttribute('data-target-delete'));
        host.querySelector('[data-md-confirm]').hidden=true;
        status('');
      }
      if(b.hasAttribute('data-md-confirm-delete'))void remove();
      if(b.hasAttribute('data-md-file')){
        void showFile(b.dataset.mdFile);
        if(host.ownerDocument?.defaultView?.matchMedia('(max-width:760px)').matches)host.querySelector('[data-md-preview]')?.scrollIntoView({block:'nearest'});
      }
      if(b.hasAttribute('data-md-retry'))void load();
    };
    return {ready:load(),dispose(){session.disposed=true;session.fileVersion++;session.version++;host._monthDayDetail=null;host.onclick=null;host.onchange=null;}};
  }
  root.KJAMonthDayDetail={mount,groupsFor};
})(globalThis);
