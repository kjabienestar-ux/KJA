import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const source=js.slice(js.indexOf('async function deleteFacebookEvidenceImage('),js.indexOf("$('daily-evidence-previews').addEventListener('click'"));
function fixture({confirm=true,result={ok:true},files=1}={}){
  const elements=new Map();const calls=[];
  const state={existingFiles:Array.from({length:files},(_,i)=>({path:`own/${i}.jpg`})),entregaId:45,editing:true,title:'Facebook'};
  const context={DAILY_EVIDENCE:state,confirm:()=>confirm,document:{querySelectorAll:()=>[],body:{classList:{add(){},remove(){}}}},requestAnimationFrame:fn=>fn(),SUPABASE_URL:'https://example.test',SUPABASE_ANON:'public',
    $:id=>{if(!elements.has(id))elements.set(id,{querySelector(){return this;},querySelectorAll(){return [];},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},focus(){},disabled:false});return elements.get(id);},
    dailyEvidenceMessage:text=>calls.push(['message',text]),dailyEvidenceFailure:text=>text,
    db:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},
    console:{warn(){}},fetch:async(url,args)=>{calls.push(['fetch',JSON.parse(args.body)]);return {ok:result.ok,json:async()=>result};},
    renderDailyEvidencePreviews:()=>calls.push(['render']),closeFacebookShare:()=>calls.push(['close']),loadDailyClose:async()=>calls.push(['reload'])};
  vm.createContext(context);vm.runInContext(source,context);
  context.requestFacebookDeleteConfirmation=async()=>confirm;
  return {context,state,calls,elements};
}
test('cancel does not delete or call the backend',async()=>{
  const f=fixture({confirm:false});await f.context.deleteFacebookEvidenceImage(0);
  assert.equal(f.calls.length,0);assert.equal(f.state.existingFiles.length,1);
});
test('deletion targets the saved delivery and path and refreshes the requirement',async()=>{
  const f=fixture();await f.context.deleteFacebookEvidenceImage(0);
  const payload=f.calls.find(c=>c[0]==='fetch')[1];
  assert.equal(payload.accion,'eliminar_imagen_facebook');assert.equal(payload.entrega,45);assert.equal(payload.path,'own/0.jpg');
  assert.equal(f.state.existingFiles.length,0);assert.equal(f.state.editing,false);
  assert.ok(f.calls.some(c=>c[0]==='reload'));assert.equal(f.state.busy,false);
});
test('deleting one of multiple images retains editing and the others',async()=>{
  const f=fixture({files:2});await f.context.deleteFacebookEvidenceImage(0);
  assert.equal(f.state.existingFiles.length,1);assert.equal(f.state.editing,true);
});
test('storage failure retains a retry target and does not claim successful deletion',async()=>{
  const f=fixture({result:{ok:false,retirada:true,motivo:'limpieza_pendiente'}});
  await f.context.deleteFacebookEvidenceImage(0);
  assert.equal(f.state.existingFiles.length,1);assert.equal(f.state.existingFiles[0].deletionPending,true);
  assert.ok(f.calls.some(c=>c[0]==='message'&&c[1].includes('reintentar')));assert.equal(f.state.busy,false);
});
test('authorization failure leaves evidence intact',async()=>{
  const f=fixture({result:{ok:false,motivo:'fuera_horario_edicion'}});await f.context.deleteFacebookEvidenceImage(0);
  assert.equal(f.state.existingFiles.length,1);assert.equal(f.state.existingFiles[0].deletionPending,undefined);
});

test('multiple clicks while confirmation is open produce one deletion',async()=>{
  const f=fixture();let decide;let prompts=0;
  f.context.requestFacebookDeleteConfirmation=()=>{prompts++;return new Promise(resolve=>decide=resolve);};
  const first=f.context.deleteFacebookEvidenceImage(0);
  await f.context.deleteFacebookEvidenceImage(0);
  assert.equal(prompts,1);assert.equal(f.calls.length,0);
  decide(true);await first;
  assert.equal(f.calls.filter(c=>c[0]==='fetch').length,1);assert.equal(f.state.confirming,false);
});

test('deletion displays progress and disables controls until the request settles',async()=>{
  const f=fixture();let finish;
  const control={disabled:false},alreadyDisabled={disabled:true};
  const editor=f.context.$('daily-evidence-editor');editor.querySelectorAll=()=>[control,alreadyDisabled];
  f.context.fetch=()=>new Promise(resolve=>finish=resolve);
  const pending=f.context.deleteFacebookEvidenceImage(0);
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.context.$('facebook-delete-progress').hidden,false);
  assert.equal(editor['aria-busy'],'true');assert.equal(control.disabled,true);
  finish({ok:false,json:async()=>({ok:false,motivo:'conexion'})});await pending;
  assert.equal(f.context.$('facebook-delete-progress').hidden,true);
  assert.equal(editor['aria-busy'],undefined);assert.equal(control.disabled,false);assert.equal(alreadyDisabled.disabled,true);
});

test('dialog mounts above editor, traps focus and cancels without a backend call',async()=>{
  const f=fixture();vm.runInContext(source,f.context);
  const doc=f.context.document;
  function element(){return {hidden:false,inert:false,isConnected:true,events:new Map(),
    addEventListener(type,fn){this.events.set(type,fn);},removeEventListener(type){this.events.delete(type);},
    focus(){doc.activeElement=this;},click(){this.events.get('click')?.();}};}
  const modal=element(),cancel=element(),yes=element(),backdrop=element(),editor=element(),trigger=element();
  const body={append(el){el.parentElement=this;},classList:{add(){},remove(){}}};
  doc.body=body;doc.activeElement=trigger;
  modal.querySelector=s=>s==='.facebook-delete-cancel'?cancel:{textContent:''};
  modal.querySelectorAll=()=>[backdrop,cancel];
  for(const [key,value] of Object.entries({'facebook-delete-modal':modal,'facebook-delete-confirm':yes,'facebook-delete-warning':element(),'daily-evidence-editor':editor}))f.elements.set(key,value);
  const pending=f.context.requestFacebookDeleteConfirmation({last:true});
  assert.equal(modal.parentElement,body);assert.equal(editor.inert,true);assert.equal(doc.activeElement,cancel);
  assert.equal(await f.context.requestFacebookDeleteConfirmation(),false);
  let prevented=false;modal.events.get('keydown')({key:'Tab',shiftKey:true,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(doc.activeElement,yes);
  modal.events.get('keydown')({key:'Escape',preventDefault(){},stopPropagation(){}});
  assert.equal(await pending,false);assert.equal(editor.inert,false);assert.equal(doc.activeElement,trigger);
  assert.equal(modal.hidden,true);assert.equal(modal.events.size,0);assert.equal(yes.events.size,0);
  const confirmed=f.context.requestFacebookDeleteConfirmation();yes.click();assert.equal(await confirmed,true);
  assert.equal(f.calls.length,0);
});
