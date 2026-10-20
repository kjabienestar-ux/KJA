/* Extiende la mensajería compartida por usuarios y administradores.
   Operate: conserva los colores KJA; acciones junto al mensaje, borrador siempre visible.
   El servidor decide capacidades y permisos. Sin migración se conserva el chat anterior. */
(function(){
  'use strict';
  const MAX=20*1024*1024;
  const types={
    pdf:'application/pdf',txt:'text/plain',csv:'text/csv',doc:'application/msword',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    webm:'video/webm',mp4:'video/mp4',mp3:'audio/mpeg',m4a:'audio/mp4',ogg:'audio/ogg',wav:'audio/wav',
    jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'
  };
  const allowed=new Set([...Object.values(types),'audio/webm']);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const btn=(text,action,cls='chat-action')=>{const n=el('button',cls,text);n.type='button';n.onclick=action;return n};
  const args=w=>w.group?{p_grupo:w.groupId}:{p_contacto:w.id};
  const errorText=e=>e?.code==='P0001'?e.message:'No se pudo completar. Vuelve a intentar.';
  function validateFile(file){
    const mime=(file.type||types[file.name?.split('.').pop().toLowerCase()]||'').split(';')[0];
    if(!allowed.has(mime))throw Error('Elige un documento, imagen, video o audio compatible.');
    if(!file.size||file.size>MAX)throw Error('El archivo debe pesar entre 1 byte y 20 MB.');
    if(!file.name||file.name.length>180)throw Error('Usa un nombre de archivo de hasta 180 caracteres.');
    return mime;
  }
  function clear(w){
    w.mediaGeneration=(w.mediaGeneration||0)+1;
    if(w.recording){w.recording.cancel=true;try{if(w.recording.recorder.state!=='inactive')w.recording.recorder.stop()}catch{}w.recording.stream.getTracks().forEach(t=>t.stop());clearTimeout(w.recording.timeout);w.recording=null}
    if(w.attachment?.url)URL.revokeObjectURL(w.attachment.url);
    w.attachment=null;w.recordingPending=false;
    w.filePreview?.replaceChildren();if(w.fileInput)w.fileInput.value='';
    if(w.mic)w.mic.textContent='Grabar audio';
  }
  function mode(w,kind,message){
    if(!w.modeBar||w.sending||w.recording||w.recordingPending)return;
    if(kind==='editar'&&(w.attachment||w.input.value.trim())&&!confirm('¿Reemplazar el borrador para editar este mensaje?'))return;
    if(kind==='editar'){clear(w);w.savedDraft=w.input.value;w.editing=message;w.reply=null;w.input.value=message.contenido}
    else {if(w.editing)w.input.value=w.savedDraft||'';w.editing=null;w.reply=message}
    w.pending=null;
    w.modeBar.replaceChildren(el('span','',`${kind==='editar'?'Editando':'Responder a '+(message.autor||'mensaje')}: ${message.contenido.slice(0,120)}`),
      btn('Cancelar',()=>resetMode(w,true)));
    w.modeBar.hidden=false;w.input.oninput();w.input.focus();
  }
  function resetMode(w,restore=false){
    if(restore&&w.editing)w.input.value=w.savedDraft||'';
    w.editing=null;w.reply=null;w.savedDraft=null;w.pending=null;
    w.modeBar.hidden=true;w.modeBar.replaceChildren();w.input.oninput();
  }
  async function send(w,db,user,current){
    if(w.editing){
      const {data,error}=await db.rpc('chat_v2_accion',{p_grupo:w.group,p_id:w.editing.id,p_accion:'editar',p_texto:w.input.value.trim()});
      if(error)throw error;return data;
    }
    const a=w.attachment,pending=w.pending;
    if(a&&!pending.uploaded){
      const path=user+'/'+pending.id;
      const {error}=await db.storage.from('chat-archivos').upload(path,a.blob,{contentType:a.mime,upsert:false});
      if(error&&String(error.statusCode)!=='409'&&error.error!=='Duplicate')throw error;
      if(!current(w))return null;pending.uploaded=true;
    }
    const {data,error}=await db.rpc('chat_v2_enviar',{...args(w),p_cliente_id:pending.id,p_contenido:w.input.value.trim(),
      p_respuesta:w.reply?.id||null,p_archivo:a?user+'/'+pending.id:null,p_nombre:a?.name||null});
    if(error)throw error;return data;
  }
  function mount(w,form,head,api){
    w.modeBar=el('div','chat-compose-context');w.modeBar.hidden=true;form.before(w.modeBar);
    w.filePreview=el('div','chat-file-preview');form.before(w.filePreview);
    const toolbar=el('div','chat-compose-tools');form.before(toolbar);
    const file=el('input');file.type='file';file.accept=Object.keys(types).map(ext=>'.'+ext).join(',');file.hidden=true;w.fileInput=file;toolbar.append(file);
    async function prepare(f){
      if(w.sending||w.compressing||w.editing||w.recordingPending)return;
      const generation=w.mediaGeneration||0;
      try{
        let mime=validateFile(f);
        if(mime.startsWith('image/')&&window.KJAChatImages){
          w.compressing=true;w.input.oninput();api.note(w,'Preparando imagen…');
          const blob=await window.KJAChatImages.compress(f);
          if(!api.current(w)||(w.mediaGeneration||0)!==generation)return;
          f=new File([blob],f.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});mime='image/jpeg';
        }
        clear(w);w.pending=null;
        w.attachment={blob:f,mime,name:f.name,key:crypto.randomUUID(),url:URL.createObjectURL(f)};
        const label=el('span','',f.name+' · '+(f.size/1024/1024).toFixed(1)+' MB');
        const remove=btn('Quitar',()=>{if(w.sending)return;clear(w);w.pending=null;w.input.oninput()});
        w.filePreview.append(label,remove);
        if(mime.startsWith('audio/')){const player=el('audio');player.controls=true;player.src=w.attachment.url;w.filePreview.append(player)}
        w.input.oninput();api.note(w,'');
      }catch(e){if(api.current(w))api.note(w,e.message,true)}
      finally{w.compressing=false;if(api.current(w))w.input.oninput()}
    }
    toolbar.append(btn('Adjuntar',()=>{if(!w.sending&&!w.editing&&!w.recording)file.click()}));
    file.onchange=()=>{if(file.files?.[0])void prepare(file.files[0])};
    w.mic=btn('Grabar audio',async()=>{
      if(w.recording){if(w.recording.recorder.state==='recording'){w.mic.disabled=true;w.recording.recorder.stop()}return}
      if(w.sending||w.compressing||w.editing||w.recordingPending)return;
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){api.note(w,'Este navegador no permite grabar. Puedes adjuntar un audio.',true);return}
      if(w.attachment&&!confirm('¿Reemplazar el archivo adjunto con una nota de voz?'))return;
      clear(w);const generation=w.mediaGeneration;
      w.recordingPending=true;w.input.oninput();w.mic.disabled=true;
      let stream;
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        if(!api.current(w)||generation!==w.mediaGeneration){stream.getTracks().forEach(t=>t.stop());return}
        const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
        if(!mime)throw Error('Formato de grabación no compatible. Adjunta un audio.');
        const recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];
        const recording={recorder,stream,cancel:false,timeout:null};let size=0;
        w.recording=recording;w.recordingPending=false;
        recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>MAX&&recorder.state==='recording')recorder.stop()}};
        recorder.onerror=()=>{recording.cancel=true;clear(w);w.mic.disabled=false;w.input.oninput();api.note(w,'No se pudo grabar. Vuelve a intentar.',true)};
        recorder.onstop=()=>{
          clearTimeout(recording.timeout);stream.getTracks().forEach(t=>t.stop());
          if(w.recording===recording)w.recording=null;
          if(!api.current(w)||recording.cancel)return;
          w.mic.disabled=false;w.mic.textContent='Grabar audio';
          const base=mime.split(';')[0],ext=base==='audio/mp4'?'m4a':base==='audio/ogg'?'ogg':'webm';
          void prepare(new File(chunks,'Nota de voz.'+ext,{type:base}));w.input.oninput();
        };
        recorder.start(1000);w.mic.textContent='Detener grabación';w.mic.disabled=false;
        recording.timeout=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},120000);
        api.note(w,'Grabando audio · máximo 2 minutos. Pulsa Detener para escucharlo antes de enviar.');w.input.oninput();
      }catch(e){stream?.getTracks().forEach(t=>t.stop());if(api.current(w)){api.note(w,e.name==='NotAllowedError'?'Permite el micrófono en tu navegador para grabar.':e.message,true)}}
      finally{if(api.current(w)&&generation===w.mediaGeneration){w.recordingPending=false;w.mic.disabled=false;w.input.oninput()}}
    });
    toolbar.append(w.mic);
    const searchToggle=btn('Buscar',()=>{searchBox.hidden=!searchBox.hidden;if(!searchBox.hidden)query.focus()},'chat-action chat-search-toggle');toolbar.append(searchToggle);
    const searchBox=el('form','chat-message-search');searchBox.hidden=true;
    const query=el('input');query.type='search';query.maxLength=200;query.placeholder='Buscar en esta conversación';query.setAttribute('aria-label',query.placeholder);
    const submit=el('button','chat-action','Buscar');submit.type='submit';
    const results=el('div','chat-search-results');results.setAttribute('aria-live','polite');
    const close=btn('Cerrar',()=>{w.searchGeneration=(w.searchGeneration||0)+1;submit.disabled=false;searchBox.hidden=true;results.replaceChildren();w.input.focus()});
    searchBox.append(query,submit,close,results);w.history.before(searchBox);
    let before=null;
    async function searchMore(more=false){
      const text=query.value.trim();if(!text)return;
      const request=w.searchGeneration=(w.searchGeneration||0)+1;
      submit.disabled=true;if(!more){results.replaceChildren(el('p','','Buscando…'));before=null}
      try{
        const {data,error}=await api.db.rpc('chat_v2_historial',{...args(w),p_buscar:text,p_antes:more?before:null});
        if(!api.current(w)||request!==w.searchGeneration)return;if(error)throw error;
        if(!more)results.replaceChildren();
        results.querySelector('.chat-search-more')?.remove();
        for(const m of data||[]){
          const item=el('article','chat-search-result');
          item.append(el('small','',(m.autor||'Mensaje')+' · '+new Date(m.creado_at).toLocaleString('es-PE')),el('p','',m.contenido));
          if(m.archivo_nombre)item.append(el('small','',m.archivo_nombre));
          item.append(btn('Responder',()=>{mode(w,'responder',m);searchBox.hidden=true}));results.append(item);
        }
        if(!data?.length&&!more)results.append(el('p','','No hay coincidencias.'));
        if(data?.length===50){before=data.at(-1).id;results.append(btn('Más resultados',()=>void searchMore(true),'chat-action chat-search-more'))}
      }catch(e){if(api.current(w)&&request===w.searchGeneration)results.replaceChildren(el('p','',errorText(e)))}
      finally{if(api.current(w)&&request===w.searchGeneration)submit.disabled=false}
    }
    searchBox.onsubmit=e=>{e.preventDefault();void searchMore()};
    w.modernApi=api;
    if(w.group&&api.capabilities().administrar_grupos)toolbar.append(btn('Integrantes',()=>void groupInfo(w,api),'chat-action'));
  }
  function groupPanel(parent,title){
    parent.querySelector('.chat-group-editor')?.remove();
    const box=el('section','chat-group-editor'),heading=el('header'),content=el('div','chat-group-content'),status=el('p','chat-status');
    status.setAttribute('role','status');heading.append(el('strong','',title),btn('Cerrar',()=>box.remove()));
    box.append(heading,content,status);parent.append(box);return {box,content,status};
  }
  function createGroup(parent,api){
    const session=api.session();
    const {box,content,status}=groupPanel(parent,'Crear grupo privado');
    const name=el('input');name.placeholder='Nombre del grupo';name.maxLength=60;name.setAttribute('aria-label','Nombre del grupo');
    const help=el('p','','Solo las personas que agregues podrán ver el grupo y su historial.');
    const people=el('div','chat-group-people'),selected=new Set();
    for(const c of api.contacts().filter(c=>c.activo)){
      const label=el('label'),check=el('input');check.type='checkbox';check.onchange=()=>{if(check.checked)selected.add(c.id);else selected.delete(c.id)};
      label.append(check,el('span','',c.nombre));people.append(label);
    }
    const save=btn('Crear grupo',async()=>{
      if(session!==api.session()||!box.isConnected)return;
      if(!name.value.trim()||!selected.size){status.textContent='Escribe un nombre y selecciona al menos una persona.';return}
      save.disabled=true;status.textContent='Creando grupo…';
      const identity=api.user();
      try{
        const {error}=await api.db.rpc('chat_grupo_crear',{p_nombre:name.value.trim(),p_miembros:[...selected]});
        if(identity!==api.user()||session!==api.session()||!box.isConnected)return;if(error)throw error;
        await api.refresh();box.remove();
      }catch(e){if(identity===api.user()&&session===api.session()&&box.isConnected)status.textContent=errorText(e)}
      finally{save.disabled=false}
    });
    content.append(help,name,people,save);name.focus();
  }
  async function groupInfo(w,api){
    const {box,content,status}=groupPanel(w.el,'Integrantes del grupo');status.textContent='Cargando…';
    try{
      const {data,error}=await api.db.rpc('chat_grupo_detalle',{p_grupo:w.groupId});
      if(!api.current(w)||!box.isConnected)return;if(error)throw error;status.textContent='';
      const owner=data.creador===api.user();
      async function manage(action,id=null,name=null){
        if(w.groupBusy)return;w.groupBusy=true;status.textContent='Guardando…';
        try{
          const {error}=await api.db.rpc('chat_grupo_administrar',{p_grupo:w.groupId,p_accion:action,p_usuario:id,p_nombre:name});
          if(!api.current(w)||!box.isConnected)return;if(error)throw error;await api.refresh();await groupInfo(w,api);
        }catch(e){if(api.current(w)&&box.isConnected)status.textContent=errorText(e)}finally{w.groupBusy=false}
      }
      content.append(el('p','',data.privado?'Grupo privado · Los integrantes pueden consultar el historial compartido.':'Grupo abierto del equipo.'));
      if(owner){
        const name=el('input');name.value=data.nombre;name.maxLength=60;name.setAttribute('aria-label','Nombre del grupo');
        content.append(name,btn('Guardar nombre',()=>void manage('nombre',null,name.value)));
      }
      const people=el('div','chat-group-people');
      for(const person of data.miembros||[]){
        const row=el('div','chat-group-person');row.append(el('span','',person.nombre+(person.id===data.creador?' · Admin. del grupo':'')));
        if(owner&&person.id!==api.user()){
          row.append(btn('Quitar',()=>{if(confirm('¿Quitar a '+person.nombre+' del grupo?'))void manage('quitar',person.id)}));
          if(person.activo)row.append(btn('Hacer admin.',()=>{if(confirm('¿Transferir la administración a '+person.nombre+'?'))void manage('transferir',person.id)}));
        }
        people.append(row);
      }
      content.append(people);
      if(owner){
        const select=el('select');select.setAttribute('aria-label','Persona que se agregará al grupo');
        for(const c of api.contacts().filter(c=>c.activo&&!data.miembros.some(p=>p.id===c.id))){const o=el('option','',c.nombre);o.value=c.id;select.append(o)}
        const add=btn('Agregar persona',()=>{if(select.value)void manage('agregar',select.value)});add.disabled=!select.children.length;content.append(select,add);
      }
    }catch(e){if(api.current(w)&&box.isConnected)status.textContent=errorText(e)}
  }
  function render(entry,m,w,api){
    entry.dataset.messageId=m.id;
    if(m.editado_at)entry.append(el('small','chat-edited','Editado'));
    if(m.eliminado_at){entry.dataset.deleted='true';return}
    if(m.respuesta){
      const quote=el('blockquote','chat-quote');quote.append(el('strong','',m.respuesta.autor||'Mensaje'),el('span','',m.respuesta.contenido));entry.prepend(quote);
    }
    if(m.archivo_path){
      const attachment=el('div','chat-file');
      const load=btn((m.archivo_mime?.startsWith('audio/')?'Escuchar: ':'Abrir: ')+m.archivo_nombre,async()=>{
        load.disabled=true;
        try{
          const preview=/^(audio|image)\//.test(m.archivo_mime||'');
          const {data,error}=await api.db.storage.from('chat-archivos').createSignedUrl(m.archivo_path,300,preview?{}:{download:m.archivo_nombre});
          if(!api.current(w)||!load.isConnected)return;if(error||!data?.signedUrl)throw error||Error();
          if(m.archivo_mime?.startsWith('audio/')){
            const audio=el('audio');audio.controls=true;audio.src=data.signedUrl;attachment.replaceChildren(audio);
            audio.onerror=()=>{attachment.replaceChildren(load);load.disabled=false;load.textContent='Reintentar audio'};void audio.play().catch(()=>{});
          }else if(m.archivo_mime?.startsWith('image/')){
            const link=el('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Abrir imagen en tamaño completo');
            const image=el('img');image.src=data.signedUrl;image.alt=m.archivo_nombre;image.loading='lazy';image.onerror=()=>{attachment.replaceChildren(load);load.disabled=false;load.textContent='Reintentar imagen'};
            link.append(image);attachment.replaceChildren(link);
          }else{
            const link=el('a','chat-action','Descargar '+m.archivo_nombre);link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.download=m.archivo_nombre;attachment.append(link);link.click();
          }
        }catch{if(api.current(w))api.note(w,'No se pudo abrir el archivo. Vuelve a intentar.',true)}finally{load.disabled=false}
      });attachment.append(load,el('small','',`${(Number(m.archivo_bytes||0)/1024/1024).toFixed(1)} MB`));entry.append(attachment);
      if(m.archivo_mime?.startsWith('image/'))load.click();
    }
    const reactions=el('div','chat-reactions');
    async function action(kind,text){
      if(w.actionBusy||w.sending)return;w.actionBusy=true;
      try{
        const {data,error}=await api.db.rpc('chat_v2_accion',{p_grupo:w.group,p_id:m.id,p_accion:kind,p_texto:text??null});
        if(!api.current(w))return;if(error)throw error;w.messages.set(Number(data.id),data);api.render(w);api.note(w,'');
      }catch(e){if(api.current(w))api.note(w,errorText(e),true)}finally{w.actionBusy=false}
    }
    for(const r of m.reacciones||[]){const b=btn(r.emoji+' '+r.total,()=>void action('reaccionar',r.propia?null:r.emoji),'chat-reaction');b.setAttribute('aria-pressed',String(r.propia));b.setAttribute('aria-label',`${r.emoji}: ${r.total} reacciones${r.propia?', incluida la tuya':''}`);reactions.append(b)}
    if(reactions.children.length)entry.append(reactions);
    if(!w.modeBar)return; // Una cuenta desactivada conserva únicamente la consulta del historial.
    const menu=el('details','chat-message-menu'),summary=el('summary','','Opciones');summary.setAttribute('aria-label','Opciones del mensaje');
    const actions=el('div','chat-message-actions');
    actions.append(btn('Responder',()=>{menu.open=false;mode(w,'responder',m)}));
    if(navigator.clipboard)actions.append(btn('Copiar texto',async()=>{try{await navigator.clipboard.writeText(m.contenido);api.note(w,'Texto copiado.');menu.open=false}catch{api.note(w,'El navegador no permitió copiar el texto.',true)}}));
    actions.append(btn('Reenviar texto',()=>forward(m,w,api,menu)));
    if(m.remitente===api.user()){
      if(Date.now()-Date.parse(m.creado_at)<15*60000)actions.append(btn('Editar',()=>{menu.open=false;mode(w,'editar',m)}));
      actions.append(btn('Eliminar para todos',()=>{if(confirm('¿Eliminar este mensaje para todos los participantes?'))void action('eliminar')}));
    }
    const choices=el('div','chat-reaction-choices');
    for(const emoji of ['👍','❤️','😂','😮','😢','🙏']){const b=btn(emoji,()=>{menu.open=false;void action('reaccionar',(m.reacciones||[]).some(r=>r.emoji===emoji&&r.propia)?null:emoji)});b.setAttribute('aria-label','Reaccionar con '+emoji);choices.append(b)}
    actions.append(choices);menu.append(summary,actions);entry.append(menu);
  }
  function forward(m,w,api,menu){
    menu.open=false;
    const box=el('div','chat-forward'),label=el('label','','Reenviar texto a'),select=el('select');
    select.setAttribute('aria-label','Destinatario del texto reenviado');
    for(const c of api.contacts().filter(c=>c.activo)){const o=el('option','',c.nombre);o.value=c.id;select.append(o)}
    const key=crypto.randomUUID();
    const sendButton=btn('Enviar',async()=>{
      if(!select.value)return;sendButton.disabled=true;select.disabled=true;
      try{
        const {error}=await api.db.rpc('chat_v2_enviar',{p_contacto:select.value,p_cliente_id:key,p_contenido:m.contenido});
        if(!api.current(w))return;if(error)throw error;box.remove();api.note(w,'Texto reenviado.');
      }catch(e){if(api.current(w))api.note(w,errorText(e),true)}finally{sendButton.disabled=false;select.disabled=false}
    });
    label.append(select);box.append(label,sendButton,btn('Cancelar',()=>box.remove()));w.el.querySelector('.chat-forward')?.remove();w.modeBar.before(box);select.focus();
  }
  window.KJAChatPlus={validateFile,mount,render,send,clear,resetMode,createGroup};
})();
