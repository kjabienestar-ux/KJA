/* Eliminación explícita de colaboradores dados de baja. */
let adminPersonDeleteBusy=false;
async function deleteAdminInactivePerson(id,button){
  const person=APP.adminTeam?.personas?.find(p=>String(p.id)===String(id));
  if(adminPersonDeleteBusy||!APP.adminTeam?.puede_editar||!person||person.activo!==false)return;
  if(!confirm(`¿Eliminar definitivamente a ${person.nombre}?\n\nSe borrarán su ficha y los registros asociados de asistencia, contratos, solicitudes, días libres y entregas. Su acceso personal al portal quedará desactivado. Los archivos almacenados no se borran con esta operación.\n\nEsta acción no se puede deshacer.`))return;
  adminPersonDeleteBusy=true;
  const original=button.textContent;button.disabled=true;button.textContent='Eliminando…';
  try{
    const {data,error}=await db.rpc('dash_admin_eliminar_colaborador',{p_colab:Number(id),p_nombre:person.nombre});
    if(error||!data?.ok){
      const messages={sin_permiso:'Tu cuenta no tiene permiso para eliminar colaboradores.',activo:'El colaborador está activo. Actualiza el directorio.',no_existe:'El colaborador ya no existe. Actualiza el directorio.',confirmacion:'Los datos cambiaron. Actualiza el directorio e inténtalo de nuevo.',cuenta_admin:'Esta persona tiene acceso administrativo. Retira ese acceso antes de eliminarla.',archivos_pendientes:'Hay archivos pendientes de eliminación. Completa esa operación antes de eliminar al colaborador.',referencias:'Hay registros vinculados que impiden eliminar al colaborador. No se realizó ningún cambio.'};
      alert(error?.code==='PGRST202'?'Ejecuta dashboard_99_eliminar_colaboradores_baja.sql en Supabase para activar esta opción.':messages[data?.motivo]||'No se pudo eliminar. Inténtalo de nuevo.');return;
    }
    APP.adminTeam.personas=APP.adminTeam.personas.filter(p=>String(p.id)!==String(id));
    fillAdminTeamFilters();renderAdminPeople();renderAdminContracts();
    toast('Colaborador eliminado definitivamente.');
  }catch(_error){alert('No se pudo confirmar la eliminación. Actualiza el directorio antes de volver a intentarlo.');}
  finally{adminPersonDeleteBusy=false;button.disabled=false;button.textContent=original;}
}
$('admin-people-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-team-delete]');
  if(button)deleteAdminInactivePerson(button.dataset.teamDelete,button);
});
