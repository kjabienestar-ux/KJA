/* Solo pruebas de navegador: sustituye la biblioteca remota mediante routing de
   Playwright. Este archivo no se referencia desde el portal real. */
(() => {
  const fixture=window.__SEGUIMIENTO_FIXTURE__;
  const lab=window.seguimientoLab={calls:[],mode:'data',waiting:[],data:fixture.data};
  const response=(name,args={})=>{
    if(lab.mode==='error')return {data:null,error:{message:'Fallo de ensayo'}};
    const source=lab.data[name];
    return {data:JSON.parse(JSON.stringify(source).replaceAll(fixture.date,args.p_fecha||fixture.date)),error:null};
  };
  lab.release=()=>{lab.mode='data';for(const resolve of lab.waiting.splice(0))resolve()};
  const session={user:{id:'00000000-0000-0000-0000-000000000040',user_metadata:{}},access_token:'test-only-not-a-token'};
  const db={
    async rpc(name,args){
      lab.calls.push({name,args});
      if(name==='dash_arranque'){
        if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
        return {data:{inicio:{ok:true,perfil:{nombre:'Cuenta de ensayo',nivel:'sistemas'},colaborador:null,dia:{fecha:fixture.date}},acceso:{rol:fixture.role||'direccion',acceso_panel:true,superadmin:false}},error:null};
      }
      if(name==='dash_admin_solicitudes_agrupadas')return {data:{ok:true,solicitudes:[]},error:null};
      if(Object.hasOwn(lab.data,name)){
        if(lab.mode==='hold')await new Promise(resolve=>lab.waiting.push(resolve));
        return response(name,args);
      }
      return {data:{ok:false,motivo:'sin_permiso'},error:null};
    },
    auth:{getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session.user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null}),updateUser:async()=>({data:{user:session.user},error:null})},
    from(name){
      const rows=name==='asis_colaboradores'?lab.data.dash_admin_cierres.personas.map(person=>({id:person.id,nombre:person.nombre,area_id:person.area_id,asis_areas:{nombre:person.area}})):[];
      const query={then:(ok,bad)=>Promise.resolve({data:rows,error:null}).then(ok,bad)};
      for(const method of ['select','eq','neq','in','is','not','order','gte','lte','limit','maybeSingle','single'])query[method]=()=>query;return query;
    },
    storage:{from:()=>({createSignedUrl:async()=>({data:null,error:null}),createSignedUrls:async()=>({data:[],error:null})})},
    functions:{invoke:async()=>({data:{ok:false,motivo:'sin_permiso'},error:null})},
    channel(){const channel={on:()=>channel,subscribe:()=>channel};return channel},removeChannel:async()=>{}
  };
  window.supabase={createClient:()=>db};
})();
