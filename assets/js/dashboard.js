/* KJA · Portal personal — sin framework, sesión Supabase + RPC protegidas. */
const SUPABASE_URL = 'https://xadxmfgdxwplmhijagix.supabase.co';
const SUPABASE_ANON = 'sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub';
const AUTH_KEY = 'kja-dashboard-auth';
const DEADLINE_KEY = 'kja-dashboard-vence';
const SHELL_KEY = 'kja-dashboard-shell';
const PROFILE_BUCKET = 'perfil-fotos';
const REQUEST_BUCKET = 'solicitud-evidencias';
const PROFILE_MAX_SOURCE = 3 * 1024 * 1024;
const PROFILE_MAX_STORED = 480 * 1024;
const PROFILE_AVATAR_IDS = ['side-avatar','mobile-avatar','rail-avatar','mobile-home-avatar','profile-avatar'];
const MARK_PROTOCOL = 20260902;
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
let AMBIENCE_PREVIEW_DAY = false;
let PERSONAL_REQUEST = {file:null,previewUrl:'',busy:false};
let ATTENDANCE_DAY_TRIGGER = null;
let ATTENDANCE_EVIDENCE_TRIGGER = null;
let ATTENDANCE_DAY_EVIDENCES = [];

function limaClock(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(part=>[part.type,part.value]));
  const hour=Number(parts.hour)%24,minute=Number(parts.minute)||0;
  return {value:hour+(minute/60)};
}

function paintTimeAmbience(){
  const portal=$('portal'),ambience=$('time-ambience');if(!portal||!ambience)return;
  const live=limaClock(),value=AMBIENCE_PREVIEW_DAY?12:live.value;
  const daylight=value>=5&&value<19;
  const progress=daylight?(value-5)/14:((value>=19?value-19:value+5)/10);
  const x=8+(progress*84);
  const y=76-(Math.sin(Math.PI*progress)*56);
  const phase=value>=5&&value<8?'dawn':value>=8&&value<16?'day':value>=16&&value<19?'sunset':'night';
  portal.dataset.timePhase=phase;
  portal.dataset.timePreview=AMBIENCE_PREVIEW_DAY?'day':'auto';
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
  const preview=$('time-preview-switch');
  if(preview){
    preview.setAttribute('aria-checked',String(AMBIENCE_PREVIEW_DAY));
    preview.setAttribute('aria-label',AMBIENCE_PREVIEW_DAY?'Volver al ambiente automático':'Probar ambiente de día');
    preview.title=AMBIENCE_PREVIEW_DAY?'Volver al horario automático':'Probar ambiente de día';
    const label=preview.querySelector('.time-preview-label');if(label)label.textContent=AMBIENCE_PREVIEW_DAY?'Viendo día':'Probar día';
  }
}

function startTimeAmbience(){
  const schedule=()=>{paintTimeAmbience();clearInterval(AMBIENCE_TIMER);AMBIENCE_TIMER=setInterval(paintTimeAmbience,60000)};
  schedule();
  const preview=$('time-preview-switch');
  if(preview)preview.addEventListener('click',()=>{AMBIENCE_PREVIEW_DAY=!AMBIENCE_PREVIEW_DAY;paintTimeAmbience()});
  document.addEventListener('visibilitychange',()=>{
    const portal=$('portal');if(portal)portal.dataset.ambiencePaused=String(document.hidden);
    if(document.hidden){clearInterval(AMBIENCE_TIMER);AMBIENCE_TIMER=null}else schedule();
  });
}

let APP = { inicio:null, historial:null, personalRequests:[], teamPeople:[], year:0, month:0, view:'inicio', sessionTimer:null, markTimer:null, attendanceDayRequest:0, attendanceDayDate:'', avatar:{path:'',url:'',busy:false}, identity:{nivel:'miembro',hasPersonal:false,isLeader:false,isSystem:false}, access:{rol:'visor',acceso_panel:false}, adminSection:'overview', adminList:null, adminListRequest:0, adminTeam:null, adminTeamRequest:0, adminAccess:null, adminAccessRequest:0, adminMonth:null, adminMonthKey:'', adminMonthRequest:0, adminRoles:null, adminRolesRequest:0 };
let EVIDENCE = null;
let MARK_BUSY = false;
let MARK_SYNC_PROMISE = null;
let MARK_GEO = null;
let MODE_BUSY = false;
let DASH_ETAG = null;
let DASH_UPDATE_PENDING = false;
let DASH_VERSION_CHECKED_AT = 0;
let DASH_VERSION_TIMER = null;

function formMsg(id,text){ const el=$(id); el.textContent=text||''; el.classList.toggle('show',!!text); }
function markMsg(text){ $('mark-msg').textContent=text||''; $('mark-msg').classList.toggle('show',!!text); }
function toast(text,bad=false){ const el=$('toast'); el.textContent=text; el.classList.toggle('bad',bad); el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),3500); }
function setBusy(button,on,label){ button.disabled=on; if(!button.dataset.label) button.dataset.label=button.querySelector('span')?.textContent||button.textContent; const span=button.querySelector('span'); if(span) span.textContent=on?label:button.dataset.label; }

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
async function chooseProfilePhoto(file){
  if(!file||APP.avatar.busy)return;
  const validType=/^image\/(jpeg|png|webp)$/i.test(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name||'');
  if(!validType)return profilePhotoIssue('Elige una imagen JPG, PNG o WebP.');
  if(file.size>PROFILE_MAX_SOURCE)return profilePhotoIssue('La foto supera el máximo de 3 MB. Elige una más liviana.');
  const colab=APP.inicio?.colaborador?.id;if(!colab)return profilePhotoIssue('Tu perfil no está disponible en esta sesión.');
  setProfilePhotoBusy(true);profilePhotoMessage('Recortando y comprimiendo la foto…');
  try{
    const prepared=await compressProfilePhoto(file),path=`${colab}/avatar.${prepared.ext}`,previous=APP.avatar.path;
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
}
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
  clearInterval(APP.sessionTimer);clearInterval(APP.markTimer);clearInterval(DASH_VERSION_TIMER); localStorage.removeItem(DEADLINE_KEY); localStorage.removeItem(SHELL_KEY);
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
  const name=c?.nombre||p.nombre||'Equipo KJA', ini=initials(name), role={sistemas:'Administrador de sistemas',lider:'Líder técnico',miembro:'Colaborador'}[p.nivel]||'Colaborador';
  APP.identity={nivel:p.nivel||'miembro',hasPersonal:!!c,isLeader:p.nivel==='lider'&&!!c,isSystem:p.nivel==='sistemas'};
  $('portal').dataset.role=APP.identity.nivel;
  $('portal').dataset.access=APP.access.rol;
  $('portal').dataset.personal=String(APP.identity.hasPersonal);
  document.querySelectorAll('.mobile-inline-home').forEach(button=>button.hidden=!APP.identity.hasPersonal);
  $('side-name').textContent=name; $('side-role').textContent=role; $('side-avatar').textContent=ini; $('mobile-avatar').textContent=ini;
  $('rail-name').textContent=name; $('rail-role').textContent=role; $('rail-avatar').textContent=ini;
  $('mobile-home-name').textContent=name;
  $('mobile-home-avatar').textContent=ini;
  $('mobile-home-role').textContent=role;
  $('mobile-home-area').textContent=c?.area||'Equipo KJA';
  $('mobile-home-dni').textContent=c?.dni?`DNI ${c.dni}`:'Perfil institucional';
  ['personal-nav-divider','nav-inicio','nav-asistencia','nav-perfil'].forEach(id=>$(id).hidden=!APP.identity.hasPersonal);
  $('team-nav-divider').hidden=!APP.identity.isLeader;$('nav-equipo').hidden=!APP.identity.isLeader;
  $('nav-gestion').hidden=!APP.access.acceso_panel; $('admin-nav-divider').hidden=!APP.access.acceso_panel;
  $('mobile-action-team').hidden=!APP.identity.isLeader;
  $('mobile-action-admin').hidden=!APP.access.acceso_panel;
  $('admin-role-chip').textContent=({direccion:'Dirección',editor:'Encargado(a)',visor:'Solo lectura'}[APP.access.rol]||APP.access.rol);
  $('admin-device-module').hidden=APP.access.rol!=='direccion';
  $('admin-access-tab').hidden=APP.access.rol!=='direccion';
  const managesRoles=APP.identity.isSystem&&APP.access.rol==='direccion'&&APP.access.acceso_panel;
  $('admin-roles-tab').hidden=!managesRoles;$('admin-roles-module').hidden=!managesRoles;
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
  startDashboardVersionWatch();
  const backgroundLoads=[];
  if(c)backgroundLoads.push(loadHistory(),loadProfilePhoto());
  if(initialLoad?.then)backgroundLoads.push(initialLoad);
  if(backgroundLoads.length)void Promise.allSettled(backgroundLoads);
}

function startSessionClock(){
  clearInterval(APP.sessionTimer);
  const tick=()=>{
    const raw=localStorage.getItem(DEADLINE_KEY), end=Date.parse(raw||'');
    if(!Number.isFinite(end)){ $('session-left').textContent='activa'; return; }
    const ms=end-Date.now(); if(ms<=0) return logout('Tu sesión venció.');
    const h=Math.floor(ms/3600000),m=Math.ceil((ms%3600000)/60000); $('session-left').textContent=h?`${h} h ${m} min`:`${m} min`;
  }; tick(); APP.sessionTimer=setInterval(tick,30000);
}

function renderHome(){
  const c=APP.inicio.colaborador,d=APP.inicio.dia||{}; if(!c) return;
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',hour:'2-digit',hour12:false}).format(new Date()));
  const greeting=hour<12?'Buenos días':hour<19?'Buenas tardes':'Buenas noches';
  $('welcome').textContent=`${greeting}, ${c.nombre.split(' ')[0]}`;
  $('welcome-sub').textContent=d.marcado?'Tu asistencia de hoy ya quedó registrada.':'Aquí tienes lo importante de tu jornada.';
  const date=new Date((d.fecha||isoLima())+'T12:00:00');
  $('today-label').textContent=dayNames[date.getDay()].toUpperCase();
  $('day-date').textContent=new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'long',year:'numeric'}).format(date);
  $('mobile-today-date').textContent=new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long'}).format(date);
  $('time-start').textContent=fmtTime(d.hora_entrada); $('time-end').textContent=fmtTime(d.hora_salida);
  $('mobile-today-start').textContent=fmtTime(d.hora_entrada); $('mobile-today-end').textContent=fmtTime(d.hora_salida);
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
  else if(d.ventana==='cerrada'){ pill.textContent='Ventana cerrada'; pill.classList.add('closed'); btn.disabled=true; card.dataset.attendanceState='closed'; markTitle.textContent='La jornada ya finalizó'; markCaption.textContent='VENTANA CERRADA'; $('mark-label').textContent='Marcado no disponible'; $('mark-help').textContent='Si tu horario cambió, comunícalo a Dirección.'; }
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
  const choice=$('today-mode-choice'),virtual=$('today-mode-virtual'),office=$('today-mode-presencial');
  if(!choice||!virtual||!office)return;
  const laborable=!!d.labora,mode=d.modalidad==='presencial'?'presencial':laborable?'virtual':'no_gestiona',locked=!!d.marcado||!laborable;
  choice.dataset.mode=mode;choice.dataset.locked=String(locked);
  $('day-mode').textContent=mode==='presencial'?'Trabajo presencial':mode==='virtual'?'Trabajo virtual':'Día no laborable';
  [virtual,office].forEach(button=>{
    const selected=laborable&&button.dataset.todayMode===mode;
    button.setAttribute('aria-checked',String(selected));
    button.disabled=locked||MODE_BUSY;
  });
  const help=$('today-mode-help');
  if(!laborable)help.textContent='Hoy no tienes una jornada programada.';
  else if(d.marcado)help.textContent='La modalidad quedó fijada al registrar tu asistencia.';
  else if(MODE_BUSY)help.textContent='Guardando tu modalidad…';
  else if(mode==='presencial'&&!d.geocerca_configurada)help.textContent='Dirección debe configurar la ubicación de la oficina.';
  else if(mode==='presencial')help.textContent=`Para marcar deberás estar dentro de ${Number(d.radio_presencial_m||1000)/1000} km de la oficina.`;
  else help.textContent=d.modalidad_elegida?'Elegiste trabajar virtual hoy.':'Puedes cambiarla si hoy debes asistir a la oficina.';
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
  $('hours-done').textContent=done.toFixed(done%1?1:0); $('hours-goal').textContent=goal||'—'; $('hours-bar').style.transform=`scaleX(${pct/100})`;
  $('hours-rate').textContent=goal?`${pct.toFixed(0)}% completado`:'Sin meta configurada';
  $('hours-note').textContent=goal?`${Math.max(0,goal-done).toFixed(1)} h pendientes`:'Dirección aún no definió una meta de horas.';
  $('hours-ring').style.setProperty('--hours-angle',`${pct*3.6}deg`); $('hours-ring').setAttribute('aria-label',goal?`${done} de ${goal} horas, ${pct.toFixed(0)} por ciento completado`:`${done} horas acumuladas, sin meta configurada`);
  const t=h.totales||{},att=(t.P||0)+(t.T||0)+(t.J||0),rate=t.laborables?Math.round(att/t.laborables*100):0;
  $('month-rate').textContent=t.laborables?rate+'%':'—'; $('month-note').textContent=`${att} de ${t.laborables||0} días laborables`;
  const total=Math.max(0,Number(t.laborables)||0),dayStates=[],addDays=(state,count)=>dayStates.push(...Array(Math.min(Math.max(0,total-dayStates.length),Number(count)||0)).fill(state));
  addDays('p',t.P);addDays('t',t.T);addDays('j',t.J);addDays('ng',t.NG);addDays('pending',total-dayStates.length);
  $('month-days-visual').innerHTML=dayStates.slice(0,31).map(state=>`<i class="${state}"></i>`).join(''); $('month-days-visual').setAttribute('aria-label',total?`${att} de ${total} días laborables registrados`:'Sin días laborables registrados');
  $('rail-rate').textContent=t.laborables?rate+'%':'—'; $('rail-rate-note').textContent=`${att} de ${t.laborables||0} días registrados`;
}

function renderHistory(){
  const h=APP.historial;if(!h)return; $('month-title').textContent=cap(`${monthNames[h.mes-1]} ${h.anio}`);
  const t=h.totales||{},items=[['Presentes',t.P||0],['Tardanzas',t.T||0],['Justificados',t.J||0],['No gestionó',t.NG||0]];
  $('attendance-stats').innerHTML=items.map(x=>`<div class="att-stat"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join('');
  $('attendance-hours-summary').textContent=`${(Number(h.horas)||0).toFixed(1)} h acumuladas`;
  const first=new Date(h.anio,h.mes-1,1).getDay(),offset=(first+6)%7; let html='<span class="cal-day empty"></span>'.repeat(offset);
  for(const d of h.dias||[]){
    const cls=(d.estado||'').toLowerCase(),label=d.futuro?'Próximo':statusLabel(d.estado,d.lab),today=d.fecha===h.hoy;
    html+=`<button type="button" class="cal-day ${cls} ${d.futuro?'future':''} ${!d.lab?'off':''} ${today?'today':''}" data-history-date="${esc(d.fecha)}" aria-label="${esc(`${d.d} de ${monthNames[h.mes-1]}: ${label}${today?', hoy':''}`)}"><span class="cal-day-top"><b>${d.d}</b>${today?'<em>Hoy</em>':'<i aria-hidden="true"></i>'}</span><small>${esc(label)}</small></button>`;
  }
  $('calendar-grid').innerHTML=html;
  renderRailCalendar(h);
  $('month-next').disabled=h.anio===new Date().getFullYear()&&h.mes===new Date().getMonth()+1;
}
function statusLabel(state,lab){ return state?({P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestionó'}[state]||state):(lab?'Sin registro':'No laborable'); }

function formatAttendanceDayDate(value){return value?cap(new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00'))):'Día seleccionado'}
function formatAttendanceClock(value){return value?new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'America/Lima'}).format(new Date(value)):'—'}
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

async function loadPersonalRequests(){
  if(!APP.identity.hasPersonal)return;
  const {data,error}=await db.rpc('dash_solicitudes_personales');
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

function openPersonalRequest(type='justificacion',date=''){
  const normalized=PERSONAL_REQUEST_TYPES[type]?type:'justificacion',config=PERSONAL_REQUEST_TYPES[normalized],today=isoLima(),absence=config.evidence;
  resetPersonalRequestEvidence();personalRequestMessage('');
  $('personal-request-type').value=normalized;
  $('personal-request-kind').hidden=absence;
  $('personal-request-kind-value').value=normalized==='cambio_turno'?'cambio_turno':'cambio_horario';
  $('personal-request-title').textContent=config.title;$('personal-request-copy').textContent=config.copy;
  $('personal-request-detail-label').textContent=config.label;$('personal-request-detail').placeholder=config.placeholder;$('personal-request-detail').value='';$('personal-request-detail-count').textContent='0';
  $('personal-request-evidence').hidden=!config.evidence;$('personal-request-note').hidden=!config.evidence;
  const start=$('personal-request-start'),end=$('personal-request-end'),selected=date||today;
  start.min=absence?addIsoDays(today,-90):addIsoDays(today,-7);start.max=absence?today:addIsoDays(today,180);
  end.min=start.min;end.max=start.max;start.value=selected;end.value=selected;
  $('personal-request-modal').hidden=false;
  setTimeout(()=>start.focus(),30);
}

function closePersonalRequest(){if(PERSONAL_REQUEST.busy)return;$('personal-request-modal').hidden=true;resetPersonalRequestEvidence();personalRequestMessage('')}

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
      const reason=data?.motivo||'guardar',messages={duplicada:'Ya existe una solicitud pendiente para esas fechas.',rango_ausencia:'Las justificaciones solo pueden corresponder a los últimos 90 días.',rango_cambio:'La fecha del cambio está fuera del rango permitido.',evidencia:'La evidencia es obligatoria.',detalle:'Amplía el comentario antes de enviarlo.'};
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
    const registered=!!d.estado, cls=[registered?'registered':'',d.fecha===h.hoy?'today':'',d.futuro?'future':'',!d.lab?'off':''].filter(Boolean).join(' ');
    html+=`<span class="rail-cal-day ${cls}" title="${esc(statusLabel(d.estado,d.lab))}"><b>${d.d}</b>${registered?'<i></i>':''}</span>`;
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
  const [{data:people,error},{data:marks}]=await Promise.all([
    db.from('asis_colaboradores').select('id,nombre,area_id,dni,dias_laborables,hora_inicio,hora_fin,tipo_vinculo,contrato_inicio,contrato_fin_referencia,asis_areas(nombre)').eq('activo',true).order('nombre'),
    db.from('asis_registros').select('colaborador_id,estado,marcado_at').eq('fecha',today)
  ]);
  if(error){ $('team-list').innerHTML='<p style="padding:25px">No se pudo cargar el equipo.</p>';return; }
  const by=new Map((marks||[]).map(x=>[String(x.colaborador_id),x])),p=people||[];APP.teamPeople=p;
  const present=p.filter(x=>['P','T','J'].includes(by.get(String(x.id))?.estado)).length,late=p.filter(x=>by.get(String(x.id))?.estado==='T').length,pending=p.length-present;
  $('team-summary').innerHTML=[['Personas visibles',p.length],['Registraron hoy',present],['Tardanzas',late],['Sin registro',pending]].map(x=>`<div class="team-kpi"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
  $('team-list').innerHTML=p.length?p.map(x=>{const m=by.get(String(x.id)),s=m?.estado||'',label=m?statusLabel(s,true):'Sin registro';return `<div class="team-row"><span class="avatar">${initials(x.nombre)}</span><span><strong>${esc(x.nombre)}</strong><small>${esc(x.asis_areas?.nombre||'Sin área')}</small></span><span><small>${m?.marcado_at?new Date(m.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):'Sin hora registrada'}</small></span><span class="team-state ${s.toLowerCase()}">${esc(label)}</span><button class="team-profile-open" type="button" data-team-profile="${x.id}">Ver perfil</button></div>`}).join(''):'<p style="padding:25px">No hay personas para mostrar.</p>';
}

async function openTeamProfile(id){
  if(!APP.identity.isLeader)return toast('Solo el líder técnico puede consultar este equipo.',true);
  const person=APP.teamPeople.find(item=>String(item.id)===String(id));if(!person)return;
  $('team-profile-modal').hidden=false;$('team-profile-title').textContent=person.nombre;$('team-profile-area').textContent=person.asis_areas?.nombre||'Sin área';
  $('team-profile-avatar').textContent=initials(person.nombre);$('team-profile-body').innerHTML='<p class="admin-empty">Cargando perfil y asistencia…</p>';
  const now=new Date(),year=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric'}).format(now)),month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',month:'numeric'}).format(now));
  const {data,error}=await db.rpc('dash_historial',{p_anio:year,p_mes:month,p_colab:Number(id)});
  if(error||!data?.ok){$('team-profile-body').innerHTML='<p class="admin-empty">No se pudo cargar el historial autorizado.</p>';return;}
  const t=data.totales||{},days=data.dias||[],first=new Date(`${year}-${String(month).padStart(2,'0')}-01T12:00:00`),offset=(first.getDay()+6)%7;
  const calendar='<span class="empty"></span>'.repeat(offset)+days.map(day=>`<span class="${String(day.estado||'').toLowerCase()} ${day.lab?'':'off'}"><b>${day.d}</b><i>${esc(day.estado||'')}</i></span>`).join('');
  const profile=[['DNI',person.dni||'—'],['Vínculo',({practicas:'Practicante',voluntariado:'Voluntariado',ambos:'Prácticas + voluntariado'}[person.tipo_vinculo]||person.tipo_vinculo||'—')],['Horario',`${fmtTime(person.hora_inicio)} — ${fmtTime(person.hora_fin)}`],['Contrato',`${person.contrato_inicio||'—'} → ${person.contrato_fin_referencia||'—'}`]];
  $('team-profile-body').innerHTML=`<div class="team-profile-facts">${profile.map(item=>`<span><small>${item[0]}</small><b>${esc(item[1])}</b></span>`).join('')}</div><div class="team-profile-month"><header><span><small>ASISTENCIA DEL MES</small><b>${cap(monthNames[month-1])} ${year}</b></span><strong>${Number(data.horas||0).toFixed(1)} h</strong></header><div class="team-profile-stats"><span><b>${t.P||0}</b><small>Presentes</small></span><span><b>${t.T||0}</b><small>Tardanzas</small></span><span><b>${t.J||0}</b><small>Justificados</small></span><span><b>${t.NG||0}</b><small>No gestionó</small></span></div><div class="team-profile-week"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="team-profile-calendar">${calendar}</div></div>`;
}
function closeTeamProfile(){$('team-profile-modal').hidden=true}

async function loadAdminHub(){
  if(!APP.access.acceso_panel)return;
  const btn=$('admin-refresh'); btn.disabled=true;
  const today=isoLima();
  const [peopleRes,marksRes,legacyRequestsRes,personalRequestsRes]=await Promise.all([
    db.from('asis_colaboradores').select('id,nombre,area_id,asis_areas(nombre)').eq('activo',true).order('nombre'),
    db.from('asis_registros').select('colaborador_id,estado,marcado_at,origen').eq('fecha',today),
    db.from('asis_solicitudes_horario').select('id,colaborador_id,horario_nuevo,creado_at').eq('estado','pendiente').order('creado_at',{ascending:false}),
    APP.access.rol==='direccion'?db.rpc('dash_admin_solicitudes_personales'):Promise.resolve({data:{ok:true,solicitudes:[]},error:null})
  ]);
  btn.disabled=false;
  if(peopleRes.error||marksRes.error){
    $('admin-status-list').innerHTML='<p class="admin-empty">No se pudo cargar el estado operativo. Actualiza nuevamente.</p>';
    toast('No se pudo actualizar la administración.',true); return;
  }
  const people=peopleRes.data||[],marks=marksRes.data||[],legacyRequests=legacyRequestsRes.data||[],personalRequests=personalRequestsRes.data?.ok?personalRequestsRes.data.solicitudes||[]:[];
  const byMark=new Map(marks.map(x=>[String(x.colaborador_id),x]));
  const byPerson=new Map(people.map(x=>[String(x.id),x]));
  const registered=people.filter(x=>byMark.has(String(x.id))).length;
  const late=people.filter(x=>byMark.get(String(x.id))?.estado==='T').length;
  const pending=Math.max(0,people.length-registered);
  const kpis=[
    ['COLABORADORES ACTIVOS',people.length,'Personas en el sistema',''],
    ['REGISTRARON HOY',registered,`${people.length?Math.round(registered/people.length*100):0}% del equipo`,'registered'],
    ['TARDANZAS',late,'Registros con estado T','late'],
    ['SIN REGISTRO',pending,'Revisión operativa pendiente','pending']
  ];
  $('admin-kpis').innerHTML=kpis.map(x=>`<article class="admin-kpi ${x[3]}"><small>${esc(x[0])}</small><b>${esc(x[1])}</b><span>${esc(x[2])}</span></article>`).join('');

  const sorted=[...people].sort((a,b)=>Number(byMark.has(String(a.id)))-Number(byMark.has(String(b.id)))||a.nombre.localeCompare(b.nombre,'es'));
  let statusHtml=sorted.slice(0,14).map(person=>{
    const mark=byMark.get(String(person.id)),state=mark?.estado||'',label=mark?statusLabel(state,true):'Sin registro';
    const time=mark?.marcado_at?new Date(mark.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):'—';
    return `<div class="admin-status-row"><span class="avatar">${initials(person.nombre)}</span><span><strong>${esc(person.nombre)}</strong><small>${esc(person.asis_areas?.nombre||'Sin área')}</small></span><span class="admin-status-time">${esc(time)}${mark?.origen?' · '+esc(mark.origen):''}</span><span class="admin-status-pill ${state.toLowerCase()}">${esc(label)}</span></div>`;
  }).join('');
  if(sorted.length>14)statusHtml+=`<p class="admin-empty">Mostrando 14 de ${sorted.length}. Abre Pasar lista para gestionar el equipo completo.</p>`;
  $('admin-status-list').innerHTML=statusHtml||'<p class="admin-empty">No hay colaboradores activos.</p>';

  const totalRequests=personalRequests.length+legacyRequests.length;
  $('admin-request-count').textContent=totalRequests;
  const personalHtml=personalRequests.slice(0,6).map(req=>{
    const created=req.creado_at?new Date(req.creado_at).toLocaleDateString('es-PE',{day:'2-digit',month:'short',timeZone:'America/Lima'}):'—';
    const range=req.fecha_inicio===req.fecha_fin?formatRequestDate(req.fecha_inicio):`${formatRequestDate(req.fecha_inicio)} — ${formatRequestDate(req.fecha_fin)}`;
    const evidence=req.evidencia_path?`<button class="evidence" type="button" data-request-evidence="${esc(req.evidencia_path)}">Ver evidencia</button>`:'';
    return `<div class="admin-request personal" data-admin-personal-request="${req.id}"><span><b>${esc(req.nombre||'Colaborador')}</b><small>${esc(personalRequestLabel(req.tipo))} · ${esc(range)}</small></span><small>${esc(created)}</small><p>${esc(req.detalle||'Sin detalle')}</p><div class="admin-request-actions"><input data-request-response="${req.id}" maxlength="500" placeholder="Respuesta opcional">${evidence}<button class="approve" type="button" data-admin-personal-action="approve" data-request-id="${req.id}">Aprobar</button><button class="reject" type="button" data-admin-personal-action="reject" data-request-id="${req.id}">Rechazar</button></div></div>`;
  }).join('');
  const remaining=Math.max(0,6-personalRequests.length),legacyHtml=legacyRequests.slice(0,remaining).map(req=>{
    const person=byPerson.get(String(req.colaborador_id)),created=req.creado_at?new Date(req.creado_at).toLocaleDateString('es-PE',{day:'2-digit',month:'short',timeZone:'America/Lima'}):'—';
    return `<div class="admin-request"><b>${esc(person?.nombre||'Colaborador')}</b><small>${esc(created)}</small><p>Cambio de horario · ${esc(req.horario_nuevo||'Sin detalle')}</p></div>`;
  }).join('');
  $('admin-request-list').innerHTML=personalHtml+legacyHtml||'<p class="admin-empty">No hay solicitudes pendientes.</p>';
  $('admin-refreshed').textContent='Actualizado '+new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'});
}

function adminListMsg(text){const el=$('admin-list-message');el.textContent=text||'';el.classList.toggle('show',!!text);}
function addIsoDays(iso,amount){const d=new Date((iso||isoLima())+'T12:00:00');d.setDate(d.getDate()+amount);return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}

async function showAdminSection(section){
  if(!APP.access.acceso_panel)return;
  if(section==='marcado'&&APP.access.rol!=='direccion'){toast('Marcado propio está reservado a Dirección.',true);section='overview'}
  if(section==='roles'&&!(APP.identity.isSystem&&APP.access.rol==='direccion')){toast('Los roles están reservados al administrador de sistemas.',true);section='overview'}
  const allowed=['overview','lista','mes','resumen','colaboradores','contratos','roles','marcado'];
  APP.adminSection=allowed.includes(section)?section:'overview';
  $('admin-overview-section').hidden=APP.adminSection!=='overview';
  $('admin-list-section').hidden=APP.adminSection!=='lista';
  $('admin-month-section').hidden=APP.adminSection!=='mes';
  $('admin-summary-section').hidden=APP.adminSection!=='resumen';
  $('admin-people-section').hidden=APP.adminSection!=='colaboradores';
  $('admin-contracts-section').hidden=APP.adminSection!=='contratos';
  $('admin-roles-section').hidden=APP.adminSection!=='roles';
  $('admin-access-section').hidden=APP.adminSection!=='marcado';
  document.querySelectorAll('[data-admin-section]').forEach(b=>{
    const active=!!b.closest('.admin-section-nav')&&b.dataset.adminSection===APP.adminSection;
    b.classList.toggle('active',active);
    if(b.closest('.admin-section-nav'))b.setAttribute('aria-pressed',String(active));
  });
  if(APP.adminSection==='lista'){
    if(!$('admin-list-date').value)$('admin-list-date').value=isoLima();
    $('admin-list-date').max=isoLima();
    await loadAdminAttendance();
  }else if(APP.adminSection==='mes'||APP.adminSection==='resumen'){
    if(typeof loadAdminMonth==='function')await loadAdminMonth();
  }else if(APP.adminSection==='marcado'){
    if(typeof loadAdminAccess==='function')await loadAdminAccess();
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
  const {data,error}=await db.rpc('dash_admin_lista',{p_fecha:date});
  if(request!==APP.adminListRequest)return;
  btn.disabled=false;
  if(error||!data?.ok){
    APP.adminList=null;
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_lista'));
    adminListMsg(missing?'La fase 2 todavía no está instalada en Supabase. Ejecuta dashboard_05_admin_lista.sql.':'No se pudo cargar la lista. Actualiza e inténtalo nuevamente.');
    $('admin-roster').innerHTML='<p class="admin-empty">La lista no está disponible.</p>';return;
  }
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
  const people=data.personas||[],counts={P:0,T:0,J:0,NG:0,pending:0};
  people.forEach(x=>x.estado?counts[x.estado]++:counts.pending++);
  const marked=people.length-counts.pending;
  const kpis=[['PERSONAS DEL DÍA',people.length],['REGISTRADOS',marked],['PRESENTES',counts.P],['TARDANZAS',counts.T],['PENDIENTES',counts.pending]];
  $('admin-list-kpis').innerHTML=kpis.map(x=>`<article class="admin-list-kpi"><small>${x[0]}</small><b>${x[1]}</b></article>`).join('');
  const query=$('admin-list-search').value.trim().toLocaleLowerCase('es'),area=$('admin-list-area').value;
  const visible=people.filter(x=>(!area||String(x.area_id)===area)&&(!query||String(x.nombre).toLocaleLowerCase('es').includes(query)));
  const groups=new Map();visible.forEach(x=>{const key=String(x.area_id);if(!groups.has(key))groups.set(key,{name:x.area||'Sin área',items:[]});groups.get(key).items.push(x)});
  const canEdit=!!data.puede_editar;
  let html='';
  for(const group of groups.values()){
    const done=group.items.filter(x=>x.estado).length;
    html+=`<section class="admin-area-group"><header class="admin-area-head"><span><i></i><b>${esc(group.name)}</b></span><small>${done} de ${group.items.length} registrados</small></header>`;
    for(const person of group.items){
      const state=person.estado||'',label=state?statusLabel(state,true):'Sin registro';
      const mode={virtual:'Virtual',presencial:'Presencial',opcional:'Opcional',no_gestiona:'No gestiona'}[person.modalidad]||cap(person.modalidad||'Sin modalidad');
      const shift=`${fmtTime(person.hora_entrada)} — ${fmtTime(person.hora_salida)}`;
      const time=person.marcado_at?new Date(person.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):mode;
      const evidence=person.evidencia_path?`<button class="admin-evidence-button" type="button" data-admin-evidence="${esc(person.evidencia_path)}">Ver evidencia</button>`:'';
      html+=`<div class="admin-roster-row" data-admin-person="${person.id}"><span class="avatar">${initials(person.nombre)}</span><span class="admin-person"><b>${esc(person.nombre)}</b><small>${esc(mode)}${person.nota?' · '+esc(person.nota):''}</small>${evidence}</span><span class="admin-shift"><b>${esc(shift)}</b><small>${person.horas!=null?Number(person.horas).toFixed(1)+' h':'Horario del día'}</small></span><span class="admin-current-state ${state.toLowerCase()}">${esc(label)}${person.marcado_at?' · '+esc(time):''}</span><span class="admin-state-actions">${['P','T','J','NG'].map(s=>`<button type="button" class="admin-state-btn ${s.toLowerCase()} ${state===s?'on':''}" data-admin-state="${s}" aria-label="${statusLabel(s,true)}" aria-pressed="${state===s}" ${canEdit?'':'disabled'}>${s}</button>`).join('')}</span></div>`;
    }
    html+='</section>';
  }
  $('admin-roster').innerHTML=html||'<p class="admin-empty">No hay colaboradores para los filtros seleccionados.</p>';
  if(!canEdit)adminListMsg('Tu rol es de solo lectura. Puedes consultar la lista, pero no cambiar estados.');
}

async function openAdminEvidence(path,bucket='asis-evidencias'){
  if(!path)return;
  const popup=window.open('about:blank','_blank');
  try{
    const {data,error}=await db.storage.from(bucket).createSignedUrl(path,3600);
    if(error||!data?.signedUrl)throw error||new Error('url');
    if(popup){popup.opener=null;popup.location.replace(data.signedUrl)}
    else window.open(data.signedUrl,'_blank','noopener');
  }catch(error){
    if(popup)popup.close();
    adminListMsg('No se pudo abrir la evidencia. Actualiza e inténtalo nuevamente.');
  }
}

async function resolveAdminPersonalRequest(id,approved){
  if(APP.access.rol!=='direccion')return toast('Solo Dirección puede resolver solicitudes.',true);
  const row=document.querySelector(`[data-admin-personal-request="${CSS.escape(String(id))}"]`),response=row?.querySelector(`[data-request-response="${CSS.escape(String(id))}"]`)?.value.trim()||'';
  row?.querySelectorAll('button,input').forEach(control=>control.disabled=true);
  try{
    const {data,error}=await db.rpc('dash_admin_resolver_solicitud',{p_id:Number(id),p_aprobada:approved,p_respuesta:response||null});
    if(error||!data?.ok)throw new Error(data?.motivo||error?.message||'resolver');
    toast(approved?'Solicitud aprobada.':'Solicitud rechazada.');await loadAdminHub();
  }catch{toast('No se pudo resolver la solicitud. Actualiza e inténtalo otra vez.',true);row?.querySelectorAll('button,input').forEach(control=>control.disabled=false)}
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
  if(view==='equipo'&&!APP.identity.isLeader){toast('Mi equipo está reservado al líder técnico del área.',true);return;}
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
    const summary=$('mobile-today-summary');
    summary.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
    summary.focus({preventScroll:true});
  }
});
$('mobile-home-logout').onclick=()=>logout();
$('mobile-home-photo').onclick=()=>$('profile-photo-input').click();
$('profile-photo-camera').onclick=()=>$('profile-photo-input').click();
$('profile-photo-change').onclick=()=>$('profile-photo-input').click();
$('profile-photo-remove').onclick=removeProfilePhoto;
$('profile-photo-input').onchange=event=>chooseProfilePhoto(event.target.files?.[0]);
$('team-list').onclick=e=>{const button=e.target.closest('[data-team-profile]');if(button)openTeamProfile(button.dataset.teamProfile)};
document.querySelectorAll('[data-close-team-profile]').forEach(button=>button.onclick=closeTeamProfile);
$('month-prev').onclick=()=>{ APP.month--;if(APP.month<1){APP.month=12;APP.year--}loadHistory(); };
$('month-next').onclick=()=>{ const n=new Date(),cur=n.getFullYear()*12+n.getMonth(),target=APP.year*12+(APP.month-1);if(target>=cur)return;APP.month++;if(APP.month>12){APP.month=1;APP.year++}loadHistory(); };
$('attendance-new-request').onclick=()=>openPersonalRequest('justificacion');
document.querySelectorAll('[data-personal-request]').forEach(button=>button.onclick=()=>openPersonalRequest(button.dataset.personalRequest));
document.querySelectorAll('[data-close-personal-request]').forEach(button=>button.onclick=closePersonalRequest);
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
$('personal-request-start').onchange=event=>{const end=$('personal-request-end');end.min=event.target.value;if(!end.value||end.value<event.target.value)end.value=event.target.value};
$('calendar-grid').onclick=event=>{const day=event.target.closest('[data-history-date]');if(day)openAttendanceDay(day.dataset.historyDate)};
$('rail-calendar-open').onclick=()=>goView('asistencia');
$('admin-refresh').onclick=()=>APP.adminSection==='lista'?loadAdminAttendance():(APP.adminSection==='mes'||APP.adminSection==='resumen')&&typeof loadAdminMonth==='function'?loadAdminMonth(true):APP.adminSection==='marcado'&&typeof loadAdminAccess==='function'?loadAdminAccess():APP.adminSection==='roles'&&typeof loadAdminRoles==='function'?loadAdminRoles():(APP.adminSection==='colaboradores'||APP.adminSection==='contratos')&&typeof loadAdminTeam==='function'?loadAdminTeam():loadAdminHub();
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
  if(evidence)return openAdminEvidence(evidence.dataset.adminEvidence);
  const button=e.target.closest('[data-admin-state]');if(!button)return;
  const row=button.closest('[data-admin-person]');saveAdminState(row.dataset.adminPerson,button.dataset.adminState,button.classList.contains('on'));
};
$('admin-request-list').onclick=event=>{
  const evidence=event.target.closest('[data-request-evidence]');
  if(evidence)return openAdminEvidence(evidence.dataset.requestEvidence,REQUEST_BUCKET);
  const action=event.target.closest('[data-admin-personal-action]');
  if(action)return resolveAdminPersonalRequest(action.dataset.requestId,action.dataset.adminPersonalAction==='approve');
};

function openMenu(){ $('sidebar').classList.add('open');$('side-scrim').classList.add('show'); } function closeMenu(){ $('sidebar').classList.remove('open');$('side-scrim').classList.remove('show'); }
$('menu-toggle').onclick=openMenu;$('side-scrim').onclick=closeMenu;
$('mobile-back-home').onclick=()=>goView('inicio');
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(!$('personal-request-modal').hidden)return closePersonalRequest();
  if(!$('attendance-day-modal').hidden){if(closeAttendanceEvidence())return;closeAttendanceDay()}
});

// ── Evidencia y marcado ──────────────────────────────────────────────
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
    ubicacion_denegada:'El permiso de ubicación está bloqueado. Habilítalo en el navegador y vuelve a intentarlo.',
    ubicacion_no_disponible:'No pudimos obtener tu ubicación. Activa la ubicación del dispositivo e inténtalo otra vez.',
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
  void refreshMarkEligibility({quiet:true});
  APP.markTimer=setInterval(()=>{if(!document.hidden&&!MARK_BUSY)void refreshMarkEligibility({quiet:true});},60000);
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
  $('evidence-copy').textContent=virtual?'Adjunta una captura del Zoom donde se vea tu nombre.':'Adjunta una fotografía de tu llegada al consultorio.';
  $('evidence-title').textContent=virtual?'Captura de tu reunión':'Foto de tu llegada';
  renderMarkModeCheck();
  $('mark-modal').hidden=false;document.body.style.overflow='hidden';
}
$('open-mark').onclick=handleMarkAction;
document.querySelectorAll('[data-today-mode]').forEach(button=>button.onclick=()=>changeTodayMode(button.dataset.todayMode));
document.querySelectorAll('[data-close-mark]').forEach(x=>x.onclick=closeMark); function closeMark(){ if(MARK_BUSY)return;$('mark-modal').hidden=true;document.body.style.overflow='';MARK_GEO=null;clearEvidence();setMarkFlow('confirm');resetMarkProgress();reloadDashboardIfSafe(); }
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
function geolocation({timeout=12000,maximumAge=0}={}){return new Promise(resolve=>{if(!navigator.geolocation)return resolve({ok:false,motivo:'ubicacion_no_disponible'});let done=false;const end=x=>{if(!done){done=true;resolve(x)}};navigator.geolocation.getCurrentPosition(p=>end({ok:true,lat:+p.coords.latitude.toFixed(6),lon:+p.coords.longitude.toFixed(6),accuracy:Math.round(p.coords.accuracy||9999),capturedAt:Date.now()}),error=>end({ok:false,motivo:error?.code===1?'ubicacion_denegada':'ubicacion_no_disponible'}),{enableHighAccuracy:true,timeout,maximumAge});setTimeout(()=>end({ok:false,motivo:'ubicacion_no_disponible'}),timeout+500)});}

function formatDistance(meters){const value=Number(meters);return Number.isFinite(value)?value<1000?`${Math.round(value)} m`:`${(value/1000).toFixed(1)} km`:'—'}
function renderMarkModeCheck(){
  const day=APP.inicio?.dia||{},presencial=day.modalidad==='presencial',panel=$('mark-mode-check'),button=$('verify-mark-location');
  panel.dataset.mode=presencial?'presencial':'virtual';
  $('mark-mode-virtual-icon').hidden=presencial;$('mark-mode-office-icon').hidden=!presencial;button.hidden=!presencial;
  if(!presencial){panel.removeAttribute('data-location-state');$('mark-mode-label').textContent='MODALIDAD VIRTUAL';$('mark-mode-title').textContent='No requiere ubicación';$('mark-mode-detail').textContent='Solo guardaremos la evidencia de tu reunión.';syncMarkConfirm();return;}
  $('mark-mode-label').textContent='MODALIDAD PRESENCIAL';
  if(MARK_GEO?.verified&&Date.now()-Number(MARK_GEO.capturedAt||0)>=120000)MARK_GEO={verified:false,error:true,message:'La verificación venció. Actualiza tu ubicación para confirmar que sigues cerca de la oficina.'};
  if(MARK_GEO?.verified){
    panel.dataset.locationState='ready';$('mark-mode-title').textContent='Ubicación verificada';$('mark-mode-detail').textContent=`Estás a ${formatDistance(MARK_GEO.distance)} de la oficina · precisión ${MARK_GEO.accuracy} m.`;button.textContent='Verificar otra vez';
  }else{
    panel.dataset.locationState=MARK_GEO?.error?'error':'pending';$('mark-mode-title').textContent=MARK_GEO?.error?'Ubicación sin validar':'Verifica que estás cerca de la oficina';$('mark-mode-detail').textContent=MARK_GEO?.message||'El registro se habilita dentro de un radio de 1 km.';button.textContent='Verificar ubicación';
  }
  syncMarkConfirm();
}

async function verifyMarkLocation(){
  const button=$('verify-mark-location');button.disabled=true;button.textContent='Ubicando…';markMsg('');
  try{
    const geo=await geolocation();
    if(!geo.ok)throw Object.assign(new Error(geo.motivo),{motivo:geo.motivo});
    const fresh=await refreshMarkEligibility({render:false,geo});
    if(!fresh?.puede_marcar){const error=new Error(fresh?.motivo||'ubicacion_invalida');error.motivo=fresh?.motivo||'ubicacion_invalida';error.distance=fresh?.distancia_m;throw error;}
    MARK_GEO={...geo,verified:true,distance:Number(fresh.distancia_m||0)};
  }catch(error){
    MARK_GEO={verified:false,error:true,message:error.motivo==='fuera_radio'&&Number.isFinite(Number(error.distance))?`Estás a ${formatDistance(error.distance)}; debes estar dentro de 1 km.`:markFailureMessage(error.motivo)};
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
    (async()=>{try{const {data:fresh}=await db.rpc('dash_inicio');if(fresh?.ok){APP.inicio=fresh;renderHome();renderProfile();await loadHistory();}}catch(refreshError){console.warn('No se pudo refrescar el panel tras marcar.',refreshError);}})();
  }catch(e){
    setMarkFlow('confirm');
    markMsg(markFailureMessage(e.motivo,e.ventana));
  }
  finally{MARK_BUSY=false;setBusy(btn,false,'');syncMarkConfirm();reloadDashboardIfSafe();}
};

db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!$('portal').hidden&&$('portal').dataset.loading!=='true')location.reload()});
startTimeAmbience();
init().catch(()=>showAccess('No se pudo iniciar el portal. Recarga la página.'));
