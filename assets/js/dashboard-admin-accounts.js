/* KJA-037 · La autorización real vive en servidor. Nunca se persisten contraseñas. */
const ADMIN_ACCOUNTS={rows:[],history:[],tab:'activa',busy:false,request:0,dialog:null,trigger:null,timer:null};
const aa=id=>document.getElementById('aa-'+id);
const aaLabels={crear:'Crear administrador',editar:'Editar cuenta',restablecer:'Restablecer contraseña',suspender:'Suspender acceso',reactivar:'Reactivar acceso',archivar:'Archivar cuenta',restaurar:'Restaurar como suspendida',delegar:'Delegar mi rol'};
function aaAllowed(){return APP.access.superadmin===true&&APP.access.acceso_panel;}
function aaMessage(text,bad=false){aa('message').textContent=text||'';aa('message').dataset.bad=String(bad);}
function aaInitials(name){return String(name||'').trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]||'').join('').toLocaleUpperCase('es');}
function aaClearDialog(){aa('form').reset();aa('fields').replaceChildren();aa('dialog-message').textContent='';ADMIN_ACCOUNTS.dialog=null;}
function aaClose(){if(ADMIN_ACCOUNTS.busy)return;aa('dialog').close();aaClearDialog();ADMIN_ACCOUNTS.trigger?.focus();}
function aaReset(){clearInterval(ADMIN_ACCOUNTS.timer);ADMIN_ACCOUNTS.timer=null;ADMIN_ACCOUNTS.request++;ADMIN_ACCOUNTS.rows=[];ADMIN_ACCOUNTS.history=[];ADMIN_ACCOUNTS.busy=false;aa('dialog')?.close();aaClearDialog();['list','guardians','history'].forEach(id=>aa(id).replaceChildren());['new','refresh'].forEach(id=>aa(id).disabled=false);const nav=document.getElementById('nav-admin-cuentas');if(nav)nav.hidden=true;}
async function aaProbe(){
 if(document.hidden||!APP.sessionUid||ADMIN_ACCOUNTS.busy)return;
 const uid=APP.sessionUid;
 const {data,error}=await db.rpc('dash_arranque');
 if(uid!==APP.sessionUid||error)return;
 if(!data?.inicio?.ok||data?.acceso?.acceso_panel!==APP.access.acceso_panel||data?.acceso?.rol!==APP.access.rol){
  aaReset();const session=(await db.auth.getSession()).data?.session;return openPortal(session);
 }
 const allowed=data.acceso?.superadmin===true;
 if(!allowed&&APP.access.superadmin){aaReset();APP.access.superadmin=false;if(APP.view==='admin-cuentas')goView('gestion');}
 else if(allowed){APP.access.superadmin=true;document.getElementById('nav-admin-cuentas').hidden=false;}
}
function aaBootstrap(allowed){
 aaReset();APP.access.superadmin=allowed===true;
 document.getElementById('nav-admin-cuentas').hidden=!aaAllowed();
 if(APP.access.acceso_panel)ADMIN_ACCOUNTS.timer=setInterval(()=>void aaProbe().catch(()=>{}),30000);
}
async function aaLoad(){
 if(!aaAllowed()||ADMIN_ACCOUNTS.busy)return;
 const request=++ADMIN_ACCOUNTS.request,uid=APP.sessionUid;
 aaMessage('');aa('list').setAttribute('aria-busy','true');aa('list').innerHTML='<p class="aa-empty">Cargando cuentas…</p>';
 try{
  const {data,error}=await db.rpc('dash_admin_cuentas');
  if(request!==ADMIN_ACCOUNTS.request||uid!==APP.sessionUid||!aaAllowed())return;
  if(error||!data?.ok){
   if(error?.code==='42501'){aaReset();APP.access.superadmin=false;goView('gestion');}
   throw Error('No se pudieron cargar las cuentas. Comprueba tu acceso y vuelve a actualizar.');
  }
  ADMIN_ACCOUNTS.rows=data.cuentas||[];ADMIN_ACCOUNTS.history=data.historial||[];aaRender();
 }catch(error){if(request!==ADMIN_ACCOUNTS.request)return;ADMIN_ACCOUNTS.rows=[];ADMIN_ACCOUNTS.history=[];aa('guardians').replaceChildren();aa('history').replaceChildren();aa('list').innerHTML='<p class="aa-empty">Las cuentas no están disponibles. Pulsa Actualizar para reintentar.</p>';aaMessage(error.message,true);}
 finally{aa('list').setAttribute('aria-busy','false');}
}
function aaRender(){
 const rows=ADMIN_ACCOUNTS.rows,normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 aa('guardians').innerHTML=rows.filter(p=>p.superadmin).map(p=>`<article class="aa-guardian"><span class="aa-avatar" aria-hidden="true">${esc(aaInitials(p.nombre))}</span><div><b>${esc(p.nombre)}${p.id===APP.sessionUid?' · Tú':''}</b><small>${esc(p.email)}</small></div>${p.id===APP.sessionUid?'<button type="button" data-aa-action="delegar">Delegar mi rol</button>':'<span class="aa-tag">Superadmin</span>'}</article>`).join('');
 aa('count-active').textContent=rows.filter(p=>p.estado==='activa').length;aa('count-other').textContent=rows.filter(p=>p.estado!=='activa').length;
 aa('tab-active').setAttribute('aria-pressed',String(ADMIN_ACCOUNTS.tab==='activa'));aa('tab-other').setAttribute('aria-pressed',String(ADMIN_ACCOUNTS.tab!=='activa'));aa('state-wrap').hidden=ADMIN_ACCOUNTS.tab==='activa';
 const query=normalize(aa('search').value),filtered=rows.filter(p=>(ADMIN_ACCOUNTS.tab==='activa'?p.estado==='activa':p.estado!=='activa'&&(!aa('state').value||p.estado===aa('state').value))&&normalize(p.nombre+' '+p.email).includes(query));
 aa('count').textContent=`${filtered.length} de ${rows.length} cuentas`;
 const button=(action,p,danger=false)=>`<button type="button" data-aa-action="${action}" data-aa-id="${esc(p.id)}" ${danger?'class="aa-danger"':''}>${aaLabels[action]}</button>`;
 aa('list').innerHTML=filtered.map(p=>`<article class="aa-card"><div class="aa-card-head"><span class="aa-avatar" aria-hidden="true">${esc(aaInitials(p.nombre))}</span><div><h3>${esc(p.nombre)}</h3><p>${esc(p.email)}</p></div>${p.superadmin?'<span class="aa-tag">Superadmin</span>':''}</div><div class="aa-card-meta"><span class="aa-state ${esc(p.estado)}">${({activa:'Acceso activo',suspendida:'Suspendida',archivada:'Archivada'})[p.estado]||'Sin acceso'}</span><span class="aa-tag">${({visor:'Visor',editor:'Editor',direccion:'Dirección'})[p.rol]||esc(p.rol)}</span>${p.clave_pendiente?'<span class="aa-state suspendida">Restablecimiento por confirmar</span>':''}</div><div class="aa-card-actions">${p.estado==='activa'?button('editar',p)+button('restablecer',p)+(p.superadmin?'':button('suspender',p,true)):p.estado==='suspendida'?button('reactivar',p)+`<details><summary>Más opciones</summary>${button('archivar',p,true)}</details>`:button('restaurar',p)}</div></article>`).join('')||'<p class="aa-empty">No hay cuentas con estos filtros.</p>';
 aa('history').innerHTML=ADMIN_ACCOUNTS.history.map(h=>{
  const date=new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(h.creado_at));
  return `<div class="aa-history-row"><time>${esc(date)}</time><div><b>${esc(aaLabels[h.accion]||h.accion)} · ${esc(h.cuenta)}</b><small>${esc(h.actor)} · ${esc(h.resultado)}<br>${esc(h.motivo)}</small></div></div>`;
 }).join('')||'<p class="aa-help">Todavía no hay operaciones registradas.</p>';
}
function aaOpen(action,id,trigger){
 if(!aaAllowed()||ADMIN_ACCOUNTS.busy)return;
 const p=ADMIN_ACCOUNTS.rows.find(p=>p.id===id);
 if(!['crear','delegar'].includes(action)&&!p)return;
 aaClearDialog();ADMIN_ACCOUNTS.trigger=trigger||document.activeElement;
 ADMIN_ACCOUNTS.dialog={action,person:p,operation:crypto.randomUUID(),identity:null};
 aa('dialog-title').textContent=aaLabels[action];aa('save').textContent=aaLabels[action];aa('save').className=['suspender','archivar'].includes(action)?'aa-danger':'aa-primary';
 const field=(id,label,type='text',value='',extra='')=>`<label for="aa-${id}">${label}<input id="aa-${id}" type="${type}" value="${esc(value)}" ${extra}></label>`;
 const password=field('password',action==='crear'?'Contraseña inicial':'Nueva contraseña','password','','required minlength="12" maxlength="72" autocomplete="new-password"')+field('repeat','Confirmar contraseña','password','','required minlength="12" maxlength="72" autocomplete="new-password"');
 const role=`<label for="aa-role">Permiso administrativo<select id="aa-role"><option value="visor">Visor · solo lectura</option><option value="editor">Editor</option><option value="direccion">Dirección</option></select></label>`;
 let html='',help=p?`${p.nombre} · ${p.email}`:'Cada persona tendrá su propia cuenta. Crear un administrador no concede el rol de superadmin.';
 if(action==='crear'||action==='editar')html=field('name','Nombre','text',p?.nombre||'','required minlength="2" maxlength="100" autocomplete="off"')+(action==='crear'?field('email','Correo de acceso','email','','required maxlength="254" autocomplete="off"'):'')+role+(action==='crear'?'<button type="button" id="aa-check-email">Comprobar correo</button><div id="aa-identity"></div><div id="aa-password-fields">'+password+'</div>':'');
 if(action==='restablecer'){help+='. La nueva contraseña afectará a todos los módulos que compartan esta cuenta y cerrará sus sesiones anteriores. Entrégala de forma privada al titular.';html=password;}
 if(action==='delegar'){
  help='Tu permiso se transferirá al administrador elegido y tú dejarás de ser superadmin. Siempre permanecerán dos responsables.';
  html='<label for="aa-target">Nuevo superadministrador<select id="aa-target" required><option value="">Seleccionar administrador activo</option>'+ADMIN_ACCOUNTS.rows.filter(p=>p.estado==='activa'&&!p.superadmin&&!p.clave_pendiente).map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)} · ${esc(p.email)}</option>`).join('')+'</select></label>'+field('current-password','Confirma tu contraseña actual','password','','required autocomplete="current-password"');
 }
 if(action==='suspender')help+='. Se retirará su acceso administrativo. Su identidad e historial se conservarán; podrás reactivar el acceso después.';
 if(action==='archivar'){help+='. La cuenta permanecerá sin acceso administrativo y conservará su historial. Podrás restaurarla como suspendida.';html=field('confirm-email','Escribe el correo de la cuenta para confirmar','email','','required autocomplete="off"');}
 if(action==='restaurar')help+='. Volverá a la lista de suspendidas. Reactivarla será un paso separado.';
 if(action==='reactivar')help+='. Recuperará su acceso administrativo al volver a iniciar sesión.';
 html+='<label for="aa-reason">Motivo<textarea id="aa-reason" required minlength="3" maxlength="300" placeholder="Describe brevemente el motivo"></textarea></label>';
 aa('dialog-help').textContent=help;aa('fields').innerHTML=html;if(p&&aa('role'))aa('role').value=p.rol;
 if(aa('check-email'))aa('check-email').onclick=aaCheckEmail;
 if(aa('email'))aa('email').oninput=()=>{ADMIN_ACCOUNTS.dialog.identity=null;aa('identity').replaceChildren();aa('password-fields').hidden=false;aa('password').required=aa('repeat').required=true;};
 aa('dialog').showModal();aa('fields').querySelector('input,select,textarea')?.focus();
}
async function aaEdge(payload){
 const {data,error}=await db.functions.invoke('admin-cuentas',{body:payload});
 if(error){let detail;try{detail=await error.context?.json();}catch{}throw Error(detail?.error||'No se pudo completar la operación. Actualiza la lista antes de reintentar.');}
 if(!data?.ok)throw Error(data?.error||'No se pudo confirmar la operación.');return data;
}
function aaBusy(busy){ADMIN_ACCOUNTS.busy=busy;aa('dialog').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=busy);aa('new').disabled=busy;aa('refresh').disabled=busy;aa('save').textContent=busy?'Procesando…':aaLabels[ADMIN_ACCOUNTS.dialog?.action]||'Guardar';}
async function aaCheckEmail(){
 if(ADMIN_ACCOUNTS.busy||!ADMIN_ACCOUNTS.dialog)return;
 const d=ADMIN_ACCOUNTS.dialog,uid=APP.sessionUid;
 const email=aa('email').value.trim().toLowerCase();if(!aa('email').reportValidity())return;
 aaBusy(true);aa('dialog-message').textContent='';
 try{
  const found=await aaEdge({action:'buscar',email});if(d!==ADMIN_ACCOUNTS.dialog||uid!==APP.sessionUid)return;d.identity={...found,email};
  aa('identity').innerHTML=found.existe?`<div class="aa-identity">${found.tiene_perfil||found.tecnica||!found.confirmada?'<p>Esta identidad ya tiene perfil o no admite incorporación. No se modificará su acceso.</p>':`<p>Ya existe una identidad para ${esc(email)}. Se conservará su contraseña.</p><label class="aa-check"><input id="aa-confirm-existing" type="checkbox" required>He comprobado que esta identidad pertenece a la misma persona.</label>`}</div>`:'<p class="aa-help">Correo disponible para una nueva cuenta.</p>';
  const existing=found.existe;aa('password-fields').hidden=existing;aa('password').value=aa('repeat').value='';aa('password').required=aa('repeat').required=!existing;
 }catch(error){if(d===ADMIN_ACCOUNTS.dialog&&uid===APP.sessionUid)aa('dialog-message').textContent=error.message;}
 finally{if(d===ADMIN_ACCOUNTS.dialog&&uid===APP.sessionUid)aaBusy(false);}
}
async function aaSubmit(event){
 event.preventDefault();if(ADMIN_ACCOUNTS.busy||!aaAllowed()||!ADMIN_ACCOUNTS.dialog)return;
 const uid=APP.sessionUid,generation=ADMIN_ACCOUNTS.request,d=ADMIN_ACCOUNTS.dialog,body={action:d.action,id:d.person?.id,operation:d.operation,motivo:aa('reason').value};
 if(['crear','editar'].includes(d.action)){body.nombre=aa('name').value;body.rol=aa('role').value;}
 if(d.action==='crear'){
  body.email=aa('email').value.trim().toLowerCase();
  if(!d.identity||d.identity.email!==body.email){await aaCheckEmail();aa('dialog-message').textContent='Revisa el correo comprobado y confirma el alta.';return;}
  if(d.identity.existe){if(d.identity.tiene_perfil||d.identity.tecnica||!d.identity.confirmada||!aa('confirm-existing')?.checked){aa('dialog-message').textContent='La identidad no puede incorporarse o falta confirmar que pertenece a la misma persona.';return;}body.confirm_existing=d.identity.id;}
 }
 if(d.action==='restablecer'||(d.action==='crear'&&!d.identity.existe)){
  if(aa('password').value!==aa('repeat').value){aa('dialog-message').textContent='Las contraseñas no coinciden.';aa('repeat').focus();return;}
  if(aa('password').value.length<12||new TextEncoder().encode(aa('password').value).length>72){aa('dialog-message').textContent='Usa al menos 12 caracteres y como máximo 72 bytes.';return;}
  body.password=aa('password').value;
 }
 if(d.action==='archivar')body.confirmar_email=aa('confirm-email').value;
 if(d.action==='delegar'){body.id=aa('target').value;body.current_password=aa('current-password').value;}
 aaBusy(true);aa('dialog-message').textContent='';
 try{
  const result=await aaEdge(body);if(uid!==APP.sessionUid||generation!==ADMIN_ACCOUNTS.request)return;aaBusy(false);aaClose();
  if(result.sign_out)return logout('Contraseña actualizada. Vuelve a iniciar sesión.');
  if(d.action==='delegar'){aaBootstrap(false);goView('gestion');toast('Delegación completada. Tu cuenta conserva su acceso administrativo.');return;}
  if(d.action==='editar'&&d.person.id===APP.sessionUid){await openPortal();toast('Cuenta actualizada.');return;}
  await aaLoad();aaMessage(d.action==='restablecer'?'Contraseña actualizada. El titular debe volver a iniciar sesión.':'Cambio guardado correctamente.');
 }catch(error){if(uid===APP.sessionUid&&generation===ADMIN_ACCOUNTS.request){aa('dialog-message').textContent=error.message;aa('dialog-message').dataset.bad='true';}}
 finally{delete body.password;delete body.current_password;if(uid===APP.sessionUid){['password','repeat','current-password'].forEach(id=>{if(aa(id))aa(id).value='';});aaBusy(false);}}
}
if(typeof document!=='undefined'){
 aa('new').onclick=()=>aaOpen('crear');aa('refresh').onclick=aaLoad;aa('search').oninput=aaRender;aa('state').onchange=aaRender;
 aa('tab-active').onclick=()=>{ADMIN_ACCOUNTS.tab='activa';aaRender();};aa('tab-other').onclick=()=>{ADMIN_ACCOUNTS.tab='otras';aaRender();};
 aa('dialog-close').onclick=aaClose;aa('cancel').onclick=aaClose;aa('form').onsubmit=aaSubmit;
 aa('dialog').addEventListener('cancel',event=>{event.preventDefault();aaClose();});
 ['list','guardians'].forEach(id=>aa(id).addEventListener('click',event=>{const button=event.target.closest('[data-aa-action]');if(button)aaOpen(button.dataset.aaAction,button.dataset.aaId,button);}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof APP!=='undefined'&&APP.access?.acceso_panel)void aaProbe().catch(()=>{});});
 window.KJAAdminAccounts={load:aaLoad,reset:aaReset,bootstrap:aaBootstrap};
}
