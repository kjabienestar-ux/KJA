/* Zoom workspace. Privileged operations are authorized again by the Edge Function. */
(function(){
 const $=id=>document.getElementById(id),M=window.KJAZoomModel;
 const camera='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-4v12l-6-4"/></svg>';
 let state={rows:[],areas:[],people:[],hosts:[],admin:false,busy:false,epoch:0,request:0,offset:0,editor:null,timer:null,loaded:false,weekOffset:0};
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const now=()=>Date.now()+state.offset;
 const eligible=()=>APP.identity.hasPersonal||(APP.identity.isSystem&&APP.access.rol==='direccion'&&APP.access.acceso_panel);
 function message(text){$('zoom-message').textContent=text||'';}
 function busy(value){state.busy=value;$('view-zoom').setAttribute('aria-busy',String(value));$('view-zoom').querySelectorAll('button,input,select').forEach(el=>el.disabled=value);if(!value)formVisibility();}
 async function edge(body){
 const {data,error}=await db.functions.invoke('zoom-reuniones',{body});
 if(error){let text='No se pudo conectar con Zoom. Actualiza la lista; si persiste, avisa a Sistemas.';try{text=(await error.context.json()).error||text;}catch{}throw Error(text);}
 if(!data?.ok)throw Error(data?.error||'No se recibió confirmación. Actualiza la lista antes de repetir el cambio.');return data;
 }
 function targetsLabel(row){
 if(row.audience==='all')return 'Todos los colaboradores';
 const ids=row.audience==='people'?row.person_ids:row.area_ids,source=row.audience==='people'?state.people:state.areas;
 return (ids||[]).map(id=>source.find(x=>String(x.id)===String(id))?.nombre||'Destinatario inactivo').join(', ');
 }

 function renderWeek(){
 const search=$('zoom-search').value.trim().toLocaleLowerCase('es');
 const week=M.weekSessions(state.rows.filter(r=>r.topic.toLocaleLowerCase('es').includes(search)),now(),state.weekOffset);
 const date=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'numeric',month:'long',year:'numeric'});
 const day=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'short'});
 const hour=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'numeric',minute:'2-digit'});
 $('zoom-week-range').textContent=date.format(week.start)+' – '+date.format(week.end-1);
 $('zoom-week-list').innerHTML=week.days.map(d=>'<li class="zoom-week-day"><h3>'+escape(day.format(d.time))+(d.key===M.dateKey(now())?' · Hoy':'')+'</h3><div>'+(
 d.sessions.map(s=>'<p class="zoom-week-session"><strong>'+escape(hour.format(s.time))+'</strong><span>'+escape(s.row.topic)+'<small>'+(s.ended?'Horario finalizado':s.time<=now()?'En horario':'Programada')+' · '+s.duration+' min</small></span></p>').join('')||'<p class="zoom-note">Sin sesiones en los datos sincronizados.</p>'
 )+'</div></li>').join('');
 }
 function render(){
 $('zoom-week').hidden=!state.loaded;
 if(state.loaded)renderWeek();
 const search=$('zoom-search').value.trim().toLocaleLowerCase('es');
 const rows=state.rows.filter(r=>r.topic.toLocaleLowerCase('es').includes(search)).map(r=>({row:r,session:M.nextSession(r,now())})).sort((a,b)=>(a.session.time??Infinity)-(b.session.time??Infinity));
 $('zoom-list').innerHTML=rows.map(({row:r,session:s})=>{
 const ready=r.status==='ready',id=escape(r.id);
 const status=ready?s.label:r.status==='pending'?'Operación pendiente':'Necesita revisión';
 const controls=state.admin?'<div class="zoom-row-admin">'+(ready?'<button type="button" data-zoom="edit" data-id="'+id+'">Editar</button>':'')+(r.zoom_id?'<button type="button" data-zoom="sync" data-id="'+id+'">Actualizar desde Zoom</button><button type="button" class="zoom-text-danger" data-zoom="cancel" data-id="'+id+'">Cancelar reunión</button>':'<button type="button" data-zoom="recover" data-id="'+id+'">Vincular ID para recuperar</button><button type="button" data-zoom="archive" data-id="'+id+'">Archivar solicitud</button>')+'</div>':'';
 return '<article class="zoom-row"><div class="zoom-row-main"><span class="zoom-row-icon">'+camera+'</span><div class="zoom-row-copy"><h3>'+escape(r.topic)+'</h3><p class="zoom-time">'+escape(status)+'</p>'+(state.admin?'<p class="zoom-note">'+escape(targetsLabel(r))+'</p><p class="zoom-note">'+escape(r.host_email||'Anfitrión pendiente')+(r.zoom_id?' · ID '+escape(r.zoom_id):'')+'</p>':'')+(!ready&&state.admin?'<p class="zoom-error">'+escape(r.last_error||'Actualiza desde Zoom después de dos minutos si la operación no termina.')+'</p>':'')+'</div>'+(ready?(state.admin?'<button type="button" class="zoom-primary zoom-join" data-zoom="start" data-id="'+id+'">'+camera+'Iniciar reunión</button>':(s.joinable||r.type===8)?'<button type="button" class="zoom-primary zoom-join" data-zoom="join" data-id="'+id+'">'+camera+'Unirme</button>':''):'')+'</div>'+controls+'</article>';
 }).join('')||'<div class="zoom-empty"><h3>'+(search?'No hay coincidencias':state.admin?'Todavía no hay reuniones':'No tienes reuniones asignadas')+'</h3><p>'+(search?'Prueba con otro nombre.':state.admin?'Vincula la reunión principal que ya usan en Zoom. Sus salas de grupo se conservan.':'Las reuniones generales y las de tu área aparecerán aquí cuando se publiquen.')+'</p></div>';
 const today=state.rows.filter(r=>r.status==='ready'&&(r.type===3||M.nextSession(r,now()).today)).length;
 $('zoom-home-access').querySelector('small').textContent=state.loaded?(today?today+' reunión'+(today===1?' disponible':'es disponibles')+' hoy':'Consulta tus salas y próximas reuniones'):'Consulta tus salas y horarios';
 }
 async function load(){
 if(!eligible()||state.busy)return;
 const request=++state.request,epoch=state.epoch;message('Consultando reuniones…');
 try{
 const {data,error}=await db.rpc('dash_zoom_listar');
 if(epoch!==state.epoch||request!==state.request)return;
 if(error||!data?.ok)throw Error(error?.code==='PGRST202'?'La sección de reuniones está pendiente de activación por Sistemas.':'No se pudieron consultar las reuniones. Actualiza la lista o vuelve a iniciar sesión.');
 state.admin=data.admin===true;state.rows=data.meetings||[];state.areas=data.areas||[];state.people=data.people||[];state.offset=Date.parse(data.now)-Date.now();state.loaded=true;
 $('zoom-new').hidden=!state.admin;$('zoom-import').hidden=!state.admin;$('zoom-connection').hidden=!state.admin;
 $('zoom-list-title').textContent=state.admin?'Reuniones vinculadas':'Mis reuniones';
 $('zoom-subtitle').textContent=state.admin?'Inicia la reunión habitual y conserva las salas de cada área.':'Entra a la reunión principal y continúa a la sala de tu área.';
 $('zoom-daily-flow').textContent=state.admin?'Uso diario: pulsa Iniciar reunión y, dentro de Zoom, Abrir todas las salas. Vincular e iniciar conserva las salas ya configuradas.':'Pulsa Unirme para entrar a la reunión principal. El anfitrión abrirá las salas; podrás elegir la de tu área si esa opción está habilitada o esperar su asignación.';
 $('zoom-footnote').textContent=state.admin?'Horarios en Lima. Los cambios hechos directamente en Zoom se recuperan con «Actualizar desde Zoom» en cada sala.':'Horarios en Lima. El botón abre Zoom; la admisión depende del anfitrión.';
 message('');render();
 if(state.admin&&!state.hosts.length)$('zoom-connection-text').textContent='Comprueba la conexión para cargar los anfitriones de la cuenta institucional.';
 }catch(error){if(epoch!==state.epoch||request!==state.request)return;state.rows=[];state.loaded=false;render();$('zoom-list').innerHTML='';message(error.message);}
 }
 async function hosts(){
 const list=[];let next='';
 do{const data=await edge({action:'hosts',next_page_token:next});list.push(...data.hosts);next=data.next_page_token;}while(next&&list.length<10000);
 if(next)throw Error('La cuenta tiene demasiados anfitriones para este selector. Contacta a Sistemas.');return list;
 }
 function fillHosts(){
 $('zoom-host').innerHTML='<option value="">Selecciona un anfitrión</option>'+state.hosts.map(h=>'<option value="'+escape(h.id)+'">'+escape(h.name||h.email)+' · '+escape(h.email)+(h.type===1?' (Básico)':'')+'</option>').join('');
 }
 function renderTargets(selected=[]){
 const kind=$('zoom-audience').value;const source=kind==='people'?state.people:state.areas;
 $('zoom-targets').hidden=kind==='all';
 $('zoom-targets').innerHTML=kind==='all'?'':source.map(t=>'<label><input type="checkbox" name="zoom-target" value="'+t.id+'" '+(selected.map(String).includes(String(t.id))?'checked':'')+'>'+escape(t.nombre)+'</label>').join('')||'<p>No hay destinatarios activos disponibles.</p>';
 }
 function formVisibility(){
 if(!state.editor)return;
 const importing=state.editor.mode==='import',editing=state.editor.mode==='update',schedule=$('zoom-schedule').value;
 $('zoom-id-field').hidden=!importing;$('zoom-remote-id').required=importing;
 $('zoom-topic-field').hidden=importing;$('zoom-topic').required=!importing;
 $('zoom-host-field').hidden=importing||editing;$('zoom-host').required=!importing&&!editing;
 $('zoom-schedule-field').hidden=importing;
 const timed=!importing&&schedule!=='keep';
 $('zoom-date-field').hidden=!timed;$('zoom-duration-field').hidden=!timed;
 $('zoom-date').required=timed;$('zoom-duration').required=timed;
 $('zoom-date').disabled=state.busy||!timed;$('zoom-duration').disabled=state.busy||!timed;
 $('zoom-weekly').hidden=importing||schedule!=='weekly';
 $('zoom-count').disabled=state.busy||importing||schedule!=='weekly';
 $('zoom-save').textContent=importing?'Vincular sala':editing?'Guardar cambios':'Crear en Zoom';
 }
 async function openForm(mode,row=null){
 if(!state.admin||state.busy)return;
 if(mode==='create'&&!state.hosts.length){
 const epoch=state.epoch;busy(true);message('Consultando anfitriones de Zoom…');
 try{const loaded=await hosts();if(epoch!==state.epoch)return;state.hosts=loaded;fillHosts();message('');}
 catch(error){if(epoch===state.epoch)message(error.message);return;}
 finally{if(epoch===state.epoch)busy(false);}
 }
 state.editor={mode,id:row?.id||crypto.randomUUID(),revision:row?.revision,row};
 $('zoom-form').reset();$('zoom-form-message').textContent='';
 $('zoom-form-title').textContent=mode==='import'?'Vincular reunión existente':mode==='update'?'Editar reunión':'Crear reunión';
 $('zoom-edit-note').textContent=mode==='update'?'Los cambios se aplican a toda la serie. Conserva la programación actual o elige una nueva fecha de inicio.':mode==='import'?'Usa el ID de la reunión principal. No se recrea ni se modifica en Zoom: conserva el enlace, las salas de grupo y su programación.':'Usa un nombre permanente; el portal mostrará el día y la hora de cada sesión.';
 $('zoom-topic').value=row?.topic||'';
 $('zoom-schedule').querySelector('[value="keep"]').disabled=mode==='create';
 $('zoom-schedule').value=mode==='update'?'keep':'weekly';
 $('zoom-duration').value=row?.duration||60;
 $('zoom-audience').value=row?.audience||'areas';
 renderTargets(row?.audience==='people'?row.person_ids:row?.area_ids||[]);
 if(row?.recurrence?.weekly_days)String(row.recurrence.weekly_days).split(',').forEach(d=>{const input=$('zoom-weekly').querySelector('[value="'+d+'"]');if(input)input.checked=true;});
 $('zoom-form').hidden=false;formVisibility();(mode==='import'?$('zoom-remote-id'):$('zoom-topic')).focus();$('zoom-form').scrollIntoView({block:'start'});
 }
 function closeForm(){if(state.busy)return;$('zoom-form').hidden=true;state.editor=null;$('zoom-import').focus();}
 async function mutate(body){
 const epoch=state.epoch;++state.request;busy(true);message('Guardando cambios…');
 try{await edge(body);if(epoch!==state.epoch)return false;message('Cambios guardados.');return true;}
 catch(error){if(epoch===state.epoch)message(error.message);return false;}
 finally{if(epoch===state.epoch)busy(false);}
 }
 $('zoom-form').addEventListener('submit',async event=>{
 event.preventDefault();if(state.busy||!state.editor)return;
 const editor=state.editor,epoch=state.epoch;
 const ids=Array.from($('zoom-targets').querySelectorAll('input:checked'),el=>Number(el.value));
 const body={action:editor.mode,id:editor.id,revision:editor.revision,topic:$('zoom-topic').value,host_id:$('zoom-host').value,zoom_id:$('zoom-remote-id').value,schedule:$('zoom-schedule').value,start_local:$('zoom-date').value,duration:Number($('zoom-duration').value),days:Array.from($('zoom-weekly').querySelectorAll('input:checked'),el=>Number(el.value)),count:Number($('zoom-count').value),audience:$('zoom-audience').value,area_ids:ids,person_ids:ids};
 $('zoom-form-message').textContent='Guardando…';
 const ok=await mutate(body);if(epoch!==state.epoch)return;
 if(ok){closeForm();await load();message('Reunión guardada. Los destinatarios ya pueden verla en su portal.');}
 else{const error=$('zoom-message').textContent;$('zoom-form-message').textContent=error;await load();message(error);}
 });
 $('zoom-list').addEventListener('click',async event=>{
 const button=event.target.closest('[data-zoom]');if(!button||state.busy)return;
 const row=state.rows.find(r=>r.id===button.dataset.id);if(!row)return;const action=button.dataset.zoom;
 if(action==='edit')return openForm('update',row);
 if(action==='recover')return openForm('import',row);
 if(action==='cancel'||action==='archive'){
 state.cancelAction=action;state.cancel=row;
 $('zoom-cancel-title').textContent=action==='archive'?'¿Archivar esta solicitud?':'¿Cancelar esta reunión?';
 $('zoom-cancel-explanation').textContent=action==='archive'?'Comprueba primero en Zoom si llegó a crearse. Archivar solo retira esta solicitud del portal; no elimina ninguna reunión de Zoom.':'Se eliminará de Zoom y dejará de aparecer en los portales. Si es recurrente, se cancelará toda la serie.';
 $('zoom-cancel-confirm').textContent=action==='archive'?'Archivar solicitud':'Sí, cancelar en Zoom';$('zoom-cancel-copy').textContent=row.topic;$('zoom-cancel-error').textContent='';$('zoom-cancel-dialog').showModal();return;
 }
 if(action==='join'||action==='start'){
 const epoch=state.epoch;busy(true);message(action==='join'?'Preparando acceso…':'Preparando acceso de anfitrión…');
 // Open during the gesture to avoid popup blockers; never give Zoom an opener.
 const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
 try{const data=await edge({action,id:row.id});if(epoch!==state.epoch){popup?.close();return;}const url=M.safeUrl(data.url);if(!url)throw Error('El acceso recibido no es válido. Actualiza la reunión.');
 if(popup)popup.location.replace(url);else window.location.assign(url);message(action==='start'?'Acceso de anfitrión abierto. Dentro de Zoom, pulsa Abrir todas las salas para habilitar los grupos.':'Acceso a la reunión principal abierto en Zoom.');}
 catch(error){popup?.close();if(epoch===state.epoch)message(error.message);}
 finally{if(epoch===state.epoch)busy(false);}return;
 }
 if(action==='sync'){
 const ok=await mutate({action,id:row.id,revision:row.revision}),text=$('zoom-message').textContent;await load();message(ok?'Reunión actualizada desde Zoom.':text);
 }
 });
 $('zoom-cancel-confirm').onclick=async()=>{
 const row=state.cancel;if(!row||state.busy)return;
 const ok=await mutate({action:state.cancelAction,id:row.id,revision:row.revision});
 if(ok){$('zoom-cancel-dialog').close();await load();message(state.cancelAction==='archive'?'Solicitud archivada.':'Reunión cancelada en Zoom.');}
 else{$('zoom-cancel-error').textContent=$('zoom-message').textContent;await load();state.cancel=state.rows.find(r=>r.id===row.id)||null;}
 };
 $('zoom-cancel-dialog').addEventListener('cancel',event=>{if(state.busy)event.preventDefault();});
 $('zoom-cancel-back').onclick=()=>{if(!state.busy)$('zoom-cancel-dialog').close();};
 $('zoom-connect').onclick=async()=>{
 if(state.busy)return;const epoch=state.epoch;busy(true);$('zoom-connection-text').textContent='Comprobando conexión…';
 try{const loaded=await hosts();if(epoch!==state.epoch)return;state.hosts=loaded;fillHosts();$('zoom-connection-text').textContent='Cuenta conectada · '+state.hosts.length+' anfitriones disponibles.';}
 catch(error){if(epoch===state.epoch)$('zoom-connection-text').textContent=error.message;}
 finally{if(epoch===state.epoch)busy(false);}
 };
 $('zoom-week-prev').onclick=()=>{state.weekOffset--;renderWeek();};
 $('zoom-week-next').onclick=()=>{state.weekOffset++;renderWeek();};
 $('zoom-week-today').onclick=()=>{state.weekOffset=0;renderWeek();};
 $('zoom-new').onclick=()=>openForm('create');$('zoom-import').onclick=()=>openForm('import');$('zoom-refresh').onclick=load;
 $('zoom-form-close').onclick=closeForm;$('zoom-form-cancel').onclick=closeForm;
 $('zoom-audience').onchange=()=>renderTargets();$('zoom-schedule').onchange=formVisibility;$('zoom-search').oninput=render;
 function reset(){
 clearInterval(state.timer);state.epoch++;state.request++;state.rows=[];state.areas=[];state.people=[];state.hosts=[];state.admin=false;state.editor=null;state.loaded=false;state.weekOffset=0;state.cancel=null;busy(false);
 $('zoom-week').hidden=true;$('zoom-week-list').innerHTML='';$('zoom-list').innerHTML='';$('zoom-form').reset();$('zoom-targets').innerHTML='';fillHosts();$('zoom-form').hidden=true;$('zoom-cancel-dialog').close();$('nav-zoom').hidden=true;$('zoom-home-access').hidden=true;
 $('zoom-new').hidden=true;$('zoom-import').hidden=true;$('zoom-connection').hidden=true;message('');
 }
 function init(){reset();const allowed=eligible();$('nav-zoom').hidden=!allowed;$('zoom-home-access').hidden=!APP.identity.hasPersonal;if(!allowed)return;
 void load();state.timer=setInterval(()=>{if(!document.hidden&&!state.busy&&!state.editor&&(APP.view==='zoom'||APP.view==='inicio'))void load();},60000);
 }
 window.KJAZoom={init,load,reset};
 // Also initialize when a fast restored session finished before this script loaded.
 if(APP.inicio&&APP.sessionUid&&eligible())init();
})();
