let CERT_ACCOUNTS={rows:[],collaborators:[],linksReady:false,busy:false,loaded:false,request:0};
function certAccountsAllowed(){return APP.identity.isSystem&&APP.access.rol==='direccion'&&APP.access.acceso_panel;}
function certAccountsMessage(message){$('cert-accounts-message').textContent=message||'';}
async function loadCertificateAccounts(){
 if(!certAccountsAllowed()||CERT_ACCOUNTS.busy)return;
 const request=++CERT_ACCOUNTS.request;CERT_ACCOUNTS.loaded=false;
 $('cert-account-list').innerHTML='<p class="cert-account-empty">Cargando cuentas…</p>';certAccountsMessage('');
 try{
  const [{data,error},links]=await Promise.all([db.rpc('dash_cert_cuentas'),db.rpc('dash_cert_colaboradores')]);
  if(request!==CERT_ACCOUNTS.request||!certAccountsAllowed())return;
  if(error||!data?.ok)throw Error(error?.code==='PGRST202'?'Falta activar la gestión de cuentas en Supabase. Ejecuta dashboard_100_cuentas_certificados.sql.':'No se pudieron cargar las cuentas. Revisa tus permisos y actualiza.');
  CERT_ACCOUNTS.rows=data.cuentas||[];CERT_ACCOUNTS.collaborators=links.data?.colaboradores||[];CERT_ACCOUNTS.linksReady=!links.error&&!!links.data?.ok;CERT_ACCOUNTS.loaded=true;renderCertificateAccounts();
 }catch(error){CERT_ACCOUNTS.rows=[];$('cert-account-list').innerHTML='';certAccountsMessage(error.message);}
}
function renderCertificateAccounts(){
 const query=$('cert-account-search').value.trim().toLocaleLowerCase('es');
 const includeSuspended=$('cert-account-show-suspended').checked;
 const rows=CERT_ACCOUNTS.rows.filter(p=>(p.activo||includeSuspended)&&`${p.nombre} ${p.email}`.toLocaleLowerCase('es').includes(query));
 $('cert-account-count').textContent=`${rows.length} de ${CERT_ACCOUNTS.rows.length} cuentas`;
 updateCertificateStats();
 $('cert-account-list').innerHTML=rows.map(p=>{
  const initials=String(p.nombre||'').trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]||'').join('').toLocaleUpperCase('es');
  return `<article class="cert-account-row ${p.activo?'':'is-suspended'}"><div class="cert-account-identity"><span class="cert-account-avatar" aria-hidden="true">${esc(initials)}</span><div class="cert-account-person"><h3>${esc(p.nombre)}</h3><p>${esc(p.email||'Sin correo')}</p></div><div class="cert-account-more-wrap"><button type="button" class="cert-account-more-btn" data-cert-more="${esc(p.id)}" aria-label="Más opciones para ${esc(p.nombre)}" title="Más opciones"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="1.8"/><circle cx="5" cy="12" r="1.8"/><circle cx="19" cy="1.8" r="1.8"/></svg></button><div class="cert-account-menu" id="cert-menu-${esc(p.id)}" hidden><button type="button" data-cert-action="recovery" data-cert-id="${esc(p.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/></svg>Enviar correo de recuperación</button><button type="button" data-cert-copy-email="${esc(p.email||'')}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar correo</button></div></div></div><div class="cert-account-meta"><span class="cert-account-state ${p.activo?'':'suspended'}"><span class="cert-status-dot" aria-hidden="true"></span>${p.activo?'Acceso activo':'Suspendido · sin plazo'}</span><span class="cert-role-tag"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>${p.rol==='admin'?'Administrador':'Colaborador'}</span></span><span class="cert-account-series">${p.serie==null?'Sin serie':`Serie ${esc(p.serie)}`}</span></div><div class="cert-account-actions"><button type="button" class="cert-btn-edit" data-cert-action="edit" data-cert-id="${esc(p.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg><span>Editar</span></button><button type="button" class="cert-btn-password" data-cert-action="password" data-cert-id="${esc(p.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Cambiar contraseña</span></button><button type="button" class="cert-btn-toggle ${p.activo?'cert-danger':'cert-reactivate'}" data-cert-action="status" data-cert-id="${esc(p.id)}">${p.activo?`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Suspender</span>`:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span>Reactivar</span>`}</button></div></article>`;
 }).join('')||'<p class="cert-account-empty">No hay cuentas visibles con estos filtros. Puedes cambiar la búsqueda o marcar «Mostrar usuarios suspendidos».</p>';
}
function updateCertificateStats(){
 const rows=CERT_ACCOUNTS.rows||[];
 const total=rows.length;
 const active=rows.filter(p=>p.activo).length;
 const suspended=rows.filter(p=>!p.activo).length;
 const seriesTotal=rows.filter(p=>p.serie!=null).reduce((sum,p)=>sum+(Number(p.serie)||0),0);
 const collabs=rows.filter(p=>p.rol==='colaborador'||p.colaborador_id!=null).length||total;
 const activeVal=$('cert-stat-active-val');if(activeVal)activeVal.textContent=String(active);
 const activeSub=$('cert-stat-active-sub');if(activeSub)activeSub.textContent=`de ${total} cuentas`;
 const suspVal=$('cert-stat-suspended-val');if(suspVal)suspVal.textContent=String(suspended);
 const suspSub=$('cert-stat-suspended-sub');if(suspSub)suspSub.textContent=`de ${total} cuentas`;
 const seriesVal=$('cert-stat-series-val');if(seriesVal)seriesVal.textContent=seriesTotal.toLocaleString('en-US');
 const collabVal=$('cert-stat-collab-val');if(collabVal)collabVal.textContent=String(collabs);
}
function openCertificateAccount(person=null){
 if(CERT_ACCOUNTS.busy||!certAccountsAllowed())return;
 $('cert-password-form').reset();$('cert-password-form').hidden=true;
 $('cert-account-form').reset();$('cert-account-id').value=person?.id||'';
 $('cert-account-form-title').textContent=person?'Editar cuenta':'Nueva cuenta';$('cert-account-save').textContent=person?'Guardar cambios':'Crear cuenta';
 $('cert-account-name').value=person?.nombre||'';$('cert-account-email').value=person?.email||'';$('cert-account-email').disabled=!!person;
 $('cert-account-role').value=person?.rol||'colaborador';$('cert-account-series').value=person?.serie??'';
 $('cert-account-password-field').hidden=!!person;$('cert-account-password').required=false;
 $('cert-collaborator-search').value='';
 fillCertificateCollaborators(person?.colaborador_id==null?'':String(person.colaborador_id));
 applyCertificateCollaborator(false);
 fillCertificateSeries();
 $('cert-account-form-message').textContent='';$('cert-account-form').hidden=false;$('cert-account-name').focus();
}
function fillCertificateCollaborators(selected=$('cert-collaborator').value){
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const terms=normalize($('cert-collaborator-search').value).trim().split(/\s+/).filter(Boolean),account=$('cert-account-id').value;
 const candidates=(CERT_ACCOUNTS.collaborators||[]).filter(p=>(p.activo||String(p.id)===selected)&&terms.every(term=>normalize(`${p.nombre} ${p.dni||''} ${p.area||''}`).includes(term)));
 $('cert-collaborator-count').textContent=CERT_ACCOUNTS.linksReady?`${candidates.length} resultado${candidates.length===1?'':'s'}`:'Directorio no disponible';
 $('cert-collaborator-results').innerHTML=CERT_ACCOUNTS.linksReady?(candidates.map(p=>{
  const taken=p.cuenta_id&&p.cuenta_id!==account;
  const initials=String(p.nombre||'').trim().split(/\s+/).slice(0,2).map(w=>Array.from(w)[0]||'').join('').toLocaleUpperCase('es');
  return `<button type="button" class="cert-link-option" data-cert-collaborator="${esc(p.id)}" aria-pressed="${String(p.id)===selected}" ${taken?'disabled':''}><span class="cert-link-initials" aria-hidden="true">${esc(initials)}</span><span class="cert-link-option-copy"><strong>${esc(p.nombre)}</strong><small>DNI ${esc(p.dni||'sin registrar')} · ${esc(p.area||'Sin área')}</small></span><span class="cert-link-option-state">${taken?'Ya vinculado':String(p.id)===selected?'Seleccionado':'Elegir'}</span></button>`;
 }).join('')||'<p class="cert-link-empty">No hay coincidencias. Prueba con otro nombre, DNI o área.</p>'):'<p class="cert-link-empty">Actualiza el directorio después de instalar la migración 101.</p>';
 $('cert-collaborator').value=selected;
 $('cert-collaborator').disabled=!CERT_ACCOUNTS.linksReady;
 $('cert-collaborator-search').disabled=!CERT_ACCOUNTS.linksReady;
 $('cert-collaborator-clear').hidden=!selected;
}
function applyCertificateCollaborator(clearName=true){
 const selected=$('cert-collaborator').value;
 const person=(CERT_ACCOUNTS.collaborators||[]).find(p=>String(p.id)===selected);
 $('cert-account-name').readOnly=!!person;
 if(person){
  $('cert-account-name').value=person.nombre;
  if(!$('cert-account-id').value)$('cert-account-role').value='colaborador';
  $('cert-collaborator-detail').textContent=`Vinculado: ${person.nombre} · DNI: ${person.dni||'sin registrar'} · Área: ${person.area||'Sin área'}. Completa el correo, contraseña y serie. Su acceso a asistencia se conserva.`;
 }else{
  if(clearName&&!$('cert-account-id').value)$('cert-account-name').value='';
  $('cert-collaborator-detail').textContent=CERT_ACCOUNTS.linksReady?'Cuenta independiente: puedes completar los datos manualmente.':'Para vincular colaboradores, ejecuta dashboard_101_vincular_cuentas_certificados.sql y actualiza la lista.';
 }
}
function fillCertificateSeries(){
 const id=$('cert-account-id').value;
 const used=new Set(CERT_ACCOUNTS.rows.filter(p=>p.id!==id&&p.serie!=null).map(p=>Number(p.serie)));
 const free=[];for(let n=1000;free.length<8&&n<=2147482000;n+=1000)if(!used.has(n))free.push(n);
 $('cert-series-options').innerHTML=free.map(n=>`<option value="${n}">${n}–${n+999}</option>`).join('');
 $('cert-series-help').textContent=`Disponibles según el directorio: ${free.join(', ')}. Las series de suspendidos siguen reservadas. Se valida nuevamente al guardar.`;
}
function certAccountsBusy(busy){
 CERT_ACCOUNTS.busy=busy;
 $('view-cert-cuentas').querySelectorAll('button,input,select').forEach(el=>el.disabled=busy);
 if(!busy){
  $('cert-account-email').disabled=!!$('cert-account-id').value;
  $('cert-collaborator').disabled=!CERT_ACCOUNTS.linksReady;$('cert-collaborator-search').disabled=!CERT_ACCOUNTS.linksReady;
  fillCertificateCollaborators();
 }
 $('view-cert-cuentas').setAttribute('aria-busy',String(busy));
}
async function certificateAccountEdge(body){
 const {data,error}=await db.functions.invoke('cert-cuentas',{body});
 if(error){let message='No se pudo completar la operación. Comprueba que cert-cuentas esté desplegada.';
  try{message=(await error.context.json()).error||message;}catch{}
  throw Error(message);
 }
 if(!data?.ok)throw Error(data?.error||'No se recibió confirmación del servidor.');return data;
}
async function saveCertificateProfile(person){
 const values={p_id:person.id,p_nombre:person.nombre,p_rol:person.rol,p_serie:person.serie,p_activo:person.activo};
 const {data,error}=CERT_ACCOUNTS.linksReady?await db.rpc('dash_cert_guardar_vinculado',{...values,p_colaborador:person.colaborador_id??null}):await db.rpc('dash_cert_guardar',values);
 if(error||!data?.ok)throw Error(error?.message||'No se pudo guardar la cuenta.');
}
$('cert-account-form').addEventListener('submit',async event=>{
 event.preventDefault();if(CERT_ACCOUNTS.busy||!certAccountsAllowed())return;
 const id=$('cert-account-id').value,person=CERT_ACCOUNTS.rows.find(p=>p.id===id);
 const values={id,nombre:$('cert-account-name').value.trim(),rol:$('cert-account-role').value,serie:$('cert-account-series').value===''?null:Number($('cert-account-series').value),activo:person?.activo??true};
 values.colaborador_id=CERT_ACCOUNTS.linksReady?($('cert-collaborator').value?Number($('cert-collaborator').value):null):(person?.colaborador_id??null);
 if(id&&!person){$('cert-account-form-message').textContent='Actualiza la lista antes de editar.';return;}
 certAccountsBusy(true);$('cert-account-form-message').textContent='Guardando…';
 try{
  if(id)await saveCertificateProfile(values);
  else await certificateAccountEdge({action:'create',...values,email:$('cert-account-email').value.trim(),password:$('cert-account-password').value});
  $('cert-account-form').hidden=true;$('cert-account-password').value='';certAccountsBusy(false);
  await loadCertificateAccounts();toast(id?'Cuenta actualizada.':'Cuenta configurada.');
 }catch(error){$('cert-account-form-message').textContent=error.message;}
 finally{certAccountsBusy(false);}
});
$('cert-account-list').addEventListener('click',async event=>{
 const moreBtn=event.target.closest('[data-cert-more]');
 if(moreBtn){
  event.stopPropagation();
  const menu=$(`cert-menu-${moreBtn.dataset.certMore}`);
  const wasOpen=!menu?.hidden;
  document.querySelectorAll('.cert-account-menu').forEach(m=>m.hidden=true);
  if(menu)menu.hidden=wasOpen;
  return;
 }
 const copyBtn=event.target.closest('[data-cert-copy-email]');
 if(copyBtn){
  event.stopPropagation();
  document.querySelectorAll('.cert-account-menu').forEach(m=>m.hidden=true);
  const email=copyBtn.dataset.certCopyEmail;
  if(email){
   try{await navigator.clipboard.writeText(email);toast('Correo copiado.');}
   catch{toast(email);}
  }
  return;
 }
 if(typeof document!=='undefined')document.querySelectorAll('.cert-account-menu').forEach(m=>m.hidden=true);
 const button=event.target.closest('[data-cert-action]');if(!button||CERT_ACCOUNTS.busy||!certAccountsAllowed())return;
 const person=CERT_ACCOUNTS.rows.find(p=>p.id===button.dataset.certId);if(!person)return;
 const action=button.dataset.certAction;if(action==='edit')return openCertificateAccount(person);
 if(action==='password'){
  $('cert-account-form').hidden=true;$('cert-account-password').value='';
  $('cert-password-form').reset();$('cert-password-id').value=person.id;
  $('cert-password-person').textContent=`${person.nombre} · ${person.email}`;
  $('cert-password-message').textContent='';$('cert-password-form').hidden=false;
  $('cert-password-new').focus();return;
 }
 let ok=false;
 if(action==='recovery'){
  ok=await confirmCertModal({
   title:'¿Enviar correo de recuperación?',
   desc:`Se enviará un correo a ${person.email}. La contraseña corresponde a su cuenta de acceso compartida con otros módulos.`,
   confirmText:'Enviar correo',
   cancelText:'Cancelar',
   tone:'primary'
  });
 }else if(person.activo){
  ok=await confirmCertModal({
   title:`¿Suspender el acceso de ${person.nombre}?`,
   desc:'Sus certificados emitidos se conservarán intactos. Podrás reactivar su cuenta en cualquier momento.',
   confirmText:'Suspender acceso',
   cancelText:'Cancelar',
   tone:'danger'
  });
 }else{
  ok=await confirmCertModal({
   title:`¿Reactivar el acceso de ${person.nombre}?`,
   desc:`El colaborador volverá a tener acceso y podrá emitir certificados con su serie asignada.`,
   confirmText:'Reactivar acceso',
   cancelText:'Cancelar',
   tone:'success'
  });
 }
 if(!ok)return;certAccountsBusy(true);certAccountsMessage('Procesando…');
 try{
  if(action==='recovery'){await certificateAccountEdge({action:'recovery',id:person.id});certAccountsMessage('Correo de recuperación enviado.');toast('Correo de recuperación enviado.');}
  else{await saveCertificateProfile({...person,activo:!person.activo});certAccountsBusy(false);await loadCertificateAccounts();toast('Acceso actualizado.');}
 }catch(error){certAccountsMessage(error.message);}finally{certAccountsBusy(false);}
});
if(typeof document!=='undefined'){
 document.addEventListener('click',event=>{
  if(!event.target.closest('.cert-account-more-wrap'))document.querySelectorAll('.cert-account-menu').forEach(m=>m.hidden=true);
 });
}
$('cert-accounts-new').onclick=()=>openCertificateAccount();
$('cert-collaborator-search').addEventListener('input',()=>fillCertificateCollaborators());
$('cert-collaborator').addEventListener('change',()=>applyCertificateCollaborator());
$('cert-collaborator-results').addEventListener('click',event=>{
 const button=event.target.closest('[data-cert-collaborator]');
 if(!button||button.disabled||CERT_ACCOUNTS.busy||!CERT_ACCOUNTS.linksReady)return;
 const id=button.dataset.certCollaborator;
 const person=CERT_ACCOUNTS.collaborators.find(p=>String(p.id)===id);
 if(!person||(person.cuenta_id&&person.cuenta_id!==$('cert-account-id').value))return;
 $('cert-collaborator').value=id;fillCertificateCollaborators();applyCertificateCollaborator();
 $('cert-collaborator-results').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
});
$('cert-collaborator-clear').onclick=()=>{
 if(CERT_ACCOUNTS.busy)return;
 $('cert-collaborator').value='';fillCertificateCollaborators();applyCertificateCollaborator();$('cert-collaborator-search').focus();
};
$('cert-accounts-refresh').onclick=loadCertificateAccounts;
$('cert-account-search').addEventListener('input',()=>{if(CERT_ACCOUNTS.loaded)renderCertificateAccounts();});
$('cert-account-show-suspended').addEventListener('change',()=>{if(CERT_ACCOUNTS.loaded)renderCertificateAccounts();});
$('cert-account-cancel').onclick=()=>{if(CERT_ACCOUNTS.busy)return;$('cert-account-form').hidden=true;$('cert-account-password').value='';$('cert-accounts-new').focus();};
function setCertificatePasswordVisible(visible){
 $('cert-account-password').type=visible?'text':'password';
 $('cert-account-password-toggle').setAttribute('aria-pressed',String(visible));
 $('cert-account-password-toggle').setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');
}
$('cert-account-password-toggle').onclick=()=>setCertificatePasswordVisible($('cert-account-password').type==='password');
$('cert-account-form').addEventListener('reset',()=>setCertificatePasswordVisible(false));
$('cert-password-cancel').onclick=()=>{
 if(CERT_ACCOUNTS.busy)return;
 $('cert-password-form').reset();$('cert-password-form').hidden=true;$('cert-accounts-new').focus();
};
$('cert-password-form').addEventListener('submit',async event=>{
 event.preventDefault();if(CERT_ACCOUNTS.busy||!certAccountsAllowed())return;
 const id=$('cert-password-id').value,password=$('cert-password-new').value;
 const message=$('cert-password-message');
 if(password.length<12||password.length>128){message.textContent='Usa entre 12 y 128 caracteres.';return;}
 if(password!==$('cert-password-repeat').value){message.textContent='Las contraseñas no coinciden.';return;}
 certAccountsBusy(true);message.textContent='Guardando nueva contraseña…';
 try{
  await certificateAccountEdge({action:'password',id,password});
  $('cert-password-form').reset();$('cert-password-form').hidden=true;
  certAccountsMessage('Contraseña actualizada. Comunica la nueva contraseña al usuario.');
  toast('Contraseña actualizada.');
 }catch(error){message.textContent=error.message;}
 finally{certAccountsBusy(false);}
});
function confirmCertModal({title,desc,confirmText='Confirmar',cancelText='Cancelar',tone='danger'}){
 if(typeof document==='undefined')return Promise.resolve(true);
 const modal=typeof $==='function'?$('cert-confirm-modal'):document.getElementById('cert-confirm-modal');
 if(!modal||!modal.querySelector){
  const question=`${title}\n\n${desc}`;
  return Promise.resolve(typeof confirm==='function'?confirm(question):true);
 }
 return new Promise(resolve=>{
  const titleEl=$('cert-confirm-title');
  const descEl=$('cert-confirm-desc');
  const iconWrap=$('cert-confirm-icon-wrap');
  const okBtn=$('cert-confirm-ok');
  const cancelBtn=$('cert-confirm-cancel');
  const backdrop=$('cert-confirm-backdrop');

  if(titleEl)titleEl.textContent=title;
  if(descEl)descEl.textContent=desc;
  if(okBtn){
   okBtn.textContent=confirmText;
   okBtn.className=`cert-confirm-ok cert-tone-${tone}`;
  }
  if(cancelBtn)cancelBtn.textContent=cancelText;

  if(iconWrap){
   iconWrap.className=`cert-confirm-icon-wrap is-${tone}`;
   if(tone==='danger'){
    iconWrap.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
   }else if(tone==='success'){
    iconWrap.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 16 9.5"/></svg>';
   }else{
    iconWrap.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
   }
  }

  modal.hidden=false;
  modal.classList.add('is-open');
  if(okBtn&&typeof okBtn.focus==='function')okBtn.focus();

  function finish(result){
   modal.hidden=true;
   modal.classList.remove('is-open');
   if(okBtn)okBtn.removeEventListener('click',onOk);
   if(cancelBtn)cancelBtn.removeEventListener('click',onCancel);
   if(backdrop)backdrop.removeEventListener('click',onCancel);
   document.removeEventListener('keydown',onKey);
   resolve(result);
  }
  function onOk(){finish(true);}
  function onCancel(){finish(false);}
  function onKey(e){if(e.key==='Escape'){e.preventDefault();finish(false);}}

  if(okBtn)okBtn.addEventListener('click',onOk);
  if(cancelBtn)cancelBtn.addEventListener('click',onCancel);
  if(backdrop)backdrop.addEventListener('click',onCancel);
  document.addEventListener('keydown',onKey);
 });
}
