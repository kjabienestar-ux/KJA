import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-equipo.js','utf8');
function setup(){
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,innerHTML:'',textContent:''});return nodes.get(id);};
  const people=[
    {id:1,nombre:'Ana <A>',activo:true,area_id:1,area:'Diseño',tipo_vinculo:'practicas',resumen:{meta:100,cumplidas:60,horas_no_laborables:10,semana_horas:20,alertas:[]}},
    {id:2,nombre:'Beto',activo:true,area_id:2,tipo_vinculo:'practicas',contrato_pendiente:true,resumen:{pendiente:true,cumplidas:8,alertas:[]}},
    {id:3,nombre:'Celia',activo:false,area_id:1,tipo_vinculo:'practicas',resumen:{meta:100,cumplidas:120,completado:true}}
  ];
  const ctx=vm.createContext({APP:{adminTeam:{personas:people,puede_editar:true}},$:get,ADMIN_LINKS:{practicas:'Prácticas'},
    esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    adminHours:n=>n==null?'—':`${n} h`,adminDate:d=>d||'—',profileAvatarMarkup:()=>'<i class="avatar"></i>'});
  vm.runInContext(source.slice(source.indexOf('function filteredAdminPeople('),source.indexOf('function renderAdminPeople(')),ctx);
  vm.runInContext(source.slice(source.indexOf('function contractState('),source.indexOf('function scheduleRows(')),ctx);
  return {ctx,get,render:()=>{ctx.renderAdminContracts();return get('admin-contract-list').innerHTML;}};
}
test('contracts retain filters and edit permissions; missing goals do not imply zero progress',()=>{
  const {ctx,get,render}=setup();let html=render();
  ctx.APP.adminTeam.personas[0].institucion='  UTP - LIMA CENTRO <Sede>  ';
  html=render();
  assert.match(html,/<span>Institución<\/span>/);
  assert.match(html,/UTP - LIMA CENTRO &lt;Sede&gt;/);
  assert.match(html,/contract-institution-empty">Sin institución/);
  assert.ok(html.indexOf('UTP - LIMA CENTRO')<html.indexOf('data-team-edit="1"'));
  assert.equal(get('admin-contract-count').textContent,'2');
  assert.match(html,/Ana &lt;A&gt;/);assert.match(html,/40 h por completar/);
  assert.match(html,/Incluye 10 h por días no laborables/);
  assert.match(html,/aria-valuenow="60"/);assert.match(html,/Sin meta/);assert.doesNotMatch(html,/>0%/);
  assert.match(html,/data-team-edit="1"/);
  get('admin-contract-pending').checked=true;html=render();assert.match(html,/Beto/);assert.doesNotMatch(html,/Ana/);
  get('admin-contract-pending').checked=false;get('admin-contract-area').value='1';get('admin-contract-inactive').checked=true;
  html=render();assert.match(html,/Celia/);assert.match(html,/aria-valuenow="100"/);assert.doesNotMatch(html,/Beto/);
  ctx.APP.adminTeam.puede_editar=false;assert.doesNotMatch(render(),/data-team-edit/);
  get('admin-contract-search').value='sin coincidencias';assert.match(render(),/No hay contratos/);
});
