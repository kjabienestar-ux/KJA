import assert from 'node:assert/strict';

// Verify the effective surface, not merely the CSS declaration.
export async function assertAdminSurface(locator, kind = 'dialog') {
  const expected = kind === 'card'
    ? {radius:'16px',shadow:'rgba(51, 37, 26, 0.024) 0px 2px 4px 0px'}
    : {radius:'20px',shadow:'rgba(56, 49, 43, 0.18) 0px 20px 60px 0px'};
  const actual = await locator.evaluate(async (node, want) => {
    const read = () => { const s=getComputedStyle(node); return {radius:s.borderTopLeftRadius,shadow:s.boxShadow}; };
    const end=performance.now()+800;
    let value=read();
    while(performance.now()<end&&(value.radius!==want.radius||value.shadow!==want.shadow)){
      await new Promise(requestAnimationFrame);value=read();
    }
    return value;
  }, expected);
  assert.deepEqual(actual, expected, kind+' surface');
}
