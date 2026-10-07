(function(root){
  'use strict';
  function present(day){
    const assigned=day.aplica_comparticiones===true;
    const delivered=assigned&&day.comparticiones_completas===true;
    const missing=assigned&&!delivered&&day.comparticiones_vencidas===true&&!day.futuro;
    const sharing=!Object.hasOwn(day,'aplica_comparticiones')?'Información de comparticiones no disponible.':!assigned?'Sin comparticiones asignadas.':delivered?'Comparticiones entregadas. La aprobación se revisa por separado.':missing?'El plazo terminó sin completar las evidencias de Facebook.':day.futuro?'Comparticiones programadas para esta fecha.':'Comparticiones pendientes; el plazo aún no vence.';
    if(missing)return {tone:'missing',label:'No compartió',reason:(day.lab?'Ese día tenías comparticiones asignadas. ':'No tenías jornada laboral, pero sí comparticiones asignadas. ')+sharing,sharing};
    if(day.futuro)return {tone:'future',label:assigned&&!day.lab?'Compartir':'Próximo',reason:day.lab?'Jornada programada; la fecha aún no llega.':assigned?'No tienes jornada laboral, pero sí comparticiones programadas.':'Día sin jornada ni comparticiones asignadas.',sharing};
    if(day.estado==='J'||day.justificado===true||day.cierre_estado==='justificado')return {tone:'j',label:'Justificado',reason:'La jornada está justificada; no exige entrada, RPE ni salida.',sharing};
    if(day.cierre_estado==='incompleta')return {tone:'incomplete',label:'Cierre incompleto',reason:'El cierre de la jornada figura incompleto. Revisa la salida y las evidencias del registro.',sharing};
    const states={P:['p','Presente',day.lab?'La entrada está registrada como puntual.':'Jornada laborada con entrada puntual fuera del horario habitual.'],T:['t','Tardanza',day.lab?'La entrada está registrada fuera de la tolerancia de puntualidad.':'Jornada laborada fuera del horario habitual y con tardanza.'],J:['j','Justificado','El día está registrado como justificado.'],NG:['ng','No gestionó','El día está registrado como no gestionado.']};
    const value=states[day.estado];
    if(value)return {tone:value[0],label:value[1],reason:value[2],sharing};
    if(!day.lab&&assigned)return {tone:delivered?'shared':'sharing-pending',label:delivered?'Compartido':'Por compartir',reason:delivered?'No tenías jornada laboral y completaste tus comparticiones.':'No tienes jornada laboral, pero debes completar las comparticiones antes de que venza su plazo.',sharing};
    return day.lab?{tone:'pending',label:'Sin entrada',reason:'No hay una entrada registrada para esta jornada laboral.',sharing}:{tone:'off',label:'No laborable',reason:'No tenías jornada laboral programada.',sharing};
  }
  root.KJAAttendanceCalendar={present};
  if(typeof module!=='undefined')module.exports={present};
})(typeof globalThis!=='undefined'?globalThis:this);
