import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Includes public pages, attendance and the shared desktop/mobile portal.
test('retired contact notice is not loaded by any root HTML page', () => {
  for (const file of fs.readdirSync('.').filter(name => name.endsWith('.html'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /comunicado-modal\.(?:js|css)|kjaComunicado|kja-comunicado-overlay/, file);
  }
});

test('legacy script is inert even if an old page still requests it', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync('assets/js/comunicado-modal.js', 'utf8'), context);
  assert.deepEqual(Object.keys(context), []);
});
