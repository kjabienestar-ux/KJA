/* A fixed-size receipt makes the exported content independent of the viewport. */
(function(global){
  'use strict';
  const quantity=value=>/^\d{1,5}$/.test(String(value))&&Number(value)>0?Number(value):null;
  function message(data,count){
    const date=String(data.fecha||'').split('-').reverse().join('/');
    const time=new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima'}).format(new Date(data.registrado_at));
    return `Mis comparticiones de Facebook\n• Nombre: ${data.colaborador}\n• Cantidad: ${count}\n• Fecha: ${date}\n• Hora de registro: ${time}\n• Área: ${data.area}\n• Código: KJA-FB-${data.entrega_id}`;
  }
  async function render(data,files,count,signal){
    if(!files.length)throw new Error('La entrega no tiene imágenes.');
    const canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=24+Math.ceil(files.length/3)*480;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('No se pudo crear la imagen en este dispositivo.');
    ctx.fillStyle='#eef5fb';ctx.fillRect(0,0,canvas.width,canvas.height);
    // Personal data belongs to the share text (photo caption), never the pixels.
    try{
      for(let i=0;i<files.length;i++){
        const response=await fetch(files[i].url,{signal});
        if(!response.ok)throw new Error('No se pudo cargar una captura. Cierra y vuelve a abrir el comprobante.');
        const blob=await response.blob(),url=URL.createObjectURL(blob),img=new Image();
        try{
          img.src=url;await img.decode();
          if(signal.aborted)throw new DOMException('Cancelado','AbortError');
          const x=24+(i%3)*388,y=24+Math.floor(i/3)*480;
          ctx.fillStyle='#fff';ctx.fillRect(x,y,376,464);
          const scale=Math.min(352/img.naturalWidth,448/img.naturalHeight);
          ctx.drawImage(img,x+12+(352-img.naturalWidth*scale)/2,y+8+(448-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);
        }finally{URL.revokeObjectURL(url);img.src='';}
      }
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
      if(!blob)throw new Error('No se pudo generar el comprobante. Inténtalo nuevamente.');
      return new File([blob],`KJA-FB-${data.entrega_id}.jpg`,{type:'image/jpeg'});
    }finally{canvas.width=1;canvas.height=1;}
  }
  let active=null;
  let nativeSharePending=false;
  function reset(){
    active?.controller.abort();active=null;
    const panel=document.getElementById('facebook-export');
    if(panel){panel.hidden=true;panel.querySelector('form').reset();panel.querySelector('form').onsubmit=event=>event.preventDefault();panel.querySelector('textarea').value='';panel.querySelector('[role=status]').textContent='';panel.querySelectorAll('[data-ready]').forEach(b=>b.disabled=true);}
  }
  async function open(db,data,files){
    reset();
    const panel=document.getElementById('facebook-export');if(!panel)return;
    const state={controller:new AbortController(),file:null};active=state;panel.hidden=false;
    const form=panel.querySelector('form'),input=panel.querySelector('input'),status=panel.querySelector('[role=status]'),preview=panel.querySelector('textarea'),prepare=form.querySelector('button');
    const ready=value=>panel.querySelectorAll('[data-ready]').forEach(b=>b.disabled=!value);
    let loaded=false;
    prepare.disabled=true;input.disabled=true;status.textContent='Consultando cantidad guardada…';
    try{
      const result=await db.rpc('dash_cantidad_compartida',{p_entrega_id:data.entrega_id});
      if(active!==state)return;
      if(result.error||!result.data?.ok)throw new Error('No pudimos cargar la cantidad guardada. Cierra y vuelve a abrir el comprobante; si persiste, informa a Dirección.');
      loaded=true;input.value=result.data.cantidad??'';status.textContent='Indica cuántas comparticiones realizaste, no cuántas capturas subiste.';
    }catch(error){if(active===state)status.textContent=error.message;return;}
    finally{if(active===state){prepare.disabled=!loaded;input.disabled=!loaded;}}
    input.oninput=()=>{state.file=null;ready(false);preview.value='';status.textContent='Prepara el comprobante para guardar la cantidad y actualizar la imagen.';};
    form.onsubmit=async event=>{
      event.preventDefault();const count=quantity(input.value);
      if(!count){input.reportValidity();return;}
      ready(false);state.file=null;prepare.disabled=true;input.disabled=true;status.textContent='Guardando cantidad y preparando imagen…';
      try{
        const saved=await db.rpc('dash_cantidad_compartida',{p_entrega_id:data.entrega_id,p_cantidad:count});
        if(active!==state)return;
        if(saved.error||!saved.data?.ok)throw new Error('No se pudo guardar la cantidad. Inténtalo nuevamente.');
        const file=await render(data,files,count,state.controller.signal);
        if(active!==state)return;
        state.file=file;state.text=message(data,count);preview.value=state.text;ready(true);
        status.textContent='Listo. Descarga la imagen y copia la descripción. En WhatsApp, adjunta primero la imagen y pega el texto en su descripción antes de enviar.';
      }catch(error){if(active===state)status.textContent=error.message;}
      finally{if(active===state){prepare.disabled=false;input.disabled=false;}}
    };
    const download=()=>{
      if(!state.file)return;
      const url=URL.createObjectURL(state.file),a=document.createElement('a');a.href=url;a.download=state.file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    };
    panel.querySelector('[data-share]').onclick=async()=>{
      if(!state.file)return;
      // Use download + clipboard instead of the OS share sheet on every device.
      let copied;
      try{copied=Promise.resolve(navigator.clipboard.writeText(state.text)).then(()=>true,()=>false);}
      catch{copied=Promise.resolve(false);}
      download();
      const ok=await copied;
      if(active!==state)return;
      if(ok)status.textContent='Descarga iniciada y descripción copiada. Abre WhatsApp, adjunta la imagen y pega el texto en la descripción antes de enviar. Así la imagen aparece primero y el texto debajo.';
      else{preview.focus();preview.select();status.textContent='Descarga iniciada. Copia la descripción seleccionada; luego adjunta la imagen en WhatsApp y pega el texto en su descripción antes de enviar.';}
    };
    panel.querySelector('[data-native-share]').onclick=async()=>{
      if(!state.file)return;
      if(nativeSharePending){status.textContent='Ya hay un envío abierto en el sistema. Cierra el selector o usa Descargar imagen y copiar descripción.';return;}
      try{
        const payload={files:[state.file],text:state.text};
        if(!navigator.share||!navigator.canShare?.({files:payload.files})){
          status.textContent='Este navegador no permite compartir archivos con aplicaciones. Usa Descargar imagen y copiar descripción y abre WhatsApp Web.';return;
        }
        nativeSharePending=true;
        status.textContent='Selecciona WhatsApp en el menú de Windows y luego el grupo. Si se traba, usa la descarga y WhatsApp Web.';
        // Invoke directly from the click to preserve transient user activation.
        await navigator.share(payload);
        if(active===state)status.textContent='Comprobante entregado al sistema. Verifica en WhatsApp la imagen y el texto; esto no confirma que se hayan enviado.';
      }catch(error){
        if(active===state)status.textContent=error.name==='AbortError'?'Envío cancelado. El comprobante sigue disponible.':'No se pudo compartir. Usa Descargar imagen y copiar descripción y abre WhatsApp Web.';
      }finally{nativeSharePending=false;}
    };
    panel.querySelector('[data-download]').onclick=download;
    panel.querySelector('[data-copy]').onclick=async()=>{
      try{await navigator.clipboard.writeText(state.text);if(active===state)status.textContent='Descripción copiada. Adjunta primero la imagen y pega este texto en la descripción de la foto antes de enviar.';}
      catch{preview.focus();preview.select();status.textContent='Selecciona y copia el mensaje del campo de texto.';}
    };
  }
  global.FacebookReceipt={quantity,message,render,open,reset};
})(globalThis);
