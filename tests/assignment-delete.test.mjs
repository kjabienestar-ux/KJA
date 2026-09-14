import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('supabase/functions/dash-entrega/index.ts','utf8');
const block=source.slice(source.indexOf('    if (body.accion === "eliminar_asignacion")'),source.indexOf('    const cutoff'));
const run=new Function('body','usuario','servicio','json','BUCKET',`return (async()=>{${block}})()`);
function harness({allowed=true,fail=false,paths=['a.pdf','b.docx']}={}){
 const removed=[],cleared=[];
 const user={rpc:async()=>({data:allowed?{ok:true,paths}:{ok:false,motivo:'sin_permiso'}})};
 const service={storage:{from:()=>({remove:async batch=>{removed.push(batch);return {error:fail?Error('offline'):null}}})},from:()=>({delete:()=>({eq:()=>({in:async(k,batch)=>{cleared.push(batch);return {}}})})})};
 return {removed,cleared,go:()=>run({accion:'eliminar_asignacion',asignacion:42},user,service,(data,status=200)=>({data,status}),'asis-cierre-evidencias')};
}
test('only authorized server-returned paths are deleted and acknowledged',async()=>{const h=harness();assert.equal((await h.go()).data.eliminada,true);assert.deepEqual(h.removed,[['a.pdf','b.docx']]);assert.deepEqual(h.cleared,h.removed)});
test('unauthorized requests never reach Storage',async()=>{const h=harness({allowed:false});assert.equal((await h.go()).status,403);assert.equal(h.removed.length,0)});
test('Storage failure preserves queue for retry and does not report success',async()=>{const h=harness({fail:true});assert.equal((await h.go()).data.motivo,'limpieza_pendiente');assert.equal(h.cleared.length,0)});
test('large assignments delete bounded batches',async()=>{const h=harness({paths:Array.from({length:205},(_,i)=>String(i))});assert.equal((await h.go()).data.eliminada,true);assert.deepEqual(h.removed.map(b=>b.length),[100,100,5])});
