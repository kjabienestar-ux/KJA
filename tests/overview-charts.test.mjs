import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
function render(people,marks,closes){
  const host={innerHTML:''},context=vm.createContext({$:()=>host,esc:s=>s});
  vm.runInContext(source.slice(source.indexOf('function renderAdminOverviewCharts('),source.indexOf('async function loadAdminHub(')),context);
  context.renderAdminOverviewCharts(people,marks,closes);return host.innerHTML;
}
test('charts count active people, requirements and deliveries per recipient independently',()=>{
  const html=render([{id:1},{id:2}],[{colaborador_id:1,estado:'T'}],[
    {id:1,cierre:{estado:'completa',requisitos:[{tipo:'rpe',completo:true},{tipo:'salida',completo:true}],asignaciones:[{id:9,completo:true}]}},
    {id:2,cierre:{estado:'incompleta',requisitos:[{tipo:'rpe',completo:false}],asignaciones:[{id:9,completo:false}]}},
    {id:3,cierre:{requisitos:[{completo:true}]}}
  ]);
  assert.match(html,/General: Completas: 1, Incompletas: 1, Otros estados: 0/);
  assert.match(html,/Tardanzas: 1, Justificados: 0, Otros registros: 0, Sin registro: 1/);
  assert.match(html,/Evidencias: Completados: 1, Pendientes: 1/);
  assert.match(html,/Tareas: Entregadas: 1, Pendientes: 1/);
});
test('empty charts do not invent progress or invalid gradients',()=>{
  const html=render([],[],[]);assert.equal((html.match(/Sin datos para hoy/g)||[]).length,4);assert.doesNotMatch(html,/NaN|Infinity/);
});
