// Explicitly authorized one-time operation. Default is plan-only; --execute retires files.
// Requires complete verified backup, fresh inventory, unchanged bytes and a deployed UI.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Private backup directory required');
const read=async name=>JSON.parse((await fs.readFile(path.join(root,name),'utf8')).replace(/^\uFEFF/,''));
const manifest=await read('verified-manifest.json');
if(!manifest.complete||manifest.verified!==manifest.expected||manifest.project!=='xadxmfgdxwplmhijagix')throw Error('Incomplete backup');
const currentDoc=await read('objects-current.json'),current=new Map(currentDoc.rows.map(o=>[o.bucket_id+'/'+o.name,o]));
const scope=new Set(['asis-evidencias','asis-cierre-evidencias','solicitud-evidencias']);
const cutoff=Date.parse('2026-11-01T05:00:00Z');
const protectedPaths=new Set((await read('protected-references.json')).rows.map(o=>o.bucket_id+'/'+o.name));
const candidates=[],skipped=[];
for(const o of manifest.objects){
 if(!scope.has(o.bucket_id)||!(Date.parse(o.created_at)<cutoff)||!(Date.parse(o.updated_at)<cutoff))continue;
 const c=current.get(o.bucket_id+'/'+o.name);
 if(!c||c.id!==o.id||c.updated_at!==o.updated_at||c.metadata?.eTag!==o.metadata?.eTag||Number(c.metadata?.size)!==o.verifiedBytes||protectedPaths.has(o.bucket_id+'/'+o.name)){
  skipped.push({bucket:o.bucket_id,path:o.name,reason:'missing, changed or later reference'});continue;
 }
 const local=path.resolve(root,o.local);
 if(!local.startsWith(root+path.sep))throw Error('Unsafe backup path');
 const data=await fs.readFile(local);
 if(data.length!==o.verifiedBytes||crypto.createHash('sha256').update(data).digest('hex')!==o.sha256||!o.remoteMd5Verified)throw Error('Unverified backup bytes');
 candidates.push(o);
}
const summary={project:manifest.project,cutoffExclusive:'2026-11-01T05:00:00Z',files:candidates.length,bytes:candidates.reduce((n,o)=>n+o.verifiedBytes,0),skipped:skipped.length};
await fs.writeFile(path.join(root,'retirement-plan.json'),JSON.stringify({summary,candidates,skipped},null,2));
console.log(JSON.stringify({plan:summary}));
if(!process.argv.includes('--execute'))process.exit(0);
const key=process.env.KJA_ARCHIVE_SERVICE_KEY;if(!key)throw Error('Server key required');
const site=await fetch('https://www.kjadmb.com/dashboard.html?archive-check='+Date.now(),{signal:AbortSignal.timeout(30000)});
const html=await site.text();if(!site.ok||!html.includes('evidence-archive.js?v=1')||!html.includes('dashboard.js?v=283-free-1-archive1'))throw Error('Archive UI not deployed');
const api='https://xadxmfgdxwplmhijagix.supabase.co';
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
const recordId='kja-storage-2026-11-07';
async function request(route,method,body,extraHeaders={}){
 const r=await fetch(api+route,{method,headers:{...headers,...extraHeaders},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error(method+' '+route.split('?')[0]+' HTTP '+r.status);
 return r;
}
const previous=await read('retirement-progress.json').catch(()=>({retired:[],changed:[]}));
const retired=previous.retired,changed=previous.changed;
// Recover a confirmed backup whose deletion succeeded before an interrupted acknowledgement.
const pending=await (await request('/rest/v1/asis_archivos_archivados?select=bucket_id,path,sha256&respaldo_id=eq.'+recordId+'&retirado_at=is.null','GET')).json();
for(const row of pending){
 const o=manifest.objects.find(x=>x.bucket_id===row.bucket_id&&x.name===row.path&&x.sha256===row.sha256);
 if(!o)throw Error('Unknown pending backup');
 if(!current.has(row.bucket_id+'/'+row.path)){
  const localData=await fs.readFile(path.resolve(root,o.local));
  if(crypto.createHash('sha256').update(localData).digest('hex')!==row.sha256)throw Error('Invalid pending local backup');
  await request('/rest/v1/rpc/asis_archivo_confirmar','POST',{p_bucket:row.bucket_id,p_paths:[row.path],p_respaldo:recordId});
  if(!retired.some(x=>x.bucket===row.bucket_id&&x.path===row.path))retired.push({bucket:row.bucket_id,path:row.path,bytes:o.verifiedBytes,sha256:o.sha256});
 }
}
// Sequential batches make interrupted operations recoverable and bound their effect.
for(const bucket of scope){
 const files=candidates.filter(o=>o.bucket_id===bucket);
 for(let i=0;i<files.length;i+=50){
  const batch=files.slice(i,i+50),confirmed=[];
  for(let j=0;j<batch.length;j+=10)await Promise.all(batch.slice(j,j+10).map(async o=>{
   const route='/storage/v1/object/authenticated/'+[bucket,...o.name.split('/')].map(encodeURIComponent).join('/');
   const r=await fetch(api+route,{method:'HEAD',headers,signal:AbortSignal.timeout(30000)});
   const expected=String(o.metadata.eTag).replaceAll('"','').toLowerCase();
   const actual=String(r.headers.get('etag')||'').replace(/^W\//,'').replaceAll('"','').toLowerCase();
   if(!r.ok||actual!==expected||Number(r.headers.get('content-length'))!==o.verifiedBytes){changed.push({bucket,path:o.name});return;}
   confirmed.push(o);
  }));
  if(!confirmed.length)continue;
  await request('/rest/v1/asis_archivos_archivados','POST',confirmed.map(o=>({bucket_id:bucket,path:o.name,objeto_id:o.id,bytes:o.verifiedBytes,sha256:o.sha256,respaldo_id:recordId,objeto_creado_at:o.created_at,objeto_actualizado_at:o.updated_at})),{Prefer:'resolution=ignore-duplicates'});
  const names=confirmed.map(o=>o.name);
  const check=new URLSearchParams({select:'path,sha256,respaldo_id',bucket_id:'eq.'+bucket,path:'in.('+names.map(n=>JSON.stringify(n)).join(',')+')'});
  const saved=await (await request('/rest/v1/asis_archivos_archivados?'+check,'GET')).json();
  if(saved.length!==confirmed.length||confirmed.some(o=>!saved.some(r=>r.path===o.name&&r.sha256===o.sha256&&r.respaldo_id===recordId)))throw Error('Backup audit does not match');
  // API removes actual bytes; no direct SQL deletion from storage.objects.
  await request('/storage/v1/object/'+encodeURIComponent(bucket),'DELETE',{prefixes:names});
  await request('/rest/v1/rpc/asis_archivo_confirmar','POST',{p_bucket:bucket,p_paths:names,p_respaldo:recordId});
  retired.push(...confirmed.map(o=>({bucket,path:o.name,bytes:o.verifiedBytes,sha256:o.sha256})));
  await fs.writeFile(path.join(root,'retirement-progress.json'),JSON.stringify({updatedAt:new Date().toISOString(),retired,changed},null,2));
  console.log(JSON.stringify({retired:retired.length,bytes:retired.reduce((n,o)=>n+o.bytes,0),changed:changed.length}));
 }
}
console.log(JSON.stringify({completed:true,retired:retired.length,changed:changed.length,bytes:retired.reduce((n,o)=>n+o.bytes,0)}));
