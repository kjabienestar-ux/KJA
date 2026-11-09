// Run with a server-side key in KJA_ARCHIVE_SERVICE_KEY, never from a browser.
// Download/verification only. Does not delete or modify remote objects.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Pass the private backup directory');
const source=JSON.parse((await fs.readFile(path.join(root,'objects-before.json'),'utf8')).replace(/^\uFEFF/,''));
const objects=source.rows;
if(!Array.isArray(objects)||!objects.length)throw Error('Missing inventory');
const key=process.env.KJA_ARCHIVE_SERVICE_KEY;
const manifest=[],failures=[];let next=0,bytes=0;
const sha=(b,algo='sha256')=>crypto.createHash(algo).update(b).digest('hex');
function valid(data,o){
 const etag=String(o.metadata?.eTag||'').replaceAll('"','');
 return data.length===Number(o.metadata?.size)&&(!/^[a-f\d]{32}$/i.test(etag)||sha(data,'md5')===etag.toLowerCase());
}
async function work(){
 while(next<objects.length){
  const o=objects[next++],file=path.resolve(root,'files',o.bucket_id,o.bucket_id,o.name);
  if(!file.startsWith(path.join(root,'files')+path.sep))throw Error('Unsafe object path');
  try{
   let data=await fs.readFile(file).catch(()=>null);
   if(!data||!valid(data,o)){
    if(!key)throw Error('File missing or checksum mismatch');
    const url='https://xadxmfgdxwplmhijagix.supabase.co/storage/v1/object/authenticated/'+[o.bucket_id,...o.name.split('/')].map(encodeURIComponent).join('/');
    for(let attempt=0;attempt<4;attempt++){
     try{
      const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('Download HTTP '+response.status);
      data=Buffer.from(await response.arrayBuffer());
      if(!valid(data,o))throw Error('Remote file changed or checksum mismatch');
      await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.partial',data);await fs.rename(file+'.partial',file);break;
     }catch(error){if(attempt===3)throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
    }
   }
   const etag=String(o.metadata?.eTag||'').replaceAll('"','');
   manifest.push({...o,local:path.relative(root,file),sha256:sha(data),verifiedBytes:data.length,remoteMd5Verified:/^[a-f\d]{32}$/i.test(etag)});bytes+=data.length;
   if(manifest.length%250===0)console.log(JSON.stringify({verified:manifest.length,total:objects.length,mb:Math.round(bytes/1e6)}));
  }catch(error){failures.push({bucket:o.bucket_id,path:o.name,error:error.message});}
 }
}
await Promise.all(Array.from({length:24},()=>work()));
manifest.sort((a,b)=>(a.bucket_id+'/'+a.name).localeCompare(b.bucket_id+'/'+b.name));
await fs.writeFile(path.join(root,'verified-manifest.json'),JSON.stringify({project:'xadxmfgdxwplmhijagix',verifiedAt:new Date().toISOString(),complete:failures.length===0&&manifest.length===objects.length,expected:objects.length,verified:manifest.length,bytes,objects:manifest,failures},null,2));
console.log(JSON.stringify({expected:objects.length,verified:manifest.length,bytes,failures:failures.length}));
if(failures.length)process.exitCode=1;
