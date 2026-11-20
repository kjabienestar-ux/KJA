(() => {
 const dialog=document.createElement('dialog');
 dialog.className='engineering-contact-dialog';
 dialog.setAttribute('aria-labelledby','engineering-contact-title');
 dialog.setAttribute('aria-describedby','engineering-contact-description');
 dialog.innerHTML=`<form method="dialog"><h2 id="engineering-contact-title">Contactar a Ingeniería</h2><p>Piero · Soporte de la plataforma</p><div class="engineering-contact-hours"><small>Horario de gestión y atención</small><strong>Lunes a viernes</strong><b>8:00 a 13:00</b><small>Hora de Perú</small></div><p id="engineering-contact-description">Tu solicitud se atenderá dentro de este horario. Si escribes fuera de él, la atenderemos en el siguiente horario de atención.</p><footer><button value="cancel" autofocus>Ahora no</button><a href="https://wa.me/51945322994" target="_blank" rel="noopener">Continuar a WhatsApp ↗</a></footer></form>`;
 document.body.append(dialog);
 document.addEventListener('click',event=>{if(event.target.closest('[data-engineering-contact]')){event.preventDefault();if(!dialog.open)dialog.showModal();}});
 dialog.querySelector('a').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
})();
