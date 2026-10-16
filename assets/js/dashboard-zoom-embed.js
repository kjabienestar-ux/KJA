/* Mantiene un único cliente Zoom en el dashboard. No recibe credenciales del SDK. */
(function(root){
  const $=id=>document.getElementById(id);
  let meeting=null;
  function reset(){
    if($('zoom-disconnect-dialog').open)$('zoom-disconnect-dialog').close();
    meeting=null;$('zoom-embedded-frame').removeAttribute('src');$('zoom-embedded').hidden=true;
    $('zoom-embedded-title').textContent='Zoom en el portal';$('zoom-embedded-status').textContent='';
  }
  function open(row){
    if(!APP.access?.acceso_panel)return;
    const host=$('zoom-embedded');host.hidden=false;
    if(meeting&&meeting!==String(row.id)){
      $('zoom-embedded-status').textContent='Ya tienes otra reunión en este panel. Sal de ella en Zoom y cierra el panel antes de abrir otra.';
    }else if(!meeting){
      meeting=String(row.id);$('zoom-embedded-title').textContent=row.topic||'Zoom en el portal';
      $('zoom-embedded-status').textContent='Pulsa Iniciar y abrir salas dentro del panel. Mantén esta página abierta durante la reunión.';
      $('zoom-embedded-frame').src='zoom-sala.html?embedded=1&meeting='+encodeURIComponent(meeting);
    }
    // Preserve the viewport so the heading, meeting actions and agenda stay visible.
  }
  $('zoom-embedded-close').onclick=()=>{
    if(meeting){$('zoom-disconnect-dialog').showModal();return;}
    reset();
  };
  $('zoom-disconnect-back').onclick=()=>$('zoom-disconnect-dialog').close();
  $('zoom-disconnect-confirm').onclick=()=>{reset();$('zoom-refresh').focus();};
  $('zoom-embedded-fullscreen').onclick=async()=>{
    try{await $('zoom-embedded-frame').requestFullscreen();}catch{$('zoom-embedded-status').textContent='No se pudo ampliar Zoom. Puedes seguir usando el panel.';}
  };
  root.addEventListener('message',event=>{
    if(!meeting||event.origin!==root.location.origin||event.source!==$('zoom-embedded-frame').contentWindow||event.data?.type!=='kja-zoom-state')return;
    const labels={ready:'Zoom listo. Inicia la reunión desde el panel.',starting:'Conectando con Zoom…',connected:'Conectado a Zoom. Los controles de reunión y salas están dentro del panel.',error:'Zoom no pudo completar el inicio. Revisa el mensaje dentro del panel.',signedout:'Tu sesión terminó. Vuelve a ingresar al portal.'};
    if(labels[event.data.state])$('zoom-embedded-status').textContent=labels[event.data.state];
  });
  root.KJAZoomEmbed={open,reset};
})(window);
