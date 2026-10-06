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
 $('cert-account-list').innerHTML=rows.map(p=>{
  const initials=String(p.nombre||'').trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]||'').join('').toLocaleUpperCase('es');
  return `<article class="cert-account-row ${p.activo?'':'is-suspended'}"><div class="cert-account-identity"><span class="cert-account-avatar" aria-hidden="true">${esc(initials)}</span><div class="cert-account-person"><h3>${esc(p.nombre)}</h3><p>${esc(p.email||'Sin correo')}</p></div><svg class="cert-account-emblem" viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="3" width="24" height="20" rx="3"/><path d="M9 9h14M9 13h8"/><circle cx="22" cy="21" r="5"/><path d="m18 25-1 5 5-2 5 2-1-5"/></svg></div><div class="cert-account-meta"><span class="cert-account-state ${p.activo?'':'suspended'}">${p.activo?'Acceso activo':'Suspendido · sin plazo'}</span><span>${p.rol==='admin'?'Administrador':'Colaborador'}</span><span class="cert-account-series">${p.serie==null?'Sin serie':`Serie ${esc(p.serie)}`}</span></div><div class="cert-account-actions"><button type="button" data-cert-action="edit" data-cert-id="${esc(p.id)}">Editar</button><button type="button" data-cert-action="password" data-cert-id="${esc(p.id)}">Cambiar contraseña</button><button type="button" class="${p.activo?'cert-danger':''}" data-cert-action="status" data-cert-id="${esc(p.id)}">${p.activo?'Suspender':'Reactivar'}</button></div></article>`;
 }).join('')||'<p class="cert-account-empty">No hay cuentas visibles con estos filtros. Puedes cambiar la búsqueda o marcar «Mostrar usuarios suspendidos».</p>';
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
 const question=action==='recovery'?`¿Enviar un correo de recuperación a ${person.email}? La contraseña corresponde a su cuenta de acceso compartida con otros módulos.`:`¿${person.activo?'Suspender':'Reactivar'} el acceso a certificados de ${person.nombre}? Sus certificados emitidos se conservarán.`;
 if(!confirm(question))return;certAccountsBusy(true);certAccountsMessage('Procesando…');
 try{
  if(action==='recovery'){await certificateAccountEdge({action:'recovery',id:person.id});certAccountsMessage('Correo de recuperación enviado.');}
  else{await saveCertificateProfile({...person,activo:!person.activo});certAccountsBusy(false);await loadCertificateAccounts();toast('Acceso actualizado.');}
 }catch(error){certAccountsMessage(error.message);}finally{certAccountsBusy(false);}
});
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
