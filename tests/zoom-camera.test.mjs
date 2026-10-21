import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../assets/js/zoom-camera-model.js';

test('SDK 5.1.4 callback payload: only explicit camera booleans are known',()=>{
 const people=model.roster({result:{attendeesList:[
  {userId:1,userName:'Host',self:true,video:true},
  {userId:2,userName:'Ana',participantUUID:'stable',video:true},
  {userId:3,userName:'Luis',video:false},
  {userId:4,userName:'Sin dato'},
  {userId:5,userName:'Texto',video:'false'},
  {userId:6,userName:'Esperando',isHold:true,video:false}
 ]}});
 assert.deepEqual(people.map(p=>p.state),['on','off','unknown','unknown']);
 assert.equal(people[0].id,'uuid:stable');
 assert.deepEqual(model.roster([{userId:2,video:true}],'breakout').map(p=>p.state),['unknown']);
 assert.throws(()=>model.roster({result:'waiting room'}));
});

test('renaming preserves identity, duplicate names do not merge, missing IDs are ignored',()=>{
 const before=model.roster([{userId:1,participantUUID:'a',userName:'Ana',video:true}]);
 const after=model.roster([{userId:9,participantUUID:'a',userName:'Otro nombre',video:false},{userId:10,userName:'Otro nombre',video:true},{userName:'Sin ID'}]);
 assert.equal(before[0].id,after[0].id);assert.equal(after.length,2);assert.notEqual(after[0].id,after[1].id);
});

test('open rooms do not hide cameras confirmed in the observer room, and remote states stay unknown',()=>{
 const rooms={result:{rooms:[{boId:'sales',participants:[
  {participantId:2,participantUUID:'remote',participantStatus:'joined'},
  {participantId:3,participantUUID:'invited',participantStatus:'assigned'}
 ]}],unassigned:[{participantId:1,participantUUID:'main'}]}};
 const roster=[{userId:1,participantUUID:'main',video:true},{userId:2,participantUUID:'remote',video:true},{userId:3,participantUUID:'invited',video:false}];
 assert.deepEqual(model.roster(roster,model.roomVisibility('initial',rooms)).map(p=>p.state),['on','unknown','off']);
 const context=model.roomVisibility('in room',rooms,{result:{roomId:'sales'}});
 assert.deepEqual(model.roster(roster,context).map(p=>p.state),['unknown','on','unknown']);
 for(const state of ['joining','returning',undefined])assert.ok(model.roster(roster,model.roomVisibility(state,rooms)).every(p=>p.state==='unknown'));
 assert.ok(model.roster(roster,model.roomVisibility('initial',{rooms:[]})).every(p=>p.state==='unknown'));
 assert.deepEqual(model.roster([{userId:1,video:1},{userId:2,video:0},{userId:3,video:'1'},{userId:4,video:null}]).map(p=>p.state),['on','off','unknown','unknown']);
});

test('CSV escapes display names, spreadsheet formulas and preserves unknown percentages',()=>{
 const csv=model.csv({session:{started_at:'2026-10-21T14:00:00Z'},people:[{id:'user:1',name:'=HYPERLINK("url")',first_seen:'2026-10-21T14:00:00Z',last_seen:'2026-10-21T14:01:00Z',on_seconds:0,off_seconds:0,unknown_seconds:60,percentage:null}]},'Reunión, uno');
 assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/'=HYPERLINK\(""url""\)/);assert.ok(csv.endsWith(',""'));
 assert.equal(model.duration(125),'2 min 05 s');
});
