/* Camera state is an observation, never proof of identity or attention. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 root.KJAZoomCameraModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const labels={on:'Encendida',off:'Apagada',unknown:'Sin información'};
 function identity(p){const key=p.participantUUID||p.persistentID;const id=p.userId??p.participantId;return key?'uuid:'+key:id!==undefined&&id!==null?'user:'+id:'';}
 function roomVisibility(status,raw,currentRoom){
  const data=raw?.result??raw;
  if(!data)return {scope:'unknown',visibleIds:[]};
  const rooms=Array.isArray(data)?data:Array.isArray(data.rooms)?data.rooms:Array.isArray(data.result)?data.result:[];
  const unassigned=Array.isArray(data.unassigned)?data.unassigned:[];
  if(!rooms.length&&!unassigned.length)return {scope:'unknown',visibleIds:[]};
  if(status==='in room'){
   const currentId=(currentRoom?.result??currentRoom)?.roomId??(currentRoom?.result??currentRoom)?.boId;
   const room=rooms.find(r=>(r.boId||r.roomId||r.id)===currentId);
   if(!room)return {scope:'unknown',visibleIds:[]};
   return {scope:'local',visibleIds:(room.participants||[]).filter(p=>p.participantStatus==='joined').map(identity).filter(Boolean)};
  }
  if(!['initial','be invited','not joined','return main session'].includes(status))return {scope:'unknown',visibleIds:[]};
  const visible=[...unassigned,...rooms.flatMap(r=>(r.participants||[]).filter(p=>p.participantStatus==='assigned'))];
  const remote=new Set(rooms.flatMap(r=>(r.participants||[]).filter(p=>p.participantStatus==='joined').map(identity)));
  return {scope:'local',visibleIds:visible.map(identity).filter(id=>id&&!remote.has(id))};
 }
 function roster(raw,scope='main'){
  const list=Array.isArray(raw)?raw:raw?.result?.attendeesList??raw?.attendeesList;
  if(!Array.isArray(list))throw Error('Zoom no confirmó la lista de participantes.');
  const seen=new Set();
  return list.filter(p=>p&&!p.self&&!p.isHold&&!p.isBotUser).map(p=>{
   // Persistent IDs survive renames. Never merge people by their display name.
   const id=identity(p);
   const observable=scope==='main'||scope?.scope==='local'&&scope.visibleIds?.includes(id);
   const isVideoOn=p.video===true||p.video===1||p.bVideoOn===true||p.bVideoOn===1;
   const isVideoOff=p.video===false||p.video===0||p.bVideoOn===false||p.bVideoOn===0;
   const video=isVideoOn?'on':isVideoOff?'off':'unknown';
   const state=observable?video:'unknown';
   return {id:id.slice(0,160),name:String(p.userName||'Participante sin nombre').slice(0,256),state};
  }).filter(p=>{if(!p.id||seen.has(p.id))return false;seen.add(p.id);return true;});
 }
 const duration=value=>{const seconds=Math.max(0,Math.round(Number(value)||0));return Math.floor(seconds/60)+' min '+String(seconds%60).padStart(2,'0')+' s';};
 const time=value=>value?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'—';
 const date=value=>new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value));
 function csvCell(value){
  let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
 }
 function csv(data,topic){
  const rows=[['Reunión','Observación iniciada (Lima)','Participante','ID de Zoom','Primera observación (Lima)','Última presencia observada (Lima)','Cámara encendida (s)','Cámara apagada (s)','Sin información (s)','% del tiempo confirmado con cámara']];
  for(const p of data.people||[])rows.push([topic,date(data.session.started_at),p.name,p.id,date(p.first_seen),date(p.last_seen),p.on_seconds,p.off_seconds,p.unknown_seconds,p.percentage??'']);
  return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
 }
 return {labels,roster,roomVisibility,duration,time,date,csv};
});
