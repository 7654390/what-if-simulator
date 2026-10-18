import { describe, expect, it } from 'vitest';
import { capitalGainsTax, grossWithdrawal, incomeTax, monthlyIncomeTax, socialContributions } from '../src/taxDE.js';
import { simulate } from '../src/simulate.js';
import { quiet } from './helpers.js';

describe('2026 tax model', () => {
  // Hand arithmetic: y=.2652 → 435.597...; z=1.2201 → 4217.278...; .42*80000-11135.63=22464.37.
  it.each([[15_000, 435], [30_000, 4217], [80_000, 22_464]])('taxes %i taxable EUR at %i EUR', (gross, expected) => {
    expect(incomeTax(gross)).toBe(expected);
  });
  it('uses allowance, integer flooring and the 45% zone', () => {
    expect(incomeTax(12_348)).toBe(0);
    expect(incomeTax(30_000.99)).toBe(incomeTax(30_000));
    expect(incomeTax(300_000)).toBe(115_529);
  });
  it('models minijob, werkstudent and the shared contribution cap', () => {
    expect(monthlyIncomeTax(603, 'minijob')).toBe(0);
    expect(socialContributions(603, 'minijob')).toBe(0);
    expect(socialContributions(1100, 'werkstudent')).toBeCloseTo(102.3);
    expect(socialContributions(100_000, 'standard')).toBe(1690);
  });
  it('applies the 30% exemption before the 1000 EUR allowance', () => {
    expect(capitalGainsTax(1000)).toBe(0);
    expect(capitalGainsTax(10_000)).toBeCloseTo(1582.5);
    expect(capitalGainsTax(-10_000)).toBe(0);
    expect(capitalGainsTax(2000, 0)).toBeCloseTo(369.25);
  });
  it('grosses up withdrawals with a partial allowance', () => {
    const sale = grossWithdrawal(3000, 10_000, 2000, 500);
    expect(sale - capitalGainsTax(sale * 0.8, 500)).toBeCloseTo(3000, 9);
    expect(grossWithdrawal(20_000, 10_000, 2000, 0)).toBe(10_000);
  });
  it('accounts for latent tax at start and tax when liquidating', () => {
    const input = quiet();
    input.start.etf = 10_000; input.start.etfCostBasis = 0;
    input.events = [{ type: 'oneOff', id: 'cost', enabled: true, atAge: 20, amount: -9000, label: 'Kosten' }];
    const result = simulate(input);
    expect(result.netWorth['50'][0]).toBe(8417.5);
    expect(result.summary.totalTaxesPaidMedian).toBeCloseTo(1582.5);
    expect(result.components.etf['50'][1]).toBe(0);
    expect(result.summary.medianAtEnd).toBeLessThan(-582.5);
  });
});
