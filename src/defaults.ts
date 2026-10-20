import type { SimulationInput } from './types.js';

export function defaultInput(): SimulationInput {
  return {
    seed: 42, paths: 10_000, startAge: 20, endAge: 35, outputMode: 'real',
    start: { cash: 2_000, etf: 1_500, etfCostBasis: 1_500, debt: 0 },
    market: { etfReturn: 0.07, etfVolatility: 0.15, fatTails: true, cashRate: 0.02,
      inflationMean: 0.02, inflationVolatility: 0.01, etfTer: 0.002 },
    phases: [
      { id: 'study', label: 'Studium', fromAge: 20, kind: 'study', grossMonthly: 1_100,
        partTimeFactor: 1, salaryGrowth: 0, livingCostsMonthly: 950, taxClass: 'werkstudent' },
      { id: 'work', label: 'Berufseinstieg', fromAge: 23, kind: 'work', grossMonthly: 3_800,
        partTimeFactor: 1, salaryGrowth: 0.02, livingCostsMonthly: 1_600, taxClass: 'standard' },
    ],
    savingsPlan: { monthly: 150, dynamic: true },
    events: [
      { type: 'semesterAbroad', id: 'abroad', enabled: false, atAge: 22, months: 6,
        extraCostsMonthly: 600, grantMonthly: 450, salaryBoostAfter: 0.03 },
      { type: 'studentLoan', id: 'loan', enabled: false, atAge: 20, payoutMonthly: 400,
        payoutMonths: 36, interestRate: 0.05, graceMonths: 18, repaymentMonths: 120 },
      { type: 'partTime', id: 'part-time', enabled: false, fromAge: 30, toAge: 33, factor: 0.8 },
    ],
    percentiles: [5, 25, 50, 75, 95],
  };
}
