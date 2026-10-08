/* Anuncio del feriado confirmado por el resumen del servidor. */
(function(root){
  function presentation(data){
    if(!data?.ok||!data.feriado)return null;
    const scheduled=!!data.aplica_comparticiones;
    const pending=scheduled&&(data.requisitos||[]).some(item=>item.tipo==='comparticiones'&&!item.completo);
    return {
      title:'Hoy es feriado nacional',
      message:!scheduled?'Hoy no tienes pendientes. Disfruta tu feriado.':!pending
        ?'Ya completaste tus comparticiones. Disfruta tu feriado.'
        :'Hoy solo sube tus comparticiones de Facebook dentro de tu horario.',
      detail:'No necesitas marcar asistencia ni subir RPE, evidencia de salida o entregables.',
      guideTitle:!pending?'Todo listo. Disfruta tu feriado.':data.comparticiones_vencidas?'Comparticiones pendientes':'Hoy, solo tus comparticiones',
      guideCopy:!scheduled?'Hoy no tienes comparticiones programadas ni otros pendientes.':!pending?'Tus comparticiones ya quedaron registradas. No tienes otros pendientes.':data.comparticiones_vencidas
        ?'Tu horario de carga terminó. Contacta a administración si necesitas una ampliación.'
        :data.puede_compartir?'Comparte y adjunta tus capturas en la tarea de arriba. Después, disfruta tu feriado.'
        :'La carga se habilitará en tu horario de Facebook. Hoy no tienes otras obligaciones.'
    };
  }
  function render(data){
    const view=presentation(data),doc=root.document;
    doc.getElementById('today-attendance-card')?.classList.toggle('is-national-holiday',!!view);
    doc.getElementById('day-close')?.classList.toggle('is-national-holiday',!!view);
    for(const banner of doc.querySelectorAll('[data-holiday-announcement]')){
      banner.hidden=!view;
      if(!view)continue;
      if(!banner.firstElementChild)banner.innerHTML=`
        <div class="holiday-art" aria-hidden="true">
          <span class="holiday-flag"><i></i><i></i><i></i></span>
          <img src="images/dashboard/attendance-exit.png" width="240" height="240" alt="" decoding="async">
        </div>
        <div class="holiday-copy"><h2>Hoy es feriado nacional</h2>
          <p class="holiday-message"></p><p class="holiday-detail"></p>
          <span class="holiday-signoff">Un respiro para disfrutar el día.</span></div>`;
      banner.querySelector('.holiday-message').textContent=view.message;
      banner.querySelector('.holiday-detail').textContent=view.detail;
    }
  }
  root.KJAHoliday=Object.freeze({presentation,render});
})(typeof window==='undefined'?globalThis:window);
