import test from 'node:test';
import assert from 'node:assert/strict';

// DISC scoring simulation
function calculateDisc(answers) {
  const raw = { D: 10, I: 10, S: 10, C: 10 };

  Object.values(answers).forEach(ans => {
    if (ans.mas && raw[ans.mas] !== undefined) raw[ans.mas] += 2;
    if (ans.menos && raw[ans.menos] !== undefined) raw[ans.menos] = Math.max(0, raw[ans.menos] - 1);
  });

  const sum = raw.D + raw.I + raw.S + raw.C || 1;
  const pD = Math.round((raw.D / sum) * 100);
  const pI = Math.round((raw.I / sum) * 100);
  const pS = Math.round((raw.S / sum) * 100);
  const pC = Math.max(0, 100 - (pD + pI + pS));

  const sorted = [
    { key: 'D', val: pD, name: 'Dominancia' },
    { key: 'I', val: pI, name: 'Influencia' },
    { key: 'S', val: pS, name: 'Estabilidad' },
    { key: 'C', val: pC, name: 'Cumplimiento' }
  ].sort((a, b) => b.val - a.val);

  const primary = sorted[0].key;
  const secondary = sorted[1].key;
  const combo = primary + secondary;

  const archetypes = {
    'IS': 'I-S · Comunicador Empático y Colaborativo',
    'SI': 'S-I · Terapeuta Paciente y Facilitador',
    'DI': 'D-I · Líder Proactivo e Impulsor',
    'CD': 'C-D · Analista Riguroso y Evaluador Clínico',
    'CS': 'C-S · Metódico Sistemático y Detallista'
  };

  const arquetipo = archetypes[combo] || archetypes[secondary + primary] || `${primary}-${secondary} · Perfil Multidisciplinario KJA`;

  return {
    raw,
    percentages: { D: pD, I: pI, S: pS, C: pC },
    primary,
    secondary,
    arquetipo
  };
}

test('DISC calculation balances answers to 100%', () => {
  const answers = {
    1: { mas: 'I', menos: 'D' },
    2: { mas: 'I', menos: 'C' },
    3: { mas: 'S', menos: 'D' },
    4: { mas: 'S', menos: 'C' }
  };

  const result = calculateDisc(answers);
  const total = result.percentages.D + result.percentages.I + result.percentages.S + result.percentages.C;
  assert.equal(total, 100);
  assert.ok(result.percentages.I > result.percentages.D);
  assert.ok(result.percentages.S > result.percentages.D);
});

test('DISC determines correct clinical archetype for high I and S', () => {
  const answers = {
    1: { mas: 'I', menos: 'D' },
    2: { mas: 'I', menos: 'D' },
    3: { mas: 'I', menos: 'C' },
    4: { mas: 'S', menos: 'D' },
    5: { mas: 'S', menos: 'C' },
    6: { mas: 'S', menos: 'D' }
  };

  const result = calculateDisc(answers);
  assert.ok(['IS', 'SI'].includes(result.primary + result.secondary) || ['IS', 'SI'].includes(result.secondary + result.primary));
  assert.ok(result.arquetipo.includes('Empático') || result.arquetipo.includes('Terapeuta Paciente'));
});

test('DISC generates valid code format and percentages', () => {
  const answers = {};
  const result = calculateDisc(answers);
  assert.equal(result.percentages.D + result.percentages.I + result.percentages.S + result.percentages.C, 100);
});
