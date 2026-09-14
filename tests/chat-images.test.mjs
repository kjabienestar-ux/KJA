import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(sizes=[100000]){
 const revoked=[],qualities=[];
 const context={window:{},db:{auth:{onAuthStateChange(){}}},URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL:u=>revoked.push(u)},Image:class{naturalWidth=3000;naturalHeight=2000;set src(v){this.onload()}},document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob(fn,type,q){qualities.push(q);fn({size:sizes.length>1?sizes.shift():sizes[0],type})}})}};
 vm.runInNewContext(fs.readFileSync('assets/js/chat-images.js','utf8'),context);
 return {api:context.window.KJAChatImages,revoked,qualities};
}
test('compression lowers quality until target and releases local URL',async()=>{
 const h=setup([500000,220000,120000]);const blob=await h.api.compress({type:'image/png',size:5000000});
 assert.equal(blob.size,120000);assert.equal(blob.type,'image/jpeg');assert.equal(h.qualities.length,3);assert.equal(h.revoked.length,1);
});
test('rejects unsupported files, oversized originals and incompressible images',async()=>{
 const h=setup([400000]);await assert.rejects(h.api.compress({type:'image/svg+xml',size:1}));
 await assert.rejects(h.api.compress({type:'image/jpeg',size:21*1024*1024}));
 await assert.rejects(h.api.compress({type:'image/jpeg',size:1000}),/300 KB/);assert.equal(h.revoked.length,1);
});
test('ambiguous message retry reuses uploaded image and same client id',async()=>{
 const {api}=setup();let uploads=0,calls=[];const db={storage:{from:()=>({upload:async()=>{uploads++;return {}}})},rpc:async(name,args)=>{calls.push(args);return calls.length===1?{error:Error('network')}:{data:{id:5}}}};
 const w={id:'peer',pending:{id:'token'},attachment:{blob:{}}};
 await assert.rejects(api.send(w,db,'me','hi',()=>true));await api.send(w,db,'me','hi',()=>true);
 assert.equal(uploads,1);assert.deepEqual(calls[0],calls[1]);
});
test('upload failure cannot create a message and logout aborts after upload',async()=>{
 const {api}=setup();let calls=0;const db={storage:{from:()=>({upload:async()=>({error:{statusCode:'403'}})})},rpc:()=>{calls++}};
 const w={id:'peer',pending:{id:'token'},attachment:{blob:{}}};await assert.rejects(api.send(w,db,'me','',()=>true));assert.equal(calls,0);
 db.storage.from=()=>({upload:async()=>({})});await api.send(w,db,'me','',()=>false);assert.equal(calls,0);
});
