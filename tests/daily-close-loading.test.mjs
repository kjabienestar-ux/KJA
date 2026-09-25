import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function loadDailyClose('),source.indexOf('\nfunction clearDailyEvidenceFiles('));
function harness(rpc,previous){
  const nodes=new Map();let renders=0;
  const env={APP:{identity:{hasPersonal:true},cierre:previous,dailyCloseResolved:!!previous,dailyCloseGeneration:0},db:{rpc},
    $:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:'',classList:{contains:()=>false}});return nodes.get(id)},
    showDailyCloseLoadError(message){env.$('error').textContent=message;env.$('error').hidden=false;},
    dailyCloseMessage(message){env.$('error').textContent=message;env.$('error').hidden=false;},
    mergeDailyIssueState:data=>data,mergeDailyReviewState:data=>data,
    renderDailyClose(){renders++;env.$('error').hidden=true;}};
  vm.runInNewContext(code,env);
  return {env,nodes,renders:()=>renders};
}
test('quiet failures remain visible with a server reason, preserving existing pending work',async()=>{
  const old={ok:true,requisitos:[{completo:false}]};
  const h=harness(async()=>({data:{ok:false,motivo:'no_existe'}}),old);
  await h.env.loadDailyClose({quiet:true});
  assert.equal(h.nodes.get('error').hidden,false);
  assert.match(h.nodes.get('error').textContent,/no_existe/);
  assert.match(h.nodes.get('error').textContent,/última actualización/);
  assert.equal(h.env.APP.cierre,old);
});
test('missing RPC and transport errors surface instead of silently hiding the close',async()=>{
  for(const rpc of [async()=>({error:{code:'PGRST202'}}),async()=>{throw Error('offline')}]){
    const h=harness(rpc);await h.env.loadDailyClose({quiet:true});
    assert.equal(h.nodes.get('error').hidden,false);
    assert.equal(h.env.APP.dailyCloseRequest,null);
    assert.equal(h.renders(),0);
  }
});
test('retry restores pending work even if supplementary review queries fail',async()=>{
  let ready=false;
  const h=harness(async name=>{
    if(name!=='dash_cierre_hoy')throw Error('unavailable');
    return {data:ready?{ok:true,requisitos:[{tipo:'rpe',completo:false}]}:null};
  });
  await h.env.loadDailyClose({quiet:true});
  assert.equal(h.nodes.get('error').hidden,false);
  ready=true;await h.env.loadDailyClose();
  assert.equal(h.renders(),1);
  assert.equal(h.nodes.get('error').hidden,true);
  assert.equal(h.env.APP.cierre.requisitos[0].tipo,'rpe');
  assert.equal(h.env.APP.dailyCloseResolved,true);
});
