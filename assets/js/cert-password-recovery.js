(()=>{
 const client=supabase.createClient('https://xadxmfgdxwplmhijagix.supabase.co','sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub',{
  auth:{storageKey:'kja-cert-recovery',persistSession:true,detectSessionInUrl:true,flowType:'implicit'}
 });
 const form=document.getElementById('recovery-form'),status=document.getElementById('recovery-status'),button=document.getElementById('recovery-save');
 let ready=false;
 function show(session){ready=!!session;form.hidden=!ready;status.textContent=ready?'Usa al menos 12 caracteres. Esta contraseña será la de tu cuenta KJA.':'El enlace no es válido o ha vencido. Solicita un nuevo correo de recuperación.';}
 client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')show(session);});
 client.auth.getSession().then(({data,error})=>show(error?null:data.session)).catch(()=>show(null));
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!ready||button.disabled)return;
  const password=document.getElementById('recovery-password').value;
  if(password!==document.getElementById('recovery-repeat').value){status.textContent='Las contraseñas no coinciden.';return;}
  button.disabled=true;status.textContent='Guardando…';
  try{
   const {error}=await client.auth.updateUser({password});
   if(error)throw error;
   ready=false;form.reset();form.hidden=true;status.textContent='Contraseña actualizada. Ya puedes ingresar a certificados.';
   await client.auth.signOut({scope:'local'});
  }catch{status.textContent='No se pudo cambiar la contraseña. Revisa los requisitos o solicita un enlace nuevo.';}
  finally{button.disabled=false;}
 });
})();
