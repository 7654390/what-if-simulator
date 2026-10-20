import { describe, expect, it } from 'vitest';
import { defaultInput } from '../src/defaults.js';
import { simulate } from '../src/simulate.js';
import { quiet } from './helpers.js';

describe('deterministic simulation', () => {
  it('is deeply equal, including metadata, on cold and warm calls', () => {
    const input = defaultInput(); input.paths = 500;
    const before = structuredClone(input);
    const a = simulate(input);
    expect(simulate(input)).toEqual(a);
    expect(input).toEqual(before);
    expect(structuredClone(a)).toEqual(a);
    const other = structuredClone(input); other.seed++;
    expect(simulate(other).samplePaths).not.toEqual(a.samplePaths);
    expect(simulate(input)).toEqual(a);
  });

  it('uses the same market draws for a prefix of paths and a shorter horizon', () => {
    const input = defaultInput(); input.paths = 500;
    const a = simulate(input);
    input.paths = 750;
    expect(simulate(input).samplePaths).toEqual(a.samplePaths);
    input.endAge = 25;
    expect(simulate(input).samplePaths).toEqual(a.samplePaths.map(path => path.slice(0, 6)));
  });

  it('retains common random numbers when inactive scenario branches change', () => {
    const input = defaultInput(); input.paths = 500;
    const a = simulate(input);
    input.events = [{ type: 'oneOff', id: 'zero', enabled: true, atAge: 22, amount: 0, label: 'Null' }];
    expect(simulate(input)).toEqual(a);
    input.market.fatTails = false; simulate(input);
    input.market.fatTails = true;
    expect(simulate(input)).toEqual(a);
  });

  it('raises every band for 200 → 210 with identical draws and nonnegative excess return', () => {
    const input = quiet(5);
    input.phases[0].grossMonthly = 500;
    input.market.etfReturn = 0.07;
    input.savingsPlan.monthly = 200;
    const a = simulate(input);
    input.savingsPlan.monthly = 210;
    const b = simulate(input);
    for (const key of Object.keys(a.netWorth)) for (let y = 1; y < a.ages.length; y++) {
      expect(b.netWorth[key][y]).toBeGreaterThan(a.netWorth[key][y]);
    }
  });

  it('keeps inflation and salary shocks unchanged when the equity model changes', () => {
    const input = defaultInput(); input.paths = 500;
    input.start.etf = input.start.etfCostBasis = 0;
    input.savingsPlan.monthly = 0;
    const a = simulate(input);
    input.market.fatTails = false;
    input.market.etfReturn = -0.2;
    input.market.etfVolatility = 0.8;
    expect(simulate(input)).toEqual(a);
  });

  it('does not hide losses to manufacture monotonicity when reallocating cash into a losing ETF', () => {
    const input = quiet();
    input.phases[0].grossMonthly = 500;
    input.market.etfReturn = -0.2;
    input.savingsPlan.monthly = 200;
    const a = simulate(input);
    input.savingsPlan.monthly = 210;
    expect(simulate(input).summary.medianAtEnd).toBeLessThan(a.summary.medianAtEnd);
  });

  it('matches compound interest and an end-of-month annuity without randomness', () => {
    const input = quiet(5);
    input.start.etf = input.start.etfCostBasis = 100;
    input.phases[0].grossMonthly = 10;
    input.savingsPlan.monthly = 10;
    input.market.etfReturn = 0.07;
    const r = (1.07 ** (1 / 12)) - 1;
    const expected = 100 * 1.07 ** 5 + 10 * ((1 + r) ** 60 - 1) / r;
    expect(simulate(input).summary.medianAtEnd).toBeCloseTo(expected, 7);
  });

  it('matches cash compounding and real purchasing power', () => {
    const input = quiet(3); input.start.cash = 1000;
    input.market.cashRate = 0.03; input.market.inflationMean = 0.02;
    expect(simulate(input).summary.medianAtEnd).toBeCloseTo(1000 * (1.03 / 1.02) ** 3, 7);
    input.outputMode = 'nominal';
    expect(simulate(input).summary.medianAtEnd).toBeCloseTo(1000 * 1.03 ** 3, 7);
  });

  it('orders bands in every year and exposes consistent components and summaries', () => {
    const input = defaultInput(); input.paths = 500; input.targetNetWorth = 0;
    const result = simulate(input);
    for (const component of [result.netWorth, ...Object.values(result.components)]) {
      for (let year = 0; year < result.ages.length; year++) {
        const values = [5, 25, 50, 75, 95].map(p => component[p][year]);
        expect(values.every(Number.isFinite)).toBe(true);
        expect(values).toEqual([...values].sort((a, b) => a - b));
      }
    }
    expect(result.summary.probReachTarget).toBe(1 - result.summary.probNegativeAtEnd);
    expect(result.summary.medianAtEnd).toBe(result.netWorth['50'].at(-1));
    expect(result.samplePaths).toHaveLength(20);
  });

  it('reports a median even if percentile 50 was not requested', () => {
    const input = quiet(); input.percentiles = [0, 100]; input.start.debt = 100;
    const result = simulate(input);
    expect(result.summary.medianAtEnd).toBe(-100);
    expect(result.netWorth).toEqual({ '0': [-100, -100], '100': [-100, -100] });
    expect(result.summary.probNegativeAtEnd).toBe(1);
  });

  it('matches the same paths in the bounded-memory streaming mode at 50,000 paths', () => {
    const input = defaultInput(); input.paths = 500; input.endAge = 25;
    const reference = simulate(input);
    input.paths = 50_000;
    const streamed = simulate(input);
    expect(streamed.samplePaths).toEqual(reference.samplePaths);
    expect(streamed.ages).toEqual(reference.ages);
  });

  it('liquidates before using overdraft and never buys ETFs on credit', () => {
    const input = quiet(); input.start.etf = input.start.etfCostBasis = 100;
    input.phases[0].livingCostsMonthly = 100; input.savingsPlan.monthly = 200;
    const result = simulate(input);
    const r = 1.12 ** (1 / 12);
    let cash = 0;
    for (let m = 1; m < 12; m++) cash = cash * r - 100;
    expect(result.summary.medianAtEnd).toBeCloseTo(cash, 7);
    expect(result.components.etf['50'][1]).toBe(0);
    expect(result.components.cash['50'][1]).toBe(0);
    expect(result.components.debt['50'][1]).toBeCloseTo(-cash, 7);
  });
});
