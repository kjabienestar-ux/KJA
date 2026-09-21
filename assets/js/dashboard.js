/* KJA · Portal personal — sin framework, sesión Supabase + RPC protegidas. */
const SUPABASE_URL = 'https://xadxmfgdxwplmhijagix.supabase.co';
const SUPABASE_ANON = 'sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub';
const AUTH_KEY = 'kja-dashboard-auth';
const DEADLINE_KEY = 'kja-dashboard-vence';
const SHELL_KEY = 'kja-dashboard-shell';
const PROFILE_BUCKET = 'perfil-fotos';
const REQUEST_BUCKET = 'solicitud-evidencias';
const DAILY_EVIDENCE_BUCKET = 'asis-cierre-evidencias';
const FACEBOOK_EVIDENCE_MAX = 50;
const CLOSE_MODEL = window.KJACloseModel;
const PROFILE_MAX_SOURCE = 3 * 1024 * 1024;
const PROFILE_MAX_STORED = 480 * 1024;
const PROFILE_AVATAR_IDS = ['side-avatar','mobile-avatar','rail-avatar','mobile-home-avatar','profile-avatar','head-avatar'];
const PROFILE_SIGNED_CACHE = new Map();
const MARK_PROTOCOL = 20260902;
const BASE_DOCUMENT_TITLE = document.title;
const WEATHER_CACHE_KEY = 'kja-dashboard-weather';
const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const WEATHER_DEFAULT_COORDS = {lat:-12.0464,lon:-77.0428};
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false, storageKey:AUTH_KEY }
});

const $ = id => document.getElementById(id);
const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtTime = s => s ? String(s).slice(0,5) : '—';
// Solo devuelve letras o números: estas iniciales también se insertan en
// plantillas HTML y no deben poder convertirse en marcado desde un nombre.
const initials = n => String(n||'KJ').trim().split(/\s+/).slice(0,2)
  .map(word=>(word.match(/[\p{L}\p{N}]/u)||[''])[0]).join('').toUpperCase()||'KJ';
const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : '';
const isoLima = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const shortDays = ['D','L','M','M','J','V','S'];

let AMBIENCE_TIMER = null;
let AMBIENCE_WEATHER_TIMER = null;
let AMBIENCE_WEATHER = {kind:'partly-cloudy',label:'Clima local',temperature:null,cloudCover:45,windSpeed:8};
let PERSONAL_REQUEST = {file:null,previewUrl:'',busy:false,trigger:null};
let FACEBOOK_SHARE = {trigger:null,data:null,signed:[],request:0};
let REQUEST_CALENDAR = {targetId:'',trigger:null,year:0,month:0};
let ATTENDANCE_DAY_TRIGGER = null;
let ATTENDANCE_EVIDENCE_TRIGGER = null;
let ATTENDANCE_DAY_EVIDENCES = [];
let STORED_EVIDENCE_VIEWER = {path:'',bucket:'',trigger:null,request:0};

function limaClock(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(part=>[part.type,part.value]));
  const hour=Number(parts.hour)%24,minute=Number(parts.minute)||0;
  return {value:hour+(minute/60)};
}

function classifyAmbienceWeather(current={}){
  const code=Number(current.weather_code??0),cloud=Math.max(0,Math.min(100,Number(current.cloud_cover??0)));
  if(code>=95)return 'storm';
  if((code>=51&&code<=67)||(code>=80&&code<=82)||(code>=71&&code<=77)||(code>=85&&code<=86))return 'rain';
  if(code===45||code===48)return 'fog';
  if(code===3||cloud>=78)return 'cloudy';
  if(code===1||code===2||cloud>=24)return 'partly-cloudy';
  return 'clear';
}

function ambienceWeatherLabel(kind){
  return {clear:'Despejado','partly-cloudy':'Parcialmente nublado',cloudy:'Nublado',fog:'Neblina',rain:'Lluvia',storm:'Tormenta'}[kind]||'Clima local';
}

function applyWeatherAmbience(current={}){
  const portal=$('portal');if(!portal)return;
  const kind=classifyAmbienceWeather(current),cloudCover=Math.max(0,Math.min(100,Number(current.cloud_cover??45))),windSpeed=Math.max(0,Number(current.wind_speed_10m??8));
  const temperature=Number.isFinite(Number(current.temperature_2m))?Math.round(Number(current.temperature_2m)):null;
  AMBIENCE_WEATHER={kind,label:ambienceWeatherLabel(kind),temperature,cloudCover,windSpeed};
  portal.dataset.weather=kind;
  portal.style.setProperty('--weather-cloud-cover',(cloudCover/100).toFixed(2));
  portal.style.setProperty('--weather-cloud-opacity',Math.min(.82,.08+(cloudCover/100)*.74).toFixed(2));
  portal.style.setProperty('--weather-cloud-duration',`${Math.max(16,Math.min(42,38-(windSpeed*.65))).toFixed(1)}s`);
  paintTimeAmbience();
}

function weatherPosition(){
  return new Promise(resolve=>{
    if(!navigator.geolocation)return resolve(WEATHER_DEFAULT_COORDS);
    navigator.geolocation.getCurrentPosition(
      position=>resolve({lat:+position.coords.latitude.toFixed(4),lon:+position.coords.longitude.toFixed(4)}),
      ()=>resolve(WEATHER_DEFAULT_COORDS),
      {enableHighAccuracy:false,timeout:5000,maximumAge:WEATHER_REFRESH_MS}
    );
  });
}

async function weatherCoordinates(){
  try{
    if(!navigator.permissions||!navigator.geolocation)return WEATHER_DEFAULT_COORDS;
    const permission=await navigator.permissions.query({name:'geolocation'});
    return permission.state==='granted'?await weatherPosition():WEATHER_DEFAULT_COORDS;
  }catch{return WEATHER_DEFAULT_COORDS}
}

async function loadWeatherAmbience(){
  try{
    const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||'null');
    if(cached?.current)applyWeatherAmbience(cached.current);
    if(cached?.savedAt&&Date.now()-cached.savedAt<WEATHER_REFRESH_MS)return;
  }catch{}
  try{
    const coords=await weatherCoordinates(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    const params=new URLSearchParams({latitude:String(coords.lat),longitude:String(coords.lon),current:'temperature_2m,weather_code,cloud_cover,precipitation,is_day,wind_speed_10m',timezone:'auto',forecast_days:'1'});
    const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:controller.signal});clearTimeout(timeout);
    if(!response.ok)throw new Error('weather');
    const data=await response.json();if(!data?.current)throw new Error('weather');
    applyWeatherAmbience(data.current);
    try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),current:data.current}))}catch{}
  }catch{/* El ambiente horario sigue funcionando si el clima no está disponible. */}
}

function paintTimeAmbience(){
  const portal=$('portal'),ambience=$('time-ambience');if(!portal||!ambience)return;
  const live=limaClock(),value=live.value;
  const daylight=value>=5&&value<19;
  const progress=daylight?(value-5)/14:((value>=19?value-19:value+5)/10);
  const x=8+(progress*84);
  const y=76-(Math.sin(Math.PI*progress)*56);
  const phase=value>=5&&value<8?'dawn':value>=8&&value<16?'day':value>=16&&value<19?'sunset':'night';
  portal.dataset.timePhase=phase;
  portal.dataset.timePreview='auto';
  const person=APP?.inicio?.colaborador;
  if(person&&$('welcome')){
    const greeting=value<12?'Buenos días':value<19?'Buenas tardes':'Buenas noches';
    $('welcome').textContent=`${greeting}, ${person.nombre.split(' ')[0]}`;
  }
  portal.style.setProperty('--orb-x',`${x.toFixed(2)}%`);
  portal.style.setProperty('--orb-y',`${y.toFixed(2)}%`);
  portal.style.setProperty('--orb-progress',progress.toFixed(4));
  ambience.style.setProperty('--orb-x',`${x.toFixed(2)}%`);
  ambience.style.setProperty('--orb-y',`${y.toFixed(2)}%`);
}

function startTimeAmbience(){
  const schedule=()=>{paintTimeAmbience();clearInterval(AMBIENCE_TIMER);AMBIENCE_TIMER=setInterval(paintTimeAmbience,60000)};
  schedule();
  loadWeatherAmbience();
  clearInterval(AMBIENCE_WEATHER_TIMER);AMBIENCE_WEATHER_TIMER=setInterval(loadWeatherAmbience,WEATHER_REFRESH_MS);
  document.addEventListener('visibilitychange',()=>{
    const portal=$('portal');if(portal)portal.dataset.ambiencePaused=String(document.hidden);
    if(document.hidden){clearInterval(AMBIENCE_TIMER);clearInterval(AMBIENCE_WEATHER_TIMER);AMBIENCE_TIMER=null;AMBIENCE_WEATHER_TIMER=null}else{schedule();loadWeatherAmbience();AMBIENCE_WEATHER_TIMER=setInterval(loadWeatherAmbience,WEATHER_REFRESH_MS)};
  });
}

let APP = { inicio:null, historial:null, cierre:null, personalRequests:[], daysOffBalance:null, teamPeople:[], year:0, month:0, view:'inicio', sessionTimer:null, markTimer:null, notificationTimer:null, notificationChannel:null, attendanceDayRequest:0, attendanceDayDate:'', avatar:{path:'',url:'',busy:false}, notifications:{available:false,loading:false,error:'',unread:0,items:[],request:0,deletingId:null}, identity:{nivel:'miembro',hasPersonal:false,isLeader:false,isSystem:false}, access:{rol:'visor',acceso_panel:false}, adminSection:'overview', adminList:null, adminListRequest:0, adminTeam:null, adminTeamRequest:0, adminAccess:null, adminAccessRequest:0, adminMonth:null, adminMonthKey:'', adminMonthRequest:0, adminRoles:null, adminRolesRequest:0, adminReview:null, adminControl:null, adminControlRequest:0 };
let EVIDENCE = null;
let DAILY_EVIDENCE = {requirement:'',assignment:null,title:'',files:[],existingFiles:[],existingVideoPath:null,video:null,busy:false,loading:false,editing:false};
let DAILY_EVIDENCE_TRIGGER=null;
let DAILY_EVIDENCE_LOAD=0;
let DAILY_EXIT_BUSY=false;
let MARK_BUSY = false;
let MARK_SYNC_PROMISE = null;
let MARK_GEO = null;
let MARK_PROTOCOL_STATE = null;
let MODE_BUSY = false;
let DASH_ETAG = null;
let DASH_UPDATE_PENDING = false;
let DASH_VERSION_CHECKED_AT = 0;
let DASH_VERSION_TIMER = null;
let REVIEW_NOTIFICATION_TRIGGER = null;
let NOTIFICATION_AUDIO_CONTEXT = null;
let NOTIFICATION_AUDIO_READY = false;
let NOTIFICATION_BASELINED = false;
const NOTIFICATION_KNOWN_IDS = new Set();

function formMsg(id,text){ const el=$(id); el.textContent=text||''; el.classList.toggle('show',!!text); }
function markMsg(text){ $('mark-msg').textContent=text||''; $('mark-msg').classList.toggle('show',!!text); }
function toast(text,bad=false){ const el=$('toast'); el.textContent=text; el.classList.toggle('bad',bad); el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),3500); }
function setBusy(button,on,label){ button.disabled=on; if(!button.dataset.label) button.dataset.label=button.querySelector('span')?.textContent||button.textContent; const span=button.querySelector('span'); if(span) span.textContent=on?label:button.dataset.label; }

async function primeNotificationSound(){
  if(NOTIFICATION_AUDIO_READY)return;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;
  try{
    NOTIFICATION_AUDIO_CONTEXT=NOTIFICATION_AUDIO_CONTEXT||new AudioContextClass();
    if(NOTIFICATION_AUDIO_CONTEXT.state==='suspended')await NOTIFICATION_AUDIO_CONTEXT.resume();
    NOTIFICATION_AUDIO_READY=NOTIFICATION_AUDIO_CONTEXT.state==='running';
  }catch{/* El aviso visual sigue disponible cuando el navegador bloquea audio. */}
}

function playNotificationSound(){
  const context=NOTIFICATION_AUDIO_CONTEXT;if(!NOTIFICATION_AUDIO_READY||!context||context.state!=='running')return;
  try{
    const master=context.createGain(),now=context.currentTime;
    const compressor=typeof context.createDynamicsCompressor==='function'?context.createDynamicsCompressor():null;
    master.gain.setValueAtTime(.0001,now);master.gain.exponentialRampToValueAtTime(.18,now+.015);master.gain.exponentialRampToValueAtTime(.0001,now+.52);
    if(compressor){
      compressor.threshold.setValueAtTime(-24,now);compressor.knee.setValueAtTime(18,now);compressor.ratio.setValueAtTime(6,now);compressor.attack.setValueAtTime(.003,now);compressor.release.setValueAtTime(.18,now);
      master.connect(compressor);compressor.connect(context.destination);
    }else master.connect(context.destination);
    [{frequency:784,start:0,duration:.18,level:.78,type:'sine'},{frequency:1174,start:.14,duration:.28,level:.9,type:'triangle'}].forEach(note=>{
      const oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.type=note.type;oscillator.frequency.setValueAtTime(note.frequency,now+note.start);
      gain.gain.setValueAtTime(.0001,now+note.start);gain.gain.exponentialRampToValueAtTime(note.level,now+note.start+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+note.start+note.duration);
      oscillator.connect(gain);gain.connect(master);oscillator.start(now+note.start);oscillator.stop(now+note.start+note.duration+.02);
    });
  }catch{/* Nunca se bloquea la sincronización por un problema de audio. */}
}

// Interfaz compartida para módulos independientes del dashboard, como el chat.
window.KJANotificationSound={prime:primeNotificationSound,play:playNotificationSound};

function announceFreshNotifications(items){
  const unread=(items||[]).filter(item=>!item.leida),fresh=unread.filter(item=>!NOTIFICATION_KNOWN_IDS.has(String(item.id)));
  (items||[]).forEach(item=>NOTIFICATION_KNOWN_IDS.add(String(item.id)));
  if(!NOTIFICATION_BASELINED){NOTIFICATION_BASELINED=true;return}
  if(!fresh.length)return;
  playNotificationSound();
  const first=fresh[0],label=first.tipo==='asignacion'?'Nueva asignación':first.tipo==='mensaje_direccion'?'Nuevo mensaje de Dirección':'Nueva respuesta de Dirección';
  toast(fresh.length===1?`${label}: ${first.titulo||'Revisa tu campana'}`:`Tienes ${fresh.length} notificaciones nuevas.`);
}

document.addEventListener('pointerdown',primeNotificationSound,{once:true,capture:true});
document.addEventListener('keydown',primeNotificationSound,{once:true,capture:true});

function reviewNotificationDate(value){
  if(!value)return 'Fecha no disponible';
  const date=new Date(value);if(Number.isNaN(date.getTime()))return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(date);
}

function reviewNotificationDayKey(value){
  const date=new Date(value);if(Number.isNaN(date.getTime()))return 'sin-fecha';
  const parts={};
  new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).forEach(part=>{if(part.type!=='literal')parts[part.type]=part.value});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function reviewNotificationDayLabel(key,value){
  if(key==='sin-fecha')return 'Sin fecha';
  if(key===isoLima())return 'Hoy';
  if(key===addIsoDays(isoLima(),-1))return 'Ayer';
  const date=new Date(value);if(Number.isNaN(date.getTime()))return 'Sin fecha';
  const label=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long'}).format(date);
  return label.charAt(0).toUpperCase()+label.slice(1);
}

function reviewNotificationListMarkup(items){
  const groups=new Map();
  items.forEach(item=>{
    const key=reviewNotificationDayKey(item.creado_at);
    if(!groups.has(key))groups.set(key,{key,value:item.creado_at,items:[]});
    groups.get(key).items.push(item);
  });
  return [...groups.values()].map((group,index)=>{
    const count=group.items.length,label=reviewNotificationDayLabel(group.key,group.value),headingId=`review-notification-day-${index}`;
    return `<section class="review-notification-day" aria-labelledby="${headingId}"><h3 id="${headingId}"><span>${esc(label)}</span><small>${count} ${count===1?'aviso':'avisos'}</small></h3><div class="review-notification-day-items" role="list">${group.items.map(reviewNotificationMarkup).join('')}</div></section>`;
  }).join('');
}

function reviewNotificationMarkup(item){
  const type=item.tipo||(item.estado==='observada'?'revision_observada':'revision_aprobada');
  const observed=type==='revision_observada',assignment=type==='asignacion',direct=type==='mensaje_direccion',unread=!item.leida,hasMessage=!!String(item.nota||'').trim();
  const deleting=String(APP.notifications?.deletingId||'')===String(item.id);
  const assignmentKind=assignment&&item.meta?.tipo_entregable?` · ${String(item.meta.tipo_entregable).toUpperCase()}`:'';
  const title=assignment?`Nueva asignación${assignmentKind}`:direct?'Mensaje de Dirección':observed?'Necesitas corregir una evidencia':'Evidencia aprobada';
  const copy=item.nota||(assignment?'Dirección te asignó un nuevo entregable. Revisa los requisitos de tu jornada.':observed?'Dirección indicó que debes revisar esta entrega.':'Dirección aprobó la entrega sin observaciones adicionales.');
  const sender=String(item.remitente||'').trim();
  const messageLabel=assignment?'Indicaciones de Dirección':observed?'Observación de Dirección':'Mensaje de Dirección';
  const messageHeading=sender?`${messageLabel} · ${sender}`:messageLabel;
  const icon=assignment
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7zM15 3v5h5M10 13h6M10 17h4"/></svg>'
    : direct
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H8l-4 4zM8 9h8M8 13h5"/></svg>'
      : observed
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9"/><circle cx="12" cy="12" r="9"/></svg>';
  const trash='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>';
  const state=assignment?'assignment':direct?'message':observed?'observed':'approved';
  return `<article class="review-notification-item${unread?' is-unread':''}${deleting?' is-deleting':''}" data-state="${state}" role="listitem"><button class="review-notification-content" type="button" data-review-notification-id="${esc(item.id)}" aria-label="${esc(`${title}: ${item.titulo}. ${messageHeading}: ${copy}`)}"><span class="review-notification-state">${icon}</span><span class="review-notification-copy"><span><b>${esc(title)}</b>${unread?'<em>Nueva</em>':''}</span><strong>${esc(item.titulo||'Aviso de Dirección')}</strong><p class="has-direction-message${hasMessage?'':' is-system-message'}"><span>${esc(messageHeading)}</span>${esc(copy)}</p><small>${esc(reviewNotificationDate(item.creado_at))}</small></span></button><button class="review-notification-delete" type="button" data-delete-review-notification="${esc(item.id)}" aria-label="${esc(`Eliminar notificación: ${title}, ${item.titulo||'Aviso de Dirección'}`)}" title="Eliminar notificación" ${deleting?'disabled':''}>${trash}</button></article>`;
}

function renderReviewNotifications(){
  const state=APP.notifications||{},available=APP.identity.hasPersonal&&state.available,unread=Math.max(0,Number(state.unread)||0);
  document.querySelectorAll('[data-review-notification-trigger]').forEach(button=>{
    button.hidden=!available;
    button.classList.toggle('has-unread',unread>0);
    button.setAttribute('aria-label',unread?`Abrir notificaciones, ${unread} ${unread===1?'notificación sin leer':'notificaciones sin leer'}`:'Abrir notificaciones');
    const badge=button.querySelector('[data-review-notification-badge]');if(!badge)return;
    badge.hidden=unread<1;badge.textContent=unread>99?'99+':String(unread);
  });
  const summary=$('review-notification-summary'),summaryCopy=$('review-notification-summary-copy'),readAll=$('review-notification-read-all'),list=$('review-notification-list');
  if(!summary||!list)return;
  list.setAttribute('aria-busy',String(state.loading||state.deletingId!==null));
  document.title=unread?`(${unread>99?'99+':unread}) ${BASE_DOCUMENT_TITLE}`:BASE_DOCUMENT_TITLE;
  summary.textContent=unread?`${unread} ${unread===1?'mensaje nuevo':'mensajes nuevos'}`:'Todo al día';
  summaryCopy.textContent=unread?'Tienes actividad nueva de Dirección.':'No tienes mensajes nuevos.';
  readAll.hidden=unread<1;readAll.disabled=state.loading;
  if(state.loading&&!state.items.length){list.innerHTML='<div class="review-notification-loading" role="status">Consultando tus notificaciones…</div>';return}
  if(state.error&&!state.items.length){list.innerHTML='<div class="review-notification-empty is-error"><b>No pudimos actualizar los mensajes</b><p>Comprueba tu conexión y vuelve a intentarlo.</p><button type="button" data-retry-review-notifications>Reintentar</button></div>';return}
  list.innerHTML=state.items.length?reviewNotificationListMarkup(state.items):'<div class="review-notification-empty"><b>Aún no tienes notificaciones</b><p>Los mensajes, revisiones y nuevas asignaciones aparecerán aquí.</p></div>';
}

async function loadReviewNotifications({quiet=false}={}){
  if(!APP.identity.hasPersonal)return null;
  if(APP.notifications.deletingId!==null)return APP.notifications;
  const request=(APP.notifications.request||0)+1;
  APP.notifications={...APP.notifications,loading:true,error:'',request};renderReviewNotifications();
  const {data,error}=await db.rpc('dash_mis_notificaciones_revision',{p_limite:24});
  if(request!==APP.notifications.request)return null;
  if(error||!data?.ok){
    const missing=error?.code==='PGRST202'||String(error?.message||'').includes('dash_mis_notificaciones_revision');
    APP.notifications={...APP.notifications,available:!missing,loading:false,error:missing?'':(error?.message||data?.motivo||'carga')};renderReviewNotifications();
    if(!quiet&&!missing)toast('No pudimos actualizar tus notificaciones.',true);
    return null;
  }
  const items=Array.isArray(data.notificaciones)?data.notificaciones:[];announceFreshNotifications(items);
  APP.notifications={...APP.notifications,available:true,loading:false,error:'',unread:Number(data.no_leidas)||0,items,request,deletingId:null};
  renderReviewNotifications();return APP.notifications;
}

function closeReviewNotifications({restoreFocus=true}={}){
  const layer=$('review-notification-layer');if(!layer||layer.hidden)return;
  layer.hidden=true;document.body.classList.remove('review-notification-open');
  document.querySelectorAll('[data-review-notification-trigger]').forEach(button=>button.setAttribute('aria-expanded','false'));
  if(restoreFocus&&REVIEW_NOTIFICATION_TRIGGER)REVIEW_NOTIFICATION_TRIGGER.focus();
  REVIEW_NOTIFICATION_TRIGGER=null;
}

function mountReviewNotificationPortal(){
  const layer=$('review-notification-layer');
  if(layer&&layer.parentElement!==document.body)document.body.appendChild(layer);
  return layer;
}

async function openReviewNotifications(trigger){
  if(!APP.notifications.available)return;
  const layer=mountReviewNotificationPortal();if(!layer)return;
  REVIEW_NOTIFICATION_TRIGGER=trigger||document.activeElement;
  layer.hidden=false;document.body.classList.add('review-notification-open');
  document.querySelectorAll('[data-review-notification-trigger]').forEach(button=>button.setAttribute('aria-expanded','true'));
  renderReviewNotifications();$('review-notification-panel').focus({preventScroll:true});
  const fresh=await loadReviewNotifications({quiet:true});
  if(!layer.hidden&&fresh?.unread>0)await markReviewNotificationsRead(null);
}

async function markReviewNotificationsRead(ids=null){
  if(APP.notifications.loading||APP.notifications.deletingId!==null)return;
  APP.notifications.loading=true;renderReviewNotifications();
  const {data,error}=await db.rpc('dash_marcar_notificaciones_revision',{p_ids:ids});
  if(error||!data?.ok){APP.notifications.loading=false;renderReviewNotifications();toast('No pudimos marcar el mensaje como leído.',true);return}
  const selected=ids?new Set(ids.map(String)):null;
  const items=APP.notifications.items.map(item=>!item.leida&&(!selected||selected.has(String(item.id)))?{...item,leida:true}:item);
  const unread=selected?Math.max(0,APP.notifications.unread-(Number(data.marcadas)||0)):0;
  APP.notifications={...APP.notifications,loading:false,unread,items};renderReviewNotifications();
  if(!$('review-notification-layer').hidden)$('review-notification-panel').focus({preventScroll:true});
}

async function deleteReviewNotification(id){
  if(APP.notifications.deletingId!==null)return;
  const numericId=Number(id),index=APP.notifications.items.findIndex(item=>Number(item.id)===numericId);
  if(!Number.isFinite(numericId)||index<0)return;
  const removed=APP.notifications.items[index];
  APP.notifications={...APP.notifications,deletingId:numericId};renderReviewNotifications();
  $('review-notification-panel').focus({preventScroll:true});
  const {data,error}=await db.rpc('dash_eliminar_notificacion_revision',{p_id:numericId});
  if(error||!data?.ok){
    APP.notifications={...APP.notifications,deletingId:null};renderReviewNotifications();
    const retryDelete=$('review-notification-list').querySelector(`[data-delete-review-notification="${numericId}"]`);
    (retryDelete||$('review-notification-panel')).focus({preventScroll:true});
    const missing=error?.code==='PGRST202'||Number(error?.status)===404||String(error?.message||'').includes('dash_eliminar_notificacion_revision');
    toast(missing?'Falta activar la eliminación de notificaciones en Supabase.':'No pudimos eliminar la notificación. Actualiza e inténtalo nuevamente.',true);return;
  }
  const items=APP.notifications.items.filter(item=>Number(item.id)!==numericId);
  const unread=Math.max(0,Number(APP.notifications.unread||0)-(removed.leida?0:1));
  APP.notifications={...APP.notifications,deletingId:null,unread,items};renderReviewNotifications();
  const buttons=$('review-notification-list').querySelectorAll('[data-delete-review-notification]');
  const nextDelete=buttons[Math.min(index,Math.max(0,items.length-1))];
  (nextDelete||$('review-notification-panel')).focus({preventScroll:true});
  toast('Notificación eliminada.');
}

async function startReviewNotificationSync(){
  clearInterval(APP.notificationTimer);APP.notificationTimer=null;
  if(APP.notificationChannel){void db.removeChannel(APP.notificationChannel);APP.notificationChannel=null}
  if(!APP.identity.hasPersonal)return;
  await loadReviewNotifications({quiet:true});
  const collaboratorId=Number(APP.inicio?.colaborador?.id);
  if(Number.isFinite(collaboratorId)&&typeof db.channel==='function'){
    APP.notificationChannel=db.channel(`kja-notificaciones-${collaboratorId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'asis_notificaciones',filter:`colaborador_id=eq.${collaboratorId}`},()=>void loadReviewNotifications({quiet:true}))
      .subscribe();
  }
  APP.notificationTimer=setInterval(()=>{if(!document.hidden)void loadReviewNotifications({quiet:true})},30000);
}

document.querySelectorAll('[data-review-notification-trigger]').forEach(button=>button.onclick=()=>openReviewNotifications(button));
document.querySelectorAll('[data-close-review-notifications]').forEach(button=>button.onclick=()=>closeReviewNotifications());
$('review-notification-read-all').onclick=()=>markReviewNotificationsRead(null);
$('review-notification-list').onclick=event=>{
  const retry=event.target.closest('[data-retry-review-notifications]');if(retry){void loadReviewNotifications();return}
  const remove=event.target.closest('[data-delete-review-notification]');if(remove){void deleteReviewNotification(remove.dataset.deleteReviewNotification);return}
  const button=event.target.closest('[data-review-notification-id]');if(!button)return;
  const item=APP.notifications.items.find(notification=>String(notification.id)===String(button.dataset.reviewNotificationId));
  if(item&&!item.leida)void markReviewNotificationsRead([Number(item.id)]);
};
$('review-notification-layer').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeReviewNotifications();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('review-notification-panel').querySelectorAll('button:not(:disabled):not([hidden])')].filter(element=>element.offsetParent!==null);
  if(!focusable.length){event.preventDefault();$('review-notification-panel').focus();return}
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});

function profilePhotoMessage(text,type=''){
  const el=$('profile-photo-message');if(!el)return;
  el.textContent=text||'';el.className='profile-photo-message'+(type?' '+type:'');
}
function profilePhotoIssue(text){
  profilePhotoMessage(text,'error');
  if(APP.view==='inicio')toast(text,true);
}
function paintProfilePhoto(url=''){
  PROFILE_AVATAR_IDS.forEach(id=>{
    const el=$(id);if(!el)return;
    el.classList.toggle('has-photo',!!url);
    if(url)el.style.backgroundImage=`url("${url}")`;else el.style.removeProperty('background-image');
  });
  const hasPhoto=!!APP.avatar.path;
  if($('profile-photo-change'))$('profile-photo-change').textContent=hasPhoto?'Cambiar foto':'Subir foto';
  if($('profile-photo-remove'))$('profile-photo-remove').hidden=!hasPhoto;
  const mobileEdit=$('mobile-home-photo');
  if(mobileEdit){const label=hasPhoto?'Cambiar foto de perfil':'Subir foto de perfil';mobileEdit.setAttribute('aria-label',label);mobileEdit.title=label}
}

async function hydrateProfilePhotos(people=[]){
  if(!Array.isArray(people)||!people.length)return people||[];
  const ids=[...new Set(people.map(person=>Number(person?.id)).filter(Number.isFinite))];
  if(!ids.length)return people;
  let metadata=people;
  if(people.some(person=>!Object.prototype.hasOwnProperty.call(person,'foto_path'))){
    const {data,error}=await db.from('asis_colaboradores').select('id,foto_path,foto_actualizada_at').in('id',ids);
    if(!error){
      const byId=new Map((data||[]).map(item=>[String(item.id),item]));
      metadata=people.map(person=>({...person,...(byId.get(String(person.id))||{})}));
    }
  }
  const now=Date.now(),pending=[],seen=new Set();
  metadata.forEach(person=>{
    const path=String(person.foto_path||''),version=String(person.foto_actualizada_at||''),key=`${path}|${version}`;
    if(!path||seen.has(key))return;
    seen.add(key);
    const cached=PROFILE_SIGNED_CACHE.get(key);
    if(!cached||cached.expiresAt<=now)pending.push({path,key,version});
  });
  if(pending.length){
    try{
      const {data,error}=await db.storage.from(PROFILE_BUCKET).createSignedUrls(pending.map(item=>item.path),3600);
      if(!error)(data||[]).forEach((signed,index)=>{
        if(!signed?.signedUrl||!pending[index])return;
        const item=pending[index],separator=signed.signedUrl.includes('?')?'&':'?';
        PROFILE_SIGNED_CACHE.set(item.key,{url:`${signed.signedUrl}${separator}v=${encodeURIComponent(item.version||now)}`,expiresAt:now+50*60*1000});
      });
    }catch(error){}
  }
  return metadata.map(person=>{
    const key=`${String(person.foto_path||'')}|${String(person.foto_actualizada_at||'')}`;
    return {...person,foto_url:PROFILE_SIGNED_CACHE.get(key)?.url||''};
  });
}

function profileAvatarMarkup(person,tag='span'){
  const safeTag=tag==='i'?'i':'span',url=String(person?.foto_url||'');
  return `<${safeTag} class="avatar${url?' has-photo':''}" aria-hidden="true">${initials(person?.nombre)}${url?`<img data-profile-photo src="${esc(url)}" alt="" loading="lazy" decoding="async">`:''}</${safeTag}>`;
}

function paintPersonAvatar(element,person){
  if(!element)return;
  const url=String(person?.foto_url||'');element.textContent=initials(person?.nombre);element.classList.toggle('has-photo',!!url);
  if(url)element.style.backgroundImage=`url("${url.replace(/["\\]/g,'\\$&')}")`;else element.style.removeProperty('background-image');
}
document.addEventListener('error',event=>{
  const image=event.target;
  if(!(image instanceof HTMLImageElement)||!image.matches('[data-profile-photo]'))return;
  image.parentElement?.classList.remove('has-photo');image.remove();
},true);
function setProfilePhotoBusy(on){
  APP.avatar.busy=on;
  ['profile-photo-camera','profile-photo-change','profile-photo-remove','mobile-home-photo'].forEach(id=>{const el=$(id);if(el)el.disabled=on});
  if($('mobile-home-photo'))$('mobile-home-photo').toggleAttribute('aria-busy',on);
  if($('profile-photo-change'))$('profile-photo-change').textContent=on?'Preparando…':APP.avatar.path?'Cambiar foto':'Subir foto';
}
function preloadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(url);img.onerror=reject;img.src=url})}
async function loadProfilePhoto(announce=false){
  if(!APP.identity.hasPersonal)return;
  const {data,error}=await db.rpc('dash_mi_foto');
  if(error||!data?.ok){
    APP.avatar={path:'',url:'',busy:false};paintProfilePhoto('');
    if(announce)profilePhotoMessage('No se pudo cargar tu foto. Revisa la conexión e inténtalo otra vez.','error');
    return;
  }
  APP.avatar.path=data.path||'';APP.avatar.url='';paintProfilePhoto('');
  if(!APP.avatar.path){if(announce)profilePhotoMessage('Aún no tienes una foto de perfil.');return;}
  const {data:signed,error:signedError}=await db.storage.from(PROFILE_BUCKET).createSignedUrl(APP.avatar.path,3600);
  if(signedError||!signed?.signedUrl){if(announce)profilePhotoMessage('No se pudo abrir tu foto. Puedes reemplazarla o quitarla.','error');return;}
  try{
    const url=signed.signedUrl+(signed.signedUrl.includes('?')?'&':'?')+'v='+(data.actualizada_at||Date.now());
    await preloadImage(url);APP.avatar.url=url;paintProfilePhoto(url);
  }catch{
    paintProfilePhoto('');if(announce)profilePhotoMessage('La foto guardada ya no está disponible. Puedes subir otra.','error');
  }
}
function canvasBlob(canvas,type,quality){return new Promise(resolve=>canvas.toBlob(resolve,type,quality))}
async function decodeProfilePhoto(file){
  if('createImageBitmap' in window){
    try{const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close()}}catch(e){}
  }
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>resolve({source:img,width:img.naturalWidth,height:img.naturalHeight,close:()=>URL.revokeObjectURL(url)});
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('imagen'))};img.src=url;
  });
}
async function compressProfilePhoto(file){
  const decoded=await decodeProfilePhoto(file);
  try{
    if(!decoded.width||!decoded.height)throw new Error('imagen');
    const side=Math.max(1,Math.min(640,decoded.width,decoded.height)),canvas=document.createElement('canvas');
    canvas.width=side;canvas.height=side;
    const sx=Math.max(0,(decoded.width-Math.min(decoded.width,decoded.height))/2);
    const sy=Math.max(0,(decoded.height-Math.min(decoded.width,decoded.height))/2);
    const sourceSide=Math.min(decoded.width,decoded.height),ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('canvas');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,side,side);ctx.drawImage(decoded.source,sx,sy,sourceSide,sourceSide,0,0,side,side);
    let type='image/webp',ext='webp',blob=null;
    for(const quality of [.86,.78,.7,.62]){blob=await canvasBlob(canvas,type,quality);if(blob?.type===type&&blob.size<=PROFILE_MAX_STORED)break}
    if(!blob||blob.type!==type||blob.size>PROFILE_MAX_STORED){
      type='image/jpeg';ext='jpg';
      for(const quality of [.84,.76,.68,.6]){blob=await canvasBlob(canvas,type,quality);if(blob&&blob.size<=PROFILE_MAX_STORED)break}
    }
    if(!blob||blob.size>PROFILE_MAX_STORED)throw new Error('peso_final');
    return {blob,type,ext};
  }finally{decoded.close()}
}
let cropperInstance = null;

async function chooseProfilePhoto(file){
  if(!file||APP.avatar.busy)return;
  const validType=/^image\/(jpeg|png|webp)$/i.test(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name||'');
  if(!validType){ $('profile-photo-input').value=''; return profilePhotoIssue('Elige una imagen JPG, PNG o WebP.'); }
  if(file.size>PROFILE_MAX_SOURCE){ $('profile-photo-input').value=''; return profilePhotoIssue('La foto supera el máximo de 3 MB. Elige una más liviana.'); }

  const url = URL.createObjectURL(file);
  const img = $('cropper-image');
  const loader = $('avatar-crop-loader');

  loader.hidden = false;
  $('avatar-crop-modal').hidden = false;

  img.onload = () => {
    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(img, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.9,
      restore: false,
      guides: true,
      center: true,
      highlight: true,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: true,
      ready() { loader.hidden = true; },
    });
  };

  img.src = url;
}

function closeCropperModal() {
  $('avatar-crop-modal').hidden = true;
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
  $('cropper-image').src = '';
  $('profile-photo-input').value = '';
}

$('cropper-close-btn').onclick = closeCropperModal;
$('cropper-cancel-btn').onclick = closeCropperModal;
$('cropper-close-bg').onclick = closeCropperModal;

$('cropper-save-btn').onclick = async () => {
  if (!cropperInstance || APP.avatar.busy) return;
  const colab=APP.inicio?.colaborador?.id;if(!colab){ closeCropperModal(); return profilePhotoIssue('Tu perfil no está disponible en esta sesión.'); }

  const canvas = cropperInstance.getCroppedCanvas({ width: 640, height: 640 });
  if (!canvas) return;

  closeCropperModal();
  setProfilePhotoBusy(true);profilePhotoMessage('Comprimiendo foto recortada…');

  canvas.toBlob(async (blob) => {
    if (!blob) { setProfilePhotoBusy(false); return profilePhotoIssue('Error al procesar el recorte.'); }
    try{
      const prepared=await compressProfilePhoto(blob),path=`${colab}/avatar.${prepared.ext}`,previous=APP.avatar.path;
      profilePhotoMessage('Subiendo la versión optimizada…');
      const {error:uploadError}=await db.storage.from(PROFILE_BUCKET).upload(path,prepared.blob,{upsert:true,contentType:prepared.type,cacheControl:'3600'});
      if(uploadError)throw uploadError;
      const {data,error}=await db.rpc('dash_guardar_foto',{p_path:path});
      if(error||!data?.ok)throw new Error(data?.motivo||error?.message||'guardar');
      APP.avatar.path=path;
      if(previous&&previous!==path)await db.storage.from(PROFILE_BUCKET).remove([previous]).catch(()=>{});
      await loadProfilePhoto();
      profilePhotoMessage(`Foto guardada · ${Math.max(1,Math.round(prepared.blob.size/1024))} KB`,'success');toast('Foto de perfil actualizada.');
    }catch(error){
      const message=error?.message==='peso_final'?'No se pudo reducir la foto lo suficiente. Elige otra imagen.':'No se pudo guardar la foto. Revisa tu conexión e inténtalo otra vez.';
      profilePhotoIssue(message);
    }finally{setProfilePhotoBusy(false);$('profile-photo-input').value=''}
  }, 'image/jpeg', 1.0);
};
async function removeProfilePhoto(){
  if(!APP.avatar.path||APP.avatar.busy)return;
  if(!confirm('¿Quitar tu foto de perfil? Volverán a mostrarse tus iniciales.'))return;
  setProfilePhotoBusy(true);profilePhotoMessage('Quitando la foto…');
  try{
    const path=APP.avatar.path,{error:storageError}=await db.storage.from(PROFILE_BUCKET).remove([path]);
    if(storageError)throw storageError;
    const {data,error}=await db.rpc('dash_quitar_foto');
    if(error||!data?.ok)throw new Error(data?.motivo||error?.message||'quitar');
    APP.avatar={path:'',url:'',busy:true};paintProfilePhoto('');profilePhotoMessage('Foto eliminada. Tus iniciales vuelven a estar visibles.','success');toast('Foto de perfil eliminada.');
  }catch{profilePhotoMessage('No se pudo quitar la foto. Revisa tu conexión e inténtalo otra vez.','error')}
  finally{setProfilePhotoBusy(false)}
}

function resetPortalBootstrap(reveal=false){
  const portal=$('portal'),state=$('portal-bootstrap'),wasLoading=portal.dataset.loading==='true';
  if(state)state.hidden=true;
  delete portal.dataset.loading; portal.removeAttribute('aria-busy');
  if(!reveal||!wasLoading)return;
  portal.classList.remove('portal-ready');
  requestAnimationFrame(()=>{
    portal.classList.add('portal-ready');
    clearTimeout(portal._readyTimer);
    portal._readyTimer=setTimeout(()=>portal.classList.remove('portal-ready'),260);
  });
}
function showPortalBootstrap(){
  const portal=$('portal');
  clearTimeout(portal._readyTimer); portal.classList.remove('portal-ready');
  portal.dataset.loading='true'; portal.setAttribute('aria-busy','true');
  $('portal-bootstrap').hidden=false; $('access').hidden=true;
  portal.hidden=false; portal.inert=false; portal.removeAttribute('aria-hidden');
  $('workspace').focus({preventScroll:true});
  showBoot('portal'); hideBoot();
}

function showAccess(message){
  localStorage.removeItem(SHELL_KEY);
  resetPortalBootstrap();
  $('portal').hidden=true; $('portal').inert=true; $('portal').setAttribute('aria-hidden','true'); $('access').hidden=false;
  if(message) formMsg('colab-msg',message);
  hideBoot();
}
function hideBoot(){
  const boot=$('boot'); if(!boot||boot.classList.contains('out'))return;
  const portalTransition=boot.dataset.mode==='portal'&&!$('portal').hidden;
  if(portalTransition){
    $('portal').classList.remove('portal-entering');
    void $('portal').offsetWidth;
    $('portal').classList.add('portal-entering');
    clearTimeout($('portal')._enterTimer);
    $('portal')._enterTimer=setTimeout(()=>$('portal').classList.remove('portal-entering'),420);
  }
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    boot.classList.add('out'); boot.setAttribute('aria-busy','false');
    boot._hideTimer=setTimeout(()=>{boot.hidden=true;boot.dataset.mode='loading';$('boot-text-label').textContent='Cargando'},220);
  }));
}
function showBoot(mode='loading'){
  const boot=$('boot'); if(!boot)return;
  clearTimeout(boot._hideTimer); boot.hidden=false; boot.setAttribute('aria-busy','true');
  boot.dataset.mode=mode;
  $('boot-text-label').textContent={auth:'Verificando tu acceso',portal:'Preparando tu espacio',loading:'Cargando'}[mode]||'Cargando';
  boot.classList.remove('out');
}

const REMEMBER_DNI_KEY='kja_remember_dni';
const LOGIN_HELP={
  collaborator:'Ingresa con tu DNI y PIN de asistencia.',
  admin:'Ingresa con tu correo y contraseña institucional.'
};

function switchLogin(admin,focusField=true){
  $('tab-colab').classList.toggle('active',!admin); $('tab-admin').classList.toggle('active',admin);
  $('tab-colab').setAttribute('aria-selected',String(!admin)); $('tab-admin').setAttribute('aria-selected',String(admin));
  $('tab-colab').tabIndex=admin?-1:0; $('tab-admin').tabIndex=admin?0:-1;
  $('form-colab').hidden=admin; $('form-admin').hidden=!admin;
  $('login-help-text').textContent=admin?LOGIN_HELP.admin:LOGIN_HELP.collaborator;
  if(focusField)setTimeout(()=>$(admin?'admin-email':'dni').focus(),30);
}
$('tab-colab').onclick=()=>switchLogin(false); $('tab-admin').onclick=()=>switchLogin(true);
$('tab-admin').tabIndex=-1;
document.querySelector('.login-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault(); const admin=event.key==='ArrowRight'; switchLogin(admin,false); $(admin?'tab-admin':'tab-colab').focus();
});
document.querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>{
  const input=$(b.dataset.reveal),show=input.type==='password';
  input.type=show?'text':'password'; b.classList.toggle('showing',show);
  const label=show?'Ocultar':'Mostrar'; b.querySelector('span').textContent=label;
  b.setAttribute('aria-label',`${label} ${b.dataset.reveal==='pin'?'PIN':'contraseña'}`);
});
['dni','pin'].forEach(id=>$(id).addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,id==='dni'?8:4)));

function loadRememberedDni(){
  const dni=localStorage.getItem(REMEMBER_DNI_KEY)||'';
  if(/^\d{8}$/.test(dni)){
    $('dni').value=dni;
    $('remember-dni').checked=true;
  }
}

$('remember-dni').addEventListener('change',event=>{
  if(event.target.checked){
    const dni=$('dni').value.trim();
    if(/^\d{8}$/.test(dni))localStorage.setItem(REMEMBER_DNI_KEY,dni);
  }else localStorage.removeItem(REMEMBER_DNI_KEY);
});
$('dni').addEventListener('input',event=>{
  if($('remember-dni').checked&&/^\d{8}$/.test(event.target.value))localStorage.setItem(REMEMBER_DNI_KEY,event.target.value);
});
loadRememberedDni();

function loginText(data){
  if(data?.motivo==='sin_clave') return 'Todavía no tienes un PIN. Créalo desde el enlace de marcado que comparte Dirección.';
  if(data?.motivo==='bloqueado') return `El acceso está bloqueado por varios intentos. Vuelve en ${data.minutos||15} min.`;
  if(data?.motivo==='usa_tu_cuenta') return 'Esta persona tiene una cuenta administrativa. Ingresa desde la pestaña Dirección.';
  if(data?.motivo==='falta_configurar_secreto') return 'El portal todavía no terminó de configurarse en el servidor.';
  if(data?.motivo==='credenciales') return data.restantes!=null ? `DNI o PIN incorrecto. Te quedan ${data.restantes} intento${data.restantes===1?'':'s'}.` : 'DNI o PIN incorrecto.';
  return 'No se pudo ingresar. Revisa tu conexión e inténtalo otra vez.';
}

$('form-colab').addEventListener('submit',async e=>{
  e.preventDefault(); formMsg('colab-msg','');
  const dni=$('dni').value, pin=$('pin').value, btn=$('btn-colab');
  if(dni.length!==8||pin.length!==4) return formMsg('colab-msg','Escribe los 8 dígitos de tu DNI y tu PIN de 4 dígitos.');
  setBusy(btn,true,'Verificando…');
  showBoot('auth');
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/dash-entrar',{
      method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+SUPABASE_ANON,'Content-Type':'application/json'},
      body:JSON.stringify({dni,pin})
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data?.ok){ hideBoot(); formMsg('colab-msg',loginText(data)); if(data?.motivo==='usa_tu_cuenta') switchLogin(true); return; }
    const {data:auth,error}=await db.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
    if(error) throw error;
    localStorage.setItem(DEADLINE_KEY,data.vence_at);
    $('pin').value=''; showPortalBootstrap(); await openPortal(auth?.session,{inicio:data.inicio,acceso:data.acceso});
  }catch(err){ if($('portal').dataset.loading==='true')showAccess();else hideBoot(); formMsg('colab-msg','No se pudo conectar con el portal. Revisa tu señal e inténtalo otra vez.'); }
  finally{ setBusy(btn,false,''); }
});

$('form-admin').addEventListener('submit',async e=>{
  e.preventDefault(); formMsg('admin-msg',''); const btn=$('btn-admin'); setBusy(btn,true,'Ingresando…');
  showBoot('auth');
  try{
    const {data:auth,error}=await db.auth.signInWithPassword({email:$('admin-email').value.trim().toLowerCase(),password:$('admin-pass').value});
    if(error){ hideBoot(); formMsg('admin-msg','Correo o contraseña incorrectos.'); return; }
    localStorage.removeItem(DEADLINE_KEY); $('admin-pass').value=''; showPortalBootstrap(); await openPortal(auth?.session);
  }catch(err){
    if($('portal').dataset.loading==='true')showAccess();else hideBoot(); formMsg('admin-msg','No se pudo conectar con el portal. Revisa tu señal e inténtalo otra vez.');
  }finally{
    setBusy(btn,false,'');
  }
});

async function logout(message){
  clearInterval(APP.sessionTimer);clearInterval(APP.markTimer);clearInterval(APP.notificationTimer);clearInterval(DASH_VERSION_TIMER);if(APP.notificationChannel){void db.removeChannel(APP.notificationChannel);APP.notificationChannel=null}document.title=BASE_DOCUMENT_TITLE;localStorage.removeItem(DEADLINE_KEY);localStorage.removeItem(SHELL_KEY);
  try{ await db.auth.signOut({scope:'local'}); }catch(e){}
  location.reload();
}
$('logout').onclick=()=>logout();

function paintShell(view){
  APP.view=view;
  $('portal').dataset.view=view;
  const returnsHome=view!=='inicio'&&APP.identity.hasPersonal;
  $('mobile-back-home').hidden=!returnsHome;
  $('menu-toggle').hidden=returnsHome;
  document.querySelectorAll('.view').forEach(v=>{v.hidden=v.id!==`view-${view}`;v.classList.toggle('active',!v.hidden)});
  document.querySelectorAll('.side-nav button').forEach(b=>{
    const active=b.dataset.view===view;
    b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  $('portal').classList.toggle('admin-wide',view==='gestion');
}

function primeCachedShell(session,fallback){
  let view=fallback;
  try{
    const cached=JSON.parse(localStorage.getItem(SHELL_KEY)||'null');
    if(cached?.uid===session?.user?.id&&['inicio','equipo','gestion'].includes(cached.view))view=cached.view;
  }catch(e){}
  if(!['inicio','equipo','gestion'].includes(view))return;
  paintShell(view);
  if(view==='gestion'){$('nav-gestion').hidden=false;$('admin-nav-divider').hidden=false}
  else if(view==='equipo'){$('nav-equipo').hidden=false;$('team-nav-divider').hidden=false}
  else ['personal-nav-divider','nav-inicio','nav-asistencia','nav-perfil'].forEach(id=>$(id).hidden=false);
  $('access').hidden=true; $('portal').hidden=false;
  hideBoot();
}

async function init(){
  const {data:{session}}=await db.auth.getSession();
  const deadline=Date.parse(localStorage.getItem(DEADLINE_KEY)||'');
  if(session && (!Number.isFinite(deadline)||deadline>Date.now())){
    primeCachedShell(session,Number.isFinite(deadline)?'inicio':'gestion');
    return openPortal(session);
  }
  if(session && Number.isFinite(deadline)&&deadline<=Date.now()) await db.auth.signOut({scope:'local'});
  showAccess();
}

async function openPortal(activeSession,bootstrap=null){
  const session=activeSession||(await db.auth.getSession()).data.session;
  let data=bootstrap?.inicio?.ok?bootstrap.inicio:null,error=null,access=bootstrap?.acceso||null;
  if(!data){
    const accessRequest=session?.user?.id
      ? db.from('asis_perfiles').select('rol,acceso_panel').eq('id',session.user.id).maybeSingle()
      : Promise.resolve({data:null,error:null});
    const [inicioRes,accessRes]=await Promise.all([db.rpc('dash_inicio'),accessRequest]);
    data=inicioRes.data;error=inicioRes.error;access=accessRes.data;
  }else if(!access&&session?.user?.id){
    access=(await db.from('asis_perfiles').select('rol,acceso_panel').eq('id',session.user.id).maybeSingle()).data;
  }
  if(error||!data?.ok){
    await db.auth.signOut({scope:'local'}).catch(()=>{});
    return showAccess(error ? 'El dashboard todavía no está habilitado en la base de datos.' : 'Tu sesión venció. Vuelve a ingresar.');
  }
  APP.inicio=data;
  APP.access={rol:access?.rol||'visor',acceso_panel:!!access?.acceso_panel};
  const now=new Date(), lima=new Date(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'numeric',day:'numeric'}).format(now));
  APP.year=lima.getFullYear(); APP.month=lima.getMonth()+1;
  $('access').hidden=true;
  const p=data.perfil||{}, c=data.colaborador;
  const name=c?.nombre||p.nombre||'Equipo KJA', ini=initials(name), role={sistemas:'Administrador de sistemas',lider:'Líder técnico',colider:'Co-líder técnico',miembro:'Colaborador'}[p.nivel]||'Colaborador';
  APP.identity={nivel:p.nivel||'miembro',hasPersonal:!!c,isLeader:['lider','colider'].includes(p.nivel)&&!!c,isSystem:p.nivel==='sistemas'};
  $('portal').dataset.role=APP.identity.nivel;
  $('portal').dataset.access=APP.access.rol;
  $('portal').dataset.personal=String(APP.identity.hasPersonal);
  document.querySelectorAll('.mobile-inline-home').forEach(button=>button.hidden=!APP.identity.hasPersonal);
  $('side-name').textContent=name; $('side-role').textContent=role; $('side-avatar').textContent=ini; $('mobile-avatar').textContent=ini;
  if($('head-avatar'))$('head-avatar').textContent=ini;
  $('rail-name').textContent=name; $('rail-role').textContent=role; $('rail-avatar').textContent=ini;
  $('mobile-home-name').textContent=name;
  $('mobile-home-avatar').textContent=ini;
  $('mobile-home-role').textContent=role;
  $('mobile-home-area').textContent=c?.area||'Equipo KJA';
  $('mobile-home-dni').textContent=c?.dni?`DNI ${c.dni}`:'Perfil institucional';
  ['personal-nav-divider','nav-inicio','nav-asistencia','nav-perfil'].forEach(id=>$(id).hidden=!APP.identity.hasPersonal);
  $('team-nav-divider').hidden=!APP.identity.isLeader;$('nav-equipo').hidden=!APP.identity.isLeader;
  $('nav-gestion').hidden=!APP.access.acceso_panel; $('admin-nav-divider').hidden=!APP.access.acceso_panel;
  window.KJAMarketingPortal?.init();
  window.KJAChat?.init(session?.user?.id);
  $('mobile-action-team').hidden=!APP.identity.isLeader;
  $('mobile-action-admin').hidden=!APP.access.acceso_panel;
  syncMobileQuickGrid();
  $('admin-role-chip').textContent=({direccion:'Dirección',editor:'Encargado(a)',visor:'Solo lectura'}[APP.access.rol]||APP.access.rol);
  const deviceModule=$('admin-device-module'); if(deviceModule)deviceModule.hidden=APP.access.rol!=='direccion';
  const controlModule=$('admin-control-module'); if(controlModule)controlModule.hidden=APP.access.rol!=='direccion';
  $('admin-access-tab').hidden=APP.access.rol!=='direccion';
  $('admin-control-tab').hidden=APP.access.rol!=='direccion';
  $('admin-ranking-tab').hidden=APP.access.rol!=='direccion';
  $('admin-facebook-tab').hidden=APP.access.rol!=='direccion';
  const managesRoles=APP.identity.isSystem&&APP.access.rol==='direccion'&&APP.access.acceso_panel;
  $('admin-roles-tab').hidden=!managesRoles; const rolesModule=$('admin-roles-module'); if(rolesModule)rolesModule.hidden=!managesRoles;
  if(c){ renderHome(); renderProfile(); }
  else if(APP.access.acceso_panel){
    $('rail-area').textContent='Vista de Dirección';
    $('rail-schedule-list').innerHTML='<p class="rail-empty">Esta cuenta administra la asistencia del equipo.</p>';
  }else if(APP.identity.isLeader){
    $('rail-area').textContent='Vista de Dirección';
    $('rail-month').textContent='Vista general';
    $('rail-calendar-grid').innerHTML='';
    $('rail-schedule-list').innerHTML='<p class="rail-empty">Esta cuenta no está vinculada a una jornada personal.</p>';
    $('rail-rate-note').textContent='Consulta el estado desde Mi equipo';
  }
  const initialView=APP.identity.isSystem&&APP.access.acceso_panel?'gestion':c?'inicio':APP.access.acceso_panel?'gestion':APP.identity.isLeader?'equipo':'inicio';
  const initialLoad=goView(initialView);
  try{localStorage.setItem(SHELL_KEY,JSON.stringify({uid:session?.user?.id||'',view:initialView}))}catch(e){}
  $('portal').hidden=false; $('portal').inert=false; $('portal').removeAttribute('aria-hidden');
  resetPortalBootstrap(true); startSessionClock(); hideBoot();
  startMarkSync();
  startReviewNotificationSync();
  startDashboardVersionWatch();
  const backgroundLoads=[];
  if(c)backgroundLoads.push(loadHistory(),loadProfilePhoto());
  if(initialLoad?.then)backgroundLoads.push(initialLoad);
  if(backgroundLoads.length)void Promise.allSettled(backgroundLoads);
  try{
    if(window.KJAAnnouncementModal){
      const currentUserData=Object.assign({},c||{},p||{},{
        id:c?.id||session?.user?.id||p?.id,
        dia:data?.dia||null,
        dias_laborables:c?.dias_laborables||[],
        horario_semanal:c?.horario_semanal||{}
      });
      window.KJAAnnouncementModal.checkAndShow(currentUserData);
    }
  }catch(announcementErr){console.warn('No se pudo verificar el anuncio emergente:',announcementErr);}
}

function startSessionClock(){
  clearInterval(APP.sessionTimer);
  const tick=()=>{
    const raw=localStorage.getItem(DEADLINE_KEY), end=Date.parse(raw||'');
    const label=$('session-left');
    if(!Number.isFinite(end)){ if(label)label.textContent='activa'; return; }
    const ms=end-Date.now(); if(ms<=0) return logout('Tu sesión venció.');
    const h=Math.floor(ms/3600000),m=Math.ceil((ms%3600000)/60000);if(label)label.textContent=h?`${h} h ${m} min`:`${m} min`;
  }; tick(); APP.sessionTimer=setInterval(tick,30000);
}

function syncMobileQuickGrid(){
  const grid=document.querySelector('.mobile-quick-grid');if(!grid)return;
  const cards=[...grid.children].filter(card=>!card.hidden);
  grid.querySelectorAll('.is-grid-orphan').forEach(card=>card.classList.remove('is-grid-orphan'));
  if(cards.length%2===1)cards.at(-1)?.classList.add('is-grid-orphan');
  grid.dataset.visibleItems=String(cards.length);
}

function renderHome(){
  const c=APP.inicio.colaborador,d=APP.inicio.dia||{}; if(!c) return;
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',hour:'2-digit',hour12:false}).format(new Date()));
  const greeting=hour<12?'Buenos días':hour<19?'Buenas tardes':'Buenas noches';
  $('welcome').textContent=`${greeting}, ${c.nombre.split(' ')[0]}`;
  $('welcome-sub').textContent=d.marcado?'Tu entrada de hoy ya quedó registrada.':'Aquí tienes lo importante de tu jornada.';
  $('welcome-area').textContent=c.area||'Equipo KJA';
  const date=new Date((d.fecha||isoLima())+'T12:00:00');
  if($('today-label'))$('today-label').textContent=dayNames[date.getDay()].toUpperCase();
  $('day-date').textContent=new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'long',year:'numeric'}).format(date);
  $('mobile-today-date').textContent=new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long'}).format(date);
  $('time-start').textContent=fmtTime(d.hora_entrada); $('time-end').textContent=fmtTime(d.hora_salida);
  renderMobileTimeRecord({entryAt:d.marcado_at,scheduledExit:d.hora_salida});
  renderTodayMode(d);
  $('day-window').textContent=d.tolerancia!=null?`Tolerancia: ${d.tolerancia} min`:'Horario registrado';
  $('rail-area').textContent=c.area||'Equipo KJA';
  renderRailSchedule(d);
  positionNow(d);
  startShiftClock(d);
  const pill=$('day-status'),btn=$('open-mark'),card=$('today-attendance-card'),markTitle=$('attendance-state-title'),markCaption=$('mark-caption');
  pill.className='status-pill';btn.disabled=false;btn.classList.remove('is-view');btn.setAttribute('aria-label','Marcar mi asistencia');$('mark-action-check').hidden=false;$('mark-action-view').hidden=true;card.dataset.attendanceState='pending';
  if(d.marcado){
    const label={P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestionó'}[d.estado]||'Registrado';
    pill.textContent=label;pill.classList.add(d.estado==='T'?'late':d.estado==='NG'?'closed':'ok');btn.classList.add('is-view');btn.setAttribute('aria-label','Ver detalle de mi asistencia');$('mark-action-check').hidden=true;$('mark-action-view').hidden=false;card.dataset.attendanceState=d.estado==='T'?'late':d.estado==='NG'?'closed':'marked';markTitle.textContent=d.estado==='NG'?'La jornada quedó sin gestionar':'Tu asistencia está registrada';
    markCaption.textContent=d.estado==='NG'?'VER ESTADO':'VER DETALLE'; $('mark-label').textContent=`Marcado${d.marcado_at?' · '+new Date(d.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):''}`;
    $('mark-help').textContent='El registro ya forma parte de tu historial.';
  }else if(!d.labora){ pill.textContent='Día no laborable'; pill.classList.add('closed'); btn.disabled=true; card.dataset.attendanceState='off'; markTitle.textContent='Hoy no necesitas marcar'; markCaption.textContent='ESTADO DE HOY'; $('mark-label').textContent='Sin marcado programado'; $('mark-help').textContent='Tu horario indica que hoy no gestionas.'; }
  else if(d.horario_completo===false||d.ventana==='sin_horario'){ pill.textContent='Horario por revisar'; pill.classList.add('closed'); btn.disabled=true; card.dataset.attendanceState='closed'; markTitle.textContent='Tu horario está incompleto'; markCaption.textContent='REVISIÓN NECESARIA'; $('mark-label').textContent='Marcado no disponible'; $('mark-help').textContent='Dirección debe completar tu hora de entrada y salida.'; }
  else if(d.modalidad==='presencial'&&!d.geocerca_configurada){ pill.textContent='Ubicación pendiente'; pill.classList.add('closed'); btn.disabled=true; card.dataset.attendanceState='closed'; markTitle.textContent='La oficina aún no está configurada'; markCaption.textContent='REVISIÓN DE DIRECCIÓN'; $('mark-label').textContent='Marcado presencial bloqueado'; $('mark-help').textContent='Dirección debe guardar el punto oficial antes de habilitar la geocerca.'; }
  else if(d.ventana==='antes'){ pill.textContent='Aún no abre'; btn.disabled=true; card.dataset.attendanceState='before'; markTitle.textContent='Tu ventana aún no abre'; markCaption.textContent='PRÓXIMA APERTURA'; $('mark-label').textContent=`Disponible desde las ${fmtTime(d.hora_entrada)}`; $('mark-help').textContent='El botón se habilita al comenzar tu jornada.'; }
  else if(d.ventana==='cerrada'){ pill.textContent='Fuera de horario'; pill.classList.add('closed'); btn.disabled=true; card.dataset.attendanceState='closed'; markTitle.textContent='Tu jornada programada finalizó'; markCaption.textContent='JORNADA FINALIZADA'; $('mark-label').textContent='Registro no disponible ahora'; $('mark-help').textContent=`Tu horario terminó a las ${fmtTime(d.hora_salida)}. Si tu turno cambió, avisa a Dirección.`; }
  else{ const presencial=d.modalidad==='presencial';pill.textContent=d.ventana==='tardanza'?'Tardanza':presencial?'Presencial':'Pendiente'; if(d.ventana==='tardanza') pill.classList.add('late'); card.dataset.attendanceState=d.ventana==='tardanza'?'late':'open'; markTitle.textContent=d.ventana==='tardanza'?'Aún puedes registrar tu ingreso':presencial?'Valida tu llegada a la oficina':'Todo listo para marcar'; markCaption.textContent=d.ventana==='tardanza'?'MARCAR AHORA · TARDANZA':presencial?'VERIFICAR Y MARCAR':'MARCAR AHORA'; $('mark-label').textContent=presencial?'Comprobar ubicación':'Registrar mi asistencia'; $('mark-help').textContent=presencial?'Se habilitará al confirmar que estás dentro del radio de 1 km.':'La hora se registra directamente desde el servidor.'; }
  const mobileStatus=$('mobile-today-status'),mobileMark=$('mobile-action-mark');
  mobileStatus.className='mobile-today-status';
  mobileStatus.textContent=pill.textContent;
  if(pill.classList.contains('ok'))mobileStatus.classList.add('ok');
  if(pill.classList.contains('late'))mobileStatus.classList.add('late');
  if(pill.classList.contains('closed'))mobileStatus.classList.add('closed');
  mobileMark.disabled=btn.disabled;
  $('mobile-action-mark-title').textContent=d.marcado?'Ver mi asistencia':btn.disabled?'Marcado no disponible':'Marcar asistencia';
  $('mobile-action-mark-note').textContent=d.marcado?$('mark-label').textContent:btn.disabled?pill.textContent:'Registrar ahora';
  $('mobile-today-detail').textContent=`${$('day-mode').textContent} · ${$('mark-help').textContent}`;
  paintTimeAmbience();
}

function renderTodayMode(d={}){
  const choices=document.querySelectorAll('.today-mode-choice-container');
  if(!choices.length)return;
  const laborable=!!d.labora,mode=d.modalidad==='presencial'?'presencial':laborable?'virtual':'no_gestiona',locked=!!d.marcado||!laborable;

  const dayModeTitle=$('day-mode');
  if(dayModeTitle) dayModeTitle.textContent=mode==='presencial'?'Trabajo presencial':mode==='virtual'?'Trabajo virtual':'Día no laborable';

  choices.forEach(choice => {
    choice.dataset.mode=mode;
    choice.dataset.locked=String(locked);
    const virtual=choice.querySelector('[data-today-mode="virtual"]');
    const office=choice.querySelector('[data-today-mode="presencial"]');
    if(virtual&&office){
      [virtual,office].forEach(button=>{
        const selected=laborable&&button.dataset.todayMode===mode;
        button.setAttribute('aria-checked',String(selected));
        button.disabled=locked||MODE_BUSY;
      });
    }
    const help=choice.querySelector('.today-mode-help');
    if(help){
      if(!laborable)help.textContent='Hoy no tienes una jornada programada.';
      else if(d.marcado)help.textContent='La modalidad quedó fijada al registrar tu asistencia.';
      else if(MODE_BUSY)help.textContent='Guardando tu modalidad…';
      else if(mode==='presencial'&&!d.geocerca_configurada)help.textContent='Dirección debe configurar la ubicación de la oficina.';
      else if(mode==='presencial')help.textContent=`Para marcar deberás estar dentro de ${Number(d.radio_presencial_m||1000)/1000} km de la oficina.`;
      else help.textContent=d.modalidad_elegida?'Elegiste trabajar virtual hoy.':'Puedes cambiarla si asistes a la oficina.';
    }
  });
}

async function changeTodayMode(mode){
  const day=APP.inicio?.dia||{};
  if(MODE_BUSY||MARK_BUSY||day.marcado||!day.labora||!['virtual','presencial'].includes(mode))return;
  if((day.modalidad==='presencial'?'presencial':'virtual')===mode)return;
  MODE_BUSY=true;renderTodayMode(day);
  try{
    const {data,error}=await db.rpc('dash_modalidad_hoy',{p_protocolo:MARK_PROTOCOL,p_modalidad:mode});
    if(error){
      const missing=error.code==='PGRST202'||String(error.message||'').includes('dash_modalidad_hoy');
      throw Object.assign(new Error(missing?'proteccion_no_disponible':'servidor'),{motivo:missing?'proteccion_no_disponible':'servidor'});
    }
    if(!data?.ok)throw Object.assign(new Error(data?.motivo||'servidor'),{motivo:data?.motivo||'servidor'});
    if(data.dia)APP.inicio.dia=data.dia;
    MARK_GEO=null;renderHome();
    if(!$('mark-modal').hidden) openMarkModal();
    toast(mode==='presencial'?'Hoy trabajarás presencial. La ubicación se verificará al marcar.':'Hoy trabajarás virtual. Tu evidencia seguirá siendo obligatoria.');
  }catch(error){toast(markFailureMessage(error.motivo),true);}
  finally{MODE_BUSY=false;renderTodayMode(APP.inicio?.dia||day);}
}

function minutes(t){ if(!t) return null; const [h,m]=String(t).split(':').map(Number); return h*60+m; }
function positionNow(d){
  const start=minutes(d.hora_entrada),end=minutes(d.hora_salida),now=minutes(d.ahora);
  let pct=50;
  if(start!=null&&end!=null&&end>start&&now!=null) pct=Math.max(0,Math.min(100,(now-start)/(end-start)*100));

  const track=document.querySelector('.arc-track');
  const progress=document.getElementById('arc-progress');
  const dot=document.getElementById('arc-now-dot');
  const glow=document.getElementById('arc-now-glow');
  const labelG=document.getElementById('arc-now-label');

  if(!track||!progress) return;
  const len=track.getTotalLength();

  // Animate progress stroke
  progress.style.strokeDasharray=len;
  progress.style.strokeDashoffset=len*(1-pct/100);

  // Position now dot along arc
  const pt=track.getPointAtLength(len*pct/100);
  if(dot){ dot.setAttribute('cx',pt.x); dot.setAttribute('cy',pt.y); }
  if(glow){ glow.setAttribute('cx',pt.x); glow.setAttribute('cy',pt.y); }

  // Position 'Ahora' label below the dot
  if(labelG){
    const r=labelG.querySelector('rect');
    const t=labelG.querySelector('text');
    const lw=34, lh=16;
    if(r){ r.setAttribute('x',pt.x-lw/2); r.setAttribute('y',pt.y+12); r.setAttribute('width',lw); r.setAttribute('height',lh); }
    if(t){ t.setAttribute('x',pt.x); t.setAttribute('y',pt.y+12+lh/2+3); }
  }
}

/* ── Countdown de Jornada ── */
let _clockInterval=null;
function startShiftClock(d){
  if(_clockInterval){clearInterval(_clockInterval);_clockInterval=null;}
  const clock=$('shift-clock'); if(!clock)return;
  const label=$('clock-label'), caption=$('clock-caption');
  const endM=minutes(d.hora_salida), startM=minutes(d.hora_entrada);

  if(endM==null||startM==null||!d.labora){
    clock.classList.add('ended');
    if(label) label.textContent='Sin jornada programada';
    if(caption) caption.textContent='Hoy no tienes turno asignado';
    return;
  }

  function pad(n){return String(n).padStart(2,'0');}
  function setDigit(id,val){
    const el=$(id); if(!el)return;
    const s=el.querySelector('span');
    if(s&&s.textContent!==val){s.textContent=val;el.classList.remove('tick');void el.offsetWidth;el.classList.add('tick');}
  }
  function limaSeconds(){
    const now=new Date();
    const p=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now).split(':');
    return Number(p[0])*3600+Number(p[1])*60+Number(p[2]);
  }
  const endSec=endM*60, startSec=startM*60;

  function tick(){
    const nowSec=limaSeconds();
    let remain;
    if(nowSec<startSec){
      remain=startSec-nowSec;
      clock.classList.remove('ended');
      if(label) label.textContent='Tu jornada inicia en';
      if(caption) caption.textContent='El contador comenzará al iniciar tu turno';
    } else if(nowSec>=endSec){
      remain=0;
      clock.classList.add('ended');
      if(label) label.textContent='Jornada finalizada';
      if(caption) caption.textContent='Tu turno de hoy ha concluido ✓';
      setDigit('clock-h','00');setDigit('clock-m','00');setDigit('clock-s','00');
      clearInterval(_clockInterval);_clockInterval=null;
      return;
    } else {
      remain=endSec-nowSec;
      clock.classList.remove('ended');
      if(label) label.textContent='Tiempo restante de jornada';
      if(caption) caption.textContent=`Hasta las ${d.hora_salida} · hora del servidor`;
    }
    const h=Math.floor(remain/3600);
    const m=Math.floor((remain%3600)/60);
    const s=remain%60;
    setDigit('clock-h',pad(h));setDigit('clock-m',pad(m));setDigit('clock-s',pad(s));
  }
  tick();
  _clockInterval=setInterval(tick,1000);
}

function renderRailSchedule(d){
  const marked=d.marcado?`Registrado · ${d.marcado_at?new Date(d.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):statusLabel(d.estado,true)}`:(d.labora?'Pendiente de registro':'Día no laborable');
  const mode=({virtual:'Virtual',presencial:'Presencial',opcional:'Opcional',no_gestiona:'No gestiona'}[d.modalidad]||cap(d.modalidad||'Sin modalidad'));
  const nowM = minutes(d.ahora);
  const startM = minutes(d.hora_entrada);
  const endM = minutes(d.hora_salida);
  const started = startM != null && nowM != null && nowM >= startM;
  const ended = endM != null && nowM != null && nowM >= endM;

  $('rail-schedule-list').innerHTML=`
    <article class="rail-task ${started ? 'is-done' : 'is-ready'}">
      <span class="task-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
      <div class="task-body">
        <div class="task-header"><b>Inicio de jornada</b><span class="task-pill">${esc(fmtTime(d.hora_entrada))}</span></div>
        <small>${esc(mode)} · Turno programado</small>
      </div>
    </article>
    <article class="rail-task ${d.marcado ? 'is-done' : (d.labora ? 'is-pending' : 'is-off')}">
      <span class="task-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
      <div class="task-body">
        <div class="task-header"><b>Registrar asistencia</b><span class="task-pill ${d.marcado ? 'pill-done' : 'pill-alert'}">${d.marcado ? 'Completado' : 'Por marcar'}</span></div>
        <small>${esc(marked)}</small>
      </div>
    </article>
    <article class="rail-task ${ended ? 'is-done' : 'is-future'}">
      <span class="task-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
      <div class="task-body">
        <div class="task-header"><b>Cierre de jornada</b><span class="task-pill">${esc(fmtTime(d.hora_salida))}</span></div>
        <small>${ended ? 'Jornada concluida' : 'Horario registrado'}</small>
      </div>
    </article>`;
}

async function loadHistory(){
  const {data,error}=await db.rpc('dash_historial',{p_anio:APP.year,p_mes:APP.month});
  if(error||!data?.ok){ toast('No se pudo cargar el historial.',true); return; }
  APP.historial=data; renderHistory(); renderProgress();
}

function renderProgress(){
  const h=APP.historial;if(!h)return; const done=Number(h.horas)||0,goal=Number(h.meta)||0,pct=goal?Math.min(100,done/goal*100):0;
  $('hours-done').textContent=done.toFixed(done%1?1:0); if($('hours-goal'))$('hours-goal').textContent=goal||'—'; $('hours-bar').style.transform=`scaleX(${pct/100})`;
  $('hours-progress-track').setAttribute('aria-valuenow',String(Math.round(pct)));
  $('hours-accredited-detail').textContent=`${done.toFixed(1)} h`;
  $('hours-goal-detail').textContent=goal?`${goal.toFixed(0)} h`:'Sin meta';
  $('hours-rate').textContent=goal?`${pct.toFixed(0)}% completado`:'Sin meta configurada';
  if($('hours-note'))$('hours-note').textContent=goal?`Restan ${Math.max(0,goal-done).toFixed(1)} h para alcanzar tu objetivo mensual.`:'Dirección aún no definió una meta de horas.';
  $('hours-ring').style.setProperty('--hours-angle',`${pct*3.6}deg`); $('hours-ring').setAttribute('aria-label',goal?`${done} de ${goal} horas, ${pct.toFixed(0)} por ciento completado`:`${done} horas acumuladas, sin meta configurada`);
  const t=h.totales||{},att=(t.P||0)+(t.T||0)+(t.J||0),rate=t.laborables?Math.round(att/t.laborables*100):0;
  $('rail-rate').textContent=t.laborables?rate+'%':'—'; $('rail-rate-note').textContent=`${att} de ${t.laborables||0} días registrados`;
  renderDashboardMonthProgress(h);
}

function renderDashboardMonthProgress(h){
  const daysElement=$('dashboard-month-days');
  if(!daysElement)return;
  const totals=h.totales||{},total=Math.max(0,Number(totals.laborables)||0),registered=(Number(totals.P)||0)+(Number(totals.T)||0)+(Number(totals.J)||0),incompleteCount=Math.max(0,Number(totals.incompletas)||0);
  const workdays=(h.dias||[]).filter(day=>day.lab);
  daysElement.innerHTML=workdays.length?workdays.map(day=>{
    const incomplete=day.cierre_estado==='incompleta',state=incomplete?'incomplete':day.futuro?'future':(day.estado||'pending').toLowerCase(),today=day.fecha===h.hoy,weekday=new Intl.DateTimeFormat('es-PE',{weekday:'short'}).format(new Date(`${day.fecha}T12:00:00`)).replace('.','').slice(0,2);
    const label=incomplete?'Jornada incompleta':statusLabel(day.estado,day.lab);
    const accessibleLabel=`${day.d} de ${monthNames[h.mes-1]}: ${label}${today?', hoy':''}`;
    return `<span class="dashboard-month-day ${esc(state)}${today?' today':''}" title="${esc(accessibleLabel)}" aria-label="${esc(accessibleLabel)}">${incomplete?'<em aria-hidden="true">!</em>':''}<b>${esc(day.d)}</b><small>${esc(weekday)}</small></span>`;
  }).join(''):'<span class="dashboard-month-empty">Sin días laborables este mes</span>';
  daysElement.setAttribute('aria-label',total?`${registered} de ${total} días laborables registrados${incompleteCount?`; ${incompleteCount} ${incompleteCount===1?'jornada incompleta':'jornadas incompletas'}`:''}`:'Sin días laborables este mes');
  requestAnimationFrame(()=>daysElement.querySelector('.today')?.scrollIntoView({block:'nearest',inline:'center'}));
}

function renderHistory(){
  const h=APP.historial;if(!h)return; const monthLabel=cap(`${monthNames[h.mes-1]} ${h.anio}`);$('month-title').textContent=monthLabel;$('mobile-month-title').textContent=monthLabel;
  const t=h.totales||{},items=[['Presentes',t.P||0,''],['Tardanzas',t.T||0,''],['Justificados',t.J||0,''],['No gestionó',t.NG||0,''],['Incompletas',t.incompletas||0,'incomplete']];
  $('attendance-stats').innerHTML=items.map(x=>`<div class="att-stat ${x[2]}"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join('');
  $('attendance-hours-summary').textContent=`${(Number(h.horas)||0).toFixed(1)} h acumuladas`;
  const first=new Date(h.anio,h.mes-1,1).getDay(),offset=(first+6)%7; let html='<span class="cal-day empty"></span>'.repeat(offset);
  for(const d of h.dias||[]){
    const incomplete=d.cierre_estado==='incompleta',cls=incomplete?'incomplete':(d.estado||'').toLowerCase(),label=d.futuro?'Próximo':incomplete?'Jornada incompleta':statusLabel(d.estado,d.lab),today=d.fecha===h.hoy;
    html+=`<button type="button" class="cal-day ${cls} ${d.futuro?'future':''} ${!d.lab?'off':''} ${today?'today':''}" data-history-date="${esc(d.fecha)}" aria-label="${esc(`${d.d} de ${monthNames[h.mes-1]}: ${label}${today?', hoy':''}`)}"><span class="cal-day-top"><b>${d.d}</b>${today?'<em>Hoy</em>':'<i aria-hidden="true"></i>'}</span><small>${esc(label)}</small></button>`;
  }
  $('calendar-grid').innerHTML=html;
  renderRailCalendar(h);
  const currentMonth=h.anio===new Date().getFullYear()&&h.mes===new Date().getMonth()+1;
  $('month-next').disabled=currentMonth;$('mobile-month-next').disabled=currentMonth;
}
function statusLabel(state,lab){ return state?({P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestionó'}[state]||state):(lab?'Sin registro':'No laborable'); }

function formatAttendanceDayDate(value){return value?cap(new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00'))):'Día seleccionado'}
function formatAttendanceClock(value){return value?new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'America/Lima'}).format(new Date(value)):'—'}

function renderMobileTimeRecord({entryAt=null,exitAt=null,scheduledExit=null}={}){
  const entryTime=$('mobile-today-start'),exitTime=$('mobile-today-end');
  if(!entryTime||!exitTime)return;
  const hasEntry=!!entryAt,hasExit=!!exitAt;
  entryTime.textContent=formatAttendanceClock(entryAt);
  exitTime.textContent=formatAttendanceClock(exitAt);
  $('mobile-entry-time-note').textContent=hasEntry?'Hora registrada':'Pendiente de marcar';
  $('mobile-exit-time-note').textContent=hasExit?'Hora registrada':scheduledExit?`Programada: ${fmtTime(scheduledExit)}`:'Pendiente de marcar';
  $('mobile-entry-time-card').classList.toggle('is-recorded',hasEntry);
  $('mobile-exit-time-card').classList.toggle('is-recorded',hasExit);
}
function attendanceModeLabel(value){return ({virtual:'Trabajo virtual',presencial:'Trabajo presencial',no_gestiona:'No laborable'}[value]||value||'Sin modalidad')}
function attendanceOriginLabel(value){return ({dashboard:'Portal personal',portal:'Portal de asistencia',panel:'Registro administrativo'}[value]||value||'Sin origen')}

function closeAttendanceDay(){
  APP.attendanceDayRequest++;
  APP.attendanceDayDate='';
  ATTENDANCE_DAY_EVIDENCES=[];
  ATTENDANCE_EVIDENCE_TRIGGER=null;
  $('attendance-day-modal').querySelector('.attendance-day-sheet').classList.remove('evidence-open');
  $('attendance-day-modal').hidden=true;
  if(ATTENDANCE_DAY_TRIGGER?.isConnected)ATTENDANCE_DAY_TRIGGER.focus({preventScroll:true});
  ATTENDANCE_DAY_TRIGGER=null;
}

function attendanceDayLoading(){
  $('attendance-day-content').innerHTML='<div class="attendance-day-loading" role="status"><i></i><span>Consultando el registro del día…</span></div>';
}

function renderAttendanceDay(data,evidences=[]){
  const state=data.estado||'',label=data.futuro?'Próximo':statusLabel(state,data.labora),stateClass=(state||(!data.labora?'off':'pending')).toLowerCase();
  const request=data.solicitud||null,canJustify=!data.futuro&&data.fecha>=addIsoDays(isoLima(),-90);
  ATTENDANCE_DAY_EVIDENCES=evidences;
  const evidenceHtml=evidences.length?evidences.map((item,index)=>item.url?`<button type="button" class="attendance-day-photo" data-attendance-evidence="${index}" aria-label="Ampliar ${esc(item.label||`evidencia ${index+1}`)}"><span class="attendance-day-photo-canvas"><img src="${esc(item.url)}" alt="${esc(`${item.label||'Evidencia'} del ${formatAttendanceDayDate(data.fecha)}`)}" decoding="async"></span><span class="attendance-day-photo-meta"><b>${esc(item.label||`Evidencia ${index+1}`)}</b><small><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>Ampliar aquí</small></span></button>`:'').join(''):'<div class="attendance-day-no-photo"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h4l1.5-2h5L16 7h4v12H4z"/><circle cx="12" cy="13" r="3"/></svg></span><b>Sin evidencia fotográfica</b><small>Este día no tiene una imagen asociada al registro o a una solicitud.</small></div>';
  const requestHtml=request?`<section class="attendance-day-request"><div><small>SOLICITUD RELACIONADA</small><b>${esc(personalRequestLabel(request.tipo))}</b></div><span class="request-status ${esc(request.estado)}">${esc(request.estado)}</span><p>${esc(request.detalle||'Sin comentario.')}</p>${request.respuesta?`<p class="attendance-day-response"><b>Respuesta de Dirección:</b> ${esc(request.respuesta)}</p>`:''}</section>`:'';
  $('attendance-day-content').innerHTML=`
    <header class="attendance-day-head"><span class="attendance-day-state-icon ${esc(stateClass)}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span><div><h2 id="attendance-day-title">${esc(formatAttendanceDayDate(data.fecha))}</h2><span class="attendance-day-status ${esc(stateClass)}"><i></i>${esc(label)}</span></div></header>
    <div class="attendance-day-layout">
      <div class="attendance-day-details">
        <div class="attendance-day-facts">
          <div><small>HORARIO PROGRAMADO</small><b>${esc(`${fmtTime(data.hora_entrada)} — ${fmtTime(data.hora_salida)}`)}</b><span>${esc(attendanceModeLabel(data.modalidad))}</span></div>
          <div><small>HORA REGISTRADA</small><b>${esc(formatAttendanceClock(data.marcado_at))}</b><span>${esc(attendanceOriginLabel(data.origen))}</span></div>
          <div><small>HORAS DEL DÍA</small><b>${data.horas==null?'—':`${esc(Number(data.horas).toFixed(1))} h`}</b><span>${esc(data.vinculo==='voluntariado'?'Voluntariado':data.vinculo==='practicas'?'Prácticas':'Jornada registrada')}</span></div>
        </div>
        ${data.marcado_at?`<div class="attendance-day-validation"><span><i></i>${esc(data.evidencia_origen==='camara'?'Foto tomada con cámara':data.evidencia_origen==='archivo'?'Imagen seleccionada':'Registro validado')}</span>${data.ubicacion_verificada?`<span><i></i>Oficina verificada${data.distancia_oficina_m!=null?' · '+esc(formatDistance(data.distancia_oficina_m)):''}</span>`:''}${data.dispositivo?`<span title="${esc(data.dispositivo)}"><i></i>${esc(data.dispositivo)}</span>`:''}</div>`:''}
        ${data.nota?`<section class="attendance-day-note"><small>OBSERVACIÓN DEL REGISTRO</small><p>${esc(data.nota)}</p></section>`:''}
        ${requestHtml}
      </div>
      <section class="attendance-day-evidence"><div class="attendance-day-section-title"><span><b>Evidencia</b><small>${evidences.length?`${evidences.length} ${evidences.length===1?'imagen asociada':'imágenes asociadas'}`:'No se adjuntaron imágenes'}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l1.5-2h5L16 7h4v12H4z"/><circle cx="12" cy="13" r="3"/></svg></div><div class="attendance-day-gallery">${evidenceHtml}</div></section>
      <footer class="attendance-day-footer"><span>La información se obtiene del registro privado de asistencia.</span>${canJustify?`<button type="button" id="attendance-day-justify" data-date="${esc(data.fecha)}">${request?'Enviar otra solicitud':'Justificar este día'}</button>`:''}</footer>
    </div>
    <div class="attendance-evidence-viewer" id="attendance-evidence-viewer" role="region" aria-label="Vista ampliada de evidencia" hidden><button type="button" class="attendance-evidence-close" data-close-attendance-evidence aria-label="Cerrar imagen ampliada"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div><div class="attendance-evidence-stage" id="attendance-evidence-stage"></div><p id="attendance-evidence-caption"></p></div></div>`;
}

function openAttendanceEvidence(index,trigger){
  const evidence=ATTENDANCE_DAY_EVIDENCES[index],viewer=$('attendance-evidence-viewer');if(!evidence||!viewer)return;
  ATTENDANCE_EVIDENCE_TRIGGER=trigger||document.activeElement;
  $('attendance-evidence-stage').innerHTML=`<img src="${esc(evidence.url)}" alt="${esc(evidence.label||'Evidencia ampliada')}">`;
  $('attendance-evidence-caption').textContent=evidence.label||'Evidencia';
  const sheet=$('attendance-day-modal').querySelector('.attendance-day-sheet');sheet.scrollTop=0;sheet.classList.add('evidence-open');viewer.hidden=false;
  requestAnimationFrame(()=>viewer.querySelector('.attendance-evidence-close').focus({preventScroll:true}));
}

function closeAttendanceEvidence(){
  const viewer=$('attendance-evidence-viewer');if(!viewer||viewer.hidden)return false;
  viewer.hidden=true;$('attendance-day-modal').querySelector('.attendance-day-sheet').classList.remove('evidence-open');
  $('attendance-evidence-stage').textContent='';
  if(ATTENDANCE_EVIDENCE_TRIGGER?.isConnected)ATTENDANCE_EVIDENCE_TRIGGER.focus({preventScroll:true});
  ATTENDANCE_EVIDENCE_TRIGGER=null;return true;
}

async function openAttendanceDay(date){
  if(!date)return;
  const firstOpen=$('attendance-day-modal').hidden;
  if(firstOpen)ATTENDANCE_DAY_TRIGGER=document.activeElement;
  APP.attendanceDayDate=date;
  const request=++APP.attendanceDayRequest;
  $('attendance-day-modal').hidden=false;
  attendanceDayLoading();
  if(firstOpen)requestAnimationFrame(()=>$('attendance-day-modal').querySelector('.modal-close').focus({preventScroll:true}));
  const {data,error}=await db.rpc('dash_dia_detalle',{p_fecha:date});
  if(request!==APP.attendanceDayRequest)return;
  if(error||!data?.ok){
    $('attendance-day-content').innerHTML=`<div class="attendance-day-error"><span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 17h.01"/></svg></span><h2 id="attendance-day-title">No pudimos abrir este día</h2><p>${error?.message?.includes('dash_dia_detalle')?'Instala o vuelve a ejecutar la migración 11 para habilitar el detalle y las evidencias.':'Inténtalo nuevamente en unos segundos.'}</p><button type="button" data-retry-attendance-day>Reintentar</button></div>`;
    return;
  }
  const evidences=await Promise.all((data.evidencias||[]).map(async item=>{
    const {data:signed}=await db.storage.from(item.bucket).createSignedUrl(item.path,3600);
    return {...item,url:signed?.signedUrl||''};
  }));
  if(request!==APP.attendanceDayRequest)return;
  renderAttendanceDay(data,evidences.filter(item=>item.url));
}

const PERSONAL_REQUEST_TYPES={
  justificacion:{title:'Justificar una ausencia',copy:'Explica lo ocurrido y adjunta una evidencia para que Dirección pueda revisarlo.',label:'Motivo de la justificación',placeholder:'Describe por qué no pudiste asistir y cualquier dato que Dirección deba considerar.',evidence:true},
  dia_libre:{title:'Informar un día libre asignado',copy:'Indica el día que utilizaste, deja constancia y adjunta la evidencia correspondiente.',label:'Detalle del día libre',placeholder:'Indica quién asignó el día libre y cualquier información necesaria para validarlo.',evidence:true},
  cambio_horario:{title:'Solicitar cambio de horario o turno',copy:'Detalla la jornada solicitada y desde qué fecha debería aplicarse.',label:'Nuevo horario o turno solicitado',placeholder:'Ej. cambiar temporalmente al turno de 14:00 a 19:00 durante esta semana.',evidence:false},
  cambio_turno:{title:'Solicitar cambio de horario o turno',copy:'Detalla la jornada solicitada y desde qué fecha debería aplicarse.',label:'Nuevo horario o turno solicitado',placeholder:'Ej. cambiar temporalmente al turno de 14:00 a 19:00 durante esta semana.',evidence:false}
};

function personalRequestLabel(type){return ({justificacion:'Justificación',dia_libre:'Día libre asignado',cambio_horario:'Cambio de horario',cambio_turno:'Cambio de turno'}[type]||'Solicitud')}
function personalRequestMessage(text,type=''){const el=$('personal-request-message');el.textContent=text||'';el.className='personal-request-message'+(type?' '+type:'')}
function formatRequestDate(value){return value?new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')):'—'}

function requestDateParts(value){
  const parts=String(value||'').split('-').map(Number);
  return parts.length===3&&parts.every(Number.isFinite)?{year:parts[0],month:parts[1],day:parts[2]}:null;
}

function requestIsoDate(year,month,day){return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}

function requestDateLabel(value){
  if(!value)return 'Seleccionar fecha';
  const text=new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00'));
  return text.charAt(0).toUpperCase()+text.slice(1).replace('.', '');
}

function syncRequestDateButtons(){
  document.querySelectorAll('[data-request-date]').forEach(button=>{
    const input=$(button.dataset.requestDate),label=button.querySelector('[data-request-date-label]');
    if(input&&label)label.textContent=requestDateLabel(input.value);
  });
}

function syncRequestKindButtons(value=$('personal-request-kind-value').value){
  $('personal-request-kind-value').value=value;
  document.querySelectorAll('[data-request-kind]').forEach(button=>{
    const selected=button.dataset.requestKind===value;
    button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;
  });
}

function requestMonthAllowed(year,month,direction){
  const input=$(REQUEST_CALENDAR.targetId);
  if(!input)return false;
  const first=requestIsoDate(year,month,1),last=requestIsoDate(year,month,new Date(year,month,0).getDate());
  return direction<0?(!input.min||last>=input.min):(!input.max||first<=input.max);
}

function renderRequestCalendar(){
  const input=$(REQUEST_CALENDAR.targetId);
  if(!input)return;
  const {year,month}=REQUEST_CALENDAR,selected=input.value,today=isoLima();
  $('request-calendar-title').textContent=`${monthNames[month-1]} ${year}`;
  $('request-calendar-prev').disabled=!requestMonthAllowed(month===1?year-1:year,month===1?12:month-1,-1);
  $('request-calendar-next').disabled=!requestMonthAllowed(month===12?year+1:year,month===12?1:month+1,1);
  const offset=(new Date(year,month-1,1).getDay()+6)%7,days=new Date(year,month,0).getDate();
  let html='<span aria-hidden="true"></span>'.repeat(offset);
  for(let day=1;day<=days;day++){
    const value=requestIsoDate(year,month,day),disabled=(input.min&&value<input.min)||(input.max&&value>input.max);
    const classes=[value===today?'today':'',value===selected?'selected':''].filter(Boolean).join(' ');
    html+=`<button type="button" class="${classes}" data-request-calendar-date="${value}" ${disabled?'disabled':''} aria-label="${esc(requestDateLabel(value))}" ${value===selected?'aria-pressed="true"':''}>${day}</button>`;
  }
  $('request-calendar-grid').innerHTML=html;
  const todayUnavailable=(input.min&&today<input.min)||(input.max&&today>input.max);
  $('request-calendar-today').disabled=!!todayUnavailable;
}

function closeRequestCalendar(returnFocus=false){
  const calendar=$('request-calendar');
  if(calendar.hidden)return false;
  calendar.hidden=true;
  document.querySelectorAll('[data-request-date]').forEach(button=>button.setAttribute('aria-expanded','false'));
  const trigger=REQUEST_CALENDAR.trigger;
  REQUEST_CALENDAR={targetId:'',trigger:null,year:0,month:0};
  if(returnFocus&&trigger?.isConnected)trigger.focus();
  return true;
}

function positionRequestCalendar(button){
  const calendar=$('request-calendar'),field=button.closest('.request-date-field');
  if(!field)return;
  calendar.dataset.side=button.dataset.requestDate==='personal-request-end'?'end':'start';
  const anchorTop=field.offsetTop+button.offsetTop;
  let top=anchorTop+button.offsetHeight+6;
  const buttonRect=button.getBoundingClientRect(),spaceBelow=window.innerHeight-buttonRect.bottom-12;
  if(spaceBelow<calendar.offsetHeight&&buttonRect.top>calendar.offsetHeight+12)top=anchorTop-calendar.offsetHeight-6;
  calendar.style.top=`${top}px`;
}

function openRequestCalendar(button){
  const targetId=button.dataset.requestDate,input=$(targetId);
  if(!input)return;
  if(!($('request-calendar').hidden)&&REQUEST_CALENDAR.targetId===targetId){closeRequestCalendar(true);return}
  const base=requestDateParts(input.value||isoLima());
  REQUEST_CALENDAR={targetId,trigger:button,year:base.year,month:base.month};
  document.querySelectorAll('[data-request-date]').forEach(item=>item.setAttribute('aria-expanded',String(item===button)));
  $('request-calendar').hidden=false;
  renderRequestCalendar();
  requestAnimationFrame(()=>{
    positionRequestCalendar(button);
    ($('request-calendar-grid').querySelector('.selected:not(:disabled)')||$('request-calendar-grid').querySelector('button:not(:disabled)'))?.focus();
  });
}

function moveRequestCalendar(amount){
  let {year,month}=REQUEST_CALENDAR;
  month+=amount;
  if(month<1){month=12;year--}else if(month>12){month=1;year++}
  REQUEST_CALENDAR.year=year;REQUEST_CALENDAR.month=month;renderRequestCalendar();
  if(REQUEST_CALENDAR.trigger)positionRequestCalendar(REQUEST_CALENDAR.trigger);
}

function chooseRequestCalendarDate(value){
  const input=$(REQUEST_CALENDAR.targetId);
  if(!input)return;
  input.value=value;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  syncRequestDateButtons();
  closeRequestCalendar(true);
}

async function loadPersonalRequests(){
  if(!APP.identity.hasPersonal)return;
  const [{data,error},{data:daysData}]=await Promise.all([db.rpc('dash_solicitudes_personales'),db.rpc('dash_mis_dias_libres')]);
  APP.daysOffBalance=daysData?.ok?Number(daysData.saldo)||0:null;
  $('personal-days-off-balance').textContent=APP.daysOffBalance==null?'Consulta tus días disponibles':`${APP.daysOffBalance} ${APP.daysOffBalance===1?'día disponible':'días disponibles'}`;
  if(error||!data?.ok){
    $('personal-request-list').innerHTML='<p class="request-empty">Las solicitudes estarán disponibles al instalar la migración 11.</p>';
    $('personal-request-count').textContent='0';
    return;
  }
  APP.personalRequests=data.solicitudes||[];
  renderPersonalRequests();
}

function renderPersonalRequests(){
  const items=APP.personalRequests||[],pending=items.filter(item=>item.estado==='pendiente').length;
  $('personal-request-count').textContent=pending;
  $('personal-request-list').innerHTML=items.length?items.map(item=>{
    const range=item.fecha_inicio===item.fecha_fin?formatRequestDate(item.fecha_inicio):`${formatRequestDate(item.fecha_inicio)} — ${formatRequestDate(item.fecha_fin)}`;
    const response=item.respuesta?`<p>Dirección: ${esc(item.respuesta)}</p>`:'';
    return `<article class="personal-request-row"><span><b>${esc(personalRequestLabel(item.tipo))}</b><small>${esc(range)} · ${item.evidencia?'Con evidencia':'Sin evidencia'}</small></span><span class="request-status ${esc(item.estado)}">${esc(item.estado)}</span>${response}</article>`;
  }).join(''):'<p class="request-empty">Todavía no has enviado solicitudes.</p>';
}

function resetPersonalRequestEvidence(){
  if(PERSONAL_REQUEST.previewUrl)URL.revokeObjectURL(PERSONAL_REQUEST.previewUrl);
  PERSONAL_REQUEST.file=null;PERSONAL_REQUEST.previewUrl='';
  $('personal-request-file').value='';$('personal-request-preview').hidden=true;$('personal-request-file-button').hidden=false;
  $('personal-request-image').removeAttribute('src');$('personal-request-file-name').textContent='Evidencia lista';
}

function openPersonalRequest(type='justificacion',date='',trigger=null){
  if(!APP.identity.hasPersonal||!APP.inicio?.colaborador?.id){
    toast('Este acceso necesita un perfil de colaborador vinculado a la cuenta.',true);
    return;
  }
  const normalized=PERSONAL_REQUEST_TYPES[type]?type:'justificacion',config=PERSONAL_REQUEST_TYPES[normalized],today=isoLima(),absence=config.evidence;
  if(normalized==='dia_libre'&&APP.daysOffBalance===0){toast('No tienes días libres disponibles. Dirección debe asignarte uno antes de solicitarlo.',true);return}
  PERSONAL_REQUEST.trigger=trigger||document.activeElement;
  resetPersonalRequestEvidence();personalRequestMessage('');
  $('personal-request-type').value=normalized;
  $('personal-request-kind').hidden=absence;
  syncRequestKindButtons(normalized==='cambio_turno'?'cambio_turno':'cambio_horario');
  $('personal-request-title').textContent=config.title;$('personal-request-copy').textContent=config.copy;
  $('personal-request-detail-label').textContent=config.label;$('personal-request-detail').placeholder=config.placeholder;$('personal-request-detail').value='';$('personal-request-detail-count').textContent='0';
  $('personal-request-evidence').hidden=!config.evidence;$('personal-request-note').hidden=!config.evidence;
  const start=$('personal-request-start'),end=$('personal-request-end'),selected=date||today;
  start.min=absence?addIsoDays(today,-90):addIsoDays(today,-7);start.max=absence?today:addIsoDays(today,180);
  const safeSelected=selected<start.min?start.min:selected>start.max?start.max:selected;
  end.min=start.min;end.max=start.max;start.value=safeSelected;end.value=safeSelected;
  closeRequestCalendar();syncRequestDateButtons();
  $('personal-request-modal').hidden=false;
  setTimeout(()=>document.querySelector('[data-request-date="personal-request-start"]')?.focus(),30);
}

function closePersonalRequest(){
  if(PERSONAL_REQUEST.busy)return;
  closeRequestCalendar();$('personal-request-modal').hidden=true;resetPersonalRequestEvidence();personalRequestMessage('');
  const trigger=PERSONAL_REQUEST.trigger;PERSONAL_REQUEST.trigger=null;
  if(trigger?.isConnected)setTimeout(()=>trigger.focus(),0);
}

async function choosePersonalRequestEvidence(file){
  if(!file||PERSONAL_REQUEST.busy)return;
  const valid=/^image\/(jpeg|png|webp)$/i.test(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name||'');
  if(!valid)return personalRequestMessage('Elige una imagen JPG, PNG o WebP.');
  if(file.size>PROFILE_MAX_SOURCE)return personalRequestMessage('La evidencia supera el máximo de 3 MB.');
  personalRequestMessage('Preparando la imagen…');
  try{
    const blob=await compressImage(file);resetPersonalRequestEvidence();
    PERSONAL_REQUEST.file=blob;PERSONAL_REQUEST.previewUrl=URL.createObjectURL(blob);
    $('personal-request-image').src=PERSONAL_REQUEST.previewUrl;$('personal-request-file-name').textContent=`${file.name||'Evidencia'} · ${Math.max(1,Math.round(blob.size/1024))} KB`;
    $('personal-request-file-button').hidden=true;$('personal-request-preview').hidden=false;personalRequestMessage('');
  }catch{personalRequestMessage('No se pudo preparar la imagen. Elige otra evidencia.')}
}

async function submitPersonalRequest(event){
  event.preventDefault();if(PERSONAL_REQUEST.busy)return;
  let type=$('personal-request-type').value;
  if(!$('personal-request-kind').hidden)type=$('personal-request-kind-value').value;
  const config=PERSONAL_REQUEST_TYPES[type],start=$('personal-request-start').value,end=$('personal-request-end').value,detail=$('personal-request-detail').value.trim();
  if(!start||!end||end<start)return personalRequestMessage('Revisa el rango de fechas.');
  if(detail.length<8)return personalRequestMessage('Escribe un comentario de al menos 8 caracteres.');
  if(config.evidence&&!PERSONAL_REQUEST.file)return personalRequestMessage('Adjunta una evidencia para enviar esta solicitud.');
  const button=$('personal-request-submit');PERSONAL_REQUEST.busy=true;button.disabled=true;button.textContent='Enviando…';personalRequestMessage('Guardando la solicitud…');
  let path='';
  try{
    if(PERSONAL_REQUEST.file){
      const token=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
      path=`${APP.inicio.colaborador.id}/${token}.jpg`;
      const {error:uploadError}=await db.storage.from(REQUEST_BUCKET).upload(path,PERSONAL_REQUEST.file,{upsert:false,contentType:'image/jpeg',cacheControl:'3600'});
      if(uploadError)throw new Error('subida');
    }
    const {data,error}=await db.rpc('dash_crear_solicitud',{p_tipo:type,p_fecha_inicio:start,p_fecha_fin:end,p_detalle:detail,p_evidencia:path||null});
    if(error||!data?.ok){
      if(path)await db.storage.from(REQUEST_BUCKET).remove([path]).catch(()=>{});
      const reason=data?.motivo||'guardar',messages={duplicada:'Ya existe una solicitud pendiente para esas fechas.',rango_ausencia:'Las justificaciones solo pueden corresponder a los últimos 90 días.',rango_cambio:'La fecha del cambio está fuera del rango permitido.',fechas:'Revisa el rango de fechas seleccionado.',evidencia:'La evidencia es obligatoria.',detalle:'Amplía el comentario antes de enviarlo.',sesion:'Tu sesión venció. Vuelve a ingresar al portal.',sin_permiso:'Tu cuenta no tiene permiso para enviar esta solicitud.'};
      throw new Error(messages[reason]||'No se pudo guardar la solicitud.');
    }
    personalRequestMessage('Solicitud enviada a Dirección.','success');toast('Solicitud enviada a Dirección.');
    await loadPersonalRequests();
    setTimeout(()=>{PERSONAL_REQUEST.busy=false;button.disabled=false;button.textContent='Enviar a Dirección';closePersonalRequest()},500);
    return;
  }catch(error){personalRequestMessage(error.message==='subida'?'No se pudo subir la evidencia. Revisa tu conexión.':error.message||'No se pudo enviar la solicitud.')}
  PERSONAL_REQUEST.busy=false;button.disabled=false;button.textContent='Enviar a Dirección';
}

function renderRailCalendar(h){
  $('rail-month').textContent=cap(`${monthNames[h.mes-1]} ${h.anio}`);
  const first=new Date(h.anio,h.mes-1,1).getDay(),offset=(first+6)%7;
  let html='<span class="rail-cal-day empty"></span>'.repeat(offset);
  for(const d of h.dias||[]){
    const registered=!!d.estado,incomplete=d.cierre_estado==='incompleta',cls=[registered?'registered':'',incomplete?'incomplete':'',d.fecha===h.hoy?'today':'',d.futuro?'future':'',!d.lab?'off':''].filter(Boolean).join(' ');
    html+=`<span class="rail-cal-day ${cls}" title="${esc(incomplete?'Jornada incompleta':statusLabel(d.estado,d.lab))}"><b>${d.d}</b>${registered?'<i></i>':''}</span>`;
  }
  $('rail-calendar-grid').innerHTML=html;
}

function renderProfile(){
  const c=APP.inicio.colaborador;if(!c)return; $('profile-avatar').textContent=initials(c.nombre); $('profile-name').textContent=c.nombre; $('profile-area').textContent=c.area||'Sin área';paintProfilePhoto(APP.avatar.url);
  $('profile-link').textContent=({practicas:'Prácticas',voluntariado:'Voluntariado',ambos:'Prácticas + voluntariado'}[c.tipo_vinculo]||c.tipo_vinculo||'Sin vínculo');
  const dates=v=>v?new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(v+'T12:00:00')):'—';
  const fields=[['DNI',c.dni||'—'],['Área',c.area||'—'],['Horario general',`${fmtTime(c.hora_inicio)} — ${fmtTime(c.hora_fin)}`],['Días laborables',(c.dias_laborables||[]).map(n=>['','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][n]).join(', ')||'—'],['Inicio de vínculo',dates(c.contrato_inicio)],['Fin de referencia',dates(c.contrato_fin_referencia)],['Meta de horas',c.contrato_horas?c.contrato_horas+' h':'—'],['Horas previas',Number(c.horas_previas||0)+' h']];
  $('profile-fields').innerHTML=fields.map(x=>`<div class="profile-field"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join('');
}

async function loadTeam(){
  const today=isoLima();
  const [{data:people,error},{data:marks},{data:closeData,error:closeError},{data:reviewData,error:reviewError},{data:issueData,error:issueError}]=await Promise.all([
    db.from('asis_colaboradores').select('id,nombre,area_id,dni,dias_laborables,hora_inicio,hora_fin,horario_semanal,contrato_pendiente,tipo_vinculo,contrato_inicio,contrato_fin_referencia,foto_path,foto_actualizada_at,asis_areas(nombre)').eq('activo',true).order('nombre'),
    db.from('asis_registros').select('colaborador_id,estado,marcado_at').eq('fecha',today),
    db.rpc('dash_equipo_cierres_hoy'),
    db.rpc('dash_admin_revision_entregas',{p_fecha:today}),
    db.rpc('dash_supervision_impedimentos',{p_fecha:today})
  ]);
  if(error||closeError||!closeData?.ok){
    $('team-summary').innerHTML='';
    $('team-list').innerHTML='<p class="admin-empty">El estado de cierre no está disponible. Actualiza nuevamente; no mostraremos asistencia parcial.</p>';
    if($('team-detail-panel')) $('team-detail-panel').innerHTML='';
    return;
  }
  APP.adminReview=!reviewError&&reviewData?.ok?reviewData:{ok:false,entregas:[]};
  const by=new Map((marks||[]).map(x=>[String(x.colaborador_id),x])),byClose=new Map((closeData?.personas||[]).map(x=>[String(x.id),x.cierre||{}])),p=await hydrateProfilePhotos(people||[]);
  APP.teamPeople=p;
  const reviews=APP.adminReview.entregas||[],byReview=new Map(),byIssue=new Map();
  reviews.forEach(item=>{const key=String(item.colaborador_id);if(!byReview.has(key))byReview.set(key,[]);byReview.get(key).push(item)});
  if(!issueError&&issueData?.ok)(issueData.impedimentos||[]).forEach(item=>{const key=String(item.colaborador_id);if(!byIssue.has(key))byIssue.set(key,[]);byIssue.get(key).push(item)});
  const presentations=p.map(x=>CLOSE_MODEL.attendancePresentation(by.get(String(x.id)),byClose.get(String(x.id)))),complete=presentations.filter(x=>x.complete).length,incomplete=presentations.filter(x=>x.incomplete).length,entries=presentations.filter(x=>x.hasEntry).length;

  APP.teamContext = { by, byClose, byReview, byIssue, p, complete, incomplete, entries, presentations };

  if($('team-list-count')) $('team-list-count').textContent = `${p.length} ${p.length===1?'persona':'personas'}`;

  $('team-summary').innerHTML=[['Personas visibles',p.length],['Entradas hoy',entries]].map(x=>`<div class="team-kpi"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
  const guide=$('team-evidence-guide');guide.hidden=false;guide.className='team-evidence-guide'+(APP.adminReview.ok?'':' is-warning');
  const guideNotice = APP.adminReview.ok
    ? '<div class="team-guide-text"><span><b>Seguimiento privado de evidencias</b><small>Ves únicamente tu área. Puedes abrir los archivos para verificar avances; solo Dirección puede aprobar u observar.</small></span><i>SOLO LECTURA</i></div>'
    : '<div class="team-guide-text"><span><b>Falta habilitar la consulta de evidencias</b><small>Ejecuta la migración dashboard_22 para abrir los archivos de tu área. La asistencia continúa visible.</small></span></div>';
  guide.innerHTML = `
    <div class="team-followup-kpis">
      <div class="team-kpi"><small>Jornadas completas</small><b>${complete}</b></div>
      <div class="team-kpi"><small>Incompletas</small><b>${incomplete}</b></div>
    </div>
    ${guideNotice}
  `;

  $('team-list').innerHTML=p.length?p.map(x=>{
    const key=String(x.id),m=by.get(key),close=byClose.get(key)||{},view=CLOSE_MODEL.attendancePresentation(m,close),personReviews=byReview.get(key)||[],personIssues=byIssue.get(key)||[],issue=personIssues[0];
    const requirements=[...(close.requisitos||[]),...(close.asignaciones||[])],missing=requirements.filter(item=>!item.completo).length,observed=personReviews.filter(item=>item.revision_estado==='observada').length,pending=personReviews.filter(item=>item.revision_estado==='pendiente'&&item.estado==='completo').length,approved=personReviews.filter(item=>item.revision_estado==='aprobada').length;
    const entryException=CLOSE_MODEL.teamEntryException(x,close,today);
    const evidence=!m?{label:entryException||'Aún sin entrada',tone:'waiting'}:observed?{label:'Corrección pendiente',tone:'observed'}:issue?{label:'Impedimento informado',tone:'reported'}:missing?{label:`Falta${missing===1?'':'n'} ${missing} ${missing===1?'evidencia':'evidencias'}`,tone:'missing'}:pending?{label:`${pending} en revisión`,tone:'pending'}:approved&&approved===personReviews.length?{label:'Evidencias revisadas',tone:'approved'}:{label:'Evidencias completas',tone:'approved'};
    const isSelected = APP.selectedTeamPersonId === String(x.id);
    return `<div class="team-row ${isSelected?'is-selected':''}" data-team-person="${x.id}" role="button" tabindex="0" aria-selected="${isSelected?'true':'false'}">
      ${profileAvatarMarkup(x)}
      <div class="team-row-info">
        <strong>${esc(x.nombre)}</strong>
        <small>${esc(x.asis_areas?.nombre||'Sin área')}</small>
      </div>
      <div class="team-row-progress">
        <small>${m?.marcado_at?new Date(m.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):'Sin hora registrada'}</small>
        <em class="team-evidence-state ${evidence.tone}" ${issue?`title="${esc(issue.detalle)}"`:''}>${esc(evidence.label)}</em>
      </div>
      <span class="team-state ${view.state.toLowerCase()}">${esc(view.label)}</span>
      <div class="team-row-actions">
        <button class="team-select-trigger" type="button" data-team-profile="${x.id}">Ver detalles</button>
      </div>
    </div>`;
  }).join(''):'<p style="padding:25px">No hay personas para mostrar.</p>';

  if(APP.selectedTeamPersonId && p.some(x=>String(x.id)===APP.selectedTeamPersonId)){
    selectTeamPerson(APP.selectedTeamPersonId,false);
  } else {
    selectTeamPerson(null,false);
  }
}

const teamMobileViewport=window.matchMedia('(max-width: 900px)');
const teamMobileDialog=$('team-mobile-dialog');
let teamDetailTrigger=null;
teamMobileDialog.addEventListener('close',()=>{
  $('team-workspace').append($('team-detail-panel'));
  teamDetailTrigger?.focus({preventScroll:true});
});
teamMobileViewport.addEventListener('change',event=>{if(!event.matches&&teamMobileDialog.open)teamMobileDialog.close();});
function selectTeamPerson(id,openDetail=true){
  const panel = $('team-detail-panel');
  if(!panel) return;
  if(openDetail&&teamMobileViewport.matches&&!teamMobileDialog.open){
    teamDetailTrigger=document.activeElement;
    $('team-mobile-dialog-body').append(panel);
    teamMobileDialog.showModal();
  }
  const generalBtn = $('team-view-general-btn');
  if(!id){
    APP.selectedTeamPersonId = null;
    document.querySelectorAll('#team-list .team-row').forEach(row=>{
      row.classList.remove('is-selected');
      row.setAttribute('aria-selected','false');
    });
    if(generalBtn) generalBtn.classList.add('active');
    renderTeamGeneralReport();
    return;
  }
  APP.selectedTeamPersonId = String(id);
  document.querySelectorAll('#team-list .team-row').forEach(row=>{
    const match = row.dataset.teamPerson === String(id);
    row.classList.toggle('is-selected', match);
    row.setAttribute('aria-selected', match ? 'true' : 'false');
  });
  if(generalBtn) generalBtn.classList.remove('active');
  renderTeamPersonDetail(id);
}

function renderTeamGeneralReport(){
  const panel = $('team-detail-panel');
  if(!panel || !APP.teamContext) return;
  const { by, byClose, byReview, byIssue, p, complete, incomplete, entries } = APP.teamContext;

  const present = p.filter(x=>by.get(String(x.id))?.estado==='P').length;
  const late = p.filter(x=>by.get(String(x.id))?.estado==='T').length;
  const justified = p.filter(x=>by.get(String(x.id))?.estado==='J').length;
  const noEntry = p.filter(x=>!by.has(String(x.id))&&!CLOSE_MODEL.teamEntryException(x,byClose.get(String(x.id)),isoLima())).length;
  const total = p.length || 1;

  let totalReqs = 0, doneReqs = 0, observedCount = 0;
  p.forEach(x => {
    const c = byClose.get(String(x.id)) || {};
    const reqs = [...(c.requisitos||[]), ...(c.asignaciones||[])];
    totalReqs += reqs.length;
    doneReqs += reqs.filter(r => r.completo).length;
    const revs = byReview.get(String(x.id)) || [];
    observedCount += revs.filter(r => r.revision_estado === 'observada').length;
  });

  const pP = Math.round((present / total) * 100);
  const pT = Math.round((late / total) * 100);
  const pJ = Math.round((justified / total) * 100);
  const pNo = 100 - (pP + pT + pJ);
  const attConic = total ? `conic-gradient(#24a68a 0% ${pP}%, #d68b18 ${pP}% ${pP + pT}%, #326fac ${pP + pT}% ${pP + pT + pJ}%, #c8c2b9 ${pP + pT + pJ}% 100%)` : '#e6dfd8';

  const reqPct = totalReqs ? Math.round((doneReqs / totalReqs) * 100) : 100;
  const reqConic = totalReqs ? `conic-gradient(#24a68a 0% ${reqPct}%, #e2b5bd ${reqPct}% 100%)` : '#24a68a';

  const pendingAttention = p.filter(x => {
    const m = by.get(String(x.id));
    const revs = byReview.get(String(x.id)) || [];
    const close = byClose.get(String(x.id)) || {};
    const missing = (close.requisitos||[]).some(r => !r.completo);
    if(!m&&CLOSE_MODEL.teamEntryException(x,close,isoLima()))return false;
    return !m || revs.some(r => r.revision_estado === 'observada') || missing;
  });

  panel.innerHTML = `
    <div class="team-general-dashboard">
      <header class="team-dashboard-head">
        <div>
          <span class="team-dashboard-badge">SUPERVISIÓN EN VIVO</span>
          <h3>Informe general del equipo</h3>
          <p>Métricas consolidadas de asistencia, entregas y jornada del día de hoy.</p>
        </div>
      </header>

      <div class="team-dashboard-kpis">
        <div class="team-dashboard-kpi">
          <small>Asistencia general</small>
          <b>${Math.round((entries / total) * 100)}%</b>
          <span>${entries} de ${total} presentes</span>
        </div>
        <div class="team-dashboard-kpi">
          <small>Avance de evidencias</small>
          <b>${reqPct}%</b>
          <span>${doneReqs} de ${totalReqs} completas</span>
        </div>
        <div class="team-dashboard-kpi ${pendingAttention.length ? 'has-alert' : ''}">
          <small>Pendientes de atención</small>
          <b>${pendingAttention.length}</b>
          <span>${pendingAttention.length ? 'Colaboradores requieren acción' : 'Equipo al día'}</span>
        </div>
      </div>

      <div class="team-dashboard-charts">
        <article class="team-chart-card">
          <header class="team-chart-header">
            <h4>Distribución de Asistencia</h4>
            <span class="team-chart-caption">Hoy</span>
          </header>
          <div class="team-chart-body">
            <div class="team-chart-ring" style="background:${attConic}">
              <div class="team-chart-inner">
                <strong>${entries}</strong>
                <small>Registrados</small>
              </div>
            </div>
            <ul class="team-chart-legend">
              <li><i style="background:#24a68a"></i><span>Presentes a tiempo</span><b>${present}</b></li>
              <li><i style="background:#d68b18"></i><span>Tardanzas</span><b>${late}</b></li>
              <li><i style="background:#326fac"></i><span>Justificados</span><b>${justified}</b></li>
              <li><i style="background:#c8c2b9"></i><span>Aún sin entrada</span><b>${noEntry}</b></li>
            </ul>
          </div>
        </article>

        <article class="team-chart-card">
          <header class="team-chart-header">
            <h4>Cierres y Entregables</h4>
            <span class="team-chart-caption">Progreso</span>
          </header>
          <div class="team-chart-body">
            <div class="team-chart-ring" style="background:${reqConic}">
              <div class="team-chart-inner">
                <strong>${reqPct}%</strong>
                <small>Completado</small>
              </div>
            </div>
            <ul class="team-chart-legend">
              <li><i style="background:#24a68a"></i><span>Requisitos listos</span><b>${doneReqs}</b></li>
              <li><i style="background:#d68b18"></i><span>Faltantes / En curso</span><b>${totalReqs - doneReqs}</b></li>
              <li><i style="background:#c23b50"></i><span>Observaciones</span><b>${observedCount}</b></li>
              <li><i style="background:#0b5ca8"></i><span>Jornadas completas</span><b>${complete}</b></li>
            </ul>
          </div>
        </article>
      </div>

      <section class="team-pending-section">
        <header class="team-pending-header">
          <h4>Colaboradores con pendientes hoy</h4>
          <small>${pendingAttention.length ? `${pendingAttention.length} integrantes requieren seguimiento` : 'Todo el equipo está al día'}</small>
        </header>
        ${pendingAttention.length ? `
          <div class="team-pending-list">
            ${pendingAttention.map(item => {
              const m = by.get(String(item.id));
              const revs = byReview.get(String(item.id)) || [];
              const isObserved = revs.some(r => r.revision_estado === 'observada');
              const statusTag = !m ? 'Sin entrada registrada' : isObserved ? 'Corrección observada' : 'Faltan evidencias';
              const statusCls = !m ? 'waiting' : isObserved ? 'observed' : 'missing';
              return `
                <div class="team-pending-item" role="button" tabindex="0" onclick="selectTeamPerson('${item.id}')">
                  ${profileAvatarMarkup(item)}
                  <div class="team-pending-item-info">
                    <b>${esc(item.nombre)}</b>
                    <small>${esc(item.asis_areas?.nombre||'Sin área')}</small>
                  </div>
                  <span class="team-pending-chip ${statusCls}">${statusTag}</span>
                  <button type="button" class="team-pending-btn" aria-label="Ver perfil de ${esc(item.nombre)}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="team-pending-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8 12 3 3 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <p>¡Excelente! Todos los integrantes del equipo han completado sus registros y requisitos del día.</p>
          </div>
        `}
      </section>
    </div>
  `;
}

async function renderTeamPersonDetail(id){
  const panel = $('team-detail-panel');
  if(!panel || !APP.teamPeople) return;
  const person = APP.teamPeople.find(x => String(x.id) === String(id));
  if(!person) return selectTeamPerson(null);

  const { by, byClose, byReview, byIssue } = APP.teamContext || {};
  const m = by?.get(String(id));
  const close = byClose?.get(String(id)) || {};
  const personReviews = byReview?.get(String(id)) || [];
  const personIssues = byIssue?.get(String(id)) || [];
  const issue = personIssues[0];
  const view = CLOSE_MODEL.attendancePresentation(m, close);

  panel.innerHTML = `
    <div class="team-person-dashboard">
      <div class="team-person-topbar">
        <button class="team-back-general-btn" type="button" onclick="selectTeamPerson(null)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          <span>Volver al informe general</span>
        </button>
        ${personReviews.length ? `
          <button class="team-evidence-open" type="button" data-team-review="${person.id}" title="Revisar ${personReviews.length} ${personReviews.length === 1 ? 'evidencia' : 'evidencias'}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>Revisar evidencias</span>
            <span class="team-evidence-count">${personReviews.length}</span>
          </button>` : ''}
      </div>

      <article class="team-person-card">
        <div class="team-person-head">
          ${profileAvatarMarkup(person)}
          <div class="team-person-title-wrap">
            <span class="team-person-area">${esc(person.asis_areas?.nombre || 'Sin área')}</span>
            <h3>${esc(person.nombre)}</h3>
            <div class="team-person-badges">
              <span class="team-state ${view.state.toLowerCase()}">${esc(view.label)}</span>
              <span class="team-person-contract">${esc({practicas:'Practicante',voluntariado:'Voluntariado',ambos:'Prácticas + voluntariado'}[person.tipo_vinculo]||person.tipo_vinculo||'Equipo')}</span>
            </div>
          </div>
        </div>

        <div class="team-person-facts">
          <div><small>DNI</small><b>${esc(person.dni || '—')}</b></div>
          <div><small>HORARIO</small><b>${fmtTime(person.hora_inicio)} — ${fmtTime(person.hora_fin)}</b></div>
          <div><small>CONTRATO</small><b>${person.contrato_inicio || '—'} → ${person.contrato_fin_referencia || '—'}</b></div>
          <div><small>ENTRADA HOY</small><b>${m?.marcado_at ? new Date(m.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}) : 'Sin registro'}</b></div>
        </div>
      </article>

      <div class="team-person-loading" id="team-person-month-loading">
        <div class="team-loading-spinner"></div>
        <span>Cargando análisis mensual y gráfico de asistencias…</span>
      </div>

      <div id="team-person-month-data" hidden></div>
    </div>
  `;

  const now = new Date(),
        year = Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric'}).format(now)),
        month = Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',month:'numeric'}).format(now));

  const { data, error } = await db.rpc('dash_historial', { p_anio: year, p_mes: month, p_colab: Number(id) });
  const loadEl = $('team-person-month-loading'), dataEl = $('team-person-month-data');

  if(error || !data?.ok){
    if(loadEl) loadEl.innerHTML = '<p class="admin-empty">No se pudo cargar el historial mensual autorizado.</p>';
    return;
  }
  if(loadEl) loadEl.hidden = true;
  if(!dataEl) return;
  dataEl.hidden = false;

  const t = data.totales || {};
  const days = data.dias || [];
  const hours = Number(data.horas || 0).toFixed(1);
  const sum = (t.P||0) + (t.T||0) + (t.J||0) + (t.NG||0) + (t.incompletas||0) || 1;
  const pP = Math.round(((t.P||0) / sum) * 100);
  const pT = Math.round(((t.T||0) / sum) * 100);
  const pJ = Math.round(((t.J||0) / sum) * 100);
  const pNG = Math.round(((t.NG||0) / sum) * 100);
  const pINC = 100 - (pP + pT + pJ + pNG);

  const monthConic = `conic-gradient(#24a68a 0% ${pP}%, #d68b18 ${pP}% ${pP + pT}%, #326fac ${pP + pT}% ${pP + pT + pJ}%, #a33d4d ${pP + pT + pJ}% ${pP + pT + pJ + pNG}%, #c23b50 ${pP + pT + pJ + pNG}% 100%)`;

  const first = new Date(`${year}-${String(month).padStart(2,'0')}-01T12:00:00`), offset = (first.getDay() + 6) % 7;
  const calendarHtml = '<span class="empty"></span>'.repeat(offset) + days.map(day => {
    const inc = day.cierre_estado === 'incompleta';
    const state = inc ? 'incomplete' : String(day.estado || '').toLowerCase();
    const label = inc ? 'INC' : (day.estado || '');
    return `<span class="${state} ${day.lab ? '' : 'off'}" title="Día ${day.d}: ${day.estado||'Sin registro'}"><b>${day.d}</b><i>${esc(label)}</i></span>`;
  }).join('');

  dataEl.innerHTML = `
    <div class="team-person-analytics">
      <article class="team-chart-card">
        <header class="team-chart-header">
          <h4>Asistencia del Mes · ${cap(monthNames[month-1])} ${year}</h4>
          <span class="team-chart-caption">${hours} h acreditadas</span>
        </header>
        <div class="team-chart-body">
          <div class="team-chart-ring" style="background:${monthConic}">
            <div class="team-chart-inner">
              <strong>${hours}</strong>
              <small>Horas mes</small>
            </div>
          </div>
          <ul class="team-chart-legend">
            <li><i style="background:#24a68a"></i><span>Presentes (P)</span><b>${t.P||0}</b></li>
            <li><i style="background:#d68b18"></i><span>Tardanzas (T)</span><b>${t.T||0}</b></li>
            <li><i style="background:#326fac"></i><span>Justificados (J)</span><b>${t.J||0}</b></li>
            <li><i style="background:#a33d4d"></i><span>No gestionó (NG)</span><b>${t.NG||0}</b></li>
            <li><i style="background:#c23b50"></i><span>Incompletas</span><b>${t.incompletas||0}</b></li>
          </ul>
        </div>
      </article>

      <article class="team-person-calendar-card">
        <header class="team-calendar-header">
          <h4>Calendario Mensual</h4>
          <small>Registro diario oficial</small>
        </header>
        <div class="team-profile-week">
          <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>
        <div class="team-profile-calendar">
          ${calendarHtml}
        </div>
      </article>

      ${issue ? `
        <div class="team-issue-alert">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <div>
            <b>Impedimento informado hoy</b>
            <p>${esc(issue.detalle)}</p>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function openTeamProfile(id){
  selectTeamPerson(id);
}
function closeTeamProfile(){
  selectTeamPerson(null);
}

function renderAdminOverviewCharts(people,marks,closePeople){
  const host=$('admin-overview-charts');if(!host)return;
  const ids=new Set(people.map(p=>String(p.id))),closes=closePeople.filter(p=>ids.has(String(p.id)));
  const byClose=new Map(closes.map(p=>[String(p.id),p.cierre||{}]));
  const byMark=new Map(marks.map(p=>[String(p.colaborador_id),p]));
  const count=fn=>people.filter(fn).length;
  const complete=count(p=>['completa','regularizada'].includes(byClose.get(String(p.id))?.estado));
  const incomplete=count(p=>byClose.get(String(p.id))?.estado==='incompleta');
  const requirements=closes.flatMap(p=>(p.cierre?.requisitos||[]).filter(r=>r.tipo!=='salida'));
  const tasks=closes.flatMap(p=>p.cierre?.asignaciones||[]);
  const delivered=rows=>rows.filter(r=>r.completo===true).length;
  const palette=['#187d69','#b45d3c','#c69a35','#7a8da4','#c9c6bf'];
  const charts=[
    {title:'General',note:'Jornadas · hoy',center:complete,label:'completas',parts:[['Completas',complete],['Incompletas',incomplete],['Otros estados',people.length-complete-incomplete]]},
    {title:'Asistencias',note:'Registros · hoy',center:count(p=>byMark.has(String(p.id))),label:'registrados',parts:[['Presentes',count(p=>byMark.get(String(p.id))?.estado==='P')],['Tardanzas',count(p=>byMark.get(String(p.id))?.estado==='T')],['Justificados',count(p=>byMark.get(String(p.id))?.estado==='J')],['Otros registros',count(p=>byMark.has(String(p.id))&&!['P','T','J'].includes(byMark.get(String(p.id)).estado))],['Sin registro',count(p=>!byMark.has(String(p.id)))]]},
    {title:'Evidencias',note:'Requisitos · hoy',center:delivered(requirements),label:'completados',parts:[['Completados',delivered(requirements)],['Pendientes',requirements.length-delivered(requirements)]]},
    {title:'Tareas',note:'Entregas por colaborador · hoy',center:delivered(tasks),label:'entregadas',parts:[['Entregadas',delivered(tasks)],['Pendientes',tasks.length-delivered(tasks)]]}
  ];
  host.innerHTML=charts.map(chart=>{
    const total=chart.parts.reduce((n,p)=>n+p[1],0);let offset=0;
    const segments=chart.parts.map(([label,value],i)=>{const start=offset;offset+=total?value/total*100:0;return `${palette[i]} ${start}% ${offset}%`}).join(',');
    const description=chart.parts.map(([label,value])=>`${label}: ${value}`).join(', ');
    return `<article class="admin-chart"><header><h3>${chart.title}</h3><p>${chart.note}</p></header><div class="admin-chart-ring" role="img" aria-label="${esc(chart.title+': '+(total?description:'Sin datos para hoy'))}" style="background:${total?`conic-gradient(${segments})`:'#e5e2dd'}"><span><b>${total?chart.center:'—'}</b><small>${total?chart.label:'Sin datos'}</small></span></div><ul>${chart.parts.map(([label,value],i)=>`<li><i style="background:${palette[i]}" aria-hidden="true"></i><span>${label}</span><b>${value}</b></li>`).join('')}</ul></article>`;
  }).join('');
}

async function loadAdminHub(){
  if(!APP.access.acceso_panel)return;
  const btn=$('admin-refresh'); btn.disabled=true;
  if($('admin-overview-charts'))$('admin-overview-charts').innerHTML='<p class="admin-empty">Cargando gráficos de hoy…</p>';
  const today=isoLima();
  const [year,month]=today.slice(0,7).split('-').map(Number),canDirect=APP.access.rol==='direccion',canManageRoles=APP.identity.isSystem&&canDirect;
  const [peopleRes,marksRes,legacyRequestsRes,personalRequestsRes,closesRes,teamRes,monthRes,controlRes,rolesRes]=await Promise.all([
    db.from('asis_colaboradores').select('id,nombre,area_id,foto_path,foto_actualizada_at,asis_areas(nombre)').eq('activo',true).order('nombre'),
    db.from('asis_registros').select('colaborador_id,estado,marcado_at,origen').eq('fecha',today),
    db.from('asis_solicitudes_horario').select('id,colaborador_id,horario_nuevo,creado_at').eq('estado','pendiente').order('creado_at',{ascending:false}),
    canDirect?db.rpc('dash_admin_solicitudes_personales'):Promise.resolve({data:{ok:true,solicitudes:[]},error:null}),
    db.rpc('dash_admin_cierres',{p_fecha:today}),
    db.rpc('dash_admin_equipo',{p_incluir_inactivos:true}),
    db.rpc('dash_admin_mes',{p_anio:year,p_mes:month,p_incluir_inactivos:false}),
    canDirect?db.rpc('dash_admin_control_diario',{p_fecha:today}):Promise.resolve({data:null,error:null}),
    canManageRoles?db.rpc('dash_admin_roles'):Promise.resolve({data:null,error:null})
  ]);
  btn.disabled=false;
  if(peopleRes.error||marksRes.error||closesRes.error||!closesRes.data?.ok){
    if($('admin-overview-charts'))$('admin-overview-charts').innerHTML='<p class="admin-empty">No se pudieron cargar los gráficos. Pulsa Actualizar para reintentar.</p>';
    $('admin-status-list').innerHTML='<p class="admin-empty">No se pudo cargar el estado operativo. Actualiza nuevamente.</p>';
    toast('No se pudo actualizar la administración.',true); return;
  }
  const people=await hydrateProfilePhotos(peopleRes.data||[]),marks=marksRes.data||[],legacyRequests=legacyRequestsRes.data||[],personalRequests=personalRequestsRes.data?.ok?personalRequestsRes.data.solicitudes||[]:[];
  const teamData=!teamRes.error&&teamRes.data?.ok?teamRes.data:null,monthData=!monthRes.error&&monthRes.data?.ok?monthRes.data:null,controlData=!controlRes.error&&controlRes.data?.ok?controlRes.data:null,rolesData=!rolesRes.error&&rolesRes.data?.ok?rolesRes.data:null;
  const byMark=new Map(marks.map(x=>[String(x.colaborador_id),x]));
  const closePeople=closesRes.data?.personas||[],byClose=new Map(closePeople.map(x=>[String(x.id),x.cierre||{}])),byClosePerson=new Map(closePeople.map(x=>[String(x.id),x]));
  const byControl=new Map((controlData?.filas||[]).map(row=>[String(row.colaborador_id),row]));
  renderAdminOverviewCharts(people,marks,closePeople);
  const byPerson=new Map(people.map(x=>[String(x.id),x]));
  const registered=people.filter(x=>byMark.has(String(x.id))).length;
  const complete=people.filter(x=>['completa','regularizada'].includes(byClose.get(String(x.id))?.estado)).length;
  const incomplete=people.filter(x=>byClose.get(String(x.id))?.estado==='incompleta').length;
  const pending=Math.max(0,people.length-registered);
  const priorities=people.map(person=>{
    const key=String(person.id),mark=byMark.get(key),close=byClose.get(key)||{},closePerson=byClosePerson.get(key),control=byControl.get(key);
    if(closePerson?.labora===false||control?.labora===false)return null;
    if(Number(control?.revision_observada)>0)return {person,label:'Corrección pendiente',detail:'Tiene una evidencia observada',tone:'danger',rank:1};
    if(close.estado==='incompleta'||control?.cierre_estado==='incompleta')return {person,label:'Incompleta',detail:'La jornada terminó sin cierre válido',tone:'danger',rank:1};
    if(Number(control?.revision_pendiente)>0)return {person,label:'Por revisar',detail:`${control.revision_pendiente} evidencia${Number(control.revision_pendiente)===1?'':'s'} pendiente${Number(control.revision_pendiente)===1?'':'s'}`,tone:'warning',rank:2};
    if(Number(control?.evidencias_pendientes)>0)return {person,label:'Faltan evidencias',detail:`${control.evidencias_pendientes} requisito${Number(control.evidencias_pendientes)===1?'':'s'} pendiente${Number(control.evidencias_pendientes)===1?'':'s'}`,tone:'warning',rank:2};
    if(!mark)return {person,label:'Sin entrada',detail:'Aún no registra asistencia',tone:'neutral',rank:3};
    if(control?.entrada_at&&!control?.salida_at)return {person,label:'Cierre pendiente',detail:'Tiene entrada y todavía no registra salida',tone:'info',rank:4};
    return null;
  }).filter(Boolean).sort((a,b)=>a.rank-b.rank||a.person.nombre.localeCompare(b.person.nombre,'es'));
  const kpis=[
    ['EQUIPO ACTIVO',people.length,'Personas programadas',''],
    ['CON ENTRADA',registered,`${people.length?Math.round(registered/people.length*100):0}% del equipo`,'registered'],
    ['JORNADAS COMPLETAS',complete,`${people.length?Math.round(complete/people.length*100):0}% del equipo`,'complete'],
    ['REQUIEREN ATENCIÓN',priorities.length,priorities.length?'Revisar antes del cierre':'Sin alertas operativas','pending']
  ];
  $('admin-kpis').innerHTML=kpis.map(x=>`<article class="admin-kpi ${x[3]}"><small>${esc(x[0])}</small><b>${esc(x[1])}</b><span>${esc(x[2])}</span></article>`).join('');
  $('admin-overview-date').textContent=cap(new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Lima'}).format(new Date(today+'T12:00:00-05:00')));
  $('admin-overview-headline').textContent=priorities.length?`${priorities.length} ${priorities.length===1?'persona requiere':'personas requieren'} atención; ${complete} ${complete===1?'jornada está completa':'jornadas están completas'}.`:complete?`Las ${complete} jornadas registradas están al día. No hay alertas operativas.`:'La jornada de hoy no presenta alertas operativas.';

  let statusHtml=priorities.slice(0,6).map(item=>{
    return `<div class="admin-status-row">${profileAvatarMarkup(item.person)}<span><strong>${esc(item.person.nombre)}</strong><small>${esc(item.person.asis_areas?.nombre||'Sin área')}</small></span><span class="admin-status-time">${esc(item.detail)}</span><span class="admin-status-pill ${item.tone}">${esc(item.label)}</span></div>`;
  }).join('');
  if(priorities.length>6)statusHtml+=`<p class="admin-empty compact">Hay ${priorities.length-6} ${priorities.length-6===1?'caso adicional':'casos adicionales'} en la lista completa.</p>`;
  $('admin-attention-count').textContent=priorities.length;$('admin-attention-count').classList.toggle('is-alert',priorities.length>0);
  $('admin-status-list').innerHTML=statusHtml||'<div class="admin-overview-clear"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9"/><circle cx="12" cy="12" r="9"/></svg><span><b>Todo bajo control</b><small>No hay personas que requieran atención inmediata.</small></span></div>';

  const totalRequests=personalRequests.length+legacyRequests.length;
  $('admin-request-count').textContent=totalRequests;
  const personalHtml=personalRequests.slice(0,3).map(req=>{
    const created=req.creado_at?new Date(req.creado_at).toLocaleDateString('es-PE',{day:'2-digit',month:'short',timeZone:'America/Lima'}):'—';
    const range=req.fecha_inicio===req.fecha_fin?formatRequestDate(req.fecha_inicio):`${formatRequestDate(req.fecha_inicio)} — ${formatRequestDate(req.fecha_fin)}`;
    const evidence=req.evidencia_path?`<button class="evidence" type="button" data-request-evidence="${esc(req.evidencia_path)}">Ver evidencia</button>`:'';
    return `<div class="admin-request personal" data-admin-personal-request="${req.id}"><span><b>${esc(req.nombre||'Colaborador')}</b><small>${esc(personalRequestLabel(req.tipo))} · ${esc(range)}</small></span><small>${esc(created)}</small><p>${esc(req.detalle||'Sin detalle')}</p><div class="admin-request-actions"><input data-request-response="${req.id}" maxlength="500" placeholder="Respuesta opcional">${evidence}<button class="approve" type="button" data-admin-personal-action="approve" data-request-id="${req.id}">Aprobar</button><button class="reject" type="button" data-admin-personal-action="reject" data-request-id="${req.id}">Rechazar</button></div></div>`;
  }).join('');
  const remaining=Math.max(0,3-personalRequests.length),legacyHtml=legacyRequests.slice(0,remaining).map(req=>{
    const person=byPerson.get(String(req.colaborador_id)),created=req.creado_at?new Date(req.creado_at).toLocaleDateString('es-PE',{day:'2-digit',month:'short',timeZone:'America/Lima'}):'—';
    return `<div class="admin-request"><b>${esc(person?.nombre||'Colaborador')}</b><small>${esc(created)}</small><p>Cambio de horario · ${esc(req.horario_nuevo||'Sin detalle')}</p></div>`;
  }).join('');
  $('admin-request-list').innerHTML=personalHtml+legacyHtml||'<p class="admin-empty">No hay solicitudes pendientes.</p>';

  const setOverview=(id,value)=>{const element=$(id);if(element)element.textContent=value};
  const controlRows=controlData?.filas||[],evidencePending=controlRows.reduce((total,row)=>total+Number(row.evidencias_pendientes||0),0),reviewPending=controlRows.reduce((total,row)=>total+Number(row.revision_pendiente||0)+Number(row.revision_observada||0),0);
  const monthSummary=monthData?.resumen||{},monthRecorded=Number(monthSummary.P||0)+Number(monthSummary.T||0)+Number(monthSummary.J||0)+Number(monthSummary.NG||0),monthBase=Number(monthSummary.P||0)+Number(monthSummary.T||0)+Number(monthSummary.J||0),monthRate=monthBase?Math.round((Number(monthSummary.P||0)+Number(monthSummary.T||0))*100/monthBase):null;
  const teamPeople=teamData?.personas||[],activeTeam=teamPeople.length?teamPeople.filter(person=>person.activo):people,areaCount=new Set(activeTeam.map(person=>String(person.area_id)).filter(Boolean)).size,profileIssues=activeTeam.filter(person=>!person.dni||!person.tiene_pin).length;
  const contractPending=activeTeam.filter(person=>person.resumen?.pendiente).length,contractAlerts=activeTeam.filter(person=>(person.resumen?.alertas||[]).length&&!person.resumen?.pendiente).length,contractAttention=contractPending+contractAlerts;
  const roleSummary=rolesData?.resumen||{};
  setOverview('admin-overview-control-value',`${priorities.length} ${priorities.length===1?'caso':'casos'}`);
  setOverview('admin-overview-control-copy',evidencePending||reviewPending?`${evidencePending} evidencias · ${reviewPending} revisiones`:'Entradas, evidencias y salidas al día');
  setOverview('admin-overview-close-value',`${complete}/${people.length}`);
  setOverview('admin-overview-close-copy',incomplete?`${incomplete} incompleta${incomplete===1?'':'s'} · ${Math.max(0,people.length-complete-incomplete)} en curso`:'Jornadas completas de hoy');
  setOverview('admin-overview-list-value',`${registered}/${people.length}`);
  setOverview('admin-overview-list-copy',pending?`${pending} ${pending===1?'persona sin entrada':'personas sin entrada'}`:'Todo el equipo registró entrada');
  setOverview('admin-overview-month-value',monthData?`${monthRecorded} registros`:'Consultar');
  setOverview('admin-overview-month-copy',monthData?`${Number(monthSummary.pendientes||0)} pendientes · ${Number(monthSummary.horas||0).toFixed(1)} h`:'Registros y pendientes del mes');
  setOverview('admin-overview-summary-value',monthRate==null?'Sin datos':`${monthRate}%`);
  setOverview('admin-overview-summary-copy',monthData?`${Number(monthSummary.T||0)} tardanzas · ${Number(monthSummary.J||0)} justificados`:'Asistencia consolidada');
  setOverview('admin-overview-people-value',`${activeTeam.length} activas`);
  setOverview('admin-overview-people-copy',profileIssues?`${areaCount} áreas · ${profileIssues} con datos pendientes`:`${areaCount} áreas · identidades completas`);
  setOverview('admin-overview-contract-value',contractAttention?`${contractAttention} por revisar`:'Al día');
  setOverview('admin-overview-contract-copy',teamData?`${contractPending} pendientes · ${contractAlerts} con alertas`:'Metas, avance y alertas');
  setOverview('admin-overview-roles-value',rolesData?`${Number(roleSummary.con_lider||0)}/${Number(roleSummary.areas||0)} con líder`:'Consultar');
  setOverview('admin-overview-roles-copy',rolesData?`${Number(roleSummary.colideres||0)} co-líderes · ${Number(roleSummary.sin_lider||0)} sin líder`:'Líderes y co-líderes técnicos');
  setOverview('admin-overview-access-value',teamData?`${activeTeam.filter(person=>!person.tiene_pin).length} sin PIN`:`${registered} marcas`);
  setOverview('admin-overview-access-copy',teamData?'Portal, PIN y geocerca':'Accesos y marcado del equipo');
  $('admin-refreshed').textContent='Actualizado '+new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'});
}

function adminListMsg(text){const el=$('admin-list-message');el.textContent=text||'';el.classList.toggle('show',!!text);}
function addIsoDays(iso,amount){const d=new Date((iso||isoLima())+'T12:00:00');d.setDate(d.getDate()+amount);return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}

async function showAdminSection(section){
  if(!APP.access.acceso_panel)return;
  if(section==='marcado'&&APP.access.rol!=='direccion'){toast('Marcado propio está reservado a Dirección.',true);section='overview'}
  if(section==='control'&&APP.access.rol!=='direccion'){toast('El control diario está reservado a Dirección.',true);section='overview'}
  if(section==='roles'&&!(APP.identity.isSystem&&APP.access.rol==='direccion')){toast('Los roles están reservados al administrador de sistemas.',true);section='overview'}
  if(section==='ranking'&&APP.access.rol!=='direccion')section='overview';
  if(section==='facebook'&&APP.access.rol!=='direccion')section='overview';
  const allowed=['overview','control','ranking','facebook','lista','mes','cierres','asignaciones','colaboradores','contratos','roles','marcado'];
  APP.adminSection=allowed.includes(section)?section:'overview';
  $('admin-overview-section').hidden=APP.adminSection!=='overview';
  $('admin-control-section').hidden=APP.adminSection!=='control';
  $('admin-ranking-section').hidden=APP.adminSection!=='ranking';
  $('admin-facebook-section').hidden=APP.adminSection!=='facebook';
  $('admin-list-section').hidden=APP.adminSection!=='lista';
  $('admin-month-section').hidden=APP.adminSection!=='mes';
  if($('admin-summary-section'))$('admin-summary-section').hidden=true;
  $('admin-close-section').hidden=APP.adminSection!=='cierres';
  $('admin-assignments-section').hidden=APP.adminSection!=='asignaciones';
  $('admin-people-section').hidden=APP.adminSection!=='colaboradores';
  $('admin-contracts-section').hidden=APP.adminSection!=='contratos';
  $('admin-roles-section').hidden=APP.adminSection!=='roles';
  $('admin-access-section').hidden=APP.adminSection!=='marcado';
  document.querySelectorAll('[data-admin-section]').forEach(b=>{
    const active=!!b.closest('.admin-section-nav')&&b.dataset.adminSection===APP.adminSection;
    b.classList.toggle('active',active);
    if(b.closest('.admin-section-nav'))b.setAttribute('aria-pressed',String(active));
  });
  if(APP.adminSection==='facebook'){
    if(typeof loadAdminFacebookReport==='function')await loadAdminFacebookReport();
  }else if(APP.adminSection==='ranking'){
    if(typeof loadAdminRanking==='function')await loadAdminRanking();
  }else if(APP.adminSection==='control'){
    if(typeof loadAdminControl==='function')await loadAdminControl();
  }else if(APP.adminSection==='lista'){
    if(!$('admin-list-date').value)$('admin-list-date').value=isoLima();
    $('admin-list-date').max=isoLima();
    await loadAdminAttendance();
  }else if(APP.adminSection==='mes'||APP.adminSection==='resumen'){
    if(typeof loadAdminMonth==='function')await loadAdminMonth();
  }else if(APP.adminSection==='marcado'){
    if(typeof loadAdminAccess==='function')await loadAdminAccess();
  }else if(['cierres','asignaciones'].includes(APP.adminSection)){
    if(typeof loadAdminCloses==='function')await loadAdminCloses();
  }else if(APP.adminSection==='roles'){
    if(typeof loadAdminRoles==='function')await loadAdminRoles();
  }else if(APP.adminSection==='colaboradores'||APP.adminSection==='contratos'){
    if(typeof loadAdminTeam==='function')await loadAdminTeam();
  }else await loadAdminHub();
}

async function loadAdminAttendance(){
  const date=$('admin-list-date').value||isoLima(),btn=$('admin-refresh');
  const request=++APP.adminListRequest;
  btn.disabled=true; adminListMsg('');
  $('admin-roster').innerHTML='<p class="admin-empty">Cargando la lista del día…</p>';
  const [{data,error},{data:closeData,error:closeError}]=await Promise.all([db.rpc('dash_admin_lista',{p_fecha:date}),db.rpc('dash_admin_cierres',{p_fecha:date})]);
  if(request!==APP.adminListRequest)return;
  btn.disabled=false;
  if(error||!data?.ok||closeError||!closeData?.ok){
    APP.adminList=null;
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_lista'));
    adminListMsg(missing?'La fase 2 todavía no está instalada en Supabase. Ejecuta dashboard_05_admin_lista.sql.':'No se pudo cargar la lista completa ni verificar sus cierres. Actualiza e inténtalo nuevamente.');
    $('admin-roster').innerHTML='<p class="admin-empty">La lista no está disponible.</p>';return;
  }
  const byClose=new Map((closeData?.personas||[]).map(x=>[String(x.id),x.cierre||{}]));
  data.personas=await hydrateProfilePhotos((data.personas||[]).map(person=>({...person,cierre:byClose.get(String(person.id))||null})));
  if(request!==APP.adminListRequest)return;
  APP.adminList=data;
  const areas=[...new Map((data.personas||[]).map(x=>[String(x.area_id),x.area||'Sin área'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es'));
  const current=$('admin-list-area').value;
  $('admin-list-area').innerHTML='<option value="">Todas las áreas</option>'+areas.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('');
  if(areas.some(x=>x[0]===current))$('admin-list-area').value=current;
  $('admin-date-next').disabled=date>=isoLima();
  renderAdminAttendance();
}

function renderAdminAttendance(){
  const data=APP.adminList;if(!data)return;
  const people=data.personas||[],counts={P:0,T:0,J:0,NG:0,pending:0,complete:0,incomplete:0};
  people.forEach(x=>x.estado?counts[x.estado]++:counts.pending++);
  const marked=people.length-counts.pending;
  people.forEach(x=>{if(['completa','regularizada'].includes(x.cierre?.estado))counts.complete++;if(x.cierre?.estado==='incompleta')counts.incomplete++});
  const kpis=[['PERSONAS DEL DÍA',people.length],['ENTRADAS',marked],['JORNADAS COMPLETAS',counts.complete],['INCOMPLETAS',counts.incomplete],['SIN ENTRADA',counts.pending]];
  $('admin-list-kpis').innerHTML=kpis.map(x=>`<article class="admin-list-kpi"><small>${x[0]}</small><b>${x[1]}</b></article>`).join('');
  const query=$('admin-list-search').value.trim().toLocaleLowerCase('es'),area=$('admin-list-area').value;
  const visible=people.filter(x=>(!area||String(x.area_id)===area)&&(!query||String(x.nombre).toLocaleLowerCase('es').includes(query)));
  const groups=new Map();visible.forEach(x=>{const key=String(x.area_id);if(!groups.has(key))groups.set(key,{name:x.area||'Sin área',items:[]});groups.get(key).items.push(x)});
  const canEdit=!!data.puede_editar;
  let html='';
  for(const group of groups.values()){
    const done=group.items.filter(x=>['completa','regularizada'].includes(x.cierre?.estado)).length,entries=group.items.filter(x=>x.estado).length;
    html+=`<section class="admin-area-group"><header class="admin-area-head"><span><i></i><b>${esc(group.name)}</b></span><small>${entries} con entrada · ${done} jornadas completas</small></header>`;
    for(const person of group.items){
      const rawState=person.estado||'',view=CLOSE_MODEL.attendancePresentation(rawState?{estado:rawState}:null,person.cierre),state=view.state,label=view.label;
      const mode={virtual:'Virtual',presencial:'Presencial',opcional:'Opcional',no_gestiona:'No gestiona'}[person.modalidad]||cap(person.modalidad||'Sin modalidad');
      const shift=`${fmtTime(person.hora_entrada)} — ${fmtTime(person.hora_salida)}`;
      const time=person.marcado_at?new Date(person.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):mode;
      const missing=CLOSE_MODEL.incompleteReasons(rawState?{estado:rawState}:null,person.cierre);
      const missingDetail=view.incomplete?`<small class="admin-missing-detail">${missing.length?'Faltó: '+missing.map(esc).join('; '):'No se dispone del detalle del cierre. Consulta Cierres y entregables.'}</small>`:'';
      const evidence=person.evidencia_path?`<button class="admin-evidence-button" type="button" data-admin-evidence="${esc(person.evidencia_path)}">Ver evidencia</button>`:'';
      html+=`<div class="admin-roster-row" data-admin-person="${person.id}">${profileAvatarMarkup(person)}<span class="admin-person"><b>${esc(person.nombre)}</b><small>${esc(mode)}${person.nota?' · '+esc(person.nota):''}</small>${evidence}</span><span class="admin-shift"><b>${esc(shift)}</b><small>${person.horas!=null?Number(person.horas).toFixed(1)+' h':'Horario del día'}</small></span><span class="admin-current-state ${state.toLowerCase()}">${esc(label)}${person.marcado_at?' · '+esc(time):''}</span>${missingDetail}<span class="admin-state-actions">${['P','T','J','NG'].map(s=>`<button type="button" class="admin-state-btn ${s.toLowerCase()} ${rawState===s?'on':''}" data-admin-state="${s}" aria-label="${statusLabel(s,true)}" aria-pressed="${rawState===s}" ${canEdit?'':'disabled'}>${s}</button>`).join('')}</span></div>`;
    }
    html+='</section>';
  }
  $('admin-roster').innerHTML=html||'<p class="admin-empty">No hay colaboradores para los filtros seleccionados.</p>';
  if(!canEdit)adminListMsg('Tu rol es de solo lectura. Puedes consultar la lista, pero no cambiar estados.');
}

async function openAdminStoredEvidence(path,bucket='asis-evidencias'){
  if(!path)return;
  const modal=$('stored-evidence-viewer'),image=$('stored-evidence-image'),loading=$('stored-evidence-loading'),errorBox=$('stored-evidence-error');
  const firstOpen=modal.hidden;
  STORED_EVIDENCE_VIEWER.path=path;STORED_EVIDENCE_VIEWER.bucket=bucket;if(firstOpen)STORED_EVIDENCE_VIEWER.trigger=document.activeElement;
  const request=++STORED_EVIDENCE_VIEWER.request;
  image.onload=null;image.onerror=null;image.removeAttribute('src');image.hidden=true;errorBox.hidden=true;loading.hidden=false;
  $('stored-evidence-viewer-title').textContent=bucket===REQUEST_BUCKET?'Evidencia de solicitud':'Evidencia de asistencia';
  image.alt=bucket===REQUEST_BUCKET?'Evidencia adjunta a la solicitud':'Evidencia adjunta al registro de asistencia';
  modal.hidden=false;document.body.classList.add('stored-evidence-viewer-open');
  if(firstOpen)requestAnimationFrame(()=>modal.querySelector('[data-close-stored-evidence]:not(.modal-backdrop)').focus({preventScroll:true}));
  try{
    const {data,error}=await db.storage.from(bucket).createSignedUrl(path,3600);
    if(error||!data?.signedUrl)throw error||new Error('url');
    if(request!==STORED_EVIDENCE_VIEWER.request)return;
    image.onload=()=>{if(request!==STORED_EVIDENCE_VIEWER.request)return;loading.hidden=true;errorBox.hidden=true;image.hidden=false};
    image.onerror=()=>{if(request!==STORED_EVIDENCE_VIEWER.request)return;loading.hidden=true;image.hidden=true;errorBox.hidden=false};
    image.src=data.signedUrl;
  }catch(error){
    if(request!==STORED_EVIDENCE_VIEWER.request)return;
    loading.hidden=true;image.hidden=true;errorBox.hidden=false;
  }
}

function closeStoredEvidenceViewer({restoreFocus=true}={}){
  const modal=$('stored-evidence-viewer');if(modal.hidden)return false;
  const trigger=STORED_EVIDENCE_VIEWER.trigger;
  STORED_EVIDENCE_VIEWER={path:'',bucket:'',trigger:null,request:STORED_EVIDENCE_VIEWER.request+1};
  const image=$('stored-evidence-image');image.onload=null;image.onerror=null;image.removeAttribute('src');image.hidden=true;
  modal.hidden=true;document.body.classList.remove('stored-evidence-viewer-open');
  if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
  return true;
}

async function resolveAdminPersonalRequest(id,approved){
  if(APP.access.rol!=='direccion')return toast('Solo Dirección puede resolver solicitudes.',true);
  const row=document.querySelector(`[data-admin-personal-request="${CSS.escape(String(id))}"]`),response=row?.querySelector(`[data-request-response="${CSS.escape(String(id))}"]`)?.value.trim()||'';
  row?.querySelectorAll('button,input').forEach(control=>control.disabled=true);
  try{
    const {data,error}=await db.rpc('dash_admin_resolver_solicitud',{p_id:Number(id),p_aprobada:approved,p_respuesta:response||null});
    if(error||!data?.ok)throw new Error(data?.motivo||error?.message||'resolver');
    toast(approved?'Solicitud aprobada.':'Solicitud rechazada.');await loadAdminHub();
  }catch(error){
    const detail=String(error?.message||''),message=detail.includes('saldo_dias_libres_insuficiente')?'No se puede aprobar: la persona no tiene suficientes días libres disponibles.':detail.includes('dia_libre_sin_dias_laborables')?'El rango solicitado no contiene días laborables.':'No se pudo resolver la solicitud. Actualiza e inténtalo otra vez.';
    toast(message,true);row?.querySelectorAll('button,input').forEach(control=>control.disabled=false)
  }
}

async function saveAdminState(personId,state,remove){
  if(!APP.adminList?.puede_editar)return adminListMsg('Tu rol no permite modificar asistencia.');
  const date=$('admin-list-date').value,person=(APP.adminList.personas||[]).find(x=>String(x.id)===String(personId));
  if(!person)return;
  adminListMsg('');
  document.querySelectorAll('.admin-state-btn').forEach(b=>b.disabled=true);
  try{
    if(remove){
      let {data,error}=await db.rpc('dash_admin_quitar_estado',{p_colab:Number(personId),p_fecha:date,p_evidencia_eliminada:false});
      if(error)throw error;
      if(!data?.ok&&data?.motivo==='requiere_evidencia'){
        if(!confirm(`La marca de ${person.nombre} tiene una evidencia. ¿Quieres eliminar la marca y su imagen?`))return;
        const {error:storageError}=await db.storage.from('asis-evidencias').remove([data.ruta]);
        if(storageError)throw storageError;
        ({data,error}=await db.rpc('dash_admin_quitar_estado',{p_colab:Number(personId),p_fecha:date,p_evidencia_eliminada:true}));
        if(error)throw error;
      }
      if(!data?.ok)throw new Error(data?.motivo||'eliminar');
      toast('Marca eliminada.');
    }else{
      const {data,error}=await db.rpc('dash_admin_guardar_estado',{p_colab:Number(personId),p_fecha:date,p_estado:state});
      if(error||!data?.ok)throw new Error(data?.motivo||error?.message||'guardar');
      toast(`Estado ${statusLabel(state,true).toLowerCase()} guardado.`);
    }
    await loadAdminAttendance();
  }catch(error){
    const message={sin_permiso:'Tu rol no permite editar.',no_labora:'La persona no labora en esa fecha.',fecha:'No se puede marcar una fecha futura.',antes_contrato:'La fecha es anterior al contrato.'}[error.message]||'No se pudo guardar el cambio. Revisa la conexión.';
    adminListMsg(message);
  }finally{
    if(APP.adminList?.puede_editar)document.querySelectorAll('.admin-state-btn').forEach(b=>b.disabled=false);
  }
}

function goView(view){
  if(view==='gestion'&&!APP.access.acceso_panel){toast('Esta cuenta no tiene acceso administrativo.',true);return;}
  if(['inicio','asistencia','perfil'].includes(view)&&!APP.identity.hasPersonal){toast('Esta cuenta no está vinculada a un perfil personal.',true);return;}
  if(view==='equipo'&&!APP.identity.isLeader){toast('Mi equipo está reservado al líder y a los co-líderes técnicos del área.',true);return;}
  paintShell(view);
  if(matchMedia('(max-width:900px)').matches)window.scrollTo(0,0);
  closeMenu(); if(view==='asistencia')return loadPersonalRequests(); if(view==='equipo')return loadTeam(); if(view==='gestion')return showAdminSection(APP.adminSection);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>goView(b.dataset.view)); document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goView(b.dataset.go));
document.querySelectorAll('[data-mobile-action]').forEach(button=>button.onclick=()=>{
  const action=button.dataset.mobileAction;
  if(['asistencia','perfil','equipo','gestion'].includes(action))return goView(action);
  if(action==='marcar')return handleMarkAction();
  if(action==='jornada'){
    const target=!$('mobile-close-panel').hidden?$('mobile-close-panel'):$('mobile-today-summary');
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    target.focus?.({preventScroll:true});
  }
});
$('mobile-home-logout').onclick=()=>logout();
$('mobile-home-photo').onclick=()=>$('profile-photo-input').click();
$('profile-photo-camera').onclick=()=>$('profile-photo-input').click();
$('profile-photo-change').onclick=()=>$('profile-photo-input').click();
$('profile-photo-remove').onclick=removeProfilePhoto;
$('profile-photo-input').onchange=event=>chooseProfilePhoto(event.target.files?.[0]);
$('team-list').onclick=e=>{
  const evidence=e.target.closest('[data-team-review]');
  if(evidence){openAdminReviewPerson(evidence.dataset.teamReview,evidence);return}
  const row=e.target.closest('[data-team-person]');
  if(row){selectTeamPerson(row.dataset.teamPerson);return}
  const profile=e.target.closest('[data-team-profile]');
  if(profile)selectTeamPerson(profile.dataset.teamProfile);
};
$('team-list').onkeydown=e=>{
  if(e.key==='Enter'||e.key===' '){
    const row=e.target.closest('[data-team-person]');
    if(row&&!e.target.closest('button')){e.preventDefault();selectTeamPerson(row.dataset.teamPerson);}
  }
};
if($('team-view-general-btn')) $('team-view-general-btn').onclick=()=>selectTeamPerson(null);
const teamWs=$('team-workspace');
if(teamWs){
  teamWs.addEventListener('click',e=>{
    const evidence=e.target.closest('[data-team-review]');
    if(evidence&&typeof openAdminReviewPerson==='function'){
      e.stopPropagation();
      openAdminReviewPerson(evidence.dataset.teamReview,evidence);
    }
  });
}
document.querySelectorAll('[data-close-team-profile]').forEach(button=>button.onclick=closeTeamProfile);
$('month-prev').onclick=()=>{ APP.month--;if(APP.month<1){APP.month=12;APP.year--}loadHistory(); };
$('month-next').onclick=()=>{ const n=new Date(),cur=n.getFullYear()*12+n.getMonth(),target=APP.year*12+(APP.month-1);if(target>=cur)return;APP.month++;if(APP.month>12){APP.month=1;APP.year++}loadHistory(); };
$('mobile-month-prev').onclick=()=>$('month-prev').click();
$('mobile-month-next').onclick=()=>$('month-next').click();
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-personal-request]');
  if(button&&!button.disabled){openPersonalRequest(button.dataset.personalRequest,'',button);return}
  const dateButton=event.target.closest('[data-request-date]');
  if(dateButton){openRequestCalendar(dateButton);return}
  if(!event.target.closest('#request-calendar'))closeRequestCalendar();
});
document.querySelectorAll('[data-close-personal-request]').forEach(button=>button.onclick=closePersonalRequest);
document.querySelectorAll('[data-request-kind]').forEach(button=>{
  button.onclick=()=>syncRequestKindButtons(button.dataset.requestKind);
  button.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    const options=[...document.querySelectorAll('[data-request-kind]')],index=options.indexOf(button),step=['ArrowRight','ArrowDown'].includes(event.key)?1:-1,next=options[(index+step+options.length)%options.length];
    syncRequestKindButtons(next.dataset.requestKind);next.focus();
  };
});
$('request-calendar-prev').onclick=()=>moveRequestCalendar(-1);
$('request-calendar-next').onclick=()=>moveRequestCalendar(1);
$('request-calendar-today').onclick=()=>chooseRequestCalendarDate(isoLima());
$('request-calendar-grid').onclick=event=>{const day=event.target.closest('[data-request-calendar-date]');if(day&&!day.disabled)chooseRequestCalendarDate(day.dataset.requestCalendarDate)};
document.querySelectorAll('[data-close-attendance-day]').forEach(button=>button.onclick=closeAttendanceDay);
$('attendance-day-content').onclick=event=>{
  const closeEvidence=event.target.closest('[data-close-attendance-evidence]');if(closeEvidence)return closeAttendanceEvidence();
  const evidence=event.target.closest('[data-attendance-evidence]');if(evidence)return openAttendanceEvidence(Number(evidence.dataset.attendanceEvidence),evidence);
  const retry=event.target.closest('[data-retry-attendance-day]');if(retry)return openAttendanceDay(APP.attendanceDayDate);
  const justify=event.target.closest('#attendance-day-justify');if(!justify)return;
  const date=justify.dataset.date;closeAttendanceDay();openPersonalRequest('justificacion',date);
};
$('personal-requests-refresh').onclick=loadPersonalRequests;
$('personal-request-form').onsubmit=submitPersonalRequest;
$('personal-request-file-button').onclick=()=>$('personal-request-file').click();
$('personal-request-file-change').onclick=()=>$('personal-request-file').click();
$('personal-request-file').onchange=event=>choosePersonalRequestEvidence(event.target.files?.[0]);
$('personal-request-detail').oninput=event=>$('personal-request-detail-count').textContent=event.target.value.length;
$('personal-request-start').onchange=event=>{const end=$('personal-request-end');end.min=event.target.value;if(!end.value||end.value<event.target.value)end.value=event.target.value;syncRequestDateButtons()};
$('personal-request-end').onchange=syncRequestDateButtons;
$('calendar-grid').onclick=event=>{const day=event.target.closest('[data-history-date]');if(day)openAttendanceDay(day.dataset.historyDate)};
$('rail-calendar-open').onclick=()=>goView('asistencia');
const ANNOUNCEMENTS=[
  {title:'Reportes consolidados',src:'images/dashboard/comunicado-reportes.webp',alt:'Comunicado KJA sobre el seguimiento de comparticiones y reportes consolidados en Excel',fallback:'La Dirección generará reportes consolidados en Excel para dar seguimiento a las comparticiones.'},
  {title:'Envío de comprobantes',src:'images/dashboard/comunicado-comparticiones.webp',alt:'Comunicado KJA sobre el envío de comprobantes de comparticiones por WhatsApp',fallback:'Envía tu comprobante de comparticiones por WhatsApp directamente desde el portal.'}
];
const ANNOUNCEMENT_ROTATION_MS=7000;
let announcementIndex=0;
let announcementTimer=null;
let announcementHoverPaused=false;
let announcementFocusPaused=false;
let announcementModalOpen=false;
const announcementCarousel=$('rail-announcement-carousel');
const announcementImage=$('rail-announcement-image');
const announcementFallback=$('rail-announcement-fallback');
const announcementViewer=$('announcement-viewer');
const announcementViewerImage=$('announcement-viewer-image');

function announcementReducedMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function renderAnnouncementDots(id,controlsId,className){
  const container=$(id);if(!container)return;
  container.replaceChildren(...ANNOUNCEMENTS.map((item,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className=className;button.role='tab';button.dataset.announcementIndex=String(index);button.setAttribute('aria-controls',controlsId);button.setAttribute('aria-label',`Mostrar comunicado: ${item.title}`);button.onclick=()=>showAnnouncement(index);
    return button;
  }));
}
function updateAnnouncementDots(){
  document.querySelectorAll('[data-announcement-index]').forEach(button=>{const selected=Number(button.dataset.announcementIndex)===announcementIndex;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1});
}
function showAnnouncement(index){
  announcementIndex=(index+ANNOUNCEMENTS.length)%ANNOUNCEMENTS.length;
  const item=ANNOUNCEMENTS[announcementIndex];
  $('rail-announcement-title').textContent=item.title;
  $('announcement-viewer-title').textContent=item.title;
  $('rail-announcement-fallback-title').textContent=item.title;
  $('rail-announcement-fallback-copy').textContent=item.fallback;
  if(announcementImage){announcementImage.src=item.src;announcementImage.alt=item.alt;announcementImage.hidden=false}
  if(announcementViewerImage){announcementViewerImage.src=item.src;announcementViewerImage.alt=item.alt;announcementViewerImage.hidden=false}
  if(announcementFallback)announcementFallback.hidden=true;
  const status=`${announcementIndex+1} de ${ANNOUNCEMENTS.length}`;
  $('rail-announcement-status').textContent=status;
  $('announcement-viewer-status').textContent=status;
  updateAnnouncementDots();
  syncAnnouncementRotation();
}
function syncAnnouncementRotation(){
  clearInterval(announcementTimer);announcementTimer=null;
  if(ANNOUNCEMENTS.length<2||document.hidden||announcementModalOpen||announcementHoverPaused||announcementFocusPaused||announcementReducedMotion())return;
  announcementTimer=setInterval(()=>showAnnouncement(announcementIndex+1),ANNOUNCEMENT_ROTATION_MS);
}
function openAnnouncementViewer(){
  const modal=$('announcement-viewer');
  announcementModalOpen=true;syncAnnouncementRotation();
  modal.hidden=false;
  document.body.classList.add('announcement-viewer-open');
  requestAnimationFrame(()=>modal.querySelector('.announcement-viewer-close').focus());
}
$('rail-announcement-open').onclick=openAnnouncementViewer;
function closeAnnouncementViewer(){
  const modal=$('announcement-viewer');
  if(modal.hidden)return false;
  modal.hidden=true;
  document.body.classList.remove('announcement-viewer-open');
  announcementModalOpen=false;syncAnnouncementRotation();
  $('rail-announcement-open').focus({preventScroll:true});
  return true;
}
document.querySelectorAll('[data-close-announcement]').forEach(button=>button.onclick=closeAnnouncementViewer);
function announcementFocusableElements(){
  return [...announcementViewer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>!element.hidden&&!element.closest('[hidden]'));
}
$('rail-announcement-image').onerror=()=>{announcementImage.hidden=true;announcementFallback.hidden=false};
$('rail-announcement-prev').onclick=()=>showAnnouncement(announcementIndex-1);
$('rail-announcement-next').onclick=()=>showAnnouncement(announcementIndex+1);
$('announcement-viewer-prev').onclick=()=>showAnnouncement(announcementIndex-1);
$('announcement-viewer-next').onclick=()=>showAnnouncement(announcementIndex+1);
announcementCarousel.addEventListener('mouseenter',()=>{announcementHoverPaused=true;syncAnnouncementRotation()});
announcementCarousel.addEventListener('mouseleave',()=>{announcementHoverPaused=false;syncAnnouncementRotation()});
announcementCarousel.addEventListener('focusin',()=>{announcementFocusPaused=true;syncAnnouncementRotation()});
announcementCarousel.addEventListener('focusout',event=>{if(!announcementCarousel.contains(event.relatedTarget)){announcementFocusPaused=false;syncAnnouncementRotation()}});
$('announcement-viewer').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeAnnouncementViewer();return}
  if(event.key==='ArrowLeft'){event.preventDefault();showAnnouncement(announcementIndex-1);return}
  if(event.key==='ArrowRight'){event.preventDefault();showAnnouncement(announcementIndex+1);return}
  if(event.key==='Tab'){
    const focusable=announcementFocusableElements();if(!focusable.length)return;
    const first=focusable[0];const last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
});
document.addEventListener('visibilitychange',syncAnnouncementRotation);
const announcementMotionQuery=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
if(announcementMotionQuery?.addEventListener)announcementMotionQuery.addEventListener('change',syncAnnouncementRotation);
else if(announcementMotionQuery?.addListener)announcementMotionQuery.addListener(syncAnnouncementRotation);
renderAnnouncementDots('rail-announcement-dots','rail-announcement-image','rail-announcement-dot');
renderAnnouncementDots('announcement-viewer-dots','announcement-viewer-image','announcement-viewer-dot');
showAnnouncement(0);
$('admin-refresh').onclick=()=>APP.adminSection==='ranking'&&typeof loadAdminRanking==='function'?loadAdminRanking():APP.adminSection==='control'&&typeof loadAdminControl==='function'?loadAdminControl():APP.adminSection==='lista'?loadAdminAttendance():(APP.adminSection==='mes'||APP.adminSection==='resumen')&&typeof loadAdminMonth==='function'?loadAdminMonth(true):['cierres','asignaciones'].includes(APP.adminSection)&&typeof loadAdminCloses==='function'?loadAdminCloses():APP.adminSection==='marcado'&&typeof loadAdminAccess==='function'?loadAdminAccess():APP.adminSection==='roles'&&typeof loadAdminRoles==='function'?loadAdminRoles():(APP.adminSection==='colaboradores'||APP.adminSection==='contratos')&&typeof loadAdminTeam==='function'?loadAdminTeam():loadAdminHub();
$('admin-request-refresh').onclick=loadAdminHub;
document.querySelectorAll('[data-admin-section]').forEach(b=>b.onclick=()=>showAdminSection(b.dataset.adminSection));
$('admin-date-prev').onclick=()=>{$('admin-list-date').value=addIsoDays($('admin-list-date').value,-1);loadAdminAttendance()};
$('admin-date-next').onclick=()=>{const next=addIsoDays($('admin-list-date').value,1);if(next<=isoLima()){$('admin-list-date').value=next;loadAdminAttendance()}};
$('admin-date-today').onclick=()=>{$('admin-list-date').value=isoLima();loadAdminAttendance()};
$('admin-list-date').onchange=loadAdminAttendance;
$('admin-list-search').oninput=renderAdminAttendance;
$('admin-list-area').onchange=renderAdminAttendance;
$('admin-roster').onclick=e=>{
  const evidence=e.target.closest('[data-admin-evidence]');
  if(evidence)return openAdminStoredEvidence(evidence.dataset.adminEvidence);
  const button=e.target.closest('[data-admin-state]');if(!button)return;
  const row=button.closest('[data-admin-person]');saveAdminState(row.dataset.adminPerson,button.dataset.adminState,button.classList.contains('on'));
};
$('admin-request-list').onclick=event=>{
  const evidence=event.target.closest('[data-request-evidence]');
  if(evidence)return openAdminStoredEvidence(evidence.dataset.requestEvidence,REQUEST_BUCKET);
  const action=event.target.closest('[data-admin-personal-action]');
  if(action)return resolveAdminPersonalRequest(action.dataset.requestId,action.dataset.adminPersonalAction==='approve');
};
$('stored-evidence-retry').onclick=()=>openAdminStoredEvidence(STORED_EVIDENCE_VIEWER.path,STORED_EVIDENCE_VIEWER.bucket);
document.querySelectorAll('[data-close-stored-evidence]').forEach(button=>button.onclick=()=>closeStoredEvidenceViewer());
$('stored-evidence-viewer').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeStoredEvidenceViewer();return}
  if(event.key!=='Tab')return;
  const controls=[...$('stored-evidence-viewer').querySelectorAll('button:not([disabled])')].filter(control=>!control.hidden&&control.offsetParent!==null);
  if(!controls.length)return;const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});

function openMenu(){ $('sidebar').classList.add('open');$('side-scrim').classList.add('show'); } function closeMenu(){ $('sidebar').classList.remove('open');$('side-scrim').classList.remove('show'); }
$('menu-toggle').onclick=openMenu;$('side-scrim').onclick=closeMenu;
$('mobile-back-home').onclick=()=>goView('inicio');
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(window.KJAAnnouncementModal&&window.KJAAnnouncementModal.close())return;
  if(closeStoredEvidenceViewer())return;
  if(closeAnnouncementViewer())return;
  if(closeRequestCalendar(true))return;
  if(!$('personal-request-modal').hidden)return closePersonalRequest();
  if(!$('attendance-day-modal').hidden){if(closeAttendanceEvidence())return;closeAttendanceDay()}
});

// ── Evidencia y marcado ──────────────────────────────────────────────
function dailyCloseMessage(text,type=''){
  const el=$('day-close-message');if(!el)return;
  el.textContent=text||'';el.className='day-close-message'+(type?' '+type:'');
}

function dailyEvidenceMessage(text,type=''){
  const el=$('daily-evidence-message');if(!el)return;
  el.textContent=text||'';el.className='daily-evidence-message'+(type?' '+type:'');
}

function dailyCloseStatusCopy(state){
  return {
    sin_entrada:'Primero marca tu entrada',
    en_curso:'Evidencias pendientes',
    lista_para_salir:'Evidencias completas',
    completa:'Jornada completa',
    regularizada:'Jornada completa',
    incompleta:'Jornada incompleta',
    no_aplica:'Cierre no requerido'
  }[state]||'Preparando cierre';
}

function dailyCloseGuidePresentation(data){
  if(data.solo_comparticiones){
    if((data.pendientes||0)>0)return data.comparticiones_vencidas
      ?{stage:'incomplete',title:'Compartición no entregada',copy:`El horario de Facebook terminó a las ${fmtTime(data.compartir_hasta)} sin registrar las capturas.`}
      :{stage:data.puede_compartir?'facebook':'scheduled',title:data.puede_compartir?'Comparte y adjunta tus capturas':'Compartición programada',copy:data.puede_compartir?'Esta tarea es independiente de tu asistencia laboral.':'La carga se abrirá dentro de tu horario de Facebook.'};
    return {stage:'facebook-complete',title:'Compartición registrada',copy:'Las capturas quedaron enviadas para revisión.'};
  }
  if(!data.entrada_at)return {stage:'entry',title:'Empieza registrando tu entrada',copy:'Después se habilitarán las evidencias pendientes.'};
  if(data.comparticiones_vencidas)return {stage:'incomplete',title:'Compartición no entregada',copy:`El horario de Facebook terminó a las ${fmtTime(data.compartir_hasta)} sin registrar las capturas.`};
  if(data.estado==='completa'||data.estado==='regularizada')return data.comparticiones_pendientes
    ?{stage:'complete',title:'Jornada laboral cerrada',copy:data.puede_compartir?'Tu horario de Facebook está abierto; ya puedes adjuntar las capturas.':`Facebook se habilitará de ${fmtTime(data.compartir_desde)} a ${fmtTime(data.compartir_hasta)}.`}
    :{stage:'complete',title:'Jornada cerrada correctamente',copy:'Entrada, evidencias y salida quedaron registradas.'};
  if(data.estado==='incompleta')return {stage:'incomplete',title:'El cierre quedó incompleto',copy:'El plazo terminó sin registrar todos los pasos.'};
  if(((data.pendientes_salida??data.pendientes)||0)>0)return {stage:'evidence',title:'Completa tus evidencias',copy:'Selecciona cada requisito pendiente para adjuntar las imágenes.'};
  if(data.puede_marcar_salida)return {stage:'exit',title:'Todo listo para salir',copy:'Tus evidencias están completas. Confirma ahora tu salida.'};
  return {stage:'ready',title:'Evidencias completas',copy:`La salida se habilitará desde las ${fmtTime(data.salida_desde)}.`};
}

function dailyCloseItemMarkup(item,{entry=false}={}){
  const complete=!!item.completo,locked=!!item.locked,editable=complete&&!!item.editable;
  const facebookReceipt=complete&&item.tipo==='comparticiones';
  const review=item.revision_estado||'';
  const status=review==='observada'?'Corregir evidencia':editable?'Editar':complete&&review==='pendiente'?'En revisión':complete?'Completo':entry?'Marcar entrada':locked&&item.tipo==='salida'?'Al finalizar':locked?'Aún no disponible':item.impedimento?'Ver pendiente':'Subir evidencia';
  const icons={
    comparticiones:'<svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 21v-8h2.8l.4-3.1h-3.2v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.8-.1-1.6-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H7.8V13h2.7v8h3.2Z"/></svg>',
    rpe:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5M10 12h5M10 16h5"/></svg>',
    salida:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l1.5-2h5L16 7h4v12H4z"/><circle cx="12" cy="13" r="3"/><path d="M18 3v3M16.5 4.5h3"/></svg>'
  };
  const checkIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const icon=facebookReceipt
    ? `${icons.comparticiones}<span class="day-close-check-badge">${checkIcon}</span>`
    : complete?checkIcon:icons[item.tipo]||'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>';
  const attrs=entry
    ? `data-daily-action="entry" aria-haspopup="dialog" aria-controls="mark-modal" aria-label="${complete?'Ver detalle de la entrada registrada':'Registrar mi asistencia'}"`
    : locked||complete&&!editable?'disabled':`data-daily-requirement="${esc(item.tipo)}" aria-haspopup="dialog" aria-controls="daily-evidence-editor"${editable?' data-daily-edit="true"':''}${item.asignacion==null?'':` data-daily-assignment="${esc(item.asignacion)}"`}`;
  const description=item.tipo==='salida'&&!complete
    ? (CLOSE_MODEL.hasPendingWork(APP.cierre)?'Primero completa tu RPE y los entregables pendientes':locked?'1 foto con la hora visible, disponible al finalizar':'Último paso: adjunta 1 foto con la hora de salida')
    : item.tipo==='comparticiones'&&!complete&&!locked&&review!=='observada'
      ? `Adjunta entre ${APP.cierre?.comparticiones_min||1} y ${FACEBOOK_EVIDENCE_MAX} capturas, o 1 collage`
      : (item.descripcion||'Adjunta la evidencia correspondiente');
  if(facebookReceipt){
    const editAction=editable?`<button type="button" class="facebook-evidence-edit" ${attrs} aria-label="Editar ${esc(item.titulo)}"><span>Editar</span><svg class="edit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l10.5-10.5-4-4zM12.8 7.2l4 4"/></svg></button>`:'';
    return `<article class="day-close-item type-comparticiones is-complete has-facebook-receipt ${editable?'is-editable ':''}${review==='pendiente'?'is-review ':''}">
      <span class="day-close-check">${icon}</span>
      <span class="day-close-item-copy"><b>${esc(item.titulo)}</b><small>${esc(description)}</small></span>
      <span class="facebook-evidence-actions"><span class="day-close-item-status">Compartido</span>${editAction}</span>
      <button class="facebook-share-open" type="button" data-facebook-share-open aria-haspopup="dialog" aria-controls="facebook-share-modal"><span class="facebook-share-open-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m5.5 17 4-4 3 3 2-2 4 3.5"/></svg></span><span><b>Ver comprobante de evidencias</b><small>Consulta las capturas y sus datos de registro</small></span><svg class="facebook-share-open-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </article>`;
  }
  return `<button type="button" class="day-close-item type-${esc(item.tipo||'general')} ${entry?'is-entry ':''}${complete?'is-complete ':locked?'is-locked ':''}${editable?'is-editable ':''}${facebookReceipt?'has-facebook-receipt ':''}${review==='pendiente'?'is-review ':review==='observada'?'is-observed ':''}${item.impedimento?'has-issue ':''}" ${attrs}${editable?` aria-label="Editar ${esc(item.titulo)}"`:''}>
    <span class="day-close-check">${icon}</span>
    <span class="day-close-item-copy"><b>${esc(item.titulo)}</b><small>${esc(description)}</small></span>
    <span class="day-close-item-status">${esc(status)}${editable?'<svg class="edit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l10.5-10.5-4-4zM12.8 7.2l4 4"/></svg>':!complete&&!locked?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>':''}</span>
  </button>`;
}

function renderMobileDailyClose(data,items){
  const panel=$('mobile-close-panel');if(!panel)return;
  panel.hidden=false;
  const entryComplete=!!data.entrada_at,closed=['completa','regularizada','incompleta'].includes(data.estado),pendingItems=items.filter(item=>!item.completo);
  panel.dataset.state=data.comparticiones_vencidas?'incomplete':closed?CLOSE_MODEL.stateTone(data.estado):entryComplete?(pendingItems.length?'pending':'ready'):'waiting';
  const facebookOnly=!!data.solo_comparticiones;
  $('mobile-close-title').textContent=facebookOnly?'Compartición de hoy':entryComplete?'Cierre de mi jornada':'Pendientes de hoy';
  $('mobile-close-copy').textContent=facebookOnly?'No tienes jornada laboral hoy, pero sí una tarea programada de Facebook.':entryComplete?'Completa estas evidencias antes de registrar tu salida.':'Estos son los pasos que completarás durante tu jornada.';
  $('mobile-close-count').textContent=pendingItems.length?`${pendingItems.length} ${pendingItems.length===1?'pendiente':'pendientes'}`:'Todo listo';
  $('mobile-close-list').innerHTML=items.map((item,index)=>dailyCloseItemMarkup(item,{entry:!facebookOnly&&index===0})).join('');
  const completedItems=Math.max(0,items.length-pendingItems.length),progress=items.length?Math.round(completedItems/items.length*100):0;
  let bannerTitle='',bannerCopy='';
  if(facebookOnly){
    bannerTitle=data.comparticiones_vencidas?'Compartición no entregada':pendingItems.length?'Completa tu tarea programada':'Evidencia enviada';
    bannerCopy=data.comparticiones_vencidas?`El horario terminó a las ${fmtTime(data.compartir_hasta)} sin registrar las capturas.`:pendingItems.length?`Adjunta tus capturas entre ${fmtTime(data.compartir_desde)} y ${fmtTime(data.compartir_hasta)}.`:'La entrega quedó lista para revisión.';
  }else if(!entryComplete){
    bannerTitle='Tu jornada empieza aquí';bannerCopy='Registra tu entrada para habilitar las evidencias del día.';
  }else if(data.salida_at){
    bannerTitle=data.comparticiones_vencidas?'Jornada incompleta':'¡Jornada laboral completada!';bannerCopy=data.comparticiones_vencidas
      ?`El horario de Facebook terminó a las ${fmtTime(data.compartir_hasta)} sin registrar las capturas.`
      :data.comparticiones_pendientes
      ?`Tu salida quedó registrada. Facebook ${data.puede_compartir?'está habilitado ahora':`se habilitará de ${fmtTime(data.compartir_desde)} a ${fmtTime(data.compartir_hasta)}`}.`
      :`Tu salida quedó registrada a las ${formatAttendanceClock(data.salida_at)}.`;
  }else if(data.estado==='incompleta'){
    bannerTitle='Jornada incompleta';bannerCopy='El plazo terminó. Revisa el estado de las tareas que quedaron pendientes.';
  }else if(pendingItems.length){
    bannerTitle=`Te ${pendingItems.length===1?'falta':'faltan'} ${pendingItems.length} ${pendingItems.length===1?'pendiente':'pendientes'}`;bannerCopy='Abre cada tarea y adjunta la evidencia solicitada para continuar.';
  }else if(data.puede_marcar_salida){
    bannerTitle='Todo listo para cerrar';bannerCopy='Tus evidencias están completas. Ya puedes registrar tu salida.';
  }else{
    bannerTitle='Evidencias completas';bannerCopy=`Podrás registrar tu salida desde las ${fmtTime(data.salida_desde)}.`;
  }
  $('mobile-close-banner-title').textContent=bannerTitle;
  $('mobile-close-banner-copy').textContent=bannerCopy;
  $('mobile-close-banner-meta').textContent=items.length?`${completedItems} de ${items.length} completados`:'Sin tareas asignadas';
  $('mobile-close-banner-progress').style.transform=`scaleX(${progress/100})`;
  const action=$('mobile-close-action');action.hidden=false;action.disabled=true;action.dataset.action='';
  if(facebookOnly){
    action.hidden=true;
    $('mobile-close-footer-title').textContent=data.comparticiones_vencidas?'Plazo finalizado':pendingItems.length?(data.puede_compartir?'Capturas pendientes':'Aún no abre tu horario'):'Evidencia enviada';
    $('mobile-close-footer-copy').textContent=data.comparticiones_vencidas?'La compartición de hoy quedó incompleta.':pendingItems.length?`Disponible de ${fmtTime(data.compartir_desde)} a ${fmtTime(data.compartir_hasta)}.`:'La entrega quedó lista para revisión.';
  }else if(!entryComplete){
    const source=$('open-mark');action.dataset.action='entry';action.disabled=source?.disabled??true;action.querySelector('span').textContent='Registrar mi entrada';
    $('mobile-close-footer-title').textContent='Empieza por tu entrada';$('mobile-close-footer-copy').textContent='Después podrás abrir cada evidencia.';
  }else if(data.salida_at){
    action.hidden=true;$('mobile-close-footer-title').textContent='Jornada completada';$('mobile-close-footer-copy').textContent=`Salida registrada a las ${formatAttendanceClock(data.salida_at)}.`;
  }else if(data.estado==='incompleta'){
    action.hidden=true;$('mobile-close-footer-title').textContent='Jornada incompleta';$('mobile-close-footer-copy').textContent='El plazo terminó sin completar el cierre.';
  }else if(pendingItems.length){
    action.querySelector('span').textContent='Salida bloqueada';$('mobile-close-footer-title').textContent=`Completa ${pendingItems.length} ${pendingItems.length===1?'pendiente':'pendientes'}`;$('mobile-close-footer-copy').textContent='Toca cada fila pendiente para adjuntar su evidencia.';
  }else if(data.puede_marcar_salida){
    action.dataset.action='exit';action.disabled=false;action.querySelector('span').textContent='Marcar mi salida';$('mobile-close-footer-title').textContent='Todo listo para salir';$('mobile-close-footer-copy').textContent='Confirma el cierre con la hora del servidor.';
  }else{
    action.querySelector('span').textContent=`Salida desde ${fmtTime(data.salida_desde)}`;$('mobile-close-footer-title').textContent='Evidencias completas';$('mobile-close-footer-copy').textContent='La salida se habilitará en el horario indicado.';
  }
  // Sync mobile time cards with close data
  renderMobileTimeRecord({entryAt:data.entrada_at,exitAt:data.salida_at,scheduledExit:data.hora_salida_programada});
  if(data.salida_at)$('mobile-close-footer-copy').textContent=`${Number(data.horas_efectivas||0).toFixed(2)} horas acreditadas.`;
  $('mobile-close-footer').hidden=action.hidden||action.disabled||action.dataset.action!=='exit';
}

function mergeDailyReviewState(closeData,reviewData){
  if(!closeData||!reviewData?.ok)return closeData;
  const reviews=reviewData.revisiones||[];
  const apply=(item,assignment=null)=>{
    const review=reviews.find(row=>row.requisito===(assignment==null?item.tipo:'asignado')&&(assignment==null||String(row.asignacion_id)===String(assignment)));
    if(!review)return item;
    item.revision_estado=review.revision_estado;
    item.revision_nota=review.revision_nota||'';
    if(review.revision_estado==='observada'){
      item.completo=false;
      item.descripcion=`Corrección solicitada: ${review.revision_nota||'revisa la evidencia y vuelve a enviarla'}`;
    }
    return item;
  };
  (closeData.requisitos||[]).forEach(item=>apply(item));
  (closeData.asignaciones||[]).forEach(item=>apply(item,item.id));
  return closeData;
}

function mergeDailyIssueState(closeData,issueData){
  if(!closeData||!issueData?.ok)return closeData;
  const issues=issueData.impedimentos||[],apply=(item,assignment=null)=>{
    const issue=issues.find(row=>row.requisito===(assignment==null?item.tipo:'asignado')&&(assignment==null||String(row.asignacion_id)===String(assignment)));
    if(issue)item.impedimento=issue;return item;
  };
  (closeData.requisitos||[]).forEach(item=>apply(item));
  (closeData.asignaciones||[]).forEach(item=>apply(item,item.id));
  return closeData;
}

function renderDailyClose(){
  const data=APP.cierre,section=$('day-close'),card=$('today-attendance-card');if(!section)return;
  if(!data?.ok||!data.aplica){section.hidden=true;$('mobile-close-panel').hidden=true;card?.classList.remove('has-daily-close');return;}
  const facebookOnly=!!data.solo_comparticiones,entryComplete=!!data.entrada_at,closed=!facebookOnly&&['completa','regularizada','incompleta'].includes(data.estado);
  section.hidden=false;
  card?.classList.add('has-daily-close');
  const locked=!entryComplete||closed||DAILY_EVIDENCE.busy;
  const entryItem={
    tipo:'entrada',titulo:entryComplete?'Entrada registrada':'Registrar asistencia',
    descripcion:entryComplete?`Marcada a las ${formatAttendanceClock(data.entrada_at)}`:'Registra primero tu asistencia de entrada',
    completo:entryComplete,locked:true
  };
  const items=[...(facebookOnly?[]:[entryItem]),...(data.requisitos||[]).map(item=>({...item,
    compartido_por:item.tipo==='comparticiones'?APP.inicio?.colaborador?.nombre:null,
    compartido_dni:item.tipo==='comparticiones'?APP.inicio?.colaborador?.dni:null,
    editable:item.tipo!=='salida'&&!!item.completo&&(item.editable??data.puede_editar_evidencias),
    locked:(item.tipo==='comparticiones'?DAILY_EVIDENCE.busy:locked)||!!item.bloqueado||(item.tipo==='salida'&&CLOSE_MODEL.hasPendingWork(data))
  })),...(data.asignaciones||[]).map(item=>({
    tipo:'asignado',asignacion:item.id,titulo:item.titulo,
    descripcion:item.instrucciones||`${cap(item.tipo||'Entregable')} asignado para hoy`,
    completo:item.completo,editable:!!item.completo&&!!data.puede_editar_evidencias,locked
  }))];
  items.sort((a,b)=>Number(a.tipo==='salida')-Number(b.tipo==='salida'));
  section.classList.toggle('is-facebook-only',facebookOnly);
  const motionKey=item=>`${item.tipo}:${item.asignacion??''}`;
  const motionScope=`${APP.inicio?.colaborador?.id||''}:${data.fecha||''}:${data.entrada_at||''}`;
  const previousTasks=section._taskMotionScope===motionScope?section._taskMotionState:null;
  const newlyCompleted=new Set(items.filter(item=>item.completo&&previousTasks?.get(motionKey(item))===false).map(motionKey));
  section._taskMotionScope=motionScope;section._taskMotionState=new Map(items.map(item=>[motionKey(item),!!item.completo]));
  const missingEvidence=items.filter(item=>!item.completo&&item.tipo!=='entrada').length;
  section.dataset.pending=String(missingEvidence);
  $('day-close-checklist').innerHTML=items.map((item,index)=>dailyCloseItemMarkup(item,{entry:!facebookOnly&&index===0})).join('');
  renderMobileDailyClose(data,items);
  if(newlyCompleted.size){
    for(const container of [$('day-close-checklist'),$('mobile-close-list')]){
      container?.querySelectorAll('.day-close-item').forEach((row,index)=>{
        if(items[index]&&newlyCompleted.has(motionKey(items[index])))row.classList.add('just-completed');
      });
    }
  }

  $('day-close-title').textContent=facebookOnly?'Compartición programada':entryComplete?'Cierre de mi jornada':'Pendientes de hoy';
  $('day-close-copy').textContent=facebookOnly?'Hoy no tienes jornada laboral; esta tarea sigue activa en su propio horario.':data.comparticiones_vencidas?'La jornada laboral cerró, pero la compartición obligatoria no se entregó dentro de su horario.':data.salida_at&&data.comparticiones_pendientes?'Tu jornada laboral ya cerró. Facebook continúa pendiente en su horario independiente.':entryComplete?'Completa tus evidencias laborales antes de registrar la salida.':'Revisa los pasos que completarás durante tu jornada.';
  const state=$('day-close-state');
  if(missingEvidence&&!closed&&entryComplete)$('day-close-copy').textContent=`Te ${missingEvidence===1?'falta 1 evidencia':`faltan ${missingEvidence} evidencias`}. Abre cada pendiente y sube lo solicitado antes de salir.`;
  state.dataset.state=facebookOnly?(data.comparticiones_vencidas?'incomplete':data.pendientes?'waiting':'complete'):entryComplete?CLOSE_MODEL.stateTone(data.estado):'waiting';
  state.innerHTML=`<i></i>${esc(facebookOnly?(data.comparticiones_vencidas?'Compartición incompleta':data.pendientes?'Facebook pendiente':'Compartición completa'):entryComplete?dailyCloseStatusCopy(data.estado):'Entrada pendiente')}`;
  const guide=dailyCloseGuidePresentation(data),guideElement=$('day-close-guide');
  guideElement.dataset.stage=guide.stage;$('day-close-guide-title').textContent=guide.title;$('day-close-guide-copy').textContent=guide.copy;
  guideElement.querySelector('.day-close-journey').setAttribute('aria-label',`${guide.title}. ${guide.copy}`);
  const button=$('day-close-button');
  if(facebookOnly){
    $('day-close-time-label').textContent='HORARIO DE FACEBOOK';
    $('day-close-time').textContent=`${fmtTime(data.compartir_desde)}–${fmtTime(data.compartir_hasta)}`;
    $('day-close-window').textContent=data.puede_compartir?'Tu franja está abierta ahora':'Se habilitará en la franja indicada';
    button.hidden=true;
    dailyCloseMessage(data.comparticiones_vencidas?'El horario de Facebook terminó sin registrar las capturas.':data.pendientes?(data.puede_compartir?'Abre la tarea azul y adjunta tus evidencias.':'Esta tarea no exige entrada ni salida; espera a que abra su horario.'):'Compartición enviada correctamente.',data.comparticiones_vencidas?'is-error':'is-success');
    return;
  }
  button.hidden=false;
  if(!entryComplete){
    const sourceButton=$('open-mark');
    $('day-close-time-label').textContent='HORA DE ENTRADA';
    $('day-close-time').textContent=fmtTime(APP.inicio?.dia?.hora_entrada||data.hora_entrada_programada);
    $('day-close-window').textContent='Primer paso de tu jornada';
    button.dataset.action='entry';
    button.disabled=sourceButton?.disabled??true;
    $('day-close-button-caption').textContent=$('mark-caption')?.textContent||'MARCAR AHORA';
    $('day-close-button-label').textContent=$('mark-label')?.textContent||'Registrar mi asistencia';
    dailyCloseMessage('Registra tu entrada para habilitar las evidencias pendientes.');
    return;
  }

  $('day-close-time-label').textContent='HORA DE SALIDA';
  $('day-close-time').textContent=data.salida_at?formatAttendanceClock(data.salida_at):fmtTime(data.hora_salida_programada);
  $('day-close-window').textContent=data.salida_at?'Hora oficial registrada':data.salida_desde&&data.salida_hasta?`Disponible de ${fmtTime(data.salida_desde)} a ${fmtTime(data.salida_hasta)}`:'Horario por revisar';
  button.dataset.action='exit';
  button.disabled=!data.puede_marcar_salida||DAILY_EVIDENCE.busy||CLOSE_MODEL.hasPendingWork(data);
  if(data.salida_at){
    $('day-close-button-caption').textContent='SALIDA REGISTRADA';$('day-close-button-label').textContent=formatAttendanceClock(data.salida_at);
    dailyCloseMessage(data.comparticiones_vencidas
      ?`Jornada incompleta · El horario de Facebook terminó sin registrar las capturas.`
      :data.comparticiones_pendientes
      ?`Jornada laboral completa · Facebook ${data.puede_compartir?'está habilitado ahora':`se habilitará de ${fmtTime(data.compartir_desde)} a ${fmtTime(data.compartir_hasta)}`}.`
      :`Jornada completa · ${Number(data.horas_efectivas||0).toFixed(2)} horas acreditadas.`,data.comparticiones_vencidas?'is-error':'is-success');
  }else if(data.estado==='incompleta'){
    $('day-close-button-caption').textContent='PLAZO FINALIZADO';$('day-close-button-label').textContent='Jornada incompleta';
    dailyCloseMessage('La entrada se conserva, pero esta jornada no suma asistencia ni horas.','is-error');
  }else if(((data.pendientes_salida??data.pendientes)||0)>0){
    $('day-close-button-caption').textContent='CIERRE PENDIENTE';$('day-close-button-label').textContent='Marcar mi salida';
    const pendingExit=data.pendientes_salida??data.pendientes;
    dailyCloseMessage(`Completa ${pendingExit} ${pendingExit===1?'requisito':'requisitos'} antes de salir.`);
  }else if(!data.puede_marcar_salida){
    $('day-close-button-caption').textContent='EVIDENCIAS COMPLETAS';$('day-close-button-label').textContent='Marcar mi salida';
    dailyCloseMessage(`Podrás cerrar tu jornada desde las ${fmtTime(data.salida_desde)}.`);
  }else{
    $('day-close-button-caption').textContent='TODO COMPLETO';$('day-close-button-label').textContent='Marcar mi salida';
    dailyCloseMessage('Tus evidencias están completas. Ya puedes registrar la salida.','is-success');
  }
}

async function loadDailyClose({quiet=false}={}){
  if(!APP.identity.hasPersonal)return null;
  const {data,error}=await db.rpc('dash_cierre_hoy');
  if(error){
    const missing=error.code==='PGRST202'||String(error.message||'').includes('dash_cierre_hoy');
    if(missing){$('day-close').hidden=true;$('today-attendance-card')?.classList.remove('has-daily-close');return null;}
    if(!quiet)dailyCloseMessage('No pudimos actualizar el cierre. Revisa tu conexión.','is-error');
    return null;
  }
  if(!data?.ok){if(!quiet)dailyCloseMessage(data?.motivo==='sesion'?'Tu sesión venció. Vuelve a ingresar.':'No pudimos preparar el cierre.','is-error');return null;}
  const [{data:reviews,error:reviewError},{data:issues,error:issueError}]=await Promise.all([db.rpc('dash_mis_revisiones_cierre'),db.rpc('dash_mis_impedimentos_cierre')]);
  APP.cierre=mergeDailyIssueState(mergeDailyReviewState(data,reviewError?null:reviews),issueError?null:issues);renderDailyClose();return APP.cierre;
}

function clearDailyEvidenceFiles(){
  DAILY_EVIDENCE.files.forEach(item=>{if(item.url)URL.revokeObjectURL(item.url)});
  DAILY_EVIDENCE.files=[];$('daily-evidence-file').value='';renderDailyEvidencePreviews();
}

function clearDailyEvidenceVideo(){
  if(DAILY_EVIDENCE.video?.url)URL.revokeObjectURL(DAILY_EVIDENCE.video.url);
  DAILY_EVIDENCE.video=null;
  $('daily-video-file').value='';$('daily-video-player').removeAttribute('src');$('daily-video-preview').hidden=true;$('daily-video-message').textContent='';
}

function dailyUploadStep(name,state,copy=''){
  const step=$(`daily-upload-step-${name}`);if(!step)return;
  step.dataset.state=state;
  if(copy)step.querySelector('small').textContent=copy;
}

function setDailyEvidenceProcess(phase,{title='',copy='',progress=0,current=0,total=0}={}){
  const sheet=$('daily-evidence-editor')?.querySelector('.daily-evidence-sheet'),process=$('daily-evidence-process');
  if(!sheet||!process)return;
  const active=phase==='upload'||phase==='success';
  sheet.dataset.phase=phase;
  process.hidden=!active;
  $('daily-evidence-cancel-top').disabled=active;
  $('daily-evidence-cancel').disabled=active;
  if(title)$('daily-upload-title').textContent=title;
  if(copy)$('daily-upload-copy').textContent=copy;
  $('daily-upload-progress-bar').style.transform=`scaleX(${Math.max(0,Math.min(1,progress))})`;
  if(total)$('daily-upload-count').textContent=`${current} de ${total} ${total===1?'archivo':'archivos'}`;
  if(phase==='idle'){
    dailyUploadStep('prepare','active','Optimización y protección');
    dailyUploadStep('upload','waiting','En espera');
    dailyUploadStep('confirm','waiting','Registro oficial de la jornada');
  }
}

function closeDailyEvidenceEditor({restoreFocus=true}={}){
  if(DAILY_EVIDENCE.busy||DAILY_EVIDENCE.confirming)return;
  DAILY_EVIDENCE_LOAD++;
  clearDailyEvidenceFiles();clearDailyEvidenceVideo();DAILY_EVIDENCE={requirement:'',assignment:null,title:'',files:[],existingFiles:[],existingVideoPath:null,video:null,busy:false,loading:false,editing:false};
  $('daily-evidence-detail').value='';$('daily-issue-detail').value='';$('daily-issue-form').hidden=true;$('daily-issue-message').textContent='';dailyEvidenceMessage('');setDailyEvidenceProcess('idle');$('daily-evidence-editor').hidden=true;
  document.body.classList.remove('daily-evidence-open');
  if(restoreFocus&&DAILY_EVIDENCE_TRIGGER){DAILY_EVIDENCE_TRIGGER.focus();DAILY_EVIDENCE_TRIGGER=null}
}

function mountDailyEvidencePortal(){
  const editor=$('daily-evidence-editor');
  if(editor&&editor.parentElement!==document.body)document.body.append(editor);
  return editor;
}

async function loadDailyEditableEvidence(request){
  const picker=$('daily-evidence-picker'),submit=$('daily-evidence-submit');
  DAILY_EVIDENCE.loading=true;picker.disabled=true;submit.disabled=true;dailyEvidenceMessage('Cargando los archivos que ya enviaste…','is-info');
  const {data,error}=await db.rpc('dash_mi_entrega_editable',{p_requisito:DAILY_EVIDENCE.requirement,p_asignacion:DAILY_EVIDENCE.assignment});
  if(request!==DAILY_EVIDENCE_LOAD)return;
  if(error||!data?.ok){DAILY_EVIDENCE.loading=false;dailyEvidenceMessage(dailyEvidenceFailure(data?.motivo||'cargar_actuales'),'is-error');return}
  try{
    const images=(data.archivos||[]).filter(file=>!String(file.mime||'').startsWith('video/'));
    const signed=await Promise.all(images.map(async file=>{const result=await db.storage.from(DAILY_EVIDENCE_BUCKET).createSignedUrl(file.path,900);if(result.error||!result.data?.signedUrl)throw new Error('firma');return {...file,url:result.data.signedUrl}}));
    if(request!==DAILY_EVIDENCE_LOAD)return;
    DAILY_EVIDENCE.existingFiles=signed;
    DAILY_EVIDENCE.entregaId=data.entrega;
    DAILY_EVIDENCE.existingVideoPath=(data.archivos||[]).find(file=>String(file.mime||'').startsWith('video/'))?.path||null;
    $('daily-evidence-detail').value=data.detalle||'';
    const savedMode=document.querySelector(`input[name="daily-evidence-mode"][value="${data.modalidad||'individuales'}"]`);if(savedMode)savedMode.checked=true;
    if(DAILY_EVIDENCE.existingVideoPath)$('daily-video').hidden=true;
    renderDailyEvidencePreviews();
    dailyEvidenceMessage(DAILY_EVIDENCE.requirement==='comparticiones'?`${signed.length} imágenes guardadas. La × permite eliminar una imagen después de confirmar.`:`${signed.length} ${signed.length===1?'archivo actual':'archivos actuales'}. Quita con × sólo las que deseas cambiar.${DAILY_EVIDENCE.existingVideoPath?' El video actual se conservará.':''}`,'is-ready');
    DAILY_EVIDENCE.loading=false;picker.disabled=false;submit.disabled=false;
  }catch{DAILY_EVIDENCE.loading=false;dailyEvidenceMessage('No pudimos mostrar tus archivos actuales. Cierra el editor e inténtalo nuevamente.','is-error')}
}

function openDailyEvidenceEditor(requirement,assignment=null){
  if(DAILY_EVIDENCE.busy)return;
  if(requirement==='salida'&&CLOSE_MODEL.hasPendingWork(APP.cierre)){toast('Primero completa tu RPE y los entregables pendientes. La salida es el último paso.');return;}
  const data=APP.cierre,facebook=requirement==='comparticiones';
  if(!data||(!facebook&&(!data.entrada_at||data.salida_at||data.estado==='incompleta')))return;
  const item=requirement==='asignado'
    ?(data.asignaciones||[]).find(row=>String(row.id)===String(assignment))
    :(data.requisitos||[]).find(row=>row.tipo===requirement);
  if(!item)return;
  const editing=!!item.completo;
  if(item.bloqueado&&!item.completo){toast(facebook?'La carga se habilitará dentro de tu horario de Facebook.':'Esta evidencia todavía no está disponible.');return}
  if(editing&&!(item.editable??data.puede_editar_evidencias)){toast(facebook?'La edición sólo está disponible dentro de tu horario de Facebook.':'La edición sólo está disponible durante tu horario de trabajo.');return}
  closeDailyEvidenceEditor({restoreFocus:false});
  mountDailyEvidencePortal();
  DAILY_EVIDENCE={requirement,assignment:assignment==null?null:Number(assignment),title:item.titulo,files:[],existingFiles:[],existingVideoPath:null,video:null,busy:false,loading:false,editing};
  $('daily-evidence-editor').querySelector('.daily-evidence-sheet').dataset.requirement=requirement;
  setDailyEvidenceProcess('idle');
  $('daily-evidence-title').textContent=editing?`Editar ${item.titulo}`:item.titulo;
  $('daily-evidence-copy').textContent=editing?(facebook?'La × elimina una imagen guardada después de confirmar. También puedes añadir nuevas capturas.':'Quita los archivos incorrectos y añade sus reemplazos.'):facebook?`Puedes adjuntar desde ${data.comparticiones_min||1} captura y hasta ${FACEBOOK_EVIDENCE_MAX}, o una sola imagen tipo collage.`:item.descripcion||item.instrucciones||'Selecciona los archivos que correspondan.';
  $('daily-evidence-edit-note').hidden=!editing;
  $('daily-evidence-edit-until').textContent=`Puedes editar hasta las ${fmtTime(facebook?data.compartir_hasta:data.hora_salida_programada)}`;
  $('daily-issue').hidden=requirement==='salida'||editing;
  const issue=item.impedimento;$('daily-issue-form').hidden=!issue;$('daily-issue-detail').value=issue?.detalle||'';$('daily-issue-message').textContent=issue?'Aviso enviado. Puedes actualizar el motivo si cambió la situación.':'';$('daily-issue-toggle').querySelector('b').textContent=issue?'Impedimento informado':'¿No podrás completarlo hoy?';$('daily-issue-submit').textContent=issue?'Actualizar aviso':'Enviar aviso';
  $('daily-evidence-mode').hidden=requirement!=='comparticiones';
  $('daily-video').hidden=!['rpe','asignado'].includes(requirement);
  $('daily-evidence-file').multiple=requirement!=='salida';
  $('daily-evidence-file').accept='image/jpeg,image/png,image/webp'+(requirement==='asignado'?',.pdf,.doc,.docx,.ppt,.pptx':'');
  $('daily-evidence-individual-help').textContent=`Desde ${data.comparticiones_min||1} y hasta ${FACEBOOK_EVIDENCE_MAX} imágenes`;
  $('daily-evidence-collage-option').hidden=!data.collage_permitido;
  const firstMode=document.querySelector('input[name="daily-evidence-mode"][value="individuales"]');if(firstMode)firstMode.checked=true;
  $('daily-evidence-picker-help').textContent=requirement==='comparticiones'?`JPG, PNG o WebP · desde ${data.comparticiones_min||1} hasta ${FACEBOOK_EVIDENCE_MAX}${data.collage_permitido?' o 1 collage':''}`:requirement==='asignado'?'PDF, Word, PowerPoint o imágenes · hasta 5 archivos · documentos hasta 10 MB':requirement==='salida'?'JPG, PNG o WebP · selecciona 1 foto donde se vea la hora':'JPG, PNG o WebP · hasta 5 archivos';
  $('daily-evidence-picker').querySelector('b').textContent=requirement==='asignado'?'Elegir archivos':editing?'Añadir imágenes':'Elegir imágenes';
  $('daily-evidence-submit').querySelector('span').textContent=editing?'Guardar cambios':'Guardar evidencia';
  $('daily-evidence-editor').hidden=false;
  document.body.classList.add('daily-evidence-open');
  requestAnimationFrame(()=>$('daily-evidence-cancel-top').focus({preventScroll:true}));
  if(editing)loadDailyEditableEvidence(++DAILY_EVIDENCE_LOAD);
}

function dailyEvidenceMode(){
  return document.querySelector('input[name="daily-evidence-mode"]:checked')?.value||'individuales';
}

async function submitDailyIssue(){
  if(DAILY_EVIDENCE.busy)return;const detail=$('daily-issue-detail').value.trim(),message=$('daily-issue-message'),button=$('daily-issue-submit');
  if(detail.length<10){message.textContent='Explica el motivo con al menos 10 caracteres.';message.className='is-error';return}
  button.disabled=true;button.textContent='Enviando…';message.textContent='';message.className='';
  const {data,error}=await db.rpc('dash_reportar_impedimento',{p_requisito:DAILY_EVIDENCE.requirement,p_asignacion:DAILY_EVIDENCE.assignment,p_detalle:detail});
  button.disabled=false;
  if(error||!data?.ok){const labels={jornada:'La jornada ya no está abierta.',ya_completo:'Este requisito ya está completo.',datos:'Revisa la explicación ingresada.'};message.textContent=labels[data?.motivo]||'No pudimos enviar el aviso. Revisa tu conexión.';message.className='is-error';button.textContent='Enviar aviso';return}
  message.textContent='Aviso enviado a Dirección. El requisito continúa pendiente.';message.className='is-success';button.textContent='Actualizar aviso';toast('Impedimento informado.');await loadDailyClose({quiet:true});
}

function renderDailyEvidencePreviews(){
  const box=$('daily-evidence-previews');if(!box)return;
  const existing=DAILY_EVIDENCE.existingFiles||[],fresh=DAILY_EVIDENCE.files||[];
  const total=existing.length+fresh.length;
  box.hidden=!total;box.classList.toggle('is-many',total>10);
  box.setAttribute('aria-label',`${total} ${total===1?'imagen seleccionada':'imágenes seleccionadas'}`);
  box.innerHTML=existing.map((item,index)=>`<div class="daily-evidence-preview is-existing" style="--preview-index:${Math.min(index,7)}"><em>Actual</em>${dailyFilePreview(item,index)}<button type="button" data-remove-existing-file="${index}" aria-label="Quitar archivo actual ${index+1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>`).join('')+fresh.map((item,index)=>`<div class="daily-evidence-preview is-new" style="--preview-index:${Math.min(existing.length+index,7)}"><em>Nueva</em>${dailyFilePreview(item,index)}<button type="button" data-remove-daily-file="${index}" aria-label="Quitar imagen nueva ${index+1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>`).join('');
}

function dailyDocumentType(file){
  const ext=String(file.name||'').split('.').pop().toLowerCase();
  const types={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
  return types[ext]?{ext,type:types[ext]}:null;
}
function dailyFilePreview(item,index){
  const documentFile=String(item.type||item.mime||'').startsWith('application/');
  return documentFile?'<a href="'+esc(item.url)+'" target="_blank" rel="noopener" style="display:grid;place-content:center;min-height:100px;padding:16px;overflow-wrap:anywhere">'+esc(item.name||'Documento '+(index+1))+' · Abrir</a>':'<img src="'+esc(item.url)+'" alt="Archivo '+(index+1)+'" loading="lazy" decoding="async">';
}

async function chooseDailyEvidence(files){
  if(!files?.length||DAILY_EVIDENCE.loading||DAILY_EVIDENCE.busy)return;
  const allowed=DAILY_EVIDENCE.requirement==='salida'||DAILY_EVIDENCE.requirement==='comparticiones'&&dailyEvidenceMode()==='collage'?1:DAILY_EVIDENCE.requirement==='comparticiones'?FACEBOOK_EVIDENCE_MAX:5,max=Math.max(0,allowed-(DAILY_EVIDENCE.existingFiles?.length||0));
  const selected=[...files].slice(0,max);
  if([...files].length>max)return dailyEvidenceMessage(max===0?'Quita primero un archivo actual para poder añadir su reemplazo.':max===1?(DAILY_EVIDENCE.requirement==='salida'?'La evidencia de salida admite una sola foto.':'El modo collage admite una sola imagen.'):`Puedes añadir ${max} ${max===1?'imagen más':'imágenes más'}; Facebook admite hasta ${FACEBOOK_EVIDENCE_MAX} capturas por entrega.`);
  if(selected.some(file=>file.size>25*1024*1024))return dailyEvidenceMessage('Una de las imágenes supera 25 MB. Elige una versión más pequeña.');
  const sourceBytes=selected.reduce((total,file)=>total+Number(file.size||0),0);
  if(sourceBytes>300*1024*1024)return dailyEvidenceMessage('La selección supera 300 MB antes de comprimir. Divide las capturas en archivos más pequeños.');
  const state=DAILY_EVIDENCE,picker=$('daily-evidence-picker'),submit=$('daily-evidence-submit'),prepared=[];
  state.loading=true;picker.disabled=true;submit.disabled=true;
  dailyEvidenceMessage(`Preparando 0 de ${selected.length} archivos…`,'is-info');
  try{
    clearDailyEvidenceFiles();
    for(let index=0;index<selected.length;index++){
      const file=selected[index],documentType=dailyDocumentType(file);
      if(documentType&&state.requirement!=='asignado')throw new Error('Usa imágenes JPG, PNG o WebP para este requisito.');
      if(documentType&&file.size>10*1024*1024)throw new Error('Cada documento debe pesar como máximo 10 MB.');
      if(!documentType&&!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa PDF, DOC, DOCX, PPT, PPTX o imágenes JPG, PNG y WebP.');
      const blob=documentType?file:await compressImage(file);
      if(state!==DAILY_EVIDENCE){prepared.forEach(item=>URL.revokeObjectURL(item.url));return}
      prepared.push({blob,url:URL.createObjectURL(blob),name:file.name,type:documentType?.type||'image/jpeg',ext:documentType?.ext||'jpg'});
      dailyEvidenceMessage(`Preparando ${index+1} de ${selected.length} archivos…`,'is-info');
    }
    DAILY_EVIDENCE.files=prepared;renderDailyEvidencePreviews();const total=(DAILY_EVIDENCE.existingFiles?.length||0)+prepared.length;dailyEvidenceMessage(`${total} ${total===1?'archivo quedará':'archivos quedarán'} en la entrega al guardar.`,'is-ready');
  }catch(error){prepared.forEach(item=>URL.revokeObjectURL(item.url));if(state===DAILY_EVIDENCE){DAILY_EVIDENCE.files=[];renderDailyEvidencePreviews();dailyEvidenceMessage(error?.message||'No pudimos procesar el archivo. Revisa su formato.')}}
  finally{if(state===DAILY_EVIDENCE){state.loading=false;picker.disabled=false;submit.disabled=false;$('daily-evidence-file').value=''}}
}

function readVideoMetadata(file){
  return new Promise((resolve,reject)=>{const video=document.createElement('video'),url=URL.createObjectURL(file);video.preload='metadata';video.onloadedmetadata=()=>{const duration=Number(video.duration);URL.revokeObjectURL(url);Number.isFinite(duration)?resolve(duration):reject(new Error('duracion'))};video.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('formato'))};video.src=url});
}

async function chooseDailyVideo(files){
  const file=files?.[0];if(!file)return;
  const message=$('daily-video-message');message.className='daily-video-message';
  if(!['video/mp4','video/webm'].includes(file.type)){message.textContent='Usa un video MP4 o WebM.';message.classList.add('is-error');return}
  if(file.size>8*1024*1024){message.textContent='El video supera 8 MB. Recortalo o exportalo en menor calidad.';message.classList.add('is-error');return}
  message.textContent='Comprobando duracion...';
  try{
    const duration=await readVideoMetadata(file);if(duration<=0||duration>30){message.textContent='El video debe durar como maximo 30 segundos.';message.classList.add('is-error');return}
    clearDailyEvidenceVideo();const url=URL.createObjectURL(file),ext=file.type==='video/webm'?'webm':'mp4';DAILY_EVIDENCE.video={blob:file,url,type:file.type,ext,duration};
    $('daily-video-player').src=url;$('daily-video-name').textContent=file.name||'Video listo';$('daily-video-meta').textContent=`${Math.ceil(duration)} s · ${(file.size/1024/1024).toFixed(1)} MB`;$('daily-video-preview').hidden=false;message.textContent='Video verificado y listo para adjuntar.';message.classList.add('is-ready');
  }catch{message.textContent='No pudimos leer el video. Prueba con MP4 o WebM.';message.classList.add('is-error')}
}

async function requestDailyEvidencePermit(ext='jpg'){
  const {data:{session}}=await db.auth.getSession();if(!session)throw Object.assign(new Error('sesion'),{motivo:'sesion'});
  const body={ext,accion:DAILY_EVIDENCE.editing?'reemplazar':undefined,requisito:DAILY_EVIDENCE.requirement,asignacion:DAILY_EVIDENCE.assignment,modalidad:DAILY_EVIDENCE.requirement==='comparticiones'?dailyEvidenceMode():null};
  console.log('[entrega-debug] requestPermit →',JSON.stringify(body));
  const response=await fetch(SUPABASE_URL+'/functions/v1/dash-entrega',{
    method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const permit=await response.json().catch(()=>null);
  console.log('[entrega-debug] permit ←',JSON.stringify(permit));
  if(!response.ok||!permit?.ok)throw Object.assign(new Error(permit?.motivo||'permiso'),{motivo:permit?.motivo||'permiso'});
  return permit;
}

async function requestDailyVideoPermit(){
  const {data:{session}}=await db.auth.getSession();if(!session)throw Object.assign(new Error('sesion'),{motivo:'sesion'});
  const response=await fetch(SUPABASE_URL+'/functions/v1/dash-entrega',{method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({accion:DAILY_EVIDENCE.editing?'reemplazar':undefined,tipo:'video',requisito:DAILY_EVIDENCE.requirement,asignacion:DAILY_EVIDENCE.assignment,ext:DAILY_EVIDENCE.video.ext})});
  const permit=await response.json().catch(()=>null);if(!response.ok||!permit?.ok)throw Object.assign(new Error(permit?.motivo||'permiso'),{motivo:permit?.motivo||'permiso'});return permit;
}

async function uploadDailyEvidence(file){
  const {blob,ext='jpg',type='image/jpeg'}=file;
  console.log('[entrega-debug] uploadFile →',{ext,type,blobType:blob?.type,blobSize:blob?.size,name:file.name});
  const permit=await requestDailyEvidencePermit(ext);
  // Una Edge Function antigua convierte documentos a rutas .jpg aunque SQL ya esté actualizado.
  if(!String(permit.ruta||'').toLowerCase().endsWith('.'+ext.toLowerCase())){
    await cleanupDailyEvidence([permit.ruta]);
    throw Object.assign(new Error('formato_permiso'),{motivo:'formato_permiso'});
  }
  console.log('[entrega-debug] uploading to',permit.ruta,'with contentType',type);
  const {error}=await db.storage.from(DAILY_EVIDENCE_BUCKET).uploadToSignedUrl(permit.ruta,permit.token,blob,{contentType:type});
  if(error){console.error('[entrega-debug] upload error',error);throw Object.assign(new Error('subida'),{motivo:'subida'});}
  console.log('[entrega-debug] upload OK →',permit.ruta);
  return permit.ruta;
}

async function uploadDailyVideo(){
  const permit=await requestDailyVideoPermit();
  const {error}=await db.storage.from(DAILY_EVIDENCE_BUCKET).uploadToSignedUrl(permit.ruta,permit.token,DAILY_EVIDENCE.video.blob,{contentType:DAILY_EVIDENCE.video.type});
  if(error)throw Object.assign(new Error('subida_video'),{motivo:'subida_video',path:permit.ruta});return permit.ruta;
}

async function cleanupDailyEvidence(paths){
  if(!paths?.length)return;
  try{
    const {data:{session}}=await db.auth.getSession();if(!session)return;
    await fetch(SUPABASE_URL+'/functions/v1/dash-entrega',{
      method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({accion:'limpiar',paths})
    });
  }catch{}
}

function dailyEvidenceFailure(reason){
  const min=Number(APP.cierre?.comparticiones_min||1);
  return {
    sesion:'Tu sesión venció. Vuelve a ingresar.',
    no_habilitado:'El cierre diario todavía no está habilitado.',
    sin_entrada_o_cerrada:'La jornada no tiene una entrada abierta.',
    cantidad_comparticiones:`Adjunta entre ${min} y ${FACEBOOK_EVIDENCE_MAX} capturas, o utiliza una sola imagen tipo collage.`,
    foto_salida:'Selecciona una sola foto donde se vea claramente la hora de salida.',
    salida_aun_no_disponible:'La foto de salida se habilitará al comenzar tu ventana de cierre.',
    salida_fuera_de_plazo:'La ventana para registrar la evidencia de salida ya terminó.',
    collage_no_permitido:'La modalidad collage está deshabilitada. Adjunta las capturas individuales.',
    cuota_diaria:'Alcanzaste el límite de cargas del día. Comunícate con Dirección si necesitas reemplazar una evidencia.',
    archivo_no_verificado:'El servidor no pudo validar el formato o tamaño del archivo. Si es PDF o Word, Sistemas debe comprobar la actualización de la carga de documentos.',
    formato_permiso:'El servidor de cargas aún no admite este documento. Sistemas debe actualizar la función dash-entrega. Tu archivo se conserva.',
    ya_completo:'Esta evidencia ya estaba registrada.',
    fuera_horario_edicion:'La ventana autorizada para editar esta evidencia ya terminó.',
    fuera_horario_compartir:'La carga de Facebook está fuera de su horario programado.',
    no_programado:'Hoy no tienes una compartición de Facebook programada.',
    sin_entrega:'La entrega cambió o ya no está disponible. Actualiza el portal e inténtalo de nuevo.',
    cargar_actuales:'No pudimos cargar tus archivos actuales. Cierra el editor e inténtalo nuevamente.',
    archivo_ajeno:'La entrega cambió mientras la editabas. Vuelve a abrirla antes de guardar.',
    cambio_concurrente:'La evidencia cambió mientras la editabas. Actualiza el portal antes de volver a intentarlo.',
    subida:'No pudimos subir un archivo. Revisa tu conexión e inténtalo nuevamente.'
  }[reason]||'No pudimos guardar la evidencia. Revisa los archivos e inténtalo otra vez.';
}

async function submitDailyEvidence(event){
  event.preventDefault();if(DAILY_EVIDENCE.busy||DAILY_EVIDENCE.loading||DAILY_EVIDENCE.confirming)return;
  if(DAILY_EVIDENCE.existingFiles?.some(file=>file.deletionPending)){dailyEvidenceMessage('Termina la eliminación pendiente con la × antes de guardar.','is-error');return;}
  const editing=!!DAILY_EVIDENCE.editing,mode=dailyEvidenceMode(),min=Number(APP.cierre?.comparticiones_min||1),count=(DAILY_EVIDENCE.existingFiles?.length||0)+DAILY_EVIDENCE.files.length,uploadTotal=DAILY_EVIDENCE.files.length+(DAILY_EVIDENCE.video?1:0);
  const max=DAILY_EVIDENCE.requirement==='comparticiones'?FACEBOOK_EVIDENCE_MAX:5;
  const selection=CLOSE_MODEL.evidenceSelectionPolicy({requirement:DAILY_EVIDENCE.requirement,mode,count,min,max,collageAllowed:!!APP.cierre?.collage_permitido});
  if(!selection.ok){const messages={vacio:'Selecciona al menos una imagen.',minimo:`Selecciona al menos ${min} capturas para completar este requisito.`,maximo:`Puedes adjuntar como máximo ${max} imágenes.`,cantidad_collage:'Selecciona una sola imagen tipo collage.',collage_no_permitido:'La modalidad collage está deshabilitada.'};return dailyEvidenceMessage(messages[selection.reason]||'Revisa las imágenes seleccionadas.')}

  const button=$('daily-evidence-submit');DAILY_EVIDENCE.busy=true;button.disabled=true;button.querySelector('span').textContent='Subiendo…';dailyEvidenceMessage('');
  const paths=[];
  try{
    setDailyEvidenceProcess('upload',{title:editing?'Preparando tu corrección':'Preparando un envío seguro',copy:uploadTotal?`Validando ${uploadTotal} ${uploadTotal===1?'archivo nuevo':'archivos nuevos'} antes de enviarlos.`:'Conservando las imágenes correctas y retirando las seleccionadas.',progress:.08,current:0,total:Math.max(uploadTotal,1)});
    dailyUploadStep('prepare','done','Archivos protegidos');
    dailyUploadStep('upload',uploadTotal?'active':'done',uploadTotal?`0 de ${uploadTotal} archivos`:'Sin archivos nuevos');
    for(let index=0;index<DAILY_EVIDENCE.files.length;index++){
      $('daily-upload-copy').textContent=`Subiendo ${index+1} de ${DAILY_EVIDENCE.files.length}. Mantén esta ventana abierta.`;
      $('daily-upload-progress-bar').style.transform=`scaleX(${.12+(index/uploadTotal)*.68})`;
      paths.push(await uploadDailyEvidence(DAILY_EVIDENCE.files[index]));
      $('daily-upload-count').textContent=`${index+1} de ${uploadTotal} archivos`;
      $('daily-upload-progress-bar').style.transform=`scaleX(${.12+((index+1)/uploadTotal)*.68})`;
    }
    let videoPath=null;if(DAILY_EVIDENCE.video){$('daily-upload-copy').textContent='Subiendo el video corto. Mantén esta ventana abierta.';videoPath=await uploadDailyVideo();paths.push(videoPath);$('daily-upload-count').textContent=`${uploadTotal} de ${uploadTotal} archivos`;}
    dailyUploadStep('upload','done',uploadTotal?`${uploadTotal} ${uploadTotal===1?'archivo enviado':'archivos enviados'}`:'Imágenes actuales organizadas');
    dailyUploadStep('confirm','active','Guardando registro oficial');
    $('daily-upload-title').textContent=editing?'Confirmando los cambios':'Confirmando tu entrega';
    $('daily-upload-copy').textContent=editing?'Los archivos llegaron. Estamos reemplazando la versión anterior de forma segura.':'Los archivos llegaron. Estamos registrando el requisito como completo.';
    $('daily-upload-progress-bar').style.transform='scaleX(.9)';
    const rpcName=editing?'dash_reemplazar_entrega':'dash_confirmar_entrega';
    const rpcArgs={p_requisito:DAILY_EVIDENCE.requirement,p_asignacion:DAILY_EVIDENCE.assignment,
      p_modalidad:DAILY_EVIDENCE.requirement==='comparticiones'?mode:null,
      p_paths:paths.filter(path=>path!==videoPath),p_detalle:$('daily-evidence-detail').value.trim()||null,
      ...(editing?{p_conservar_paths:[...(DAILY_EVIDENCE.existingFiles||[]).map(file=>file.path),...(DAILY_EVIDENCE.existingVideoPath?[DAILY_EVIDENCE.existingVideoPath]:[])],p_video_path:videoPath}: {})
    };
    console.log('[entrega-debug] RPC',rpcName,'→',JSON.stringify(rpcArgs));
    const {data,error}=await db.rpc(rpcName,rpcArgs);
    console.log('[entrega-debug] RPC ←',{data,error:error?.message});
    if(error||!data?.ok)throw Object.assign(new Error(data?.motivo||error?.message||'guardar'),{motivo:data?.motivo||'guardar'});
    let videoWarning='';
    if(videoPath&&!editing){const attached=await db.rpc('dash_adjuntar_video',{p_entrega:data.entrega,p_path:videoPath});if(attached.error||!attached.data?.ok){videoWarning=' La evidencia principal se guardó, pero el video no pudo adjuntarse.';await cleanupDailyEvidence([videoPath])}}
    const exitRecorded=!editing&&data.salida_registrada===true;
    const autoExit=exitRecorded&&['completa','regularizada'].includes(data.resumen?.estado);
    const facebookStillScheduled=autoExit&&!!data.resumen?.comparticiones_pendientes;
    APP.cierre=mergeDailyReviewState(data.resumen,{ok:true,revisiones:[{
      requisito:DAILY_EVIDENCE.requirement,
      asignacion_id:DAILY_EVIDENCE.assignment,
      revision_estado:'pendiente',
      revision_nota:null
    }]});
    dailyUploadStep('confirm','done',autoExit?'Jornada laboral cerrada':exitRecorded?'Salida registrada':'Entrega registrada');
    setDailyEvidenceProcess('success',{title:editing?'¡Cambios guardados!':autoExit?'¡Jornada laboral completada!':exitRecorded?'¡Salida registrada!':'¡Evidencia completada!',copy:editing?`${DAILY_EVIDENCE.title} fue actualizada y volvió a revisión.`:facebookStillScheduled?'Tu salida quedó registrada. Facebook seguirá pendiente hasta que abra su horario independiente.':autoExit?'La evidencia y tu hora de salida quedaron registradas correctamente.':exitRecorded?'Tu hora de salida quedó guardada. La jornada seguirá incompleta hasta adjuntar las demás evidencias laborales.':`${DAILY_EVIDENCE.title} quedó registrada correctamente.${videoWarning}`,progress:1,current:Math.max(uploadTotal,1),total:Math.max(uploadTotal,1)});
    await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?320:760));
    DAILY_EVIDENCE.busy=false;closeDailyEvidenceEditor({restoreFocus:false});renderDailyClose();$('day-close-state').focus();DAILY_EVIDENCE_TRIGGER=null;toast(editing?'Cambios guardados. La evidencia volvió a revisión.':facebookStillScheduled?'Jornada laboral completa. Facebook continúa programado.':autoExit?'Salida registrada. Tu jornada está completa.':exitRecorded?'Salida registrada. Aún tienes evidencias laborales pendientes.':'Evidencia guardada correctamente.');
    if(autoExit){const [inicioRes]=await Promise.all([db.rpc('dash_inicio'),loadHistory()]);if(inicioRes.data?.ok){APP.inicio=inicioRes.data;renderHome()}}
  }catch(error){
    if(paths.length||error.path)cleanupDailyEvidence([...paths,...(error.path?[error.path]:[])]);
    DAILY_EVIDENCE.busy=false;setDailyEvidenceProcess('idle');dailyEvidenceMessage(dailyEvidenceFailure(error.motivo),'is-error');
  }finally{
    DAILY_EVIDENCE.busy=false;button.disabled=false;button.querySelector('span').textContent=DAILY_EVIDENCE.editing?'Guardar cambios':'Guardar evidencia';renderDailyClose();
  }
}

function dailyExitMessage(text,type=''){
  const message=$('daily-exit-message');if(!message)return;
  message.textContent=text||'';message.className='daily-exit-message'+(type?' '+type:'');
}

function openDailyExitModal(){
  if(CLOSE_MODEL.hasPendingWork(APP.cierre)){toast('Completa tu RPE y los entregables pendientes antes de salir.');return;}
  if(!APP.cierre?.puede_marcar_salida||DAILY_EXIT_BUSY)return;
  $('daily-exit-time').textContent=fmtTime(APP.cierre.hora_salida_programada);
  dailyExitMessage('La hora oficial se tomará del servidor de KJA.');
  $('daily-exit-modal').hidden=false;document.body.classList.add('daily-evidence-open');
  requestAnimationFrame(()=>$('daily-exit-confirm').focus({preventScroll:true}));
}

function closeDailyExitModal(){
  if(DAILY_EXIT_BUSY)return;
  $('daily-exit-modal').hidden=true;document.body.classList.remove('daily-evidence-open');dailyExitMessage('');
  $('day-close-button').focus({preventScroll:true});
}

async function markDailyExit(){
  if(CLOSE_MODEL.hasPendingWork(APP.cierre)){dailyExitMessage('Completa tu RPE y los entregables pendientes antes de salir.','is-error');return;}
  if(!APP.cierre?.puede_marcar_salida||DAILY_EXIT_BUSY)return;
  DAILY_EXIT_BUSY=true;
  const button=$('day-close-button'),confirmButton=$('daily-exit-confirm');button.disabled=true;confirmButton.disabled=true;confirmButton.querySelector('span').textContent='Registrando…';dailyExitMessage('Validando el cierre con la hora oficial…');
  try{
    const {data,error}=await db.rpc('dash_marcar_salida',{p_dispositivo:(navigator.userAgent||'').slice(0,120)});
    if(error||!data?.ok){const reason=data?.motivo||'registro';const messages={salida_aun_no_disponible:`La salida se habilita desde las ${fmtTime(data?.desde)}.`,salida_fuera_de_plazo:'El plazo de salida terminó. La jornada quedará incompleta.',requisitos_pendientes:'Todavía existen evidencias pendientes.',ya_registrada:'La salida ya estaba registrada.',sesion:'Tu sesión venció. Vuelve a ingresar.'};throw Object.assign(new Error(messages[reason]||'No pudimos registrar la salida.'),{motivo:reason})}
    APP.cierre=data.resumen;DAILY_EXIT_BUSY=false;$('daily-exit-modal').hidden=true;document.body.classList.remove('daily-evidence-open');renderDailyClose();toast('Salida registrada. Tu jornada está completa.');
    const [inicioRes]=await Promise.all([db.rpc('dash_inicio'),loadHistory()]);
    if(inicioRes.data?.ok){APP.inicio=inicioRes.data;renderHome()}
  }catch(error){dailyExitMessage(error.message||'No pudimos registrar la salida.','is-error');await loadDailyClose({quiet:true})}
  finally{DAILY_EXIT_BUSY=false;confirmButton.disabled=false;confirmButton.querySelector('span').textContent='Registrar mi salida';button.disabled=!APP.cierre?.puede_marcar_salida}
}

function facebookShareDate(value){
  if(!value)return '—';
  const date=new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Lima'}).format(date);
}

function facebookShareLinkLabel(value){
  return {practicas:'Prácticas',voluntariado:'Voluntariado',ambos:'Prácticas + voluntariado'}[value]||cap(value||'No indicado');
}

function facebookShareReviewLabel(value){
  return {aprobada:'Aprobada por Dirección',observada:'Corrección solicitada',pendiente:'Pendiente de revisión'}[value]||'Pendiente de revisión';
}

function resetFacebookShareModal(){
  globalThis.FacebookReceipt?.reset();
  $('facebook-share-gallery').setAttribute('aria-busy','true');
  $('facebook-share-gallery').innerHTML='<span class="facebook-share-skeleton"></span><span class="facebook-share-skeleton"></span><span class="facebook-share-skeleton"></span><span class="facebook-share-skeleton"></span>';
  $('facebook-share-gallery-meta').textContent='Preparando imágenes privadas…';
  $('facebook-share-ready').textContent='Verificando';$('facebook-share-ready').dataset.state='loading';
  ['facebook-share-area','facebook-share-date','facebook-share-time','facebook-share-schedule','facebook-share-mode','facebook-share-file-count','facebook-share-id','facebook-share-review','facebook-share-link'].forEach(id=>$(id).textContent='—');
  $('facebook-share-person-mark').textContent=initials(APP.inicio?.colaborador?.nombre);
  $('facebook-share-person-name').textContent=APP.inicio?.colaborador?.nombre||'Colaborador KJA';
  $('facebook-share-person-dni').textContent=APP.inicio?.colaborador?.dni?`DNI ${APP.inicio.colaborador.dni}`:'DNI verificado';
  $('facebook-share-comment').textContent='Sin comentario adicional.';
}

function populateFacebookShareDetails(data){
  const files=data.archivos||[];
  $('facebook-share-person-mark').textContent=initials(data.colaborador);
  $('facebook-share-person-name').textContent=data.colaborador||'Colaborador KJA';
  $('facebook-share-person-dni').textContent=data.dni?`DNI ${data.dni}`:'DNI verificado';
  $('facebook-share-area').textContent=data.area||'Sin área';
  $('facebook-share-date').textContent=facebookShareDate(data.fecha);
  $('facebook-share-time').textContent=formatAttendanceClock(data.registrado_at);
  $('facebook-share-schedule').textContent=`${fmtTime(data.compartir_inicio||data.jornada_inicio)} — ${fmtTime(data.compartir_fin||data.jornada_fin)}`;
  $('facebook-share-mode').textContent=data.modalidad==='collage'?'Collage':'Capturas individuales';
  $('facebook-share-file-count').textContent=`${files.length} ${files.length===1?'imagen':'imágenes'}`;
  $('facebook-share-id').textContent=`KJA-FB-${data.entrega_id}`;
  $('facebook-share-review').textContent=facebookShareReviewLabel(data.revision_estado);
  $('facebook-share-link').textContent=facebookShareLinkLabel(data.tipo_vinculo);
  $('facebook-share-comment').textContent=data.detalle||'Sin comentario adicional.';
}

async function openFacebookShare(trigger){
  const modal=$('facebook-share-modal'),request=FACEBOOK_SHARE.request+1;
  FACEBOOK_SHARE={trigger:trigger||document.activeElement,data:null,signed:[],request};
  resetFacebookShareModal();modal.hidden=false;document.body.classList.add('facebook-share-open');
  requestAnimationFrame(()=>$('facebook-share-modal').querySelector('.facebook-share-close').focus({preventScroll:true}));
  const {data,error}=await db.rpc('dash_mi_comprobante_comparticiones');
  if(request!==FACEBOOK_SHARE.request)return;
  if(error||!data?.ok){
    const missing=error?.code==='PGRST202'||String(error?.message||'').includes('dash_mi_comprobante_comparticiones');
    $('facebook-share-gallery').setAttribute('aria-busy','false');
    $('facebook-share-gallery').innerHTML=`<p class="facebook-share-error">${missing?'Ejecuta dashboard_30_compartir_evidencia_whatsapp.sql para preparar este comprobante.':'No pudimos cargar la evidencia privada. Actualiza e inténtalo nuevamente.'}</p>`;
    $('facebook-share-gallery-meta').textContent='Comprobante no disponible';$('facebook-share-ready').textContent='Sin cargar';$('facebook-share-ready').dataset.state='error';return;
  }
  FACEBOOK_SHARE.data=data;populateFacebookShareDetails(data);
  try{
    const signed=await Promise.all((data.archivos||[]).map(async file=>{
      const result=await db.storage.from(DAILY_EVIDENCE_BUCKET).createSignedUrl(file.path,900);
      if(result.error||!result.data?.signedUrl)throw result.error||new Error('firma');
      return {...file,url:result.data.signedUrl};
    }));
    if(request!==FACEBOOK_SHARE.request)return;
    FACEBOOK_SHARE.signed=signed;
    if(signed.length)globalThis.FacebookReceipt?.open(db,data,signed);
    const gallery=$('facebook-share-gallery');gallery.setAttribute('aria-busy','false');
    gallery.innerHTML=signed.length?signed.map((file,index)=>`<figure><a href="${esc(file.url)}" target="_blank" rel="noopener" aria-label="Abrir captura ${index+1} en tamaño completo"><img src="${esc(file.url)}" alt="Captura ${index+1} de las comparticiones de Facebook" loading="${index<3?'eager':'lazy'}" decoding="async"></a><figcaption><span><b>Captura ${String(index+1).padStart(2,'0')}</b><small>${Math.max(1,Math.round(Number(file.bytes||0)/1024))} KB</small></span><em>${index+1} de ${signed.length}</em></figcaption></figure>`).join(''):'<p class="facebook-share-error">Esta entrega no contiene imágenes.</p>';
    $('facebook-share-gallery-meta').textContent=`${signed.length} ${signed.length===1?'imagen completa':'imágenes completas'} · toca para ampliar`;
    $('facebook-share-ready').textContent=signed.length?'Listas':'Sin imágenes';$('facebook-share-ready').dataset.state=signed.length?'ready':'error';
  }catch{
    if(request!==FACEBOOK_SHARE.request)return;
    $('facebook-share-gallery').setAttribute('aria-busy','false');$('facebook-share-gallery').innerHTML='<p class="facebook-share-error">No pudimos abrir las imágenes privadas. Comprueba tu conexión e inténtalo nuevamente.</p>';
    $('facebook-share-gallery-meta').textContent='Error al preparar archivos';$('facebook-share-ready').textContent='Reintentar';$('facebook-share-ready').dataset.state='error';
  }
}

function closeFacebookShare({restoreFocus=true}={}){
  globalThis.FacebookReceipt?.reset();
  const trigger=FACEBOOK_SHARE.trigger;
  $('facebook-share-modal').hidden=true;document.body.classList.remove('facebook-share-open');
  FACEBOOK_SHARE={trigger:null,data:null,signed:[],request:FACEBOOK_SHARE.request+1};
  if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
}

$('day-close-checklist').addEventListener('click',event=>{
  const share=event.target.closest('[data-facebook-share-open]');if(share)return openFacebookShare(share);
  const action=event.target.closest('[data-daily-action]');if(action?.dataset.dailyAction==='entry')return handleMarkAction();
  const button=event.target.closest('[data-daily-requirement]');if(!button)return;
  DAILY_EVIDENCE_TRIGGER=button;
  openDailyEvidenceEditor(button.dataset.dailyRequirement,button.dataset.dailyAssignment||null);
});
$('mobile-close-list').addEventListener('click',event=>{
  const share=event.target.closest('[data-facebook-share-open]');if(share)return openFacebookShare(share);
  const action=event.target.closest('[data-daily-action]');if(action?.dataset.dailyAction==='entry')return handleMarkAction();
  const button=event.target.closest('[data-daily-requirement]');if(!button)return;
  DAILY_EVIDENCE_TRIGGER=button;openDailyEvidenceEditor(button.dataset.dailyRequirement,button.dataset.dailyAssignment||null);
});
$('mobile-close-action').onclick=event=>{
  const action=event.currentTarget.dataset.action;if(action==='entry')handleMarkAction();if(action==='exit')openDailyExitModal();
};
$('daily-evidence-picker').onclick=()=>$('daily-evidence-file').click();
$('daily-evidence-file').onchange=event=>chooseDailyEvidence(event.target.files);
$('daily-video-picker').onclick=()=>$('daily-video-file').click();
$('daily-video-file').onchange=event=>chooseDailyVideo(event.target.files);
$('daily-video-remove').onclick=clearDailyEvidenceVideo;
async function deleteFacebookEvidenceImage(index){
  const state=DAILY_EVIDENCE,file=state.existingFiles?.[index];
  if(!file||state.busy||state.loading||state.confirming)return;
  const last=state.existingFiles.length===1;
  state.confirming=true;
  let accepted=false;
  try{accepted=await requestFacebookDeleteConfirmation({retry:!!file.deletionPending,last});}
  finally{state.confirming=false;}
  if(!accepted||DAILY_EVIDENCE!==state||state.busy||!state.existingFiles.includes(file))return;
  const progress=$('facebook-delete-progress'),editor=$('daily-evidence-editor');
  const lockedControls=[...editor.querySelectorAll('button,input,textarea')].map(control=>({control,disabled:control.disabled}));
  lockedControls.forEach(({control})=>control.disabled=true);
  progress.hidden=false;editor.setAttribute('aria-busy','true');
  const submit=$('daily-evidence-submit'),picker=$('daily-evidence-picker');
  state.busy=true;submit.disabled=true;picker.disabled=true;
  const modes=[...document.querySelectorAll('input[name="daily-evidence-mode"]')];
  const modeDisabled=modes.map(input=>input.disabled);modes.forEach(input=>input.disabled=true);
  dailyEvidenceMessage('Eliminando imagen…','is-info');
  try{
    const {data:{session}}=await db.auth.getSession();if(!session)throw new Error('sesion');
    const response=await fetch(SUPABASE_URL+'/functions/v1/dash-entrega',{
      method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({accion:'eliminar_imagen_facebook',entrega:state.entregaId,path:file.path})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok)console.warn('[Facebook: eliminar imagen]',{status:response.status,motivo:result?.motivo||result?.code||'sin_detalle'});
    if(result?.retirada)file.deletionPending=true;
    if(!response.ok||!result?.ok)throw new Error(result?.motivo||'conexion');
    state.existingFiles.splice(index,1);
    closeFacebookShare({restoreFocus:false});
    if(!state.existingFiles.length){
      state.editing=false;state.entregaId=null;
      $('daily-evidence-title').textContent=state.title;
      $('daily-evidence-edit-note').hidden=true;
      submit.querySelector('span').textContent='Guardar evidencia';
    }
    renderDailyEvidencePreviews();
    dailyEvidenceMessage(state.existingFiles.length?'Imagen eliminada del almacenamiento y de la base de datos.':'Imagen eliminada. Facebook quedó pendiente; puedes subir nuevas evidencias.','is-ready');
    await loadDailyClose({quiet:true});
  }catch(error){
    const labels={limpieza_pendiente:'La imagen fue retirada de la entrega, pero falta borrar el archivo. Pulsa su × para reintentar.',migracion_eliminar:'Falta activar la eliminación de imágenes en el servidor.',datos:'El servidor no reconoce la solicitud de eliminación. Comprueba que dash-entrega esté actualizada y vuelve a abrir el editor.',requisito:'El servidor no reconoce la eliminación de Facebook. Debe desplegarse dash-entrega actualizada.',sin_entrega:'Esta entrega ya cambió o no está disponible. Cierra el editor y vuelve a abrirlo.',sin_permiso:'El servidor rechazó la eliminación por permisos. Informa a Dirección.',conexion:'No se pudo confirmar la eliminación. Reintenta o vuelve a abrir el editor.'};
    dailyEvidenceMessage(labels[error.message]||dailyEvidenceFailure(error.message),'is-error');
  }finally{
    state.busy=false;submit.disabled=false;picker.disabled=false;modes.forEach((input,i)=>input.disabled=modeDisabled[i]);
    lockedControls.forEach(({control,disabled})=>control.disabled=disabled);
    progress.hidden=true;editor.removeAttribute('aria-busy');
    $('daily-evidence-cancel-top').focus({preventScroll:true});
  }
}

function requestFacebookDeleteConfirmation({retry=false,last=false}={}){
  const modal=$('facebook-delete-modal'),confirmButton=$('facebook-delete-confirm'),warning=$('facebook-delete-warning');
  if(!modal||!confirmButton||modal._confirmationOpen)return Promise.resolve(false);
  // The editor is also mounted on body: escape ancestor stacking contexts.
  if(modal.parentElement!==document.body)document.body.append(modal);
  const editor=$('daily-evidence-editor'),previousInert=editor.inert,trigger=document.activeElement;
  const cancelButton=modal.querySelector('.facebook-delete-cancel');
  editor.inert=true;modal._confirmationOpen=true;
  warning.hidden=!last;
  modal.querySelector('.facebook-delete-kicker').textContent=retry?'Limpieza pendiente':'Eliminar evidencia';
  modal.querySelector('#facebook-delete-title').textContent=retry?'¿Reintentar eliminar esta imagen?':'¿Eliminar esta imagen?';
  modal.querySelector('#facebook-delete-copy').textContent=retry?'La imagen ya fue retirada del comprobante. Se intentará eliminar el archivo pendiente del almacenamiento.':'La imagen se quitará del comprobante y se eliminará del almacenamiento y de la base de datos. Esta acción no se puede deshacer.';
  confirmButton.textContent=retry?'Reintentar eliminación':'Eliminar imagen';
  modal.hidden=false;document.body.classList.add('facebook-delete-open');
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;modal.hidden=true;modal._confirmationOpen=false;editor.inert=previousInert;document.body.classList.remove('facebook-delete-open');cleanup();if(trigger?.isConnected)trigger.focus({preventScroll:true});resolve(value)};
    const onConfirm=()=>finish(true),onCancel=()=>finish(false),onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);return;}
      if(event.key==='Tab'){
        if(event.shiftKey&&document.activeElement===cancelButton){event.preventDefault();confirmButton.focus();}
        else if(!event.shiftKey&&document.activeElement===confirmButton){event.preventDefault();cancelButton.focus();}
      }
    };
    const cleanup=()=>{confirmButton.removeEventListener('click',onConfirm);modal.querySelectorAll('[data-close-facebook-delete]').forEach(button=>button.removeEventListener('click',onCancel));modal.removeEventListener('keydown',onKey)};
    confirmButton.addEventListener('click',onConfirm);modal.querySelectorAll('[data-close-facebook-delete]').forEach(button=>button.addEventListener('click',onCancel));modal.addEventListener('keydown',onKey);cancelButton.focus({preventScroll:true});
  });
}
$('daily-evidence-previews').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove-daily-file],[data-remove-existing-file]');if(!button||DAILY_EVIDENCE.busy||DAILY_EVIDENCE.loading)return;
  if(button.dataset.removeExistingFile!=null&&DAILY_EVIDENCE.requirement==='comparticiones')return deleteFacebookEvidenceImage(Number(button.dataset.removeExistingFile));
  if(button.dataset.removeExistingFile!=null){DAILY_EVIDENCE.existingFiles.splice(Number(button.dataset.removeExistingFile),1)}
  else{const index=Number(button.dataset.removeDailyFile),item=DAILY_EVIDENCE.files[index];if(item?.url)URL.revokeObjectURL(item.url);DAILY_EVIDENCE.files.splice(index,1)}
  renderDailyEvidencePreviews();
  const total=(DAILY_EVIDENCE.existingFiles?.length||0)+DAILY_EVIDENCE.files.length;
  dailyEvidenceMessage(total?`${total} ${total===1?'archivo quedará':'archivos quedarán'} al guardar. Puedes añadir reemplazos.`:'Quitaste todas las imágenes. Añade al menos una antes de guardar.',total?'is-info':'is-error');
});
document.querySelectorAll('input[name="daily-evidence-mode"]').forEach(input=>input.addEventListener('change',()=>{clearDailyEvidenceFiles();DAILY_EVIDENCE.existingFiles=[];renderDailyEvidencePreviews();dailyEvidenceMessage('El formato cambió. Selecciona nuevamente las imágenes que conservará esta entrega.','is-info')}));
$('daily-evidence-editor').addEventListener('submit',submitDailyEvidence);
$('daily-issue-toggle').onclick=()=>{$('daily-issue-form').hidden=!$('daily-issue-form').hidden;if(!$('daily-issue-form').hidden)$('daily-issue-detail').focus()};
$('daily-issue-submit').onclick=submitDailyIssue;
$('daily-evidence-editor').addEventListener('click',event=>{if(event.target===$('daily-evidence-editor'))closeDailyEvidenceEditor()});
$('daily-evidence-editor').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeDailyEvidenceEditor();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('daily-evidence-editor').querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden&&el.offsetParent!==null);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
$('daily-evidence-cancel').onclick=closeDailyEvidenceEditor;
$('daily-evidence-cancel-top').onclick=closeDailyEvidenceEditor;
$('day-close-button').onclick=()=>APP.cierre?.entrada_at?openDailyExitModal():handleMarkAction();
$('daily-exit-confirm').onclick=markDailyExit;
document.querySelectorAll('[data-close-daily-exit]').forEach(button=>button.onclick=closeDailyExitModal);
$('daily-exit-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeDailyExitModal();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('daily-exit-modal').querySelectorAll('button:not(:disabled)')];if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
document.querySelectorAll('[data-close-facebook-share]').forEach(button=>button.onclick=()=>closeFacebookShare());
$('facebook-share-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeFacebookShare();return}
  if(event.key!=='Tab')return;
  const focusable=[...$('facebook-share-modal').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled)')].filter(element=>element.offsetParent!==null);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});

const MARK_STEPS=['location','evidence','server'];
function setMarkFlow(state){
  const sheet=$('mark-sheet'),close=sheet.querySelector('.modal-close');
  sheet.dataset.state=state;
  $('mark-confirm-view').hidden=state!=='confirm';
  $('mark-processing').hidden=state!=='processing';
  $('mark-receipt').hidden=state!=='receipt';
  close.hidden=state==='processing';close.disabled=state==='processing';
  sheet.setAttribute('aria-busy',state==='processing'?'true':'false');
  sheet.setAttribute('aria-labelledby',state==='processing'?'mark-processing-title':state==='receipt'?'mark-receipt-title':'mark-title');
  const focusTarget=state==='processing'?$('mark-processing'):state==='receipt'?$('receipt-close'):null;
  if(focusTarget)requestAnimationFrame(()=>focusTarget.focus({preventScroll:true}));
}
function resetMarkProgress(){
  MARK_STEPS.forEach(key=>{const step=$('mark-step-'+key);step.className='';step.querySelector('small').textContent='En espera';});
  $('mark-sheet').removeAttribute('data-progress-step');
  $('mark-processing-track').querySelector('i').style.transform='scaleX(0)';
  $('mark-processing-copy').textContent='Preparando la validación…';
}
function markProgressStep(key,state,copy){
  const step=$('mark-step-'+key);step.className=state;step.querySelector('small').textContent=copy;
  if(state==='active')$('mark-sheet').dataset.progressStep=key;
  const completed=MARK_STEPS.filter(name=>{const classes=$('mark-step-'+name).classList;return classes.contains('done')||classes.contains('skipped');}).length;
  $('mark-processing-track').querySelector('i').style.transform=`scaleX(${completed/MARK_STEPS.length})`;
}
function showMarkReceipt(data,hadEvidence,context='new'){
  const day=APP.inicio.dia||{},date=new Date((day.fecha||isoLima())+'T12:00:00'),late=data.estado==='T',label={P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestionó'}[data.estado]||'Registrado';
  $('receipt-state').textContent=label;
  $('mark-receipt-title').textContent=context==='detail'?(late?'Detalle de tu tardanza':'Detalle de tu asistencia'):(late?'Registro confirmado con tardanza':'¡Registro confirmado!');
  $('receipt-summary').textContent=context==='detail'?'Este es el estado actual de tu registro de hoy.':late?'Tu asistencia fue registrada después de la hora de entrada.':'La hora fue validada directamente por el servidor de KJA.';
  $('receipt-time').textContent=fmtTime(data.hora);
  $('receipt-date').textContent=new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'long',year:'numeric'}).format(date);
  $('receipt-mode').textContent=({virtual:'Virtual',presencial:'Presencial',opcional:'Opcional'}[day.modalidad]||cap(day.modalidad||'No indicada'));
  $('receipt-evidence').textContent=hadEvidence===true?'Protegida y vinculada':hadEvidence===false?'Sin evidencia histórica':'Consulta restringida';
  $('mark-sheet').dataset.receiptState=late?'late':data.estado==='P'?'present':'neutral';
  setMarkFlow('receipt');
}
function openMarkStatus(){
  const day=APP.inicio.dia||{};if(!day.marcado)return;
  const time=day.marcado_at?new Date(day.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'}):'—';
  const evidence=typeof day.evidencia==='boolean'?day.evidencia:null;
  clearEvidence();resetMarkProgress();$('mark-sheet').removeAttribute('data-receipt-state');$('mark-modal').hidden=false;document.body.style.overflow='hidden';
  showMarkReceipt({estado:day.estado,hora:time},evidence,'detail');
}

function markFailureMessage(reason,windowState=''){
  const messages={
    sesion:'Tu sesión venció. Vuelve a ingresar.',
    version_antigua:'Hay una actualización de seguridad obligatoria. Recarga el dashboard antes de marcar.',
    proteccion_no_disponible:'El registro seguro todavía no está habilitado. Dirección debe completar la actualización del sistema.',
    fuera_ventana:windowState==='antes'?'Tu jornada todavía no comienza. El botón se habilitará con la hora oficial del servidor.':'Tu ventana de marcado ya no está disponible.',
    ya_marcado:'Tu asistencia ya estaba registrada.',
    falta_evidencia:'La evidencia no llegó al servidor.',
    evidencia_invalida:'La evidencia no corresponde a este registro. Vuelve a adjuntarla.',
    evidencia_no_verificada:'No pudimos verificar la foto subida. Vuelve a adjuntarla e inténtalo otra vez.',
    ubicacion_invalida:'El dispositivo entregó una ubicación inválida. Inténtalo nuevamente.',
    ubicacion_requerida:'Para marcar presencial debes permitir y verificar tu ubicación.',
    ubicacion_denegada:'El permiso de ubicación está bloqueado. Permite la ubicación para este sitio en Chrome o Safari y activa la ubicación precisa del teléfono. Si abriste el enlace dentro de WhatsApp, ábrelo en tu navegador y reintenta. Tu foto se conserva.',
    ubicacion_no_disponible:'El teléfono no pudo obtener una ubicación válida. Activa la ubicación precisa, mantén Wi-Fi o datos encendidos y acércate a una ventana. Abre el portal en Chrome o Safari y vuelve a verificar. Tu foto se conserva.',
    ubicacion_timeout:'El teléfono tardó demasiado en obtener la ubicación. Acércate a una ventana y pulsa Verificar ubicación otra vez. Tu foto se conserva.',
    ubicacion_insegura:'Abre el portal desde su dirección HTTPS en Chrome o Safari para permitir la ubicación.',
    ubicacion_imprecisa:'La ubicación es demasiado imprecisa. Acércate a una ventana, activa el GPS y vuelve a verificar.',
    fuera_radio:'Estás fuera del radio presencial de 1 km. La asistencia no puede registrarse desde esta ubicación.',
    oficina_no_configurada:'Dirección aún no configuró la ubicación oficial. El marcado presencial permanece bloqueado.',
    modalidad_invalida:'Selecciona una modalidad válida para hoy.',
    modalidad_bloqueada:'La modalidad ya no puede cambiarse porque la asistencia fue registrada.',
    modalidad_cambio:'La modalidad cambió en otra sesión. Revisa el estado de hoy antes de continuar.',
    no_labora:'Hoy no figura como día laborable.',
    horario_incompleto:'Tu horario de hoy está incompleto. Dirección debe registrar una hora de entrada y una de salida.'
  };
  return messages[reason]||'No se pudo completar el registro. Revisa tu conexión e inténtalo otra vez.';
}

async function requestMarkEligibility(geo=null){
  const {data,error}=await db.rpc('dash_protocolo_marcado',{
    p_protocolo:MARK_PROTOCOL,
    p_lat:geo?.lat??null,
    p_lon:geo?.lon??null,
    p_precision:geo?.accuracy??null
  });
  if(error){
    const missing=error.code==='PGRST202'||String(error.message||'').includes('dash_protocolo_marcado');
    if(missing){clearInterval(APP.markTimer);APP.markTimer=null;}
    const failure=new Error(missing?'proteccion_no_disponible':'servidor');failure.motivo=missing?'proteccion_no_disponible':'servidor';throw failure;
  }
  if(!data?.ok){const failure=new Error(data?.motivo||'servidor');failure.motivo=data?.motivo||'servidor';failure.ventana=data?.ventana;throw failure;}
  return data;
}

async function refreshMarkEligibility({render=true,quiet=false,geo=null}={}){
  if(!APP.identity.hasPersonal)return null;
  let pending;
  if(geo)pending=requestMarkEligibility(geo);
  else{
    if(!MARK_SYNC_PROMISE){
      const request=requestMarkEligibility();
      const tracked=request.finally(()=>{if(MARK_SYNC_PROMISE===tracked)MARK_SYNC_PROMISE=null;});
      MARK_SYNC_PROMISE=tracked;
    }
    pending=MARK_SYNC_PROMISE;
  }
  try{
    const data=await pending;
    MARK_PROTOCOL_STATE=data;
    if(data?.dia&&APP.inicio){APP.inicio.dia=data.dia;APP.inicio.exigir_evidencia=true;if(render)renderHome();}
    return data;
  }catch(error){
    if(!quiet)throw error;
    if(error.motivo!=='proteccion_no_disponible')console.warn('No se pudo sincronizar la ventana de marcado.',error);
    return null;
  }
}

function startMarkSync(){
  clearInterval(APP.markTimer);
  if(!APP.identity.hasPersonal)return;
  void Promise.all([refreshMarkEligibility({quiet:true}),loadDailyClose({quiet:true})]);
  APP.markTimer=setInterval(()=>{if(!document.hidden&&!MARK_BUSY&&!DAILY_EVIDENCE.busy)void Promise.all([refreshMarkEligibility({quiet:true}),loadDailyClose({quiet:true})]);},60000);
}

function reloadDashboardIfSafe(){
  if(!DASH_UPDATE_PENDING)return false;
  if(MARK_BUSY||EVIDENCE||!$('mark-modal').hidden)return false;
  location.reload();return true;
}
async function checkDashboardVersion(){
  if(DASH_UPDATE_PENDING)return reloadDashboardIfSafe();
  if(Date.now()-DASH_VERSION_CHECKED_AT<60000)return false;
  DASH_VERSION_CHECKED_AT=Date.now();
  try{
    const response=await fetch(location.pathname,{method:'HEAD',cache:'no-store'});
    const etag=response.ok?response.headers.get('etag'):null;
    if(!etag)return false;
    if(!DASH_ETAG){DASH_ETAG=etag;return false;}
    if(etag!==DASH_ETAG){DASH_UPDATE_PENDING=true;toast('Hay una actualización de seguridad lista. El dashboard se recargará al cerrar esta ventana.');return reloadDashboardIfSafe();}
  }catch(error){console.warn('No se pudo comprobar la versión del dashboard.',error);}
  return false;
}
function startDashboardVersionWatch(){
  clearInterval(DASH_VERSION_TIMER);
  void checkDashboardVersion();
  DASH_VERSION_TIMER=setInterval(()=>{if(!document.hidden)void checkDashboardVersion();},15*60*1000);
}

document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  void checkDashboardVersion();
  if(APP.identity.hasPersonal&&!MARK_BUSY)void refreshMarkEligibility({quiet:true});
  if(APP.identity.hasPersonal&&!DAILY_EVIDENCE.busy)void loadDailyClose({quiet:true});
  if(APP.identity.hasPersonal)void loadReviewNotifications({quiet:true});
});
window.addEventListener('pageshow',()=>void checkDashboardVersion());

async function handleMarkAction(){
  if((APP.inicio.dia||{}).marcado)return openMarkStatus();
  const trigger=$('open-mark');trigger.setAttribute('aria-busy','true');
  try{
    const fresh=await refreshMarkEligibility();
    if(fresh?.motivo==='ya_marcado'||fresh?.dia?.marcado)return openMarkStatus();
    if(!fresh?.puede_marcar&&fresh?.motivo!=='ubicacion_requerida'){toast(markFailureMessage(fresh?.motivo,fresh?.dia?.ventana),true);return;}
    openMarkModal();
  }catch(error){toast(markFailureMessage(error.motivo,error.ventana),true);}
  finally{trigger.removeAttribute('aria-busy');}
}
function openMarkModal(){
  MARK_GEO=null;clearEvidence();resetMarkProgress();setMarkFlow('confirm');$('mark-sheet').removeAttribute('data-receipt-state');
  const d=APP.inicio.dia||{},virtual=(d.modalidad||'virtual')==='virtual';
  $('mark-sheet').dataset.mode=virtual?'virtual':'presencial';
  $('mark-route-panel').hidden=virtual;
  $('evidence-copy').textContent=virtual?'Adjunta una captura del Zoom donde se vea tu nombre.':'Adjunta una fotografía de tu llegada al consultorio.';
  $('evidence-title').textContent=virtual?'Captura de tu reunión':'Foto de tu llegada';
  renderMarkModeCheck();
  $('mark-modal').hidden=false;document.body.style.overflow='hidden';
  if(!virtual&&typeof prepareMarkRouteMap==='function')requestAnimationFrame(()=>prepareMarkRouteMap());
}
$('open-mark').onclick=handleMarkAction;
document.querySelectorAll('[data-today-mode]').forEach(button=>button.onclick=()=>changeTodayMode(button.dataset.todayMode));
document.querySelectorAll('[data-close-mark]').forEach(x=>x.onclick=closeMark); function closeMark(){ if(MARK_BUSY)return;$('mark-modal').hidden=true;document.body.style.overflow='';MARK_GEO=null;if(typeof resetMarkRouteMap==='function')resetMarkRouteMap();clearEvidence();setMarkFlow('confirm');resetMarkProgress();reloadDashboardIfSafe(); }
$('take-photo').onclick=()=>$('evidence-camera').click();$('choose-photo').onclick=()=>$('evidence-file').click();$('evidence-preview').onclick=()=>$('evidence-camera').click();
$('evidence-camera').onchange=e=>chooseEvidence(e.target.files[0],'camara');$('evidence-file').onchange=e=>chooseEvidence(e.target.files[0],'archivo');

function syncMarkConfirm(){
  const button=$('confirm-mark'),label=button.querySelector('span'),presencial=(APP.inicio?.dia?.modalidad||'virtual')==='presencial',locationReady=!presencial||(MARK_GEO?.verified===true&&Date.now()-Number(MARK_GEO.capturedAt||0)<120000);
  button.disabled=MARK_BUSY||!EVIDENCE||!locationReady;
  button.setAttribute('aria-disabled',String(button.disabled));
  if(!MARK_BUSY)label.textContent=!EVIDENCE&&!locationReady?'Verifica ubicación y adjunta evidencia':!locationReady?'Verifica tu ubicación para continuar':!EVIDENCE?'Adjunta una evidencia para continuar':'Registrar mi asistencia';
}
function clearEvidence(){ if(EVIDENCE?.url)URL.revokeObjectURL(EVIDENCE.url);EVIDENCE=null;$('evidence-empty').hidden=false;$('evidence-preview').hidden=true;$('evidence-image').removeAttribute('src');$('evidence-camera').value='';$('evidence-file').value='';markMsg('');syncMarkConfirm(); }
async function chooseEvidence(file,origin){
  if(!file)return;if(file.size>25*1024*1024)return markMsg('La imagen supera 25 MB. Toma otra foto o elige una más pequeña.');
  try{ markMsg('');const blob=await compressImage(file);const url=URL.createObjectURL(blob);EVIDENCE={blob,url,origin,type:'image/jpeg',ext:'jpg'};$('evidence-image').src=url;$('evidence-size').textContent=`${Math.max(1,Math.round(blob.size/1024))} KB · tocar para cambiar`;$('evidence-empty').hidden=true;$('evidence-preview').hidden=false;syncMarkConfirm(); }catch(e){clearEvidence();markMsg('No se pudo leer la imagen. Prueba con un archivo JPG o PNG.');}
}
function compressImage(file){ return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,1280/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);URL.revokeObjectURL(img.src);const attempt=q=>c.toBlob(b=>{if(!b)return reject();if(b.size>180*1024&&q>.38)return attempt(q-.1);resolve(b)},'image/jpeg',q);attempt(.82)};img.onerror=reject;img.src=URL.createObjectURL(file)}); }
function stamp(blob,text){ return new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);URL.revokeObjectURL(img.src);const bar=Math.max(28,Math.round(img.height*.06)),font=Math.round(bar*.42);x.fillStyle='rgba(5,23,50,.82)';x.fillRect(0,img.height-bar,img.width,bar);x.fillStyle='#fff';x.font=`600 ${font}px Poppins, sans-serif`;x.textBaseline='middle';x.fillText(text,Math.round(bar*.35),img.height-bar/2,img.width-bar);c.toBlob(b=>resolve(b||blob),'image/jpeg',.82)};img.onerror=()=>resolve(blob);img.src=URL.createObjectURL(blob)}); }
async function geolocation({timeout=25000,maximumAge=30000}={}){
  if(window.isSecureContext===false)return {ok:false,motivo:'ubicacion_insegura'};
  if(!navigator.geolocation)return {ok:false,motivo:'ubicacion_no_disponible'};
  const attempt=high=>new Promise(resolve=>{
    let done=false;
    const end=result=>{if(done)return;done=true;resolve(result)};
    // El timeout nativo cuenta la adquisición, no la espera del permiso ni
    // el tiempo con la página oculta. Un temporizador propio corta respuestas válidas.
    try{navigator.geolocation.getCurrentPosition(p=>{
      const {latitude:lat,longitude:lon,accuracy}=p.coords||{},age=Date.now()-Number(p.timestamp);
      if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy<=0||!Number.isFinite(age)||age< -5000||age>=120000)return end({ok:false,motivo:'ubicacion_no_disponible'});
      end({ok:true,lat:+lat.toFixed(6),lon:+lon.toFixed(6),accuracy:Math.ceil(accuracy),capturedAt:Number(p.timestamp)});
    },error=>end({ok:false,motivo:error?.code===1?'ubicacion_denegada':error?.code===3?'ubicacion_timeout':'ubicacion_no_disponible'}),{enableHighAccuracy:high,timeout,maximumAge});}
    catch(error){end({ok:false,motivo:error?.name==='SecurityError'?'ubicacion_denegada':'ubicacion_no_disponible'})}
  });
  const first=await attempt(true);
  if((first.ok&&first.accuracy<=500)||first.motivo==='ubicacion_denegada')return first;
  // Menor precisión solicitada puede ayudar; el navegador elige el proveedor.
  // El servidor mantiene el radio de 1 km y la precisión máxima de 500 m.
  const second=await attempt(false);
  if(second.motivo==='ubicacion_denegada')return second;
  if(second.ok&&(!first.ok||second.accuracy<first.accuracy))return second;
  return first.ok?first:second;
}

function formatDistance(meters){const value=Number(meters);return Number.isFinite(value)?value<1000?`${Math.round(value)} m`:`${(value/1000).toFixed(1)} km`:'—'}
function renderMarkModeCheck(){
  const day=APP.inicio?.dia||{},presencial=day.modalidad==='presencial',panel=$('mark-mode-check'),button=$('verify-mark-location');
  panel.dataset.mode=presencial?'presencial':'virtual';
  $('mark-mode-virtual-icon').hidden=presencial;$('mark-mode-office-icon').hidden=!presencial;button.hidden=!presencial;
  if(!presencial){panel.removeAttribute('data-location-state');$('mark-mode-label').textContent='MODALIDAD VIRTUAL';$('mark-mode-title').textContent='No requiere ubicación';$('mark-mode-detail').textContent='Solo guardaremos la evidencia de tu reunión.';syncMarkConfirm();return;}
  $('mark-mode-label').textContent='MODALIDAD PRESENCIAL';
  if(MARK_GEO?.verified&&Date.now()-Number(MARK_GEO.capturedAt||0)>=120000)MARK_GEO={...MARK_GEO,verified:false,error:true,message:'La verificación venció. Actualiza tu ubicación para confirmar que sigues cerca de la oficina.'};
  if(MARK_GEO?.verified){
    panel.dataset.locationState='ready';$('mark-mode-title').textContent='Ubicación verificada';$('mark-mode-detail').textContent=`Estás a ${formatDistance(MARK_GEO.distance)} de la oficina · precisión ${MARK_GEO.accuracy} m.`;button.textContent='Verificar otra vez';
  }else{
    panel.dataset.locationState=MARK_GEO?.error?'error':'pending';$('mark-mode-title').textContent=MARK_GEO?.error?'Ubicación sin validar':'Verifica que estás cerca de la oficina';$('mark-mode-detail').textContent=MARK_GEO?.message||'El registro se habilita dentro de un radio de 1 km.';button.textContent='Verificar ubicación';
  }
  syncMarkConfirm();
  if(typeof renderMarkRouteMap==='function')renderMarkRouteMap();
}

async function verifyMarkLocation(){
  const button=$('verify-mark-location');button.disabled=true;button.textContent='Ubicando…';markMsg('');
  let geo=null;
  try{
    geo=await geolocation();
    if(!geo.ok)throw Object.assign(new Error(geo.motivo),{motivo:geo.motivo});
    const fresh=await refreshMarkEligibility({render:false,geo});
    if(!fresh?.puede_marcar){const error=new Error(fresh?.motivo||'ubicacion_invalida');error.motivo=fresh?.motivo||'ubicacion_invalida';error.distance=fresh?.distancia_m;throw error;}
    MARK_GEO={...geo,verified:true,distance:Number(fresh.distancia_m||0)};
  }catch(error){
    MARK_GEO={...(geo?.ok?geo:{}),verified:false,error:true,distance:Number.isFinite(Number(error.distance))?Number(error.distance):null,message:error.motivo==='fuera_radio'&&Number.isFinite(Number(error.distance))?`Estás a ${formatDistance(error.distance)}; debes estar dentro de 1 km.`:markFailureMessage(error.motivo)};
  }finally{button.disabled=false;renderMarkModeCheck();}
}
$('verify-mark-location').onclick=verifyMarkLocation;
async function uploadEvidence(){
  const {data:{session}}=await db.auth.getSession();if(!session)throw new Error('sesion');
  const r=await fetch(SUPABASE_URL+'/functions/v1/dash-evidencia',{method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({ext:EVIDENCE.ext})});
  const permit=await r.json().catch(()=>null);if(!r.ok||!permit?.ok){const e=new Error(permit?.motivo||'permiso');e.motivo=permit?.motivo;throw e;}
  const at=new Date(permit.servidor_at),seal=`${permit.nombre} · ${at.toLocaleDateString('es-PE',{timeZone:'America/Lima'})} · ${at.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'})} · KJA`,blob=await stamp(EVIDENCE.blob,seal);
  const {error}=await db.storage.from('asis-evidencias').uploadToSignedUrl(permit.ruta,permit.token,blob,{contentType:'image/jpeg'});if(error)throw error;return permit.ruta;
}

$('confirm-mark').onclick=async()=>{
  if(MARK_BUSY)return;
  if(!EVIDENCE)return markMsg('Adjunta la evidencia antes de registrar tu asistencia.');
  const mode=APP.inicio?.dia?.modalidad==='presencial'?'presencial':'virtual';
  if(mode==='presencial'&&(!MARK_GEO?.verified||Date.now()-Number(MARK_GEO.capturedAt||0)>=120000)){renderMarkModeCheck();return markMsg('Actualiza tu ubicación antes de registrar la asistencia presencial.');}
  const btn=$('confirm-mark'),hadEvidence=true;MARK_BUSY=true;setBusy(btn,true,'Registrando…');markMsg('');resetMarkProgress();setMarkFlow('processing');
  try{
    const geo=mode==='presencial'?MARK_GEO:null;
    const fresh=await refreshMarkEligibility({render:false,geo});
    if(!fresh?.puede_marcar){const e=new Error(fresh?.motivo||'fuera_ventana');e.motivo=fresh?.motivo||'fuera_ventana';e.ventana=fresh?.dia?.ventana;throw e;}
    if(mode==='presencial'){
      markProgressStep('location','active','Confirmando radio…');$('mark-processing-copy').textContent='Confirmando tu cercanía con la oficina…';
      markProgressStep('location','done',`${formatDistance(fresh.distancia_m)} de la oficina`);
    }else markProgressStep('location','skipped','No requerida en virtual');
    markProgressStep('evidence','active','Protegiendo archivo…');$('mark-processing-copy').textContent='Protegiendo y subiendo tu evidencia…';
    const path=await uploadEvidence();markProgressStep('evidence','done','Evidencia protegida');
    markProgressStep('server','active','Confirmando hora…');$('mark-processing-copy').textContent='Confirmando la hora oficial del servidor…';
    const {data,error}=await db.rpc('dash_marcar_seguro',{p_protocolo:MARK_PROTOCOL,p_modalidad:mode,p_disp:(navigator.userAgent||'').slice(0,80),p_foto:path,p_foto_org:EVIDENCE.origin,p_lat:geo?.lat??null,p_lon:geo?.lon??null,p_precision:geo?.accuracy??null});
    if(error){const missing=error.code==='PGRST202'||String(error.message||'').includes('dash_marcar_seguro');const e=new Error(missing?'proteccion_no_disponible':'registro');e.motivo=missing?'proteccion_no_disponible':'registro';throw e;}if(!data?.ok){const e=new Error(data?.motivo||'registro');e.motivo=data?.motivo;throw e;}
    markProgressStep('server','done','Registro confirmado');$('mark-processing-copy').textContent='Tu asistencia quedó registrada.';
    clearEvidence();showMarkReceipt(data,hadEvidence);
    (async()=>{try{const {data:fresh}=await db.rpc('dash_inicio');if(fresh?.ok){APP.inicio=fresh;renderHome();renderProfile();await Promise.all([loadHistory(),loadDailyClose({quiet:true})]);}}catch(refreshError){console.warn('No se pudo refrescar el panel tras marcar.',refreshError);}})();
  }catch(e){
    setMarkFlow('confirm');
    markMsg(markFailureMessage(e.motivo,e.ventana));
  }
  finally{MARK_BUSY=false;setBusy(btn,false,'');syncMarkConfirm();reloadDashboardIfSafe();}
};

db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!$('portal').hidden&&$('portal').dataset.loading!=='true')location.reload()});
startTimeAmbience();
init().catch(()=>showAccess('No se pudo iniciar el portal. Recarga la página.'));
