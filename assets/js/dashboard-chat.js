/* Chat del portal: historial en Supabase, interfaz independiente del módulo abierto. */
(function(){
  'use strict';
  // Grupos: apagados hasta aplicar docs/propuesta-chat-grupos.md en Supabase y declarar window.KJA_CHAT_GROUPS=true.
  // Apagados, no se crea su interfaz ni se llama a ninguna de sus funciones.
  // Vista previa local con ?grupos=preview: datos en memoria, sin llamar a Supabase ni guardar nada.
  const GROUPS_PREVIEW=window.KJA_CHAT_GROUPS!==true&&/[?&]grupos=preview(&|$)/.test(window.location?.search||'');
  const GROUPS_ENABLED=window.KJA_CHAT_GROUPS===true||GROUPS_PREVIEW;
  const preview={groups:['Ingeniería','Conferencias','Organizacional','Salud Ocupacional','Diseño Gráfico','Reclutamiento','Marketing','Administración','RRHH'].map((nombre,i)=>({id:i+1,nombre,miembros:0,unido:false,no_leidos:0})),messages:[],nextId:1};
  async function previewRpc(name,args={}){
    const g=preview.groups.find(g=>g.id===args.p_grupo);
    if(name==='chat_grupos')return preview.groups.map(g=>({...g}));
    if(name==='chat_grupo_unirse'){if(g&&!g.unido){g.unido=true;g.miembros++}return null}
    if(name==='chat_grupo_salir'){if(g?.unido){g.unido=false;g.miembros--}return null}
    if(name==='chat_grupo_leer')return null;
    if(name==='chat_grupo_historial')return preview.messages.filter(m=>m.grupo_id===args.p_grupo&&(!args.p_antes||m.id<args.p_antes)).sort((a,b)=>b.id-a.id).slice(0,50).map(m=>({...m}));
    if(name==='chat_grupo_enviar'){const m={id:preview.nextId++,grupo_id:args.p_grupo,remitente:user,autor:'Tú',contenido:String(args.p_contenido).trim(),creado_at:new Date().toISOString()};preview.messages.push(m);if(g){g.ultimo=m.contenido;g.ultimo_autor='Tú';g.ultimo_remitente=user;g.ultimo_at=m.creado_at}return {...m}}
    throw Error('Vista previa: '+name);
  }
  const icons={smile:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',chat:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z',close:'m6 6 12 12M6 18 18 6',minus:'M5 12h14',back:'m14 6-6 6 6 6',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14',refresh:'M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',leave:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    compose:'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',megaphone:'m3 11 18-5v12L3 14v-3ZM11.6 16.8a3 3 0 1 1-5.8-1.6'};
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el};
  function svgIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[name]);svg.append(path);return svg}
  function button(label,icon,cls='chat-icon'){
    const el=node('button',cls);el.type='button';el.setAttribute('aria-label',label);el.title=label;
    if(icon)el.append(svgIcon(icon));else el.textContent=label;
    return el;
  }
  // Tono estable por persona o grupo: el mismo color en la lista, la cabecera y los autores.
  const toneOf=text=>{let h=0;for(const ch of String(text))h=(h*31+ch.codePointAt(0))>>>0;return String(h%6)};
  const firstName=name=>String(name||'').trim().split(/\s+/)[0]||'Alguien';
  const members=g=>{const n=Number(g?.miembros)||0;return n===0?'Sin integrantes aún':n===1?'1 integrante':n+' integrantes'};
  const dayKey=d=>d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
  function shortWhen(iso){
    const d=new Date(iso);if(isNaN(d))return '';
    if(dayKey(d)===dayKey(new Date(Date.now())))return d.toLocaleTimeString('es-PE',{hour:'numeric',minute:'2-digit'});
    if(dayKey(d)===dayKey(new Date(Date.now()-864e5)))return 'Ayer';
    if(Date.now()-d<6*864e5)return d.toLocaleDateString('es-PE',{weekday:'short'}).replace('.','');
    return d.toLocaleDateString('es-PE',{day:'numeric',month:'short'}).replace('.','');
  }
  function dayLabel(d){
    if(dayKey(d)===dayKey(new Date(Date.now())))return 'Hoy';
    if(dayKey(d)===dayKey(new Date(Date.now()-864e5)))return 'Ayer';
    return d.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});
  }
  // Emojis: se insertan como texto (Unicode) y viajan con el mensaje; no requieren nada nuevo en el servidor.
  const EMOJIS=[
    ['Caras','😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 😘 😋 😜 🤗 🤔 🤨 😐 🙄 😏 😌 😴 😷 🤒 😎 🤓 🥳 😮 😲 😳 🥺 😢 😭 😤 😡 🤯 😱'],
    ['Gestos','👍 👎 👌 ✌️ 🤞 🤝 👏 🙌 🙏 💪 👋 ☝️ 👉 👈 👆 👇 ✋ 🤙 ✍️ 🙋'],
    ['Corazones','❤️ 🧡 💛 💚 💙 💜 🤍 🖤 💖 💕 💗 💯 ✨ ⭐ 🌟 🔥'],
    ['Trabajo','✅ ☑️ ❌ ⚠️ ❗ ❓ 📌 📎 📅 🗓️ ⏰ ⏳ 📝 📄 📊 📈 💼 💻 📱 📞 📧 📢 🔔 💡 🧠 🎯 🚀'],
    ['Celebración','🎉 🎊 🎂 🎁 🏆 🥇 🍀 ☕ 🍕 🌞 🌈 ⚽ 🎶']
  ].map(([nombre,lista])=>[nombre,lista.split(' ')]);
  const recentEmojiKey=()=>'kja-chat-emojis:'+user;
  function recentEmojis(){try{const saved=JSON.parse(localStorage.getItem(recentEmojiKey())||'[]');return Array.isArray(saved)?saved.filter(e=>typeof e==='string').slice(0,16):[]}catch{return []}}
  function rememberEmoji(emoji){try{localStorage.setItem(recentEmojiKey(),JSON.stringify([emoji,...recentEmojis().filter(e=>e!==emoji)].slice(0,16)))}catch{}}
  let openEmoji=null;
  function closeEmoji(){if(!openEmoji)return;openEmoji.panel.hidden=true;openEmoji.toggle.setAttribute('aria-expanded','false');openEmoji=null}
  // Botón 😊 y panel por categorías; el emoji se inserta donde está el cursor y el panel sigue abierto.
  function mountEmoji(form,input){
    const toggle=button('Insertar emoji','smile','chat-emoji-btn'),panel=node('div','chat-emoji-panel'),tabs=node('div','chat-emoji-tabs'),grid=node('div','chat-emoji-grid');
    toggle.setAttribute('aria-expanded','false');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Emojis');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Categorías de emojis');panel.append(tabs,grid);
    let category=null;
    function render(){
      const recent=recentEmojis(),groups=[...(recent.length?[['Recientes',recent]]:[]),...EMOJIS];
      if(!groups.some(([nombre])=>nombre===category))category=groups[0][0];
      tabs.replaceChildren(...groups.map(([nombre,lista])=>{const b=node('button','chat-emoji-tab',nombre==='Recientes'?'🕘':lista[0]);b.type='button';b.title=nombre;b.setAttribute('aria-label',nombre);b.setAttribute('aria-pressed',String(nombre===category));b.onclick=()=>{category=nombre;render()};return b}));
      grid.replaceChildren(...groups.find(([nombre])=>nombre===category)[1].map(emoji=>{const b=node('button','chat-emoji',emoji);b.type='button';b.onclick=()=>insert(emoji);return b}));
    }
    function insert(emoji){
      if(input.disabled)return;
      const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
      input.value=input.value.slice(0,start)+emoji+input.value.slice(end);input.focus();
      try{input.setSelectionRange(start+emoji.length,start+emoji.length)}catch{}
      input.oninput?.();rememberEmoji(emoji);
    }
    toggle.onclick=()=>{if(openEmoji?.panel===panel){closeEmoji();return}closeEmoji();category=null;render();panel.hidden=false;toggle.setAttribute('aria-expanded','true');openEmoji={panel,toggle}};
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeEmoji();toggle.focus()}});
    form.append(toggle,panel);return toggle;
  }
  document.addEventListener('pointerdown',e=>{if(openEmoji&&!openEmoji.panel.contains(e.target)&&!openEmoji.toggle.contains(e.target))closeEmoji()});
  const root=node('aside','kja-chat');root.hidden=true;root.setAttribute('aria-label','Mensajes del equipo');
  const launcher=button('Abrir mensajes','chat','chat-launcher'),launchText=node('span','','Mensajes'),count=node('span','chat-count');count.hidden=true;launcher.append(launchText,count);launcher.setAttribute('aria-expanded','false');
  const directory=node('section','chat-directory');directory.hidden=true;directory.id='chat-directory';launcher.setAttribute('aria-controls',directory.id);
  const heading=node('header','chat-heading'),closeDirectory=button('Cerrar contactos','close'),newChatBtn=button('Nuevo chat','compose','chat-icon chat-new-btn');heading.append(node('strong','','Mensajes'),newChatBtn,closeDirectory);
  const tools=node('div','chat-tools'),search=node('input');search.type='search';search.placeholder=GROUPS_ENABLED?'Buscar una persona o grupo':'Buscar una persona';search.setAttribute('aria-label',search.placeholder);
  const tabs=node('div','chat-tabs'),all=button('Equipo'),direction=button('Dirección');tabs.append(all,direction);tools.append(search,tabs);
  const recent=button('Mis chats'),groupTab=button('Grupos');tabs.append(recent);
  if(GROUPS_ENABLED){tabs.append(groupTab);tabs.dataset.count='4'}
  const list=node('div','chat-contacts'),status=node('p','chat-status'),retry=button('Reintentar conexión',null,'chat-older');status.setAttribute('role','status');retry.hidden=true;
  // «Nuevo chat»: atajos (mensaje a varios, grupos) y personas, dentro de la columna del directorio.
  const newChat=node('section','chat-newchat');newChat.hidden=true;newChat.setAttribute('aria-label','Nuevo chat');
  const ncHead=node('header','chat-heading chat-newchat-head'),ncBack=button('Volver a Mensajes','back');ncHead.append(ncBack,node('strong','','Nuevo chat'));
  const ncTools=node('div','chat-newchat-tools'),ncSearch=node('input');ncSearch.type='search';ncSearch.placeholder='Buscar un nombre';ncSearch.setAttribute('aria-label','Buscar un nombre');ncTools.append(ncSearch);
  const ncBody=node('div','chat-newchat-body');newChat.append(ncHead,ncTools,ncBody);
  directory.append(heading,tools,list,status,retry,newChat);
  const dock=node('div','chat-windows'),announcer=node('p','chat-announcer');announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');
  const panel=node('section','chat-panel'),empty=node('div','chat-welcome');panel.id='chat-panel';panel.hidden=true;panel.setAttribute('aria-label','Chat del equipo');launcher.setAttribute('aria-controls',panel.id);
  const welcomeIcon=node('span','chat-welcome-icon');welcomeIcon.append(svgIcon('chat'));
  empty.append(welcomeIcon,node('strong','','Tu equipo, más cerca'),node('p','',GROUPS_ENABLED?'Elige una persona, únete al grupo de tu equipo o retoma tu historial en Mis chats.':'Elige una persona para conversar o retoma tu historial en Mis chats.'));
  // Vista para unirse: quien no integra el grupo ve su nombre y cuántas personas lo integran, nunca sus mensajes.
  const join=node('section','chat-join');join.hidden=true;join.setAttribute('aria-label','Unirse a un grupo');
  const joinHead=node('header','chat-heading'),joinBack=button('Volver a los grupos','back','chat-icon chat-join-back'),joinTitle=node('strong','chat-peer-title','Grupo');joinHead.append(joinBack,joinTitle);
  const joinCard=node('div','chat-join-card'),joinAvatar=node('span','chat-join-avatar'),joinName=node('strong','chat-join-name'),joinCount=node('p','chat-join-count');
  const joinBtn=node('button','chat-join-btn','Unirme al grupo'),joinStatus=node('p','chat-status');joinBtn.type='button';joinStatus.setAttribute('role','status');joinAvatar.setAttribute('aria-hidden','true');joinAvatar.append(svgIcon('users'));
  joinCard.append(joinAvatar,joinName,joinCount,node('p','chat-join-text','Únete para leer y enviar mensajes en este grupo. Puedes salir cuando quieras.'),joinBtn,joinStatus);join.append(joinHead,joinCard);
  // «Mensaje a varios»: envía el mismo texto a cada persona elegida, en su chat privado, con la función de envío existente.
  const textButton=(text,cls)=>{const el=node('button',cls,text);el.type='button';return el};
  const mass=node('section','chat-mass');mass.hidden=true;mass.setAttribute('aria-label','Mensaje a varios');
  const massHead=node('header','chat-heading'),massTitle=node('strong','chat-peer-title','Mensaje a varios'),massClose=button('Cerrar mensaje a varios','close'),massBack=button('Volver','back','chat-icon chat-mass-back');
  const massAvatarWrap=node('span','chat-peer-avatar'),massAvatar=node('span','chat-avatar chat-avatar-group');massAvatar.dataset.tone='1';massAvatar.setAttribute('aria-hidden','true');massAvatar.append(svgIcon('megaphone'));massAvatarWrap.append(massAvatar);
  massTitle.append(node('small','chat-mass-sub','Cada persona lo recibe en su chat privado contigo'));massHead.append(massTitle,massClose,massAvatarWrap,massBack);
  const massPick=node('div','chat-mass-pick'),massQuick=node('div','chat-mass-quick'),massSearch=node('input');massQuick.setAttribute('role','group');massQuick.setAttribute('aria-label','Selección rápida');
  massSearch.type='search';massSearch.placeholder='Buscar personas';massSearch.setAttribute('aria-label','Buscar personas');
  const massBar=node('div','chat-mass-bar'),massCount=node('span','chat-mass-count'),massSaveOpen=textButton('Guardar como lista','chat-link'),massAll=textButton('Seleccionar visibles','chat-link');massCount.setAttribute('aria-live','polite');massBar.append(massCount,massSaveOpen,massAll);
  const massSave=node('form','chat-mass-save'),massSaveName=node('input'),massSaveBtn=node('button','chat-link','Guardar'),massSaveCancel=textButton('Cancelar','chat-link chat-link-muted');massSave.hidden=true;
  massSaveName.type='text';massSaveName.maxLength=40;massSaveName.placeholder='Nombre de la lista (ej. Equipo Marketing)';massSaveName.setAttribute('aria-label','Nombre de la lista');massSaveBtn.type='submit';massSave.append(massSaveName,massSaveBtn,massSaveCancel);
  massPick.append(massQuick,massSearch,massBar,massSave);
  const massList=node('div','chat-mass-list');massList.setAttribute('role','group');massList.setAttribute('aria-label','Destinatarios');
  const massProgress=node('div','chat-mass-progress'),massMeter=node('span','chat-mass-meter'),massFill=node('span'),massProgressText=node('p','','Enviando…'),massStop=textButton('Detener','chat-link chat-link-muted');massProgress.hidden=true;massMeter.append(massFill);massProgress.append(massProgressText,massMeter,massStop);
  const massStatus=node('p','chat-status');massStatus.setAttribute('role','status');
  const massForm=node('form','chat-mass-compose'),massInput=node('textarea');massInput.rows=1;massInput.maxLength=4000;massInput.placeholder='Escribe el mensaje…';massInput.setAttribute('aria-label','Mensaje para las personas seleccionadas');
  const massSend=node('button','chat-send chat-send-wide'),massSendText=node('span','','Enviar');massSend.type='submit';massSend.disabled=true;massSend.append(svgIcon('send'),massSendText);massForm.append(massInput,massSend);mountEmoji(massForm,massInput);
  mass.append(massHead,massPick,massList,massProgress,massStatus,massForm,node('p','chat-hint','Las respuestas llegarán a tus chats privados. Las listas se guardan en este navegador.'));
  dock.append(empty);if(GROUPS_ENABLED)dock.append(join);dock.append(mass);panel.append(directory,dock);root.append(launcher,panel,announcer);document.body.append(root);
  let user=null,epoch=0,contacts=[],tab='equipo',timer=null,refreshBusy=false;
  const windows=new Map();
  let activeId=null,presenceSession=null,presenceAt=0,presenceBusy=false,presenceKnown=false,presenceDesired=true;
  const onlineUntil=new Map();
  let chatChannel=null,realtimeReady=false,groupChannel=null,groupRealtimeReady=false;
  const notifiedEvents=new Set(),unreadSnapshots=new Map(),pollingAlertedCounts=new Map();
  let groups=[],groupsError=false,joinTarget=null,joinBusy=false,lastTotal=0;
  let newChatOpen=false,massOpen=false,massJob=null,massVisible=[];
  const massSelected=new Set(),massKeys=new Map();
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
    const avatar=node('span','chat-avatar',c.nombre.trim().split(/\s+/).slice(0,2).map(s=>Array.from(s)[0]).join('').toUpperCase());avatar.setAttribute('aria-hidden','true');avatar.dataset.tone=toneOf(c.id);
    if(photoUrls.has(c.id)){const img=node('img','chat-avatar-photo');img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>img.remove();img.src=photoUrls.get(c.id);avatar.append(img)}
    return avatar;
  }
  function groupAvatar(g){const avatar=node('span','chat-avatar chat-avatar-group');avatar.setAttribute('aria-hidden','true');avatar.dataset.tone=toneOf('g'+g.id);avatar.append(svgIcon('users'));return avatar}
  function syncPanel(){
    const showing=!!activeId||joinTarget!==null||massOpen;
    panel.dataset.conversation=String(showing);empty.hidden=showing;join.hidden=joinTarget===null;mass.hidden=!massOpen;
    for(const w of windows.values()){w.el.hidden=w.id!==activeId;w.minimized=w.id!==activeId;w.el.dataset.minimized='false'}
  }
  const conversationCache=new Map();
  function remember(w){conversationCache.delete(w.id);conversationCache.set(w.id,{messages:new Map(w.messages),syncedThrough:w.syncedThrough,hasOlder:w.hasOlder,loaded:w.loaded,readUpTo:w.readUpTo});if(conversationCache.size>20)conversationCache.delete(conversationCache.keys().next().value)}
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
  const backdrop=node('div','chat-backdrop');backdrop.hidden=true;backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);
  backdrop.onclick=()=>toggleDirectory(false);
  function syncMobileLock(){document.body.dataset.mobileChatOpen=String(touchChat()&&!panel.hidden);backdrop.hidden=panel.hidden}
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
      const unread=Math.max(0,Number(row.no_leidos)||0),previous=unreadSnapshots.get(id),live=id.startsWith('g:')?groupRealtimeReady:realtimeReady;
      if(unread<1)pollingAlertedCounts.delete(id);
      if(!live&&previous!==undefined&&unread>previous){
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
  // Canal separado: un fallo de los grupos no afecta al tiempo real de los chats privados.
  function startGroupRealtime(stamp){
    if(!GROUPS_ENABLED||GROUPS_PREVIEW||groupChannel||!user||typeof db.channel!=='function')return;
    groupChannel=db.channel('kja-chat-grupos-'+user)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_grupo_eventos',filter:`destinatario=eq.${user}`},payload=>{
        if(stamp!==epoch||!user)return;
        const event=payload?.new;if(!event||String(event.destinatario)!==String(user))return;
        if(notifyIncomingMessage('g'+event.mensaje_id))void refresh();
      })
      .subscribe(status=>{if(stamp===epoch)groupRealtimeReady=status==='SUBSCRIBED'});
  }
  function toggleDirectory(show){panel.hidden=!show;directory.hidden=false;launcher.setAttribute('aria-expanded',String(show));syncMobileLock();if(show){syncPanel();renderContacts();const w=windows.get(activeId);focusChat(massOpen?massSearch:joinTarget!==null?joinBtn:newChatOpen?ncSearch:w?w.input:search)}else launcher.focus()}
  launcher.onclick=()=>toggleDirectory(panel.hidden);closeDirectory.onclick=()=>toggleDirectory(false);
  function contactRow(c){
    const b=button('Abrir chat con '+c.nombre,null,'chat-contact'),avatar=avatarFor(c),person=node('span','chat-person'),side=node('span','chat-side');
    b.dataset.contact=c.id;
    b.setAttribute('aria-current',String(c.id===activeId));
    person.append(node('strong','',c.nombre),node('small','',(!c.activo?'Cuenta desactivada · ':c.direccion?'Dirección · ':'')+(c.ultimo||'Iniciar conversación')));b.replaceChildren(avatar,person,side);
    if(c.ultimo_at)side.append(node('time','chat-when',shortWhen(c.ultimo_at)));
    if(Number(c.no_leidos)){b.dataset.unread='true';const badge=node('span','chat-count',String(c.no_leidos));badge.setAttribute('aria-label',c.no_leidos+' sin leer');side.append(badge)}
    if(c.activo&&isOnline(c.id)){const dot=node('span','chat-online-dot');dot.setAttribute('role','img');dot.setAttribute('aria-label','En línea');dot.title='En línea';b.append(dot)}
    b.onclick=()=>open(c.id);return b;
  }
  function groupRow(g){
    const key='g:'+g.id,b=button((g.unido?'Abrir grupo ':'Ver grupo ')+g.nombre,null,'chat-contact chat-group-row'),person=node('span','chat-person'),side=node('span','chat-side');
    b.dataset.contact=key;b.setAttribute('aria-current',String(key===activeId||Number(g.id)===joinTarget));
    const detail=!g.unido?members(g):g.ultimo?(g.ultimo_remitente===user?'Tú':firstName(g.ultimo_autor))+': '+g.ultimo:members(g)+' · Escribe el primer mensaje';
    person.append(node('strong','',g.nombre),node('small','',detail));b.replaceChildren(groupAvatar(g),person,side);
    if(!g.unido)side.append(node('span','chat-join-pill','Unirme'));
    else{
      if(g.ultimo_at)side.append(node('time','chat-when',shortWhen(g.ultimo_at)));
      if(Number(g.no_leidos)){b.dataset.unread='true';const badge=node('span','chat-count',String(g.no_leidos));badge.setAttribute('aria-label',g.no_leidos+' sin leer');side.append(badge)}
    }
    b.onclick=()=>g.unido?open(key):openJoin(g);return b;
  }
  function renderContacts(){
    const focusedContact=document.activeElement?.dataset?.contact;
    all.setAttribute('aria-pressed',String(tab==='equipo'));direction.setAttribute('aria-pressed',String(tab==='direccion'));recent.setAttribute('aria-pressed',String(tab==='recientes'));groupTab.setAttribute('aria-pressed',String(tab==='grupos'));
    const groupUnread=groups.reduce((n,g)=>n+(g.unido?Number(g.no_leidos)||0:0),0);groupTab.dataset.unread=String(groupUnread>0);
    const term=search.value.trim().toLocaleLowerCase('es');
    list.replaceChildren();
    const rows=tab==='grupos'?groups.filter(g=>g.nombre.toLocaleLowerCase('es').includes(term)).map(groupRow)
      :contacts.filter(c=>(tab!=='direccion'||c.direccion)&&(tab!=='recientes'||c.ultimo_at||c.ultimo||conversationCache.get(c.id)?.messages.size||windows.get(c.id)?.messages.size)&&c.nombre.toLocaleLowerCase('es').includes(term)).map(contactRow);
    if(GROUPS_PREVIEW&&tab==='grupos')list.append(node('p','chat-preview-note','Vista previa local: los grupos aún no están activos. Nada de lo que hagas aquí se guarda.'));
    for(const b of rows){list.append(b);if(focusedContact===b.dataset.contact)b.focus()}
    if(!rows.length)list.append(node('p','chat-status chat-empty',tab==='grupos'?(groupsError?'Los grupos todavía no están habilitados. Solicita su activación a Sistemas.':groups.length?'No hay grupos con esta búsqueda.':'Cargando grupos…'):tab==='recientes'?'Aquí aparecerán tus conversaciones. Busca a una persona en Equipo o Dirección.':tab==='direccion'?'No hay personas de Dirección disponibles con esta búsqueda.':'No hay personas con esta búsqueda.'));
    const total=contacts.reduce((n,c)=>n+Number(c.no_leidos),0)+groupUnread;count.textContent=total>99?'99+':String(total);count.hidden=!total;
    // Animación breve del contador sobre el ícono cada vez que aumenta (alterna dos claves para reiniciarla).
    if(total>lastTotal)count.dataset.bump=count.dataset.bump==='a'?'b':'a';lastTotal=total;launcher.setAttribute('aria-label',total?`Mensajes: ${total} sin leer`:'Abrir mensajes');
    for(const w of windows.values()){
      if(w.group){const g=groups.find(g=>'g:'+g.id===w.id);if(g)w.online.textContent=members(g);continue}
      const c=contacts.find(c=>c.id===w.id);if(!c)continue;
      w.online.textContent=!c.activo?'Cuenta desactivada':isOnline(w.id)?'En línea':presenceKnown?'Sin conexión':'Estado no disponible';w.online.dataset.online=String(c.activo&&isOnline(w.id));
      const avatar=avatarFor(c);w.avatar.replaceChildren(avatar);
    }
    if(joinTarget!==null)renderJoin();
  }
  const pickTab=name=>()=>{tab=name;renderContacts()};
  search.oninput=renderContacts;all.onclick=pickTab('equipo');direction.onclick=pickTab('direccion');recent.onclick=pickTab('recientes');groupTab.onclick=pickTab('grupos');
  async function rpc(name,args={}){if(GROUPS_PREVIEW&&name.startsWith('chat_grupo'))return previewRpc(name,args);const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
  const missingFeature=error=>error?.message?.includes('schema cache')||error?.code==='PGRST202';
  async function loadGroups(stamp){
    if(!GROUPS_ENABLED)return;
    try{const rows=await rpc('chat_grupos');if(stamp!==epoch)return;groups=Array.isArray(rows)?rows:[];groupsError=false;startGroupRealtime(stamp)}
    catch(error){if(stamp===epoch&&(missingFeature(error)||!groups.length)){groups=[];groupsError=true}}
  }
  function renderJoin(){
    const g=groups.find(g=>Number(g.id)===joinTarget);if(!g||g.unido){closeJoin();return}
    joinTitle.textContent=g.nombre;joinName.textContent=g.nombre;joinCount.textContent=members(g);joinAvatar.dataset.tone=toneOf('g'+g.id);joinBtn.disabled=joinBusy;
  }
  function openJoin(g){joinTarget=Number(g.id);activeId=null;joinStatus.textContent='';if(panel.hidden)toggleDirectory(true);syncPanel();renderContacts();focusChat(joinBtn)}
  function closeJoin(){if(joinTarget===null)return;joinTarget=null;syncPanel();renderContacts();focusChat(search)}
  joinBack.onclick=closeJoin;
  joinBtn.onclick=async()=>{
    if(joinBusy||joinTarget===null||!user)return;
    const stamp=epoch,id=joinTarget;joinBusy=true;joinBtn.disabled=true;joinStatus.dataset.error='false';joinStatus.textContent='Uniéndote al grupo…';
    try{
      await rpc('chat_grupo_unirse',{p_grupo:id});if(stamp!==epoch)return;
      await loadGroups(stamp);if(stamp!==epoch)return;
      joinTarget=null;open('g:'+id);announcer.textContent='Te uniste al grupo '+(groups.find(g=>Number(g.id)===id)?.nombre||'')+'.';
    }catch(error){if(stamp===epoch){joinStatus.dataset.error='true';joinStatus.textContent=error?.code==='P0001'?error.message:'No se pudo confirmar. Vuelve a intentar.'}}
    finally{if(stamp===epoch){joinBusy=false;joinBtn.disabled=false}}
  };
  function targetFor(key){
    if(String(key).startsWith('g:')){const g=groups.find(g=>'g:'+g.id===key&&g.unido);return g&&{kind:'group',groupId:Number(g.id),nombre:g.nombre,activo:true,group:g}}
    const c=contacts.find(c=>c.id===key);return c&&{kind:'dm',nombre:c.nombre,activo:c.activo,contact:c};
  }
  function current(w){return user&&w.epoch===epoch&&windows.get(w.id)===w}
  const incomingFor=(w,m)=>w.group?m.remitente!==user:m.destinatario===user;
  function messageError(error){return missingFeature(error)?'El chat todavía no está habilitado. Solicita su activación a Sistemas.':'No se pudo conectar con el chat. Vuelve a intentar.'}
  function windowNote(w,text,error=false){w.status.textContent=text;w.status.dataset.error=String(error)}
  function renderMessages(w,older=false){
    const rows=[...w.messages.values()].sort((a,b)=>Number(a.id)-Number(b.id));
    const signature=JSON.stringify(rows.map(m=>[m.id,m.contenido,m.imagen_path,m.leido_at,m.creado_at,m.autor]));
    if(w.renderSignature===signature){w.older.hidden=!w.hasOlder;return}
    w.renderSignature=signature;
    w.renderedMessages??=new Map();
    const nearBottom=w.history.scrollHeight-w.history.scrollTop-w.history.clientHeight<70;
    const previousHeight=w.history.scrollHeight,previousTop=w.history.scrollTop;
    w.history.replaceChildren(w.older);
    if(!rows.length)w.history.append(node('p','chat-status chat-start',w.group?'Este es el inicio del grupo. Escribe el primer mensaje.':'Este es el inicio de la conversación.'));
    let prev=null;
    for(const m of rows){
      const mine=m.remitente===user,key=String(m.id),cached=w.renderedMessages.get(key),date=new Date(m.creado_at),prevDate=prev&&new Date(prev.creado_at);
      // Separador por día y mensajes seguidos del mismo autor más juntos.
      const sameDay=!!prev&&dayKey(prevDate)===dayKey(date),follow=sameDay&&prev.remitente===m.remitente&&date-prevDate<5*60000;
      if(!sameDay)w.history.append(node('p','chat-day',dayLabel(date)));
      if(w.group&&!mine&&!follow){const author=node('p','chat-author',m.autor||'Integrante');author.dataset.tone=toneOf(m.remitente);w.history.append(author)}
      const reuse=cached&&cached.content===m.contenido&&cached.path===m.imagen_path;
      const entry=reuse?cached.entry:node('div','chat-message'),time=reuse?cached.time:node('time');entry.dataset.mine=String(mine);entry.dataset.follow=String(follow);time.dateTime=m.creado_at;
      time.textContent=date.toLocaleTimeString('es-PE',{hour:'numeric',minute:'2-digit'})+(mine&&!w.group?(m.leido_at?' · Leído':' · Enviado'):'');
      if(!reuse)entry.append(node('p','chat-bubble',m.contenido),time);w.history.append(entry);
      if(!reuse){
        w.renderedMessages.set(key,{entry,time,content:m.contenido,path:m.imagen_path});
        if(!w.group)window.KJAChatImages?.render(entry,m,db,()=>!!current(w));
      }
      prev=m;
    }
    w.older.hidden=!w.hasOlder;
    if(older)w.history.scrollTop=previousTop+w.history.scrollHeight-previousHeight;
    else if(nearBottom||!w.loaded)w.history.scrollTop=w.history.scrollHeight;
    else w.history.scrollTop=previousTop;
    w.loaded=true;
  }
  async function markRead(w){
    if(!current(w)||panel.hidden||w.id!==activeId||w.minimized||document.hidden||!document.hasFocus()||!w.el.contains(document.activeElement)||!w.el.getClientRects().length||getComputedStyle(w.el).visibility==='hidden'||w.history.scrollHeight-w.history.scrollTop-w.history.clientHeight>70||w.readBusy)return;
    const unread=[...w.messages.values()].filter(m=>incomingFor(w,m)&&(w.group?Number(m.id)>(w.readUpTo||0):!m.leido_at));if(!unread.length)return;
    const last=Math.max(...unread.map(m=>Number(m.id)));
    w.readBusy=true;
    try{
      await rpc(w.group?'chat_grupo_leer':'chat_leer',w.group?{p_grupo:w.groupId,p_hasta:last}:{p_contacto:w.id,p_hasta:last});
      if(current(w)){if(w.group)w.readUpTo=Math.max(w.readUpTo||0,last);else for(const m of unread)m.leido_at=new Date().toISOString()}
    }catch{if(current(w))windowNote(w,'No se pudo confirmar la lectura. Se reintentará.',true)}finally{w.readBusy=false}
  }
  async function history(w,older=false){
    if(!current(w)||w.loading)return;w.loading=true;w.older.disabled=true;const stamp=epoch;
    try{
      const name=w.group?'chat_grupo_historial':'chat_historial',base=w.group?{p_grupo:w.groupId}:{p_contacto:w.id};
      const args={...base};if(older&&w.messages.size)args.p_antes=Math.min(...w.messages.keys());
      let rows=await rpc(name,args);if(stamp!==epoch||!current(w))return;
      const latestKnown=w.syncedThrough;
      const firstSync=latestKnown===null;
      // Rellena el intervalo completo tras una desconexión, antes de confirmar lectura.
      if(!older&&w.loaded&&latestKnown!==null){
        let page=rows;
        while(page.length===50&&Math.min(...page.map(m=>Number(m.id)))>latestKnown){
          page=await rpc(name,{...base,p_antes:Math.min(...page.map(m=>Number(m.id)))});
          if(stamp!==epoch||!current(w))return;rows=rows.concat(page);
        }
      }
      const incoming=rows.filter(m=>incomingFor(w,m)&&!w.messages.has(Number(m.id)));
      const arrived=w.loaded&&!older?incoming.length:0,prefix=w.group?'g':'';
      if(!(w.group?groupRealtimeReady:realtimeReady)&&w.loaded&&!older&&incoming.length){
        let fallbackRemaining=pollingAlertedCounts.get(w.id)||0;
        for(const message of incoming){
          if(fallbackRemaining>0){notifiedEvents.add(prefix+message.id);fallbackRemaining--}
          else notifyIncomingMessage(prefix+message.id);
        }
        if(fallbackRemaining)pollingAlertedCounts.set(w.id,fallbackRemaining);else pollingAlertedCounts.delete(w.id);
      }
      for(const m of rows)w.messages.set(Number(m.id),m);
      if(!older)w.syncedThrough=Math.max(w.syncedThrough||0,...rows.map(m=>Number(m.id)));
      if(older||firstSync)w.hasOlder=rows.length===50;
      if(arrived)announcer.textContent=`${arrived} ${arrived===1?'mensaje nuevo':'mensajes nuevos'} ${w.group?'en el grupo '+w.title:'de '+(contacts.find(c=>c.id===w.id)?.nombre||'tu contacto')}.`;
      renderMessages(w,older);remember(w);windowNote(w,'');await markRead(w);
    }catch(error){if(current(w))windowNote(w,(error?.code==='P0001'?error.message:messageError(error)+' Pulsa Actualizar (↻).'),true)}finally{w.loading=false;w.older.disabled=false}
  }
  function minimize(w,value){if(value){toggleDirectory(false)}else{activeId=w.id;syncPanel();if(!panel.hidden)focusChat(w.input);void history(w)}persist()}
  function close(w){if(w.sending)return;if(openEmoji&&w.el.contains(openEmoji.panel))closeEmoji();window.KJAChatImages?.clear(w);remember(w);windows.delete(w.id);w.el.remove();if(activeId===w.id)activeId=null;syncPanel();renderContacts();persist();focusChat(search)}
  async function leaveGroup(w){
    if(w.sending||w.leaving||!confirm(`¿Salir del grupo ${w.title}? Dejarás de ver sus mensajes hasta que vuelvas a unirte.`))return;
    const stamp=epoch;w.leaving=true;w.leave.disabled=true;windowNote(w,'Saliendo del grupo…');
    try{
      await rpc('chat_grupo_salir',{p_grupo:w.groupId});if(stamp!==epoch||!current(w))return;
      close(w);conversationCache.delete(w.id);await loadGroups(stamp);if(stamp===epoch){renderContacts();announcer.textContent='Saliste del grupo '+w.title+'.'}
    }catch(error){if(current(w))windowNote(w,error?.code==='P0001'?error.message:'No se pudo salir del grupo. Vuelve a intentar.',true)}
    finally{w.leaving=false;if(current(w))w.leave.disabled=false}
  }
  function open(id,options={}){
    const t=targetFor(id);if(!t)return;
    joinTarget=null;massOpen=false;if(newChatOpen)closeNewChat(false);
    if(!options.restore)toggleDirectory(true);
    if(windows.has(id)){const w=windows.get(id);dock.append(w.el);minimize(w,false);renderContacts();return}
    if(windows.size>=2){const victim=[...windows.values()].find(w=>!w.sending&&!w.compressing&&!w.attachment&&!w.input.value.trim());if(!victim){toggleDirectory(true);note('Cierra una conversación o envía su borrador para abrir otra.',true);return}close(victim)}
    const w={id,group:t.kind==='group',groupId:t.groupId,title:t.nombre,epoch,minimized:false,messages:new Map(),syncedThrough:null,loaded:false,hasOlder:false,loading:false,sending:false,pending:null,readUpTo:0};
    const cached=conversationCache.get(id);if(cached)Object.assign(w,{...cached,messages:new Map(cached.messages)});
    w.el=node('section','chat-window'+(w.group?' is-group':''));w.el.setAttribute('aria-label',(w.group?'Grupo ':'Conversación con ')+t.nombre);
    const head=node('header','chat-heading');w.toggle=button('Minimizar chat','minus');w.close=button('Cerrar conversación','close');const title=node('strong','chat-peer-title',t.nombre);w.online=node('small','chat-peer-state');title.append(w.online);head.append(title,w.toggle,w.close);
    w.avatar=node('span','chat-peer-avatar');w.avatar.append(w.group?groupAvatar(t.group):avatarFor(t.contact));const back=button('Volver a las personas','back','chat-icon chat-back');back.onclick=()=>{activeId=null;syncPanel();renderContacts();focusChat(search)};head.append(w.avatar,back);
    const update=button('Actualizar conversación','refresh','chat-icon chat-refresh');update.onclick=()=>history(w);head.append(update);
    if(w.group){w.online.textContent=members(t.group);w.leave=button('Salir del grupo','leave','chat-icon chat-leave');w.leave.onclick=()=>void leaveGroup(w);head.append(w.leave)}
    const body=node('div','chat-body');w.history=node('div','chat-history');w.history.setAttribute('role','log');w.history.setAttribute('aria-live','off');w.history.setAttribute('aria-label','Historial de mensajes');w.history.tabIndex=0;
    w.older=button('Ver mensajes anteriores',null,'chat-older');w.older.hidden=true;w.older.onclick=()=>history(w,true);
    w.status=node('p','chat-status');w.status.setAttribute('role','status');
    const form=node('form','chat-compose');w.input=node('textarea');w.input.rows=1;w.input.maxLength=4000;w.input.placeholder=w.group?'Mensaje para el grupo…':'Mensaje…';w.input.setAttribute('aria-label',(w.group?'Mensaje para el grupo ':'Mensaje para ')+t.nombre);w.input.disabled=!t.activo;
    w.send=button('Enviar mensaje','send','chat-send');w.send.type='submit';w.send.disabled=true;form.append(w.input,w.send);
    w.input.oninput=()=>{w.send.disabled=w.sending||w.compressing||!t.activo||(!w.input.value.trim()&&!w.attachment);w.input.style.height='auto';w.input.style.height=Math.min(100,Math.max(44,w.input.scrollHeight))+'px'};
    form.onsubmit=async e=>{
      e.preventDefault();if(!current(w)||w.sending||w.compressing||!t.activo||(!w.input.value.trim()&&!w.attachment))return;
      const content=w.input.value.trim();if(Array.from(content).length>4000){windowNote(w,'El mensaje supera 4000 caracteres.',true);return}
      if(!w.pending||w.pending.content!==content||w.pending.imageKey!==w.attachment?.key)w.pending={id:crypto.randomUUID(),content,imageKey:w.attachment?.key};
      w.sending=true;w.send.disabled=true;w.input.disabled=true;w.close.disabled=true;windowNote(w,'Enviando…');
      try{
        const m=w.group?await rpc('chat_grupo_enviar',{p_grupo:w.groupId,p_contenido:content,p_cliente_id:w.pending.id})
          :w.attachment?await window.KJAChatImages.send(w,db,user,content,current):await rpc('chat_enviar',{p_contacto:id,p_contenido:content,p_cliente_id:w.pending.id});if(!current(w))return;
        window.KJAChatImages?.clear(w);
        w.messages.set(Number(m.id),m);w.input.value='';w.pending=null;renderMessages(w);remember(w);w.history.scrollTop=w.history.scrollHeight;windowNote(w,'Mensaje enviado.');void refresh();
      }catch(error){if(current(w))windowNote(w,(error?.code==='P0001'?error.message:'No se confirmó el envío. Tu texto se conserva; pulsa Enviar para reintentar.'),true)}
      finally{w.sending=false;if(current(w)){w.input.disabled=!t.activo;w.close.disabled=false;w.input.oninput();if(!touchChat())w.input.focus()}}
    };
    w.input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}};
    w.toggle.onclick=()=>minimize(w,!w.minimized);w.close.onclick=()=>{if((w.input.value.trim()||w.attachment||w.compressing)&&!confirm('¿Cerrar esta conversación y descartar el mensaje sin enviar?'))return;close(w)};
    w.el.addEventListener('focusin',()=>void markRead(w));w.history.addEventListener('scroll',()=>void markRead(w));
    const hint=w.group?(GROUPS_PREVIEW?'Vista previa · estos mensajes no se guardan ni se envían a nadie':'Lo verán todas las personas del grupo · Enter envía'):t.activo?'Enter envía · Shift + Enter agrega una línea':'Cuenta desactivada. Solo puedes consultar el historial.';
    body.append(w.history,w.status,form,node('p','chat-hint',hint));w.el.append(head,body);windows.set(id,w);dock.append(w.el);
    if(t.activo&&!w.group)window.KJAChatImages?.mount(w,form,current,windowNote);
    if(t.activo)mountEmoji(form,w.input);
    if(w.messages.size){renderMessages(w);w.history.scrollTop=w.history.scrollHeight}else windowNote(w,'Cargando historial…');
    if(!options.restore||!options.minimized)minimize(w,false);else w.el.hidden=true;renderContacts();void history(w);persist();
  }
  // ── Nuevo chat y mensaje a varios ──────────────────────────────────
  // Disponible para todo el personal: no da un permiso nuevo, solo agiliza escribir a cada persona por separado.
  const plural=(n,one,many)=>n+' '+(n===1?one:many);
  function optionRow(icon,title,detail,action){
    const b=node('button','chat-option'),mark=node('span','chat-option-icon'),text=node('span','chat-option-text');b.type='button';mark.setAttribute('aria-hidden','true');mark.append(svgIcon(icon));
    text.append(node('strong','',title),node('small','',detail));b.append(mark,text);b.onclick=action;return b;
  }
  function pickRow(avatar,title,detail,action,key){
    const b=node('button','chat-pick'),person=node('span','chat-person');b.type='button';b.dataset.pick=key;
    person.append(node('strong','',title));if(detail)person.append(node('small','',detail));b.append(avatar,person);b.onclick=action;return b;
  }
  function listAvatar(key){const avatar=node('span','chat-avatar chat-avatar-group');avatar.setAttribute('aria-hidden','true');avatar.dataset.tone=toneOf(key);avatar.append(svgIcon('megaphone'));return avatar}
  // Nuevo chat: varias personas, un grupo de área, una lista de envío o una persona.
  function renderNewChat(){
    const term=ncSearch.value.trim().toLocaleLowerCase('es'),match=text=>String(text).toLocaleLowerCase('es').includes(term);ncBody.replaceChildren();
    if(!term)ncBody.append(optionRow('users','Mensaje a varias personas','Marca a quienes quieras y envía de una vez',()=>{closeNewChat(false);openMass()}));
    const section=(label,rows)=>{if(!rows.length)return;ncBody.append(node('p','chat-newchat-label',label),...rows)};
    if(GROUPS_ENABLED)section('Grupos',groups.filter(g=>match(g.nombre)).map(g=>pickRow(groupAvatar(g),g.nombre,g.unido?members(g):members(g)+' · Toca para unirte',()=>{closeNewChat(false);if(g.unido)open('g:'+g.id);else openJoin(g)},'g:'+g.id)));
    section('Listas de envío',sendSets().filter(s=>s.ids.length&&match(s.label)).map(s=>pickRow(listAvatar(s.key),s.label,plural(s.ids.length,'persona','personas')+' · Envío a cada una en privado',()=>{closeNewChat(false);openMass(s.ids)},s.key)));
    const people=contacts.filter(c=>c.activo&&match(c.nombre));
    section(term?'Personas encontradas':'Personas',people.map(c=>pickRow(avatarFor(c),c.nombre,c.direccion?'Dirección':'',()=>open(c.id),c.id)));
    if(!ncBody.children.length)ncBody.append(node('p','chat-status chat-empty','No hay resultados con esta búsqueda.'));
  }
  function openNewChat(){newChatOpen=true;newChat.hidden=false;directory.dataset.view='new';ncSearch.value='';renderNewChat();focusChat(ncSearch)}
  function closeNewChat(focus=true){newChatOpen=false;newChat.hidden=true;delete directory.dataset.view;ncBody.replaceChildren();if(focus)focusChat(search)}
  newChatBtn.onclick=openNewChat;ncBack.onclick=()=>closeNewChat();ncSearch.oninput=renderNewChat;

  // Listas guardadas por cuenta en este navegador (atajo de selección; no viajan al servidor).
  const listKey=()=>'kja-chat-listas:'+user;
  function loadLists(){try{const saved=JSON.parse(localStorage.getItem(listKey())||'[]');return Array.isArray(saved)?saved.filter(l=>l&&typeof l.nombre==='string'&&Array.isArray(l.ids)):[]}catch{return []}}
  function storeLists(lists){try{localStorage.setItem(listKey(),JSON.stringify(lists));return true}catch{return false}}
  function massNote(text,error=false){massStatus.textContent=text;massStatus.dataset.error=String(error)}
  const massPeople=()=>contacts.filter(c=>c.activo);
  // Listas de envío: todo el equipo, Dirección y las listas guardadas (solo personas activas).
  function sendSets(){
    const people=massPeople(),available=new Set(people.map(c=>c.id)),sets=[{key:'todos',label:'Todo el equipo',ids:people.map(c=>c.id)}],direccion=people.filter(c=>c.direccion).map(c=>c.id);
    if(direccion.length)sets.push({key:'direccion',label:'Dirección',ids:direccion});
    for(const l of loadLists())sets.push({key:'lista:'+l.id,label:l.nombre,ids:l.ids.filter(id=>available.has(id)),list:l});
    return sets;
  }
  let massChips=[];
  function renderMass(){
    if(!massOpen)return;
    const busy=!!massJob,available=new Set(massPeople().map(c=>c.id)),people=massPeople();
    for(const id of [...massSelected])if(!available.has(id))massSelected.delete(id);
    massQuick.replaceChildren();massChips=[];
    for(const s of sendSets()){
      const chip=textButton(`${s.label} · ${s.ids.length}`,'chat-chip');chip.disabled=busy||!s.ids.length;
      chip.onclick=()=>{const allOn=s.ids.every(id=>massSelected.has(id));for(const id of s.ids){if(allOn)massSelected.delete(id);else massSelected.add(id)}renderMass()};
      massChips.push({chip,ids:s.ids});
      if(!s.list){massQuick.append(chip);continue}
      const wrap=node('span','chat-chip-wrap'),remove=button('Eliminar lista '+s.label,'close','chat-chip-x');remove.disabled=busy;
      remove.onclick=()=>{if(!confirm(`¿Eliminar la lista «${s.label}»? No se borra ningún mensaje.`))return;storeLists(loadLists().filter(l=>l.id!==s.list.id));renderMass()};
      wrap.append(chip,remove);massQuick.append(wrap);
    }
    const term=massSearch.value.trim().toLocaleLowerCase('es');
    massVisible=people.filter(c=>c.nombre.toLocaleLowerCase('es').includes(term));
    massList.replaceChildren();
    for(const c of massVisible){
      const row=node('label','chat-mass-row'),box=node('input'),person=node('span','chat-person');
      box.type='checkbox';box.checked=massSelected.has(c.id);box.disabled=busy;box.onchange=()=>{if(box.checked)massSelected.add(c.id);else massSelected.delete(c.id);syncMass()};
      person.append(node('strong','',c.nombre));if(c.direccion)person.append(node('small','','Dirección'));row.append(box,avatarFor(c),person);massList.append(row);
    }
    if(!massVisible.length)massList.append(node('p','chat-status chat-empty','No hay personas con esta búsqueda.'));
    syncMass();
  }
  function syncMass(){
    const n=massSelected.size,busy=!!massJob,visibleOn=massVisible.length>0&&massVisible.every(c=>massSelected.has(c.id));
    for(const {chip,ids} of massChips)chip.setAttribute('aria-pressed',String(ids.length>0&&ids.every(id=>massSelected.has(id))));
    massCount.textContent=n?plural(n,'persona seleccionada','personas seleccionadas'):'Elige a quién enviar';
    massAll.textContent=visibleOn?'Quitar visibles':'Seleccionar visibles';massAll.disabled=busy||!massVisible.length;
    massSaveOpen.hidden=!n;massSaveOpen.disabled=busy;massSearch.disabled=busy;massInput.disabled=busy;
    massSend.disabled=busy||!n||!massInput.value.trim();massSendText.textContent=n?`Enviar a ${n}`:'Enviar';
  }
  function openMass(preselect){if(Array.isArray(preselect)&&!massJob){massSelected.clear();for(const id of preselect)massSelected.add(id)}massOpen=true;activeId=null;joinTarget=null;if(panel.hidden)toggleDirectory(true);syncPanel();renderContacts();renderMass();focusChat(massSearch)}
  function closeMass(){massOpen=false;massSave.hidden=true;syncPanel();renderContacts();focusChat(search)}
  massClose.onclick=closeMass;massBack.onclick=closeMass;massSearch.oninput=renderMass;
  massAll.onclick=()=>{const visibleOn=massVisible.every(c=>massSelected.has(c.id));for(const c of massVisible){if(visibleOn)massSelected.delete(c.id);else massSelected.add(c.id)}renderMass()};
  massInput.oninput=()=>{massInput.style.height='auto';massInput.style.height=Math.min(140,Math.max(44,massInput.scrollHeight))+'px';syncMass()};
  massSaveOpen.onclick=()=>{massSave.hidden=false;massSaveName.value='';massSaveName.focus()};
  massSaveCancel.onclick=()=>{massSave.hidden=true};
  massSave.onsubmit=e=>{
    e.preventDefault();const nombre=massSaveName.value.trim().replace(/\s+/g,' ');
    if(!nombre){massNote('Escribe un nombre para la lista.',true);return}
    const lists=loadLists(),same=lists.find(l=>l.nombre.toLocaleLowerCase('es')===nombre.toLocaleLowerCase('es')),ids=[...massSelected];
    if(same)same.ids=ids;else{if(lists.length>=20){massNote('Puedes guardar hasta 20 listas. Elimina una para crear otra.',true);return}lists.push({id:crypto.randomUUID(),nombre,ids})}
    if(!storeLists(lists)){massNote('No se pudo guardar la lista en este navegador.',true);return}
    massSave.hidden=true;massNote(`Lista «${nombre}» guardada con ${plural(ids.length,'persona','personas')}.`);renderMass();
  };
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  // El servidor admite 30 mensajes por minuto por cuenta: al llegar al límite se espera y se continúa.
  async function waitForLimit(job,stamp){
    for(let s=60;s>0;s--){if(job.cancel||stamp!==epoch)return false;massProgressText.textContent=`Límite de 30 mensajes por minuto alcanzado. Continúa en ${s} s…`;await sleep(1000)}
    return !job.cancel&&stamp===epoch;
  }
  massForm.onsubmit=async e=>{
    e.preventDefault();if(massJob||!user)return;
    const text=massInput.value.trim(),people=massPeople().filter(c=>massSelected.has(c.id));if(!people.length||!text)return;
    if(Array.from(text).length>4000){massNote('El mensaje supera 4000 caracteres.',true);return}
    if(people.length>1&&!confirm(`¿Enviar este mensaje a ${people.length} personas? Cada una lo recibirá en su chat privado contigo.`))return;
    // Cada destinatario conserva su identificador: un reintento nunca duplica un mensaje ya guardado.
    const stamp=epoch,job={cancel:false,queue:people.map(c=>{const k=c.id+'|'+text;if(!massKeys.has(k))massKeys.set(k,crypto.randomUUID());return {id:c.id,nombre:c.nombre,key:massKeys.get(k),done:false,error:''}})};
    const total=job.queue.length,progress=()=>{const sent=job.queue.filter(r=>r.done).length;massFill.style.width=Math.round(sent/total*100)+'%';return sent};
    massJob=job;massNote('');massProgress.hidden=false;progress();renderMass();
    for(const r of job.queue){
      let attempts=0;
      while(!r.done&&!r.error&&!job.cancel&&stamp===epoch){
        massProgressText.textContent=`Enviando ${progress()+1} de ${total}…`;
        try{await rpc('chat_enviar',{p_contacto:r.id,p_contenido:text,p_cliente_id:r.key});r.done=true}
        catch(error){
          if(stamp!==epoch)return;
          if(error?.code==='P0001'&&/muchos mensajes/i.test(error.message||'')){if(!await waitForLimit(job,stamp))break}
          else if(error?.code==='P0001')r.error=error.message;
          else if(++attempts<3)await sleep(1500);
          else r.error='No se confirmó el envío';
        }
      }
      if(job.cancel||stamp!==epoch)break;
    }
    if(stamp!==epoch)return;
    const sent=progress(),failed=job.queue.filter(r=>r.error),pending=job.queue.filter(r=>!r.done&&!r.error);
    for(const r of job.queue)if(r.done){massSelected.delete(r.id);massKeys.delete(r.id+'|'+text)}
    massJob=null;massProgress.hidden=true;
    if(sent===total){massInput.value='';massNote(`Mensaje enviado a ${plural(sent,'persona','personas')}.`)}
    else{
      const parts=[`Se envió a ${sent} de ${total}.`];
      if(failed.length)parts.push('No se pudo enviar a: '+failed.map(r=>`${r.nombre} (${r.error})`).join(', ')+'.');
      if(pending.length)parts.push(`Quedaron ${plural(pending.length,'persona','personas')} sin enviar.`);
      parts.push(failed.length+pending.length===1?'Sigue seleccionada para que puedas reintentar.':'Siguen seleccionadas para que puedas reintentar.');massNote(parts.join(' '),true);
    }
    announcer.textContent=massStatus.textContent;massInput.oninput();renderMass();void refresh();
  };
  massStop.onclick=()=>{if(massJob){massJob.cancel=true;massProgressText.textContent='Deteniendo…'}};

  async function refresh(){
    if(!user)return;renderContacts();if(!document.hidden)void presence();
    if(refreshBusy||document.hidden)return;refreshBusy=true;const stamp=epoch;
    try{
      const data=await rpc('chat_contactos');if(stamp!==epoch)return;
      await loadGroups(stamp);if(stamp!==epoch)return;
      syncUnreadSnapshots(GROUPS_ENABLED?[...data,...groups.filter(g=>g.unido).map(g=>({id:'g:'+g.id,no_leidos:g.no_leidos}))]:data);contacts=data;renderContacts();note('Mensajes privados · Historial guardado');void refreshPhotos(stamp);
      await Promise.all([...windows.values()].filter(w=>!w.minimized).map(w=>history(w)));
    }catch(error){if(stamp===epoch)note(messageError(error),true)}finally{if(stamp===epoch)refreshBusy=false}
  }
  function destroy(){epoch++;closeEmoji();if(chatChannel){void db.removeChannel(chatChannel);chatChannel=null}if(groupChannel){void db.removeChannel(groupChannel);groupChannel=null}realtimeReady=false;groupRealtimeReady=false;notifiedEvents.clear();unreadSnapshots.clear();pollingAlertedCounts.clear();clearInterval(timer);timer=null;user=null;contacts=[];windows.clear();activeId=null;presenceSession=null;presenceAt=0;presenceBusy=false;presenceKnown=false;presenceDesired=true;onlineUntil.clear();conversationCache.clear();tab='equipo';photoCache.clear();photoUrls.clear();photoBusy=false;photoCheckAt=0;
    groups=[];groupsError=false;joinTarget=null;joinBusy=false;joinStatus.textContent='';lastTotal=0;delete count.dataset.bump;
    if(massJob)massJob.cancel=true;massJob=null;massOpen=false;massSelected.clear();massKeys.clear();massVisible=[];massInput.value='';massSearch.value='';massStatus.textContent='';massProgress.hidden=true;massSave.hidden=true;massList.replaceChildren();massQuick.replaceChildren();
    newChatOpen=false;newChat.hidden=true;delete directory.dataset.view;ncSearch.value='';ncBody.replaceChildren();
    dock.replaceChildren(empty);if(GROUPS_ENABLED)dock.append(join);dock.append(mass);empty.hidden=false;join.hidden=true;mass.hidden=true;panel.hidden=true;syncMobileLock();list.replaceChildren();announcer.textContent='';root.hidden=true;directory.hidden=true;search.value='';count.hidden=true;refreshBusy=false;launcher.setAttribute('aria-expanded','false')}
  retry.onclick=()=>void refresh();
  document.addEventListener('visibilitychange',()=>{presenceAt=0;void presence(!document.hidden);if(!document.hidden)void refresh()});
  window.addEventListener('pagehide',()=>void presence(false));
  window.addEventListener('focus',()=>void refresh());
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){if(newChatOpen&&newChat.contains(e.target))closeNewChat();else if(!directory.hidden)toggleDirectory(false);else{const w=[...windows.values()].find(w=>w.el.contains(e.target));if(w){minimize(w,true);launcher.focus()}}}});
  window.addEventListener('beforeunload',e=>{if(massJob||massInput.value.trim()||[...windows.values()].some(w=>w.sending||w.compressing||w.attachment||w.input.value.trim())){e.preventDefault();e.returnValue=''}});
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
  // Avisa a dashboard.js si inició sesión antes de que cargara este script. Protegido para entornos sin Event (pruebas).
  try{window.dispatchEvent(new Event('kja-chat-ready'))}catch{}
})();
