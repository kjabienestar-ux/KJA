/* Chat del portal: historial en Supabase, interfaz independiente del módulo abierto. */
(function(){
  'use strict';
  const icons={chat:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z',close:'m6 6 12 12M6 18 18 6',minus:'M5 12h14',back:'m14 6-6 6 6 6',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14'};
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el};
  function button(label,icon,cls='chat-icon'){
    const el=node('button',cls);el.type='button';el.setAttribute('aria-label',label);el.title=label;
    if(icon){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[icon]);svg.append(path);el.append(svg)}else el.textContent=label;
    return el;
  }
  const root=node('aside','kja-chat');root.hidden=true;root.setAttribute('aria-label','Mensajes del equipo');
  const launcher=button('Abrir mensajes','chat','chat-launcher'),launchText=node('span','','Mensajes'),count=node('span','chat-count');count.hidden=true;launcher.append(launchText,count);launcher.setAttribute('aria-expanded','false');
  const directory=node('section','chat-directory');directory.hidden=true;directory.id='chat-directory';launcher.setAttribute('aria-controls',directory.id);
  const heading=node('header','chat-heading'),closeDirectory=button('Cerrar contactos','close');heading.append(node('strong','','Mensajes'),closeDirectory);
  const tools=node('div','chat-tools'),search=node('input');search.type='search';search.placeholder='Buscar una persona';search.setAttribute('aria-label','Buscar una persona');
  const tabs=node('div','chat-tabs'),all=button('Equipo'),direction=button('Dirección');tabs.append(all,direction);tools.append(search,tabs);
  const recent=button('Mis chats');tabs.append(recent);
  const list=node('div','chat-contacts'),status=node('p','chat-status'),retry=button('Reintentar conexión',null,'chat-older');status.setAttribute('role','status');retry.hidden=true;
  directory.append(heading,tools,list,status,retry);
  const dock=node('div','chat-windows'),announcer=node('p','chat-announcer');announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');
  const panel=node('section','chat-panel'),empty=node('div','chat-welcome');panel.id='chat-panel';panel.hidden=true;panel.setAttribute('aria-label','Chat del equipo');launcher.setAttribute('aria-controls',panel.id);
  empty.append(node('strong','','Tu equipo, más cerca'),node('p','','Elige una persona para conversar o retoma tu historial en Mis chats.'));
  dock.append(empty);panel.append(directory,dock);root.append(launcher,panel,announcer);document.body.append(root);
  let user=null,epoch=0,contacts=[],onlyDirection=false,timer=null,refreshBusy=false;
  const windows=new Map();
  let activeId=null,presenceSession=null,presenceAt=0,presenceBusy=false,presenceKnown=false,presenceDesired=true;
  const onlineUntil=new Map();
  let chatChannel=null,realtimeReady=false;
  const notifiedEvents=new Set(),unreadSnapshots=new Map(),pollingAlertedCounts=new Map();
  const isOnline=id=>presenceKnown&&(onlineUntil.get(id)||0)>Date.now();
  async function presence(visible=!document.hidden){
    if(document.hidden)visible=false;
    presenceDesired=visible;
    if(!user||!presenceSession||presenceBusy||(visible&&Date.now()<presenceAt))return;
    const stamp=epoch,session=presenceSession;presenceBusy=true;presenceAt=Date.now()+25000;
    try{
      const rows=await rpc('chat_presencia',{p_sesion:session,p_visible:visible});if(stamp!==epoch)return;
      onlineUntil.clear();for(const row of rows)onlineUntil.set(row.id,Date.now()+Math.max(0,Number(row.vigencia_segundos))*1000);
      presenceKnown=true;renderContacts();
    }catch{if(stamp===epoch){onlineUntil.clear();presenceKnown=false;renderContacts()}}
    finally{if(stamp===epoch){presenceBusy=false;if(presenceDesired!==visible){presenceAt=0;void presence(presenceDesired)}}}
  }
  function avatarFor(c){
    const avatar=node('span','chat-avatar',c.nombre.trim().split(/\s+/).slice(0,2).map(s=>Array.from(s)[0]).join('').toUpperCase());avatar.setAttribute('aria-hidden','true');
    if(photoUrls.has(c.id)){const img=node('img','chat-avatar-photo');img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>img.remove();img.src=photoUrls.get(c.id);avatar.append(img)}
    return avatar;
  }
  function syncPanel(){
    panel.dataset.conversation=String(!!activeId);empty.hidden=!!activeId;
    for(const w of windows.values()){w.el.hidden=w.id!==activeId;w.minimized=w.id!==activeId;w.el.dataset.minimized='false'}
  }
  const conversationCache=new Map();let onlyRecent=false;
  function remember(w){conversationCache.delete(w.id);conversationCache.set(w.id,{messages:new Map(w.messages),syncedThrough:w.syncedThrough,hasOlder:w.hasOlder,loaded:w.loaded});if(conversationCache.size>20)conversationCache.delete(conversationCache.keys().next().value)}
  const photoCache=new Map(),photoUrls=new Map();
  let photoBusy=false,photoCheckAt=0;
  async function refreshPhotos(stamp){
    if(photoBusy||Date.now()<photoCheckAt)return;
    photoBusy=true;photoCheckAt=Date.now()+30000;
    try{
      const rows=await rpc('chat_fotos');if(stamp!==epoch)return;
      const now=Date.now(),pending=[],seen=new Set();
      for(const row of rows){
        const key=row.foto_path+'|'+row.foto_actualizada_at;
        if(!row.foto_path||seen.has(key))continue;seen.add(key);
        if(!photoCache.has(key)||photoCache.get(key).expiresAt<=now)pending.push({key,path:row.foto_path,version:row.foto_actualizada_at});
      }
      if(pending.length){
        const {data,error}=await db.storage.from('perfil-fotos').createSignedUrls(pending.map(p=>p.path),3600);
        if(stamp!==epoch)return;
        if(!error)for(let i=0;i<(data||[]).length;i++){
          const url=data[i]?.signedUrl,item=pending[i];
          if(url&&item)photoCache.set(item.key,{url:url+(url.includes('?')?'&':'?')+'v='+encodeURIComponent(item.version||''),expiresAt:now+50*60*1000});
        }
      }
      photoUrls.clear();
      for(const row of rows){const cached=photoCache.get(row.foto_path+'|'+row.foto_actualizada_at);if(cached&&cached.expiresAt>now)photoUrls.set(row.id,cached.url)}
      for(const key of photoCache.keys())if(!seen.has(key))photoCache.delete(key);
      renderContacts();
    }catch{/* Las fotos no bloquean los mensajes; se conservan las iniciales. */}
    finally{if(stamp===epoch)photoBusy=false}
  }
  function note(text,error=false){status.textContent=text;status.dataset.error=String(error);retry.hidden=!error}
  function persist(){try{sessionStorage.setItem('kja-chat-windows:'+user,JSON.stringify([...windows.values()].map(w=>({id:w.id,minimized:w.minimized}))))}catch{}}
  const touchChat=()=>window.matchMedia?.('(max-width:700px), (pointer:coarse)').matches===true;
  function syncMobileLock(){document.body.dataset.mobileChatOpen=String(touchChat()&&!panel.hidden)}
  function focusChat(input){if(touchChat()){panel.tabIndex=-1;panel.focus({preventScroll:true})}else input.focus()}
  function playChatSound(){try{window.KJANotificationSound?.play?.()}catch{/* El sonido nunca debe interrumpir la sincronización. */}}
  function notifyIncomingMessage(id){
    const key=String(id||'');if(!key||notifiedEvents.has(key))return false;
    notifiedEvents.add(key);playChatSound();return true;
  }
  function syncUnreadSnapshots(rows){
    const seen=new Set();
    for(const row of rows||[]){
      const id=String(row.id||'');if(!id)continue;seen.add(id);
      const unread=Math.max(0,Number(row.no_leidos)||0),previous=unreadSnapshots.get(id);
      if(unread<1)pollingAlertedCounts.delete(id);
      if(!realtimeReady&&previous!==undefined&&unread>previous){
        playChatSound();pollingAlertedCounts.set(id,(pollingAlertedCounts.get(id)||0)+(unread-previous));
      }
      unreadSnapshots.set(id,unread);
    }
    for(const id of unreadSnapshots.keys())if(!seen.has(id)){unreadSnapshots.delete(id);pollingAlertedCounts.delete(id)}
  }
  function startRealtime(stamp){
    if(chatChannel){void db.removeChannel(chatChannel);chatChannel=null}
    realtimeReady=false;
    if(!user||typeof db.channel!=='function')return;
    chatChannel=db.channel('kja-chat-eventos-'+user)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_eventos',filter:`destinatario=eq.${user}`},payload=>{
        if(stamp!==epoch||!user)return;
        const event=payload?.new;if(!event||String(event.destinatario)!==String(user))return;
        if(notifyIncomingMessage(event.mensaje_id))void refresh();
      })
      .subscribe(status=>{
        if(stamp!==epoch)return;
        realtimeReady=status==='SUBSCRIBED';
        if(realtimeReady)void refresh();
      });
  }
  function toggleDirectory(show){panel.hidden=!show;directory.hidden=false;launcher.setAttribute('aria-expanded',String(show));syncMobileLock();if(show){syncPanel();renderContacts();const w=windows.get(activeId);focusChat(w?w.input:search)}else launcher.focus()}
  launcher.onclick=()=>toggleDirectory(panel.hidden);closeDirectory.onclick=()=>toggleDirectory(false);
  function renderContacts(){
    const focusedContact=document.activeElement?.dataset?.contact;
    all.setAttribute('aria-pressed',String(!onlyDirection));direction.setAttribute('aria-pressed',String(onlyDirection));
    all.setAttribute('aria-pressed',String(!onlyDirection&&!onlyRecent));recent.setAttribute('aria-pressed',String(onlyRecent));
    const term=search.value.trim().toLocaleLowerCase('es');
    list.replaceChildren();
    const filtered=contacts.filter(c=>(!onlyDirection||c.direccion)&&(!onlyRecent||c.ultimo_at||c.ultimo||conversationCache.get(c.id)?.messages.size||windows.get(c.id)?.messages.size)&&c.nombre.toLocaleLowerCase('es').includes(term));
    for(const c of filtered){
      const b=button('Abrir chat con '+c.nombre,null,'chat-contact'),avatar=avatarFor(c),person=node('span','chat-person');
      b.dataset.contact=c.id;
      b.setAttribute('aria-current',String(c.id===activeId));
      person.append(node('strong','',c.nombre),node('small','',(!c.activo?'Cuenta desactivada · ':c.direccion?'Dirección · ':'')+(c.ultimo||'Iniciar conversación')));b.replaceChildren(avatar,person);
      if(Number(c.no_leidos)){const badge=node('span','chat-count',String(c.no_leidos));badge.setAttribute('aria-label',c.no_leidos+' sin leer');b.append(badge)}
      if(c.activo&&isOnline(c.id)){const dot=node('span','chat-online-dot');dot.setAttribute('role','img');dot.setAttribute('aria-label','En línea');dot.title='En línea';b.append(dot)}
      b.onclick=()=>open(c.id);list.append(b);if(focusedContact===c.id)b.focus();
    }
    if(!filtered.length)list.append(node('p','chat-status',onlyRecent?'Aquí aparecerán tus conversaciones. Busca a una persona en Equipo o Dirección.':onlyDirection?'No hay personas de Dirección disponibles con esta búsqueda.':'No hay personas con esta búsqueda.'));
    const total=contacts.reduce((n,c)=>n+Number(c.no_leidos),0);count.textContent=total>99?'99+':String(total);count.hidden=!total;launcher.setAttribute('aria-label',total?`Mensajes: ${total} sin leer`:'Abrir mensajes');
    for(const w of windows.values()){
      const c=contacts.find(c=>c.id===w.id);if(!c)continue;
      w.online.textContent=!c.activo?'Cuenta desactivada':isOnline(w.id)?'En línea':presenceKnown?'Sin conexión':'Estado no disponible';w.online.dataset.online=String(c.activo&&isOnline(w.id));
      const avatar=avatarFor(c);w.avatar.replaceChildren(avatar);
    }
  }
  search.oninput=renderContacts;all.onclick=()=>{onlyDirection=false;onlyRecent=false;renderContacts()};direction.onclick=()=>{onlyDirection=true;onlyRecent=false;renderContacts()};recent.onclick=()=>{onlyDirection=false;onlyRecent=true;renderContacts()};
  async function rpc(name,args={}){const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
  function current(w){return user&&w.epoch===epoch&&windows.get(w.id)===w}
  function messageError(error){return error?.message?.includes('schema cache')||error?.code==='PGRST202'?'El chat todavía no está habilitado. Solicita su activación a Sistemas.':'No se pudo conectar con el chat. Vuelve a intentar.'}
  function windowNote(w,text,error=false){w.status.textContent=text;w.status.dataset.error=String(error)}
  function renderMessages(w,older=false){
    const nearBottom=w.history.scrollHeight-w.history.scrollTop-w.history.clientHeight<70;
    const previousHeight=w.history.scrollHeight,previousTop=w.history.scrollTop;
    w.history.replaceChildren(w.older);
    const rows=[...w.messages.values()].sort((a,b)=>Number(a.id)-Number(b.id));
    if(!rows.length)w.history.append(node('p','chat-status','Este es el inicio de la conversación.'));
    for(const m of rows){
      const mine=m.remitente===user,entry=node('div','chat-message'),time=node('time');entry.dataset.mine=String(mine);time.dateTime=m.creado_at;
      time.textContent=new Date(m.creado_at).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+(mine?(m.leido_at?' · Leído':' · Enviado'):'');
      entry.append(node('p','chat-bubble',m.contenido),time);w.history.append(entry);
      window.KJAChatImages?.render(entry,m,db,()=>!!current(w));
    }
    w.older.hidden=!w.hasOlder;
    if(older)w.history.scrollTop=previousTop+w.history.scrollHeight-previousHeight;
    else if(nearBottom||!w.loaded)w.history.scrollTop=w.history.scrollHeight;
    else w.history.scrollTop=previousTop;
    w.loaded=true;
  }
  async function markRead(w){
    if(!current(w)||panel.hidden||w.id!==activeId||w.minimized||document.hidden||!document.hasFocus()||!w.el.contains(document.activeElement)||!w.el.getClientRects().length||getComputedStyle(w.el).visibility==='hidden'||w.history.scrollHeight-w.history.scrollTop-w.history.clientHeight>70||w.readBusy)return;
    const unread=[...w.messages.values()].filter(m=>m.destinatario===user&&!m.leido_at);if(!unread.length)return;
    w.readBusy=true;
    try{await rpc('chat_leer',{p_contacto:w.id,p_hasta:Math.max(...unread.map(m=>Number(m.id)))});if(current(w)){for(const m of unread)m.leido_at=new Date().toISOString()}}catch{if(current(w))windowNote(w,'No se pudo confirmar la lectura. Se reintentará.',true)}finally{w.readBusy=false}
  }
  async function history(w,older=false){
    if(!current(w)||w.loading)return;w.loading=true;w.older.disabled=true;const stamp=epoch;
    try{
      const args={p_contacto:w.id};if(older&&w.messages.size)args.p_antes=Math.min(...w.messages.keys());
      let rows=await rpc('chat_historial',args);if(stamp!==epoch||!current(w))return;
      const latestKnown=w.syncedThrough;
      const firstSync=latestKnown===null;
      // Rellena el intervalo completo tras una desconexión, antes de confirmar lectura.
      if(!older&&w.loaded&&latestKnown!==null){
        let page=rows;
        while(page.length===50&&Math.min(...page.map(m=>Number(m.id)))>latestKnown){
          page=await rpc('chat_historial',{p_contacto:w.id,p_antes:Math.min(...page.map(m=>Number(m.id)))});
          if(stamp!==epoch||!current(w))return;rows=rows.concat(page);
        }
      }
      const incoming=rows.filter(m=>m.destinatario===user&&!w.messages.has(Number(m.id)));
      const arrived=w.loaded&&!older?incoming.length:0;
      if(!realtimeReady&&w.loaded&&!older&&incoming.length){
        let fallbackRemaining=pollingAlertedCounts.get(w.id)||0;
        for(const message of incoming){
          if(fallbackRemaining>0){notifiedEvents.add(String(message.id));fallbackRemaining--}
          else notifyIncomingMessage(message.id);
        }
        if(fallbackRemaining)pollingAlertedCounts.set(w.id,fallbackRemaining);else pollingAlertedCounts.delete(w.id);
      }
      for(const m of rows)w.messages.set(Number(m.id),m);
      if(!older)w.syncedThrough=Math.max(w.syncedThrough||0,...rows.map(m=>Number(m.id)));
      if(older||firstSync)w.hasOlder=rows.length===50;
      if(arrived)announcer.textContent=`${arrived} ${arrived===1?'mensaje nuevo':'mensajes nuevos'} de ${contacts.find(c=>c.id===w.id)?.nombre||'tu contacto'}.`;
      renderMessages(w,older);remember(w);windowNote(w,'');await markRead(w);
    }catch(error){if(current(w))windowNote(w,messageError(error)+' Usa Actualizar.',true)}finally{w.loading=false;w.older.disabled=false}
  }
  function minimize(w,value){if(value){toggleDirectory(false)}else{activeId=w.id;syncPanel();if(!panel.hidden)focusChat(w.input);void history(w)}persist()}
  function close(w){if(w.sending)return;window.KJAChatImages?.clear(w);remember(w);windows.delete(w.id);w.el.remove();if(activeId===w.id)activeId=null;syncPanel();renderContacts();persist();focusChat(search)}
  function open(id,options={}){
    const c=contacts.find(c=>c.id===id);if(!c)return;
    if(!options.restore)toggleDirectory(true);
    if(windows.has(id)){const w=windows.get(id);dock.append(w.el);minimize(w,false);renderContacts();return}
    if(windows.size>=2){const victim=[...windows.values()].find(w=>!w.sending&&!w.compressing&&!w.attachment&&!w.input.value.trim());if(!victim){toggleDirectory(true);note('Cierra una conversación o envía su borrador para abrir otra.',true);return}close(victim)}
    const w={id,epoch,minimized:false,messages:new Map(),syncedThrough:null,loaded:false,hasOlder:false,loading:false,sending:false,pending:null};
    const cached=conversationCache.get(id);if(cached)Object.assign(w,{...cached,messages:new Map(cached.messages)});
    w.el=node('section','chat-window');w.el.setAttribute('aria-label','Conversación con '+c.nombre);
    const head=node('header','chat-heading');w.toggle=button('Minimizar chat','minus');w.close=button('Cerrar conversación','close');const title=node('strong','chat-peer-title',c.nombre);w.online=node('small','chat-peer-state');title.append(w.online);head.append(title,w.toggle,w.close);
    w.avatar=node('span','chat-peer-avatar');w.avatar.append(avatarFor(c));const back=button('Volver a las personas','back','chat-icon chat-back');back.onclick=()=>{activeId=null;syncPanel();renderContacts();focusChat(search)};head.append(w.avatar,back);
    const body=node('div','chat-body');w.history=node('div','chat-history');w.history.setAttribute('role','log');w.history.setAttribute('aria-live','off');w.history.setAttribute('aria-label','Historial de mensajes');w.history.tabIndex=0;
    w.older=button('Ver mensajes anteriores',null,'chat-older');w.older.hidden=true;w.older.onclick=()=>history(w,true);
    w.status=node('p','chat-status');w.status.setAttribute('role','status');
    const update=button('Actualizar',null,'chat-older');update.onclick=()=>history(w);
    const form=node('form','chat-compose');w.input=node('textarea');w.input.rows=1;w.input.maxLength=4000;w.input.placeholder='Mensaje…';w.input.setAttribute('aria-label','Mensaje para '+c.nombre);w.input.disabled=!c.activo;
    w.send=button('Enviar mensaje','send','chat-send');w.send.type='submit';w.send.disabled=true;form.append(w.input,w.send);
    w.input.oninput=()=>{w.send.disabled=w.sending||w.compressing||!c.activo||(!w.input.value.trim()&&!w.attachment);w.input.style.height='auto';w.input.style.height=Math.min(100,Math.max(44,w.input.scrollHeight))+'px'};
    form.onsubmit=async e=>{
      e.preventDefault();if(!current(w)||w.sending||w.compressing||!c.activo||(!w.input.value.trim()&&!w.attachment))return;
      const content=w.input.value.trim();if(Array.from(content).length>4000){windowNote(w,'El mensaje supera 4000 caracteres.',true);return}
      if(!w.pending||w.pending.content!==content||w.pending.imageKey!==w.attachment?.key)w.pending={id:crypto.randomUUID(),content,imageKey:w.attachment?.key};
      w.sending=true;w.send.disabled=true;w.input.disabled=true;w.close.disabled=true;windowNote(w,'Enviando…');
      try{
        const m=w.attachment?await window.KJAChatImages.send(w,db,user,content,current):await rpc('chat_enviar',{p_contacto:id,p_contenido:content,p_cliente_id:w.pending.id});if(!current(w))return;
        window.KJAChatImages?.clear(w);
        w.messages.set(Number(m.id),m);w.input.value='';w.pending=null;renderMessages(w);remember(w);w.history.scrollTop=w.history.scrollHeight;windowNote(w,'Mensaje enviado.');void refresh();
      }catch(error){if(current(w))windowNote(w,(error?.code==='P0001'?error.message:'No se confirmó el envío. Tu texto se conserva; pulsa Enviar para reintentar.'),true)}
      finally{w.sending=false;if(current(w)){w.input.disabled=!c.activo;w.close.disabled=false;w.input.oninput();if(!touchChat())w.input.focus()}}
    };
    w.input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}};
    w.toggle.onclick=()=>minimize(w,!w.minimized);w.close.onclick=()=>{if((w.input.value.trim()||w.attachment||w.compressing)&&!confirm('¿Cerrar esta conversación y descartar el mensaje sin enviar?'))return;close(w)};
    w.el.addEventListener('focusin',()=>void markRead(w));w.history.addEventListener('scroll',()=>void markRead(w));
    body.append(w.history,w.status,update,form,node('p','chat-hint',c.activo?'Enter envía · Shift + Enter agrega una línea':'Cuenta desactivada. Solo puedes consultar el historial.'));w.el.append(head,body);windows.set(id,w);dock.append(w.el);
    if(c.activo)window.KJAChatImages?.mount(w,form,current,windowNote);
    if(w.messages.size){renderMessages(w);w.history.scrollTop=w.history.scrollHeight}else windowNote(w,'Cargando historial…');
    if(!options.restore||!options.minimized)minimize(w,false);else w.el.hidden=true;renderContacts();void history(w);persist();
  }
  async function refresh(){
    if(!user)return;renderContacts();if(!document.hidden)void presence();
    if(refreshBusy||document.hidden)return;refreshBusy=true;const stamp=epoch;
    try{
      const data=await rpc('chat_contactos');if(stamp!==epoch)return;syncUnreadSnapshots(data);contacts=data;renderContacts();note('Mensajes privados · Historial guardado');void refreshPhotos(stamp);
      await Promise.all([...windows.values()].filter(w=>!w.minimized).map(w=>history(w)));
    }catch(error){if(stamp===epoch)note(messageError(error),true)}finally{if(stamp===epoch)refreshBusy=false}
  }
  function destroy(){epoch++;if(chatChannel){void db.removeChannel(chatChannel);chatChannel=null}realtimeReady=false;notifiedEvents.clear();unreadSnapshots.clear();pollingAlertedCounts.clear();clearInterval(timer);timer=null;user=null;contacts=[];windows.clear();activeId=null;presenceSession=null;presenceAt=0;presenceBusy=false;presenceKnown=false;presenceDesired=true;onlineUntil.clear();conversationCache.clear();onlyRecent=false;photoCache.clear();photoUrls.clear();photoBusy=false;photoCheckAt=0;dock.replaceChildren(empty);empty.hidden=false;panel.hidden=true;syncMobileLock();list.replaceChildren();announcer.textContent='';root.hidden=true;directory.hidden=true;search.value='';count.hidden=true;refreshBusy=false;onlyDirection=false;launcher.setAttribute('aria-expanded','false')}
  retry.onclick=()=>void refresh();
  document.addEventListener('visibilitychange',()=>{presenceAt=0;void presence(!document.hidden);if(!document.hidden)void refresh()});
  window.addEventListener('pagehide',()=>void presence(false));
  window.addEventListener('focus',()=>void refresh());
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!directory.hidden)toggleDirectory(false);else{const w=[...windows.values()].find(w=>w.el.contains(e.target));if(w){minimize(w,true);launcher.focus()}}}});
  window.addEventListener('beforeunload',e=>{if([...windows.values()].some(w=>w.sending||w.compressing||w.attachment||w.input.value.trim())){e.preventDefault();e.returnValue=''}});
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){for(const w of windows.values())window.KJAChatImages?.clear(w);destroy()}});
  let externalOpen=0;
  async function openCollaborator(personId){
    if(!user)throw Error('El chat aún está conectando. Intenta nuevamente en unos segundos.');
    if(!/^\d+$/.test(String(personId))||Number(personId)<=0)throw Error('Colaborador inválido.');
    const stamp=epoch,request=++externalOpen;
    const id=await rpc('chat_cuenta_colaborador',{p_colaborador:personId});
    if(stamp!==epoch||request!==externalOpen)return;
    const data=await rpc('chat_contactos');
    if(stamp!==epoch||request!==externalOpen)return;
    if(!data.some(c=>c.id===id&&c.activo))throw Error('La cuenta del colaborador no está disponible para conversar.');
    contacts=data;open(id);
  }
  window.KJAChat={openCollaborator,async init(id){if(!id)return;if(user===id)return;destroy();user=id;presenceSession=crypto.randomUUID();const stamp=epoch;root.hidden=false;note('Conectando…');await refresh();if(stamp!==epoch)return;startRealtime(stamp);
    try{const saved=JSON.parse(sessionStorage.getItem('kja-chat-windows:'+id)||'[]');if(Array.isArray(saved))saved.slice(-2).forEach(w=>open(w.id,{restore:true,minimized:!!w.minimized}))}catch{}
    timer=setInterval(()=>void refresh(),5000);
  },destroy};
})();
