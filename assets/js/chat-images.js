/* Imágenes privadas: se recodifican sin metadatos antes de salir del dispositivo. */
(function(){
  'use strict';
  const MAX=300*1024,TARGET=150*1024;
  async function compress(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Elige una imagen JPG, PNG o WebP.');
    if(file.size>20*1024*1024)throw Error('La imagen original supera 20 MB.');
    const url=URL.createObjectURL(file),img=new Image();
    try{
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo abrir la imagen.'));img.src=url});
      const canvas=document.createElement('canvas');let edge=1600,blob;
      do{
        const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        for(const quality of [.78,.65,.52,.42]){
          blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
          if(!blob)throw Error('No se pudo comprimir la imagen.');
          if(blob.size<=TARGET)return blob;
        }
        if(edge<=800&&blob.size<=MAX)return blob;
        edge=Math.round(edge*.75);
      }while(edge>=450);
      if(blob.size>MAX)throw Error('No se pudo reducir la imagen a 300 KB. Prueba recortarla.');
      return blob;
    }finally{URL.revokeObjectURL(url)}
  }
  function clear(w){if(w.attachment)URL.revokeObjectURL(w.attachment.url);w.attachment=null;w.imagePreview?.replaceChildren();if(w.imageFile)w.imageFile.value=''}
  function mount(w,form,current,note){
    const pick=document.createElement('button');pick.type='button';pick.className='chat-attach';pick.textContent='Imagen';pick.setAttribute('aria-label','Adjuntar imagen');
    const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;w.imageFile=input;
    const preview=document.createElement('div');preview.className='chat-image-preview';w.imagePreview=preview;
    form.append(pick,input);form.before(preview);
    pick.onclick=()=>{if(!w.sending&&!w.compressing)input.click()};
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file||w.sending||w.compressing)return;
      w.compressing=true;pick.disabled=true;w.input.oninput();note(w,'Comprimiendo imagen…');
      try{
        const blob=await compress(file);if(!current(w))return;clear(w);w.pending=null;
        w.attachment={blob,url:URL.createObjectURL(blob),key:crypto.randomUUID()};
        const img=document.createElement('img');img.src=w.attachment.url;img.alt='Imagen preparada para enviar';
        const label=document.createElement('span');label.textContent=`${Math.ceil(blob.size/1024)} KB · Lista para enviar`;
        const remove=document.createElement('button');remove.type='button';remove.textContent='Quitar';remove.onclick=()=>{if(w.sending)return;clear(w);w.pending=null;w.input.oninput()};
        preview.append(img,label,remove);note(w,'');
      }catch(error){if(current(w))note(w,error.message,true)}
      finally{w.compressing=false;pick.disabled=false;if(current(w))w.input.oninput()}
    };
  }
  async function send(w,db,user,content,current){
    const pending=w.pending,path=`${user}/${pending.id}.jpg`;
    if(!pending.uploaded){
      const {error}=await db.storage.from('chat-imagenes').upload(path,w.attachment.blob,{contentType:'image/jpeg',upsert:false});
      if(error&&String(error.statusCode)!=='409'&&error.error!=='Duplicate')throw error;
      if(!current(w))return null;pending.uploaded=true;
    }
    const {data,error}=await db.rpc('chat_enviar_imagen',{p_contacto:w.id,p_contenido:content,p_cliente_id:pending.id,p_path:path});
    if(error)throw error;return data;
  }
  function render(entry,m,db,current){
    if(!m.imagen_path)return;
    const button=document.createElement('button');button.type='button';button.className='chat-image-open';button.textContent='Cargar imagen';entry.prepend(button);
    const load=async()=>{
      button.disabled=true;
      try{
        const {data,error}=await db.storage.from('chat-imagenes').createSignedUrl(m.imagen_path,300);
        if(!current()||!button.isConnected)return;
        if(error||!data?.signedUrl)throw Error();
        const img=document.createElement('img');img.src=data.signedUrl;img.alt='Imagen del mensaje. Toca para ampliar';img.loading='lazy';
        img.onerror=()=>{button.textContent='Reintentar imagen';button.onclick=load};button.replaceChildren(img);
        button.onclick=()=>{const dialog=document.createElement('dialog');dialog.className='chat-image-dialog';const large=document.createElement('img');large.src=img.src;large.alt='Imagen del mensaje';const close=document.createElement('button');close.textContent='Cerrar';close.onclick=()=>dialog.close();dialog.append(close,large);dialog.onclose=()=>{dialog.remove();button.focus()};document.body.append(dialog);dialog.showModal()};
      }catch{button.textContent='Reintentar imagen';button.onclick=load}finally{button.disabled=false}
    };button.onclick=load;void load();
  }
  window.KJAChatImages={compress,mount,clear,send,render};
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')document.querySelectorAll('.chat-image-dialog').forEach(dialog=>dialog.close())});
})();
