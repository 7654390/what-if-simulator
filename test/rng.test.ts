import { expect, it } from 'vitest';
import { nextShocks, Random } from '../src/rng.js';

it('produces reproducible, distinct per-path streams with open uniform endpoints', () => {
  const a = new Random(42, 0), b = new Random(42, 0), c = new Random(42, 1);
  for (let i = 0; i < 1000; i++) {
    const n = a.uniform(); expect(n).toBe(b.uniform()); expect(n).toBeGreaterThan(0); expect(n).toBeLessThan(1);
  }
  expect(c.uniform()).not.toBe(b.uniform());
});

it('has normal moments and unit-variance fat tails without cross-channel correlation', () => {
  const rng = new Random(1234);
  const s = { equity: 0, inflation: 0, salary: 0, studentT: 0 };
  const count = 200_000;
  let sum = 0, square = 0, cross = 0, tSquare = 0, normalTails = 0, fatTails = 0;
  for (let i = 0; i < count; i++) {
    nextShocks(rng, s);
    sum += s.equity; square += s.equity ** 2; cross += s.equity * s.inflation; tSquare += s.studentT ** 2;
    if (Math.abs(s.equity) > 3) normalTails++;
    if (Math.abs(s.studentT) > 3) fatTails++;
  }
  expect(Math.abs(sum / count)).toBeLessThan(0.01);
  expect(square / count).toBeGreaterThan(0.98); expect(square / count).toBeLessThan(1.02);
  expect(Math.abs(cross / count)).toBeLessThan(0.01);
  expect(tSquare / count).toBeGreaterThan(0.95); expect(tSquare / count).toBeLessThan(1.05);
  expect(fatTails).toBeGreaterThan(normalTails * 2);
});
