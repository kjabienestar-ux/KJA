import test from 'node:test';import assert from 'node:assert/strict';
import {outsideAdmin,exceptionReason} from '../scripts/admin-legacy-exceptions.mjs';
test('Global institutional announcement scope is narrow and file-qualified',()=>{
  assert.equal(outsideAdmin('.kja-announcement-dialog.flyer-mode .kja-ann-dot','dashboard-announcement.css'),true);
  assert.equal(outsideAdmin('.kja-announcement-dialog,.admin-primary-action','dashboard-announcement.css'),false);
  assert.equal(outsideAdmin('.kja-announcement-dialog','dashboard.css'),false);
  assert.equal(outsideAdmin('#view-reclutamiento .admin-card'),true);
  assert.equal(outsideAdmin(':is(#view-reclutamiento,#view-gestion) .admin-card'),false);
  assert.equal(outsideAdmin('.portal:not(.admin-wide) .today-layout'),true);
});
test('Area and rank exceptions cannot excuse unrelated interactive controls',()=>{
  assert.equal(exceptionReason('dashboard-admin-layout.css','#portal .admin-role-area:nth-child(13n + 2)','--area-pastel','#eee7f8'),'area-identity-palette');
  assert.equal(exceptionReason('dashboard-admin-layout.css','#portal .admin-role-area','color','#eee7f8'),null);
  assert.equal(exceptionReason('dashboard-admin-control.css','#portal #admin-control-section .area-theme-salud .control-area-icon','color','#059669'),'area-identity-graphics');
  assert.equal(exceptionReason('dashboard-admin-control.css','#portal #admin-control-section .area-theme-salud .control-area-icon button','color','#059669'),null);
  assert.equal(exceptionReason('dashboard-admin-asignaciones.css','body:has(#portal.admin-wide) :is(.asg-opt-avatar,.asg-trigger-avatar).tone-salud','color','#5f7a5a'),'area-identity-palette');
  assert.equal(exceptionReason('dashboard-admin-asignaciones.css','body:has(#portal.admin-wide) .assignment-cta-btn','color','#5f7a5a'),null);
  assert.equal(exceptionReason('dashboard-ranking.css','#portal #admin-ranking-section .rk-pd-g .rk-pd-base','background','linear-gradient(#fff,#f8e2ae)'),'ranking-medal-graphics');
  assert.equal(exceptionReason('dashboard-ranking.css','#portal #admin-ranking-section .rk-pd-g button','color','#fff'),null);
  assert.equal(exceptionReason('dashboard-glass.css','#portal.admin-wide','--glass-surface','#faf9f5',['@media (prefers-reduced-transparency: reduce)']),'platform-fallback');
  assert.equal(exceptionReason('dashboard-glass.css','#portal.admin-wide','--glass-surface','#faf9f5',[]),null);
});
