import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/js/marketing-image-cache.js';
test('reopening reuses bytes, expiry refetches and scope cleanup revokes blobs',async()=>{
 let calls=0,time=0,serial=0;const revoked=[];
 const cache=globalThis.KJAMarketingImageCache({now:()=>time,fetchImage:async()=>{calls++;return {ok:true,blob:async()=>new Blob(['flyer'])}},urls:{createObjectURL:()=>`blob:${++serial}`,revokeObjectURL:u=>revoked.push(u)}});
 try{assert.equal(await cache.get('a','signed-1'),'blob:1');assert.equal(await cache.get('a','signed-2'),'blob:1');assert.equal(calls,1);time=51000;assert.equal(await cache.get('a','signed-3'),'blob:2');assert.equal(calls,2);cache.clear();assert.deepEqual(revoked,['blob:1','blob:2'])}finally{cache.clear()}
});
test('failed downloads can retry and pending data cannot survive signout',async()=>{
 let finish;const cache=globalThis.KJAMarketingImageCache({fetchImage:()=>new Promise(r=>finish=r),urls:{createObjectURL:()=>{throw Error('must not retain')},revokeObjectURL(){}}});
 const pending=cache.get('a','signed');cache.clear();finish({ok:true,blob:async()=>new Blob(['x'])});await assert.rejects(pending,/sesión/);cache.clear();
});
test('active image survives cache expiry until it is replaced',async()=>{
 let time=0,serial=0;const revoked=[];
 const cache=globalThis.KJAMarketingImageCache({now:()=>time,fetchImage:async()=>({ok:true,blob:async()=>new Blob(['image'])}),urls:{createObjectURL:()=>`blob:${++serial}`,revokeObjectURL:u=>revoked.push(u)}});
 try{const first=await cache.get('a','source');cache.setActive(first);time=51000;const next=await cache.get('a','fresh');assert.equal(revoked.includes(first),false);cache.setActive(next);assert.equal(revoked.includes(first),true)}finally{cache.clear()}
});
