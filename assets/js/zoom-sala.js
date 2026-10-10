/* Human-operated pilot. Tokens are held only in memory, never in URLs or logs. */
(function(){
 const $=id=>document.getElementById(id);
 const db=supabase.createClient('https://xadxmfgdxwplmhijagix.supabase.co','sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'kja-dashboard-auth'}});
 const version='5.1.4';
 let connected=false,working=false,sdkPromise=null,refreshTimer=null,epoch=0,roomsKnown=false,roomStatus=null;
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
 $('sdk-delegation').hidden=!data.admin;$('sdk-meetings').replaceChildren();$('sdk-meeting').replaceChildren();
 for(const row of data.meetings){
 const article=document.createElement('article'),title=document.createElement('h3'),note=document.createElement('p');
 article.className='sdk-meeting';
 const content=document.createElement('div');content.className='sdk-meeting-copy';
 const label=document.createElement('span');label.className='sdk-availability'+(row.pilot?' is-enabled':'');
 label.textContent=row.pilot?'Habilitada para el piloto':'Fuera del piloto';
 title.textContent=row.topic;
 note.className='sdk-meeting-note';
 note.textContent=!row.pilot?'Esta reunión aún no está habilitada para iniciar desde aquí.':!data.configured?'Configuración pendiente de Sistemas.':mobile()?'Inicia desde una computadora.':'Se abrirá Zoom en esta misma ventana.';
 content.append(label,title,note);article.append(content);
 const actions=document.createElement('div');actions.className='sdk-meeting-action';
 const start=button('Iniciar reunión',()=>startMeeting(row));
 start.disabled=!row.pilot||!data.configured||mobile();actions.append(start);article.append(actions);
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
 if(!data.meetings.length)$('sdk-meetings').textContent='No tienes reuniones autorizadas. Sistemas debe asignarte el permiso Administrar Zoom.';
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
 roomsKnown=false;roomStatus=null;$('sdk-open').disabled=true;$('sdk-rooms').replaceChildren();
 try{
 const raw=await call('getBreakoutRooms');
 const list=Array.isArray(raw)?raw:Array.isArray(raw?.result)?raw.result:raw?.result?.rooms||raw?.rooms;
 if(!Array.isArray(list))throw Error('Consulta la lista en el panel de salas de Zoom; no se pudo interpretar su respuesta.');
 roomsKnown=list.length>0;
 for(const room of list){const li=document.createElement('li');li.textContent=room.name||room.roomName||'Sala sin nombre';$('sdk-rooms').append(li);}
 const status=await call('getBreakoutRoomStatus');
 roomStatus=typeof status==='number'?status:status?.result;
 const names={1:'Todavía sin abrir',2:'Abiertas',3:'Cerrando',4:'Cerradas'};
 $('sdk-live-status').textContent=list.length+' salas · '+(names[roomStatus]||'Estado no confirmado')+'.';
 if(!list.length)$('sdk-live-status').textContent='No hay salas cargadas. Revisa o recupera la preasignación en el panel de Zoom.';
 $('sdk-open').disabled=!roomsKnown||![1,4].includes(roomStatus);
 }catch(error){$('sdk-live-status').textContent=error.message;}
 }
 async function startMeeting(row){
 if(working||connected||mobile()||!row.pilot)return;
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
 connected=true;$('sdk-lobby').hidden=true;$('sdk-controls').hidden=false;$('sdk-controls').querySelector('summary').focus();
 await refreshRooms();
 refreshTimer=setInterval(()=>{if(!working&&!document.hidden)void refreshRooms();},15000);
 }catch(error){message(error.message+' Recarga la página antes de volver a iniciar.');const root=$('zmmtg-root');if(root)root.style.display='none';}
 finally{working=false;if(!connected){$('sdk-grant').querySelector('button').disabled=false;}}
 }
 $('sdk-check').onclick=()=>{if(!working)void refreshRooms();};
 $('sdk-open').onclick=async()=>{
 if(working||!connected||!roomsKnown||![1,4].includes(roomStatus))return;
 working=true;$('sdk-open').disabled=true;
 try{await call('openBreakoutRooms',{options:{isAutoJoinRoom:false,isBackToMainSessionEnabled:true,isTimerEnabled:false,needCountDown:true,waitSeconds:60}});await refreshRooms();}
 catch(error){$('sdk-live-status').textContent=error.message;}
 finally{working=false;}
 };
 $('sdk-grant').onsubmit=async event=>{
 event.preventDefault();if(working)return;working=true;
 const submit=$('sdk-grant').querySelector('button');submit.disabled=true;
 try{
 const {error}=await db.rpc('dash_zoom_delegar',{p_id:$('sdk-meeting').value,p_email:$('sdk-email').value.trim(),p_otorgar:$('sdk-grant-action').value==='grant'});
 if(error)throw Error(error.message);await load();message('Permiso guardado.');$('sdk-email').value='';
 }catch(error){message(error.message);}finally{working=false;submit.disabled=false;}
 };
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){epoch++;clearInterval(refreshTimer);location.replace('dashboard.html');}});
 (async()=>{try{
 const {data,error}=await db.auth.getUser();if(error||!data.user)throw Error('Inicia sesión en el dashboard y vuelve a esta página.');
 if(mobile())$('sdk-device').textContent='Abre esta prueba en una computadora. El inicio de ensayo está deshabilitado en celulares y tabletas.';
 await load();
 }catch(error){message(error.message);}})();
 window.addEventListener('pagehide',()=>clearInterval(refreshTimer));
})();
