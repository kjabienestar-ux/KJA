import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const receipt=source.slice(source.indexOf('function showMarkReceipt('),source.indexOf('\nfunction openMarkStatus('));
const closeCode=source.slice(source.indexOf('function closeMark(){'),source.indexOf("$('take-photo').onclick"));
function closeHarness({reduced=false,busy=false,state='receipt'}={}){
  const modal={hidden:false,dataset:{}},sheet={dataset:{state}},timers=[];
  let cleanups=0;
  const env={MARK_BUSY:busy,MARK_GEO:{},$:id=>id==='mark-modal'?modal:sheet,
    document:{body:{style:{overflow:'hidden'}}},
    window:{matchMedia:()=>({matches:reduced}),setTimeout:fn=>timers.push(fn)},
    cancelMarkLocation(){},clearEvidence(){cleanups++;},setMarkFlow(){},resetMarkProgress(){},reloadDashboardIfSafe(){}};
  vm.runInNewContext(closeCode,env);
  return {env,modal,timers,cleanups:()=>cleanups};
}
test('receipt closes after its exit animation and repeated taps only schedule one cleanup',()=>{
  const h=closeHarness();h.env.closeMark();h.env.closeMark();
  assert.equal(h.modal.hidden,false);assert.equal(h.modal.dataset.closing,'true');
  assert.equal(h.env.document.body.style.overflow,'hidden');assert.equal(h.timers.length,1);
  h.timers[0]();
  assert.equal(h.modal.hidden,true);assert.equal(h.modal.dataset.closing,undefined);
  assert.equal(h.env.document.body.style.overflow,'');assert.equal(h.cleanups(),1);
  h.env.closeMark();assert.equal(h.cleanups(),1);
});
test('reduced motion and confirmation cancel close immediately; saving remains protected',()=>{
  for(const options of [{reduced:true},{state:'confirm'}]){
    const h=closeHarness(options);h.env.closeMark();
    assert.equal(h.modal.hidden,true);assert.equal(h.timers.length,0);
  }
  const h=closeHarness({busy:true});h.env.closeMark();
  assert.equal(h.modal.hidden,false);assert.equal(h.timers.length,0);assert.equal(h.cleanups(),0);
});
function render(state,context='new',evidence=true){
  const nodes=new Map();
  const env={APP:{inicio:{dia:{fecha:'2026-09-25',modalidad:'virtual'}}},
    $:id=>{if(!nodes.has(id))nodes.set(id,{dataset:{}});return nodes.get(id);},
    fmtTime:value=>value,cap:value=>value,isoLima:()=> '2026-09-25',setMarkFlow:value=>env.flow=value};
  vm.runInNewContext(receipt,env);
  env.showMarkReceipt({estado:state,hora:'08:15'},evidence,context);
  return {nodes,env};
}
test('punctual attendance congratulates with a thumbs-up in both receipt views',()=>{
  for(const context of ['new','detail']){
    const {nodes,env}=render('P',context);
    assert.match(nodes.get('mark-receipt-title').textContent,/Llegaste a tiempo/);
    assert.equal(nodes.get('receipt-person').src,'images/dashboard/attendance-on-time.png');
    assert.equal(nodes.get('mark-sheet').dataset.receiptState,'present');
    assert.equal(nodes.get('receipt-time').textContent,'08:15');
    assert.equal(nodes.get('receipt-mode').textContent,'Virtual');
    assert.equal(env.flow,'receipt');
  }
});
test('late attendance uses a calm expression based on server status, not displayed clock time',()=>{
  for(const context of ['new','detail']){
    const {nodes}=render('T',context);
    assert.equal(nodes.get('receipt-person').src,'images/dashboard/attendance-late.png');
    assert.equal(nodes.get('mark-receipt-title').textContent,'Entrada con tardanza');
    assert.equal(nodes.get('receipt-state').textContent,'Tardanza');
    assert.equal(nodes.get('mark-sheet').dataset.receiptState,'late');
  }
});
test('other attendance states stay neutral and retain evidence availability',()=>{
  for(const [evidence,label] of [[false,'Sin evidencia histórica'],[null,'Consulta restringida']]){
    const {nodes}=render('J','detail',evidence);
    assert.equal(nodes.get('mark-sheet').dataset.receiptState,'neutral');
    assert.equal(nodes.get('receipt-state').textContent,'Justificado');
    assert.equal(nodes.get('mark-receipt-title').textContent,'Detalle de tu asistencia');
    assert.equal(nodes.get('receipt-evidence').textContent,label);
    assert.equal(nodes.get('receipt-person').src,'images/dashboard/attendance-late.png');
  }
});
