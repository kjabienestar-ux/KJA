/* One observer per browser session. Only explicit SDK media states are saved. */
(function(root){
 const M=root.KJAZoomCameraModel;
 async function rpc(db,name,args){
  const controller=new AbortController();let timer;
  try{
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('El guardado está tardando. Se reintentará con una observación nueva.'));},10000);});
   const query=db.rpc(name,args).abortSignal(controller.signal);
   const {data,error}=await Promise.race([query,deadline]);
   if(error||!data?.ok)throw Error(error?.code==='PGRST202'?'Sistemas debe activar el registro de cámaras (migración 118).':error?.message||'No se pudo guardar la observación.');
   return data;
  }finally{clearTimeout(timer);}
 }
 function create({db,call,scope,host}){
  if(!host||!M)return null;
  const status=host.querySelector('[data-camera-status]'),list=host.querySelector('[data-camera-list]');
  let meetingId='',sessionId='',registered=false,sequence=0,running=false,visible=true,online=true,joined=false,bound=false,busy=false,pending=false,timer=null,debounce=null,generation=0,people=[];
  function paint(text){
   host.hidden=false;status.textContent=text;
   list.replaceChildren();
   for(const person of people){
    const item=document.createElement('li'),name=document.createElement('span'),state=document.createElement('strong');
    name.textContent=person.name;state.textContent=M.labels[person.state]||M.labels.unknown;
    state.className='zoom-camera-state is-'+person.state;item.append(name,state);list.append(item);
   }
   if(!people.length){const empty=document.createElement('li');empty.textContent='Todavía no hay participantes observados.';list.append(empty);}
  }
  function invalidate(text){people=people.map(p=>({...p,state:'unknown'}));paint(text);}
  async function sample(){
   if(!running||!joined||!visible||!online)return;
   if(busy){pending=true;return;}
   const current=generation;busy=true;
   try{
    if(!sessionId)sessionId=crypto.randomUUID();
    if(!registered){await rpc(db,'dash_zoom_camera_start',{p_id:meetingId,p_session:sessionId});registered=true;}
    if(current!==generation||!running||!joined||!visible||!online)return;
    const raw=await call('getAttendeeslist');
    if(current!==generation||!running||!joined||!visible||!online)return;
    const roomScope=await scope();
    if(current!==generation||!running||!joined||!visible||!online)return;
    people=M.roster(raw,roomScope);
    const coverage=typeof roomScope==='string'?roomScope:roomScope.scope;
    const known=people.filter(p=>p.state!=='unknown').length;
    paint(coverage==='main'||coverage==='local'?'Observando '+known+' de '+people.length+' cámaras desde esta sala. Guardando…':'Zoom no confirmó la sala del observador. Cámaras sin información.');
    const saved=await rpc(db,'dash_zoom_camera_sample',{p_session:sessionId,p_seq:++sequence,p_scope:coverage,p_participants:people});
    if(current!==generation||!running||!joined||!visible||!online)return;
    paint('Observación guardada · '+M.time(saved.received_at)+'. '+known+' de '+people.length+' cámaras confirmadas. Las personas en otras salas quedan sin información.');
   }catch(error){
    if(current===generation&&running)invalidate(error.message+' Mantén el panel abierto; vuelve a consultar para reintentar.');
   }finally{
    busy=false;
    if(pending&&running){pending=false;schedule();}
   }
  }
  function schedule(){clearTimeout(debounce);debounce=setTimeout(()=>void sample(),350);}
  function bind(){
   if(bound)return;bound=true;
   for(const event of ['onUserJoin','onUserLeave','onUserUpdate','onUserIsInWaitingRoom','onRoomStatusChange'])root.ZoomMtg.inMeetingServiceListener(event,()=>{
    if(running){if(event==='onRoomStatusChange')generation++;invalidate('Zoom está actualizando los participantes…');schedule();}
   });
   root.ZoomMtg.inMeetingServiceListener('onMeetingStatus',data=>{
    if(!running)return;
    const meetingStatus=data?.meetingStatus??data?.status;
    if(![1,2,3,4].includes(meetingStatus))return;
    if(meetingStatus===3){void stop();return;}
    generation++;
    joined=meetingStatus===2;
    if(joined)schedule();else invalidate('Conexión con Zoom interrumpida. Cámaras sin información.');
   });
  }
  function start(id){
   meetingId=id;running=true;joined=true;visible=!document.hidden;online=root.navigator.onLine!==false;
   paint('Iniciando el registro de cámaras…');void sample();
   clearInterval(timer);timer=setInterval(()=>void sample(),15000);
  }
  async function stop(){
   if(!running)return;running=false;joined=false;generation++;clearTimeout(debounce);clearInterval(timer);
   invalidate('Observación terminada. Consulta el reporte guardado.');
   if(sessionId)try{await rpc(db,'dash_zoom_camera_stop',{p_session:sessionId});}catch{paint('El registro quedó interrumpido. El reporte conserva las observaciones confirmadas.');}
  }
  host.querySelector('[data-camera-refresh]').onclick=()=>void sample();
  host.querySelector('[data-camera-report]').onclick=()=>{
   if(!meetingId)return;
   if(root.parent&&root.parent!==root&&new URL(root.location.href).searchParams.get('embedded')==='1')root.parent.postMessage({type:'kja-zoom-camera-report'},root.location.origin);
   else root.open('zoom-sala.html?report='+encodeURIComponent(meetingId),'_blank','noopener,noreferrer');
  };
  document.addEventListener('visibilitychange',()=>{
   generation++;
   visible=!document.hidden;
   if(!running)return;
   if(visible)schedule();else invalidate('Panel en segundo plano. La observación queda sin confirmar.');
  });
  root.addEventListener('offline',()=>{generation++;online=false;if(running)invalidate('Sin conexión. Cámaras sin información.');});
  root.addEventListener('online',()=>{online=true;if(running)schedule();});
  root.addEventListener('pagehide',()=>{void stop();});
  return {bind,start,stop,refresh:schedule};
 }
 root.KJAZoomCameraTracker={create,rpc};
})(window);
