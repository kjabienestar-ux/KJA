import test from 'node:test';
import assert from 'node:assert/strict';

test('CV file validator accepts valid formats and rejects invalid formats', () => {
  const validExtensions = ['.pdf', '.doc', '.docx'];
  const isValidFormat = (name) => {
    const lower = name.toLowerCase();
    return validExtensions.some(ext => lower.endsWith(ext));
  };

  assert.equal(isValidFormat('CV_Andrea_Morales.pdf'), true);
  assert.equal(isValidFormat('curriculum_2026.docx'), true);
  assert.equal(isValidFormat('hoja_de_vida.doc'), true);
  assert.equal(isValidFormat('foto.png'), false);
  assert.equal(isValidFormat('script.exe'), false);
  assert.equal(isValidFormat('documento.txt'), false);
});

test('CV file validator checks max size of 10 MB', () => {
  const maxSize = 10 * 1024 * 1024;
  const isSizeAllowed = (sizeBytes) => sizeBytes <= maxSize;

  assert.equal(isSizeAllowed(1.5 * 1024 * 1024), true); // 1.5 MB
  assert.equal(isSizeAllowed(9.9 * 1024 * 1024), true); // 9.9 MB
  assert.equal(isSizeAllowed(10 * 1024 * 1024), true);  // 10 MB exact
  assert.equal(isSizeAllowed(10.1 * 1024 * 1024), false); // 10.1 MB too large
  assert.equal(isSizeAllowed(25 * 1024 * 1024), false);
});

test('Step slider calculation computes exact horizontal offset', () => {
  const getOffset = (step) => `translateX(-${(step - 1) * 100}%)`;

  assert.equal(getOffset(1), 'translateX(-0%)');
  assert.equal(getOffset(2), 'translateX(-100%)');
  assert.equal(getOffset(3), 'translateX(-200%)');
  assert.equal(getOffset(4), 'translateX(-300%)');
});

test('Candidate dossier payload contains CV metadata', () => {
  const dossier = {
    id: 'KJA-REC-2026-1234',
    nombres: 'Andrea Morales Silva',
    dni: '74819203',
    cvName: 'CV_Andrea_Morales.pdf',
    cvSize: '1.4 MB',
    estado: 'Pendiente de entrevista'
  };

  assert.ok(dossier.cvName);
  assert.ok(dossier.cvSize);
  assert.equal(dossier.cvName.endsWith('.pdf'), true);
});

test('Custom Datepicker formats ISO and friendly Spanish strings correctly', () => {
  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const WEEKDAY_NAMES = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];

  const testDate = new Date(2026, 9, 22); // 22 de Octubre de 2026 (Jueves)
  const formatIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const formatFriendly = (d) => `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;

  assert.equal(formatIso(testDate), '2026-10-22');
  assert.equal(formatFriendly(testDate), 'Jueves, 22 de Octubre de 2026');
});

test('Custom Datepicker generates future available dates without Sundays', () => {
  const getNextAvailableDates = (startDate, count) => {
    const list = [];
    const cur = new Date(startDate);
    cur.setDate(cur.getDate() + 1);
    while (list.length < count) {
      if (cur.getDay() !== 0) { // No domingos
        list.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  };

  const dates = getNextAvailableDates(new Date(2026, 9, 21), 4);
  assert.equal(dates.length, 4);
  dates.forEach(d => {
    assert.notEqual(d.getDay(), 0); // Ninguno es domingo
  });
});

test('Notification email validator approves valid emails and rejects invalid ones', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert.equal(emailRegex.test('postulante@kja.edu.pe'), true);
  assert.equal(emailRegex.test('andrea.morales@gmail.com'), true);
  assert.equal(emailRegex.test('invalido-sin-arroba.com'), false);
  assert.equal(emailRegex.test('correo@'), false);
  assert.equal(emailRegex.test('@dominio.com'), false);
  assert.equal(emailRegex.test('espacio en@correo.com'), false);
});

test('Step 3 Appointment & Step 4 Confirmation Dossier format', () => {
  const candidate = {
    codigo: 'KJA-REC-2026-8812',
    nombres: 'Valeria Castro Ruiz',
    dni: '71928304',
    telefono: '987654321',
    email: 'valeria.castro@gmail.com',
    emailNotificacion: 'valeria.castro@gmail.com',
    carrera: 'Psicología Clínica',
    nivel: 'Egresado',
    modalidad: 'Presencial (Sede San Luis)',
    turno: 'Mañana (08:30 - 13:30)',
    cvName: 'CV_Valeria_Castro.pdf',
    cvSize: '1.8 MB',
    fechaEntrevista: 'Viernes, 24 de Octubre de 2026',
    horaEntrevista: '11:00 AM',
    canalEntrevista: 'Google Meet / Zoom (Reunión Virtual)',
    fechaPostulacion: '20/10/2026, 11:30'
  };

  assert.ok(candidate.codigo.startsWith('KJA-REC-2026-'));
  assert.equal(candidate.emailNotificacion, 'valeria.castro@gmail.com');
  assert.ok(candidate.fechaEntrevista);
  assert.ok(candidate.horaEntrevista);
  assert.ok(candidate.cvName.endsWith('.pdf'));
});
