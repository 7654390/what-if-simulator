import { describe, expect, it } from 'vitest';
import { validateInput } from '../src/validate.js';
import { percentile, Quantiles } from '../src/percentiles.js';
import { simulate } from '../src/simulate.js';
import { defaultInput } from '../src/defaults.js';
import { quiet } from './helpers.js';

describe('input validation', () => {
  it('accepts defaults and rejects malformed objects without throwing', () => {
    expect(validateInput(defaultInput()).ok).toBe(true);
    for (const value of [null, undefined, [], 1, {}, { phases: [null], events: [false] }]) {
      expect(validateInput(value).ok).toBe(false);
    }
  });
  it('explains the first phase boundary in German', () => {
    const input = quiet(); input.phases[0].fromAge++;
    const result = validateInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('Phasen müssen bei startAge beginnen');
  });
  it.each([499, 50_001, 501.5, NaN, Infinity])('rejects invalid path count %f', paths => {
    const input = quiet(); input.paths = paths;
    expect(validateInput(input).ok).toBe(false);
    expect(() => simulate(input)).toThrow(TypeError);
  });
  it('rejects fractional horizons, duplicate IDs, unsorted phases and invalid percentiles', () => {
    const input = quiet(); input.endAge += 0.5; input.percentiles = [50, 50];
    input.phases.push({ ...input.phases[0] });
    expect(validateInput(input).ok).toBe(false);
  });
  it('checks event discriminants and finite nested fields', () => {
    const input = defaultInput(); input.market.etfReturn = NaN;
    (input.events[0] as { type: string }).type = 'unknown';
    input.savingsPlan.dynamic = 1 as unknown as boolean;
    expect(validateInput(input).ok).toBe(false);
  });
});

describe('percentile selection', () => {
  it('matches a sorted reference including duplicates and interpolation', () => {
    const values = [7, 0, 3, 3, -4, 19, 6, 7, 7, 8, 2];
    const sorted = [...values].sort((a, b) => a - b);
    const scratch = new Float64Array(values);
    for (const p of [100, 0, 5, 25, 50, 75, 95, 33.3]) {
      const rank = (values.length - 1) * p / 100;
      const lo = Math.floor(rank); const hi = Math.ceil(rank);
      expect(percentile(scratch, p)).toBeCloseTo(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo), 10);
    }
  });
  it('handles constant values', () => {
    expect(percentile(new Float64Array(500).fill(42), 95)).toBe(42);
  });
  it('shares partitions correctly for arbitrary ranks, ties and reverse-ordered requests', () => {
    for (const length of [1, 2, 19, 500]) {
      const values = Float64Array.from({ length }, (_, i) => ((i * 7919) % 53) - 20);
      const sorted = Array.from(values).sort((a, b) => a - b);
      const requested = [100, 0, 90, 50, 25.5, 25, 5];
      const quantiles = new Quantiles(length, requested);
      quantiles.compute(values);
      requested.forEach((p, i) => {
        const rank = (length - 1) * p / 100;
        const low = Math.floor(rank);
        expect(quantiles.value(i)).toBeCloseTo(sorted[low] + (sorted[Math.ceil(rank)] - sorted[low]) * (rank - low), 9);
      });
    }
  });
});
