import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {compressFlyer}=createRequire(import.meta.url)('../assets/js/marketing-model.js');
test('compression retains dimensions, releases memory and never increases file size',async()=>{
  for(const size of [100,2000]){
    let closed=false,drawn=false;
    const source=new Blob([new Uint8Array(1000)],{type:'image/png'});
    const encoded=new Blob([new Uint8Array(size)],{type:'image/webp'});
    const canvas={getContext:()=>({drawImage(){drawn=true;assert.equal(canvas.width,1600);assert.equal(canvas.height,2400);}}),toBlob(cb,type,quality){assert.equal(type,'image/webp');assert.equal(quality,.86);cb(encoded);}};
    const result=await compressFlyer(source,{createImageBitmap:async()=>({width:1600,height:2400,close(){closed=true;}}),document:{createElement:()=>canvas}});
    assert.equal(result,size<1000?encoded:source);assert.ok(closed&&drawn);assert.equal(canvas.width,0);
  }
});
test('oversized decoded images fail before allocating a canvas',async()=>{
  let closed=false;
  await assert.rejects(compressFlyer(new Blob(),{createImageBitmap:async()=>({width:10000,height:10000,close(){closed=true;}}),document:{createElement(){assert.fail('must not allocate');}}}),/40 megapíxeles/);
  assert.ok(closed);
});
