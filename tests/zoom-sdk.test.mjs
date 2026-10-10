import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {sdkAction,sdkSignature} from '../supabase/functions/zoom-reuniones/sdk.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const id='11111111-1111-4111-8111-111111111111',number='12345678901';
function setup(overrides={}){
 const calls=[],events=[];
 const config={ZOOM_MEETING_SDK_KEY:'sdk-key',ZOOM_MEETING_SDK_SECRET:'sdk-secret',ZOOM_SDK_TEST_MEETING_ID:number,...overrides.config};
 let count=0;
 const args={action:'sdk-start',body:{id,host_id:'attacker',role:0,meetingNumber:'99999999999'},identity:{id:'actor'},
 env:k=>config[k],
 user:{rpc:async()=>({data:overrides.allowed===false?false:overrides.revoke&&++count>1?false:true})},
 admin:{from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id,zoom_id:overrides.number||number,status:'ready'}}),insert:async event=>{events.push(event);return overrides.auditError?{error:true}:{};}})},
 zoom:{host:async host=>{calls.push(host);if(overrides.hostError)throw Error('wrong account');},request:async path=>{calls.push(path);return path.includes('/token')?{token:'private-zak'}:{id:number,host_id:'real-host',password:'pass',topic:'Test'};}}};
 return {args,calls,events};
}
test('signature binds meeting, host role and minimum lifetime; valid HMAC',async()=>{
 const jwt=await sdkSignature('key','secret',number,1800000000000),[header,payload,sig]=jwt.split('.');
 const claims=JSON.parse(Buffer.from(payload,'base64url'));
 assert.equal(claims.mn,number);assert.equal(claims.role,1);assert.equal(claims.exp-claims.iat,1800);
 assert.equal(sig,createHmac('sha256','secret').update(header+'.'+payload).digest('base64url'));
});
test('operator authorization is mandatory before Zoom access',async()=>{
 const s=setup({allowed:false});await assert.rejects(sdkAction(s.args),e=>e.status===403);assert.deepEqual(s.calls,[]);
});
test('production meeting cannot be started through pilot',async()=>{
 const s=setup({number:'97271980453'});await assert.rejects(sdkAction(s.args),e=>e.status===403);assert.deepEqual(s.calls,[]);
});
test('missing SDK credentials fail closed',async()=>{
 const s=setup({config:{ZOOM_MEETING_SDK_SECRET:''}});await assert.rejects(sdkAction(s.args),e=>e.status===503);assert.deepEqual(s.calls,[]);
});
test('authorization uses remote host and ignores client host/role/meeting',async()=>{
 const s=setup(),data=await sdkAction(s.args);
 assert.equal(data.meetingNumber,number);assert.equal(data.zak,'private-zak');
 assert.ok(s.calls.includes('/users/real-host/token?type=zak'));
 assert.equal(s.events[0].actor_id,'actor');assert.equal(JSON.stringify(s.events).includes('private-zak'),false);
 assert.equal(JSON.stringify(data).includes('sdk-secret'),false);
});
test('revocation while fetching host token denies issuance',async()=>{
 const s=setup({revoke:true});await assert.rejects(sdkAction(s.args),e=>e.status===403);assert.equal(s.events.length,0);
});
test('audit failure prevents credentials from being returned',async()=>{
 const s=setup({auditError:true});await assert.rejects(sdkAction(s.args),e=>e.status===503);
});
test('invalid local meeting id and institutional host fail closed',async()=>{
 const s=setup();s.args.body.id='bad';await assert.rejects(sdkAction(s.args));assert.equal(s.calls.length,0);
 const other=setup({hostError:true});await assert.rejects(sdkAction(other.args));assert.ok(!other.calls.some(x=>x.includes('/token')));
});
