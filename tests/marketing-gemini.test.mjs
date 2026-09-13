import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWithGemini,readAndCache,flyerFields} from '../supabase/functions/marketing-publicaciones/gemini.mjs';
const datos=Object.fromEntries(flyerFields.map(k=>[k,k==='titulo'?'ADOS-2 y ADI-R':'']));
const image=new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'});
const input={apiKey:'test-key',model:'gemini-2.5-flash',image};
const output=(fields=datos)=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(fields)}]}}]});

test('Gemini sends the flyer inline with a server-side key and validates structured output',async()=>{
  let calls=0;
  const actual=await extractWithGemini({...input,fetcher:async(url,options)=>{
    calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'],'test-key');assert.ok(!url.includes('test-key'));
    const body=JSON.parse(options.body);assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/jpeg');
    assert.equal(body.contents[0].parts[1].inlineData.data,'/9j/AA==');
    assert.equal(body.generationConfig.responseMimeType,'application/json');
    return Response.json(output());
  }});
  assert.deepEqual(actual,datos);assert.equal(calls,1);
});
test('quota errors do not expose upstream bodies or automatically retry',async()=>{
  let calls=0;
  await assert.rejects(extractWithGemini({...input,fetcher:async()=>{calls++;return Response.json({secret:'private'}, {status:429})}}),/cuota de Gemini/);
  assert.equal(calls,1);
});
test('provider failures distinguish configuration causes without exposing upstream secrets',async()=>{
  for(const [status,reason,message,expected] of [
    [400,'API_KEY_INVALID','private-secret',/inválida o venció/],
    [403,'','Your API key was reported as leaked: private-secret',/por exposición/],
    [401,'','private-secret',/autenticación/],
    [404,'','private-secret',/modelo.*404/],
    [403,'SERVICE_DISABLED','private-secret',/deshabilitada/],
    [403,'API_KEY_SERVICE_BLOCKED','private-secret',/restricciones/],
    [400,'','private-secret',/solicitud.*400/]
  ]){
    await assert.rejects(extractWithGemini({...input,fetcher:async()=>Response.json({error:{message,details:[{reason}]}},{status})}),error=>{
      assert.match(error.message,expected);assert.doesNotMatch(error.message,/private-secret/);return true;
    });
  }
});
test('configuration ignores surrounding whitespace and rejects an empty key before sending',async()=>{
  await extractWithGemini({...input,apiKey:' test-key\n',model:' gemini-2.5-flash ',fetcher:async(url,options)=>{
    assert.equal(options.headers['x-goog-api-key'],'test-key');assert.ok(url.endsWith('/gemini-2.5-flash:generateContent'));return Response.json(output());
  }});
  await assert.rejects(extractWithGemini({...input,apiKey:' ',fetcher:()=>assert.fail('must not send')}),/no está configurada/);
});
test('incomplete, blocked, malformed and missing-field responses are not accepted',async()=>{
  for(const response of [
    {candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]},
    {promptFeedback:{blockReason:'SAFETY'}},
    {candidates:[{finishReason:'STOP',content:{parts:[{text:'not json'}]}}]},
    output({titulo:'Sin campos completos'})
  ])await assert.rejects(extractWithGemini({...input,fetcher:async()=>Response.json(response)}));
});
test('cache retrieval never calls Gemini, persistence or release',async()=>{
  const unexpected=async()=>assert.fail('Cache must not use a provider or consume another reservation');
  const result=await readAndCache({reserve:async()=>({cache:true,datos}),extract:unexpected,persist:unexpected,release:unexpected});
  assert.equal(result.cache,true);assert.deepEqual(result.datos,datos);
});
test('successful extraction persists before returning and is reused on a second request',async()=>{
  let cache=null,calls=0,releases=0;
  const operations={reserve:async()=>cache?{cache:true,datos:cache}:{token:'claim'},extract:async()=>{calls++;return datos},persist:async(value,token)=>{assert.equal(token,'claim');cache=value},release:async()=>{releases++}};
  assert.equal((await readAndCache(operations)).cache,false);
  assert.equal((await readAndCache(operations)).cache,true);
  assert.equal(calls,1);assert.equal(releases,1);
});
test('busy/quota reservation refuses extraction; provider and save failures release their claim',async()=>{
  await assert.rejects(readAndCache({reserve:async()=>({error:'La lectura ya está en curso.'}),extract:async()=>assert.fail('duplicate call')}),/en curso/);
  for(const failingStage of ['extract','persist']){
    let released=false;
    await assert.rejects(readAndCache({reserve:async()=>({token:'claim'}),extract:async()=>{if(failingStage==='extract')throw Error('failure');return datos},persist:async()=>{throw Error('failure')},release:async(token)=>{assert.equal(token,'claim');released=true}}),/failure/);
    assert.equal(released,true);
  }
});
