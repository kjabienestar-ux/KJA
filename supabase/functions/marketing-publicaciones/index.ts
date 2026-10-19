// Credenciales exclusivamente en secretos de Supabase. No hay publicación automática al generar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractWithGemini, readAndCache, refineWithGemini } from './gemini.mjs';
import { publicationPhones } from './phones.mjs';
import { partialDraft } from './drafts.mjs';
import { shortenerData, validateWalink } from './shortener.mjs';
import { storeCampaignLink, kjaLinkKey, kjaLink } from './kja-links.mjs';
import { publicErrorMessage } from './errors.mjs';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const env=(key:string)=>Deno.env.get(key)||'';
const campaignLink=(key:string)=>kjaLink(key,env('MARKETING_WHATSAPP_ORIGIN').trim());
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
    const rawModel=env('MARKETING_GEMINI_MODEL').replace(/^["']|["']$/g,'').trim();
    const model=rawModel||'gemini-3.5-flash-lite';
    const ia=!!env('GEMINI_API_KEY').trim();
    if(body.accion==='estado'){
      let cuota={usadas:0,limite:200,disponibles:200,proxima_renovacion:null as string|null};
      if(ia){
        try{
          const cutOff=new Date(Date.now()-86400000).toISOString();
          const {data:lecturas}=await admin.from('marketing_lecturas').select('creado_at').eq('modelo',model).gte('creado_at',cutOff).order('creado_at',{ascending:true});
          const count=lecturas?.length||0;
          const oldest=lecturas?.[0]?.creado_at;
          cuota={
            usadas:count,
            limite:200,
            disponibles:Math.max(0,200-count),
            proxima_renovacion:oldest?new Date(new Date(oldest).getTime()+86400000).toISOString():null
          };
        }catch{}
      }
      return reply({ia,modelo:/^gemini-[a-z0-9.-]+$/.test(model)?model:'',facebook,puede_publicar:permission.publicar,administrar:Boolean(permission.administrar),pagina:env('MARKETING_FACEBOOK_PAGE_NAME')||'Página de KJA',cuota});
    }
    if(body.accion==='listar'){
      const offset=Number(body.offset||0);
      if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail('La página del historial no es válida.');

      let autoresList:Array<{id:string,nombre:string}>=[];
      let allowedUids:string[]=[uid];

      if(permission.administrar){
        try{
          const {data:colabAccesos}=await admin.from('marketing_colaboradores_acceso').select('colaborador_id,area_id');
          const permittedColabIds=(colabAccesos||[]).map(c=>c.colaborador_id).filter(Boolean);

          const {data:activeColabs}=permittedColabIds.length?await admin.from('asis_colaboradores').select('id,nombre,area_id').in('id',permittedColabIds).eq('activo',true):{data:[]};
          const validColabIds=(activeColabs||[]).filter(c=>{
            const acc=colabAccesos?.find(a=>a.colaborador_id===c.id);
            return acc&&acc.area_id===c.area_id;
          }).map(c=>c.id);

          const {data:directAccesos}=await admin.from('marketing_accesos').select('usuario_id');
          const directUids=(directAccesos||[]).map(d=>d.usuario_id).filter(Boolean);

          const {data:allPerfiles}=await admin.from('asis_perfiles').select('id,nombre,colaborador_id').eq('activo',true);
          const allColabIds=(allPerfiles||[]).map(p=>p.colaborador_id).filter(Boolean);
          const allColabMap=new Map<number,string>();
          if(allColabIds.length){
            const {data:allColabs}=await admin.from('asis_colaboradores').select('id,nombre').in('id',allColabIds);
            (allColabs||[]).forEach(c=>allColabMap.set(c.id,c.nombre));
          }

          const seenUids=new Set<string>();
          (allPerfiles||[]).forEach(p=>{
            const isColabPermitted=Boolean(p.colaborador_id&&validColabIds.includes(p.colaborador_id));
            const isDirectPermitted=directUids.includes(p.id);
            const isCurrentAdmin=p.id===uid;
            if((isColabPermitted||isDirectPermitted||isCurrentAdmin)&&!seenUids.has(p.id)){
              seenUids.add(p.id);
              const name=(p.colaborador_id?allColabMap.get(p.colaborador_id):null)||p.nombre||'Colaborador';
              autoresList.push({id:p.id,nombre:isCurrentAdmin?name+' (Tú)':name});
            }
          });
          allowedUids=Array.from(seenUids);
          autoresList.sort((a,b)=>{
            if(a.id===uid)return -1;
            if(b.id===uid)return 1;
            return a.nombre.localeCompare(b.nombre,'es');
          });
        }catch{}
      }

      let query=admin.from('marketing_publicaciones')
        .select('id,autor,datos,extraccion,copy,enlace,estado,creado_at,actualizado_at,facebook_id,imagen_path',{count:'exact'})
        .is('eliminado_at',null)
        .order('creado_at',{ascending:false})
        .order('id',{ascending:false})
        .range(offset,offset+29);

      const targetAutor=String(body.autor||'').trim();
      if(permission.administrar){
        if(targetAutor&&targetAutor!=='todos'&&targetAutor!=='me'){
          if(!/^[0-9a-f-]{36}$/.test(targetAutor))fail('El autor seleccionado no es válido.');
          query=query.eq('autor',targetAutor);
        }else if(targetAutor==='todos'){
          if(allowedUids.length){
            query=query.in('autor',allowedUids);
          }
        }else{
          query=query.eq('autor',uid);
        }
      }else{
        query=query.eq('autor',uid);
      }

      const {data,error,count}=await query;
      if(error)fail('No se pudo consultar el historial.');
      const rows=data||[];
      const {data:images}=rows.length?await admin.storage.from(bucket).createSignedUrls(rows.map(row=>row.imagen_path),3600):{data:[]};

      let authorMap=new Map<string,string>();

      if(permission.administrar){
        const authorUids=[...new Set(rows.map(r=>r.autor).filter(Boolean))];
        if(authorUids.length){
          const {data:perfiles}=await admin.from('asis_perfiles').select('id,nombre,colaborador_id').in('id',authorUids);
          const colabIds=(perfiles||[]).map(p=>p.colaborador_id).filter(Boolean);
          const colabMap=new Map<number,string>();
          if(colabIds.length){
            const {data:colabs}=await admin.from('asis_colaboradores').select('id,nombre').in('id',colabIds);
            (colabs||[]).forEach(c=>colabMap.set(c.id,c.nombre));
          }
          (perfiles||[]).forEach(p=>{
            const name=(p.colaborador_id?colabMap.get(p.colaborador_id):null)||p.nombre||'Colaborador';
            authorMap.set(p.id,name);
          });
        }
      }

      const items=rows.map((row,i)=>({
        ...row,
        imagen:images?.[i]?.signedUrl||'',
        autor_nombre:authorMap.get(row.autor)||(row.autor===uid?'Tú':'Colaborador'),
        es_propio:row.autor===uid
      }));

      return reply({
        items,
        total:count||0,
        has_more:offset+rows.length<(count||0),
        autores:permission.administrar?autoresList:undefined
      });
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
    let draftQuery=admin.from('marketing_publicaciones').select('*').eq('id',body.id);
    if(!permission.administrar){
      draftQuery=draftQuery.eq('autor',uid);
    }
    const {data:draft,error:draftError}=await draftQuery.maybeSingle();
    if(draftError||!draft)return reply({error:'No se encontró la publicación.'},404);
    if(draft.eliminado_at)return reply({error:'Esta publicación fue eliminada del portal.'},404);
    if(body.accion==='eliminar'){
      if(!['borrador','publicado'].includes(draft.estado))fail('Verifica primero el envío a Facebook antes de eliminar este registro.');
      let delQuery=admin.from('marketing_publicaciones').update({eliminado_at:new Date().toISOString(),actualizado_at:new Date().toISOString()})
        .eq('id',draft.id).eq('estado',draft.estado).eq('actualizado_at',draft.actualizado_at).is('eliminado_at',null);
      if(!permission.administrar){
        delQuery=delQuery.eq('autor',uid);
      }
      const {data:removed,error}=await delQuery.select('id').maybeSingle();
      if(error||!removed)fail('No se pudo eliminar. Vuelve a abrir la publicación para consultar su estado actual.');
      return reply({ok:true});
    }
    if(body.accion==='cargar'){
      const {data,error}=await admin.storage.from(bucket).createSignedUrl(draft.imagen_path,3600);
      if(error)fail('No se pudo abrir el flyer.');
      let autor_nombre='';
      if(draft.autor!==uid){
        try{
          const {data:perf}=await admin.from('asis_perfiles').select('nombre,colaborador_id').eq('id',draft.autor).maybeSingle();
          if(perf?.colaborador_id){
            const {data:colab}=await admin.from('asis_colaboradores').select('nombre').eq('id',perf.colaborador_id).maybeSingle();
            autor_nombre=colab?.nombre||perf.nombre||'Colaborador';
          }else{
            autor_nombre=perf?.nombre||'Colaborador';
          }
        }catch{}
      }
      if(draft.datos?.acortador!=='walink'&&!kjaLinkKey(draft.enlace)){
        try{
          const {data:existing}=await admin.from('marketing_whatsapp_enlaces').select('clave').eq('publicacion_id',draft.id).order('creado_at',{ascending:false}).limit(1).maybeSingle();
          if(existing?.clave){
            draft.enlace=campaignLink(existing.clave);
            await admin.from('marketing_publicaciones').update({enlace:draft.enlace}).eq('id',draft.id);
          }else{
            const sourceData=draft.datos||draft.extraccion||{};
            const title=String(sourceData.titulo||'').trim();
            if(title){
              const phone=publicationPhones(sourceData.telefono)[0]||'51988918238';
              const cleanTitle=title.replace(/^[^\p{L}\p{N}]+/u,'').trim().toUpperCase();
              const article=/^(TERAPIA|FORMACIÓN|EVALUACIÓN|CAPACITACIÓN)\b/u.test(cleanTitle)?'la ':/^(CURSO|TALLER|DIPLOMADO)\b/u.test(cleanTitle)?'el ':'';
              const isTherapy=/terapia|atenci[oó]n psicol[oó]gica|consulta psicol[oó]gica/i.test([title,sourceData.descripcion,sourceData.temario,sourceData.modalidad].filter(Boolean).join(' '))&&!/curso|taller|diplomado|formaci[oó]n|capacitaci[oó]n|certificaci[oó]n/i.test(title);
              const defaultMsg='Hola KJA 👋\nVengo de Facebook, deseo información sobre '+article+cleanTitle+'.\n\n'+(isTherapy?'¿Me pueden orientar sobre la atención, el costo y los horarios disponibles?':'¿Me comparten el precio, las próximas fechas y cómo inscribirme?')+'\n¡Gracias!';
              const msg=String(sourceData.mensaje||'').trim()||defaultMsg;
              const firma='short6:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(phone+'\n'+msg)))).map(x=>x.toString(16).padStart(2,'0')).join('');
              const key=await storeCampaignLink(admin,{publicacion_id:draft.id,firma,destino:'https://wa.me/'+phone+'?text='+encodeURIComponent(msg)});
              draft.enlace=campaignLink(key);
              await admin.from('marketing_publicaciones').update({enlace:draft.enlace}).eq('id',draft.id);
            }
          }
        }catch{}
      }
      return reply({borrador:draft,imagen:data?.signedUrl,autor_nombre,es_propio:draft.autor===uid});
    }
    if(draft.estado!=='borrador')fail(draft.estado==='publicado'?'Este borrador ya está publicado.':'Esta publicación debe verificarse en Facebook antes de volver a enviarla.');
    if(body.accion==='guardar_borrador'){
      const snapshot=partialDraft(body.datos,body.copy);
      let saveDraftQuery=admin.from('marketing_publicaciones').update({...snapshot,actualizado_at:new Date().toISOString()})
        .eq('id',draft.id).eq('estado','borrador').eq('actualizado_at',draft.actualizado_at).is('eliminado_at',null);
      if(!permission.administrar){
        saveDraftQuery=saveDraftQuery.eq('autor',uid);
      }
      const {data:saved,error}=await saveDraftQuery.select('id').maybeSingle();
      if(error||!saved)fail('No se pudo guardar. La publicación pudo cambiar en otra sesión; vuelve a abrirla.');
      return reply({ok:true});
    }
    if(body.accion==='enlace'){
      const phone=String(body.telefono||'').replace(/[\s()+-]/g,''),message=String(body.mensaje||'').trim();
      if(!/^[1-9]\d{7,14}$/.test(phone)||!message||message.length>2000)fail('Completa el WhatsApp y un mensaje de hasta 2000 caracteres.');
      const firma='short6:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(phone+'\n'+message)))).map(x=>x.toString(16).padStart(2,'0')).join('');
      const existing=await admin.from('marketing_whatsapp_enlaces').select('clave').eq('publicacion_id',draft.id).eq('firma',firma).maybeSingle();
      if(existing.error)fail('No se pudo generar el enlace corto. Aplica marketing_03_whatsapp_enlaces.sql en Supabase.');
      let key=existing.data?.clave;
      if(!key){
        const {count,error:countError}=await admin.from('marketing_whatsapp_enlaces').select('clave',{count:'exact',head:true}).eq('publicacion_id',draft.id);
        if(countError||(count||0)>=100)fail('No se pueden crear más enlaces para este borrador.');
        key=await storeCampaignLink(admin,{publicacion_id:draft.id,firma,destino:'https://wa.me/'+phone+'?text='+encodeURIComponent(message)});
      }
      try{await admin.from('marketing_publicaciones').update({enlace:campaignLink(key)}).eq('id',draft.id);}catch{}
      return reply({enlace:campaignLink(key)});
    }
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
    if(body.accion==='moldear'){
      if(!ia)return reply({error:'La IA todavía no está configurada.'},503);
      const prompt=String(body.prompt||'').trim();
      const currentCopy=String(body.copy||draft.copy||'').trim();
      if(!prompt)fail('Escribe una indicación para moldear el texto.');
      if(!currentCopy)fail('El texto a moldear está vacío.');

      const cutOff=new Date(Date.now()-86400000).toISOString();
      const {count,error:countError}=await admin.from('marketing_lecturas').select('*',{count:'exact',head:true}).eq('modelo',model).gte('creado_at',cutOff);
      if(countError||(count||0)>=200)fail('El equipo alcanzó las 200 consultas de IA en las últimas 24 horas.');
      const cutOffMin=new Date(Date.now()-60000).toISOString();
      const {count:countMin}=await admin.from('marketing_lecturas').select('*',{count:'exact',head:true}).eq('modelo',model).gte('creado_at',cutOffMin);
      if((countMin||0)>=5)fail('El equipo alcanzó las 5 consultas por minuto. Espera un momento antes de volver a moldear.');

      const improvedCopy=await refineWithGemini({apiKey:env('GEMINI_API_KEY'),model,copy:currentCopy,prompt});
      await admin.from('marketing_lecturas').insert({autor:uid,modelo:model});
      const {data:lecturas}=await admin.from('marketing_lecturas').select('creado_at').eq('modelo',model).gte('creado_at',cutOff).order('creado_at',{ascending:true});
      const updatedCount=lecturas?.length||0;
      const oldest=lecturas?.[0]?.creado_at;
      const cuota={
        usadas:updatedCount,
        limite:200,
        disponibles:Math.max(0,200-updatedCount),
        proxima_renovacion:oldest?new Date(new Date(oldest).getTime()+86400000).toISOString():null
      };
      await admin.from('marketing_publicaciones').update({copy:improvedCopy,actualizado_at:new Date().toISOString()}).eq('id',draft.id);
      return reply({ok:true,copy:improvedCopy,cuota});
    }
    if(body.accion==='guardar'){
      const data=body.datos;
      if(!data||fields.some(k=>typeof data[k]!=='string'||data[k].length>6000))fail('Revisa los campos del borrador.');
      const optionKeys=['certificado','material','peru','vacantes'];
      const options=data.opciones||{};
      if(typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!optionKeys.includes(k)||typeof options[k]!=='boolean'))fail('Revisa las opciones de esta campaña.');
      const phone=publicationPhones(data.telefono)[0]||'';
      if(!data.titulo.trim()||!/^[1-9]\d{7,14}$/.test(phone)||!data.mensaje.trim())fail('Completa título, teléfono internacional y mensaje de WhatsApp.');
      let link='https://wa.me/'+phone+'?text='+encodeURIComponent(data.mensaje.trim());
      if(data.acortador==='walink'){
        try{link=validateWalink(data,body.enlace,phone);}catch(error){fail(error.message);}
      }else if(body.enlace){
        const key=kjaLinkKey(body.enlace);
        if(!key)fail('El enlace corto no es válido. Vuelve a generarlo.');
        const {data:short,error:shortError}=await admin.from('marketing_whatsapp_enlaces').select('destino').eq('clave',key).eq('publicacion_id',draft.id).maybeSingle();
        if(shortError||short?.destino!==link)fail('El mensaje cambió. Genera el enlace corto actualizado.');link=body.enlace;
      }
      const post=String(data.facebook_url||'').trim();
      if(post){let url;try{url=new URL(post)}catch{fail('El enlace de Facebook no es válido.')}
        if(url.protocol!=='https:'||url.username||url.password||!['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','fb.watch'].includes(url.hostname))fail('El enlace de Facebook no es válido.');}
      if(typeof body.copy!=='string'||!body.copy.trim()||body.copy.length>20000||!body.copy.includes(link))fail('El copy debe incluir el enlace de WhatsApp vigente. Vuelve a generar el borrador.');
      const {data:saved,error}=await admin.from('marketing_publicaciones').update({datos:{...shortenerData(data),...Object.fromEntries(fields.map(k=>[k,data[k]])),facebook_url:post,opciones:Object.fromEntries(optionKeys.map(k=>[k,options[k]===true]))},copy:body.copy,enlace:link,actualizado_at:new Date().toISOString()}).eq('id',draft.id).eq('estado','borrador').is('eliminado_at',null).select('id').maybeSingle();
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
      const {data:locked,error:lockError}=await admin.from('marketing_publicaciones').update({estado:'publicando',actualizado_at:new Date().toISOString()}).eq('id',draft.id).eq('estado','borrador').eq('actualizado_at',draft.actualizado_at).is('eliminado_at',null).select('id').maybeSingle();
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
    return reply({error:publicErrorMessage(error)},400);
  }
});
