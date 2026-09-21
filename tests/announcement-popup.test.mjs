import test from 'node:test';
import assert from 'node:assert/strict';

// Mock simple de localStorage para el entorno de test en Node
const mockStorage = new Map();
global.localStorage = {
  getItem: key => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: key => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

const KJAAnnouncementModal = await import('../assets/js/dashboard-announcement-modal.js').then(m => m.default || m);

test('Normalización de días de gestión en múltiples formatos', () => {
  // 1. Array de nombres en español
  const user1 = {
    id: 1,
    nombre: 'Luis Guerrero',
    diasGestion: ['lunes', 'jueves', 'viernes']
  };
  const days1 = KJAAnnouncementModal.normalizeManagementDays(user1);
  assert.deepEqual(Array.from(days1).sort(), [1, 4, 5]);

  // 2. Abreviaturas y mayúsculas/minúsculas
  const user2 = {
    id: 2,
    nombre: 'María Ramos',
    diasGestion: ['Mar', 'MIÉ', 'JUE']
  };
  const days2 = KJAAnnouncementModal.normalizeManagementDays(user2);
  assert.deepEqual(Array.from(days2).sort(), [2, 3, 4]);

  // 3. Array dias_laborables estándar de Supabase (1..7)
  const user3 = {
    id: 3,
    nombre: 'Carlos Silva',
    dias_laborables: [1, 2, 3, 4, 5]
  };
  const days3 = KJAAnnouncementModal.normalizeManagementDays(user3);
  assert.deepEqual(Array.from(days3).sort(), [1, 2, 3, 4, 5]);

  // 4. Objeto horario_semanal con filtro de 'no_gestiona'
  const user4 = {
    id: 4,
    nombre: 'Ana Torres',
    horario_semanal: {
      '1': { mod: 'virtual' },
      '2': { mod: 'no_gestiona' },
      '4': { mod: 'presencial' },
      '5': { mod: 'virtual' },
      '6': { mod: 'no_gestiona' }
    }
  };
  const days4 = KJAAnnouncementModal.normalizeManagementDays(user4);
  assert.deepEqual(Array.from(days4).sort(), [1, 4, 5]);
});

test('Evaluación de si una fecha es día de gestión del usuario', () => {
  const user = {
    id: 10,
    nombre: 'Luis',
    diasGestion: ['lunes', 'jueves', 'viernes']
  };

  // 2026-09-21 es Lunes (ISO 1)
  assert.equal(KJAAnnouncementModal.isManagementDay(user, '2026-09-21'), true);

  // 2026-09-22 es Martes (ISO 2)
  assert.equal(KJAAnnouncementModal.isManagementDay(user, '2026-09-22'), false);

  // 2026-09-23 es Miércoles (ISO 3)
  assert.equal(KJAAnnouncementModal.isManagementDay(user, '2026-09-23'), false);

  // 2026-09-24 es Jueves (ISO 4)
  assert.equal(KJAAnnouncementModal.isManagementDay(user, '2026-09-24'), true);

  // 2026-09-25 es Viernes (ISO 5)
  assert.equal(KJAAnnouncementModal.isManagementDay(user, '2026-09-25'), true);

  // 2026-09-26 es Sábado (ISO 6)
  assert.equal(KJAAnnouncementModal.isManagementDay(user, '2026-09-26'), false);

  // 2026-09-27 es Domingo (ISO 7)
  assert.equal(KJAAnnouncementModal.isManagementDay(user, '2026-09-27'), false);
});

test('Flujo completo de 3 días de aparición solo en días de gestión', () => {
  mockStorage.clear();

  const anuncio = {
    id: 'anuncio-test-001',
    titulo: 'Comunicado de Prueba',
    diasDeAparicion: 3,
    fechaInicio: '2026-09-01',
    activo: true
  };

  const user = {
    id: 101,
    nombre: 'Colaborador A',
    diasGestion: ['lunes', 'jueves', 'viernes']
  };

  // DÍA 1: Lunes 21 de Septiembre (Día de gestión)
  const fechaLunes = '2026-09-21';
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaLunes), true, 'Debe mostrarse el Lunes (día 1)');

  // Registrar visualización del Lunes
  const state1 = KJAAnnouncementModal.recordView(anuncio, user, fechaLunes);
  assert.equal(state1.diasVistos, 1);
  assert.equal(state1.completado, false);

  // Mismo día Lunes al recargar la página -> NO debe volver a aparecer
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaLunes), false, 'No debe repetirse el mismo día');

  // DÍA 2 (para el calendario): Martes 22 de Septiembre (NO es día de gestión de este usuario)
  const fechaMartes = '2026-09-22';
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaMartes), false, 'No debe mostrarse el Martes porque no gestiona');

  // Miércoles 23 de Septiembre (NO es día de gestión)
  const fechaMiercoles = '2026-09-23';
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaMiercoles), false, 'No debe mostrarse el Miércoles');

  // DÍA 2 (de gestión): Jueves 24 de Septiembre (Día de gestión)
  const fechaJueves = '2026-09-24';
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaJueves), true, 'Debe mostrarse el Jueves (día 2 de gestión)');

  // Registrar visualización del Jueves
  const state2 = KJAAnnouncementModal.recordView(anuncio, user, fechaJueves);
  assert.equal(state2.diasVistos, 2);
  assert.equal(state2.completado, false);

  // Mismo día Jueves al recargar
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaJueves), false, 'No debe repetirse el Jueves');

  // DÍA 3 (de gestión): Viernes 25 de Septiembre (Día de gestión)
  const fechaViernes = '2026-09-25';
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaViernes), true, 'Debe mostrarse el Viernes (día 3 de gestión)');

  // Registrar visualización del Viernes (completa los 3 días)
  const state3 = KJAAnnouncementModal.recordView(anuncio, user, fechaViernes);
  assert.equal(state3.diasVistos, 3);
  assert.equal(state3.completado, true, 'Debe marcarse como completado tras 3 días');

  // DÍA 4: Siguiente Lunes 28 de Septiembre (Día de gestión, pero ya completó los 3 días)
  const fechaSiguienteLunes = '2026-09-28';
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, fechaSiguienteLunes), false, 'NO debe volver a mostrarse nunca más tras los 3 días');
});

test('Aislamiento entre usuarios con diferentes horarios y estados', () => {
  mockStorage.clear();

  const anuncio = {
    id: 'anuncio-test-002',
    diasDeAparicion: 3,
    fechaInicio: '2026-09-01',
    activo: true
  };

  const userA = { id: 'usr_A', diasGestion: ['lunes', 'miercoles'] };
  const userB = { id: 'usr_B', diasGestion: ['martes', 'jueves'] };

  const martes = '2026-09-22';
  // El martes, User A no debe verlo, pero User B sí
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, userA, martes), false);
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, userB, martes), true);

  // User B ve el anuncio el martes
  KJAAnnouncementModal.recordView(anuncio, userB, martes);

  // El miércoles, User A lo ve (día 1), User B no lo ve (no gestiona miércoles)
  const miercoles = '2026-09-23';
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, userA, miercoles), true);
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, userB, miercoles), false);

  const stateA = KJAAnnouncementModal.getUserState(anuncio.id, userA.id);
  const stateB = KJAAnnouncementModal.getUserState(anuncio.id, userB.id);

  assert.equal(stateA.diasVistos, 0); // aún no ha grabado el miércoles
  assert.equal(stateB.diasVistos, 1);
});

test('Respeto a fecha de inicio y estado inactivo', () => {
  mockStorage.clear();

  const anuncioFuturo = {
    id: 'anuncio-futuro',
    fechaInicio: '2026-10-01',
    diasDeAparicion: 3,
    activo: true
  };

  const user = { id: 'usr_1', diasGestion: ['lunes', 'jueves'] };

  // Intentar mostrar antes de la fecha de inicio
  assert.equal(KJAAnnouncementModal.shouldShow(anuncioFuturo, user, '2026-09-21'), false);

  // Anuncio desactivado
  const anuncioInactivo = {
    id: 'anuncio-inactivo',
    fechaInicio: '2026-09-01',
    activo: false
  };
  assert.equal(KJAAnnouncementModal.shouldShow(anuncioInactivo, user, '2026-09-21'), false);
});

test('Restablecimiento de estado y configuración dinámica', () => {
  mockStorage.clear();

  const anuncio = {
    id: 'anuncio-dinamico',
    diasDeAparicion: 2,
    fechaInicio: '2026-09-01',
    activo: true
  };

  const user = { id: 999, diasGestion: ['lunes'] };
  const lunes1 = '2026-09-21';
  const lunes2 = '2026-09-28';
  const lunes3 = '2026-10-05';

  // Lunes 1 -> muestra y cuenta día 1
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, lunes1), true);
  KJAAnnouncementModal.recordView(anuncio, user, lunes1);

  // Lunes 2 -> muestra y cuenta día 2 (completa 2 de 2)
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, lunes2), true);
  KJAAnnouncementModal.recordView(anuncio, user, lunes2);

  // Lunes 3 -> ya no se muestra
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, lunes3), false);

  // Restablecer el estado
  const resetSuccess = KJAAnnouncementModal.resetUserState(anuncio.id, user.id);
  assert.equal(resetSuccess, true);

  // Después del reset, vuelve a mostrarse en su próximo día de gestión
  assert.equal(KJAAnnouncementModal.shouldShow(anuncio, user, lunes3), true);
});

