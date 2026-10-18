import { describe, expect, it } from 'vitest';
import { annuity, BAFOEG, loanSchedule, monthlyRate } from '../src/loan.js';
import { simulate } from '../src/simulate.js';
import { quiet } from './helpers.js';

describe('loans and life events', () => {
  it.each([0, 0.05, 0.15])('amortizes an annuity at rate %f', rate => {
    let balance = 10_000;
    const payment = annuity(balance, rate, 120);
    for (let m = 0; m < 120; m++) balance = balance * (1 + monthlyRate(rate)) - payment;
    expect(balance).toBeCloseTo(0, 7);
  });
  it('pays out, accrues interest during grace, and repays a student loan', () => {
    const events = [{ type: 'studentLoan' as const, id: 'loan', enabled: true, atAge: 20,
      payoutMonthly: 1000, payoutMonths: 12, graceMonths: 6, interestRate: 0.06, repaymentMonths: 24 }];
    const schedule = loanSchedule(events, 20, 48);
    expect(schedule.cashFlow[0]).toBe(1000);
    expect(schedule.cashFlow[12]).toBe(0);
    expect(schedule.debt[17]).toBeGreaterThan(schedule.debt[11]);
    expect(schedule.cashFlow[18]).toBeLessThan(0);
    expect(schedule.debt[41]).toBeCloseTo(0, 7);
    expect(schedule.debt[47]).toBeCloseTo(0, 7);
    const input = quiet(4); input.events = events;
    expect(simulate(input).components.debt['50'][4]).toBeGreaterThanOrEqual(0);
  });
  it('caps BAföG at half the payout and 10010 EUR, then repays after 60 months', () => {
    const events = [{ type: 'bafoeg' as const, id: 'b', enabled: true, atAge: 20, monthly: 1000, months: 24 }];
    const schedule = loanSchedule(events, 20, 180);
    expect(schedule.debt[0]).toBe(500);
    expect(schedule.debt[23]).toBe(BAFOEG.repaymentCap);
    expect(schedule.debt[83]).toBe(BAFOEG.repaymentCap);
    expect(schedule.cashFlow[84]).toBe(-130);
    expect(schedule.debt[179]).toBe(0);
    const input = quiet(2); input.events = events;
    expect(simulate(input).summary.medianAtEnd).toBe(24_000 - 10_010);
  });
  it('applies a one-off once and ignores disabled events', () => {
    const input = quiet(2);
    input.events = [{ type: 'oneOff', id: 'gift', enabled: true, atAge: 20.5, amount: 1000, label: 'Einmalig' }];
    expect(simulate(input).netWorth['50']).toEqual([0, 1000, 1000]);
    input.events[0].enabled = false;
    expect(simulate(input).summary.medianAtEnd).toBe(0);
  });
  it('applies temporary part-time on a monthly boundary, then restores the phase factor', () => {
    const input = quiet(); input.phases[0].grossMonthly = 100;
    input.events = [{ type: 'partTime', id: 'pt', enabled: true, fromAge: 20, toAge: 20.5, factor: 0.5 }];
    expect(simulate(input).summary.medianAtEnd).toBe(900);
  });
  it('accounts for abroad costs, grant and a permanent later salary boost', () => {
    const input = quiet(); input.phases[0].grossMonthly = 100;
    input.events = [{ type: 'semesterAbroad', id: 'a', enabled: true, atAge: 20, months: 6,
      extraCostsMonthly: 60, grantMonthly: 45, salaryBoostAfter: 0.1 }];
    expect(simulate(input).summary.medianAtEnd).toBeCloseTo(1170, 8);
  });
  it('switches a phase at a fractional age', () => {
    const input = quiet(); input.phases[0].grossMonthly = 100;
    input.phases.push({ ...input.phases[0], id: 'later', fromAge: 20.5, grossMonthly: 200 });
    expect(simulate(input).summary.medianAtEnd).toBe(1800);
  });
});
