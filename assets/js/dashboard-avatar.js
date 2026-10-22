/* Personaje decorativo del portal. No reemplaza las fotos de perfil. */
(function(root){
  'use strict';
  const femaleAvatar='images/nosotros/avatar-women-transparent.webp';
  const femalePoses={
    'images/dashboard/evidence-worker.png':'images/nosotros/avatar-women-evidence.webp',
    'images/dashboard/attendance-exit.png':'images/nosotros/avatar-women-exit.webp',
    'images/dashboard/attendance-on-time.png':'images/nosotros/avatar-women-on-time.webp',
    'images/dashboard/attendance-late.png':'images/nosotros/avatar-women-late.webp'
  };
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  // Nombres de pila, nunca apellidos ni una regla basada en terminar en «a».
  // Los nombres ambiguos o desconocidos conservan el personaje predeterminado.
  const femaleNames=new Set(`adriana alejandra alessandra alexa alexandra alicia ana anahi andrea angela angelica antonella ariana beatriz blanca brenda camila carla carmen carolina cecilia celeste cindy cinthia claudia cristina cynthia daniela danna dayana debora diana dolly dolores doris elena eliana elisa elizabeth erica erika estefani estefania estefany evelyn fabiola fatima fernanda fiorella flor gabriela genesis gisela gloria graciela guadalupe ida ines ingrid irene isabel isabella ivana jackeline jacqueline janet janeth jazmin jennifer jessica jimena joana joanna johanna joselyn joseline joselin juana judith julia juliana karen karina karla katherine katia katy ketty kiara kimberly laura leslie lia liesel liliana lisbeth liz lizbeth lorena lourdes lucero lucia luciana luisa luz magali magaly maira marcia margarita maria mariana maribel maricarmen mariela marilyn marisol maritza marjorie martha mayeli mayra mayerlin melanie melany melina melissa mercedes merly micaela michelle milagros miriam monica nacira nadia naomi natalia nataly nicole noelia norma pamela paola patricia paulina pilar priscila rebeca regina renata rocio rosa rosario ruth sabrina samantha sandra sara sheyla shirley silvia sofia soledad sonia stefany stephanie susana tamara tania tatiana teresa valentina valeria vanessa veronica victoria viviana wendy ximena yamile yanet yaneth yessica yolanda`.split(/\s+/));

  function isFemale(person){
    if(!person)return false;
    const explicit=normalize(person.genero||person.sexo||person.gender);
    if(explicit)return ['f','femenino','femenina','mujer','female','woman'].includes(explicit);
    const firstName=normalize(typeof person==='string'?person:person.nombre).split(/\s+/)[0];
    return femaleNames.has(firstName);
  }

  function source(person,fallback){
    return isFemale(person)?(femalePoses[fallback]||femaleAvatar):fallback;
  }

  function sync(doc,person){
    const female=isFemale(person);
    doc.querySelectorAll('img[data-dashboard-character]').forEach(img=>{
      const src=source(person,img.dataset.dashboardCharacter);
      if(img.getAttribute('src')!==src)img.setAttribute('src',src);
    });
    // También cubre el personaje CSS del detalle de asistencia en móvil.
    const portal=doc.getElementById('portal');
    if(portal){
      if(female)portal.style.setProperty('--dashboard-history-character',`url("${femaleAvatar}")`);
      else portal.style.removeProperty('--dashboard-history-character');
    }
  }

  root.KJADashboardAvatar={isFemale,source,sync};
})(window);
