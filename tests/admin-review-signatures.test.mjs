import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
function setup(reply){const calls=[];const env={Map,Set,Error,db:{storage:{from:bucket=>({createSignedUrls:async(paths,ttl)=>{calls.push({bucket,paths,ttl});return reply(paths)}})}}};vm.runInNewContext(src.slice(src.indexOf('async function adminReviewSignedBatch('),src.indexOf('let ADMIN_DRAW=')),env);return {calls,run:env.adminReviewSignedBatch};}
test('one fresh request per opening, distinct paths and unchanged expiry',async()=>{const h=setup(paths=>({data:paths.map(path=>({path,signedUrl:'private:'+path}))}));const files=[{path:'a'},{path:'a'},{path:'b'}];const result=await h.run(files);await h.run(files);assert.equal(h.calls.length,2);assert.equal(h.calls[0].paths.length,2);assert.equal(h.calls[0].ttl,900);assert.equal(result.get('a').signedUrl,'private:a');});
test('denied or missing individual results never expose a partial gallery',async()=>{for(const data of [[{path:'a',signedUrl:'a'},{path:'b',error:'denied'}],[{path:'a',signedUrl:'a'}]]){const h=setup(()=>({data}));await assert.rejects(h.run([{path:'a'},{path:'b'}]));}});
test('request failures propagate and empty galleries make no request',async()=>{const h=setup(()=>({error:Error('offline')}));assert.equal((await h.run([])).size,0);assert.equal(h.calls.length,0);await assert.rejects(h.run([{path:'a'}]));});
