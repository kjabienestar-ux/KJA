import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/facebook-receipt.js',import.meta.url),'utf8');
const data={entrega_id:12,colaborador:'Ana Pérez',area:'Diseño Gráfico',fecha:'2026-09-15',registrado_at:'2026-09-15T20:20:00Z'};
function fixture(rpc){
  const element=()=>({value:'',disabled:false,textContent:'',reset(){},focus(){},select(){},reportValidity(){}});
  const form=element(),input=element(),status=element(),textarea=element(),prepare=element(),share=element(),download=element(),copy=element();
  const native=element();
  const elements={'form':form,'input':input,'[role=status]':status,'textarea':textarea,'[data-share]':share,'[data-native-share]':native,'[data-download]':download,'[data-copy]':copy};
  const panel={querySelector:s=>elements[s],querySelectorAll:()=>[share,native,download,copy]};
  form.querySelector=()=>prepare;
  const context={Intl,Date,AbortController,DOMException,console,document:{getElementById:()=>panel},navigator:{},setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(source,context);
  return {...elements,form,input,status,textarea,prepare,share,context,api:context.FacebookReceipt,db:{rpc}};
}
test('quantity rejects empty, decimals, negatives and excessive values',()=>{
  const {api}=fixture();
  for(const value of ['',0,-1,'1.5','1e2',100000,'abc'])assert.equal(api.quantity(value),null);
  assert.equal(api.quantity('47'),47);
});
test('message uses delivery date, Lima registration time and collaborator area',()=>{
  const {api}=fixture();const text=api.message(data,47);
  assert.match(text,/Cantidad: 47/);assert.match(text,/Fecha: 15\/09\/2026/);
  assert.match(text,/Hora de registro: 15:20/);assert.match(text,/Área: Diseño Gráfico/);
  assert.match(text,/KJA-FB-12/);assert.doesNotMatch(text,/https?:|dni/i);
});
test('saved quantity is restored; changing it invalidates share actions',async()=>{
  const f=fixture(async()=>({data:{ok:true,cantidad:47}}));
  await f.api.open(f.db,data,[{}]);assert.equal(f.input.value,47);
  f.input.oninput();assert.equal(f.share.disabled,true);assert.equal(f.textarea.value,'');
});
test('save failure prevents rendering and sharing and allows retry',async()=>{
  const calls=[];
  const f=fixture(async(name,args)=>{calls.push(args);return args.p_cantidad?{error:{message:'offline'}}:{data:{ok:true,cantidad:47}};});
  await f.api.open(f.db,data,[{}]);f.input.value='47';
  await f.form.onsubmit({preventDefault(){}});
  assert.equal(calls[1].p_entrega_id,12);assert.equal(calls[1].p_cantidad,47);
  assert.match(f.status.textContent,/No se pudo guardar/);assert.equal(f.share.disabled,true);assert.equal(f.prepare.disabled,false);
});
test('closing during loading ignores the stale response',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));
  const opening=f.api.open(f.db,data,[{}]);f.api.reset();resolve({data:{ok:true,cantidad:99}});await opening;
  assert.equal(f.input.value,'');assert.equal(f.status.textContent,'');assert.equal(f.share.disabled,true);
});
test('unavailable quantity RPC keeps preparation disabled',async()=>{
  const f=fixture(async()=>({error:{code:'PGRST202'}}));
  await f.api.open(f.db,data,[{}]);
  assert.equal(f.prepare.disabled,true);assert.equal(f.share.disabled,true);assert.match(f.status.textContent,/Dirección/);
});
test('download and caption copy bypass native sharing, including clipboard failure',async()=>{
  const f=fixture(async()=>({data:{ok:true,cantidad:47}}));
  const canvas={getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback({})};
  let downloads=0;let copied;let nativeCalls=0;let selected=false;
  const anchor={click(){downloads++;},remove(){}};
  Object.assign(f.context,{fetch:async()=>({ok:true,blob:async()=>({})}),URL:{createObjectURL:()=>'',revokeObjectURL(){}},Image:class{naturalWidth=600;naturalHeight=1200;async decode(){}},File:class{constructor(parts,name,opts){this.name=name;this.type=opts.type;}},setTimeout:()=>0});
  f.context.document.createElement=tag=>tag==='canvas'?canvas:anchor;
  f.context.document.body={append(){}};
  f.context.navigator.share=()=>{nativeCalls++;};
  f.context.navigator.clipboard={writeText:async text=>{copied=text;}};
  f.textarea.select=()=>{selected=true;};
  await f.api.open(f.db,data,[{url:'fixture'}]);f.input.value='47';
  await f.form.onsubmit({preventDefault(){}});
  await f.share.onclick();
  assert.equal(downloads,1);assert.match(copied,/Cantidad: 47/);
  assert.equal(anchor.download,'KJA-FB-12.jpg');assert.equal(nativeCalls,0);
  assert.match(f.status.textContent,/antes de enviar/);
  const native=f['[data-native-share]'];let payload;let finish;
  f.context.navigator.canShare=()=>true;
  f.context.navigator.share=value=>{nativeCalls++;payload=value;return new Promise(resolve=>finish=resolve);};
  const pending=native.onclick();await native.onclick();
  assert.equal(nativeCalls,1);assert.match(f.status.textContent,/Ya hay un envío/);
  assert.equal(payload.files[0].name,'KJA-FB-12.jpg');assert.match(payload.text,/Cantidad: 47/);
  finish();await pending;assert.match(f.status.textContent,/no confirma/);
  f.context.navigator.share=async()=>{throw new DOMException('Cancelled','AbortError');};
  await native.onclick();assert.match(f.status.textContent,/cancelado/);
  f.context.navigator.canShare=()=>false;await native.onclick();assert.match(f.status.textContent,/no permite/);
  f.context.navigator.clipboard.writeText=async()=>{throw new Error('Denied');};
  await f.share.onclick();assert.equal(downloads,2);assert.equal(selected,true);assert.equal(nativeCalls,1);
  f.input.oninput();await f.share.onclick();assert.equal(downloads,2);
});
test('fixed image dimensions include all evidence and release canvas memory',async()=>{
  const f=fixture();let dimensions;let drawings=0;const paintedText=[];
  const canvas={getContext:()=>({fillRect(){},fillText(text){paintedText.push(text);},drawImage(){drawings++;}}),toBlob(callback){dimensions=[this.width,this.height];callback({});}};
  Object.assign(f.context,{fetch:async()=>({ok:true,blob:async()=>({})}),URL:{createObjectURL:()=>'',revokeObjectURL(){}},Image:class{naturalWidth=600;naturalHeight=1200;async decode(){}},File:class{constructor(parts,name,opts){this.name=name;this.type=opts.type;}}});
  f.context.document.createElement=()=>canvas;
  const file=await f.api.render(data,Array.from({length:50},()=>({url:'fixture'})),47,new AbortController().signal);
  assert.deepEqual(dimensions,[1200,8184]);assert.equal(drawings,50);assert.equal(canvas.width,1);assert.equal(file.type,'image/jpeg');
  assert.deepEqual(paintedText,[],'The generated image must not duplicate the caption as pixels');
});
