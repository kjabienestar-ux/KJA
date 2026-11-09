/* KJA-030 · Presentación por áreas; conserva las tarjetas y sus acciones originales. */
const CONTRACT_AREA_VIEW={opened:new Set(),initialized:false,filter:''};
function organizeContractAreas(people){
  if(!matchMedia('(min-width:901px)').matches)return;
  const host=document.getElementById('admin-contract-list');if(!host)return;
  const rows=[...host.querySelectorAll('.admin-contract-row')];if(!rows.length)return;
  const groups=new Map();
  people.forEach((person,index)=>{const key=String(person.area_id??'none');if(!groups.has(key))groups.set(key,{key,name:person.area||'Sin área',rows:[]});if(rows[index])groups.get(key).rows.push(rows[index]);});
  const filter=['admin-contract-search','admin-contract-area','admin-contract-inactive','admin-contract-pending'].map(id=>{const e=document.getElementById(id);return e?.type==='checkbox'?e.checked:e?.value||'';}).join('|');
  if(!CONTRACT_AREA_VIEW.initialized)CONTRACT_AREA_VIEW.opened=new Set([groups.keys().next().value]);
  else if(filter!==CONTRACT_AREA_VIEW.filter)CONTRACT_AREA_VIEW.opened=new Set(groups.keys());
  CONTRACT_AREA_VIEW.initialized=true;CONTRACT_AREA_VIEW.filter=filter;
  const content=document.createElement('div');content.className='contract-area-accordion';
  let index=0;
  groups.forEach(group=>{
    const id='contract-area-panel-'+index++,section=document.createElement('section');section.className='contract-area-group';
    const button=document.createElement('button');button.type='button';button.className='contract-area-toggle';button.id=id+'-trigger';button.setAttribute('aria-controls',id);
    const label=document.createElement('span');label.textContent=group.name;const count=document.createElement('b');count.textContent=group.rows.length;count.setAttribute('aria-label',group.rows.length===1?'1 contrato':group.rows.length+' contratos');
    button.append(label,count);button.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>');
    const panel=document.createElement('div');panel.className='contract-area-panel contract-area-rows';panel.id=id;panel.setAttribute('role','region');panel.setAttribute('aria-labelledby',button.id);group.rows.forEach(row=>panel.append(row));
    const sync=()=>{const opened=CONTRACT_AREA_VIEW.opened.has(group.key);panel.hidden=!opened;button.setAttribute('aria-expanded',String(opened));};
    button.onclick=()=>{if(CONTRACT_AREA_VIEW.opened.has(group.key))CONTRACT_AREA_VIEW.opened.delete(group.key);else CONTRACT_AREA_VIEW.opened.add(group.key);sync();};
    sync();section.append(button,panel);content.append(section);
  });
  host.replaceChildren(content);
}
(()=>{const media=matchMedia('(min-width:901px)');media.addEventListener('change',()=>{if(typeof renderAdminContracts==='function')renderAdminContracts();});if(typeof APP!=='undefined'&&APP.adminTeam&&typeof renderAdminContracts==='function')renderAdminContracts();})();
