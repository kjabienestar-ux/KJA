// Solo mensajes redactados por la aplicación, nunca respuestas crudas de Google.
export class MarketingPublicError extends Error {
  constructor(message){super(message);this.name='MarketingPublicError';}
}
export function publicErrorMessage(error){
  const message=error instanceof Error?error.message:'';
  const safe=error instanceof MarketingPublicError||/^(Ingresa|Selecciona|El |La |Los |No |Revisa|Completa|Este |Esta |Tu |Alcanzaste)/.test(message);
  return safe?message:'No se pudo completar la operación. Revisa la conexión e inténtalo nuevamente.';
}
