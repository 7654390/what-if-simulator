import { bench, describe } from 'vitest';
import { defaultInput } from '../src/defaults.js';
import { simulate } from '../src/simulate.js';

const input = defaultInput();
input.endAge = 34;
simulate(input);

describe('10,000 paths × 14 years (168 monthly steps)', () => {
  bench('warm market cache / slider interaction', () => {
    input.savingsPlan.monthly = input.savingsPlan.monthly === 200 ? 210 : 200;
    simulate(input);
  }, { time: 1000, iterations: 20 });
  let seed = 10_000;
  bench('cold market / changed seed', () => { simulate({ ...input, seed: seed++ }); }, { time: 1000, iterations: 5 });
});
