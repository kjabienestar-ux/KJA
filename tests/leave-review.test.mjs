import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('inbox groups a submission, retains resolved dates and separates people and batches',()=>{
 const source=fs.readFileSync('assets/js/dashboard-leave-review.js','utf8');
 const context={};vm.createContext(context);
 vm.runInContext(source.slice(0,source.indexOf("$('admin-request-list').onclick")),context);
 const item=(id,group,person=1,state='pendiente')=>({id,tipo:'dia_libre',solicitud_grupo:group,colaborador_id:person,estado:state});
 const groups=context.groupAdminLeaveRequests([item(1,'a'),item(2,'a'),item(3,'a',1,'aprobada'),item(4,'b'),item(5,'a',2),item(6,'c',1,'rechazada'),{id:7,tipo:'justificacion',estado:'pendiente'}]);
 assert.equal(groups.length,4);
 assert.equal(groups[0].items.length,3);
 assert.equal(groups[0].items.filter(item=>item.estado==='pendiente').length,2);
 assert.equal(groups[1].items[0].id,4);assert.equal(groups[2].items[0].id,5);
});
