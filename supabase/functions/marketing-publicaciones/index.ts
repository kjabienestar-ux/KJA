// Credenciales exclusivamente en secretos de Supabase. No hay publicación automática al generar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractWithGemini, readAndCache } from './gemini.mjs';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const env=(key:string)=>Deno.env.get(key)||'';
const bucket='marketing-flyers';
const fields=['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje'];
const fail=(message:string)=>{throw new Error(message)};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'Método no permitido.'},405);
  try{
    const authorization=req.headers.get('Authorization')||'';
    const userDb=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const {data:identity,error:authError}=await userDb.auth.getUser();
    if(authError||!identity.user)return reply({error:'Vuelve a iniciar sesión.'},401);
    const {data:permission,error:permError}=await userDb.rpc('marketing_permiso');
    if(permError||!permission?.acceso)return reply({error:'Tu cuenta no tiene acceso a Publicaciones.'},403);
    // Leer con límite real incluso si Content-Length no está presente.
    const reader=req.body?.getReader();
    let size=0;const chunks:Uint8Array[]=[];
    if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>7500000){await reader.cancel();return reply({error:'El flyer supera el límite de 5 MB.'},413)}chunks.push(value)}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
    const uid=identity.user.id;
    const page=env('MARKETING_FACEBOOK_PAGE_ID');
    const token=env('MARKETING_FACEBOOK_PAGE_TOKEN');
    const version=env('MARKETING_FACEBOOK_GRAPH_VERSION');
    const facebook=!!(page&&token&&/^v\d+\.\d+$/.test(version));
    const model=env('MARKETING_GEMINI_MODEL').trim()||'gemini-2.5-flash';
    const ia=!!env('GEMINI_API_KEY').trim();
    if(body.accion==='estado')return reply({ia,facebook,puede_publicar:permission.publicar,pagina:env('MARKETING_FACEBOOK_PAGE_NAME')||'Página de KJA'});
    if(body.accion==='listar'){
      const {data,error}=await admin.from('marketing_publicaciones').select('id,datos,extraccion,estado,creado_at,facebook_id').eq('autor',uid).order('creado_at',{ascending:false}).limit(30);
      if(error)fail('No se pudo consultar el historial.');return reply({items:data});
    }
    if(body.accion==='crear'){
      const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.imagen||''));
      if(!match)fail('Selecciona un flyer JPG, PNG o WebP.');
      const raw=Uint8Array.from(atob(match![2]),c=>c.charCodeAt(0));
      if(!raw.length||raw.length>5242880)fail('El flyer debe pesar como máximo 5 MB.');
      const magic=match![1]==='jpeg'?raw[0]===255&&raw[1]===216&&raw[2]===255:
        match![1]==='png'?raw.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':
        new TextDecoder().decode(raw.slice(0,4))==='RIFF'&&new TextDecoder().decode(raw.slice(8,12))==='WEBP';
      if(!magic)fail('El archivo no es una imagen válida.');
      const {count,error:countError}=await admin.from('marketing_publicaciones').select('id',{count:'exact',head:true}).eq('autor',uid).gte('creado_at',new Date(Date.now()-86400000).toISOString());
      if(countError)fail('No se pudo validar la carga.');if((count||0)>=30)fail('Alcanzaste las 30 cargas de hoy. Reutiliza un borrador existente.');
      const id=crypto.randomUUID(),path=`${uid}/${id}.${match![1]}`;
      const {error:uploadError}=await admin.storage.from(bucket).upload(path,raw,{contentType:'image/'+match![1],upsert:false});
      if(uploadError)fail('No se pudo guardar el flyer. Intenta nuevamente.');
      const {error}=await admin.from('marketing_publicaciones').insert({id,autor:uid,imagen_path:path});
      if(error){await admin.storage.from(bucket).remove([path]);fail('No se pudo crear el borrador.')}
      return reply({id});
    }
    if(!/^[0-9a-f-]{36}$/.test(String(body.id||'')))fail('Selecciona un borrador.');
    const {data:draft,error:draftError}=await admin.from('marketing_publicaciones').select('*').eq('id',body.id).eq('autor',uid).single();
    if(draftError||!draft)return reply({error:'No se encontró tu borrador.'},404);
    if(body.accion==='cargar'){
      const {data,error}=await admin.storage.from(bucket).createSignedUrl(draft.imagen_path,3600);
      if(error)fail('No se pudo abrir el flyer.');return reply({borrador:draft,imagen:data?.signedUrl});
    }
    if(draft.estado!=='borrador')fail(draft.estado==='publicado'?'Este borrador ya está publicado.':'Esta publicación debe verificarse en Facebook antes de volver a enviarla.');
    if(body.accion==='analizar'){
      if(draft.extraccion)return reply({datos:draft.extraccion,cache:true});
      if(!ia)return reply({error:'La lectura automática todavía no está configurada. Puedes completar los datos manualmente.'},503);
      const result=await readAndCache({
        reserve:async()=>{
          const {data,error}=await admin.rpc('marketing_iniciar_lectura',{p_autor:uid,p_id:draft.id,p_modelo:model});
          if(error||!data)fail('No se pudo reservar la lectura. Pide a Sistemas revisar la migración de Gemini.');
          return data;
        },
        extract:async()=>{
          const {data:image,error}=await admin.storage.from(bucket).download(draft.imagen_path);
          if(error||!image)fail('No se pudo leer la imagen guardada.');
          return extractWithGemini({apiKey:env('GEMINI_API_KEY'),model,image});
        },
        persist:async(datos:Record<string,string>,reservation:string)=>{
          const {data:stored,error}=await admin.from('marketing_publicaciones').update({extraccion:datos,extraccion_modelo:model,extraccion_at:new Date().toISOString()})
            .eq('id',draft.id).eq('autor',uid).eq('lectura_token',reservation).select('id').maybeSingle();
          if(error||!stored)fail('No se pudo guardar la lectura. Vuelve a abrir el borrador antes de intentarlo de nuevo.');
        },
        release:async(reservation:string)=>{
          await admin.from('marketing_publicaciones').update({lectura_token:null,lectura_inicio:null})
            .eq('id',draft.id).eq('autor',uid).eq('lectura_token',reservation);
        }
      });
      return reply(result);
    }
    if(body.accion==='guardar'){
      const data=body.datos;
      if(!data||fields.some(k=>typeof data[k]!=='string'||data[k].length>6000))fail('Revisa los campos del borrador.');
      const phone=data.telefono.replace(/[\s()+-]/g,'');
      if(!data.titulo.trim()||!/^[1-9]\d{7,14}$/.test(phone)||!data.mensaje.trim())fail('Completa título, teléfono internacional y mensaje de WhatsApp.');
      const link='https://wa.me/'+phone+'?text='+encodeURIComponent(data.mensaje.trim());
      if(typeof body.copy!=='string'||!body.copy.trim()||body.copy.length>20000||!body.copy.includes(link))fail('El copy debe incluir el enlace de WhatsApp vigente. Vuelve a generar el borrador.');
      const {data:saved,error}=await admin.from('marketing_publicaciones').update({datos:Object.fromEntries(fields.map(k=>[k,data[k]])),copy:body.copy,enlace:link,actualizado_at:new Date().toISOString()}).eq('id',draft.id).eq('estado','borrador').select('id').maybeSingle();
      if(error||!saved)fail('No se pudo guardar; vuelve a cargar el borrador.');return reply({ok:true});
    }
    if(body.accion==='publicar'){
      if(!permission.publicar)return reply({error:'Tu cuenta puede preparar borradores, pero no publicar.'},403);
      if(!facebook)return reply({error:'Facebook todavía no está configurado.'},503);
      if(body.revisado!==true||!draft.copy||!draft.enlace)fail('Guarda y revisa el borrador antes de publicar.');
      if(body.copy!==draft.copy)fail('El borrador cambió en otra sesión. Vuelve a cargarlo y revisarlo.');
      const {data:image,error:imageError}=await admin.storage.from(bucket).download(draft.imagen_path);
      if(imageError||!image)fail('No se pudo recuperar el flyer para publicar.');
      // Cambio atómico: un doble clic o dos pestañas no publican dos veces.
      const {data:locked,error:lockError}=await admin.from('marketing_publicaciones').update({estado:'publicando',actualizado_at:new Date().toISOString()}).eq('id',draft.id).eq('estado','borrador').eq('actualizado_at',draft.actualizado_at).select('id').maybeSingle();
      if(lockError||!locked)fail('El borrador cambió o ya está siendo publicado. Vuelve a cargarlo.');
      try{
        const form=new FormData();form.set('source',image,'flyer');form.set('message',draft.copy);form.set('published','true');
        const response=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(page)}/photos`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form,signal:AbortSignal.timeout(45000)});
        const result=await response.json();
        if(!response.ok||!result.id)throw new Error('facebook');
        const postId=String(result.post_id||result.id);
        const {error}=await admin.from('marketing_publicaciones').update({estado:'publicado',facebook_id:postId,actualizado_at:new Date().toISOString()}).eq('id',draft.id);
        if(error)throw new Error('registro');
        return reply({ok:true,facebook_id:postId});
      }catch{
        await admin.from('marketing_publicaciones').update({estado:'verificar'}).eq('id',draft.id);
        return reply({error:'No pudimos confirmar el resultado. Revisa la página de Facebook y contacta a Sistemas antes de reintentar para evitar duplicados.'},502);
      }
    }
    return reply({error:'Acción desconocida.'},400);
  }catch(error){
    // Nunca se devuelven errores crudos de proveedores, tokens o rutas privadas.
    const message=error instanceof Error?error.message:'';
    const safe=/^(Ingresa|Selecciona|El |La |Los |No |Revisa|Completa|Este |Esta |Tu |Alcanzaste)/.test(message);
    return reply({error:safe?message:'No se pudo completar la operación. Revisa la conexión e inténtalo nuevamente.'},400);
  }
});
