/* El archivo retirado conserva su registro y revisión; no equivale a una aprobación. */
(function(root){
  'use strict';
  const buckets=new Set(['asis-evidencias','asis-cierre-evidencias','solicitud-evidencias']);
  const title='Presentado · Archivo retirado por el sistema';
  const description='Se conserva el registro de presentación y su estado de revisión original. El archivo fue respaldado antes de retirarse.';
  function markup(){return '<section class="evidence-archived" role="status"><strong>'+title+'</strong><p>'+description+'</p></section>';}
  async function resolve(storage,bucket,path,expires=900,rpc=(name,args)=>db.rpc(name,args)){
    let result;
    try{result=await storage.from(bucket).createSignedUrl(path,expires);}
    catch(error){result={data:null,error};}
    if(result?.data?.signedUrl&&!result.error)return result;
    if(buckets.has(bucket)){
      try{
        const status=await rpc('dash_archivo_archivado',{p_bucket:bucket,p_path:path});
        if(!status.error&&status.data?.archivado===true){
          return {data:null,error:null,archived:true,retiredAt:status.data.retirado_at};
        }
      }catch{/* Un error de red o permisos nunca se presenta como archivado. */}
    }
    return result||{data:null,error:new Error('Archivo no disponible')};
  }
  root.KJAEvidenceArchive={resolve,markup,title,description};
})(typeof globalThis==='undefined'?window:globalThis);
