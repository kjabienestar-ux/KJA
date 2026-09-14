import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const admin=fs.readFileSync(new URL('../assets/js/dashboard-admin-cierre.js',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('../assets/js/dashboard-assignments.js',import.meta.url),'utf8');
function harness(){
  const nodes=new Map(),calls=[],messages=[];
  const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,hidden:false,innerHTML:'',textContent:'',addEventListener(){}});return nodes.get(id)};
  const c={$,APP:{adminClose:{puede_editar:true,personas:[{id:1,nombre:'José Pérez',area:'Diseño'},{id:2,nombre:'Ana',area:'Salud'}]},adminReview:{ok:true,entregas:[]}},
    esc:String,initials:()=> 'JP',isoLima:()=> '2026-09-14',adminReviewStateLabel:()=> 'Pendiente',adminReviewDate:String,
    adminCloseMsg:m=>messages.push(m),toast(){},loadAdminCloses:async()=>{},renderAdminCloseAssignments(){},openAdminReviewPerson(){},
    db:{rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true,seleccion:[{id:1,nombre:'José',carga_30d:0}],disponibles:2,cantidad:1}}}}};
  vm.createContext(c);
  for(const [start,end] of [['function adminCloseSearchText(','function adminCloseAreaTone('],['function syncAdminCloseTargets(','function renderAdminCloseAssignments('],['async function submitAdminCloseAssignment(','async function cancelAdminCloseAssignment(']])vm.runInContext(admin.slice(admin.indexOf(start),admin.indexOf(end)),c);
  vm.runInContext("let ADMIN_DRAW={key:'',selection:[]};",c);vm.runInContext(panel,c);
  $('admin-close-target-kind').value='sorteo';$('admin-close-target').value='10';$('admin-close-date').value='2026-09-14';$('admin-close-type').value='ppt';$('admin-close-title').value='Presentación';$('admin-close-draw-count').value='1';
  return {c,$,calls,messages};
}
test('search matches names and areas without accents',()=>{
  const h=harness();h.$('admin-close-target-kind').value='persona';h.$('admin-close-target-search').value='jose';h.c.syncAdminCloseTargets();
  assert.match(h.$('admin-close-target').innerHTML,/José Pérez/);assert.doesNotMatch(h.$('admin-close-target').innerHTML,/>Ana/);
  h.$('admin-close-target-search').value='diseno';h.c.syncAdminCloseTargets();assert.match(h.$('admin-close-target').innerHTML,/José Pérez/);
});
test('search shows clickable matches and choosing one selects its identifier',()=>{
  const h=harness();h.$('admin-close-target-kind').value='persona';h.$('admin-close-target-search').value='jose';
  h.c.syncAdminCloseTargets();
  assert.equal(h.$('assignment-target-matches').hidden,false);
  assert.match(h.$('assignment-target-matches').innerHTML,/data-assignment-target="1"/);
  assert.match(h.$('assignment-target-matches').innerHTML,/José Pérez/);
  h.$('admin-close-target').focus=()=>{};
  const button={dataset:{assignmentTarget:'1'},querySelector:()=>({textContent:'José Pérez'})};
  h.$('assignment-target-matches').onclick({target:{closest:()=>button}});
  assert.equal(h.$('admin-close-target').value,'1');assert.equal(h.$('assignment-target-matches').hidden,true);
  assert.match(h.$('admin-close-target-results').textContent,/Seleccionado: José Pérez/);
});
test('draw previews first and only creates assignments on confirmation',async()=>{
  const h=harness(),event={preventDefault(){}};
  await h.c.submitAdminCloseAssignment(event);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'dash_admin_previsualizar_sorteo');
  await h.c.submitAdminCloseAssignment(event);assert.equal(h.calls[1].name,'dash_admin_confirmar_sorteo');assert.equal(h.calls[1].args.p_colaboradores[0],1);
});
test('changing date while draw is loading discards stale selection',async()=>{
  const h=harness();let finish;h.c.db.rpc=()=>new Promise(resolve=>finish=resolve);
  const pending=h.c.submitAdminCloseAssignment({preventDefault(){}});h.$('admin-close-date').value='2026-09-15';
  finish({data:{ok:true,seleccion:[{id:1}],disponibles:1}});await pending;
  assert.equal(h.$('admin-close-draw-preview').hidden,true);assert.match(h.messages.at(-1),/Cambiaste/);
});
test('assignment evidence excludes RPE and other assignments',()=>{
  const h=harness();h.c.APP.adminReview.entregas=[{requisito:'rpe',asignacion_id:null,estado:'completo',colaborador:'RPE'},{requisito:'asignado',asignacion_id:2,estado:'completo',colaborador:'Otro'},{requisito:'asignado',asignacion_id:1,estado:'completo',colaborador:'Correcto',archivos:[{}],colaborador_id:4}];
  const html=h.c.adminAssignmentEvidence(1);assert.match(html,/Correcto/);assert.doesNotMatch(html,/RPE|Otro/);
});
test('calendar renders leap day, marks real dates and keeps empty days selectable',()=>{
  const h=harness(),html=h.c.assignmentCalendarMarkup('2024-02',[{fecha:'2024-02-12',total:3}],'2024-02-12');
  assert.match(html,/data-assignment-date="2024-02-29"/);assert.doesNotMatch(html,/2024-02-30/);assert.match(html,/2024-02-12: 3 asignaciones/);assert.equal((html.match(/<button /g)||[]).length,29);
});
test('pagination keeps three assignments and resets after a search',()=>{
  const h=harness(),rows=Array.from({length:8},(_,id)=>({id}));
  assert.equal(h.c.paginateAssignments(rows).length,3);
  vm.runInContext('ASSIGNMENT_PAGE=2',h.c);assert.equal(h.c.paginateAssignments(rows)[0].id,6);
  h.$('admin-assignment-search').value='different';assert.equal(h.c.paginateAssignments(rows)[0].id,0);
});
test('assignments form has its own section and top navigation entry',()=>{
  const html=fs.readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  const section=html.slice(html.indexOf('<section id="admin-assignments-section"')).split('</section>')[0];
  assert.match(section,/id="admin-close-assignment-form"/);assert.match(section,/id="assignment-work-date"/);
  assert.match(html,/data-admin-section="asignaciones"/);assert.doesNotMatch(section,/id="assignment-calendar-panel" open/);
});
