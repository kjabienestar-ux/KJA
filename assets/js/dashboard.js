/* KJA · Portal personal — sin framework, sesión Supabase + RPC protegidas. */
const SUPABASE_URL = 'https://xadxmfgdxwplmhijagix.supabase.co';
const SUPABASE_ANON = 'sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub';
const AUTH_KEY = 'kja-dashboard-auth';
const DEADLINE_KEY = 'kja-dashboard-vence';
const SHELL_KEY = 'kja-dashboard-shell';
const PROFILE_BUCKET = 'perfil-fotos';
const PROFILE_MAX_SOURCE = 3 * 1024 * 1024;
const PROFILE_MAX_STORED = 480 * 1024;
const PROFILE_AVATAR_IDS = ['side-avatar','mobile-avatar','rail-avatar','mobile-home-avatar','profile-avatar'];
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

let APP = { inicio:null, historial:null, teamPeople:[], year:0, month:0, view:'inicio', sessionTimer:null, avatar:{path:'',url:'',busy:false}, identity:{nivel:'miembro',hasPersonal:false,isLeader:false,isSystem:false}, access:{rol:'visor',acceso_panel:false}, adminSection:'overview', adminList:null, adminListRequest:0, adminTeam:null, adminTeamRequest:0, adminMonth:null, adminMonthKey:'', adminMonthRequest:0, adminAccess:null, adminAccessRequest:0, adminRoles:null, adminRolesRequest:0 };
let EVIDENCE = null;

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

function switchLogin(admin,focusField=true){
  $('tab-colab').classList.toggle('active',!admin); $('tab-admin').classList.toggle('active',admin);
  $('tab-colab').setAttribute('aria-selected',String(!admin)); $('tab-admin').setAttribute('aria-selected',String(admin));
  $('tab-colab').tabIndex=admin?-1:0; $('tab-admin').tabIndex=admin?0:-1;
  $('form-colab').hidden=admin; $('form-admin').hidden=!admin;
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
  clearInterval(APP.sessionTimer); localStorage.removeItem(DEADLINE_KEY); localStorage.removeItem(SHELL_KEY);
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
  $('day-mode').textContent=({virtual:'Trabajo virtual',presencial:'Trabajo presencial',opcional:'Horario opcional',no_gestiona:'No gestiona'}[d.modalidad]||cap(d.modalidad||'Sin modalidad'));
  $('day-window').textContent=d.tolerancia!=null?`Tolerancia: ${d.tolerancia} min`:'Horario registrado';
  $('rail-area').textContent=c.area||'Equipo KJA';
  renderRailSchedule(d);
  positionNow(d);
  const pill=$('day-status'),btn=$('open-mark'); pill.className='status-pill'; btn.disabled=false;
  if(d.marcado){
    const label={P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestionó'}[d.estado]||'Registrado';
    pill.textContent=label; pill.classList.add(d.estado==='T'?'late':d.estado==='NG'?'closed':'ok'); btn.disabled=true;
    $('mark-label').textContent=`Marcado${d.marcado_at?' · '+new Date(d.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):''}`;
    $('mark-help').textContent='El registro ya forma parte de tu historial.';
  }else if(!d.labora){ pill.textContent='Día no laborable'; pill.classList.add('closed'); btn.disabled=true; $('mark-label').textContent='Hoy no te corresponde marcar'; $('mark-help').textContent='Tu horario indica que hoy no gestionas.'; }
  else if(d.ventana==='antes'){ pill.textContent='Aún no abre'; btn.disabled=true; $('mark-label').textContent=`Disponible desde las ${fmtTime(d.hora_entrada)}`; $('mark-help').textContent='El botón se habilita al comenzar tu jornada.'; }
  else if(d.ventana==='cerrada'){ pill.textContent='Ventana cerrada'; pill.classList.add('closed'); btn.disabled=true; $('mark-label').textContent='Horario de marcado finalizado'; $('mark-help').textContent='Si tu horario cambió, comunícalo a Dirección.'; }
  else{ pill.textContent=d.ventana==='tardanza'?'Tardanza':'Pendiente'; if(d.ventana==='tardanza') pill.classList.add('late'); $('mark-label').textContent='Marcar mi asistencia'; $('mark-help').textContent='La hora se registra directamente desde el servidor.'; }
  const mobileStatus=$('mobile-today-status'),mobileMark=$('mobile-action-mark');
  mobileStatus.className='mobile-today-status';
  mobileStatus.textContent=pill.textContent;
  if(pill.classList.contains('ok'))mobileStatus.classList.add('ok');
  if(pill.classList.contains('late'))mobileStatus.classList.add('late');
  if(pill.classList.contains('closed'))mobileStatus.classList.add('closed');
  mobileMark.disabled=btn.disabled;
  $('mobile-action-mark-title').textContent=d.marcado?'Asistencia registrada':btn.disabled?'Marcado no disponible':'Marcar asistencia';
  $('mobile-action-mark-note').textContent=d.marcado?$('mark-label').textContent:btn.disabled?pill.textContent:'Registrar ahora';
  $('mobile-today-detail').textContent=`${$('day-mode').textContent} · ${$('mark-help').textContent}`;
}

function minutes(t){ if(!t) return null; const [h,m]=String(t).split(':').map(Number); return h*60+m; }
function positionNow(d){ const start=minutes(d.hora_entrada),end=minutes(d.hora_salida),now=minutes(d.ahora); let pct=50; if(start!=null&&end!=null&&end>start&&now!=null) pct=Math.max(0,Math.min(100,(now-start)/(end-start)*100)); $('now-marker').style.left=pct+'%'; document.querySelector('.rail>i').style.width=pct+'%'; }

function renderRailSchedule(d){
  const marked=d.marcado?`Registrado · ${d.marcado_at?new Date(d.marcado_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):statusLabel(d.estado,true)}`:(d.labora?'Pendiente de registro':'Día no laborable');
  const mode=({virtual:'Virtual',presencial:'Presencial',opcional:'Opcional',no_gestiona:'No gestiona'}[d.modalidad]||cap(d.modalidad||'Sin modalidad'));
  $('rail-schedule-list').innerHTML=`
    <article class="rail-event primary-event"><time>${esc(fmtTime(d.hora_entrada))}</time><span><b>Inicio de jornada</b><small>${esc(mode)}</small></span></article>
    <article class="rail-event ${d.marcado?'event-done':'event-pending'}"><time>${d.marcado?'✓':'···'}</time><span><b>Asistencia</b><small>${esc(marked)}</small></span></article>
    <article class="rail-event end-event"><time>${esc(fmtTime(d.hora_salida))}</time><span><b>Cierre de jornada</b><small>Horario registrado</small></span></article>`;
}

async function loadHistory(){
  const {data,error}=await db.rpc('dash_historial',{p_anio:APP.year,p_mes:APP.month});
  if(error||!data?.ok){ toast('No se pudo cargar el historial.',true); return; }
  APP.historial=data; renderHistory(); renderProgress(); renderWeek();
}

function renderProgress(){
  const h=APP.historial;if(!h)return; const done=Number(h.horas)||0,goal=Number(h.meta)||0,pct=goal?Math.min(100,done/goal*100):0;
  $('hours-done').textContent=done.toFixed(done%1?1:0); $('hours-goal').textContent=goal||'—'; $('hours-bar').style.transform=`scaleX(${pct/100})`;
  $('hours-note').textContent=goal?`${pct.toFixed(0)}% completado · ${Math.max(0,goal-done).toFixed(1)} h pendientes`:'Aún no hay una meta de horas configurada.';
  const t=h.totales||{},att=(t.P||0)+(t.T||0)+(t.J||0),rate=t.laborables?Math.round(att/t.laborables*100):0;
  $('month-rate').textContent=t.laborables?rate+'%':'—'; $('month-note').textContent=`${att} de ${t.laborables||0} días laborables`;
  $('rail-rate').textContent=t.laborables?rate+'%':'—'; $('rail-rate-note').textContent=`${att} de ${t.laborables||0} días registrados`;
}

function renderHistory(){
  const h=APP.historial;if(!h)return; $('month-title').textContent=cap(`${monthNames[h.mes-1]} ${h.anio}`);
  const t=h.totales||{},items=[['Presentes',t.P||0],['Tardanzas',t.T||0],['Justificados',t.J||0],['No gestionó',t.NG||0],['Horas acumuladas',(Number(h.horas)||0).toFixed(1)+' h']];
  $('attendance-stats').innerHTML=items.map(x=>`<div class="att-stat"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join('');
  const first=new Date(h.anio,h.mes-1,1).getDay(),offset=(first+6)%7; let html='<span class="cal-day empty"></span>'.repeat(offset);
  for(const d of h.dias||[]){ const cls=(d.estado||'').toLowerCase(); html+=`<span class="cal-day ${cls} ${d.futuro?'future':''} ${!d.lab?'off':''} ${d.fecha===h.hoy?'today':''}" title="${esc(statusLabel(d.estado,d.lab))}"><b>${d.d}</b><i></i></span>`; }
  $('calendar-grid').innerHTML=html;
  renderRailCalendar(h);
  $('month-next').disabled=h.anio===new Date().getFullYear()&&h.mes===new Date().getMonth()+1;
}
function statusLabel(state,lab){ return state?({P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestionó'}[state]||state):(lab?'Sin registro':'No laborable'); }

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

function renderWeek(){
  const h=APP.historial;if(!h)return; const today=new Date(h.hoy+'T12:00:00'),monday=new Date(today); monday.setDate(today.getDate()-((today.getDay()+6)%7));
  const map=new Map((h.dias||[]).map(d=>[d.fecha,d])); let html='';
  for(let i=0;i<7;i++){ const dt=new Date(monday);dt.setDate(monday.getDate()+i);const iso=dt.toISOString().slice(0,10),d=map.get(iso)||{};html+=`<div class="week-day ${(d.estado||'').toLowerCase()} ${iso===h.hoy?'today':''}"><small>${shortDays[dt.getDay()]}</small><b>${dt.getDate()}</b><i></i></div>`; }
  $('week-days').innerHTML=html;
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
  const [peopleRes,marksRes,requestsRes]=await Promise.all([
    db.from('asis_colaboradores').select('id,nombre,area_id,asis_areas(nombre)').eq('activo',true).order('nombre'),
    db.from('asis_registros').select('colaborador_id,estado,marcado_at,origen').eq('fecha',today),
    db.from('asis_solicitudes_horario').select('id,colaborador_id,horario_nuevo,creado_at').eq('estado','pendiente').order('creado_at',{ascending:false})
  ]);
  btn.disabled=false;
  if(peopleRes.error||marksRes.error){
    $('admin-status-list').innerHTML='<p class="admin-empty">No se pudo cargar el estado operativo. Actualiza nuevamente.</p>';
    toast('No se pudo actualizar la administración.',true); return;
  }
  const people=peopleRes.data||[],marks=marksRes.data||[],requests=requestsRes.data||[];
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

  $('admin-request-count').textContent=requests.length;
  $('admin-request-list').innerHTML=requests.length?requests.slice(0,5).map(req=>{
    const person=byPerson.get(String(req.colaborador_id));
    const created=req.creado_at?new Date(req.creado_at).toLocaleDateString('es-PE',{day:'2-digit',month:'short',timeZone:'America/Lima'}):'—';
    return `<div class="admin-request"><b>${esc(person?.nombre||'Colaborador')}</b><small>${esc(created)}</small><p>${esc(req.horario_nuevo||'Sin detalle')}</p></div>`;
  }).join(''):'<p class="admin-empty">No hay solicitudes pendientes.</p>';
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

async function openAdminEvidence(path){
  if(!path)return;
  const popup=window.open('about:blank','_blank');
  try{
    const {data,error}=await db.storage.from('asis-evidencias').createSignedUrl(path,3600);
    if(error||!data?.signedUrl)throw error||new Error('url');
    if(popup){popup.opener=null;popup.location.replace(data.signedUrl)}
    else window.open(data.signedUrl,'_blank','noopener');
  }catch(error){
    if(popup)popup.close();
    adminListMsg('No se pudo abrir la evidencia. Actualiza e inténtalo nuevamente.');
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
  if(view==='equipo'&&!APP.identity.isLeader){toast('Mi equipo está reservado al líder técnico del área.',true);return;}
  paintShell(view);
  if(matchMedia('(max-width:900px)').matches)window.scrollTo(0,0);
  closeMenu(); if(view==='equipo')return loadTeam(); if(view==='gestion')return showAdminSection(APP.adminSection);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>goView(b.dataset.view)); document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goView(b.dataset.go));
document.querySelectorAll('[data-mobile-action]').forEach(button=>button.onclick=()=>{
  const action=button.dataset.mobileAction;
  if(['asistencia','perfil','equipo','gestion'].includes(action))return goView(action);
  if(action==='marcar')return openMarkModal();
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
$('rail-calendar-open').onclick=()=>goView('asistencia');
$('admin-refresh').onclick=()=>APP.adminSection==='lista'?loadAdminAttendance():(APP.adminSection==='mes'||APP.adminSection==='resumen')&&typeof loadAdminMonth==='function'?loadAdminMonth(true):APP.adminSection==='marcado'&&typeof loadAdminAccess==='function'?loadAdminAccess():APP.adminSection==='roles'&&typeof loadAdminRoles==='function'?loadAdminRoles():(APP.adminSection==='colaboradores'||APP.adminSection==='contratos')&&typeof loadAdminTeam==='function'?loadAdminTeam():loadAdminHub();
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

function openMenu(){ $('sidebar').classList.add('open');$('side-scrim').classList.add('show'); } function closeMenu(){ $('sidebar').classList.remove('open');$('side-scrim').classList.remove('show'); }
$('menu-toggle').onclick=openMenu;$('side-scrim').onclick=closeMenu;
$('mobile-back-home').onclick=()=>goView('inicio');

// ── Evidencia y marcado ──────────────────────────────────────────────
function openMarkModal(){ if($('open-mark').disabled)return; clearEvidence(); const d=APP.inicio.dia||{},virtual=(d.modalidad||'virtual')==='virtual'; $('evidence-copy').textContent=virtual?'Adjunta una captura del Zoom donde se vea tu nombre.':'Adjunta una fotografía de tu llegada al consultorio.'; $('evidence-title').textContent=virtual?'Captura de tu reunión':'Foto de tu llegada'; $('mark-modal').hidden=false; document.body.style.overflow='hidden'; }
$('open-mark').onclick=openMarkModal;
document.querySelectorAll('[data-close-mark]').forEach(x=>x.onclick=closeMark); function closeMark(){ if($('confirm-mark').disabled)return;$('mark-modal').hidden=true;document.body.style.overflow='';clearEvidence(); }
$('take-photo').onclick=()=>$('evidence-camera').click();$('choose-photo').onclick=()=>$('evidence-file').click();$('evidence-preview').onclick=()=>$('evidence-camera').click();
$('evidence-camera').onchange=e=>chooseEvidence(e.target.files[0],'camara');$('evidence-file').onchange=e=>chooseEvidence(e.target.files[0],'archivo');

function clearEvidence(){ if(EVIDENCE?.url)URL.revokeObjectURL(EVIDENCE.url);EVIDENCE=null;$('evidence-empty').hidden=false;$('evidence-preview').hidden=true;$('evidence-image').removeAttribute('src');$('evidence-camera').value='';$('evidence-file').value='';markMsg(''); }
async function chooseEvidence(file,origin){
  if(!file)return;if(file.size>25*1024*1024)return markMsg('La imagen supera 25 MB. Toma otra foto o elige una más pequeña.');
  try{ markMsg('');const blob=await compressImage(file);const url=URL.createObjectURL(blob);EVIDENCE={blob,url,origin,type:'image/jpeg',ext:'jpg'};$('evidence-image').src=url;$('evidence-size').textContent=`${Math.max(1,Math.round(blob.size/1024))} KB · tocar para cambiar`;$('evidence-empty').hidden=true;$('evidence-preview').hidden=false; }catch(e){markMsg('No se pudo leer la imagen. Prueba con un archivo JPG o PNG.');}
}
function compressImage(file){ return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,1280/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);URL.revokeObjectURL(img.src);const attempt=q=>c.toBlob(b=>{if(!b)return reject();if(b.size>180*1024&&q>.38)return attempt(q-.1);resolve(b)},'image/jpeg',q);attempt(.82)};img.onerror=reject;img.src=URL.createObjectURL(file)}); }
function stamp(blob,text){ return new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);URL.revokeObjectURL(img.src);const bar=Math.max(28,Math.round(img.height*.06)),font=Math.round(bar*.42);x.fillStyle='rgba(5,23,50,.82)';x.fillRect(0,img.height-bar,img.width,bar);x.fillStyle='#fff';x.font=`600 ${font}px Poppins, sans-serif`;x.textBaseline='middle';x.fillText(text,Math.round(bar*.35),img.height-bar/2,img.width-bar);c.toBlob(b=>resolve(b||blob),'image/jpeg',.82)};img.onerror=()=>resolve(blob);img.src=URL.createObjectURL(blob)}); }
function geolocation(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);let done=false;const end=x=>{if(!done){done=true;resolve(x)}};navigator.geolocation.getCurrentPosition(p=>end({lat:+p.coords.latitude.toFixed(6),lon:+p.coords.longitude.toFixed(6)}),()=>end(null),{enableHighAccuracy:true,timeout:6000,maximumAge:60000});setTimeout(()=>end(null),6500)});}
async function uploadEvidence(){
  const {data:{session}}=await db.auth.getSession();if(!session)throw new Error('sesion');
  const r=await fetch(SUPABASE_URL+'/functions/v1/dash-evidencia',{method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({ext:EVIDENCE.ext})});
  const permit=await r.json().catch(()=>null);if(!r.ok||!permit?.ok){const e=new Error(permit?.motivo||'permiso');e.motivo=permit?.motivo;throw e;}
  const at=new Date(permit.servidor_at),seal=`${permit.nombre} · ${at.toLocaleDateString('es-PE',{timeZone:'America/Lima'})} · ${at.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'})} · KJA`,blob=await stamp(EVIDENCE.blob,seal);
  const {error}=await db.storage.from('asis-evidencias').uploadToSignedUrl(permit.ruta,permit.token,blob,{contentType:'image/jpeg'});if(error)throw error;return permit.ruta;
}

$('confirm-mark').onclick=async()=>{
  const required=!!APP.inicio.exigir_evidencia;if(required&&!EVIDENCE)return markMsg('Adjunta la evidencia antes de registrar tu asistencia.');
  const btn=$('confirm-mark');setBusy(btn,true,'Registrando…');markMsg('');
  try{
    const geo=await geolocation();let path=null;if(EVIDENCE){markMsg('Subiendo tu evidencia…');path=await uploadEvidence();}
    markMsg('Guardando la hora del servidor…');
    const {data,error}=await db.rpc('dash_marcar',{p_disp:(navigator.userAgent||'').slice(0,80),p_foto:path,p_foto_org:EVIDENCE?.origin||null,p_lat:geo?.lat||null,p_lon:geo?.lon||null});
    if(error)throw error;if(!data?.ok){const e=new Error(data?.motivo||'registro');e.motivo=data?.motivo;throw e;}
    $('mark-modal').hidden=true;document.body.style.overflow='';clearEvidence();toast(data.estado==='T'?'Asistencia registrada como tardanza.':'Asistencia registrada correctamente.');
    const {data:fresh}=await db.rpc('dash_inicio');if(fresh?.ok){APP.inicio=fresh;renderHome();renderProfile();await loadHistory();}
  }catch(e){ const messages={sesion:'Tu sesión venció. Vuelve a ingresar.',fuera_ventana:'Tu ventana de marcado ya no está disponible.',ya_marcado:'Tu asistencia ya estaba registrada.',falta_evidencia:'La evidencia no llegó al servidor.',no_labora:'Hoy no figura como día laborable.'};markMsg(messages[e.motivo]||'No se pudo completar el registro. Revisa tu conexión e inténtalo otra vez.'); }
  finally{setBusy(btn,false,'');}
};

db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!$('portal').hidden&&$('portal').dataset.loading!=='true')location.reload()});
init().catch(()=>showAccess('No se pudo iniciar el portal. Recarga la página.'));
