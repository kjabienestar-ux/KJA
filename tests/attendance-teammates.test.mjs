import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/dashboard.js','utf8');
const section=source.slice(source.indexOf('let attendanceTeammates='),source.indexOf('function statusLabel('));
const context=vm.createContext({Set,Array,Number,String,encodeURIComponent,APP:{inicio:{colaborador:{area:'Ingeniería'}}},esc:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;'),initials:name=>name.split(' ').map(part=>part[0]).join('').slice(0,2),document:{querySelectorAll:()=>[]}});
vm.runInContext(section,context);

test('weekly schedule overrides general hours and marks no-work days',()=>{
  const person={dias_laborables:[1,2,3],hora_inicio:'08:00:00',hora_fin:'14:00:00',horario_semanal:{'1':{mod:'presencial',ini:'09:00',fin:'17:00'},'2':{mod:'no_gestiona'}}};
  assert.equal(context.teammateSchedule(person,1).start,'09:00');
  assert.equal(context.teammateSchedule(person,1).mode,'presencial');
  assert.equal(context.teammateSchedule(person,2),null);
  assert.equal(context.teammateSchedule(person,3).end,'14:00:00');
  assert.equal(context.teammateSchedule(person,4),null);
  assert.equal(context.teammateWorkingDays(person).join(','),'1,3');
});

test('teammate avatar uses a signed photo when available and initials otherwise',()=>{
  assert.match(context.attendanceTeammateAvatar({nombre:'Ana Beltrán',foto_url:'https://example.test/avatar.jpg?a=1&b=2'}),/data-profile-photo/);
  assert.match(context.attendanceTeammateAvatar({nombre:'Ana Beltrán',foto_url:'https://example.test/avatar.jpg?a=1&b=2'}),/a=1&amp;b=2/);
  assert.match(context.attendanceTeammateAvatar({nombre:'Ana Beltrán'}),/>AB<\/span>$/);
});

test('dated schedules start inclusively on the first attendance, across months',()=>{
  const person={primera_asistencia:'2026-09-14',dias_laborables:[1,2,3,4,5],hora_inicio:'08:00',hora_fin:'14:00'};
  assert.equal(context.teammateSchedule(person,1,'2026-09-07'),null);
  assert.equal(context.teammateSchedule(person,1,'2026-08-31'),null);
  assert.equal(context.teammateSchedule(person,1,'2026-09-14').start,'08:00');
  assert.equal(context.teammateSchedule(person,1,'2026-10-05').end,'14:00');
  assert.equal(context.teammateSchedule(person,7,'2026-09-20'),null);
  for(const start of [null,undefined])assert.equal(context.teammateSchedule({...person,primera_asistencia:start},1,'2026-09-21'),null);
  assert.equal(context.teammateWorkingDays(person).length,5); // Usual weekly schedule remains available.
});

test('preview supplies six engineers with distinct illustrated avatars and schedules',()=>{
  const people=context.attendancePreviewTeammates();
  assert.equal(people.length,6);
  assert.deepEqual(Array.from(people,person=>person.nombre),['Ingeniero 1','Ingeniero 2','Ingeniero 3','Ingeniero 4','Ingeniero 5','Ingeniero 6']);
  assert.equal(new Set(Array.from(people,person=>person.foto_url)).size,6);
  assert.ok(people.every(person=>person.area==='Ingeniería'&&person.foto_url.startsWith('data:image/svg+xml,')));
  assert.ok(people.every(person=>context.teammateWorkingDays(person).length>=3));
});
