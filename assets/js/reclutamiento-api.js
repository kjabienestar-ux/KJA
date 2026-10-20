/* Transporte compartido: la sesión administrativa se conserva en el cliente existente. */
(function () {
  'use strict';
  const URL = 'https://xadxmfgdxwplmhijagix.supabase.co';
  const KEY = 'sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub';
  async function publicRpc(name, args) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(`${URL}/rest/v1/rpc/${name}`, {
        method: 'POST', signal: controller.signal,
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      const body = await response.json();
      if (!response.ok) throw Object.assign(new Error(body.message || 'No se pudo guardar la solicitud.'), { code: body.code });
      return body;
    } finally { clearTimeout(timer); }
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('No se pudo leer el CV. Vuelve a adjuntarlo.'));
      reader.readAsDataURL(file);
    });
  }
  window.KJARecruitmentAPI = {
    async submit(id, datos, file) {
      if (!file || !file.size || file.size > 10 * 1024 * 1024) throw new Error('Adjunta un CV válido de hasta 10 MB.');
      return publicRpc('rec_enviar_postulacion', { p_id: id, p_datos: datos, p_cv_base64: await readFile(file) });
    },
    async rpc(client, name, args = {}) {
      const { data, error } = await client.rpc(name, args);
      if (error) throw error;
      return data;
    },
    message(error) {
      if (['PGRST202', '42P01', '42883'].includes(error?.code)) return 'El servicio de postulaciones aún no está habilitado. Comunícate con KJA o vuelve a intentarlo más tarde.';
      if (error?.name === 'AbortError') return 'La conexión tardó demasiado. Reintenta el envío; tu solicitud no se duplicará.';
      if (error instanceof TypeError) return 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
      return error?.message || 'No se pudo completar la operación. Vuelve a intentarlo.';
    }
  };
})();
