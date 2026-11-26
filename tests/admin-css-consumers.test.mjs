import test from 'node:test';
import assert from 'node:assert/strict';
import {outsideAdmin,inventory} from '../scripts/audit-admin-css-consumers.mjs';
test('Solo se excluyen consumidores explícitos de otras vistas, nunca listas mixtas o negaciones',()=>{
  assert.equal(outsideAdmin('#portal:not(.admin-wide) #view-inicio .clock'),true);
  assert.equal(outsideAdmin('#portal[data-view="cert-cuentas"] #view-cert-cuentas'),true);
  assert.equal(outsideAdmin('#view-inicio .x,#view-gestion .x'),false);
  assert.equal(outsideAdmin(':is(#view-inicio,#view-gestion) .x'),false);
  assert.equal(outsideAdmin('#portal:not(#view-inicio) .x'),false);
  assert.equal(outsideAdmin('#view-perfil .x,#view-inicio .x'),true);
  assert.equal(outsideAdmin('#portal:not(.admin-wide) .day-card'),true);
  assert.equal(outsideAdmin('#portal:not(.admin-wide) .day-card,#portal .admin-card'),false);
  assert.equal(outsideAdmin(':is(#portal:not(.admin-wide),#portal.admin-wide) .card'),false);
  assert.equal(outsideAdmin('#portal:not(:not(.admin-wide)) .card'),false);
  assert.equal(outsideAdmin('#portal .card:not(.admin-wide)'),false);
});
test('El inventario conserva cada uso, archivo, consulta y selector',()=>{
  const g=inventory({'a.css':[['@media (min-width:901px) / #view-inicio .x | color',{'#fff':2}],['@media (min-width:901px) / #view-inicio .x | background',{'#aaa':1}],['#view-gestion .x | color',{'#fff':1}]]});
  assert.equal(g.length,2);assert.equal(g[0].uses,3);assert.equal(g[0].outside,true);assert.equal(g[0].desktop,true);assert.equal(g[1].anchored,true);
});
