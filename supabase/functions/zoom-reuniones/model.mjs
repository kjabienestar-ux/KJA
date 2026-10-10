export class ZoomError extends Error {
 constructor(message,status=400,uncertain=false){super(message);this.status=status;this.uncertain=uncertain;}
}
export const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function meetingId(value){
 const id=String(value||'').replace(/[ -]/g,'');
 if(!/^\d{9,11}$/.test(id))throw new ZoomError('Escribe el ID de Zoom de 9 a 11 dígitos.');return id;
}
export function safeZoomUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['zoom.us','zoom.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:null;}catch{return null;}
}
export function audienceInput(body){
 if(!['all','areas','people'].includes(body.audience))throw new ZoomError('Selecciona los destinatarios.');
 const clean=values=>{if(!Array.isArray(values)||values.length>500)throw new ZoomError('Revisa los destinatarios.');
 const ids=[...new Set(values.map(Number))];if(ids.some(id=>!Number.isSafeInteger(id)||id<1))throw new ZoomError('Destinatario no válido.');return ids;};
 const area_ids=body.audience==='areas'?clean(body.area_ids):[],person_ids=body.audience==='people'?clean(body.person_ids):[];
 if(body.audience!=='all'&&!(area_ids.length||person_ids.length))throw new ZoomError('Selecciona al menos un destinatario.');
 return {audience:body.audience,area_ids,person_ids};
}
export function meetingInput(body,now=Date.now(),editing=false){
 const topic=String(body.topic||'').trim();if(topic.length<3||topic.length>200)throw new ZoomError('El nombre debe tener entre 3 y 200 caracteres.');
 if(editing&&body.schedule==='keep')return {topic};
 if(!['once','weekly'].includes(body.schedule))throw new ZoomError('Selecciona una programación válida.');
 const local=String(body.start_local||'');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new ZoomError('Revisa la fecha y hora de Lima.');
 const start=new Date(local+'-05:00');
 if(!Number.isFinite(start.getTime())||new Date(start.getTime()-5*3600000).toISOString().slice(0,16)!==local||start.getTime()<=now)throw new ZoomError('La reunión debe empezar en una fecha y hora futuras.');
 const duration=Number(body.duration);if(!Number.isInteger(duration)||duration<1||duration>1440)throw new ZoomError('La duración debe estar entre 1 y 1440 minutos.');
 const result={topic,type:body.schedule==='weekly'?8:2,start_time:local+':00',timezone:'America/Lima',duration};
 if(body.schedule==='weekly'){
 const days=[...new Set((Array.isArray(body.days)?body.days:[]).map(Number))].sort();
 if(!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>7))throw new ZoomError('Selecciona los días de la semana.');
 if(!days.includes(new Date(local+'Z').getUTCDay()+1))throw new ZoomError('La primera fecha debe coincidir con uno de los días elegidos.');
 const count=Number(body.count);if(!Number.isInteger(count)||count<1||count>50)throw new ZoomError('Programa entre 1 y 50 sesiones por serie.');
 result.recurrence={type:2,repeat_interval:1,weekly_days:days.join(','),end_times:count};
 }
 return result;
}
export function snapshot(meeting){
 if(![2,3,8].includes(meeting.type))throw new ZoomError('Solo se admiten reuniones programadas o recurrentes.');
 const url=safeZoomUrl(meeting.join_url);if(!url)throw new ZoomError('Zoom no devolvió un enlace válido para participantes.');
 const duration=Number(meeting.duration)||60;
 if(duration<1||duration>1440)throw new ZoomError('La duración de esta reunión no es compatible.');
 const occurrences=(meeting.occurrences||[]).filter(o=>o.status!=='deleted'&&Number.isFinite(Date.parse(o.start_time))).map(o=>({occurrence_id:String(o.occurrence_id),start_time:o.start_time,duration:Number(o.duration)||duration}));
 return {zoom_id:meetingId(meeting.id),topic:String(meeting.topic||'Reunión Zoom').slice(0,200),host_id:String(meeting.host_id),host_email:meeting.host_email||'',type:meeting.type,start_time:meeting.start_time||null,duration,timezone:meeting.timezone||'America/Lima',recurrence:meeting.recurrence||null,occurrences,join_url:url,status:'ready',last_error:null,synced_at:new Date().toISOString()};
}
