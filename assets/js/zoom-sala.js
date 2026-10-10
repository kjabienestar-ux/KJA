/* Human-operated pilot. Tokens are held only in memory, never in URLs or logs. */
(function(){
 const $=id=>document.getElementById(id);
 const db=supabase.createClient('https://xadxmfgdxwplmhijagix.supabase.co','sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'kja-dashboard-auth'}});
 const version='5.1.4';
 let connected=false,working=false,sdkPromise=null,refreshTimer=null,epoch=0,roomsKnown=false,roomStatus=null,checking=false;
 let accessMeetings=[],accessAdmin=false,accessCandidates=null;
 const message=text=>$('sdk-message').textContent=text;
 const mobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
 async function edge(body){
 const {data,error}=await db.functions.invoke('zoom-reuniones',{body});
 if(error){let text='No se pudo conectar. Vuelve a intentarlo.';try{text=(await error.context.json()).error||text;}catch{}throw Error(text);}
 if(!data?.ok)throw Error('No se recibió confirmación.');return data;
 }
 async function load(){
 const data=await edge({action:'sdk-list'});
 const previous=$('sdk-meeting').value;accessAdmin=data.admin===true;accessMeetings=data.meetings||[];accessCandidates=Array.isArray(data.candidates)?data.candidates:null;
 $('sdk-delegation').hidden=!data.admin;$('sdk-meetings').replaceChildren();$('sdk-meeting').replaceChildren();
 const selected=new URL(location.href).searchParams.get('meeting');
 const meetings=selected?data.meetings.filter(row=>row.id===selected):data.meetings;
 for(const row of meetings){
 const article=document.createElement('article'),title=document.createElement('h3'),note=document.createElement('p');
 article.className='sdk-meeting';
 const content=document.createElement('div');content.className='sdk-meeting-copy';
 const label=document.createElement('span');label.className='sdk-availability'+(row.pilot?' is-enabled':'');
 label.textContent=row.pilot?'Habilitada para el piloto':'Fuera del piloto';
 title.textContent=row.topic;
 note.className='sdk-meeting-note';
 note.textContent=!row.pilot?'Esta reunión aún no está habilitada para iniciar desde aquí.':!data.configured?'Configuración pendiente de Sistemas.':mobile()?'Prueba en iPhone: mantén esta ventana abierta mientras se preparan las salas.':'Se iniciará aquí y se intentarán abrir las salas existentes.';
 content.append(label,title,note);article.append(content);
 const actions=document.createElement('div');actions.className='sdk-meeting-action';
 const start=button('Iniciar y abrir salas',()=>startMeeting(row));
 start.disabled=!row.pilot||!data.configured;actions.append(start);article.append(actions);
 if(data.admin){
 const people=document.createElement('div');people.className='sdk-operators';
 const caption=document.createElement('span');caption.className='sdk-operators-label';caption.textContent='Responsables';
 const list=document.createElement('ul');
 for(const email of row.operators.length?row.operators:['Solo Sistemas']){
 const item=document.createElement('li');item.textContent=email;list.append(item);
 }
 people.append(caption,list);article.append(people);
 }
 $('sdk-meetings').append(article);
 const option=document.createElement('option');option.value=row.id;option.textContent=row.topic;$('sdk-meeting').append(option);
 }
 if(meetings.some(row=>row.id===previous))$('sdk-meeting').value=previous;
 else if(meetings.length)$('sdk-meeting').value=meetings[0].id;
 renderAccess();
 if(!meetings.length)$('sdk-meetings').textContent='No tienes reuniones autorizadas. Sistemas debe asignarte el permiso Administrar Zoom.';
 message(data.configured?'Piloto listo para probar. La reunión se inicia solo al pulsar el botón.':'Sistemas debe configurar las credenciales Meeting SDK y el ID de una reunión de ensayo.');
 }
 function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(Error('No se pudo cargar Zoom. Recarga esta página.'));document.head.append(el);});}
 function loadSDK(){
 if(!sdkPromise)sdkPromise=(async()=>{
 for(const name of ['react','react-dom','redux','redux-thunk','lodash'])await script('https://source.zoom.us/'+version+'/lib/vendor/'+name+'.min.js');
 await script('https://source.zoom.us/zoom-meeting-'+version+'.min.js');
 ZoomMtg.setZoomJSLib('https://source.zoom.us/'+version+'/lib','/av');
 ZoomMtg.preLoadWasm();ZoomMtg.prepareWebSDK();
 })();
 return sdkPromise;
 }
 function call(method,args={}){
 return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('Zoom no confirmó la operación. Consulta el estado antes de repetir.')),30000);
 const done=value=>{clearTimeout(timer);resolve(value);};
 const fail=()=>{clearTimeout(timer);reject(Error('Zoom rechazó la operación. Comprueba tu rol de anfitrión y el panel de salas.'));};
 try{const result=ZoomMtg[method]({...args,success:done,error:fail});
 if(result&&typeof result.then==='function')result.then(done,fail);
 else if(method==='getBreakoutRoomStatus'&&typeof result==='number')done(result);
 }catch{fail();}
 });
 }
 async function refreshRooms(){
 if(checking)return;checking=true;
 $('sdk-check').disabled=true;$('sdk-check').textContent='Consultando…';
 $('sdk-live-status').textContent='Consultando salas y su estado en Zoom…';
 roomsKnown=false;roomStatus=null;$('sdk-open').disabled=true;$('sdk-rooms').replaceChildren();
 try{
 const raw=await call('getBreakoutRooms');
 const list=Array.isArray(raw)?raw:Array.isArray(raw?.result)?raw.result:raw?.result?.rooms||raw?.rooms;
 if(!Array.isArray(list))throw Error('Consulta la lista en el panel de salas de Zoom; no se pudo interpretar su respuesta.');
 roomsKnown=list.length>0;
 for(const room of list){const li=document.createElement('li');li.textContent=room.name||room.roomName||'Sala sin nombre';$('sdk-rooms').append(li);}
 const status=await call('getBreakoutRoomStatus');
 const value=typeof status==='number'?status:status?.result?.status??status?.status??status?.result;
 roomStatus=[1,2,3,4].includes(value)?value:null;
 const names={1:'Todavía sin abrir',2:'Abiertas',3:'Cerrando',4:'Cerradas'};
 $('sdk-live-status').textContent=list.length+' salas · '+(names[roomStatus]||'Estado no confirmado')+'.';
 if(!list.length)$('sdk-live-status').textContent='No hay salas cargadas. Revisa o recupera la preasignación en el panel de Zoom.';
 $('sdk-open').disabled=working||!roomsKnown||![1,4].includes(roomStatus);
 }catch(error){$('sdk-live-status').textContent=error.message;}finally{checking=false;$('sdk-check').disabled=working;$('sdk-check').textContent=working?'Preparando salas…':'Consultar salas';}
 }
 async function openRooms(current){
 if(current!==epoch||!connected||!roomsKnown||![1,4].includes(roomStatus))return;
 $('sdk-open').disabled=true;
 await call('openBreakoutRooms',{options:{isAutoJoinRoom:false,isBackToMainSessionEnabled:true,isTimerEnabled:false,needCountDown:true,waitSeconds:60}});
 // Success means the request was accepted; only status 2 confirms opening.
 for(let attempt=0;attempt<10&&current===epoch;attempt++){
 await refreshRooms();if(current!==epoch)return;if(roomStatus===2)return;
 await new Promise(resolve=>setTimeout(resolve,1500));
 }
 if(current===epoch)$('sdk-live-status').textContent='Apertura solicitada, pero Zoom aún no confirma las salas abiertas. Consulta el estado o revisa el panel de salas de Zoom.';
 }
 async function prepareRooms(current){
 for(let attempt=0;attempt<10&&current===epoch;attempt++){
 await refreshRooms();if(current!==epoch)return;
 if(roomStatus===2)return;
 if(roomsKnown&&[1,4].includes(roomStatus)){await openRooms(current);return;}
 await new Promise(resolve=>setTimeout(resolve,1500));
 }
 if(current===epoch)$('sdk-live-status').textContent=roomsKnown?'Las salas están cargadas, pero Zoom no confirmó un estado que permita abrirlas. Pulsa Consultar salas o revisa el panel de Zoom.':'La reunión está iniciada, pero no se pudieron preparar las salas. Consulta el panel de Zoom para recuperar la preasignación o usa una computadora.';
 }
 async function startMeeting(row){
 if(working||connected||!row.pilot)return;
 const current=epoch;working=true;
 $('sdk-lobby').querySelectorAll('button').forEach(b=>b.disabled=true);
 message('Preparando Zoom…');
 try{
 await loadSDK();
 const auth=await edge({action:'sdk-start',id:row.id});
 if(current!==epoch)throw Error('La sesión cambió. Vuelve al dashboard.');
 await call('init',{leaveUrl:new URL('zoom-sala.html',location.href).href,patchJsMedia:true});
 await call('join',{meetingNumber:auth.meetingNumber,signature:auth.signature,zak:auth.zak,passWord:auth.passWord,userName:auth.userName});
 auth.signature='';auth.zak='';auth.passWord='';
 if(current!==epoch){location.replace('dashboard.html');return;}
 connected=true;$('sdk-lobby').hidden=true;$('sdk-controls').hidden=false;$('sdk-controls').open=true;$('sdk-controls').querySelector('summary').focus();
 try{await prepareRooms(current);}catch(error){$('sdk-live-status').textContent=error.message+' La reunión sigue abierta; revisa las salas en Zoom.';}
 refreshTimer=setInterval(()=>{if(!working&&!checking&&!document.hidden)void refreshRooms();},15000);
 }catch(error){message(error.message+' Recarga la página antes de volver a iniciar.');const root=$('zmmtg-root');if(root)root.style.display='none';}
 finally{working=false;updateRoomButtons();if(!connected){$('sdk-grant').querySelector('button').disabled=false;}}
 }
 function updateRoomButtons(){
 $('sdk-check').disabled=working||checking;$('sdk-check').textContent=working?'Preparando salas…':checking?'Consultando…':'Consultar salas';
 $('sdk-open').disabled=working||checking||!connected||!roomsKnown||![1,4].includes(roomStatus);
 }
 $('sdk-check').onclick=()=>{if(!working&&!checking)void refreshRooms();};
 $('sdk-open').onclick=async()=>{
 if(working||checking||!connected||!roomsKnown||![1,4].includes(roomStatus))return;
 working=true;updateRoomButtons();
 try{await openRooms(epoch);}
 catch(error){$('sdk-live-status').textContent=error.message;}
 finally{working=false;updateRoomButtons();}
 };
 function renderAccess(){
 const row=accessMeetings.find(item=>item.id===$('sdk-meeting').value);
 const operators=accessAdmin?(row?.operators||[]):[];
 $('sdk-access-list').replaceChildren();$('sdk-access-count').textContent=operators.length+' asignado'+(operators.length===1?'':'s');
 const selected=$('sdk-email').value;
 const available=accessAdmin?(accessCandidates||[]).filter(person=>!operators.some(email=>email.toLowerCase()===person.email.toLowerCase())):[];
 $('sdk-email').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecciona un usuario';$('sdk-email').append(placeholder);
 for(const person of available){const option=document.createElement('option');option.value=person.email;option.textContent=person.nombre===person.email?person.email:person.nombre+' · '+person.email;$('sdk-email').append(option);}
 $('sdk-email').value=available.some(person=>person.email===selected)?selected:'';
 $('sdk-email').disabled=working||!available.length;
 $('sdk-candidates-note').textContent=accessCandidates===null?'Sistemas debe ejecutar la migración 112 para cargar los usuarios.':available.length?'Usuarios activos con acceso al panel administrativo.':'No hay otros usuarios administrativos disponibles para asignar.';
 $('sdk-grant').querySelector('button').disabled=working||!accessAdmin||!row||!available.length;
 if(!operators.length){const empty=document.createElement('li');empty.className='sdk-access-empty';empty.textContent='No hay responsables asignados a esta reunión.';$('sdk-access-list').append(empty);}
 for(const email of operators){
 const item=document.createElement('li');item.className='sdk-access-person';
 const avatar=document.createElement('span');avatar.className='sdk-access-avatar';avatar.textContent=email.slice(0,2).toUpperCase();
 const copy=document.createElement('div'),name=document.createElement('strong'),role=document.createElement('small');name.textContent=email;role.textContent='Puede iniciar y administrar esta reunión';copy.append(name,role);
 const remove=button('Quitar acceso',()=>changeAccess(email,false));remove.className='sdk-access-remove';remove.disabled=working;
 item.append(avatar,copy,remove);$('sdk-access-list').append(item);
 }
 }
 async function changeAccess(email,grant){
 if(working||!accessAdmin)return;
 if(grant&&!(accessCandidates||[]).some(person=>person.email===email)){ $('sdk-access-message').textContent='Selecciona un usuario de la lista.';return;}
 const id=$('sdk-meeting').value,current=epoch;if(!accessMeetings.some(row=>row.id===id))return;
 working=true;$('sdk-meeting').disabled=true;renderAccess();$('sdk-access-message').textContent=grant?'Guardando acceso…':'Retirando acceso…';
 try{
 const {error}=await db.rpc('dash_zoom_delegar',{p_id:id,p_email:email,p_otorgar:grant});
 if(current!==epoch)return;if(error)throw Error(error.message);
 await load();if(current!==epoch)return;
 $('sdk-access-message').textContent=grant?'Acceso concedido.':'Acceso retirado. Las sesiones ya abiertas no se cierran.';
 if(grant)$('sdk-email').value='';
 }catch(error){if(current===epoch)$('sdk-access-message').textContent=error.message;}
 finally{if(current===epoch){working=false;$('sdk-meeting').disabled=false;renderAccess();}}
 }
 $('sdk-meeting').onchange=()=>{$('sdk-access-message').textContent='';renderAccess();};
 $('sdk-grant').onsubmit=event=>{event.preventDefault();return changeAccess($('sdk-email').value.trim(),true);};
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){epoch++;connected=false;clearInterval(refreshTimer);location.replace('dashboard.html');}});
 (async()=>{try{
 const {data,error}=await db.auth.getUser();if(error||!data.user)throw Error('Inicia sesión en el dashboard y vuelve a esta página.');
 if(mobile())$('sdk-device').textContent='Prueba móvil: Zoom se abrirá dentro de este navegador. Mantén la página en primer plano; la apertura de salas en iPhone está pendiente de validación.';
 await load();
 }catch(error){message(error.message);}})();
 window.addEventListener('pagehide',()=>{epoch++;connected=false;clearInterval(refreshTimer);});
})();
