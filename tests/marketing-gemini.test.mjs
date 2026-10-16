import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWithGemini,readAndCache,refineWithGemini,flyerFields} from '../supabase/functions/marketing-publicaciones/gemini.mjs';
const datos=Object.fromEntries(flyerFields.map(k=>[k,k==='titulo'?'ADOS-2 y ADI-R':'']));
const image=new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'});
const input={apiKey:'test-key',model:'gemini-3.1-flash-lite',image,wait:async()=>{}};
const output=(fields=datos)=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(fields)}]}}]});

test('Gemini sends the flyer inline with a server-side key and validates structured output',async()=>{
  let calls=0;
  const actual=await extractWithGemini({...input,fetcher:async(url,options)=>{
    calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'],'test-key');assert.ok(!url.includes('test-key'));
    const body=JSON.parse(options.body);assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/jpeg');
    const instruction=body.systemInstruction.parts[0].text;
    assert.match(instruction,/bloques pequeños, pie de página/);
    assert.match(instruction,/de 20 a 35 palabras en total y máximo 40/);
    assert.match(instruction,/sin prometer dominio/);
    assert.match(instruction,/No inventes público, modalidad, beneficios, precio, fechas/);
    assert.match(instruction,/CRITERIO EDITORIAL KJA/);
    assert.match(instruction,/No deduzcas profesiones/);
    assert.match(instruction,/Tema: aplicación concreta/);
    assert.match(instruction,/EJEMPLO DE ESTILO, NO DE DATOS/);
    assert.match(instruction,/No rellenes para cumplir una longitud/);
    assert.match(instruction,/no lo conviertas en WhatsApp/);
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

test('a transient overload retries once with the same deadline and recovers',async()=>{
  let calls=0,firstSignal,waits=0;
  const actual=await extractWithGemini({...input,wait:async ms=>{assert.equal(ms,1200);waits++},fetcher:async(url,options)=>{
    calls++;
    if(calls===1){firstSignal=options.signal;return new Response('busy',{status:503})}
    assert.equal(options.signal,firstSignal);
    return Response.json(output());
  }});
  assert.deepEqual(actual,datos);assert.equal(calls,2);assert.equal(waits,1);
});

test('temporary HTTP failures include a safe diagnostic and preserve manual retry',async()=>{
  for(const code of [500,503,504,502]){
    let calls=0;
    await assert.rejects(extractWithGemini({...input,fetcher:async()=>{calls++;return new Response('private-secret',{status:code});}}),error=>{
      assert.ok(error.message.includes(String(code)));assert.match(error.message,/flyer sigue guardado/);assert.doesNotMatch(error.message,/private-secret/);return true;
    });
    assert.equal(calls,2);
  }
});

test('network and timeout failures do not expose provider details',async()=>{
  for(const name of ['TimeoutError','AbortError','TypeError']){
    await assert.rejects(extractWithGemini({...input,fetcher:async()=>{const error=new Error('private-secret');error.name=name;throw error;}}),error=>{
      assert.match(error.message,name==='TypeError'?/conectar/:/tardó demasiado/);assert.doesNotMatch(error.message,/private-secret/);return true;
    });
  }
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
  await extractWithGemini({...input,apiKey:' test-key\n',model:' gemini-3.1-flash-lite ',fetcher:async(url,options)=>{
    assert.equal(options.headers['x-goog-api-key'],'test-key');assert.ok(url.endsWith('/gemini-3.1-flash-lite:generateContent'));return Response.json(output());
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

test('refineWithGemini sends user prompt and current copy, returning the molded copy',async()=>{
  let calls=0;
  const copy='Texto inicial KJA\n📲 Contáctanos: 51988918238';
  const prompt='Hazlo más directo';
  const refined=await refineWithGemini({
    apiKey:'test-key',
    model:'gemini-3.1-flash-lite',
    copy,
    prompt,
    fetcher:async(url,options)=>{
      calls++;
      const body=JSON.parse(options.body);
      assert.match(body.contents[0].parts[0].text,/Texto actual de la publicación/);
      assert.match(body.contents[0].parts[0].text,/Hazlo más directo/);
      assert.equal(body.generationConfig.responseMimeType,'application/json');
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({copy:'Texto moldeado directo\n📲 Contáctanos: 51988918238'})}]}}]});
    }
  });
  assert.equal(refined,'Texto moldeado directo\n📲 Contáctanos: 51988918238');
  assert.equal(calls,1);
});

