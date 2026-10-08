import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-evidence-corrections.js','utf8');
const dashboard=fs.readFileSync('assets/js/dashboard.js','utf8');
function fixture(){
 const nodes=new Map(),calls=[],intervals=[];
 const element=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,open:false,dataset:{},setAttribute(){},textContent:'',innerHTML:'',events:{},focus(){this.focused=true;},close(){this.open=false;},showModal(){this.open=true;},addEventListener(e,cb){this.events[e]=cb;},querySelector(){return element('pending-button');}});return nodes.get(id);};
 element('daily-evidence-editor').hidden=true;
 const context={APP:{sessionUid:'a',identity:{hasPersonal:true},cierre:{fecha:'2020-01-01'}},DAILY_EVIDENCE:{},DAILY_EVIDENCE_TRIGGER:null,$:element,esc:s=>String(s).replaceAll('<','&lt;'),
 document:{hidden:false,querySelector:()=>element('evidence-correction-modal').open?{}:null,querySelectorAll:()=>[]},
 setInterval:fn=>intervals.push(fn),renderDailyClose(){},loadDailyClose:async()=>{},toast:s=>calls.push(['toast',s]),openDailyEvidenceEditor:(...args)=>calls.push(['editor',...args]),
 db:{rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='dash_mis_correcciones'?{ok:true,comparticiones_min:2,collage_permitido:true,correcciones:[{id:7,fecha:'2020-01-01',nota:'Falta <captura>\nIncluye el grupo.',vista:false,titulo:'Comparticiones de Facebook'}]}:{ok:true}}}}};
 vm.createContext(context);vm.runInContext(source,context);return {context,nodes,calls,element,intervals};
}
test('unseen correction opens modal with literal full message; dismiss persists acknowledgment and keeps a route back',async()=>{
 const f=fixture();await f.context.loadEvidenceCorrections();
 assert.equal(f.element('evidence-correction-modal').open,true);
 assert.equal(f.element('evidence-correction-note').textContent,'Falta <captura>\nIncluye el grupo.');
 assert.equal(f.element('evidence-correction-banner').hidden,false);
 assert.ok(f.element('evidence-correction-upload').focused);
 f.element('evidence-correction-later').onclick();
 assert.equal(f.element('evidence-correction-modal').open,false);
 assert.ok(f.calls.some(([name,args])=>name==='dash_marcar_correccion_vista'&&args.p_entrega===7));
 await f.context.loadEvidenceCorrections();assert.equal(f.element('evidence-correction-modal').open,false);
 f.context.openEvidenceCorrection(7);f.element('evidence-correction-upload').onclick();
 const editor=f.calls.find(call=>call[0]==='editor');assert.equal(editor[1],'comparticiones');assert.equal(editor[3].id,7);assert.equal(editor[3].comparticiones_min,2);
});
test('upload and existing dialogs defer interruption; new owner never receives stale response',async()=>{
 const f=fixture();f.context.DAILY_EVIDENCE.busy=true;await f.context.loadEvidenceCorrections();assert.equal(f.element('evidence-correction-modal').open,false);
 f.context.DAILY_EVIDENCE.busy=false;f.context.showNextEvidenceCorrection();assert.equal(f.element('evidence-correction-modal').open,true);
 f.context.dismissEvidenceCorrection();let resolve;
 f.context.db.rpc=()=>new Promise(r=>resolve=r);const pending=f.context.loadEvidenceCorrections();
 f.context.APP.sessionUid='b';f.context.resetEvidenceCorrections();resolve({data:{ok:true,correcciones:[{id:99}]}});await pending;
 assert.equal(f.context.pendingEvidenceCorrection('2020-01-01'),null);assert.equal(f.element('evidence-correction-banner').hidden,true);
});
test('resolved correction closes an open alert and removes the pending action',async()=>{
 const f=fixture();await f.context.loadEvidenceCorrections();f.context.db.rpc=async()=>({data:{ok:true,correcciones:[]}});await f.context.loadEvidenceCorrections();
 assert.equal(f.element('evidence-correction-modal').open,false);assert.equal(f.element('evidence-correction-banner').hidden,true);
});
test('historical correction opens an empty upload even on a closed day without reusing rejected files',()=>{
 const f=fixture(),c=f.context;c.APP.cierre={entrada_at:null,salida_at:'2026-10-08',requisitos:[]};
 Object.assign(c,{CLOSE_MODEL:{hasPendingWork:()=>false,workClosed:()=>true},FACEBOOK_EVIDENCE_MAX:50,closeDailyEvidenceEditor(){},mountDailyEvidencePortal(){},setDailyEvidenceProcess(){},fmtTime:()=>'',requestAnimationFrame:fn=>fn(),loadDailyEditableEvidence(){throw Error('must not reuse rejected files');}});
 c.document.body={classList:{add(){}}};
 for(const id of ['daily-issue-toggle','daily-evidence-title','daily-evidence-copy'])f.element(id).setAttribute=()=>{};
 vm.runInContext(dashboard.slice(dashboard.indexOf('function openDailyEvidenceEditor('),dashboard.indexOf('function dailyEvidenceMode(')),c);
 c.openDailyEvidenceEditor('comparticiones',null,{id:7,fecha:'2020-01-01',titulo:'Comparticiones de Facebook',nota:'Corrige la captura',comparticiones_min:2,collage_permitido:true});
 assert.equal(c.DAILY_EVIDENCE.correction.id,7);assert.equal(c.DAILY_EVIDENCE.editing,false);assert.equal(c.DAILY_EVIDENCE.existingFiles.length,0);
 assert.equal(f.element('daily-evidence-editor').hidden,false);assert.match(f.element('daily-evidence-title').textContent,/01\/01\/2020/);
});

test('confirmation targets the observed delivery and keeps the current dashboard date',async()=>{
 const f=fixture(),c=f.context,requests=[];
 for(const id of ['daily-upload-progress-bar','daily-upload-copy','daily-upload-title','daily-upload-count','day-close-state'])f.element(id).style={};
 c.DAILY_EVIDENCE={requirement:'comparticiones',title:'Facebook',correction:{id:7,fecha:'2020-01-01',comparticiones_min:2,collage_permitido:true},files:[{name:'new.jpg'}],existingFiles:[],video:null};
 Object.assign(c,{FACEBOOK_EVIDENCE_MAX:50,CLOSE_MODEL:{evidenceSelectionPolicy:()=>({ok:true})},dailyEvidenceMode:()=> 'collage',dailyEvidenceMessage(){},dailyUploadStep(){},setDailyEvidenceProcess(){},
 uploadDailyEvidence:async()=> '2020/01/01/1/new.jpg',mergeDailyReviewState:data=>data,
 setTimeout:fn=>fn(),matchMedia:()=>({matches:true}),renderDailyEvidencePreviews(){},closeDailyEvidenceEditor(){c.DAILY_EVIDENCE={};},console:{log(){}},
 finishEvidenceCorrection:async id=>requests.push(['resolved',id]),
 db:{rpc:async(name,args)=>{requests.push([name,args]);return {data:{ok:true,entrega:8,fecha:'2020-01-01',resumen:{ok:true,fecha:'2026-10-08'}}};}}});
 vm.runInContext(dashboard.slice(dashboard.indexOf('async function submitDailyEvidence('),dashboard.indexOf('function dailyExitMessage(')),c);
 f.element('daily-evidence-detail').value='Captura corregida';
 await c.submitDailyEvidence({preventDefault(){}});
 assert.equal(requests[0][0],'dash_confirmar_correccion');
 assert.equal(requests[0][1].p_entrega,7);
 assert.equal(requests[0][1].p_requisito,undefined);assert.equal(requests[0][1].p_asignacion,undefined);
 assert.equal(requests[0][1].p_paths[0],'2020/01/01/1/new.jpg');
 assert.equal(c.APP.cierre.fecha,'2026-10-08');assert.equal(requests[1][0],'resolved');
});
