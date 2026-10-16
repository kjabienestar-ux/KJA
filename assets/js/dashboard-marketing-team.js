/* Permisos validados por RPC; datos y actividad limitados al usuario autenticado. */
(()=>{
  const $=id=>document.getElementById('marketing-team-'+id);
  let people=[],areas=[],pending=false,revision=0,active=false;
  async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw new Error(error.message||'No se pudo completar la operación.');return data}
  const note=(text,error=false)=>{$('notice').textContent=text;$('notice').dataset.error=String(error)};
  function renderAreas(){
    $('areas').replaceChildren();
    for(const area of areas){const button=document.createElement('button');button.type='button';button.textContent=area.nombre;button.disabled=pending;button.setAttribute('aria-pressed',String(String(area.id)===$('area').value));button.onclick=()=>{$('area').value=String(area.id);$('area').onchange()};$('areas').append(button)}
  }
  function renderAuthorized(){
    $('authorized').replaceChildren();let count=0;
    for(const area of areas){
      const members=people.filter(p=>String(p.area_id)===String(area.id)&&(p.acceso||p.administrador));if(!members.length)continue;
      const group=document.createElement('section'),title=document.createElement('h3');title.textContent=area.nombre+' · '+members.length;group.append(title);
      for(const person of members){const row=document.createElement('p'),name=document.createElement('span'),badge=document.createElement('small');name.textContent=person.nombre;badge.textContent=person.administrador?'Administrador':'Puede crear copies';row.append(name,badge);group.append(row);count++}
      $('authorized').append(group);
    }
    if(!count){const empty=document.createElement('p');empty.textContent='Todavía no hay colaboradores autorizados en las áreas activas.';$('authorized').append(empty)}
  }
  function view(overview){$('edit-panel').hidden=overview;$('view-panel').hidden=!overview;$('edit').setAttribute('aria-pressed',String(!overview));$('view').setAttribute('aria-pressed',String(overview));if(overview)renderAuthorized()}
  function renderPeople(){
    $('people').replaceChildren();
    const list=people.filter(p=>String(p.area_id)===$('area').value);
    for(const person of list){
      const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');
      input.type='checkbox';input.value=String(person.id);input.checked=!!person.acceso||person.administrador;input.disabled=person.administrador||pending;
      name.textContent=person.nombre+(person.administrador?' · Administrador':'');label.append(input,name);$('people').append(label);
    }
    if(!list.length){const empty=document.createElement('p');empty.textContent='No hay colaboradores activos en esta área.';$('people').append(empty)}
    $('save').disabled=pending||!$('area').value;
  }
  function lock(value){pending=value;['area','save','all','none','close','edit','view'].forEach(id=>$(id).disabled=value);$('areas').querySelectorAll('button').forEach(button=>button.disabled=value);$('people').querySelectorAll('input').forEach(input=>input.disabled=value||people.find(p=>String(p.id)===input.value)?.administrador)}
  async function open(){
    if(pending)return;
    view(false);$('dialog').showModal();lock(true);note('Cargando áreas y colaboradores…');
    try{
      const data=await rpc('marketing_gestion_accesos');people=data.colaboradores;areas=data.areas;
      $('area').replaceChildren();
      for(const area of areas){const option=document.createElement('option');option.value=String(area.id);option.textContent=area.nombre;$('area').append(option)}
      const marketing=areas.find(a=>/marketing/i.test(a.nombre));if(marketing)$('area').value=String(marketing.id);
      note('Selecciona quién puede ver y usar Publicaciones. Los administradores conservan su acceso.');
    }catch(error){people=[];areas=[];$('area').replaceChildren();note(error.message,true)}
    finally{lock(false);renderPeople();renderAreas()}
  }
  async function refresh(){
    if(!active)return;const ticket=++revision;
    try{
      const data=await rpc('marketing_mi_actividad');if(ticket!==revision||!active)return;
      const today=data.dias?.[0]?.cantidad||0;
      $('greeting').textContent='Hola, '+(data.nombre||'bienvenido')+'. Aquí están tus flyers y copies.';
      $('today').textContent=String(today);$('home-count').textContent=String(today);
      $('days').replaceChildren();
      for(const [index,day] of (data.dias||[]).entries()){
        const item=document.createElement('li'),date=document.createElement('span'),count=document.createElement('strong');
        date.textContent=index===0?'Hoy':new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day.fecha+'T12:00:00Z'));
        count.textContent=String(day.cantidad);item.append(date,count);$('days').append(item);
      }
      $('count-note').textContent='Cada copy se cuenta una sola vez al guardar su texto. Horario de Perú.'+(data.anteriores?' Los copies anteriores a este registro siguen en tu historial, sin fecha de producción comprobada.':'');
      $('activity').hidden=false;$('home').hidden=false;
    }catch{if(ticket===revision){$('activity').hidden=true;$('home').hidden=true}}
  }
  $('manage').onclick=open;
  $('close').onclick=()=>{if(!pending)$('dialog').close()};
  $('dialog').addEventListener('cancel',event=>{if(pending)event.preventDefault()});
  $('dialog').addEventListener('close',()=>$('manage').focus());
  $('edit').onclick=()=>view(false);
  $('view').onclick=()=>view(true);
  $('area').onchange=()=>{renderPeople();renderAreas();note('Los cambios se guardan solo para el área seleccionada.')};
  for(const [id,checked] of [['all',true],['none',false]])$(id).onclick=()=>{$('people').querySelectorAll('input:not(:disabled)').forEach(input=>input.checked=checked)};
  $('save').onclick=async()=>{
    if(pending)return;
    const selected=[...$('people').querySelectorAll('input:checked')].map(input=>Number(input.value));
    lock(true);note('Guardando permisos…');
    try{
      await rpc('marketing_guardar_accesos',{p_area:Number($('area').value),p_colaboradores:selected});
      people.filter(p=>String(p.area_id)===$('area').value).forEach(p=>p.acceso=selected.includes(Number(p.id)));
      note('Permisos guardados. Los colaboradores verán la opción al actualizar su portal.');
    }catch(error){note(error.message,true)}finally{lock(false);renderPeople()}
  };
  $('home-open').onclick=()=>document.getElementById('nav-marketing').click();
  $('mobile-open').onclick=()=>{if(active)document.getElementById('nav-marketing').click()};
  window.KJAMarketingTeam={init(permission){active=!!permission?.acceso;$('mobile-open').hidden=!active;$('manage').hidden=!permission?.administrar;if(active)refresh();else this.reset()},refresh,
    reset(){active=false;revision++;$('mobile-open').hidden=true;$('manage').hidden=true;$('activity').hidden=true;$('home').hidden=true;if($('dialog').open)$('dialog').close();people=[];areas=[];$('people').replaceChildren()}};
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')window.KJAMarketingTeam.reset()});
})();
