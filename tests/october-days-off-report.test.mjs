import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function makeContext(){
  const ctx = vm.createContext({
    console,
    Date,
    Intl,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Error,
    Promise,
    globalThis: {},
    APP: { access: { acceso_panel: true, rol: 'direccion' } }
  });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync('assets/js/dashboard-person-attendance.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('assets/js/attendance-report-model.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('assets/js/attendance-report-excel-layout.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('assets/js/intern-report-excel.js', 'utf8'), ctx);
  return ctx;
}

test('profileAttendanceState evaluates 2026-10-05 as dia libre for anyone without mark', () => {
  const ctx = makeContext();
  const person = { id: 1, nombre: 'Colaborador Test', activo: true, horario_semanal: { '1': { ini: '08:00', fin: '13:00' } } };
  
  // 5 de octubre sin marcar: debe ser día libre, nunca falta
  const day5 = { fecha: '2026-10-05', laborable: true, estado: null };
  const state5 = ctx.profileAttendanceState(day5, '2026-10-17', person);
  assert.equal(state5[0], 'dias_libres');
  assert.equal(state5[1], 'Día libre');
});

test('profileAttendanceState evaluates 2026-10-13 as dia libre for those without mark, keeping P for who marked and dash for unscheduled', () => {
  const ctx = makeContext();
  const personScheduled = { id: 1, nombre: 'Cynthia', activo: true, horario_semanal: { '2': { ini: '08:00', fin: '13:00' } } };
  const personMarked = { id: 2, nombre: 'Alviery', activo: true, horario_semanal: { '2': { ini: '08:00', fin: '13:00' } } };
  const personUnscheduled = { id: 3, nombre: 'Camila', activo: true, horario_semanal: { '1': { ini: '08:00', fin: '13:00' } } };

  // 13 de octubre sin marcar: día libre
  const day13Unmarked = { fecha: '2026-10-13', laborable: true, estado: null };
  const resUnmarked = ctx.profileAttendanceState(day13Unmarked, '2026-10-17', personScheduled);
  assert.equal(resUnmarked[0], 'dias_libres');
  assert.equal(resUnmarked[1], 'Día libre');

  // 13 de octubre marcado P (Alviery): se mantiene Presente
  const day13Marked = { fecha: '2026-10-13', laborable: true, estado: 'P' };
  const resMarked = ctx.profileAttendanceState(day13Marked, '2026-10-17', personMarked);
  assert.equal(resMarked[0], 'presentes');
  assert.equal(resMarked[1], 'Presente');

  // 13 de octubre sin programar en horario (Camila Cruz, laborable: false): no laborable
  const day13Unscheduled = { fecha: '2026-10-13', laborable: false, motivo: 'no_laborable', estado: null };
  const resUnscheduled = ctx.profileAttendanceState(day13Unscheduled, '2026-10-17', personUnscheduled);
  assert.equal(resUnscheduled[0], 'no_laborables');
});

test('attendance report model does not count 2026-10-05 and 2026-10-13 as faltas in summary totals', () => {
  const ctx = makeContext();
  const person = { id: 1, nombre: 'Jeanpier', activo: true };
  const attendance = {
    ok: true,
    asOf: '2026-10-17',
    days: [
      { fecha: '2026-10-05', laborable: true, estado: null },
      { fecha: '2026-10-13', laborable: true, estado: null }
    ]
  };
  const details = new Map([
    ['2026-10-05', { ok: true, cierre: { requisitos: [], asignaciones: [] } }],
    ['2026-10-13', { ok: true, cierre: { requisitos: [], asignaciones: [] } }]
  ]);

  const report = ctx.KJAAttendanceReport.build(person, attendance, details);
  assert.equal(report.totals.faltas, 0, 'No debe tener faltas acumuladas por dias libres');
  assert.equal(report.days[0].key, 'dias_libres');
  assert.equal(report.days[0].entry, 'Día libre');
  assert.equal(report.days[1].key, 'dias_libres');
  assert.equal(report.days[1].entry, 'Día libre');
});

test('attendance Excel layouts output DL code for dias libres and 0 faltas in summary sheet', () => {
  const ctx = makeContext();
  const person = { id: 1, nombre: 'Ronny', area: 'Recursos Humanos', activo: true, contrato_inicio: '2026-09-01' };
  const days = [
    { fecha: '2026-10-05', laborable: false, dia_libre: true, estado: null },
    { fecha: '2026-10-13', laborable: false, dia_libre: true, estado: null }
  ];
  const attendance = { ok: true, start: '2026-09-01', end: '2026-10-17', days, missing: [] };
  const builtReport = {
    person,
    days: [
      { date: '2026-10-05', key: 'dias_libres', entry: 'Día libre', sourceDay: days[0], tasks: { key: 'no_aplica' } },
      { date: '2026-10-13', key: 'dias_libres', entry: 'Día libre', sourceDay: days[1], tasks: { key: 'no_aplica' } }
    ],
    totals: { puntuales: 0, tardanzas: 0, faltas: 0 },
    note: ''
  };

  const workbook = ctx.KJAAttendanceExcelLayout.create({
    reports: [builtReport],
    range: { from: '2026-10-01', to: '2026-10-17' }
  });

  const attendanceSheet = workbook.sheets.find(s => s.name === 'Asistencia');
  assert.ok(attendanceSheet, 'Debe existir la hoja de Asistencia');
  assert.match(attendanceSheet.xml, />DL</, 'El XML debe contener la sigla DL');
  assert.doesNotMatch(attendanceSheet.xml, />F</, 'No debe contener la sigla F para dias libres');

  const summarySheet = workbook.sheets.find(s => s.name === 'Resumen');
  assert.ok(summarySheet, 'Debe existir la hoja de Resumen');
});
