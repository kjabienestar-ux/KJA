import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWithGemini} from '../supabase/functions/marketing-publicaciones/gemini.mjs';
import {publicErrorMessage} from '../supabase/functions/marketing-publicaciones/errors.mjs';
const input={apiKey:'private-key',model:'gemini-3.8-flash',wait:async()=>{},image:new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'})};
test('Gemini failure explanations survive the function response filter without leaking provider bodies',async()=>{
  for(const code of [400,401,403,404,429,500,503,504]){
    let caught;
    try{await extractWithGemini({...input,fetcher:async()=>new Response(JSON.stringify({error:{message:'private-upstream-body'}}),{status:code})})}catch(error){caught=error}
    assert.ok(caught);
    const message=publicErrorMessage(caught);
    assert.equal(message,caught.message);assert.doesNotMatch(message,/private-key|private-upstream-body|Revisa la conexión e inténtalo/);
  }
});
test('blocked output and timeout remain actionable; unexpected errors stay hidden',async()=>{
  for(const fetcher of [async()=>Response.json({candidates:[{finishReason:'SAFETY'}]}),async()=>{const error=new Error('private timeout');error.name='TimeoutError';throw error}]){
    let caught;try{await extractWithGemini({...input,fetcher})}catch(error){caught=error}
    assert.equal(publicErrorMessage(caught),caught.message);
  }
  assert.doesNotMatch(publicErrorMessage(new Error('Gemini raw error private-key')),/private-key/);
});
