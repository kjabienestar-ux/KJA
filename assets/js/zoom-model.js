/* Pure schedule helpers; all displayed times use America/Lima. */
(function(root){
 const dateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 function nextSession(row,now=Date.now()){
 if(row.type===3)return {label:'Sala sin horario fijo',joinable:true,time:null};
 const sessions=(row.type===8?(row.occurrences||[]):[{start_time:row.start_time,duration:row.duration}]).map(o=>({...o,time:Date.parse(o.start_time)})).filter(o=>Number.isFinite(o.time)).sort((a,b)=>a.time-b.time);
 const next=sessions.find(o=>o.time+(Number(o.duration)||row.duration||60)*60000>now);
 if(!next)return {label:'Sin próximas sesiones',joinable:false,time:null};
 const today=dateKey(next.time)===dateKey(now),ongoing=next.time<=now;
 const date=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long'}).format(next.time);
 const hour=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'numeric',minute:'2-digit'}).format(next.time);
 return {...next,today,ongoing,joinable:true,label:(ongoing?'En horario · ':today?'Hoy · ':date+' · ')+hour};
 }

 const DAY=86400000;
 function weekSessions(rows,now=Date.now(),offset=0){
 const local=new Date(dateKey(now)+'T00:00:00-05:00');
 const weekday=new Date(local.getTime()-5*3600000).getUTCDay();
 const start=local.getTime()-((weekday+6)%7)*DAY+offset*7*DAY,end=start+7*DAY;
 const days=Array.from({length:7},(_,i)=>({time:start+i*DAY,key:dateKey(start+i*DAY),sessions:[]}));
 for(const row of rows){
 if(row.status!=='ready'||row.type===3)continue;
 const occurrences=row.type===8?(row.occurrences||[]):[{start_time:row.start_time,duration:row.duration}];
 const seen=new Set();
 for(const o of occurrences){
 const time=Date.parse(o.start_time);
 if(!Number.isFinite(time)||time<start||time>=end||o.status==='deleted'||seen.has(time))continue;
 seen.add(time);
 const duration=Number(o.duration)||Number(row.duration)||60;
 days.find(d=>d.key===dateKey(time)).sessions.push({row,time,duration,ended:time+duration*60000<=now});
 }
 }
 days.forEach(d=>d.sessions.sort((a,b)=>a.time-b.time));
 return {start,end,days};
 }
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['zoom.us','zoom.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:null;}catch{return null;}}
 root.KJAZoomModel={nextSession,dateKey,safeUrl,weekSessions};
 if(typeof module==='object')module.exports=root.KJAZoomModel;
})(typeof window==='object'?window:globalThis);
